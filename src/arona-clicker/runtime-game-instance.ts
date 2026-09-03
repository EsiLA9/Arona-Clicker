import type { Datapack } from '../data-services/contracts/datapack';
// ============================================================
// arona-clicker/runtime-game-instance.ts — AronaClicker Runtime（组合根 + 门面）
//
// 子系统装配细节在 runtime-wiring.ts（构造器只保留 wire 调用与私有钩子）；
// story / spot / init / item / enhancement / charaProfile / pic 门面
// 以只读别名直接暴露对应服务（game.story.* 等），编排类方法
// （init / tick / travelToArea / 存档 / Extra）保留在本体。
// ============================================================

import {
  AreaId,
  ExtraCompound,
  ExtraPath,
  ExtraValue,
} from '../engine/types';
import type { VisibilitySnapshot } from '../engine/contracts/reveal';
import type { PlayerState } from './types/state';
import type { GameView, StoryView } from './contracts';
import type { TickResult } from '../engine/contracts/tick';
import type { TravelResult } from './contracts/results';
import { StoryService } from './services/story-service';
import { SpotService } from './services/spot-service';
import { InitService } from './services/init-service';
import { ItemService } from './services/item-service';
import { EnhancementService } from './services/enhancement-service';
import { SessionService } from '../engine/runtime/session-service';
import { ChatFlowService } from './services/chat-flow-service';
import { buildGameView } from './read-model/game-view-builder';
import { createDefaultState as createDefaultPlayerState } from './state/state-factory';
import { buildSaveData } from './runtime-save-codec';
import { restoreFromSave } from './runtime-save';
import { recheckStudentBlocks as recheckBlocks, reloadRuntime, resetRuntime } from './runtime-reset';
import { wireGameInstance } from './runtime-wiring';

import { extra, getAtPath, mergeExtra, setAtPath } from '../engine/extra/index';
import { ImageStore } from '../data-services/assets/image-store';
import { hasExistenceGate } from '../engine/visibility/reveal';
import { Registry } from '../data-services/registry/registry';
import type { WorldCatalogQueryPort } from './contracts/world-catalog';
import { EventBus } from '../engine/core/event-bus';
import { ValueSystem } from '../engine/expression/value-system';
import { ConditionSystem } from '../engine/expression/condition-system';
import { FuncletExecutor } from '../engine/expression/funclet-executor';
import { EffectEngine } from '../engine/effect/effect-engine';
import { TickSystem } from '../engine/system/tick-system';
import { LootSystem } from './services/loot-system';
import { VisibilityEngine } from '../engine/visibility/visibility-engine';
import { StateMutationService } from './state/state-mutation-service';
import { AffectorEngine } from '../engine/effect/affector-engine';
import { DevLog, DevLogEntry, DevLogOptions } from '../engine/core/dev-log';
import { StatsService } from '../engine/stats/stats';
import { SpotFunctionalitySystem } from './services/spot-functionality';
import { GameNumSystem } from '../engine/expression/game-num';
import { TriggerSystem } from '../engine/effect/trigger-system';

import { CharacterSystem } from './services/character-system';
import { RosterSystem } from './services/roster-system';
import { CharacterAvailabilityService } from './services/character-availability';
import { ColorSystem } from './services/color-system';
import { ColorEquipmentSystem } from './services/color-equipment-system';
import { GachaService } from './services/gacha-service';
import { TagStatService } from '../engine/stats/tag-stats';
import { PassivePoolSystem } from './services/passive-pool-system';
import { CharaProfileService } from './services/chara-profile-service';
import { PicService } from '../data-services/assets/pic-service';
import { UserThemeService } from './services/user-theme-service';

import type { SaveData } from './contracts/save-data';
import type { SaveBuildContext } from './contracts/save-codec';
import type { GameInstanceOptions } from './runtime-options';
export type { SaveData };

/**
 * GameInstance 是游戏的核心运行时管理器。
 * 它组装所有引擎子系统并暴露统一的 API 给 UI 层。
 */
export class GameInstance {
  // 子系统（构造期由 game/wiring.ts 装配赋值）
  readonly eventBus!: EventBus;
  readonly registry!: Registry;
  get world(): WorldCatalogQueryPort { return this.registry; }
  readonly valueSystem!: ValueSystem;
  readonly conditionSystem!: ConditionSystem;
  readonly funcletExecutor!: FuncletExecutor;
  readonly effectEngine!: EffectEngine;
  readonly tickSystem!: TickSystem;
  readonly lootSystem!: LootSystem;
  readonly visibilityEngine!: VisibilityEngine;
  readonly characterSystem!: CharacterSystem;
  readonly rosterSystem!: RosterSystem;
  readonly availabilityService!: CharacterAvailabilityService;
  readonly colorSystem!: ColorSystem;
  readonly colorEquipmentSystem!: ColorEquipmentSystem;
  readonly gachaService!: GachaService;
  readonly tagStatService!: TagStatService;
  readonly passivePoolSystem!: PassivePoolSystem;
  readonly mutations!: StateMutationService;
  readonly affectorEngine!: AffectorEngine;
  readonly devLog!: DevLog;
  readonly statsService!: StatsService;
  readonly spotFunctionalitySystem!: SpotFunctionalitySystem;
  readonly gameNumSystem!: GameNumSystem;
  readonly triggerSystem!: TriggerSystem;
  readonly storyService!: StoryService;
  readonly spotService!: SpotService;
  readonly initService!: InitService;
  readonly itemService!: ItemService;
  readonly enhancementService!: EnhancementService;
  readonly sessionService!: SessionService;
  /** 聊天流演出服务（Talklet 专用）：clearAllChatFlow / showChatText / clearIdChatFlow 的运行时桥。 */
  readonly chatFlowService!: ChatFlowService;
  /** 图片存储：Mod 压缩包解出的本地图片（UI 导入流程填充；见 pics.urlOf）。 */
  readonly imageStore!: ImageStore;
  /** Chara 头像-人名对服务（game.charaProfiles 门面）。 */
  readonly charaProfileService!: CharaProfileService;
  /** 图片资产服务（game.pics 门面）。 */
  readonly picService!: PicService;
  readonly userThemeService!: UserThemeService;

  // 运行时状态
  private _state!: PlayerState;

  private readonly saveCodec: (ctx: SaveBuildContext) => SaveData;

  constructor(options: GameInstanceOptions = {}) {
    this.saveCodec = options.saveCodec ?? buildSaveData;
    (options.wiring ?? wireGameInstance)(this, {
      getState: () => this._state,
      setState: next => { this._state = next; },
      refreshVisibility: () => this.refreshVisibility(),
    }, options);
  }

  // --- 访问器 ---

  get state(): Readonly<PlayerState> { return this._state; }
  get visibility(): Readonly<VisibilitySnapshot> { return this.visibilityEngine.getVisibility(this._state); }
  get running(): boolean { return this.sessionService.running; }

  /** 剧情门面：story flow 统一入口（startStory / advanceStory / clickSend 等）。 */
  get story(): StoryService { return this.storyService; }
  /** 设施门面：升级 / 经理 / 产出 / tag 增撤。 */
  get spot(): SpotService { return this.spotService; }
  /** 世界线门面：进入 / 购买 / 三种重启路径。 */
  get inits(): InitService { return this.initService; }
  /** 物品门面：发放 / 使用 / 掉落表。 */
  get items(): ItemService { return this.itemService; }
  /** 强化门面：购买 / 移除 / 诊断。 */
  get enhancements(): EnhancementService { return this.enhancementService; }
  /** Chara 头像-人名对门面。 */
  get charaProfiles(): CharaProfileService { return this.charaProfileService; }
  /** 图片资产门面。 */
  get pics(): PicService { return this.picService; }

  getDevLogs(): readonly DevLogEntry[] { return this.devLog.getEntries(); }
  clearDevLogs(): void { this.devLog.clear(); }

  /** 强制重算可见性快照（服务/门面共用）。 */
  private refreshVisibility(): void {
    this.visibilityEngine.recomputeAll(this._state);
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
    this.valueSystem.setFuncletDefs(this.registry.funcletDefs as Map<string, import('../engine/types').FuncletDef>);
    this.funcletExecutor.setDefs(this.registry.funcletDefs as Map<string, import('../engine/types').FuncletDef>);
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
      this.initService.enterInit(defaultInit.id);
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
    // 产出求值走事件驱动精确失效（Phase 5）：mutation 写路径经事件定向 markDirty，
    // 未受影响的 gain 子树跨帧保持缓存。直接改 state 的调用方须走 StateMutationService。
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

  // --- 生命周期 ---

  /** 开始 Tick 循环 (1 tick/秒)。 */
  start(): void {
    this.sessionService.start();
  }

  /** 停止 Tick 循环 */
  stop(): void {
    this.sessionService.stop();
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
    // visibility 是派生数据：生成存档时按当前 Registry/State 重算，避免旧快照
    // 缺少新增的 Init 或 GlobalEnh 条目而在下次读档时被误判为不可见。
    this.refreshVisibility();
    return this.saveCodec({
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
