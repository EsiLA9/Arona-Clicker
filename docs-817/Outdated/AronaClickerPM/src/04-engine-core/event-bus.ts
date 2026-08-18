import type { GameTick } from "../01-foundation/types"

// ── Event type constants ──

export const EventTypes = {
  ResourceAdded: "resource/added",
  ResourceRemoved: "resource/removed",
  ResourceTotalChanged: "resource/total_changed",

  SpotPurchased: "spot/purchased",
  SpotUpgraded: "spot/upgraded",
  SpotProduced: "spot/produced",
  SpotDiscovered: "spot/discovered",

  EnhancementPurchased: "enhancement/purchased",

  StoryStarted: "story/started",
  StoryTalkletPlayed: "story/talklet_played",
  StoryEnded: "story/ended",
  StoryModifiedState: "story/modified_state",

  AreaEntered: "area/entered",
  AreaExplored: "area/explored",

  TagCollected: "tag/collected",
  TagTriggered: "tag/triggered",

  InitChanged: "init/changed",

  TickPassed: "tick/passed",
  SaveLoaded: "save/loaded",
} as const

// ── Event payload types ──

export interface ResourceAddedPayload {
  resource: string
  amount: number
  newTotal: number
  init?: string
}

export interface ResourceRemovedPayload {
  resource: string
  amount: number
  newTotal: number
  init?: string
}

export interface ResourceTotalChangedPayload {
  resource: string
  totalGained: number
  totalConsumed: number
  init?: string
}

export interface SpotPurchasedPayload {
  spot: string
  area: string
  level: number
  cost: { resource: string; amount: number }
}

export interface SpotUpgradedPayload {
  spot: string
  level: number
  cost: { resource: string; amount: number }
}

export interface SpotProducedPayload {
  spot: string
  productions: { resource: string; amount: number }[]
}

export interface SpotDiscoveredPayload {
  spot: string
  area: string
}

export interface EnhancementPurchasedPayload {
  enhancement: string
  level: number
  cost: { resource: string; amount: number }
}

export interface StoryStartedPayload {
  story: string
  ownerKey: string
}

export interface StoryTalkletPlayedPayload {
  story: string
  talkletId: string
  label: number
}

export interface StoryEndedPayload {
  story: string
  ownerKey: string
  labels: number[]
}

export interface StoryModifiedStatePayload {
  story: string
  modification: any
}

export interface AreaEnteredPayload {
  area: string
  init: string
}

export interface AreaExploredPayload {
  area: string
  progress: number
}

export interface TagCollectedPayload {
  typeName: string
  tag: string
  total: number
}

export interface TagTriggeredPayload {
  typeName: string
  tag: string
  total: number
}

export interface InitChangedPayload {
  from?: string
  to: string
}

export interface TickPassedPayload {
  tick: number
}

export interface SaveLoadedPayload {
  tick: number
}

// ── Event type → payload mapping ──

export interface EventPayloadMap {
  [EventTypes.ResourceAdded]: ResourceAddedPayload
  [EventTypes.ResourceRemoved]: ResourceRemovedPayload
  [EventTypes.ResourceTotalChanged]: ResourceTotalChangedPayload
  [EventTypes.SpotPurchased]: SpotPurchasedPayload
  [EventTypes.SpotUpgraded]: SpotUpgradedPayload
  [EventTypes.SpotProduced]: SpotProducedPayload
  [EventTypes.SpotDiscovered]: SpotDiscoveredPayload
  [EventTypes.EnhancementPurchased]: EnhancementPurchasedPayload
  [EventTypes.StoryStarted]: StoryStartedPayload
  [EventTypes.StoryTalkletPlayed]: StoryTalkletPlayedPayload
  [EventTypes.StoryEnded]: StoryEndedPayload
  [EventTypes.StoryModifiedState]: StoryModifiedStatePayload
  [EventTypes.AreaEntered]: AreaEnteredPayload
  [EventTypes.AreaExplored]: AreaExploredPayload
  [EventTypes.TagCollected]: TagCollectedPayload
  [EventTypes.TagTriggered]: TagTriggeredPayload
  [EventTypes.InitChanged]: InitChangedPayload
  [EventTypes.TickPassed]: TickPassedPayload
  [EventTypes.SaveLoaded]: SaveLoadedPayload
}

// ── Core types ──

export type EventType = keyof EventPayloadMap

export interface GameEvent<T extends EventType = EventType> {
  type: T
  timestamp: GameTick
  data: EventPayloadMap[T]
}

export type EventHandler<T extends EventType = EventType> = (event: GameEvent<T>) => void

export interface Subscription {
  id: string
  type: EventType
  dispose(): void
}

// ── EventBus ──

let nextSubId = 0

export class EventBus {
  private handlers = new Map<EventType, Map<string, EventHandler>>()

  hasSubscribers(type: EventType): boolean {
    const subs = this.handlers.get(type)
    return subs != null && subs.size > 0
  }

  publish<T extends EventType>(type: T, data: EventPayloadMap[T], tick: GameTick): void {
    const subs = this.handlers.get(type)
    if (!subs || subs.size === 0) return

    const event: GameEvent<T> = { type, timestamp: tick, data }
    for (const handler of subs.values()) {
      try {
        handler(event as any)
      } catch {
        // 事件发布中的异常不应阻断其他订阅者
      }
    }
  }

  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): Subscription {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Map())
    }
    const id = `sub_${nextSubId++}`
    this.handlers.get(type)!.set(id, handler as EventHandler)

    const bus = this
    return {
      id,
      type,
      dispose() {
        bus.handlers.get(type)?.delete(id)
      },
    }
  }

  unsubscribe(sub: Subscription): void {
    sub.dispose()
  }

  clear(): void {
    this.handlers.clear()
  }
}
