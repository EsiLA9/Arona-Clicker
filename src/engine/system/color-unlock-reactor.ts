// ============================================================
// engine/system/color-unlock-reactor.ts — 色彩解锁重算反应器
//
// 获得角色差分 / flag 变化后，自动重算色彩组、配色设计与色彩装备解锁
// （达成条件即入库存，闭环收集系统）。原内联于组合根
// （game-instance 构造器）的业务订阅外移；沿用 EventDrivenReactor
// 分桶订阅模式（禁止 onAny 全量扫描）。
// ============================================================

import { EventDrivenReactor } from '../effect/event-driven-reactor';
import type { EventBus } from '../core/event-bus';
import type { ColorSystem } from './color-system';
import type { ColorEquipmentSystem } from './color-equipment-system';

export class ColorUnlockReactor extends EventDrivenReactor {
  constructor(
    eventBus: EventBus,
    private readonly colorSystem: ColorSystem,
    private readonly colorEquipmentSystem: ColorEquipmentSystem,
  ) {
    super(eventBus);
    this.subscribeTo(['characterAcquired', 'flagChanged']);
  }

  protected override onEvent(): void {
    this.colorSystem.recheckUnlocks();
    this.colorSystem.recheckDesignUnlocks();
    this.colorEquipmentSystem.recheckUnlocks();
  }
}
