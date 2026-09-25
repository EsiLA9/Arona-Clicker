// ============================================================
// engine/trigger-system.ts — Trigger DSL 桥接系统
//
// 可知性/可达性层级的生效层：事件命中 + 条件满足才执行（AccessStage.active）。
//
// 对外（数据包内容作者）只暴露 TriggerDef 声明式 DSL：
//   { id, on: 事件模式, condition?: 条件, effects: 效果, once? }
// 内部由本系统桥接到 EventBus 侦测 → ConditionSystem 求值 → EffectEngine 执行。
//
// 生命周期：
//   register(request)      准入一条有独立 runtime identity 的 Registration
//   withdraw(key)           撤出一条 Registration
//   mount(def, group?)      兼容入口：以 Trigger id 为槽位替换旧 Registration
//   unmountGroup(group)     撤出来源组的所有 Registration
//   clear()                 清空全部（token 序列不复位）
//
// once 语义与生命周期解耦：unmount 不清除完成记录，重新挂载同 id 且 once
// 已完成后不再触发。迭代采用快照，允许 effects 执行期间动态挂载/移除。
// ============================================================

import { TriggerDef, GameEvent, TriggerEventDef, TriggerEventKind } from '../types';
import type { TriggerState } from '../contracts/state-query';
import { EventBus } from '../core/event-bus';
import { ConditionSystem } from '../expression/condition-system';
import { EffectEngine } from './effect-engine';
import { EventDrivenReactor } from './event-driven-reactor';
import { deriveAnonymousId, stableSerialize } from '../core/anonymous-id';

export const GLOBAL_TRIGGER_GROUP = 'global';

function cloneReadonly<T>(value: T, seen = new Map<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  const existing = seen.get(objectValue);
  if (existing !== undefined) return existing as T;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(objectValue, clone);
    for (const entry of value) clone.push(cloneReadonly(entry, seen));
    return Object.freeze(clone) as T;
  }
  const clone: Record<string, unknown> = {};
  seen.set(objectValue, clone);
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = cloneReadonly(entry, seen);
  }
  return Object.freeze(clone) as T;
}

/**
 * 触发器 `on.kind` 到派发事件类型的映射，避免对所有事件全量扫描。
 * Record 键为 TriggerEventKind 全集 —— 新增 kind 缺映射（或多出无效键）即编译错误，
 * 与 TriggerEventDef 联合双向锁合（docs-824/08 T4）。
 */
export const ON_KIND_TO_EVENT: Record<TriggerEventKind, GameEvent['type']> = {
  tick: 'tick',
  resource: 'resourceChanged',
  spotLevel: 'spotLevelChanged',
  item: 'itemCollected',
  story: 'storyCompleted',
  init: 'initEntered',
  area: 'areaEntered',
  shop: 'shopPurchased',
  character: 'characterAcquired',
  cultivated: 'characterProgressChanged',
};

/** 挂载后的 Trigger：id 必填（显式 id 或匿名派生 id 已归一化）。 */
type MountedTrigger = TriggerDef & { id: string };

export type RegistrationKey = string;
export type RegistrationToken = number;
export type RegistrationGroup = string;
export type TriggerRuntimeTag = string;
export type TriggerRuntimeAction = { kind: 'reveal'; handle: string };
export type TriggerRuntimeActionResult = { kind: 'success' } | { kind: 'not-committed' };
export type TriggerRuntimeActionHandler = (action: TriggerRuntimeAction) => TriggerRuntimeActionResult;

export type TriggerRegistrationRequest = {
  key: RegistrationKey;
  triggerId: string;
  def: TriggerDef;
  tags: ReadonlySet<TriggerRuntimeTag>;
  group?: RegistrationGroup;
  /** Internal typed behavior; never part of TriggerDef / Datapack content. */
  action?: TriggerRuntimeAction;
};

type TriggerRegistration = TriggerRegistrationRequest & {
  def: MountedTrigger;
  tags: ReadonlySet<TriggerRuntimeTag>;
  token: RegistrationToken;
  descriptor: string;
};

type DispatchCandidate = { key: RegistrationKey; token: RegistrationToken };

const legacyRegistrationKey = (triggerId: string): RegistrationKey => `legacy:${triggerId}`;

export class TriggerSystem extends EventDrivenReactor {
  private readonly registrations = new Map<RegistrationKey, TriggerRegistration>();
  private nextRegistrationToken = 1;
  private definitionsSnapshot: readonly TriggerDef[] | null = null;
  private definitionsRevision = 0;
  private readonly groups = new Map<RegistrationGroup, Set<RegistrationKey>>();
  private readonly byType = new Map<GameEvent['type'], Set<RegistrationKey>>();
  private readonly bucketType = new Map<RegistrationKey, GameEvent['type']>();
  private readonly byTag = new Map<TriggerRuntimeTag, Set<RegistrationKey>>();
  private state: TriggerState | null = null;
  private readonly completed = new Set<string>();
  private runtimeActionHandler: TriggerRuntimeActionHandler | null = null;

  constructor(
    eventBus: EventBus,
    private readonly conditionSystem: ConditionSystem,
    private readonly effectEngine: EffectEngine,
  ) {
    super(eventBus);
    // 仅订阅触发器关心的 7 种事件类型；每类事件只派发给对应桶，
    // `tick` 类不再被高频 resourceChanged/spotProduced 反复扫描。
    this.subscribeTo(Object.values(ON_KIND_TO_EVENT));
  }

  setState(state: TriggerState): void {
    this.state = state;
    this.completed.clear();
    for (const id of state.triggersCompleted ?? []) this.completed.add(id);
  }

  /**
   * 挂载一个 Trigger（默认归入 global 组）。重复 id 以新定义覆盖。
   * 匿名 Trigger（缺省/空 id）按「分组 + 结构内容」派生确定性身份（带 `anon:` 前缀），
   * 结构不变 → 身份不变 → once 完成记录可跨存档读写复现；后加载包改动结构则身份变化、旧记录失效。
   */
  mount(def: TriggerDef, group = GLOBAL_TRIGGER_GROUP): void {
    const effectiveId = def.id?.trim() ? def.id : deriveAnonymousId(`anon:trigger:${group}`, def);
    const key = legacyRegistrationKey(effectiveId);
    // Compatibility adapter: legacy mount historically replaced the same Trigger id.
    // Keep that behavior here while the Registration API itself rejects implicit replacement.
    this.withdraw(key);
    this.register({ key, triggerId: effectiveId, def, tags: new Set(), group });
  }

  /** 批量挂载（数据包级）。 */
  load(defs: TriggerDef[]): void {
    for (const def of defs) this.mount(def);
  }

  /** 移除单个 Trigger。 */
  unmount(id: string): boolean {
    return this.withdraw(legacyRegistrationKey(id));
  }

  setRuntimeActionHandler(handler: TriggerRuntimeActionHandler | null): void {
    this.runtimeActionHandler = handler;
  }

  /** 移除整组 Trigger（如离开世界线时）。 */
  unmountGroup(group: string): void {
    for (const key of [...(this.groups.get(group) ?? [])]) this.withdraw(key);
  }

  has(id: string): boolean {
    for (const registration of this.registrations.values()) {
      if (registration.triggerId === id) return true;
    }
    return false;
  }

  register(request: TriggerRegistrationRequest): RegistrationToken {
    if (!request.key) throw new Error('Trigger registration key must be non-empty');
    if (!request.triggerId) throw new Error('Trigger registration triggerId must be non-empty');
    const tags = new Set([...request.tags].sort());
    const def = cloneReadonly({ ...request.def, id: request.triggerId }) as MountedTrigger;
    const canonical = {
      key: request.key,
      triggerId: request.triggerId,
      def,
      tags: [...tags],
      group: request.group,
      action: request.action,
    };
    const descriptor = stableSerialize(canonical);
    const existing = this.registrations.get(request.key);
    if (existing) {
      if (existing.descriptor !== descriptor) {
        throw new Error(`Trigger registration key conflict: ${request.key}`);
      }
      return existing.token;
    }

    if (!Number.isSafeInteger(this.nextRegistrationToken)) {
      throw new Error('Trigger registration token space exhausted');
    }
    const registration: TriggerRegistration = {
      ...request,
      def,
      tags,
      token: this.nextRegistrationToken++,
      descriptor,
    };
    this.registrations.set(registration.key, registration);
    const eventType = ON_KIND_TO_EVENT[def.on.kind];
    this.addIndex(this.byType, eventType, registration.key);
    this.bucketType.set(registration.key, eventType);
    if (registration.group) this.addIndex(this.groups, registration.group, registration.key);
    for (const tag of registration.tags) this.addIndex(this.byTag, tag, registration.key);
    this.invalidateDefinitionsSnapshot();
    return registration.token;
  }

  withdraw(key: RegistrationKey): boolean {
    const registration = this.registrations.get(key);
    if (!registration) return false;
    this.registrations.delete(key);
    this.removeBucket(key);
    if (registration.group) this.removeIndex(this.groups, registration.group, key);
    for (const tag of registration.tags) this.removeIndex(this.byTag, tag, key);
    this.invalidateDefinitionsSnapshot();
    return true;
  }

  withdrawByTag(tag: TriggerRuntimeTag): number {
    return this.withdrawKeys(this.byTag.get(tag));
  }

  withdrawByTags(tags: Iterable<TriggerRuntimeTag>): number {
    const keys = new Set<RegistrationKey>();
    for (const tag of tags) for (const key of this.byTag.get(tag) ?? []) keys.add(key);
    return this.withdrawKeys(keys);
  }

  /** 提交一个由内部执行适配器确认成功的 once 结果。 */
  commitOnce(id: string): boolean {
    if (this.completed.has(id)) return false;
    this.completed.add(id);
    if (this.state && !this.state.triggersCompleted?.includes(id)) {
      this.state.triggersCompleted = [...(this.state.triggersCompleted ?? []), id];
    }
    return true;
  }

  clear(): void {
    this.registrations.clear();
    this.groups.clear();
    this.byType.clear();
    this.bucketType.clear();
    this.byTag.clear();
    this.invalidateDefinitionsSnapshot();
  }

  /** 返回当前有效 Trigger 定义的冻结快照，不暴露内部 Map 与定义引用。 */
  getDefinitions(): readonly TriggerDef[] {
    if (!this.definitionsSnapshot) {
      this.definitionsSnapshot = Object.freeze(
        [...this.registrations.values()].map(registration => cloneReadonly(registration.def)),
      );
    }
    return this.definitionsSnapshot;
  }

  /** 查询层用于在不重建快照的情况下判断规则源是否发生变化。 */
  getDefinitionsRevision(): number {
    return this.definitionsRevision;
  }

  /** EventDrivenReactor 命中入口：派发给本类型桶。 */
  protected onEvent(type: GameEvent['type'], event: GameEvent): void {
    this.processType(type, event);
  }

  private processType(type: GameEvent['type'], event: GameEvent): void {
    if (!this.state) return;
    const bucket = this.byType.get(type);
    if (!bucket || bucket.size === 0) return;
    // 快照迭代：fire 执行 effects 可能动态挂载/移除，不允许在遍历中改 set
    const candidates: DispatchCandidate[] = [...bucket].flatMap(key => {
      const registration = this.registrations.get(key);
      return registration ? [{ key, token: registration.token }] : [];
    });
    for (const candidate of candidates) {
      const registration = this.registrations.get(candidate.key);
      if (!registration || registration.token !== candidate.token) continue;
      const trigger = registration.def;
      if (!this.matchesEvent(trigger.on, event)) continue;
      if (trigger.once && this.completed.has(trigger.id)) continue;
      if (trigger.condition && !this.conditionSystem.evaluateExpr(trigger.condition, this.state)) continue;
      if (registration.action) {
        this.runtimeActionHandler?.(registration.action);
        continue;
      }
      this.fire(trigger);
    }
  }

  private removeBucket(id: RegistrationKey): void {
    const type = this.bucketType.get(id);
    if (type) {
      const bucket = this.byType.get(type);
      bucket?.delete(id);
      if (bucket?.size === 0) this.byType.delete(type);
    }
    this.bucketType.delete(id);
  }

  private addIndex<TKey>(index: Map<TKey, Set<RegistrationKey>>, key: TKey, registrationKey: RegistrationKey): void {
    let set = index.get(key);
    if (!set) { set = new Set(); index.set(key, set); }
    set.add(registrationKey);
  }

  private removeIndex<TKey>(index: Map<TKey, Set<RegistrationKey>>, key: TKey, registrationKey: RegistrationKey): void {
    const set = index.get(key);
    if (!set) return;
    set.delete(registrationKey);
    if (set.size === 0) index.delete(key);
  }

  private withdrawKeys(keys: Iterable<RegistrationKey> | undefined): number {
    if (!keys) return 0;
    let count = 0;
    for (const key of [...keys]) if (this.withdraw(key)) count += 1;
    return count;
  }

  private invalidateDefinitionsSnapshot(): void {
    this.definitionsSnapshot = null;
    this.definitionsRevision += 1;
  }

  private matchesEvent(on: TriggerEventDef, event: GameEvent): boolean {
    switch (on.kind) {
      case 'tick':
        if (event.type !== 'tick') return false;
        return on.every ? event.frame % on.every === 0 : true;
      case 'resource':
        return event.type === 'resourceChanged'
          && (!on.resource || event.resource === on.resource);
      case 'spotLevel':
        return event.type === 'spotLevelChanged'
          && (!on.spotId || event.spotId === on.spotId);
      case 'item':
        return event.type === 'itemCollected'
          && (!on.itemId || event.itemId === on.itemId);
      case 'story':
        return event.type === 'storyCompleted'
          && (!on.storyId || event.storyId === on.storyId);
      case 'init':
        return event.type === 'initEntered'
          && (!on.initId || event.initId === on.initId);
      case 'area':
        return event.type === 'areaEntered'
          && (!on.areaId || event.areaId === on.areaId);
      case 'shop':
        return event.type === 'shopPurchased'
          && (!on.shopId || event.shopId === on.shopId)
          && (!on.entryId || event.entryId === on.entryId);
      case 'character':
        return event.type === 'characterAcquired'
          && (!on.variantId || event.variantId === on.variantId);
      case 'cultivated':
        return event.type === 'characterProgressChanged'
          && (event.domain === 'level' || event.domain === 'star')
          && (!on.variantId || event.variantId === on.variantId)
          && (!on.cultivation || event.domain === (on.cultivation === 'star' ? 'star' : 'level'));
      default:
        return false;
    }
  }

  private fire(trigger: MountedTrigger): void {
    // once 先落账再执行，避免执行产生的级联事件重复触发
    if (trigger.once) this.commitOnce(trigger.id);
    this.effectEngine.applyEffects(trigger.effects);
  }
}
