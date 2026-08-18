// ============================================================
// engine/game-instance.ts — 核心运行时
// ============================================================

import {
  PlayerState,
  Datapack,
  VisibilitySnapshot,
  InitDef,
  InitSnapshot,
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
  ResourceAmount,
  SpotUnlockResult,
  SpotUpgradeResult,
  EntryEffectDef,
  RevealTarget,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
  GLOBAL_RESOURCE_IDS,
} from './types';
import { StoryService } from './game/story-service';
import { SpotService } from './game/spot-service';
import { freshPerInitState, globalSpotEntries, localSpotEntries } from './game/snapshot';
import { condLabel, triggerLabel } from './game/debug-labels';
import { extra, getAtPath, mergeExtra, setAtPath } from './extra';
import { Registry } from './registry';
import { EventBus } from './event-bus';
import { ValueSystem } from './value-system';
import { ConditionSystem } from './condition-system';
import { FuncletExecutor } from './funclet-executor';
import { EffectEngine } from './effect-engine';
import { TICK_INTERVAL_MS, TickSystem } from './tick-system';
import { LootSystem } from './loot-system';
import { VisibilityEngine } from './visibility-engine';
import { existenceCondition, hasExistenceGate, unlockMet } from './reveal';
import { StateMutationService } from './state-mutation-service';
import { AffectorEngine } from './affector-engine';
import { DevLog, DevLogEntry, DevLogOptions } from './dev-log';
import { StatsService, PersistedStats } from './stats';
import { SpotFunctionalitySystem } from './spot-functionality';
import { GameNumSystem } from './game-num';
import { TriggerSystem } from './trigger-system';
import { TagPath } from './tag';

import { CharacterSystem } from './character-system';

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
  readonly mutations: StateMutationService;
  readonly affectorEngine: AffectorEngine;
  readonly devLog: DevLog;
  readonly statsService: StatsService;
  readonly spotFunctionalitySystem: SpotFunctionalitySystem;
  readonly gameNumSystem: GameNumSystem;
  readonly triggerSystem: TriggerSystem;
  readonly storyService: StoryService;
  readonly spotService: SpotService;

  // 运行时状态
  private _state!: PlayerState;
  private _visibility!: VisibilitySnapshot;

  // 帧循环
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private _running = false;

// 离线收益
  private lastTickTimestamp: number = Date.now();
  /** 当前已挂载的世界线 Trigger 分组（init:<initId>）；null = 未挂载。 */
  private mountedInitTriggerGroup: string | null = null;

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
    });
    this.tickSystem = new TickSystem(
      this.registry,
      this.valueSystem,
      this.eventBus,
      this.characterSystem,
      this.mutations,
      this.gameNumSystem,
    );
    this.triggerSystem = new TriggerSystem(this.eventBus, this.conditionSystem, this.effectEngine);
    this.lootSystem = new LootSystem(this.registry, this.conditionSystem);
    this.visibilityEngine = new VisibilityEngine(this.registry, this.conditionSystem);
    this.conditionSystem.setTagIndex(tag => this.registry.spotsWithTag(tag));
    // Extra 三层合并视图读取器接线（docs/13 §6）：value data 源 / condition extra 目标 / addExtra 生效值
    this.valueSystem.setExtraReader(path => this.getExtra(path));
    this.conditionSystem.setExtraReader(path => this.getExtra(path));
    this.mutations.setExtraReader(path => this.getExtra(path));
    this.devLog = new DevLog(options.devLog);
    this.storyService = new StoryService({
      registry: this.registry,
      conditionSystem: this.conditionSystem,
      effectEngine: this.effectEngine,
      mutations: this.mutations,
      eventBus: this.eventBus,
      getState: () => this._state,
      travelToArea: (areaId, allowDuringStory) => this.travelToArea(areaId, allowDuringStory),
    });
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
      getVisibility: () => this._visibility,
      refreshVisibility: () => this.refreshVisibility(),
      getResourceAmount: resourceId => this.getResourceAmount(resourceId),
    });

    this._state = this.createDefaultState();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    this._visibility = this.createDefaultVisibility();

    // 在注册表加载后同步子系统
    this.eventBus.onAny((event) => {
      console.debug(`[Event] ${event.type}`, event);
      this.devLog.recordEvent(event, this._state.totalFrames);
    });
  }

  // --- 访问器 ---

  get state(): Readonly<PlayerState> { return this._state; }
  get visibility(): Readonly<VisibilitySnapshot> { return this._visibility; }
  get running(): boolean { return this._running; }
  getDevLogs(): readonly DevLogEntry[] { return this.devLog.getEntries(); }
  clearDevLogs(): void { this.devLog.clear(); }

  /** 重算可见性快照并落盘（服务/门面共用）。 */
  private refreshVisibility(): void {
    this._visibility = this.visibilityEngine.compute(this._state);
  }

  /** [DEBUG] 将每个 Enhancement 的六个条件层级 dump 到 devLog。 */
  dumpEnhancementDebug(): void {
    const all = [...this.registry.enhancements.values()];
    this.devLog.record(`── Enhancement 条件诊断 ── 共 ${all.length} 个`, { source: 'debug', level: 'info' });

    for (const enh of all) {
      const owned = this._state.unlockedEnhancements.includes(enh.id);
      const visible = this._visibility.enhancements[enh.id] ?? false;

      const triggers = enh.revealTriggers;
      // 存在任一该目标的 Trigger 时，需至少一个满足才揭示；否则视为无揭示门槛。
      const metAny = (target: RevealTarget) =>
        !triggers?.some(t => t.reveal === target) ||
        triggers.some(t => t.reveal === target && (!t.condition || this.conditionSystem.evaluateExpr(t.condition, this._state)));
      const exOk = metAny('existence');
      const nameOk = metAny('name');
      const condOk = metAny('condition');
      const utilOk = metAny('utility');
      const unlockOk = unlockMet(enh.revealTriggers, c => this.conditionSystem.evaluateExpr(c, this._state));

      const mark = (ok: boolean) => ok ? '✓' : '✗';

      this.devLog.record(
        `${mark(owned)} ${enh.name}  (${enh.id})`,
        {
          source: 'debug',
          level: owned ? 'success' : visible ? 'info' : 'warning',
          details: [
            `可见性 ${mark(visible)} — ${condLabel(existenceCondition(enh.revealTriggers))}`,
            `存在   ${mark(exOk)} — ${triggerLabel(triggers, 'existence')}`,
            `名称   ${mark(nameOk)} — ${triggerLabel(triggers, 'name')}`,
            `条件   ${mark(condOk)} — ${triggerLabel(triggers, 'condition')}`,
            `效用   ${mark(utilOk)} — ${triggerLabel(triggers, 'utility')}`,
            `解锁   ${mark(unlockOk)} — ${triggerLabel(triggers, 'unlock')}`,
          ].join('<br>'),
        },
      );
    }
    this.devLog.record('── 诊断完成 ──', { source: 'debug', level: 'info' });
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
        inits: { ...this._visibility.inits },
        areas: { ...this._visibility.areas },
        spots: { ...this._visibility.spots },
        enhancements: { ...this._visibility.enhancements },
        items: { ...this._visibility.items },
        stories: { ...this._visibility.stories },
      },
      currentStory: this.storyService.getCurrentStoryView(),
      activeAffectors: this.affectorEngine.getActiveInstances().map(instance => ({
        ...instance,
        activeEntryIds: [...instance.activeEntryIds],
      })),
      stats: this.statsService.getSnapshot(),
    };
  }

  // --- 初始化 ---

  /** 加载数据包并初始化游戏 */
  init(datapacks: Datapack[]): void {
    this.lastTickTimestamp = Date.now();
    // 加载所有数据包
    for (const dp of datapacks) {
      this.registry.load(dp);
      if (dp.affectorPacks) this.affectorEngine.load(dp.affectorPacks);
      if (dp.triggerDefs) this.triggerSystem.load(dp.triggerDefs);
    }

    // 同步子系统
    this.valueSystem.setFuncletDefs(this.registry.funcletDefs as Map<string, import('./types').FuncletDef>);
    this.funcletExecutor.setDefs(this.registry.funcletDefs as Map<string, import('./types').FuncletDef>);
    this.effectEngine.setState(this._state);
    this.tickSystem.setState(this._state);

    // 统一数值注册：构建每个 Resource 的 primitiveGain 树（懒求值）
    this.gameNumSystem.buildAll();

    // 加载角色系统
    this.characterSystem.clear();
    for (const dp of datapacks) {
      if (dp.characters) this.characterSystem.load(dp.characters);
      if (dp.characterBonuses) this.characterSystem.loadBonuses(dp.characterBonuses);
    }

    // 计算可见性
    this._visibility = this.visibilityEngine.compute(this._state);

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
    this._visibility = this.visibilityEngine.compute(this._state);
    this.statsService.recordTick();
    this.devLog.recordTick(result);
    return result;
  }

  /** 发放物品并执行其获得时效果。 */
  giveItem(itemId: ItemId, count: number): boolean {
    const item = this.registry.items.get(itemId);
    if (!item || count <= 0) {
      this.devLog.record(`发放物品失败：${itemId}`, { source: 'inventory', level: 'error' });
      return false;
    }
    this.mutations.addItem(itemId, count, item.maxStack);
    if (item.pickupEffects) this.effectEngine.applyEffects(item.pickupEffects);
    return true;
  }

  /** 使用一个可使用物品。 */
  useItem(itemId: ItemId): UseItemResult {
    const item = this.registry.items.get(itemId);
    if (!item) {
      this.devLog.record(`使用物品失败：${itemId}`, { source: 'inventory', level: 'error', details: 'NotFound' });
      return { success: false, itemId, error: 'NotFound' };
    }
    if (item.type !== 'consumable') {
      this.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotUsable' });
      return { success: false, itemId, error: 'NotUsable' };
    }
    if ((this._state.inventory[itemId] ?? 0) < 1) {
      this.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotOwned' });
      return { success: false, itemId, error: 'NotOwned' };
    }
    if (item.useCondition && !this.conditionSystem.evaluateGroup(item.useCondition, this._state)) {
      this.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'ConditionNotMet' });
      return { success: false, itemId, error: 'ConditionNotMet' };
    }
    if (!this.mutations.removeItem(itemId, 1)) {
      this.devLog.record(`使用物品失败：${item.name}`, { source: 'inventory', level: 'warning', details: 'NotOwned' });
      return { success: false, itemId, error: 'NotOwned' };
    }
    if (item.useEffects) this.effectEngine.applyEffects(item.useEffects);
    return { success: true, itemId };
  }

  /** 执行注册掉落表并将结果发放到背包。 */
  rollDropTable(tableId: string): Map<string, number> {
    const results = this.lootSystem.rollTable(tableId, this._state);
    for (const [itemId, count] of results) this.giveItem(itemId, count);
    return results;
  }

  // --- 生命周期 ---

  /** 开始 Tick 循环 (1 tick/秒) */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastTickTimestamp = Date.now();

    // 计算离线收益
    this.processOfflineProgress();

    this.tickInterval = setInterval(() => {
      this.tick();
      this.effectEngine.setState(this._state);
      this._visibility = this.visibilityEngine.compute(this._state);
      this.eventBus.flush();
    }, TICK_INTERVAL_MS);

    this.devLog.record('自动生产循环已启动', { source: 'runtime', level: 'success' });
  }

  /** 停止 Tick 循环 */
  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.lastTickTimestamp = Date.now();
    this.devLog.record('自动生产循环已暂停', { source: 'runtime', level: 'warning' });
  }

  /** 计算离线收益（上限 8 小时，产出耗尽后提前终止） */
  private processOfflineProgress(): void {
    // 简单实现：离线时间的帧数直接累加
    const offlineMs = Date.now() - this.lastTickTimestamp;
    let offlineFrames = Math.floor(offlineMs / 1000);

    // 上限 8 小时 = 28800 帧，防止陈旧存档一次性补算过多导致卡顿
    const maxOfflineFrames = 8 * 60 * 60;
    if (offlineFrames > maxOfflineFrames) {
      this.devLog.record(`离线时长超过 8 小时，补算截断为 ${maxOfflineFrames} 帧`, {
        source: 'runtime',
        level: 'warning',
        details: 'offline cap',
      });
      offlineFrames = maxOfflineFrames;
    }

    if (offlineFrames > 5) {
      this.devLog.record(`补算 ${offlineFrames} 帧离线进度`, {
        source: 'runtime',
        level: 'info',
        details: 'offline progress',
      });
      for (let i = 0; i < offlineFrames; i++) {
        const result = this.tick();
        // 产出全部耗尽（容量已满）时提前终止
        if (result.productions.length === 0) break;
      }
      this.effectEngine.setState(this._state);
      this._visibility = this.visibilityEngine.compute(this._state);
      this.eventBus.flush();
    }
  }

  // --- Init / Area / Spot 操作 ---

  /** 进入一个 Init */
  enterInit(initId: string): void {
    const init = this.registry.inits.get(initId);
    if (!init) {
      this.devLog.record(`进入世界线失败：${initId}`, { source: 'init', level: 'error', details: 'NotFound' });
      return;
    }

    // 世界线隔离：清理不属于当前 Init 的 Spot 持有状态与 Manager。
    // 不同 Init 之间不共享 Spot 进度；资源、物品、角色、剧情仍全局继承。
    // global Spot（SpotDef.global=true）是跨世界线共享设施，等级/管理角色不随世界线隔离。
    const ownedInThisInit = new Set(this.registry.spotsOfInit(initId));
    for (const spotId of Object.keys(this._state.spotLevels)) {
      if (ownedInThisInit.has(spotId)) continue;
      const spotDef = this.registry.spots.get(spotId);
      if (spotDef?.global) continue;
      delete this._state.spotLevels[spotId];
      delete this._state.spotManagers[spotId];
    }

    this._state.activeInit = initId;
    // first-entry 判定：跨世界线全局记录；进入前判定（先算再记），供下方 Entry 使用
    const visitedInits = this._state.visitedInits ?? [];
    const isFirstEnter = !visitedInits.includes(initId);
    if (isFirstEnter) {
      this._state.visitedInits = [...visitedInits, initId];
    }
    // 开启一次新的游玩：本次 Init 从头到尾的统计从此刻起算（defaultSpots 解锁会计入本次游玩）
    this.statsService.beginSession();
    // 世界线专属 Trigger 先挂载再广播 initEntered，使 on:init 触发器能命中本次进入
    this.mountInitTriggers(initId);
    this.eventBus.emit({ type: 'initEntered', initId });

    // Init 的默认 Area 会在进入时提供其默认 Spot，并定位到第一个 Area。
    if (init.defaultAreas.length > 0) {
      this._state.currentAreaId = init.defaultAreas[0];
      // 记录起始 Area 为已访问
      const first = init.defaultAreas[0];
      const visited = this._state.visitedAreas ?? [];
      if (!visited.includes(first)) {
        this._state.visitedAreas = [...visited, first];
      }
    } else {
      this._state.currentAreaId = undefined;
    }
    const newlyUnlockedSpots: string[] = [];
    for (const areaId of init.defaultAreas) {
      const area = this.registry.areas.get(areaId);
      if (!area) continue;
      for (const spotId of area.defaultSpots) {
        if ((this._state.spotLevels[spotId] ?? 0) > 0) continue;
        this.mutations.setSpotLevel(spotId, 1);
        const spot = this.registry.spots.get(spotId);
        newlyUnlockedSpots.push(spot?.name ?? spotId);
      }
    }

    // 自动展开起始剧情（InitStory）：进入 Init 时直接开始，无需玩家手动启动。
    if (init.startStoryId && !this.storyService.hasCompletedStory(init.startStoryId)) {
      this.storyService.startStory(init.startStoryId, 'active');
    }

    // 执行进入条目（支持首次/条件进入）
    this.applyEntryEffects(init.enterEffects, isFirstEnter);

    this._visibility = this.visibilityEngine.compute(this._state);
    this.devLog.record(`进入 ${init.name}：解锁内容`, {
      source: 'init',
      level: 'info',
      details: [
        `定位 ${init.defaultAreas.length} 个起始区域`,
        newlyUnlockedSpots.length > 0
          ? `新解锁设施：${newlyUnlockedSpots.join('、')}`
          : '无新解锁设施',
        init.startStoryId ? '自动展开起始剧情' : undefined,
        isFirstEnter ? '首次进入' : undefined,
        init.enterEffects ? `进入条目 ${init.enterEffects.length} 项` : undefined,
      ].filter(Boolean).join(' · '),
    });
  }

  /**
   * 执行进入条目：按声明顺序逐个评估 first / condition，满足则应用其 effects。
   * @param defs 进入条目列表（缺省 = 无操作）
   * @param isFirstEnter 本次进入是否为该实体的首次进入（由调用方在标记 visited 前计算）
   */
  private applyEntryEffects(defs: EntryEffectDef[] | undefined, isFirstEnter: boolean): void {
    if (!defs) return;
    for (const def of defs) {
      if (def.first && !isFirstEnter) continue;
      if (def.condition && !this.conditionSystem.evaluateExpr(def.condition, this._state)) continue;
      this.effectEngine.applyEffects(def.effects);
    }
  }

  /**
   * 在当前世界线内移动到相邻 Area。
   * 规则：目标必须存在、属于当前 Init、且与当前位置相邻（或当前位置为空时任意可达）。
   */
  /**
   * 移动到相邻 Area（玩家入口）——可达性层。
   * 门槛链：存在 → 同 Init → 非演出锁定 → 相邻 → 可见。
   * 非 passive 剧情演出进行中时禁止移动（防止演出背景被切换）；该限制对
   * Story 自身要求移动（travelToArea effect）放开。
   */
  travelToArea(areaId: AreaId, allowDuringStory = false): TravelResult {
    const area = this.registry.areas.get(areaId);
    if (!area) {
      this.devLog.record(`移动失败：${areaId}`, { source: 'area', level: 'error', details: 'NotFound' });
      return { success: false, areaId, error: 'NotFound' };
    }
    if (area.initId !== this._state.activeInit) {
      this.devLog.record(`移动失败：${area.name} 不属于当前世界线`, { source: 'area', level: 'warning', details: 'NotInThisInit' });
      return { success: false, areaId, error: 'NotInThisInit' };
    }

    // 演出锁定：非 passive 剧情演出期间禁止玩家移动（Story 主动要求移动时放行）
    if (!allowDuringStory && this.storyService.isBlockingMovement()) {
      this.devLog.record(`移动失败：${area.name} 剧情演出中禁止移动`, {
        source: 'area',
        level: 'warning',
        details: 'StoryBlocked',
      });
      return { success: false, areaId, error: 'StoryBlocked' };
    }

    const fromAreaId = this._state.currentAreaId ?? null;
    if (fromAreaId === areaId) {
      return { success: false, areaId, error: 'AlreadyThere' };
    }
    // 移动严格按当前 Area 的可达性：目标必须与当前位置相邻。
    if (fromAreaId !== null) {
      const fromArea = this.registry.areas.get(fromAreaId);
      const adjacent = fromArea?.adjacentAreaIds ?? [];
      if (!adjacent.includes(areaId)) {
        this.devLog.record(`移动失败：${area.name} 与当前位置不相邻`, { source: 'area', level: 'warning', details: 'NotAdjacent' });
        return { success: false, areaId, error: 'NotAdjacent' };
      }
    }
    // 目标 Area 必须可见（existence 门槛满足）才可进入
    if (!this.visibilityEngine.isAreaVisible(areaId, this._state)) {
      this.devLog.record(`移动失败：${area.name} 尚未开放`, { source: 'area', level: 'warning', details: 'Locked' });
      return { success: false, areaId, error: 'Locked' };
    }

    // 移动出 Area 时强制打断正在播放的 PassiveStory
    this.storyService.clearPassiveIfPlaying();

    this._state.currentAreaId = areaId;
    // first-entry 判定：进入前计算，供下方 Entry 使用（首次判定基于标记前状态）
    const visitedAreas = this._state.visitedAreas ?? [];
    const isFirstEnter = !visitedAreas.includes(areaId);
    // 记录已访问区域（供信息展示使用，不改变移动规则）
    if (!visitedAreas.includes(areaId)) {
      this._state.visitedAreas = [...visitedAreas, areaId];
    }
    // 进入该 Area 时赠送其 defaultSpots（未拥有则解锁）
    for (const spotId of area.defaultSpots ?? []) {
      if ((this._state.spotLevels[spotId] ?? 0) > 0) continue;
      this.mutations.setSpotLevel(spotId, 1);
    }
    this.statsService.recordAreaEntered(areaId);
    this.eventBus.emit({ type: 'areaEntered', areaId, fromAreaId });
    // 执行进入条目（支持首次/条件进入）
    this.applyEntryEffects(area.enterEffects, isFirstEnter);
    this._visibility = this.visibilityEngine.compute(this._state);
    // Affector 贯穿 Area：切换区域后按新区域的 condition 重估生效范围
    this.affectorEngine.recheckAll();
    this.devLog.record(`已移动到 ${area.name}`, { source: 'area', level: 'success' });
    return { success: true, areaId, fromAreaId };
  }

  /**
   * 购买并激活一个 Enhancement（可达性层）。
   * 前置校验：存在 → 可见 → 解锁条件满足 → 资源充足 → 未重复获得。
   */
  purchaseEnhancement(enhancementId: EnhancementId): EnhancementPurchaseResult {
    const enh = this.registry.enhancements.get(enhancementId);
    if (!enh) {
      this.devLog.record(`获取强化失败：${enhancementId}`, { source: 'enhancement', level: 'error', details: 'NotFound' });
      return { success: false, enhancementId, error: 'NotFound' };
    }
    if (this._state.unlockedEnhancements.includes(enhancementId)) {
      this.devLog.record(`${enh.name} 已获得`, { source: 'enhancement', level: 'warning', details: 'AlreadyOwned' });
      return { success: false, enhancementId, error: 'AlreadyOwned' };
    }
    if (!this._visibility.enhancements[enhancementId]) {
      this.devLog.record(`无法获取 ${enh.name}：尚未可见`, { source: 'enhancement', level: 'warning', details: 'NotVisible' });
      return { success: false, enhancementId, error: 'NotVisible' };
    }
    if (!unlockMet(enh.revealTriggers, c => this.conditionSystem.evaluateExpr(c, this._state))) {
      this.devLog.record(`无法获取 ${enh.name}：解锁条件未满足`, { source: 'enhancement', level: 'warning', details: 'ConditionNotMet' });
      return { success: false, enhancementId, error: 'ConditionNotMet' };
    }
    for (const cost of enh.price ?? []) {
      if (this.getResourceAmount(cost.resourceId) < cost.amount) {
        this.devLog.record(`无法获取 ${enh.name}：资源不足`, { source: 'enhancement', level: 'warning', details: 'InsufficientResource' });
        return { success: false, enhancementId, error: 'InsufficientResource' };
      }
    }
    for (const cost of enh.price ?? []) {
      this.mutations.changeResource(cost.resourceId, -cost.amount);
    }
    this.mutations.addEnhancement(enhancementId);
    if (enh.autoApply && enh.effects.length > 0) {
      this.effectEngine.applyEffects(enh.effects);
    }
    this._visibility = this.visibilityEngine.compute(this._state);
    this.devLog.record(`已获得强化：${enh.name}`, {
      source: 'enhancement',
      level: 'success',
      details: enh.price && enh.price.length > 0
        ? `消耗 ${enh.price.map(c => `${c.amount} ${c.resourceId}`).join(', ')}`
        : undefined,
    });
    return { success: true, enhancementId };
  }

  // --- Story flow（剧情游标与流程已拆至 game/story-service.ts，此处仅门面委托） ---

  startActiveStory(storyId: string): StoryStartResult {
    return this.storyService.startActiveStory(storyId);
  }

  /**
   * 启动一个剧情（active 或 passive）。ActiveStory 可打断正在播放的 PassiveStory。
   * 进入 Init 自动展开 startStoryId 时由内部复用；测试亦依赖此入口。
   */
  startStory(storyId: string, expectedType: 'active' | 'passive'): StoryStartResult {
    return this.storyService.startStory(storyId, expectedType);
  }

  /** Pick one eligible passive story from the current Init by weight. */
  triggerPassiveStory(initId?: string): StoryStartResult {
    return this.storyService.triggerPassiveStory(initId);
  }

  advanceStory(choiceIndex?: number): StoryAdvanceResult {
    return this.storyService.advanceStory(choiceIndex);
  }

  /**
   * 查询底部"回复按钮"的当前状态。
   * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
   */
  getSendState(): SendState {
    return this.storyService.getSendState();
  }

  /**
   * 玩家点击一次回复按钮。
   * - 剧情演出中：直接推进一页（advanceStory），并执行当前页效果
   * - 无剧情：尝试按当前场景随机抽取并开始一条 PassiveTalk
   */
  clickSend(): SendResult {
    return this.storyService.clickSend();
  }

  /** 解锁一个 Init */
  unlockInit(initId: string): void {
    if (this._state.unlockedInits.includes(initId)) return;
    this.mutations.unlockInit(initId);
  }

  /** 盘点所有世界线的可及性（解锁 + 可见），用于日志审计。 */
  private logInitReachability(title: string): void {
    const rows = [...this.registry.inits.values()].map(init => {
      const unlocked = this._state.unlockedInits.includes(init.id);
      const visible = this._visibility.inits[init.id] ?? false;
      return `${init.name}${unlocked ? '·已解锁' : '·未解锁'}${visible ? '' : '·不可见'}`;
    });
    this.devLog.record(title, {
      source: 'init',
      level: 'info',
      details: rows.join(' | '),
    });
  }

  /**
   * 挂载当前世界线的专属 Trigger；若之前挂载了其它世界线的组则先移除。
   * 重复进入同一世界线（幂等）不重复挂载。
   */
  private mountInitTriggers(initId: string): void {
    const group = `init:${initId}`;
    if (this.mountedInitTriggerGroup === group) return;
    if (this.mountedInitTriggerGroup) this.triggerSystem.unmountGroup(this.mountedInitTriggerGroup);
    const init = this.registry.inits.get(initId);
    for (const trigger of init?.triggers ?? []) this.triggerSystem.mount(trigger, group);
    this.mountedInitTriggerGroup = group;
  }

  /** 开启新游戏并进入指定世界线，返回是否成功。 */
  startNewGame(initId: string): boolean {
    const init = this.registry.inits.get(initId);
    if (!init) return false;

    // 收费 Init 必须已购买过（unlockedInits 中有记录）
    const cost = init.purchaseCost ?? [];
    const isFree = cost.length === 0;
    if (!isFree && !this._state.unlockedInits.includes(initId)) {
      this.devLog.record(`无法开始世界线：${init.name}（尚未购买）`, {
        source: 'init',
        level: 'warning',
        details: cost.map(c => `${c.amount} ${c.resourceId}`).join('、'),
      });
      return false;
    }

    this.stop();
    const savedUnlockedInits = [...this._state.unlockedInits];
    const savedGlobalResources = { ...(this._state.globalResources ?? {}) };
    const savedGlobalSpotLevels = globalSpotEntries(this.registry, this._state.spotLevels);
    const savedGlobalSpotManagers = globalSpotEntries(this.registry, this._state.spotManagers);
    this._state = this.createDefaultState();
    this._state.unlockedInits = savedUnlockedInits; // 跨档保留购买记录
    this._state.globalResources = savedGlobalResources; // 跨世界线保留全局资源（青辉石等）
    this._state.spotLevels = savedGlobalSpotLevels; // 跨世界线保留 global Spot 进度
    this._state.spotManagers = savedGlobalSpotManagers;
    // Extra 底座注入（docs/13 §5.3）：全局层 = 数据包常量表深拷贝；per-Init 层 = 当前 Init 的 InitDef.extra
    this._state.extras = mergeExtra(extra.dict({}), this.registry.extras);
    this._state.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({}));
    this.lastTickTimestamp = Date.now();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.statsService.reset();
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    this._visibility = this.createDefaultVisibility();
    this.storyService.clearCurrentStory();
    this.devLog.clear();

    // 免费 Init 首次进入时自动解锁
    if (isFree) this.unlockInit(initId);
    this.enterInit(initId);
    this.logInitReachability('世界线可及性：新建世界');
    this.devLog.record(`新的开始：${init.name}`, { source: 'init', level: 'success' });
    return true;
  }

  // ================================================================
  //   Init 切换辅助
  // ================================================================

  /**
   * 以 InitDef.extra 为底座重建当前 Init 的 per-Init extras。
   * 无快照的首次进入（startNewGame / resumeInit 无快照分支 / hardRestartInit 后）时调用。
   * 见 docs/13 §5.3。
   */
  private seedPerInitExtras(init: InitDef): void {
    this._state.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({}));
  }

  /** 将当前 PlayerState 中的 Init 局部字段保存到快照（global Spot 属于全局层，不写入快照）。 */
  private savePerInitSnapshot(initId: string): void {
    if (!this._state.initSnapshots) this._state.initSnapshots = {};
    this._state.initSnapshots[initId] = {
      resources: { ...this._state.resources },
      spotLevels: localSpotEntries(this.registry, this._state.spotLevels),
      spotManagers: localSpotEntries(this.registry, this._state.spotManagers),
      visitedAreas: this._state.visitedAreas ? [...this._state.visitedAreas] : [],
      storyCooldowns: this._state.storyCooldowns ? { ...this._state.storyCooldowns } : {},
      totalFrames: this._state.totalFrames,
      inventory: { ...this._state.inventory },
      unlockedEnhancements: [...this._state.unlockedEnhancements],
      storyLog: [...this._state.storyLog],
      flags: { ...this._state.flags },
      triggersCompleted: this._state.triggersCompleted ? [...this._state.triggersCompleted] : [],
      currentAreaId: this._state.currentAreaId,
      extras: this._state.initExtras ? mergeExtra(extra.dict({}), this._state.initExtras) : undefined,
    };
  }

  /** 将 PlayerState 的 Init 局部字段重置为新鲜值（global Spot 属于全局层，跨世界线保留）。 */
  private clearPerInitState(): void {
    const fresh = freshPerInitState();
    this._state.resources = fresh.resources;
    this._state.spotLevels = globalSpotEntries(this.registry, this._state.spotLevels);
    this._state.spotManagers = globalSpotEntries(this.registry, this._state.spotManagers);
    this._state.visitedAreas = fresh.visitedAreas;
    this._state.storyCooldowns = fresh.storyCooldowns;
    this._state.totalFrames = fresh.totalFrames;
    this._state.inventory = fresh.inventory;
    this._state.unlockedEnhancements = fresh.unlockedEnhancements;
    this._state.storyLog = fresh.storyLog;
    this._state.flags = fresh.flags;
    this._state.triggersCompleted = fresh.triggersCompleted;
    this._state.currentAreaId = fresh.currentAreaId;
    this._state.initExtras = fresh.initExtras;
    this._state.activeInit = '';
  }

  /** 将快照中的 Init 局部字段恢复到 PlayerState（global Spot 以全局层当前值为准，快照仅恢复普通 Spot）。 */
  private restorePerInitFromSnapshot(snapshot: InitSnapshot): void {
    this._state.resources = snapshot.resources;
    this._state.spotLevels = { ...globalSpotEntries(this.registry, this._state.spotLevels), ...localSpotEntries(this.registry, snapshot.spotLevels ?? {}) };
    this._state.spotManagers = { ...globalSpotEntries(this.registry, this._state.spotManagers), ...localSpotEntries(this.registry, snapshot.spotManagers ?? {}) };
    this._state.visitedAreas = snapshot.visitedAreas;
    this._state.storyCooldowns = snapshot.storyCooldowns;
    this._state.totalFrames = snapshot.totalFrames;
    this._state.inventory = snapshot.inventory;
    this._state.unlockedEnhancements = snapshot.unlockedEnhancements;
    this._state.storyLog = snapshot.storyLog;
    this._state.flags = snapshot.flags;
    this._state.triggersCompleted = snapshot.triggersCompleted;
    this._state.currentAreaId = snapshot.currentAreaId;
    this._state.initExtras = snapshot.extras ? mergeExtra(extra.dict({}), snapshot.extras) : extra.dict({});
  }

  /** 重置依赖 Init 局部数据的运行时子系统（不碰 PlayerState）。 */
  private resetPerInitSubsystems(): void {
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    if (this.mountedInitTriggerGroup) {
      this.triggerSystem.unmountGroup(this.mountedInitTriggerGroup);
    }
    this.mountedInitTriggerGroup = null;
    this._visibility.spots = {};
    this._visibility.areas = {};
    this.storyService.clearCurrentStory();
    this.devLog.clear();
  }

  // ================================================================
  //   三种重启路径
  // ================================================================

  /**
   * 软重启：结束当前 Init 的运行，保存全量快照，回到世界线选择。
   *
   * - 保存当前 Init **全部** per-Init 状态到 initSnapshots
   * - 清除 PlayerState 上所有 per-Init 字段
   * - **保留** unlockedInits、stats（global + init 层）
   */

  /**
   * 购买一个未解锁的世界线（Init）。
   * - 免费 Init（无 purchaseCost）直接解锁并返回成功。
   * - 已购买过的 Init 也直接返回成功（可安全重复调用）。
   * - 资源检查：遍历 purchaseCost，任一项不足即拒绝。
   * - 扣费成功后写入 unlockedInits（由 StateMutationService 做持久化 + 事件），
   *   因此一次购买可对后续所有 resumerInit / startNewGame 生效。
   */
  /** 读取资源持有量：全局资源 + 当前世界线局部资源（局部优先覆盖同名）。 */
  private getResourceAmount(resourceId: string): number {
    return ((this._state.globalResources ?? {})[resourceId] ?? 0) + (this._state.resources[resourceId] ?? 0);
  }

  purchaseInit(initId: string): InitPurchaseResult {
    const init = this.registry.inits.get(initId);
    if (!init) return { success: false, initId, error: 'NotFound' };

    // 已解锁 → 无需再次购买
    if (this._state.unlockedInits.includes(initId)) return { success: true, initId };

    // 免费 → 直接解锁
    const cost: ResourceAmount[] = init.purchaseCost ?? [];
    if (cost.length === 0) {
      this.unlockInit(initId);
      return { success: true, initId };
    }

    // 资源检查（全局 + 世界线局部合并视图，Global 资源可跨世界线消费）
    for (const c of cost) {
      if (this.getResourceAmount(c.resourceId) < c.amount) {
        return { success: false, initId, error: 'InsufficientResource' };
      }
    }

    // 扣费（changeResource 自动路由：Global → globalResources）
    for (const c of cost) {
      this.mutations.changeResource(c.resourceId, -c.amount);
    }

    // 解锁
    this.unlockInit(initId);

    this.devLog.record(`已解锁世界线：${init.name}`, {
      source: 'init',
      level: 'success',
      details: cost.map(c => `-${c.amount} ${c.resourceId}`).join('、'),
    });

    return { success: true, initId };
  }

  /**
   * - **保留** unlockedInits、stats（global + init 层）
   */
  restartInit(): void {
    const initId = this._state.activeInit;
    if (initId) this.savePerInitSnapshot(initId);

    this.stop();
    this.clearPerInitState();
    this.resetPerInitSubsystems();

    this.devLog.record('当前游戏已结束，等待重新选择世界线', { source: 'runtime', level: 'warning' });
  }

  /**
   * 软重启 / 新游戏 之后进入一个 Init：
   * - 有快照 → 恢复全部 per-Init 进度（断点续玩）
   * - 无快照 → 新鲜开始（所有 per-Init 字段为零）
   *
   * unlockedInits 与 stats 不受影响（前者由 PlayerState 维护，后者由 StatsService 维护）。
   */
  resumeInit(initId: string): boolean {
    const init = this.registry.inits.get(initId);
    if (!init) {
      this.devLog.record(`恢复世界线失败：${initId}`, { source: 'init', level: 'error', details: 'NotFound' });
      return false;
    }

    const snapshots = this._state.initSnapshots ?? {};
    const snapshot = snapshots[initId];

    if (snapshot) {
      this.restorePerInitFromSnapshot(snapshot);
      this.devLog.record(`回到世界线：${init.name}（恢复进度）`, { source: 'init', level: 'success' });
    } else {
      this.clearPerInitState();
      this.seedPerInitExtras(init);
      this.devLog.record(`进入世界线：${init.name}`, { source: 'init', level: 'success' });
    }

    // 同步子系统（仅标记新 session，不重置 stats）
    this.lastTickTimestamp = Date.now();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.statsService.beginSession();
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);

    this.unlockInit(initId);
    this.enterInit(initId);
    this.logInitReachability('世界线可及性：切换世界');

    return true;
  }

  /**
   * 硬重启：结束当前 Init 并**删除其快照**，清除所有 per-Init 数据。
   *
   * 与 restartInit 的关键区别：
   * - restartInit     → 保存快照，可断点续玩
   * - hardRestartInit → 删除快照，下次进入该 Init 全新开始
   *
   * unlockedInits 与 stats 仍保留。
   */
  hardRestartInit(): void {
    const initId = this._state.activeInit;
    if (initId && this._state.initSnapshots) {
      delete this._state.initSnapshots[initId];
    }

    this.stop();
    this.clearPerInitState();
    // 硬重启：删除快照后重建 per-Init extras（InitDef.extra 重新注入；全局 extras 保留）
    const init = initId ? this.registry.inits.get(initId) : undefined;
    if (init) this.seedPerInitExtras(init);
    this.resetPerInitSubsystems();

    this.devLog.record(
      initId
        ? `已彻底重置世界线 ${initId} 的当前 Run，下次进入为崭新状态`
        : '当前 Run 已彻底重置，等待重新选择世界线',
      { source: 'init', level: 'warning' },
    );
  }

  /**
   * 从 Init 选择页彻底重置某个 Init（删除其快照）。
   * 不影响当前运行中的 Init（如当前正在该 Init 中，快照删除后下次重进即为全新）。
   */
  hardResetInit(initId: string): void {
    if (this._state.initSnapshots) delete this._state.initSnapshots[initId];
    this.devLog.record(`已彻底重置世界线快照：${initId}`, { source: 'init', level: 'warning' });
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
    const removed = this.mutations.removeEnhancement(enhancementId);
    if (removed) {
      this.refreshVisibility();
      this.affectorEngine.recheckAll();
      this.devLog.record(`已移除强化：${enhancementId}`, { source: 'enhancement', level: 'info' });
    }
    return removed;
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
      visibility: JSON.parse(JSON.stringify(this._visibility)),
      pendingStoryId: storyCursor.currentStoryId,
      pendingStoryPageIndex: storyCursor.currentStoryPageIndex,
      pendingStoryChoiceIndex: storyCursor.currentStoryChoiceIndex,
      pendingTalkletClicks: storyCursor.talkletClickWork,
      stats: this.statsService.getPersistable(),
    };
  }

  /** 从存档数据恢复 */
  load(saveData: SaveData): void {
    this._state = JSON.parse(JSON.stringify(saveData.playerState));
    this._state.storyCooldowns ??= {};
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
    this.mountInitTriggers(this._state.activeInit);
    this._visibility = JSON.parse(JSON.stringify(saveData.visibility));
    if (saveData.stats) this.statsService.restore(saveData.stats);
    else this.statsService.beginSession();
    this.storyService.restoreCursor({
      currentStoryId: saveData.pendingStoryId,
      currentStoryPageIndex: saveData.pendingStoryPageIndex,
      currentStoryChoiceIndex: saveData.pendingStoryChoiceIndex ?? -1,
      talkletClickWork: saveData.pendingTalkletClicks ? { ...saveData.pendingTalkletClicks } : null,
    });
    this.lastTickTimestamp = saveData.timestamp;

    // 重新同步子系统
    this.effectEngine.setState(this._state);
    this.tickSystem.setState(this._state);

    const init = this.registry.inits.get(this._state.activeInit);
    this.logInitReachability('世界线可及性：读取存档');
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
    this.lastTickTimestamp = Date.now();
    this.mutations.setState(this._state);
    this.statsService.setState(this._state);
    this.statsService.reset();
    this.affectorEngine.setState(this._state);
    this.triggerSystem.setState(this._state);
    // 移除已挂载的世界线专属 Trigger
    if (this.mountedInitTriggerGroup) this.triggerSystem.unmountGroup(this.mountedInitTriggerGroup);
    this.mountedInitTriggerGroup = null;
    this._visibility = this.createDefaultVisibility();
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
      storyCooldowns: {},
      initSnapshots: {},
      extras: extra.dict({}),
      initExtras: extra.dict({}),
    };
  }

  private createDefaultVisibility(): VisibilitySnapshot {
    return {
      inits: {},
      areas: {},
      spots: {},
      enhancements: {},
      items: {},
      stories: {},
    };
  }
}
