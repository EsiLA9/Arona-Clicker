// ============================================================
// engine/state-mutation-service.ts — 统一运行时状态写入入口
// ============================================================

import {
  Character,
  CharacterAcquireVia,
  CompletedStory,
  CharaCustomOverride,
  DupRewards,
  Effect,
  EntityThemeSlot,
  ExtraPath,
  ExtraValue,
  PlayerState,
  SpotTagOverride,
  StoryId,
  GameEvent,
  StatsContext,
  ThemeOrderScope,
  VariantId,
  isGlobalResource,
} from '../types';
import { TagPath, tagDisplay } from '../core/tag';
import { EventBus } from '../core/event-bus';
import { StatsService } from '../stats/stats';
import { applyExp, checkBreakthrough, resolveCurve } from './cultivate-system';
import { applyAffectionExp, affectionLevelCapOf, resolveAffectionConfig } from './affection-system';
import { deleteAtPath, extra, getAtPath, isFloat, setAtPath, toNumber } from '../extra/index';
import { applyEffects as applyEffectsImpl, applyEffect as applyEffectImpl } from './effect-ops';

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

  /** 差分目录读取器（由 GameInstance 注入 registry 视图，供 acquireCharacter/培养/色彩/好感解析定义）。 */
  private characterCatalog: {
    getVariant(id: VariantId): import('../types').CharacterVariantDef | undefined;
    getCurve(id: string): import('../types').CultivateCurveDef | undefined;
    getColorGroup(id: string): import('../types').ColorGroupDef | undefined;
    getColorEquipment(id: string): import('../types').ColorEquipmentDef | undefined;
    getAffectionConfig(): import('../types').AffectionConfigDef | undefined;
  } | null = null;

  setCharacterCatalog(reader: {
    getVariant(id: VariantId): import('../types').CharacterVariantDef | undefined;
    getCurve(id: string): import('../types').CultivateCurveDef | undefined;
    getColorGroup(id: string): import('../types').ColorGroupDef | undefined;
    getColorEquipment(id: string): import('../types').ColorEquipmentDef | undefined;
    getAffectionConfig(): import('../types').AffectionConfigDef | undefined;
  }): void {
    this.characterCatalog = reader;
  }

  /** 解析差分的运行时曲线视图（经目录读取器取曲线定义）。 */
  private curveOf(variant: import('../types').CharacterVariantDef) {
    return resolveCurve(variant.curve ? this.characterCatalog?.getCurve(variant.curve) : undefined);
  }

  /** 解析好感配置的运行时视图（缺省用引擎内置阶梯）。 */
  private affectionConfigOf() {
    return resolveAffectionConfig(this.characterCatalog?.getAffectionConfig());
  }

  private get current(): PlayerState {
    if (!this.state) throw new Error('StateMutationService is not initialized');
    return this.state;
  }

  private emit(event: GameEvent): void {
    const payload = { ...event } as GameEvent;
    // 惰性统计上下文：仅在消费方实际访问 event.stats 时才深拷贝三层统计，
    // 消除每事件（每 Tick 的 2R+1 个）急切构建完整 StatsContext 快照的开销。
    const statsService = this.statsService;
    if (statsService) {
      let cached: StatsContext | undefined;
      Object.defineProperty(payload, 'stats', {
        enumerable: true,
        configurable: true,
        get: () => (cached ??= statsService.getContext()),
      });
    }
    this.eventBus.emit(payload);
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

  /**
   * 获得角色差分（一切获得途径的统一入口）。
   * - 首次获得：创建 RosterEntry（level=1/exp=0/stars=0），不发碎片。
   * - 重复获得：不改动培养，返还该变体自己的碎片 + 附加资源
   *   （rewards 缺省 = 1 碎片防呆；卡池调用时传池配置的 dupRewards）。
   * @returns 实际结算结果（重复标记与返还明细）。
   */
  acquireCharacter(
    variantId: VariantId,
    via: CharacterAcquireVia,
    rewards?: DupRewards,
  ): { duplicate: boolean; shards: number; bonusResources: Record<string, number> } {
    const variant = this.characterCatalog?.getVariant(variantId);
    if (!variant) throw new Error(`[acquireCharacter] 未知差分: ${variantId}`);
    const state = this.current;
    state.roster ??= {};
    state.fragments ??= {};

    const existing = state.roster[variantId];
    let duplicate = false;
    let shards = 0;
    let bonusResources: Record<string, number> = {};
    if (!existing) {
      state.roster[variantId] = {
        variantId,
        acquiredVia: via,
        level: 1,
        exp: 0,
        stars: 0,
        equippedEquipment: null,
        acquiredCount: 1,
        affectionLevel: 1,
        affectionExp: 0,
      };
    } else {
      duplicate = true;
      shards = rewards?.shards ?? 1;
      bonusResources = rewards?.bonusResources ?? {};
      state.fragments[variantId] = (state.fragments[variantId] ?? 0) + shards;
      existing.acquiredCount += 1;
      for (const [resource, amount] of Object.entries(bonusResources)) {
        if (amount !== 0) this.changeResource(resource, amount);
      }
    }

    const stats = (state.protoStats ??= {});
    const ps = (stats[variant.proto] ??= { acquiredTotal: 0, cultTotal: 0 });
    ps.acquiredTotal += 1;

    this.emit({ type: 'characterAcquired', variantId, via, duplicate, shards, bonusResources });
    return { duplicate, shards, bonusResources };
  }

  /** 聊天消息标记已读（幂等：已读不再发事件）。 */
  markChatRead(messageId: string): void {
    const state = this.current;
    state.chatRead ??= {};
    if (state.chatRead[messageId]) return;
    state.chatRead[messageId] = true;
    this.emit({ type: 'chatReadChanged', messageId });
  }

  /**
   * 好感写入口：增加好感小值（支持一次跨多级；达星级锁后小值截断）。
   * 未拥有 / delta <= 0 拒绝（与 addExp 一致）。等级高于新 cap 时只升不降，仅阻止继续积累。
   */
  addAffectionExp(variantId: VariantId, delta: number): { ok: boolean; newLevel: number; newExp: number } {
    const variant = this.characterCatalog?.getVariant(variantId);
    if (!variant) throw new Error(`[addAffectionExp] 未知差分: ${variantId}`);
    const entry = this.current.roster?.[variantId];
    if (!entry) return { ok: false, newLevel: 0, newExp: 0 };

    const config = this.affectionConfigOf();
    const cap = affectionLevelCapOf(config, variant, entry.stars);
    const result = applyAffectionExp(config, entry, cap, variant, delta);
    if (!result.ok) return { ok: false, newLevel: entry.affectionLevel ?? 1, newExp: entry.affectionExp ?? 0 };

    this.current.roster![variantId] = result.entry;
    this.emit({
      type: 'affectionChanged',
      variantId,
      delta,
      newLevel: result.entry.affectionLevel ?? 1,
      newExp: result.entry.affectionExp ?? 0,
      leveledUp: result.leveledUp,
    });
    return { ok: true, newLevel: result.entry.affectionLevel ?? 1, newExp: result.entry.affectionExp ?? 0 };
  }

  /** 卡池计数写入（pity/pulls；由 GachaService 结算后调用）。 */
  setGachaCounters(poolId: string, counters: { pity: number; pulls: number }): void {
    const state = this.current;
    state.gachaState ??= {};
    state.gachaState[poolId] = counters;
  }

  /** 差分并入世界 Pool（幂等去重；由 AvailabilityService 在池关闭条件满足时调用）。 */
  mergeIntoWorldPool(variantIds: VariantId[]): void {
    const state = this.current;
    const world = new Set(state.worldPool ?? []);
    let changed = false;
    for (const id of variantIds) {
      if (!world.has(id)) {
        world.add(id);
        changed = true;
      }
    }
    if (changed) state.worldPool = [...world];
  }

  // --- 色彩组与色彩装备（docs-824/04e-color-derivation.md） ---

  /** 色彩组入库存（写层不做条件判定——由 ColorSystem 校验后调用；幂等）。 */
  unlockGroup(groupId: string): boolean {
    const state = this.current;
    state.groupsOwned ??= [];
    if (state.groupsOwned.includes(groupId)) return false;
    state.groupsOwned.push(groupId);
    this.emit({ type: 'groupUnlocked', groupId });
    return true;
  }

  /** 色彩装备入库存（写层不做条件判定——由 ColorEquipmentSystem 校验后调用；幂等）。 */
  collectEquipment(equipmentId: string): boolean {
    const state = this.current;
    state.equipmentsOwned ??= [];
    if (state.equipmentsOwned.includes(equipmentId)) return false;
    state.equipmentsOwned.push(equipmentId);
    this.emit({ type: 'equipmentCollected', equipmentId });
    return true;
  }

  /** 装备色彩装备到变体单装备槽。未拥有差分/装备均拒绝。 */
  equipEquipment(variantId: VariantId, equipmentId: string): { ok: boolean; reason?: string } {
    const variant = this.characterCatalog?.getVariant(variantId);
    if (!variant) throw new Error(`[equipEquipment] 未知差分: ${variantId}`);
    const entry = this.current.roster?.[variantId];
    if (!entry) return { ok: false, reason: 'no-entry' };
    if (!this.current.equipmentsOwned?.includes(equipmentId)) return { ok: false, reason: 'not-owned' };
    if (entry.equippedEquipment === equipmentId) return { ok: false, reason: 'already-equipped' };
    entry.equippedEquipment = equipmentId;
    this.emit({ type: 'equipmentEquipped', variantId, equipmentId });
    return { ok: true };
  }

  /** 卸下变体装备的色彩装备。 */
  unequipEquipment(variantId: VariantId): boolean {
    const entry = this.current.roster?.[variantId];
    if (!entry || entry.equippedEquipment === null) return false;
    entry.equippedEquipment = null;
    return true;
  }

  /** 激活界面主题（全局单选）。未拥有色彩组拒绝；同值幂等不发事件。 */
  activateTheme(groupId: string | null): boolean {
    if (groupId !== null && !this.current.groupsOwned?.includes(groupId)) {
      return false;
    }
    if (this.current.activeGroupId === groupId) return true;
    this.current.activeGroupId = groupId;
    this.emit({ type: 'themeChanged', groupId });
    return true;
  }

  /** 设置玩家自定义的主题层优先级（低→高；仅 player/area/student 三层）。非法顺序回退默认。 */
  setThemeLayerOrder(order: ThemeOrderScope[]): boolean {
    const scopes: ThemeOrderScope[] = ['player', 'area', 'student'];
    const valid = order.length === scopes.length && scopes.every(s => order.includes(s));
    const next = valid ? [...order] : undefined;
    if (this.current.themeLayerOrder === next) return true;
    this.current.themeLayerOrder = next;
    this.emit({ type: 'themeChanged', groupId: null });
    return true;
  }

  /** 实体配色设计入库存（写层不做条件判定——由 ColorSystem 校验后调用；幂等）。 */
  unlockEntityDesign(entityKey: string, designId: string): boolean {
    const state = this.current;
    const owned = (state.entityThemeDesignsOwned ??= {});
    const list = (owned[entityKey] ??= []);
    if (list.includes(designId)) return false;
    list.push(designId);
    this.emit({ type: 'entityDesignUnlocked', entityKey, designId });
    return true;
  }

  /** 设置实体主题槽（null 清除，回退声明默认）。 */
  setEntityThemeSlot(entityKey: string, slot: EntityThemeSlot | null): boolean {
    const state = this.current;
    const cur = state.entityThemeSlots?.[entityKey];
    const next = slot ?? null;
    if (cur === next) return true;
    if (state.entityThemeSlots == null) {
      if (next === null) return true;
      state.entityThemeSlots = {};
    }
    if (next === null) delete state.entityThemeSlots[entityKey];
    else state.entityThemeSlots[entityKey] = next;
    this.emit({ type: 'entityThemeChanged', entityKey });
    return true;
  }

  /** 培养入口：加经验（支持一次跨多级；达有效上限后溢出截断）。未拥有/非法量拒绝。 */
  addExp(variantId: VariantId, amount: number): { ok: boolean; newLevel: number; newExp: number } {
    const variant = this.characterCatalog?.getVariant(variantId);
    if (!variant) throw new Error(`[addExp] 未知差分: ${variantId}`);
    const entry = this.current.roster?.[variantId];
    if (!entry) return { ok: false, newLevel: 0, newExp: 0 };

    const result = applyExp(this.curveOf(variant), entry, amount);
    if (!result.ok) return { ok: false, newLevel: entry.level, newExp: entry.exp };

    const state = this.current;
    state.roster![variantId] = result.entry;
    const ps = (state.protoStats ??= {})[variant.proto] ??= { acquiredTotal: 0, cultTotal: 0 };
    ps.cultTotal += amount;
    if (result.leveledUp) {
      this.emit({
        type: 'cultivated',
        variantId,
        kind: 'exp',
        newLevel: result.entry.level,
      });
    }
    return { ok: true, newLevel: result.entry.level, newExp: result.entry.exp };
  }

  /**
   * 培养入口：星级突破。只消耗该变体自己的碎片（差分隔离，不可跨变体替代）。
   * 未拥有 / 未配置曲线 / 已达星上限 / 碎片不足均拒绝。
   */
  breakthroughStar(variantId: VariantId): { ok: boolean; reason?: string; newStars?: number } {
    const variant = this.characterCatalog?.getVariant(variantId);
    if (!variant) throw new Error(`[breakthroughStar] 未知差分: ${variantId}`);
    const state = this.current;
    const entry = state.roster?.[variantId];
    if (!entry) return { ok: false, reason: 'no-entry' };

    const check = checkBreakthrough(this.curveOf(variant), state, variant, entry);
    if (!check.ok || check.cost === undefined) return { ok: false, reason: check.reason };

    state.fragments![variantId] -= check.cost;
    entry.stars += 1;
    (state.protoStats ??= {})[variant.proto] ??= { acquiredTotal: 0, cultTotal: 0 };
    state.protoStats[variant.proto].cultTotal += check.cost;
    this.emit({ type: 'cultivated', variantId, kind: 'star', newStars: entry.stars });
    return { ok: true, newStars: entry.stars };
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

  /**
   * 被动闲聊冷却表整体替换（key = entryId / poolId，value = 上次抽取帧）。
   * 由 StoryService 在被动闲聊完结时根据 entry/pool 的 cooldownFrames 写入。
   */
  setPassiveCooldowns(cooldowns: Record<string, number>): void {
    this.current.passiveCooldowns = cooldowns;
    this.emit({ type: 'passiveCooldownsChanged', cooldowns });
  }

  /**
   * 锁定某学生对话空间（阻断态）：播完声明了 block 条件的 PassiveStoryEntry 后调用，
   * 直到该条件组满足（由 recheckStudentBlocks 解除）。
   */
  setStudentBlock(variantId: VariantId, entryId: string): void {
    const state = this.current;
    state.studentBlocks ??= {};
    state.studentBlocks[variantId] = { entryId, setAtFrame: state.totalFrames };
    this.emit({ type: 'studentBlockChanged', variantId, blocked: true, entryId });
  }

  /** 解除某学生对话空间的阻断态（条件满足后由 GameInstance tick / 区域进入触发）。 */
  clearStudentBlock(variantId: VariantId): void {
    const state = this.current;
    if (!state.studentBlocks || !state.studentBlocks[variantId]) return;
    delete state.studentBlocks[variantId];
    this.emit({ type: 'studentBlockChanged', variantId, blocked: false });
  }

  /**
   * 运行时 Spot tag 增撤（spot-service 门面调用；单一写入口，docs-824/08 T6）。
   * 覆盖记录落 PlayerState.spotTagOverrides（global 层，随存档保留），
   * 有效 tags = 声明 + added − removed（registry.effectiveSpotTags 解析）。
   */
  applySpotTagChange(spotId: string, tag: TagPath, added: boolean): void {
    const state = this.current;
    const overrides = (state.spotTagOverrides ??= {});
    const display = tagDisplay(tag);
    const override: SpotTagOverride = overrides[spotId] ?? { added: [], removed: [] };
    if (added) {
      override.removed = override.removed.filter(t => tagDisplay(t) !== display);
      if (!override.added.some(t => tagDisplay(t) === display)) override.added.push(tag);
    } else {
      override.added = override.added.filter(t => tagDisplay(t) !== display);
      if (!override.removed.some(t => tagDisplay(t) === display)) override.removed.push(tag);
    }
    overrides[spotId] = override;
    this.emit({ type: 'spotTagChanged', spotId, tag: display, added });
  }

  /** 覆写某 Chara 的头像-人名对（player 层，随存档；partial 合并）。 */
  setCharaCustom(character: Character, override: CharaCustomOverride): void {
    const state = this.current;
    if (!state.charaCustom) state.charaCustom = {};
    const custom = state.charaCustom;
    custom[character] = { ...custom[character], ...override };
    this.emit({ type: 'charaCustomChanged', character });
  }

  /** 清除某 Chara 的玩家侧覆写（回到 chara 声明 / 兜底）。 */
  clearCharaCustom(character: Character): void {
    const state = this.current;
    if (!state.charaCustom || !state.charaCustom[character]) return;
    delete state.charaCustom[character];
    this.emit({ type: 'charaCustomChanged', character });
  }

  /**
   * 记录 Story 阅读日志（按 Story.id；talkletIndex 为已读 Talklet 索引，choiceIndex 可选已选选项）。
   * 为重阅读预留的简单记录，不驱动任何行为；重阅读服务本期不实现。
   */
  recordStoryRead(storyId: StoryId, talkletIndex: number, choiceIndex?: number): void {
    const state = this.current;
    const logs = (state.storyReadLogs ??= {});
    const log = logs[storyId] ?? { readTalkletIndexes: [], chosenChoiceIndexes: {} };
    if (!log.readTalkletIndexes.includes(talkletIndex)) {
      log.readTalkletIndexes = [...log.readTalkletIndexes, talkletIndex].sort((a, b) => a - b);
    }
    if (choiceIndex !== undefined) {
      const chosen = log.chosenChoiceIndexes[talkletIndex] ?? [];
      if (!chosen.includes(choiceIndex)) {
        log.chosenChoiceIndexes = { ...log.chosenChoiceIndexes, [talkletIndex]: [...chosen, choiceIndex] };
      }
    }
    logs[storyId] = log;
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

  /** @see effect-ops.applyEffects */
  applyEffects(effects: Effect[]): void {
    applyEffectsImpl.call(this, effects);
  }

  /** @see effect-ops.applyEffect */
  applyEffect(effect: Effect): void {
    applyEffectImpl.call(this, effect);
  }
}
