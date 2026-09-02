import type { Registry } from '../../data-services/registry/registry';
import type { TriggerSystem } from '../../engine/effect/trigger-system';

export interface InitTriggerMountOpts { registry: Registry; triggerSystem: TriggerSystem; }
export interface InitTriggerGroupState { group: string | null; }

export function mountInitTriggers(opts: InitTriggerMountOpts, gs: InitTriggerGroupState, initId: string): void {
  const group = `init:${initId}`;
  if (gs.group === group) return;
  if (gs.group) opts.triggerSystem.unmountGroup(gs.group);
  const init = opts.registry.inits.get(initId);
  for (const trigger of init?.triggers ?? []) opts.triggerSystem.mount(trigger, group);
  gs.group = group;
}

export function unmountInitTriggers(opts: InitTriggerMountOpts, gs: InitTriggerGroupState): void {
  if (gs.group) opts.triggerSystem.unmountGroup(gs.group);
  gs.group = null;
}
