// ============================================================
// engine/game/init-savepoint.ts — per-Init 快照（保存/恢复/清除/播种）
// 从 init-service.ts 拆出的纯状态操作：global Spot 属全局层，不进快照。
// ============================================================

import type { PlayerState, InitDef } from '../types';
import { Registry } from '../registry/registry';
import { freshPerInitState, globalSpotEntries, localSpotEntries } from './snapshot';
import { extra, mergeExtra } from '../extra/index';

export class InitSavepoint {
  constructor(
    private readonly registry: Registry,
    private readonly getState: () => PlayerState,
  ) {}

  private get state(): PlayerState {
    return this.getState();
  }

  /** 将当前 PlayerState 中的 Init 局部字段保存到快照。 */
  save(initId: string): void {
    const state = this.state;
    if (!state.initSnapshots) state.initSnapshots = {};
    state.initSnapshots[initId] = {
      resources: { ...state.resources },
      spotLevels: localSpotEntries(this.registry, state.spotLevels),
      spotManagers: localSpotEntries(this.registry, state.spotManagers),
      visitedAreas: state.visitedAreas ? [...state.visitedAreas] : [],
      totalFrames: state.totalFrames,
      inventory: { ...state.inventory },
      unlockedEnhancements: [...state.unlockedEnhancements],
      storyLog: [...state.storyLog],
      flags: { ...state.flags },
      triggersCompleted: state.triggersCompleted ? [...state.triggersCompleted] : [],
      currentAreaId: state.currentAreaId,
      extras: state.initExtras ? mergeExtra(extra.dict({}), state.initExtras) : undefined,
      ...this.characterSnapshotFields(state),
    };
  }

  /** 归属为 init 的 Character 容器进快照；global 块不写（跨世界线保留）。 */
  private characterSnapshotFields(state: PlayerState): Partial<NonNullable<PlayerState['initSnapshots']>[string]> {
    const fields: Record<string, unknown> = {};
    if (this.registry.characterScopeOf('roster') === 'init') {
      fields.roster = state.roster ? { ...state.roster } : {};
      fields.fragments = state.fragments ? { ...state.fragments } : {};
    }
    if (this.registry.characterScopeOf('gacha') === 'init') {
      fields.gachaState = state.gachaState ? { ...state.gachaState } : {};
    }
    if (this.registry.characterScopeOf('chatRead') === 'init') {
      fields.chatRead = state.chatRead ? { ...state.chatRead } : {};
    }
    return fields;
  }

  /** 将 PlayerState 的 Init 局部字段重置为新鲜值（global Spot 跨世界线保留）。 */
  clear(): void {
    const state = this.state;
    const fresh = freshPerInitState();
    state.resources = fresh.resources;
    state.spotLevels = globalSpotEntries(this.registry, state.spotLevels);
    state.spotManagers = globalSpotEntries(this.registry, state.spotManagers);
    state.visitedAreas = fresh.visitedAreas;
    state.totalFrames = fresh.totalFrames;
    state.inventory = fresh.inventory;
    state.unlockedEnhancements = fresh.unlockedEnhancements;
    state.storyLog = fresh.storyLog;
    state.flags = fresh.flags;
    state.triggersCompleted = fresh.triggersCompleted;
    state.currentAreaId = fresh.currentAreaId;
    state.initExtras = fresh.initExtras;
    state.activeInit = '';
    // 归属为 init 的 Character 容器随世界线重置；global 块原样保留
    if (this.registry.characterScopeOf('roster') === 'init') {
      state.roster = {};
      state.fragments = {};
    }
    if (this.registry.characterScopeOf('gacha') === 'init') {
      state.gachaState = {};
    }
    if (this.registry.characterScopeOf('chatRead') === 'init') {
      state.chatRead = {};
    }
  }

  /** 将快照中的 Init 局部字段恢复到 PlayerState（global Spot 以全局层当前值为准）。 */
  restore(snapshot: NonNullable<PlayerState['initSnapshots']>[string]): void {
    const state = this.state;
    state.resources = snapshot.resources;
    state.spotLevels = { ...globalSpotEntries(this.registry, state.spotLevels), ...localSpotEntries(this.registry, snapshot.spotLevels ?? {}) };
    state.spotManagers = { ...globalSpotEntries(this.registry, state.spotManagers), ...localSpotEntries(this.registry, snapshot.spotManagers ?? {}) };
    state.visitedAreas = snapshot.visitedAreas;
    state.totalFrames = snapshot.totalFrames;
    state.inventory = snapshot.inventory;
    state.unlockedEnhancements = snapshot.unlockedEnhancements;
    state.storyLog = snapshot.storyLog;
    state.flags = snapshot.flags;
    state.triggersCompleted = snapshot.triggersCompleted;
    state.currentAreaId = snapshot.currentAreaId;
    state.initExtras = snapshot.extras ? mergeExtra(extra.dict({}), snapshot.extras) : extra.dict({});
    // 归属为 init 的容器从快照恢复；global 块以全局层当前值为准（不覆盖）
    if (this.registry.characterScopeOf('roster') === 'init') {
      state.roster = snapshot.roster ?? {};
      state.fragments = snapshot.fragments ?? {};
    }
    if (this.registry.characterScopeOf('gacha') === 'init') {
      state.gachaState = snapshot.gachaState ?? {};
    }
    if (this.registry.characterScopeOf('chatRead') === 'init') {
      state.chatRead = snapshot.chatRead ?? {};
    }
  }

  /** 以 InitDef.extra 为底座重建当前 Init 的 per-Init extras。 */
  seed(init: InitDef): void {
    this.state.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({}));
  }
}