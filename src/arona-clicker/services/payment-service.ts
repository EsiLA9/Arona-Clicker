import type { PaymentOptionDef } from '../../data-services/contracts/cost';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { ValueSystem } from '../../engine/expression/value-system';
import type { AronaClickerState } from '../types/state';

export type PaymentOptionStatus = 'available' | 'condition-failed' | 'insufficient' | 'invalid';

export interface PaymentCostView {
  type: 'resource' | 'item';
  id: string;
  required: number;
  owned: number;
  missing: number;
}

export interface PaymentOptionView {
  id: string;
  label: string;
  conditionMet: boolean;
  affordable: boolean;
  status: PaymentOptionStatus;
  costs: readonly PaymentCostView[];
  resourceCosts: Readonly<Record<string, number>>;
  itemCosts: Readonly<Record<string, number>>;
}

export type PaymentSelection =
  | { ok: true; option: PaymentOptionView }
  | { ok: false; error: 'not-declared' | 'no-route' | 'option-required' | 'option-not-found' | 'condition-failed' | 'insufficient' | 'invalid'; options: readonly PaymentOptionView[] };

export interface PaymentServiceOptions {
  values: ValueSystem;
  conditions: ConditionSystem;
  getResourceAmount: (resourceId: string) => number;
}

/** 费用方案的纯解析与选择；不写 PlayerState，不发事件。 */
export class PaymentService {
  constructor(private readonly opts: PaymentServiceOptions) {}

  evaluate(options: readonly PaymentOptionDef[], state: AronaClickerState): readonly PaymentOptionView[] {
    return options.map((option, index) => {
      const conditionMet = !option.condition || this.opts.conditions.evaluateGroup(option.condition, state);
      const rawCosts: Array<{ type: 'resource' | 'item'; id: string; required: number }> = [];
      const resourceCosts: Record<string, number> = {};
      const itemCosts: Record<string, number> = {};
      let invalid = false;

      for (const cost of option.costs) {
        const required = this.opts.values.evaluate(cost.amount, state);
        const valid = Number.isFinite(required) && required >= 0
          && (cost.type !== 'item' || Number.isInteger(required));
        if (!valid) {
          invalid = true;
          rawCosts.push({ type: cost.type, id: cost.type === 'resource' ? cost.resourceId : cost.itemId, required: 0 });
          continue;
        }
        const id = cost.type === 'resource' ? cost.resourceId : cost.itemId;
        rawCosts.push({ type: cost.type, id, required });
        if (cost.type === 'resource') resourceCosts[id] = (resourceCosts[id] ?? 0) + required;
        else itemCosts[id] = (itemCosts[id] ?? 0) + required;
      }

      const costs: PaymentCostView[] = rawCosts.map(cost => {
        const owned = cost.type === 'resource'
          ? this.opts.getResourceAmount(cost.id)
          : (state.inventory[cost.id] ?? 0);
        const totalRequired = cost.type === 'resource' ? resourceCosts[cost.id] : itemCosts[cost.id];
        return { ...cost, owned, missing: Math.max(0, totalRequired - owned) };
      });
      const affordable = !invalid && costs.every(cost => cost.missing <= 0);
      const status: PaymentOptionStatus = !conditionMet
        ? 'condition-failed'
        : invalid
          ? 'invalid'
          : affordable ? 'available' : 'insufficient';
      return {
        id: option.id,
        label: option.label ?? `支付方案 ${index + 1}`,
        conditionMet,
        affordable,
        status,
        costs,
        resourceCosts,
        itemCosts,
      };
    });
  }

  select(
    options: readonly PaymentOptionDef[],
    state: AronaClickerState,
    optionId?: string,
    emptyError: 'not-declared' | 'no-route' = 'not-declared',
  ): PaymentSelection {
    const views = this.evaluate(options, state);
    if (views.length === 0) return { ok: false, error: emptyError, options: views };
    if (optionId !== undefined) {
      const selected = views.find(option => option.id === optionId);
      if (!selected) return { ok: false, error: 'option-not-found', options: views };
      return selected.status === 'available'
        ? { ok: true, option: selected }
        : { ok: false, error: this.errorOf(selected.status), options: views };
    }
    const available = views.filter(option => option.status === 'available');
    if (available.length > 1) return { ok: false, error: 'option-required', options: views };
    if (available.length === 1) return { ok: true, option: available[0] };
    const condition = views.find(option => option.status === 'condition-failed');
    if (views.some(option => option.status === 'invalid')) return { ok: false, error: 'invalid', options: views };
    if (views.some(option => option.status === 'insufficient')) return { ok: false, error: 'insufficient', options: views };
    return { ok: false, error: condition ? 'condition-failed' : 'option-not-found', options: views };
  }

  private errorOf(status: PaymentOptionStatus): Exclude<PaymentSelection, { ok: true }>['error'] {
    if (status === 'condition-failed') return 'condition-failed';
    if (status === 'insufficient') return 'insufficient';
    if (status === 'invalid') return 'invalid';
    return 'option-not-found';
  }
}
