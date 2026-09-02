import type { Datapack } from '../data-services/contracts/datapack';
// ============================================================
// arona-clicker/runtime-reset.ts — 运行时重置 / 数据包重载 / 学生阻断复检
// 从 game-instance.ts 拆出：reset / reload / recheckStudentBlocks
// ============================================================

import type { PlayerState } from './types/state';
import { DevLog } from '../engine/core/dev-log';
import { Registry } from '../data-services/registry/registry';
import type { RuntimeMutationPort } from './contracts/mutation';
import { StatsService } from '../engine/stats/stats';
import { AffectorEngine } from '../engine/effect/affector-engine';
import { TriggerSystem } from '../engine/effect/trigger-system';
import { ConditionSystem } from '../engine/expression/condition-system';
import { TagStatService } from '../engine/stats/tag-stats';
import { VisibilityEngine } from '../engine/visibility/visibility-engine';
import { StoryService } from './services/story-service';
import { InitService } from './services/init-service';
import { SessionService } from '../engine/runtime/session-service';

export interface ResetContext {
  stop: () => void;
  createDefaultState: () => PlayerState;
  setState: (next: PlayerState) => void;
  sessionService: SessionService;
  mutations: RuntimeMutationPort;
  statsService: StatsService;
  affectorEngine: AffectorEngine;
  triggerSystem: TriggerSystem;
  tagStatService: TagStatService;
  initService: InitService;
  visibilityEngine: VisibilityEngine;
  storyService: StoryService;
  devLog: DevLog;
}

/** 重置为默认状态并清空各子系统运行时缓存 */
export function resetRuntime(ctx: ResetContext): void {
  ctx.stop();
  const state = ctx.createDefaultState();
  ctx.setState(state);
  ctx.sessionService.touchLastTick();
  ctx.mutations.setState(state);
  ctx.statsService.setState(state);
  ctx.statsService.reset();
  ctx.affectorEngine.setState(state);
  ctx.triggerSystem.setState(state);
  ctx.tagStatService.setState(state);
  // 重置后默认状态无物品/强化/Spot：对账清空旧世界线遗留实例
  ctx.affectorEngine.reconcileMounts();
  // 移除已挂载的世界线专属 Trigger
  ctx.initService.unmountInitTriggers();
  ctx.visibilityEngine.reset();
  ctx.storyService.clearCurrentStory();
  ctx.devLog.clear();
  ctx.devLog.record('运行时状态已重置', { source: 'runtime', level: 'warning' });
}

export interface ReloadContext {
  stop: () => void;
  registry: Registry;
  affectorEngine: AffectorEngine;
  triggerSystem: TriggerSystem;
  reset: () => void;
  init: (datapacks: Datapack[]) => void;
}

/** 重载数据包：清空注册表与缓存后重新初始化 */
export function reloadRuntime(ctx: ReloadContext, datapacks: Datapack[]): void {
  ctx.stop();
  ctx.registry.clear();
  ctx.affectorEngine.clear();
  ctx.triggerSystem.clear();
  ctx.reset();
  ctx.init(datapacks);
}

export interface BlockRecheckContext {
  state: Readonly<PlayerState>;
  registry: Registry;
  mutations: RuntimeMutationPort;
  conditionSystem: ConditionSystem;
}

/** 复检学生阻断：被动剧情条目失效或条件已满足时解除阻断 */
export function recheckStudentBlocks(ctx: BlockRecheckContext): void {
  const blocks = ctx.state.studentBlocks;
  if (!blocks) return;
  for (const variantId of Object.keys(blocks)) {
    const block = blocks[variantId];
    const entry = ctx.registry.passiveStories.get(block.entryId);
    if (!entry || !entry.block) {
      ctx.mutations.clearStudentBlock(variantId);
      continue;
    }
    if (ctx.conditionSystem.evaluateGroup(entry.block, ctx.state)) {
      ctx.mutations.clearStudentBlock(variantId);
    }
  }
}
