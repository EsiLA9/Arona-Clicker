// ============================================================
// engine/game/init-mount.ts — 世界线专属 Trigger 挂载/卸载
// 从 init-service.ts 拆出：mountInitTriggers / unmountInitTriggers
// ============================================================

import type { Registry } from '../registry/registry';
import type { TriggerSystem } from '../effect/trigger-system';

export interface InitTriggerMountOpts {
  registry: Registry;
  triggerSystem: TriggerSystem;
}

/** 当前已挂载的世界线 Trigger 分组状态（由 InitService 持有，跨调用共享）。 */
export interface InitTriggerGroupState {
  /** 已挂载的分组 `init:<initId>`；null = 未挂载。 */
  group: string | null;
}

/**
 * 挂载当前世界线的专属 Trigger；若之前挂载了其它世界线的组则先移除。
 * 重复进入同一世界线（幂等）不重复挂载。
 */
export function mountInitTriggers(opts: InitTriggerMountOpts, gs: InitTriggerGroupState, initId: string): void {
  const group = `init:${initId}`;
  if (gs.group === group) return;
  if (gs.group) opts.triggerSystem.unmountGroup(gs.group);
  const init = opts.registry.inits.get(initId);
  for (const trigger of init?.triggers ?? []) opts.triggerSystem.mount(trigger, group);
  gs.group = group;
}

/** 卸载当前挂载的世界线 Trigger 组（读档 / reset 时重置用）。 */
export function unmountInitTriggers(opts: InitTriggerMountOpts, gs: InitTriggerGroupState): void {
  if (gs.group) opts.triggerSystem.unmountGroup(gs.group);
  gs.group = null;
}
