// ============================================================
// engine/state-mutation-service.ts — 统一运行时状态写入入口
// ============================================================

import {
  Character,
  CompletedStory,
  Effect,
  ExtraPath,
  ExtraValue,
  PlayerState,
  StoryId,
  GameEvent,
  StatsContext,
  ValueExpression,
  isGlobalResource,
} from './types';
import { EventBus } from './event-bus';
import { StatsService } from './stats';
import { assertValidExtra, deleteAtPath, extra, extraFromJson, getAtPath, isFloat, setAtPath, toNumber } from './extra';

/**
 * 所有需要修改 PlayerState 的基础操作集中在这里。
 * 上层系统可以组合这些操作，但不应绕过此服务直接写状态。
 *
 * 每个 mutation 遵循固定管道：
 *   ① 写 PlayerState（改变自身）
 *   ② 同步更新 StatsService（global / init / session 三层统计）
 *   ③ emit 事件到 EventBus（事件携带变更时点的统计上下文）
 *   ④ 订阅者按兴趣判断并执行
 */
export class StateMutationService {
  private state: PlayerState | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly statsService?: StatsService,
  ) {}

  setState(state: PlayerState): void {
    this.state = state;
  }

  /** Extra 三层合并视图读取器（供 addExtra 取生效值，由 GameInstance.getExtra 提供）。 */
  private extraReader: (path: ExtraPath) => ExtraValue | undefined = () => undefined;

  setExtraReader(reader: (path: ExtraPath) => ExtraValue | undefined): void {
    this.extraReader = reader;
  }

  private get current(): PlayerState {
    if (!this.state) throw new Error('StateMutationService is not initialized');
    return this.state;
  }

  private emit(event: GameEvent): void {
    this.eventBus.emit({
      ...event,
      stats: this.statsService?.getContext() as StatsContext | undefined,
    } as GameEvent);
  }

  /** 资源实际存放的桶：全局资源放 globalResources（跨世界线），其余放 resources。 */
  private resourceBucket(resource: string): Record<string, number> {
    const state = this.current;
    if (isGlobalResource(resource)) return (state.globalResources ??= {});
    return state.resources;
  }

  changeResource(resource: string, delta: number): number {
    const bucket = this.resourceBucket(resource);
    const oldValue = bucket[resource] ?? 0;
    const newValue = oldValue + delta;
    bucket[resource] = newValue;
    this.statsService?.recordResourceChange(resource, delta);
    this.emit({
      type: 'resourceChanged',
      resource,
      delta,
      newValue,
    });
    return newValue;
  }

  setResource(resource: string, value: number): number {
    const bucket = this.resourceBucket(resource);
    return this.changeResource(resource, value - (bucket[resource] ?? 0));
  }

  setSpotLevel(spotId: string, level: number): void {
    const oldLevel = this.current.spotLevels[spotId] ?? 0;
    this.current.spotLevels[spotId] = level;
    this.statsService?.recordSpotLevel(oldLevel, level);
    this.emit({ type: 'spotLevelChanged', spotId, newLevel: level });
  }

  addSpotLevel(spotId: string, delta: number): number {
    const next = (this.current.spotLevels[spotId] ?? 0) + delta;
    this.setSpotLevel(spotId, next);
    return next;
  }

  setManager(spotId: string, character: Character): void {
    this.current.spotManagers[spotId] = character;
    this.emit({ type: 'managerChanged', spotId, newManager: character });
  }

  addEnhancement(enhancementId: string): boolean {
    const state = this.current;
    if (state.unlockedEnhancements.includes(enhancementId)) return false;
    state.unlockedEnhancements.push(enhancementId);
    this.statsService?.recordEnhancementUnlocked();
    this.emit({ type: 'enhancementAdded', enhancementId });
    return true;
  }

  removeEnhancement(enhancementId: string): boolean {
    const state = this.current;
    const idx = state.unlockedEnhancements.indexOf(enhancementId);
    if (idx < 0) return false;
    state.unlockedEnhancements.splice(idx, 1);
    if (state.enhancementAttachments) delete state.enhancementAttachments[enhancementId];
    this.emit({ type: 'enhancementRemoved', enhancementId });
    return true;
  }

  addItem(itemId: string, count: number, maxStack = Number.POSITIVE_INFINITY): number {
    const state = this.current;
    const previous = state.inventory[itemId] ?? 0;
    const next = Math.min(maxStack, previous + count);
    const actualCount = next - previous;
    state.inventory[itemId] = next;
    this.statsService?.recordItemChange(itemId, actualCount);
    this.emit({
      type: 'itemCollected',
      itemId,
      count: actualCount,
      newTotal: next,
    });
    return next;
  }

  removeItem(itemId: string, count: number): boolean {
    const state = this.current;
    const current = state.inventory[itemId] ?? 0;
    if (count < 0 || current < count) return false;
    const next = current - count;
    if (next === 0) delete state.inventory[itemId];
    else state.inventory[itemId] = next;
    this.statsService?.recordItemChange(itemId, -count);
    this.emit({
      type: 'itemCollected',
      itemId,
      count: -count,
      newTotal: next,
    });
    return true;
  }

  unlockInit(initId: string): boolean {
    const state = this.current;
    if (state.unlockedInits.includes(initId)) return false;
    state.unlockedInits.push(initId);
    this.statsService?.recordInitUnlocked();
    this.emit({ type: 'initUnlocked', initId });
    return true;
  }

  setFlag(flag: string, value: string): void {
    this.current.flags[flag] = value;
    this.emit({ type: 'flagChanged', flag, value });
  }

  completeStory(story: CompletedStory): void {
    this.current.storyLog.push(story);
    this.statsService?.recordStoryCompleted(story.storyId);
    this.emit({ type: 'storyCompleted', storyId: story.storyId });
  }

  setStoryCooldown(storyId: StoryId, frame: number): void {
    this.current.storyCooldowns ??= {};
    this.current.storyCooldowns[storyId] = frame;
  }

  /** 写 Extra 全局层（运行时动态数据；per-Init 层与数据包常量表保持只读）。 */
  setExtra(path: ExtraPath, value: ExtraValue): void {
    const state = this.current;
    state.extras ??= extra.dict({});
    setAtPath(state.extras, path, value);
    this.emit({ type: 'extraChanged', path, value });
  }

  /** Extra 全局层数值增量：以三层合并视图生效值为基数（缺失按 0）；生效值 float 保持 float，其余按 int。 */
  addExtra(path: ExtraPath, delta: number): void {
    const state = this.current;
    const effective = this.extraReader(path);
    const current = toNumber(effective);
    const existing = getAtPath(state.extras, path);
    state.extras ??= extra.dict({});
    const next = isFloat(effective ?? existing ?? extra.int(0))
      ? extra.float(current + delta)
      : extra.int(current + delta);
    setAtPath(state.extras, path, next);
    this.emit({ type: 'extraChanged', path, value: next });
  }

  /** 删除 Extra 全局层节点；路径不存在时静默忽略。 */
  removeExtra(path: ExtraPath): void {
    const state = this.current;
    if (!state.extras) return;
    const removed = deleteAtPath(state.extras, path);
    if (removed !== undefined) this.emit({ type: 'extraChanged', path });
  }

  /** 把 Effect.value 归一为 ExtraValue：字面量 → extraFromJson；已结构化 ExtraValue 校验后透传。 */
  private toExtraValue(raw: number | string | boolean | ValueExpression | ExtraValue): ExtraValue {
    if (typeof raw === 'object' && raw !== null && 't' in raw) {
      const node = raw as ExtraValue;
      assertValidExtra(node);
      return node;
    }
    return extraFromJson(raw);
  }

  applyEffects(effects: Effect[]): void {
    for (const effect of effects) this.applyEffect(effect);
  }

  applyEffect(effect: Effect): void {
    switch (effect.op) {
      case 'setResource':
        this.setResource(effect.target, Number(effect.value));
        break;
      case 'addResource':
        this.changeResource(effect.target, Number(effect.value));
        break;
      case 'setSpotLevel':
        this.setSpotLevel(effect.target, Number(effect.value));
        break;
      case 'addSpotLevel':
        this.addSpotLevel(effect.target, Number(effect.value));
        break;
      case 'setManager':
        this.setManager(effect.target, effect.value as Character);
        break;
      case 'addEnhancement':
        this.addEnhancement(String(effect.value));
        break;
      case 'addItem':
        this.addItem(effect.target, Number(effect.value));
        break;
      case 'unlockInit':
        this.unlockInit(String(effect.value));
        break;
      case 'setFlag':
        this.setFlag(effect.target, String(effect.value));
        break;
      case 'setExtra':
        this.setExtra(effect.target, this.toExtraValue(effect.value));
        break;
      case 'addExtra':
        this.addExtra(effect.target, Number(effect.value));
        break;
      case 'removeExtra':
        this.removeExtra(effect.target);
        break;
      case 'loot':
      case 'triggerStory':
        // 这些操作需要上层系统（Loot/Story）处理，不在状态层产生伪事件。
        break;
    }
  }
}
