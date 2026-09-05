// ============================================================
// arona-clicker/runtime-wiring.ts — AronaClicker 领域组合根装配
//
// 引擎机制与产品领域服务在此完成组合。
// ============================================================

import type { GameInstance } from './runtime-game-instance';
import type { PlayerState } from './types/state';
import type { TagStatKind } from '../engine/stats/tag-stats';
import { Registry } from '../data-services/registry/registry';
import { EventBus } from '../engine/core/event-bus';
import { DevLog, DevLogOptions } from '../engine/core/dev-log';
import { ValueSystem } from '../engine/expression/value-system';
import { ConditionSystem } from '../engine/expression/condition-system';
import { FuncletExecutor } from '../engine/expression/funclet-executor';
import { GameNumSystem } from '../engine/expression/game-num';
import { EffectEngine } from '../engine/effect/effect-engine';
import { AffectorEngine } from '../engine/effect/affector-engine';
import { TriggerSystem } from '../engine/effect/trigger-system';
import { RuntimeEffectReactor } from './services/runtime-effect-reactor';
import { TickSystem } from '../engine/system/tick-system';
import { LootSystem } from './services/loot-system';
import { StateMutationService } from './state/state-mutation-service';
import { SpotFunctionalitySystem } from './services/spot-functionality';
import { CharacterSystem } from './services/character-system';
import { RosterSystem } from './services/roster-system';
import { CharacterAvailabilityService } from './services/character-availability';
import { ColorSystem } from './services/color-system';
import { ColorEquipmentSystem } from './services/color-equipment-system';
import { GachaService } from './services/gacha-service';
import { PassivePoolSystem } from './services/passive-pool-system';
import { ColorUnlockReactor } from './services/color-unlock-reactor';
import { CharaProfileService } from './services/chara-profile-service';
import { PicService } from '../data-services/assets/pic-service';
import { VisibilityEngine } from '../engine/visibility/visibility-engine';
import { StatsService } from '../engine/stats/stats';
import { TagStatService } from '../engine/stats/tag-stats';
import { ImageStore } from '../data-services/assets/image-store';
import { StoryService } from './services/story-service';
import { SpotService } from './services/spot-service';
import { InitService } from './services/init-service';
import { ItemService } from './services/item-service';
import { EnhancementService } from './services/enhancement-service';
import { UserThemeService } from './services/user-theme-service';
import { qualifyTagPath } from '../engine/core/tag';
import { SessionService } from '../engine/runtime/session-service';
import { ChatFlowService } from './services/chat-flow-service';
import { createDefaultState as createDefaultPlayerState } from './state/state-factory';
import { applyAffectionExp, affectionLevelCapOf, resolveAffectionConfig } from './services/affection-system';
import { applyExp, checkBreakthrough, resolveCurve } from './services/cultivate-system';

/** 装配期对宿主子系统字段的可写视图（readonly 仅约束使用期访问）。 */
export type GameInstanceMutable = { -readonly [K in keyof GameInstance]: GameInstance[K] };

/** 装配期访问宿主私有成员（_state / refreshVisibility）的钩子。 */
export interface WiringHooks {
  getState(): PlayerState;
  setState(next: PlayerState): void;
  refreshVisibility(): void;
}

/** 组装全部子系统并接线；调用方随后即可使用 GameInstance。 */
export function wireGameInstance(
  g: GameInstanceMutable,
  hooks: WiringHooks,
  options: { devLog?: DevLogOptions } = {},
): void {
  g.imageStore = new ImageStore();
  g.eventBus = new EventBus();
  g.registry = new Registry();
  g.valueSystem = new ValueSystem();
  g.conditionSystem = new ConditionSystem();
  g.funcletExecutor = new FuncletExecutor();
  // stats 与 mutations 先建：所有下层系统共用同一带统计的写入口，保证统计同步记录
  g.statsService = new StatsService();
  g.conditionSystem.setStatReader(dsl => g.statsService.evaluate(dsl));
  g.conditionSystem.setStoryRunChecker(id => g.statsService.hasCompletedStoryThisRun(id));
  g.mutations = new StateMutationService(g.eventBus, g.statsService);
  g.mutations.setProgression({
    resolveCurve,
    applyExp,
    checkBreakthrough,
    resolveAffectionConfig,
    affectionLevelCapOf,
    applyAffectionExp,
  });
  g.spotFunctionalitySystem = new SpotFunctionalitySystem(
    g.registry,
    g.conditionSystem,
    (enhId) => {
      const enh = g.registry.enhancements.get(enhId);
      if (!enh?.affectorPackIds?.length) return [];
      const tags: string[][] = [];
      for (const pid of enh.affectorPackIds) {
        const pack = g.affectorEngine.getPack(pid);
        if (!pack) continue;
        for (const entry of pack.entries) {
          for (const z of entry.zoneModifiers ?? []) {
            if (z.target.kind === 'tag') {
              const packId = typeof pid === 'string' ? pid : pack.id;
              const modName = packId.includes(':') ? packId.split(':')[0] : 'base';
              tags.push(qualifyTagPath(z.target.tag, modName));
            }
          }
        }
      }
      return tags;
    },
  );
  g.effectEngine = new EffectEngine(g.mutations, g.valueSystem, effect => {
    switch (effect.op) {
      case 'setTheme':
        g.eventBus.emit({ type: 'themeEffectRequested', effect });
        return true;
      case 'triggerStory':
        g.eventBus.emit({ type: 'storyEffectRequested', effect });
        return true;
      case 'clearAllChatFlow':
      case 'showChatText':
      case 'clearIdChatFlow':
      case 'clearAllChatText':
      case 'showOpeningTitle':
        g.eventBus.emit({ type: 'chatFlowEffectRequested', effect });
        return true;
      default:
        return false;
    }
  });
  g.characterSystem = new CharacterSystem();
  g.characterSystem.setVariantProtoResolver(
    id => g.registry.characterVariants.get(id)?.proto,
  );
  g.rosterSystem = new RosterSystem(g.registry);
  // affectionLevel 条件：读取该角色的当前好感等级（未拥有 → 0）
  g.conditionSystem.setAffectionLevelReader(variantId =>
    g.rosterSystem.affectionLevelOf(hooks.getState(), variantId));
  g.availabilityService = new CharacterAvailabilityService(
    g.registry,
    g.mutations,
    hooks.getState,
    (expr, state) => g.conditionSystem.evaluateExpr(expr, state),
  );
  g.colorSystem = new ColorSystem(
    g.registry,
    g.mutations,
    hooks.getState,
    (expr, state) => g.conditionSystem.evaluateExpr(expr, state),
  );
  g.colorEquipmentSystem = new ColorEquipmentSystem(
    g.registry,
    g.mutations,
    hooks.getState,
    (expr, state) => g.conditionSystem.evaluateExpr(expr, state),
  );
  // 聊天流演出服务（clearAllChatFlow / showChatText / clearIdChatFlow 的运行时事件源）
  g.chatFlowService = new ChatFlowService(g.eventBus);
  g.gachaService = new GachaService(
    g.registry,
    g.mutations,
    g.eventBus,
    hooks.getState,
    resourceId => g.initService.getResourceAmount(resourceId),
    pool => g.availabilityService.drawableOf(pool, hooks.getState()),
  );
  // 差分目录接线：acquireCharacter/培养/色彩装备解析经 registry 解析原型与曲线（与 extraReader 同模式）
  g.mutations.setCharacterCatalog({
    getVariant: id => g.registry.characterVariants.get(id),
    getCurve: id => g.registry.cultivateCurves.get(id),
    getColorGroup: id => g.registry.colorGroups.get(id),
    getColorEquipment: id => g.registry.colorEquipments.get(id),
    getAffectionConfig: () => g.registry.affectionConfig,
  });
  g.affectorEngine = new AffectorEngine(
    g.registry,
    g.conditionSystem,
    g.mutations,
    g.eventBus,
    g.effectEngine,
    g.spotFunctionalitySystem,
  );
  g.gameNumSystem = new GameNumSystem({
    valueSystem: g.valueSystem,
    registry: g.registry,
    affectorEngine: g.affectorEngine,
    eventBus: g.eventBus,
  });
  // Affector 的按 tag 加成经 GameNum 的 tag 效果表落地（GameNum → Affector 单向；
  // Affector 侧经 affector 事件通知重同步，docs-824/08 T7）
  g.tickSystem = new TickSystem(
    g.valueSystem,
    g.eventBus,
    g.gameNumSystem,
    g.mutations,
  );
  g.triggerSystem = new TriggerSystem(g.eventBus, g.conditionSystem, g.effectEngine);
  g.lootSystem = new LootSystem(g.registry, g.conditionSystem);
  g.visibilityEngine = new VisibilityEngine(g.registry, g.conditionSystem, g.eventBus);
  g.tagStatService = new TagStatService(
    g.registry,
    g.eventBus,
    variantId => g.registry.characterVariants.get(variantId)?.proto,
  );
  g.conditionSystem.setTagIndex(tag => g.registry.spotsWithTag(tag, hooks.getState().spotTagOverrides));
  // tagCount 条件：读取 TagStatService 的按类型收集数
  g.conditionSystem.setTagCountReader(key => {
    const idx = key.indexOf(':');
    if (idx <= 0) return 0;
    const kind = key.slice(0, idx) as TagStatKind;
    return g.tagStatService.collectedCount(kind, key.slice(idx + 1));
  });
  // Extra 三层合并视图读取器接线（docs/13 §6）：value data 源 / condition extra 目标 / addExtra 生效值
  g.valueSystem.setExtraReader(path => g.getExtra(path));
  g.conditionSystem.setExtraReader(path => g.getExtra(path));
  g.mutations.setExtraReader(path => g.getExtra(path));
  g.devLog = new DevLog(options.devLog);
  // Affector 数据包校验警告（entry id 重复等）走统一 DevLog
  g.affectorEngine.devLog = g.devLog;
  g.passivePoolSystem = new PassivePoolSystem(g.registry, g.conditionSystem, g.eventBus);
  g.storyService = new StoryService({
    registry: g.registry,
    conditionSystem: g.conditionSystem,
    effectEngine: g.effectEngine,
    mutations: g.mutations,
    eventBus: g.eventBus,
    passivePools: g.passivePoolSystem,
    getState: hooks.getState,
    travelToArea: (areaId, allowDuringStory) => g.travelToArea(areaId, allowDuringStory),
  });
  // visitedStoryInChain 条件：查询当前 Entry 跳转链是否经过某 Story（由 StoryService 提供运行时上下文）
  g.conditionSystem.setStoryChainChecker(id => g.storyService.isVisitedInChain(id));
  g.spotService = new SpotService({
    registry: g.registry,
    valueSystem: g.valueSystem,
    conditionSystem: g.conditionSystem,
    mutations: g.mutations,
    effectEngine: g.effectEngine,
    characterSystem: g.characterSystem,
    affectorEngine: g.affectorEngine,
    eventBus: g.eventBus,
    devLog: g.devLog,
    getState: hooks.getState,
    getVisibility: () => g.visibilityEngine.getVisibility(hooks.getState()),
    refreshVisibility: hooks.refreshVisibility,
    getResourceAmount: resourceId => g.initService.getResourceAmount(resourceId),
  });
  g.initService = new InitService({
    registry: g.registry,
    conditionSystem: g.conditionSystem,
    effectEngine: g.effectEngine,
    mutations: g.mutations,
    statsService: g.statsService,
    eventBus: g.eventBus,
    devLog: g.devLog,
    storyService: g.storyService,
    triggerSystem: g.triggerSystem,
    affectorEngine: g.affectorEngine,
    visibilityEngine: g.visibilityEngine,
    getState: hooks.getState,
    getVisibility: () => g.visibilityEngine.getVisibility(hooks.getState()),
    setState: next => {
      hooks.setState(next);
      // 状态整体更换（新游戏/进入世界线）时重建数值树并绑定新 state，
      // 否则 GameNumSystem.state 仍指向旧对象，区表写入/清理会落错对象
      g.gameNumSystem.buildAll(next);
    },
    resetVisibility: () => { g.visibilityEngine.reset(); },
    clearLocalVisibility: () => {
      g.visibilityEngine.clearLocal();
    },
    refreshVisibility: hooks.refreshVisibility,
    stop: () => g.stop(),
    createDefaultState: () => createDefaultPlayerState(),
    touchTickTimestamp: () => { g.sessionService.touchLastTick(); },
  });

  g.sessionService = new SessionService({
    doTick: () => g.tick(),
    devLog: g.devLog,
    eventBus: g.eventBus,
    effectEngine: g.effectEngine,
    getState: hooks.getState,
  });
  g.itemService = new ItemService({
    registry: g.registry,
    mutations: g.mutations,
    conditionSystem: g.conditionSystem,
    effectEngine: g.effectEngine,
    lootSystem: g.lootSystem,
    devLog: g.devLog,
    getState: hooks.getState,
  });
  g.enhancementService = new EnhancementService({
    registry: g.registry,
    mutations: g.mutations,
    conditionSystem: g.conditionSystem,
    effectEngine: g.effectEngine,
    affectorEngine: g.affectorEngine,
    devLog: g.devLog,
    getState: hooks.getState,
    getVisibility: () => g.visibilityEngine.getVisibility(hooks.getState()),
    refreshVisibility: hooks.refreshVisibility,
    recheckAllAffectors: () => g.affectorEngine.recheckAll(),
    getResourceAmount: resourceId => g.initService.getResourceAmount(resourceId),
  });
  g.charaProfileService = new CharaProfileService(g.registry, g.mutations, g.imageStore, hooks.getState);
  g.picService = new PicService(g.registry.pics, g.imageStore);
  g.userThemeService = new UserThemeService(g.mutations, g.affectorEngine, g.picService, hooks.getState);
  // 演出类 op 请求事件 → 领域服务分派（替代 EffectEngine 反向 handler，docs-824/08 T7）
  new RuntimeEffectReactor(g.eventBus, g.registry, g.colorSystem, g.storyService, g.chatFlowService);

  const initialState = createDefaultPlayerState();
  hooks.setState(initialState);
  g.mutations.setState(initialState);
  g.statsService.setState(initialState);
  g.affectorEngine.setState(initialState);
  g.triggerSystem.setState(initialState);

  // 在注册表加载后同步子系统
  g.eventBus.onAny((event) => {
    console.debug(`[Event] ${event.type}`, event);
    g.devLog.recordEvent(event, hooks.getState().totalFrames);
  });

  // 获得角色差分 / flag 变化后，自动重算色彩与色彩装备解锁（达成条件即入库存，闭环收集系统）
  new ColorUnlockReactor(g.eventBus, g.colorSystem, g.colorEquipmentSystem);
}
