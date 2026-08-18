import type { PlayerStateRef, PlayerStateMut, GameTick } from "../01-foundation/types"
import type { FullKey } from "../03-registry/types"

// ── Save data format ──

export interface SaveMeta {
  version: number
  timestamp: number
  initKey: string
  tickCount: number
  areaKey: string
}

export interface SaveGameData {
  schema: "arona_save_v1"
  meta: SaveMeta
  player: Record<string, unknown>
}

const CURRENT_SAVE_VERSION = 1

// ── Serialize GameInstance player state to SaveGameData ──

export function serializePlayer(
  player: PlayerStateRef,
  tickCount: GameTick,
): SaveGameData {
  return {
    schema: "arona_save_v1",
    meta: {
      version: CURRENT_SAVE_VERSION,
      timestamp: Date.now(),
      initKey: player.currentInit,
      tickCount,
      areaKey: player.currentArea,
    },
    player: JSON.parse(JSON.stringify(player)),
  }
}

// ── Deserialize SaveGameData into raw player state ──

export function deserializePlayer(save: SaveGameData): {
  player: PlayerStateMut
  tickCount: GameTick
} {
  const player = save.player as unknown as PlayerStateMut
  return {
    player,
    tickCount: save.meta.tickCount,
  }
}

// ── Validation ──

export function isValidSave(data: unknown): data is SaveGameData {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  if (d.schema !== "arona_save_v1") return false
  if (!d.meta || typeof d.meta !== "object") return false
  if (!d.player || typeof d.player !== "object") return false
  const m = d.meta as Record<string, unknown>
  return typeof m.tickCount === "number" && typeof m.initKey === "string"
}

// ── Storage interface (browser localStorage / Node mock) ──

export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

// ── SaveSlotManager (requires a StorageBackend) ──

export class SaveSlotManager {
  private prefix: string
  private storage: StorageBackend

  constructor(storage: StorageBackend, storagePrefix = "arona_save_") {
    this.storage = storage
    this.prefix = storagePrefix
  }

  private storageKey(slot: number): string {
    return `${this.prefix}${slot}`
  }

  listSaves(): { slot: number; meta: SaveMeta }[] {
    const result: { slot: number; meta: SaveMeta }[] = []
    for (let i = 0; i < 10; i++) {
      const raw = this.storage.getItem(this.storageKey(i))
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        if (isValidSave(data)) {
          result.push({ slot: i, meta: data.meta })
        }
      } catch { /* skip corrupt */ }
    }
    return result.sort((a, b) => a.slot - b.slot)
  }

  save(slot: number, data: SaveGameData): void {
    this.storage.setItem(this.storageKey(slot), JSON.stringify(data))
  }

  load(slot: number): SaveGameData | null {
    const raw = this.storage.getItem(this.storageKey(slot))
    if (!raw) return null
    try {
      const data = JSON.parse(raw)
      return isValidSave(data) ? data : null
    } catch {
      return null
    }
  }

  delete(slot: number): void {
    this.storage.removeItem(this.storageKey(slot))
  }

  exportSlot(slot: number): string | null {
    const data = this.load(slot)
    return data ? JSON.stringify(data, null, 2) : null
  }

  importSlot(json: string, slot: number): boolean {
    try {
      const data = JSON.parse(json)
      if (!isValidSave(data)) return false
      this.save(slot, data)
      return true
    } catch {
      return false
    }
  }
}
