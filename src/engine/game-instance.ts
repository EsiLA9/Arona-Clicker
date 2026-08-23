// ============================================================
// engine/game-instance.ts — 核心运行时
// ============================================================

import {
  PlayerState,
  Datapack,
  VisibilitySnapshot,
  Character,
  GameView,
  TickResult,
  ItemId,
  UseItemResult,
  StoryStartResult,
  StoryAdvanceResult,
  SendState,
  SendResult,
  TravelResult,
  AreaId,
  EnhancementId,
  EnhancementPurchaseResult,
  InitPurchaseResult,
  SpotUnlockResult,
  SpotUpgradeResult,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
  GLOBAL_RESOURCE_IDS,
} from './types';
import { StoryService, type StoryCursor } from './game/story-service';
import { type StoryView } from './types/results';
import { SpotService } from './game/spot-service';
import { InitService } from './game/init-service';
import { ItemService } from './game/item-service';
import { EnhancementService } from './game/enhancement-service';
import { SessionService } from './game/session-service';

import { extra, getAtPath, mergeExtra, setAtPath } from './extra/index';
import { Registry } from './registry/registry';
import { EventBus } from './core/event-bus';
import { ValueSystem } from './expression/value-system';
import { ConditionSystem } from './expression/condition-system';
import { FuncletExecutor } from './expression/funclet-executor';
import { EffectEngine } from './effect/effect-engine';
import { TickSystem } from './system/tick-system';
import { LootSystem } from './system/loot-system';
import { VisibilityEngine } from './visibility/visibility-engine';
import { hasExistenceGate } from './visibility/reveal';
import { StateMutationService } from './system/state-mutation-service';
import { AffectorEngine } from './effect/affector-engine';
import { DevLog, DevLogEntry, DevLogOptions } from './core/dev-log';
import { StatsService, PersistedStats } from './stats/stats';
import { SpotFunctionalitySystem } from './system/spot-functionality';
import { GameNumSystem } from './expression/game-num';
import { TriggerSystem } from './effect/trigger-system';
import { TagPath } from './core/tag';

import { CharacterSystem } from './system/character-system';
import { RosterSystem } from './system/roster-system';
import { CharacterAvailabilityService } from './system/character-availability';
import { ColorSystem } from './system/color-system';
import { GachaService } from './system/gacha-service';
import { TagStatService, type TagStatKind } from './stats/tag-stats';
import { PassivePoolSystem } from './system/passive-pool-system';

/**
 * SaveData 是持久化的存档快照
 */
export interface SaveData {
  version: string;
  timestamp: number;
  playerState: PlayerState;
  visibility: VisibilitySnapshot;
  /** Legacy field accepted on load; new saves do not persist per-Spot timers. */
      timers?: Record<string, unknown>;
  pendingStoryId: string | null;
  pendingStoryPageIndex: number;
  pendingStoryChoiceIndex?: number;
  /** 多击任务（Talklet.clickWork）的进行中进度；缺省 = 无。 */
  pendingTalkletClicks?: { total: number; done: number } | null;
  /** 当前实际播放的 Story.id（跳转链中可变；旧档无 = 回退 pendingStoryId 的初始 Story）。 */
  pendingStoryDefId?: string | null;
  /** insert 跳转返回点栈（旧档无 = 空）。 */
  pendingInsertStack?: { storyId: string; pageIndex: number }[];
  /** 本 Entry 链已访问过的 Story.id（旧档无 = 空）。 */
  pendingVisitedStoryIds?: string[];
  /** 是否处于重阅读模式（旧档无 = false）。 */
  pendingIsReplay?: boolean;
  /** 各聊天沙盒游标（key → StoryCursor）：每个角色对话空间的独立剧情游标（旧档无 = 空）。 */
  chatCursors?: Record<string, StoryCursor>;
  /** 各聊天沙盒的历史条目（key → 聊天条目数组，已按上限截断；引擎不解析内部结构，由 UI 层读写）。 */
  chatHistories?: Record<string, unknown[]>;
  /** 三层统计持久化部分（global + 各 init 聚合 + 当前游玩的 session）。 */
  stats?: PersistedStats;
}

/**
 * GameInstance 是游戏的核心运行时管理器。
 * 它组装所有引擎子系统并暴露统一的 API 给 UI 层。
 */
export class GameInstance {
  // 子系统
  readonly eventBus: EventBus;
  readonly registry: Registry;
  readonly valueSystem: ValueSystem;
  readonly conditionSystem: ConditionSystem;
  readonly funcletExecutor: FuncletExecutor;
  readonly effectEngine: EffectEngine;
  readonly tickSystem: TickSystem;
  readonly lootSystem: LootSystem;
  readonly visibilityEngine: VisibilityEngine;
  readonly characterSystem: CharacterSystem;
  readonly rosterSystem: RosterSystem;
  readonly availabilityService: CharacterAvailabilityService;
  readonly colorSystem: ColorSystem;
  readonly gachaService: GachaService;
  readonly tagStatService: TagStatService;
  readonly passivePoolSystem: PassivePoolSystem;
  readonly mutations: StateMutationService;
  readonly affectorEngine: AffectorEngine;
  readonly devLog: DevLog;
  readonly statsService: StatsService;
  readonly spotFunctionalitySystem: SpotFunctionalitySystem;
  readonly gameNumSystem: GameNumSystem;
  readonly triggerSystem: TriggerSystem;
  readonly storyService: StoryService;
  readonly spotService: SpotService;
  readonly initService: InitService;
  readonly itemService: ItemService;
  readonly enhancementService: EnhancementService;
  readonly sessionService: SessionService;

  // 运行时状态
  private _state!: PlayerState;

  constructor(options: { devLog?: DevLogOptions } = {}) {
    this.eventBus = new EventBus();
    this.registry = new Registry();
    this.valueSystem = new ValueSystem();
    this.conditionSystem = new ConditionSystem();
    this.funcletExecutor = new FuncletExecutor();
    // stats 与 mutations 先建：所有下层系统共用同一带统计的写入口，保证统计同步记录
    this.statsService = new StatsService();
    this.conditionSystem.setStatReader(dsl => this.statsService.evaluate(dsl));
    this.conditionSystem.setStoryRunChecker(id => this.statsService.hasCompletedStoryThisRun(id));
    this.mutations = new StateMutationService(this.eventBus, this.statsService);
    this.spotFunctionalitySystem = new SpotFunctionalitySystem(this.registry, this.conditionSystem);
    this.effectEngine = new EffectEngine(this.eventBus, this.mutations, this.valueSystem);
    this.characterSystem = new CharacterSystem();
    this.characterSystem.setVariantProtoResolver(
      id => this.registry.characterVariants.get(id)?.proto,
    );
    this.rosterSystem = new RosterSystem(this.registry);
    this.availabilityService = new CharacterAvailabilityService(
      this.registry,
      this.mutations,
      () => this._state,
      (expr, state) => this.conditionSystem.evaluateExpr(expr, state),
    );
    this.colorSystem = new ColorSystem(
      this.registry,
      this.mutations,
      () => this._state,
      (expr, state) => this.conditionSystem.evaluateExpr(expr, state),
    );
    // 临时演出主题（setTheme effect）→ 转发给 ColorSystem 运行时层
    this.effectEngine.themeEffectHandler = effect => this.colorSystem.handleThemeEffect(effect);
    // 剧情启动（triggerStory effect）→ 按 target=storyId / owner=沙盒 启动剧情。
    // force：Trigger 驱动的系统事件剧情可抢占当前进行中的被动闲聊（否则会因 AlreadyActive 失败）。
    this.effectEngine.storyStarter = effect => {
      const entry = this.registry.storyEntries.get(effect.target);
      const type = entry?.type ?? 'passive';
      this.storyService.startStory(effect.target, type, effect.owner ?? null, true);
    };
    this.gachaService = new GachaService(
      this.registry,
      this.mutations,
      this.eventBus,
      () => this._state,
      resourceId => this.initService.getResourceAmount(resourceId),
      pool => this.availabilityService.drawableOf(pool, this._state),
    );
    // 差分目录接线：acquireCharacter/培养经 registry 解析原型与曲线（与 extraReader 同模式）
    this.mutations.setCharacterCatalog({
      getVariant: id => this.registry.characterVariants.get(id),
      getCurve: id => this.registry.cultivateCurves.get(id),
      getColor: id => this.registry.colors.get(id),
    });
    this.affectorEngine = new AffectorEngine(
      this.registry,
      this.conditionSystem,
      this.mutations,
      this.eventBus,
      this.effectEngine,
      this.spotFunctionalitySystem,
    );
    this.gameNumSystem = new GameNumSystem({
      valueSystem: this.valueSystem,
      registry: this.registry,
      characterSystem: this.characterSystem,
      affectorEngine: this.affectorEngine,
      eventBus: this.eventBus,
    });
    this.tickSystem = new TickSystem(
      this.registry,
      this.valueSystem,
      this.eventBus,
      this.mutations,
      this.gameNumSystem,
    );
    this.triggerSystem = new TriggerSystem(this.eventBus, this.conditionSystem, this.effectEngine);
    this.lootSystem = new LootSystem(this.registry, this.conditionSystem);
    this.visibilityEngine = new VisibilityEngine(this.registry, this.conditionSystem, this.eventBus);
    this.tagStatService = new TagStatService(this.registry, this.eventBus);
    this.conditionSystem.setTagIndex(tag => this.registry.spotsWithTag(tag));
    // tagCount 条件：读取 TagStatService 的按类型收集数
    this.conditionSystem.setTagCountReader(key => {
      const idx = key.indexOf(':');
      if (idx <= 0) return 0;
      const kind = key.slice(0, idx) as TagStatKind;
      return this.tagStatService.collectedCount(kind, key.slice(idx + 1));
    });
    // Extra 三层合并视图读取器接线（docs/13 §6）：value data 源 / condition extra 目标 / addExtra 生效值
    this.valueSystem.setExtraReader(path => this.getExtra(path));
    this.conditionSystem.setExtraReader(path => this.getExtra(path));
    this.mutations.setExtraReader(path => this.getExtra(path));
    this.devLog = new DevLog(options.devLog);
    this.passivePoolSystem = new PassivePoolSystem(this.registry, this.conditionSystem, this.eventBus);
    this.storyService = new StoryService({
      registry: this.registry,
      conditionSystem: this.conditionSystem,
      effectEngine: this.effectEngine,
      mutations: this.mutations,
      eventBus: this.eventBus,
      passivePools: this.passivePoolSystem,
      getState: () => this._state,
      travelToArea: (areaId, allowDuringStory) => this.travelToArea(areaId, allowDuringStory),
    });
    // visitedStoryInChain 条件：查询当前 Entry 跳转链是否经过某 Story（由 StoryService 提供运行时上下文）
    this.conditionSystem.setStoryChainChecker(id => this.storyService.isVisitedInChain(id));
    this.spotService = new SpotService({
      registry: this.registry,
      valueSystem: this.valueSystem,
      conditionSystem: this.conditionSystem,
      mutations: this.mutations,
      effectEngine: this.effectEngine,
      characterSystem: this.characterSystem,
      affectorEngine: this.affectorEngine,
      eventBus: this.eventBus,
      devLog: this.devLog,
      getState: () => this._state,
      getVisibility: () => this.visibilityEngine.getVisibility(this._state),
      refreshVisibility: () => this.refreshVisibility(),
      getResourceAmount: resourceId => this.initService.getResourceAmount(resourceId),
    });
    this.initService = new InitService({
      registry: this.registry,
      conditionSystem: this.conditionSystem,
      effectEngine: this.effectEngine,
      mutations: this.mutations,
      statsService: this.statsService,
      eventBus: this.eventBus,
      devLog: this.devLog,
      storyService: this.storyService,
      triggerSystem: this.triggerSystem,
      affectorEngine: this.affectorEngine,
      visibilityEngine: this.visibilityEngine,
      getState: () => this._state,
      getVisibility: () => this.visibilityEngine.getVisibility(this._state),
      setState: next => {
        this._state = next;
        // 状态整体更换（新游戏/进入世界线）时产出缓存一并失效
        this.gameNumSystem.invalidateProduction();
      },
      resetVisibility: () => { this.visibilityEngine.reset(); },
      clearLocalVisibility: () => {
        this.visibilityEngine.clearLocal();
      },
      refreshVisibility: () => this.refreshVisibility(),
      stop: () => this.stop(),
      createDefaultState: () => this.createDefaultState(),
      touchTickTimestamp: () => { this.sessionService.touchLastTick(); },
    });

    this.sessionService = new SessionService({
      doTick: () => this.tick(),
      devLog: this.devLog,
      eventBus: this.eventBus,
      effectEngine: this.effectEngine,
      getState: () => this._state,
    });
    this.itemService = new ItemService({
      registry: this.registry,
      mutations: this.mutations,
      conditionSystem: this.conditionSystem,
      effectEngine: this.effectEngine,
      lootSystem: this.lootSystem,
      devLog: this.devLog,
      getState: () => this._state,
    });
    this.enhancementService = new EnhancementService({
      registry: this.registry,
      mutations: this.mutations,
      conditionSystem: this.conditionSystem,
      effectEngine: this.effectEngine,
      affectorEngine: this.affectorEngine,
      devLog: this.devLog,
      getState: () => this._state,
      getVisibility: () => this.visibilityEngine.getVisibility(this._state),
      refreshVisibility: () => this.refreshVisibility(),
      recheckAllAffectors: () => this.affectorEngine.recheckAll(),
      getResourceAmount: resourceId => this.initService.getResourceAmount(resourceId),
    });

    this._state = this.createDefaultState();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);

    // 在注册表加载后同步子系统
    this.eventBus.onAny((event) => {
      console.debug(`[Event] ${event.type}`, event);
      this.devLog.recordEvent(event, this._state.totalFrames);
    });

    // 获得角色差分 / flag 变化后，自动重算色彩解锁（达成条件即入库存，闭环色彩系统）
    this.eventBus.on('characterAcquired', () => {
      this.colorSystem.recheckUnlocks();
    });
    this.eventBus.on('flagChanged', () => {
      this.colorSystem.recheckUnlocks();
    });
  }

  // --- 访问器 ---

  get state(): Readonly<PlayerState> { return this._state; }
  get visibility(): Readonly<VisibilitySnapshot> { return this.visibilityEngine.getVisibility(this._state); }
  get running(): boolean { return this.sessionService.running; }
  getDevLogs(): readonly DevLogEntry[] { return this.devLog.getEntries(); }
  clearDevLogs(): void { this.devLog.clear(); }

  /** 强制重算可见性快照（服务/门面共用）。 */
  private refreshVisibility(): void {
    this.visibilityEngine.recomputeAll(this._state);
  }

  /** [DEBUG] 将每个 Enhancement 的六个条件层级 dump 到 devLog。 */
  dumpEnhancementDebug(): void {
    this.enhancementService.dumpEnhancementDebug();
  }

  /** 返回供 UI 使用的不可变数据快照，不暴露 PlayerState 写引用。 */
  getView(): GameView {
    return {
      activeInit: this._state.activeInit,
      currentAreaId: this._state.currentAreaId ?? null,
      visitedAreas: this._state.visitedAreas ? [...this._state.visitedAreas] : [],
      totalFrames: this._state.totalFrames,
      resources: {
        // 视图合并：全局资源（跨世界线）+ 当前世界线局部资源
        ...(this._state.globalResources ?? {}),
        ...this._state.resources,
      },
      spotLevels: { ...this._state.spotLevels },
      spotManagers: { ...this._state.spotManagers },
      unlockedEnhancements: [...this._state.unlockedEnhancements],
      inventory: { ...this._state.inventory },
      unlockedInits: [...this._state.unlockedInits],
      storyLog: this._state.storyLog.map(story => ({ ...story })),
      flags: { ...this._state.flags },
      visibility: {
        inits: { ...this.visibility.inits },
        areas: { ...this.visibility.areas },
        spots: { ...this.visibility.spots },
        enhancements: { ...this.visibility.enhancements },
        items: { ...this.visibility.items },
        stories: { ...this.visibility.stories },
      },
      currentStory: this.storyService.getCurrentStoryView(),
      activeAffectors: this.affectorEngine.getActiveInstances().map(instance => ({
        ...instance,
        activeEntryIds: [...instance.activeEntryIds],
      })),
      stats: this.statsService.getSnapshot(),
    };
  }

  /**
   * 返回指定聊天沙盒（owner = VariantId）的当前剧情视图。
   * 与 getView().currentStory（全局游标）并行互不干扰——各角色对话空间有独立游标。
   */
  getStoryView(owner: string): StoryView | null {
    return this.storyService.getCurrentStoryView(owner);
  }

  // --- 初始化 ---

  /** 加载数据包并初始化游戏 */
  init(datapacks: Datapack[]): void {
    this.sessionService.touchLastTick();
    // 加载所有数据包
    for (const dp of datapacks) {
      this.registry.load(dp);
      if (dp.affectorPacks) this.affectorEngine.load(dp.affectorPacks);
      if (dp.triggerDefs) this.triggerSystem.load(dp.triggerDefs);
    }

    // 同步子系统
    this.valueSystem.setFuncletDefs(this.registry.funcletDefs as Map<string, import('./types').FuncletDef>);
    this.funcletExecutor.setDefs(this.registry.funcletDefs as Map<string, import('./types').FuncletDef>);
    // Character 引用完整性：全部数据包加载完成后统一校验（跨包引用允许）
    this.registry.validateCharacterRefs();
    this.effectEngine.setState(this._state);
    this.tickSystem.setState(this._state);

    // 统一数值注册：构建每个 Resource 的 primitiveGain 树（懒求值）
    this.gameNumSystem.buildAll();
    // 用当前已解锁强化初始化产出反向索引
    this.gameNumSystem.rebuildEnhIndex(this._state.unlockedEnhancements);
    this.tagStatService.setState(this._state);
    this.tagStatService.rebuildDeclared();
    // 被动闲聊池：数据包加载后重建 gate 依赖索引
    this.passivePoolSystem.rebuildIndex();

    // 加载角色系统
    this.characterSystem.clear();
    for (const dp of datapacks) {
      if (dp.characters) this.characterSystem.load(dp.characters);
      // F-02：characterBonuses 已废弃（冻结），携带时警告并忽略
      if (dp.characterBonuses?.length) {
        this.devLog.record('数据包携带已废弃的 characterBonuses 表，已忽略', {
          source: 'registry',
          level: 'warning',
        });
      }
    }

    // 计算可见性（事件驱动：建立反向索引并全量重算）
    this.visibilityEngine.rebuild(this._state);

    // 进入默认 Init
    const defaultInit = [...this.registry.inits.values()].find(
      i => !hasExistenceGate(i.revealTriggers),
    );
    if (defaultInit) {
      this.enterInit(defaultInit.id);
    }
    this.devLog.record(`已加载数据包 ${datapacks.length} 个`, {
      source: 'registry',
      level: 'success',
      details: `${this.registry.inits.size} init / ${this.registry.spots.size} spot / ${this.registry.items.size} item`,
    });
  }

  /**
   * 运行时整体替换数据包（多文件 Mod 载入后使用）：
   * 清空注册表与各子系统，重置运行时状态后重新 init。
   * 注意：数据包更换后旧存档语义失效，调用方应自行清除存档。
   */
  reload(datapacks: Datapack[]): void {
    this.stop();
    this.registry.clear();
    this.affectorEngine.load([]);
    this.triggerSystem.clear();
    this.reset();
    this.init(datapacks);
  }

  /** 手动推进一帧并返回本帧生产结果。 */
  tick(): TickResult {
    this.tickSystem.setState(this._state);
    const result = this.tickSystem.tick();
    // Affector 贯穿 Area / 整个 Init 持续生效：每帧应用挂载中的效果
    this.affectorEngine.applyActiveEffects();
    this.effectEngine.setState(this._state);
    // 阻断态的对话空间：每帧检查 block 条件是否已满足（如到达指定区域/持有物品）
    this.recheckStudentBlocks();
    // 可见性由事件驱动增量更新，不在每帧全量重算
    this.statsService.recordTick();
    this.devLog.recordTick(result);
    return result;
  }

  /**
   * 对话空间阻断态复检（壁垒重启）：遍历当前被 block 锁定的学生，若其触发 entry 的
   * block 条件组现已满足，则解除锁定（StateMutationService.clearStudentBlock）。
   * 由 tick 与区域进入后调用，实现「剧情要求前往某地 → 到达后对话空间重启」的关卡式剧情。
   */
  private recheckStudentBlocks(): void {
    const blocks = this._state.studentBlocks;
    if (!blocks) return;
    for (const variantId of Object.keys(blocks)) {
      const block = blocks[variantId];
      const entry = this.registry.passiveStories.get(block.entryId);
      if (!entry || !entry.block) {
        this.mutations.clearStudentBlock(variantId);
        continue;
      }
      if (this.conditionSystem.evaluateGroup(entry.block, this._state)) {
        this.mutations.clearStudentBlock(variantId);
      }
    }
  }

  /** 发放物品并执行其获得时效果。 */
  giveItem(itemId: ItemId, count: number): boolean {
    return this.itemService.giveItem(itemId, count);
  }

  /** 使用一个可使用物品。 */
  useItem(itemId: ItemId): UseItemResult {
    return this.itemService.useItem(itemId);
  }

  /** 执行注册掉落表并将结果发放到背包。 */
  rollDropTable(tableId: string): Map<string, number> {
    return this.itemService.rollDropTable(tableId);
  }

  // --- 生命周期 ---

  /** 开始 Tick 循环 (1 tick/秒)。 */
  start(): void {
    this.sessionService.start();
  }

  /** 停止 Tick 循环 */
  stop(): void {
    this.sessionService.stop();
  }

  // --- Init / Area / Spot 操作 ---

  /** 进入一个 Init */
  enterInit(initId: string): void {
    this.initService.enterInit(initId);
  }

  /**
   * 移动到 Area（玩家入口）——可达性层。
   * 门槛链：存在 → 同 Init → 非演出锁定 → 相邻（checkAdjacency=true）→ 可见。
   * 非 passive 剧情演出进行中时禁止移动（防止演出背景被切换）；该限制对
   * Story 自身要求移动（travelToArea effect）放开；Story 移动可跳过拓扑（checkAdjacency=false）。
   */
  travelToArea(areaId: AreaId, allowDuringStory = false, checkAdjacency = true): TravelResult {
    const result = this.initService.travelToArea(areaId, allowDuringStory, checkAdjacency);
    if (result.success) this.recheckStudentBlocks(); // 到达新区域可能满足对话空间阻断条件
    return result;
  }

  /**
   * 购买并激活一个 Enhancement（可达性层）。
   * 前置校验：存在 → 可见 → 解锁条件满足 → 资源充足 → 未重复获得。
   */
  purchaseEnhancement(enhancementId: EnhancementId): EnhancementPurchaseResult {
    return this.enhancementService.purchaseEnhancement(enhancementId);
  }

  // --- Story flow（剧情游标与流程已拆至 game/story-service.ts，此处仅门面委托） ---

  startActiveStory(storyId: string): StoryStartResult {
    return this.storyService.startActiveStory(storyId);
  }

  /**
   * 启动一个剧情（active 或 passive）。ActiveStory 可打断正在播放的 PassiveStory。
   * 进入 Init 自动展开 startStoryId 时由内部复用；测试亦依赖此入口。
   */
  startStory(storyId: string, expectedType: 'active' | 'passive', owner?: string | null): StoryStartResult {
    return this.storyService.startStory(storyId, expectedType, owner);
  }

  /**
   * Pick one eligible passive story from the current Init by weight.
   * @param initId 当前世界线
   * @param owner 壁垒：仅抽取归属该 VariantId 的闲聊（对话空间）；省略/null = 全局闲聊。
   */
  triggerPassiveStory(initId?: string, owner?: string | null): StoryStartResult {
    return this.storyService.triggerPassiveStory(initId, owner);
  }

  /**
   * 重阅读入口：从 StoryEntry 重新阅读关联的 Story 链。
   * 仅对 entry.replayable = true 的 Entry 可用；
   * 重阅读模式受 entry.branchGuards 分歧点准入守卫约束。
   */
  replayStory(storyId: string): StoryStartResult {
    return this.storyService.replayStory(storyId);
  }

  advanceStory(choiceIndex?: number, owner?: string | null): StoryAdvanceResult {
    return this.storyService.advanceStory(choiceIndex, owner);
  }

  /**
   * 查询底部"回复按钮"的当前状态。
   * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
   */
  getSendState(owner?: string | null): SendState {
    return this.storyService.getSendState(owner);
  }

  /**
   * 玩家点击一次回复按钮。
   * - 剧情演出中：直接推进一页（advanceStory），并执行当前页效果
   * - 无剧情：尝试按当前场景随机抽取并开始一条 PassiveTalk
   */
  clickSend(owner?: string | null): SendResult {
    return this.storyService.clickSend(owner);
  }

  /** 解锁一个 Init */
  unlockInit(initId: string): void {
    this.initService.unlockInit(initId);
  }

  /** 开启新游戏并进入指定世界线，返回是否成功。 */
  startNewGame(initId: string): boolean {
    return this.initService.startNewGame(initId);
  }

  // ================================================================
  //   三种重启路径
  // ================================================================

  /**
   * 购买一个未解锁的世界线（Init）。
   * - 免费 Init（无 purchaseCost）直接解锁并返回成功。
   * - 已购买过的 Init 也直接返回成功（可安全重复调用）。
   * - 资源检查：遍历 purchaseCost，任一项不足即拒绝。
   */
  purchaseInit(initId: string): InitPurchaseResult {
    return this.initService.purchaseInit(initId);
  }

  restartInit(): void {
    this.initService.restartInit();
  }

  /**
   * 软重启 / 新游戏 之后进入一个 Init：
   * - 有快照 → 恢复全部 per-Init 进度（断点续玩）
   * - 无快照 → 新鲜开始（所有 per-Init 字段为零）
   *
   * unlockedInits 与 stats 不受影响（前者由 PlayerState 维护，后者由 StatsService 维护）。
   */
  resumeInit(initId: string): boolean {
    return this.initService.resumeInit(initId);
  }

  /**
   * 硬重启：结束当前 Init 并**删除其快照**，清除所有 per-Init 数据。
   *
   * 与 restartInit 的关键区别：
   * - restartInit     → 保存快照，可断点续玩
   * - hardRestartInit → 删除快照，下次进入该 Init 全新开始
   */
  hardRestartInit(): void {
    this.initService.hardRestartInit();
  }

  /**
   * 从 Init 选择页彻底重置某个 Init（删除其快照）。
   * 不影响当前运行中的 Init（如当前正在该 Init 中，快照删除后下次重进即为全新）。
   */
  hardResetInit(initId: string): void {
    this.initService.hardResetInit(initId);
  }

  // --- Spot 操作（实现已拆至 game/spot-service.ts，此处门面委托） ---

  /** 升级 Spot：通用公式 + levelUpgrades 效果叠加。 */
  upgradeSpot(spotId: string): SpotUpgradeResult {
    return this.spotService.upgradeSpot(spotId);
  }

  /** 分配 Manager */
  assignManager(spotId: string, character: Character): boolean {
    return this.spotService.assignManager(spotId, character);
  }

  /** 获取某个 Spot 当前 Manager 的标签加成倍率 */
  getManagerBonus(spotId: string): number {
    return this.spotService.getManagerBonus(spotId);
  }

  /** 计算某个 Spot 的总产出 (含 Manager 标签加成) */
  getSpotYield(spotId: string): { base: number; managerBonus: number; tagMultiplier: number; total: number } {
    return this.spotService.getSpotYield(spotId);
  }

  /**
   * 获取某个 Spot 的有效等级上限。
   * 优先级见 game/spot-service.ts getEffectiveMaxLevel 文档。
   */
  getEffectiveMaxLevel(spotId: string): number | undefined {
    return this.spotService.getEffectiveMaxLevel(spotId);
  }

  /** 手动解锁 Spot (消耗资源) */
  unlockSpot(spotId: string): SpotUnlockResult {
    return this.spotService.unlockSpot(spotId);
  }

  /** 从当前游戏移除一个已获得的 Enhancement（不再生效，可重新购买）。 */
  removeEnhancement(enhancementId: EnhancementId): boolean {
    return this.enhancementService.removeEnhancement(enhancementId);
  }

  /** 运行时给 Spot 新加入一个 Tag：Enhancement 按 Tag 作用、tag 条件即时更新。 */
  addSpotTag(spotId: string, tag: TagPath): boolean {
    return this.spotService.addSpotTag(spotId, tag);
  }

  /** 运行时让 Spot 撤出一个 Tag：相关按 Tag 作用即时失效。 */
  removeSpotTag(spotId: string, tag: TagPath): boolean {
    return this.spotService.removeSpotTag(spotId, tag);
  }

  // --- Extra 运行时 API（docs/13 §5.3） ---

  /**
   * 沿路径读取额外数据：按 全局 → per-Init → 数据包常量表 优先级查询（命中即返回）。
   * @param path Extra 路径，如 'story/choice/3'，'/' 分隔、禁空段。
   */
  getExtra(path: ExtraPath): ExtraValue | undefined {
    const global = getAtPath(this._state?.extras, path);
    if (global !== undefined) return global;
    const perInit = getAtPath(this._state?.initExtras, path);
    if (perInit !== undefined) return perInit;
    return getAtPath(this.registry.extras, path);
  }

  /** 写全局层额外数据（运行时动态数据；数据包常量表与 Def.extra 保持只读）。 */
  setExtra(path: ExtraPath, value: ExtraValue): void {
    if (!this._state.extras) this._state.extras = extra.dict({});
    setAtPath(this._state.extras, path, value);
  }

  /** 显式写当前 Init 的 per-Init 层额外数据（低频；随快照保存/恢复，软重启清空重建）。 */
  setPerInitExtra(path: ExtraPath, value: ExtraValue): void {
    if (!this._state.initExtras) this._state.initExtras = extra.dict({});
    setAtPath(this._state.initExtras, path, value);
  }

  /** 合并额外数据到全局层（深合并，同名路径叶子被覆盖；source 需为 dict）。 */
  mergeExtras(source: ExtraCompound): void {
    if (!this._state.extras) this._state.extras = extra.dict({});
    mergeExtra(this._state.extras, source);
  }

  // --- 存档 ---

  /** 导出存档数据 */
  save(): SaveData {
    const storyCursor = this.storyService.saveCursor();
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      playerState: JSON.parse(JSON.stringify(this._state)),
      visibility: JSON.parse(JSON.stringify(this.visibilityEngine.getVisibility(this._state))),
      pendingStoryId: storyCursor.currentStoryId,
      pendingStoryPageIndex: storyCursor.currentStoryPageIndex,
      pendingStoryChoiceIndex: storyCursor.currentStoryChoiceIndex,
      pendingTalkletClicks: storyCursor.talkletClickWork,
      pendingStoryDefId: storyCursor.currentStoryDefId,
      pendingInsertStack: storyCursor.insertStack,
      pendingVisitedStoryIds: storyCursor.visitedStoryIds,
      pendingIsReplay: storyCursor.isReplay,
      chatCursors: this.storyService.saveChatCursors(),
      stats: this.statsService.getPersistable(),
    };
  }

  /** 从存档数据恢复 */
  load(saveData: SaveData): void {
    this._state = JSON.parse(JSON.stringify(saveData.playerState));
    this._state.initSnapshots ??= {};
    // 旧档兼容：extras / initExtras 字段缺失时补空底座（三层合并视图见 docs/13 §5.3）
    this._state.extras ??= extra.dict({});
    this._state.initExtras ??= extra.dict({});
    for (const snap of Object.values(this._state.initSnapshots)) {
      snap.extras ??= extra.dict({});
    }
    // 旧档迁移：早期存档可能把全局资源（青辉石）存在 resources 中
    this._state.globalResources ??= {};
    for (const id of GLOBAL_RESOURCE_IDS) {
      const legacy = this._state.resources[id] ?? 0;
      if (legacy > 0) {
        this._state.globalResources[id] = (this._state.globalResources[id] ?? 0) + legacy;
        delete this._state.resources[id];
      }
    }
    // 旧存档兜底：无 currentAreaId 时定位到当前 Init 的第一个默认 Area
    if (!this._state.currentAreaId) {
      const init = this.registry.inits.get(this._state.activeInit);
      this._state.currentAreaId = init?.defaultAreas[0] ?? undefined;
    }
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    // 恢复当前世界线的专属 Trigger（先移除之前挂载的组）
    this.initService.mountInitTriggers(this._state.activeInit);
    if (saveData.visibility) this.visibilityEngine.setSnapshot(saveData.visibility);
    if (saveData.stats) this.statsService.restore(saveData.stats);
    else this.statsService.beginSession();
    this.storyService.restoreCursor({
      currentStoryId: saveData.pendingStoryId,
      currentStoryDefId: saveData.pendingStoryDefId ?? null,
      currentStoryPageIndex: saveData.pendingStoryPageIndex,
      currentStoryChoiceIndex: saveData.pendingStoryChoiceIndex ?? -1,
      talkletClickWork: saveData.pendingTalkletClicks ? { ...saveData.pendingTalkletClicks } : null,
      insertStack: saveData.pendingInsertStack ? saveData.pendingInsertStack.map(s => ({ ...s })) : [],
      visitedStoryIds: saveData.pendingVisitedStoryIds ? [...saveData.pendingVisitedStoryIds] : [],
      isReplay: saveData.pendingIsReplay ?? false,
    });
    // 恢复各聊天沙盒游标（各角色对话空间独立剧情游标）
    this.storyService.restoreChatCursors(saveData.chatCursors);
    this.sessionService.setLastTick(saveData.timestamp);

    // 重新同步子系统
    this.effectEngine.setState(this._state);
    this.tickSystem.setState(this._state);
    // 用存档已解锁强化重建产出反向索引
    this.gameNumSystem.rebuildEnhIndex(this._state.unlockedEnhancements);
    this.tagStatService.setState(this._state);

    const init = this.registry.inits.get(this._state.activeInit);
    this.initService.logInitReachability('世界线可及性：读取存档');
    this.devLog.record(`读取存档：恢复世界线 ${init?.name ?? this._state.activeInit}`, {
      source: 'init',
      level: 'info',
      details: [
        `帧 ${this._state.totalFrames}`,
        `解锁世界线 ${this._state.unlockedInits.length} 个`,
        this._state.currentAreaId ? `当前区域 ${this.registry.areas.get(this._state.currentAreaId)?.name ?? this._state.currentAreaId}` : '无当前区域',
        `已启用设施 ${Object.keys(this._state.spotLevels).length} 处`,
      ].join(' · '),
    });
  }

  /** 重置为默认状态 */
  reset(): void {
    this.stop();
    this._state = this.createDefaultState();
    this.sessionService.touchLastTick();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.statsService.reset();
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    // 用默认状态已解锁强化重建产出反向索引
    this.gameNumSystem.rebuildEnhIndex(this._state.unlockedEnhancements);
    this.tagStatService.setState(this._state);
    // 移除已挂载的世界线专属 Trigger
    this.initService.unmountInitTriggers();
    this.visibilityEngine.reset();
    this.storyService.clearCurrentStory();
    this.devLog.clear();
    this.devLog.record('运行时状态已重置', { source: 'runtime', level: 'warning' });
  }

  // --- 默认状态 ---

  private createDefaultState(): PlayerState {
    return {
      resources: {},
      globalResources: {},
      spotLevels: {},
      spotManagers: {},
      unlockedEnhancements: [],
      activeInit: '',
      totalFrames: 0,
      storyLog: [],
      inventory: {},
      flags: {},
      triggersCompleted: [],
      unlockedInits: [],
      visitedAreas: [],
      initSnapshots: {},
      extras: extra.dict({}),
      initExtras: extra.dict({}),
    };
  }

}
