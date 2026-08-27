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
} from './types';
import { StoryService } from './game/story-service';
import { type StoryView } from './types/results';
import { SpotService } from './game/spot-service';
import { InitService } from './game/init-service';
import { ItemService } from './game/item-service';
import { EnhancementService } from './game/enhancement-service';
import { SessionService } from './game/session-service';
import { ChatFlowService } from './game/chat-flow-service';
import { buildGameView } from './game/view-builder';
import { createDefaultState as createDefaultPlayerState } from './game/state-factory';
import { buildSaveData, restoreFromSave } from './game/save-codec';
import { recheckStudentBlocks as recheckBlocks, reloadRuntime, resetRuntime } from './game/runtime-reset';

import { extra, getAtPath, mergeExtra, setAtPath } from './extra/index';
import { ImageStore, ResolvedImageEntry, resolvePicSrc } from './image/index';
import { PicDef } from './types/pics';
import { resolveCharaProfile } from './core/chara-profile';
import type { CharaProfile, CharaProfileDef, CharaCustomOverride, CharaNameEntry, CharaAvatarEntry } from './types/chara-profile';
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
import { StatsService } from './stats/stats';
import { SpotFunctionalitySystem } from './system/spot-functionality';
import { GameNumSystem } from './expression/game-num';
import { TriggerSystem } from './effect/trigger-system';
import { TagPath } from './core/tag';

import { CharacterSystem } from './system/character-system';
import { RosterSystem } from './system/roster-system';
import { CharacterAvailabilityService } from './system/character-availability';
import { ColorSystem } from './system/color-system';
import { ColorEquipmentSystem } from './system/color-equipment-system';
import { GachaService } from './system/gacha-service';
import { TagStatService, type TagStatKind } from './stats/tag-stats';
import { PassivePoolSystem } from './system/passive-pool-system';

import type { SaveData } from './game/save-codec';
export type { SaveData };

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
  readonly colorEquipmentSystem: ColorEquipmentSystem;
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
  /** 聊天流演出服务（Talklet 专用）：clearAllChatFlow / showChatText / clearIdChatFlow 的运行时桥。 */
  readonly chatFlowService: ChatFlowService;
  /** 图片存储：Mod 压缩包解出的本地图片（UI 导入流程填充；见 getPicUrl）。 */
  readonly imageStore: ImageStore;

  // 运行时状态
  private _state!: PlayerState;

  constructor(options: { devLog?: DevLogOptions } = {}) {
    this.imageStore = new ImageStore();
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
    this.spotFunctionalitySystem = new SpotFunctionalitySystem(
      this.registry,
      this.conditionSystem,
      (enhId) => {
        const enh = this.registry.enhancements.get(enhId);
        if (!enh?.affectorPackIds?.length) return [];
        const tags: string[][] = [];
        for (const pid of enh.affectorPackIds) {
          const pack = this.affectorEngine.getPack(pid);
          if (!pack) continue;
          for (const entry of pack.entries) {
            for (const z of entry.zoneModifiers ?? []) {
              if (z.target.kind === 'tag') tags.push(z.target.tag);
            }
          }
        }
        return tags;
      },
    );
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
    this.colorEquipmentSystem = new ColorEquipmentSystem(
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
      this.storyService.startStory(effect.target, type, effect.owner ?? null, { force: true });
    };
    // 聊天流演出服务（clearAllChatFlow / showChatText / clearIdChatFlow）→ 转发给 ChatFlowService 发运行时事件
    this.chatFlowService = new ChatFlowService(this.eventBus);
    this.effectEngine.chatFlowHandler = effect => {
      const value = effect.value as import('./types/expression').ChatTextEffectValue;
      if (effect.op === 'clearAllChatFlow') this.chatFlowService.clearAll();
      else if (effect.op === 'showChatText') this.chatFlowService.showText(effect.target, value);
      else if (effect.op === 'clearIdChatFlow') this.chatFlowService.clearId(effect.target);
      else if (effect.op === 'clearAllChatText') this.chatFlowService.clearAllTexts();
    };
    this.gachaService = new GachaService(
      this.registry,
      this.mutations,
      this.eventBus,
      () => this._state,
      resourceId => this.initService.getResourceAmount(resourceId),
      pool => this.availabilityService.drawableOf(pool, this._state),
    );
    // 差分目录接线：acquireCharacter/培养/色彩装备解析经 registry 解析原型与曲线（与 extraReader 同模式）
    this.mutations.setCharacterCatalog({
      getVariant: id => this.registry.characterVariants.get(id),
      getCurve: id => this.registry.cultivateCurves.get(id),
      getColor: id => this.registry.colors.get(id),
      getColorGroup: id => this.registry.colorGroups.get(id),
      getColorEquipment: id => this.registry.colorEquipments.get(id),
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
    // Affector 的按 tag 加成经 GameNum 的 tag 效果表落地
    this.affectorEngine.gameNumSystem = this.gameNumSystem;
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
        // 状态整体更换（新游戏/进入世界线）时重建数值树并绑定新 state，
        // 否则 GameNumSystem.state 仍指向旧对象，区表写入/清理会落错对象
        this.gameNumSystem.buildAll(this._state);
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

    // 获得角色差分 / flag 变化后，自动重算色彩与色彩装备解锁（达成条件即入库存，闭环收集系统）
    this.eventBus.on('characterAcquired', () => {
      this.colorSystem.recheckUnlocks();
      this.colorSystem.recheckDesignUnlocks();
      this.colorEquipmentSystem.recheckUnlocks();
    });
    this.eventBus.on('flagChanged', () => {
      this.colorSystem.recheckUnlocks();
      this.colorSystem.recheckDesignUnlocks();
      this.colorEquipmentSystem.recheckUnlocks();
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
    return buildGameView({
      state: this._state,
      visibility: this.visibility,
      currentStory: this.storyService.getCurrentStoryView(),
      activeAffectors: this.affectorEngine.getActiveInstances(),
      stats: this.statsService.getSnapshot(),
    });
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
    this.gameNumSystem.buildAll(this._state);
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
    reloadRuntime({
      stop: () => this.stop(),
      registry: this.registry,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      reset: () => this.reset(),
      init: d => this.init(d),
    }, datapacks);
  }

  /** 手动推进一帧并返回本帧生产结果。 */
  tick(): TickResult {
    this.tickSystem.setState(this._state);
    // 每帧重算产出：先整树失效，避免直接改 state 的调用方读到陈旧缓存
    this.gameNumSystem?.invalidateProduction();
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
    recheckBlocks({
      state: this._state,
      registry: this.registry,
      mutations: this.mutations,
      conditionSystem: this.conditionSystem,
    });
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

  startActiveStory(storyId: string, owner?: string | null): StoryStartResult {
    return this.storyService.startActiveStory(storyId, owner);
  }

  /**
   * 聊天卡片入口启动：跳过 availableInits / triggerCondition（卡片出现本身即 gate），
   * 但尊重单次完成态（AlreadyCompleted 拒绝），可打断被动闲聊。
   */
  startCardStory(storyId: string, owner?: string | null): StoryStartResult {
    return this.storyService.startCardStory(storyId, owner);
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
   * owner = VariantId 时在对应学生的对话空间沙盒内演出（与 startStory 沙盒语义一致）。
   */
  replayStory(storyId: string, owner?: string | null): StoryStartResult {
    return this.storyService.replayStory(storyId, owner);
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

  // --- 图片资产（PicDef / 三段式索引） ---

  /**
   * 解析图片引用为可显示 URL：
   * - 直连 URL / 相对路径 → 原样返回；
   * - `mod:type(pic):id` 三段式索引 → 查 pics 表解析（zip 来源经 ImageStore 取本地解出图片）；
   * - 未声明 / zip 未登记 → undefined（UI 回退占位）。
   */
  getPicUrl(ref: string | undefined): string | undefined {
    return resolvePicSrc(this.registry, this.imageStore, ref);
  }

  /** 取图片资产定义（pics 表查询）；未声明返回 undefined。 */
  getPicDef(ref: string): PicDef | undefined {
    return this.registry.pics.get(ref);
  }

  /** 登记一批压缩包解出的本地图片（导入流程在 reload 前调用）。 */
  registerImages(mod: string, entries: readonly ResolvedImageEntry[]): void {
    this.imageStore.registerAll(mod, entries);
  }

  // --- Chara 头像-人名对（charaProfile 便捷接口） ---

  /**
   * 便捷取某 Chara 当前使用的头像-人名对。
   * 解析管线：兜底 → chara 表(declared) → 玩家覆写(player) → 调用点(override)。
   * avatar 为已解析 URL（PicId → PicDef → resolvePicSrc），前端直接用。
   */
  characterProfile(
    character: Character | null,
    overrides?: { name?: string; avatar?: import('./types/pics').PicId },
  ): CharaProfile {
    return resolveCharaProfile(
      this.registry,
      this._state.charaCustom,
      pic => resolvePicSrc(this.registry, this.imageStore, pic),
      character,
      overrides,
    );
  }

  /** 玩家侧覆写某 Chara 的头像-人名对（player 层，随存档持久化）。 */
  setCharaProfile(character: Character, override: CharaCustomOverride): void {
    this.mutations.setCharaCustom(character, override);
  }

  /** 清除某 Chara 的玩家侧覆写（回到 chara 声明 / 兜底）。 */
  clearCharaProfile(character: Character): void {
    this.mutations.clearCharaCustom(character);
  }

  /** Chara 的 name 表（改名/选名面板用）。 */
  charaNames(character: Character): CharaNameEntry[] {
    return this.registry.charaProfiles.get(character)?.names ?? [];
  }

  /** Chara 的 avatar 表（换头像面板用）。 */
  charaAvatars(character: Character): CharaAvatarEntry[] {
    return this.registry.charaProfiles.get(character)?.avatars ?? [];
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
    return buildSaveData({
      state: this._state,
      visibility: () => this.visibilityEngine.getVisibility(this._state),
      storyCursor: () => this.storyService.saveCursor(),
      chatCursors: () => this.storyService.saveChatCursors(),
      persistedStats: () => this.statsService.getPersistable(),
    });
  }

  /** 从存档数据恢复 */
  load(saveData: SaveData): void {
    restoreFromSave({
      registry: this.registry,
      devLog: this.devLog,
      mutations: this.mutations,
      statsService: this.statsService,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      effectEngine: this.effectEngine,
      tickSystem: this.tickSystem,
      tagStatService: this.tagStatService,
      visibilityEngine: this.visibilityEngine,
      storyService: this.storyService,
      initService: this.initService,
      sessionService: this.sessionService,
      setState: next => {
        this._state = next;
        this.gameNumSystem.buildAll(this._state);
      },
    }, saveData);
  }

  /** 重置为默认状态 */
  reset(): void {
    resetRuntime({
      stop: () => this.stop(),
      createDefaultState: () => createDefaultPlayerState(),
      setState: next => {
        this._state = next;
        this.gameNumSystem.buildAll(this._state);
      },
      sessionService: this.sessionService,
      mutations: this.mutations,
      statsService: this.statsService,
      affectorEngine: this.affectorEngine,
      triggerSystem: this.triggerSystem,
      tagStatService: this.tagStatService,
      initService: this.initService,
      visibilityEngine: this.visibilityEngine,
      storyService: this.storyService,
      devLog: this.devLog,
    });
  }

  // --- 默认状态 ---

  private createDefaultState(): PlayerState {
    return createDefaultPlayerState();
  }

}
