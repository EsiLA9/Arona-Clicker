// ============================================================
// engine/game/init-savepoint.ts — per-Init 快照（保存/恢复/清除/播种）
// 从 init-service.ts 拆出的纯状态操作：global Spot 属全局层，不进快照。
// 字段清单单一事实源见 per-init-fields.ts（本文件只做 spec 遍历编排）。
// ============================================================

import type { PlayerState, InitDef, InitSnapshot } from '../types';
import { Registry } from '../registry/registry';
import { PER_INIT_FIELD_SPECS } from './per-init-fields';
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
    const snapshot = {} as InitSnapshot;
    for (const spec of PER_INIT_FIELD_SPECS) {
      spec.capture(this.registry, state, snapshot);
    }
    if (!state.initSnapshots) state.initSnapshots = {};
    state.initSnapshots[initId] = snapshot;
  }

  /** 将 PlayerState 的 Init 局部字段重置为新鲜值（global Spot 跨世界线保留）。 */
  clear(): void {
    const state = this.state;
    for (const spec of PER_INIT_FIELD_SPECS) {
      spec.clear(this.registry, state);
    }
    // activeInit 是「当前处于哪个 Init」的标记，非 per-Init 数据，不进快照
    state.activeInit = '';
  }

  /** 将快照中的 Init 局部字段恢复到 PlayerState（global Spot 以全局层当前值为准）。 */
  restore(snapshot: NonNullable<PlayerState['initSnapshots']>[string]): void {
    const state = this.state;
    for (const spec of PER_INIT_FIELD_SPECS) {
      spec.restore(this.registry, state, snapshot);
    }
  }

  /** 以 InitDef.extra 为底座重建当前 Init 的 per-Init extras。 */
  seed(init: InitDef): void {
    this.state.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({}));
  }
}
