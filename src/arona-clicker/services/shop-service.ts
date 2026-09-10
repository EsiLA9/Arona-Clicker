import type { Registry } from '../../data-services/registry/registry';
import type { ShopEntryDef, ShopPurchaseScope } from '../../data-services/contracts/shop';
import type { AronaClickerState } from '../types/state';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { ValueSystem } from '../../engine/expression/value-system';
import type { StateMutationService } from '../state/state-mutation-service';
import type { SpotFunctionalitySystem } from './spot-functionality';
import { existenceMet } from '../../engine/visibility/reveal';
import { isGlobalResource } from '../types/ids';

export interface ShopCartLine { entryId: string; quantity: number; }
export type ShopCheckoutFailure = 'shop-not-found' | 'spot-not-found' | 'shop-unavailable' | 'entry-not-found' | 'hidden' | 'condition-failed' | 'quantity-invalid' | 'stock-insufficient' | 'insufficient-funds' | 'offer-not-executable';
export type ShopCheckoutResult = { success: true; receipt: ShopCommitReceipt } | { success: false; reason: ShopCheckoutFailure; entryId?: string };
export interface ShopCommitReceipt {
  shopId: string;
  spotId: string;
  lines: ReadonlyArray<{ entryId: string; quantity: number; resourceCosts: Record<string, number>; itemCosts: Record<string, number>; resourceGrants: Record<string, number>; itemGrants: Record<string, number> }>;
}
export interface ShopEntryAvailability {
  entryId: string;
  revealed: boolean;
  conditionSatisfied: boolean;
  stockRemaining: number | null;
  status: 'hidden' | 'locked' | 'available' | 'sold-out';
}
export interface ShopPreview {
  resourceCosts: Record<string, number>;
  itemCosts: Record<string, number>;
  resourceGrants: Record<string, number>;
  itemGrants: Record<string, number>;
}
export interface ShopQueryPort {
  availability(shopId: string, spotId: string, entryId: string): ShopEntryAvailability | null;
  preview(shopId: string, cart: readonly ShopCartLine[]): ShopPreview | null;
}

/** 不进入 Save 的 UI 意图容器；派生价格、库存与条件不在此缓存。 */
export class ShopSession {
  private readonly quantities = new Map<string, number>();
  setQuantity(entryId: string, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) this.quantities.delete(entryId);
    else this.quantities.set(entryId, quantity);
  }
  lines(): ShopCartLine[] { return [...this.quantities].map(([entryId, quantity]) => ({ entryId, quantity })); }
  clear(): void { this.quantities.clear(); }
}

const DEFAULT_SCOPE: ShopPurchaseScope = { lifetime: 'init', owner: 'shop' };

/** 从 Cart intent 生成冻结 Plan，并交给单一写入口一次性提交。 */
export class ShopService {
  constructor(
    private readonly registry: Registry,
    private readonly conditions: ConditionSystem,
    private readonly values: ValueSystem,
    private readonly mutations: StateMutationService,
    private readonly functionalities: SpotFunctionalitySystem,
    private readonly getState: () => AronaClickerState,
  ) {}

  availability(shopId: string, spotId: string, entryId: string): ShopEntryAvailability | null {
    const shop = this.registry.shops.get(shopId);
    const entry = shop?.entries.find(candidate => candidate.id === entryId);
    if (!shop || !entry) return null;
    const state = this.getState();
    const revealed = existenceMet(entry.revealTriggers, condition => this.conditions.evaluateExpr(condition, state));
    const conditionSatisfied = (!shop.condition || this.conditions.evaluateGroup(shop.condition, state))
      && (!entry.condition || this.conditions.evaluateGroup(entry.condition, state));
    const remaining = this.remaining(entry, shopId, spotId, state);
    return {
      entryId,
      revealed,
      conditionSatisfied,
      stockRemaining: remaining,
      status: !revealed && entry.visibility === 'hidden-until-available'
        ? 'hidden'
        : remaining === 0 ? 'sold-out'
          : !conditionSatisfied ? 'locked' : 'available',
    };
  }

  /** 仅从当前状态计算预览；checkout 仍会重新解析，预览永不作为扣款依据。 */
  preview(shopId: string, cart: readonly ShopCartLine[]): ShopPreview | null {
    const shop = this.registry.shops.get(shopId);
    if (!shop) return null;
    const preview: ShopPreview = { resourceCosts: {}, itemCosts: {}, resourceGrants: {}, itemGrants: {} };
    const normalized = new Map<string, number>();
    for (const line of cart) normalized.set(line.entryId, (normalized.get(line.entryId) ?? 0) + line.quantity);
    for (const [entryId, quantity] of normalized) {
      const entry = shop.entries.find(candidate => candidate.id === entryId);
      if (!entry || !Number.isInteger(quantity) || quantity <= 0) return null;
      const line = this.resolveLine(entry, quantity, this.getState());
      if (!line) return null;
      this.merge(preview.resourceCosts, line.resourceCosts, 1); this.merge(preview.itemCosts, line.itemCosts, 1);
      this.merge(preview.resourceGrants, line.resourceGrants, 1); this.merge(preview.itemGrants, line.itemGrants, 1);
    }
    return preview;
  }

  checkout(shopId: string, spotId: string, cart: readonly ShopCartLine[]): ShopCheckoutResult {
    const shop = this.registry.shops.get(shopId);
    const spot = this.registry.spots.get(spotId);
    const state = this.getState();
    if (!shop) return { success: false, reason: 'shop-not-found' };
    if (!spot) return { success: false, reason: 'spot-not-found' };
    if (!this.functionalities.functionalitiesOf(spot, state).some(fn => fn.kind === 'shop' && fn.shopId === shopId)) return { success: false, reason: 'shop-unavailable' };
    if (shop.condition && !this.conditions.evaluateGroup(shop.condition, state)) return { success: false, reason: 'shop-unavailable' };
    if (cart.length === 0) return { success: false, reason: 'quantity-invalid' };

    const normalized = new Map<string, number>();
    for (const line of cart) normalized.set(line.entryId, (normalized.get(line.entryId) ?? 0) + line.quantity);
    const resourceDeltas: Record<string, number> = {};
    const itemDeltas: Record<string, number> = {};
    const purchaseRecords: Array<{ lifetime: 'global' | 'init'; key: string; quantity: number }> = [];
    const lines: Array<ShopCommitReceipt['lines'][number]> = [];
    for (const [entryId, quantity] of normalized) {
      const entry = shop.entries.find(candidate => candidate.id === entryId);
      if (!entry) return { success: false, reason: 'entry-not-found', entryId };
      const failure = this.validateLine(entry, shopId, spotId, quantity, state);
      if (failure) return { success: false, reason: failure, entryId: entry.id };
      const line = this.resolveLine(entry, quantity, state);
      if (!line) return { success: false, reason: 'offer-not-executable', entryId: entry.id };
      this.merge(resourceDeltas, line.resourceCosts, -1); this.merge(itemDeltas, line.itemCosts, -1);
      this.merge(resourceDeltas, line.resourceGrants, 1); this.merge(itemDeltas, line.itemGrants, 1);
      const scope = entry.purchase?.scope ?? DEFAULT_SCOPE;
      purchaseRecords.push({ lifetime: scope.lifetime, key: this.recordKey(scope, shopId, spotId, entry.id), quantity });
      lines.push({ entryId: entry.id, quantity, ...line });
    }
    if (!this.canAfford(resourceDeltas, itemDeltas, state)) return { success: false, reason: 'insufficient-funds' };
    if (!this.canReceiveItems(itemDeltas, state)) return { success: false, reason: 'offer-not-executable' };
    this.mutations.commitShopTransaction({
      resourceDeltas, itemDeltas, purchaseRecords,
      purchasedEvents: lines.map(line => ({
        type: 'shopPurchased' as const, shopId, spotId, entryId: line.entryId, quantity: line.quantity,
        resourceCosts: line.resourceCosts, itemCosts: line.itemCosts,
        resourceGrants: line.resourceGrants, itemGrants: line.itemGrants,
      })),
    });
    return { success: true, receipt: { shopId, spotId, lines } };
  }

  private validateLine(entry: ShopEntryDef, shopId: string, spotId: string, quantity: number, state: AronaClickerState): ShopCheckoutFailure | null {
    if (!Number.isInteger(quantity) || quantity <= 0) return 'quantity-invalid';
    const policy = entry.purchase;
    if (policy?.quantity === 'single' && quantity !== 1) return 'quantity-invalid';
    if (policy?.min !== undefined && quantity < policy.min) return 'quantity-invalid';
    if (policy?.maxPerCheckout !== undefined && quantity > policy.maxPerCheckout) return 'quantity-invalid';
    if (!existenceMet(entry.revealTriggers, condition => this.conditions.evaluateExpr(condition, state)) && entry.visibility === 'hidden-until-available') return 'hidden';
    if (entry.condition && !this.conditions.evaluateGroup(entry.condition, state)) return 'condition-failed';
    const remaining = this.remaining(entry, shopId, spotId, state);
    if (remaining !== null && quantity > remaining) return 'stock-insufficient';
    return null;
  }

  private resolveLine(entry: ShopEntryDef, quantity: number, state: AronaClickerState): Omit<ShopCommitReceipt['lines'][number], 'entryId' | 'quantity'> | null {
    const resourceCosts: Record<string, number> = {}; const itemCosts: Record<string, number> = {};
    const resourceGrants: Record<string, number> = {}; const itemGrants: Record<string, number> = {};
    for (const cost of entry.price.unitCosts) {
      const amount = this.values.evaluate(cost.amount, state) * quantity;
      if (!Number.isFinite(amount) || amount < 0 || (cost.type === 'item' && !Number.isInteger(amount))) return null;
      this.add(cost.type === 'resource' ? resourceCosts : itemCosts, cost.type === 'resource' ? cost.resourceId : cost.itemId, amount);
    }
    const amount = entry.offer.type === 'resource'
      ? this.values.evaluate(entry.offer.amount, state) * quantity
      : entry.offer.amount * quantity;
    if (!Number.isFinite(amount) || amount < 0 || (entry.offer.type === 'item' && !Number.isInteger(amount))) return null;
    this.add(entry.offer.type === 'resource' ? resourceGrants : itemGrants, entry.offer.type === 'resource' ? entry.offer.resourceId : entry.offer.itemId, amount);
    // P2 安全子集：只编译静态资源/物品增量，且每个 CartLine 仅执行一次，绝不调用 EffectEngine。
    for (const effect of entry.onPurchase ?? []) {
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value) || effect.value < 0) return null;
      if (effect.op === 'addResource') this.add(resourceGrants, effect.target, effect.value);
      else if (effect.op === 'addItem' && Number.isInteger(effect.value)) this.add(itemGrants, effect.target, effect.value);
      else return null;
    }
    return { resourceCosts, itemCosts, resourceGrants, itemGrants };
  }

  private remaining(entry: ShopEntryDef, shopId: string, spotId: string, state: AronaClickerState): number | null {
    if (!entry.stock || entry.stock.type === 'unlimited') return null;
    const scope = entry.purchase?.scope ?? DEFAULT_SCOPE;
    const records = scope.lifetime === 'global' ? state.globalShopPurchaseRecords : state.shopPurchaseRecords;
    const purchased = records?.[this.recordKey(scope, shopId, spotId, entry.id)]?.purchasedQuantity ?? 0;
    const max = entry.stock.type === 'once' ? 1 : entry.stock.max;
    return Math.max(0, max - purchased);
  }

  private recordKey(scope: ShopPurchaseScope, shopId: string, spotId: string, entryId: string): string {
    return `${scope.owner}|${scope.owner === 'shop' ? shopId : spotId}|${shopId}|${entryId}`;
  }
  private canAfford(resources: Record<string, number>, items: Record<string, number>, state: AronaClickerState): boolean {
    return Object.entries(resources).every(([id, delta]) => delta >= 0 || ((isGlobalResource(id) ? state.globalResources : state.resources)?.[id] ?? 0) >= -delta)
      && Object.entries(items).every(([id, delta]) => delta >= 0 || (state.inventory[id] ?? 0) >= -delta);
  }
  private canReceiveItems(items: Record<string, number>, state: AronaClickerState): boolean {
    return Object.entries(items).every(([id, delta]) => delta <= 0 || (state.inventory[id] ?? 0) + delta <= (this.registry.items.get(id)?.maxStack ?? 0));
  }
  private add(target: Record<string, number>, id: string, value: number): void { target[id] = (target[id] ?? 0) + value; }
  private merge(target: Record<string, number>, source: Record<string, number>, sign: 1 | -1): void { for (const [id, value] of Object.entries(source)) this.add(target, id, value * sign); }
}
