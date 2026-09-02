import { EventDrivenReactor } from '../../engine/effect/event-driven-reactor';
import type { EventBus } from '../../engine/core/event-bus';
import type { ColorUnlockPort } from '../../engine/contracts/color-runtime';
import type { ColorEquipmentUnlockPort } from '../../engine/contracts/color-unlock';

export class ColorUnlockReactor extends EventDrivenReactor {
  constructor(
    eventBus: EventBus,
    private readonly colorSystem: ColorUnlockPort,
    private readonly colorEquipmentSystem: ColorEquipmentUnlockPort,
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
