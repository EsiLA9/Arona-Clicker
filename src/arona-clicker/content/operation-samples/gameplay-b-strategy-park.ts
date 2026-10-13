import type { Datapack } from '../../../data-services/contracts/datapack';
import { spot } from '../def-factory/spot';
import { tagPath } from '../../../engine/core/tag';
import type {
  OperationActionDef,
  OperationCardPoolDef,
  OperationEventContentDef,
  OperationLocationDef,
  OperationStrategyProfileDef,
  StudentOperationProfileDef,
} from '../../../data-services/contracts/operation';
import { Character } from '../../types/ids';
import { GAMEPLAY_B_STRATEGY_PARK_IDS as IDS } from './gameplay-b-strategy-park-ids';

const team = 'gameplay-b-strategy-park:team:park-team';
const opposition = 'gameplay-b-strategy-park:team:park-opposition';
const staffTeam = 'gameplay-b-strategy-park:team:staff';
const capability = 'gameplay-b-strategy-park:capability:shotgun';
const scene = Object.freeze({ exploration: 'park:exploration', combat: 'park:combat', social: 'park:social', recovery: 'park:recovery' });
const activity = Object.freeze({
  briefing: 'park:briefing', clues: 'park:follow-tracks', kiosk: 'park:service-kiosk', negotiation: 'park:negotiation',
  firstAid: 'park:first-aid', maze: 'park:mirror-maze', ferris: 'park:ferris-maintenance', backstage: 'park:backstage',
  handoff: 'park:handoff',
  control: 'park:control-room',
});
const strategyTag = (name: string) => `park-strategy:${name}`;
const reason = (name: string) => [`gameplay-b-strategy-park:operation-reason:${name}`];

/** Author-facing Action copy travels with the sample Operation content. */
const actionCopy: Readonly<Record<string, { readonly title: string; readonly description: string }>> = {
  [IDS.actions.quickShot]: { title: '快速射击', description: '对选定对手造成 2 点伤害。' },
  [IDS.actions.suppress]: { title: '压制射击', description: '对对手造成伤害并降低现场风险。' },
  [IDS.actions.cover]: { title: '掩护同伴', description: '为一名队员恢复 1 点 HP。' },
  [IDS.actions.observe]: { title: '观察战场', description: '观察局势并降低现场风险。' },
  [IDS.actions.stepForward]: { title: '进入前排', description: '从后排移动到前排，为队伍承担压力。' },
  [IDS.actions.frontGuard]: { title: '前排护卫', description: '为一名队员恢复 2 点 HP。' },
  [IDS.actions.speakCarefully]: { title: '倾听维修员', description: '以维修员为交涉对象，降低交涉风险。' },
  [IDS.actions.deescalate]: { title: '缓和交涉', description: '以维修员为交涉对象，降低风险并记录其配合事实。' },
  [IDS.actions.requestPass]: { title: '请求维修通行证', description: '以维修员为交涉对象，取得维修凭证并记录其配合。' },
  [IDS.actions.brief]: { title: '领取巡查任务', description: '记录队伍已完成出发简报。' },
  [IDS.actions.followTracks]: { title: '追踪轮迹', description: '沿现场痕迹确认可行路线。' },
  [IDS.actions.callStaff]: { title: '联系服务亭', description: '取得员工广播凭证。' },
  [IDS.actions.firstAid]: { title: '急救队员', description: '为一名队员恢复 2 点 HP。' },
  [IDS.actions.searchMaze]: { title: '搜索镜面迷宫', description: '搜索侧廊并寻找维修凭证。' },
  [IDS.actions.inspectPanel]: { title: '检查摩天轮面板', description: '记录检修面板线索。' },
  [IDS.actions.rest]: { title: '后台休整', description: '为一名队员恢复 2 点 HP。' },
  [IDS.actions.handoff]: { title: '东门交接', description: '确认园区安全并结束巡查。' },
  [IDS.actions.searchDrawer]: { title: '搜索维修抽屉', description: '在电玩馆维修抽屉中寻找通行证。' },
  [IDS.actions.inspectConsole]: { title: '检查控制台', description: '读取维修记录。' },
  [IDS.actions.searchStaffEntry]: { title: '寻找员工入口', description: '搜索检修廊员工入口并取得凭证。' },
  [IDS.actions.resetPower]: { title: '协助控制室队员', description: '为一名队员恢复 1 点 HP。' },
  [IDS.actions.recordConsole]: { title: '登记控制台记录', description: '记录控制室内的设备信息。' },
  [IDS.actions.chargerAttack]: { title: '碰碰车冲撞', description: '对一名队员造成 1 点伤害。' },
  [IDS.actions.fireworksAttack]: { title: '烟花骚乱攻击', description: '对一名队员造成 1 点伤害。' },
  [IDS.actions.bossAttack]: { title: '领头者攻击', description: '对一名队员造成 1 点伤害。' },
};
const sceneActionTitles: Readonly<Record<string, string>> = {
  [IDS.sceneActions.brief]: '领取巡查任务',
  [IDS.sceneActions.tracks]: '追踪车轮印',
  [IDS.sceneActions.radio]: '查询员工广播',
  [IDS.sceneActions.negotiateListen]: '检查控制台',
  [IDS.sceneActions.negotiateCalm]: '搜索维修抽屉',
  [IDS.sceneActions.negotiatePass]: '搜索侧廊 / 寻找凭证',
  [IDS.sceneActions.aid]: '全队急救',
  [IDS.sceneActions.maze]: '跟随地面标记',
  [IDS.sceneActions.panel]: '检查检修面板',
  [IDS.sceneActions.rest]: '后台休整',
  [IDS.sceneActions.handoff]: '完成交接',
  [IDS.sceneActions.controlPower]: '协助控制室队员',
  [IDS.sceneActions.controlRecord]: '登记控制台记录',
};

function studentAction(
  id: string,
  tags: readonly string[],
  target: OperationActionDef['target'],
  effects: OperationActionDef['effects'],
  cardCondition?: OperationActionDef['cardCondition'],
): OperationActionDef {
  return {
    id,
    ...actionCopy[id],
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [capability],
    reasonIds: reason(id.slice(id.lastIndexOf(':') + 1)),
    tagIds: [],
    strategyTagIds: tags,
    target,
    effects,
    ...(cardCondition ? { cardCondition } : {}),
  };
}

function sceneAction(
  id: string,
  actionId: string,
  playerCost = 1,
  scope: 'individual' | 'global' = 'global',
  options: { readonly performerPolicy?: 'selected-student' | 'none'; readonly selectionPolicy?: 'required' | 'fixed' } = {},
) {
  return {
    id,
    actionId,
    scope,
    playerCost,
    title: sceneActionTitles[id],
    performerPolicy: 'selected-student' as const,
    selectionPolicy: 'required' as const,
    ...options,
  };
}

function route(id: string, targetLocationId: string, label: string, description: string,
  gate?: { readonly requiredHeldItemId?: string; readonly anyOfHeldItemIds?: readonly string[]; readonly consume?: boolean }) {
  return {
    id,
    targetLocationId,
    label,
    description,
    ...(gate?.requiredHeldItemId ? { requiredHeldItemId: gate.requiredHeldItemId } : {}),
    ...(gate?.anyOfHeldItemIds ? { anyOfHeldItemIds: gate.anyOfHeldItemIds } : {}),
    ...(gate?.consume ? { consumeRequiredHeldItem: true } : {}),
  };
}

function location(
  id: string,
  sceneId: string,
  activityId: string,
  fields: Omit<OperationLocationDef, 'id' | 'interactionSceneId' | 'activityId'>,
): OperationLocationDef {
  return { id, interactionSceneId: sceneId, activityId, ...fields };
}

const combatActions = [IDS.actions.quickShot, IDS.actions.suppress, IDS.actions.cover, IDS.actions.observe];
const combatSceneActionIds = [IDS.actions.brief, IDS.actions.followTracks, IDS.actions.callStaff, IDS.actions.firstAid,
  IDS.actions.searchMaze, IDS.actions.inspectPanel, IDS.actions.rest, IDS.actions.handoff];

const locations: readonly OperationLocationDef[] = [
  location(IDS.locations.westGate, scene.exploration, activity.briefing, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.exploration],
    enabledActionIds: [IDS.actions.brief],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.brief, IDS.actions.brief, 0, 'global', { performerPolicy: 'none' })],
    costGain: 1, maxCarryCost: 5,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.gateToCorridor, IDS.locations.corridor, '沿林荫连廊出发', '领取巡查任务后沿游园连廊前进。')],
  }),
  location(IDS.locations.corridor, scene.exploration, activity.clues, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.exploration],
    enabledActionIds: [IDS.actions.followTracks],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 2,
    sceneActions: [sceneAction(IDS.sceneActions.tracks, IDS.actions.followTracks)],
    costGain: 1, maxCarryCost: 5,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.corridorToKiosk, IDS.locations.kiosk, '前往游园服务亭', '轮迹与广播线索都指向服务亭。')],
  }),
  location(IDS.locations.kiosk, scene.exploration, activity.kiosk, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.exploration],
    enabledActionIds: [IDS.actions.callStaff],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.radio, IDS.actions.callStaff)],
    costGain: 2, maxCarryCost: 6,
    maxVisits: 2,
    routeEdges: [
      route(IDS.routes.kioskToArcade, IDS.locations.arcade, '调查代币电玩馆', '在服务亭登记后前往电玩馆寻找检修线索。'),
      route(IDS.routes.kioskToAid, IDS.locations.aid, '先去急救补给站', '跳过电玩馆，先处理队伍状态。'),
    ],
  }),
  location(IDS.locations.arcade, scene.social, activity.negotiation, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.negotiation],
    enabledActionIds: [IDS.actions.searchDrawer, IDS.actions.inspectConsole],
    combinationRules: [], actionMode: 'individual', sceneActionBatches: 1,
    sceneActions: [
      sceneAction(IDS.sceneActions.negotiateListen, IDS.actions.inspectConsole, 0, 'individual'),
      sceneAction(IDS.sceneActions.negotiateCalm, IDS.actions.searchDrawer, 1, 'individual'),
    ],
    costGain: 1, maxCarryCost: 6,
    maxVisits: 2,
    routeEdges: [
      route(IDS.routes.arcadeToMaze, IDS.locations.maze, '进入镜面迷宫', '检修线索指向镜面迷宫。'),
      route(IDS.routes.arcadeToKiosk, IDS.locations.kiosk, '返回服务亭', '可以返回服务亭重新整备。'),
    ],
  }),
  location(IDS.locations.bumper, scene.combat, 'park:first-encounter', {
    stage: 'combat',
    cardPoolIds: [IDS.pools.frontline],
    enabledActionIds: [...combatActions, IDS.actions.stepForward, IDS.actions.frontGuard, IDS.actions.chargerAttack],
    combinationRules: [], maxBeats: 3, costGain: 1, maxCarryCost: 5,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.bumperToAid, IDS.locations.aid, '前往急救补给站', '碰碰车区暂时安全，前往补给站整备。')],
  }),
  location(IDS.locations.aid, scene.recovery, activity.firstAid, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.recovery],
    enabledActionIds: [IDS.actions.firstAid],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.aid, IDS.actions.firstAid, 2)],
    costGain: 2, maxCarryCost: 6,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.aidToFerris, IDS.locations.ferris, '前往摩天轮检修廊', '完成急救后沿设备层标记继续巡查。')],
  }),
  location(IDS.locations.maze, scene.exploration, activity.maze, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.exploration],
    enabledActionIds: [IDS.actions.searchMaze, IDS.actions.followTracks],
    combinationRules: [], actionMode: 'individual', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.maze, IDS.actions.followTracks, 0, 'individual'),
      sceneAction(IDS.sceneActions.negotiatePass, IDS.actions.searchMaze, 1, 'individual')],
    costGain: 1, maxCarryCost: 5,
    maxVisits: 2,
    routeEdges: [
      route(IDS.routes.mazeToArcade, IDS.locations.arcade, '返回电玩馆', '回到电玩馆重新检查维修线索。'),
      route(IDS.routes.mazeToBumper, IDS.locations.bumper, '前往碰碰车区', '沿迷宫出口进入失控碰碰车区。'),
      route(IDS.routes.mazeToAid, IDS.locations.aid, '前往急救站', '离开迷宫前往急救补给站。'),
      route(IDS.routes.mazeToFerris, IDS.locations.ferris, '前往摩天轮检修廊', '沿迷宫标记抵达摩天轮设备区。'),
    ],
  }),
  location(IDS.locations.ferris, scene.exploration, activity.ferris, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.exploration],
    enabledActionIds: [IDS.actions.inspectPanel, IDS.actions.searchStaffEntry],
    combinationRules: [], actionMode: 'individual', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.panel, IDS.actions.inspectPanel, 1, 'individual'),
      sceneAction(IDS.sceneActions.negotiatePass, IDS.actions.searchStaffEntry, 0, 'individual')],
    costGain: 1, maxCarryCost: 5,
    maxVisits: 2,
    routeEdges: [
      route(IDS.routes.ferrisToBackstage, IDS.locations.backstage, '经后台休息室绕行', '未取得员工通行证时仍可走公开后台通道。'),
      route(IDS.routes.ferrisToControl, IDS.locations.control, '持维修证或员工广播进入控制室', '任一员工凭证均可打开同一处地下设备层入口。', { anyOfHeldItemIds: [IDS.items.maintenancePass, IDS.items.staffRadio] }),
    ],
  }),
  location(IDS.locations.fireworks, scene.combat, 'park:second-encounter', {
    stage: 'combat',
    cardPoolIds: [IDS.pools.frontline],
    enabledActionIds: [...combatActions, IDS.actions.frontGuard, IDS.actions.fireworksAttack],
    combinationRules: [], maxBeats: 3, costGain: 1, maxCarryCost: 5,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.fireworksToBoss, IDS.locations.boss, '进入中央舞台设备井', '烟花排练场清理后进入 Boss 战。')],
  }),
  location(IDS.locations.backstage, scene.recovery, activity.backstage, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.recovery],
    enabledActionIds: [IDS.actions.rest],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.rest, IDS.actions.rest, 2)],
    costGain: 2, maxCarryCost: 6,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.backstageToFireworks, IDS.locations.fireworks, '进入烟花排练广场', '后台检查完成后进入烟花排练广场。')],
  }),
  location(IDS.locations.boss, scene.combat, 'park:final-encounter', {
    stage: 'combat',
    cardPoolIds: [IDS.pools.frontline],
    enabledActionIds: [...combatActions, IDS.actions.frontGuard, IDS.actions.bossAttack],
    combinationRules: [], maxBeats: 4, costGain: 1, maxCarryCost: 5,
    maxVisits: 1,
    routeEdges: [route(IDS.routes.bossToExit, IDS.locations.exit, '前往东出口交接', '设备井安全后前往东门完成现场交接。')],
  }),
  location(IDS.locations.exit, scene.social, activity.handoff, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.handoff],
    enabledActionIds: [IDS.actions.handoff],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.handoff, IDS.actions.handoff, 0)],
    costGain: 0, maxCarryCost: 5, maxVisits: 1, routeEdges: [],
  }),
  location(IDS.locations.control, scene.recovery, activity.control, {
    stage: 'scene',
    cardPoolIds: [IDS.pools.recovery],
    enabledActionIds: [IDS.actions.resetPower, IDS.actions.recordConsole],
    combinationRules: [], actionMode: 'global', sceneActionBatches: 1,
    sceneActions: [sceneAction(IDS.sceneActions.controlPower, IDS.actions.resetPower, 2),
      sceneAction(IDS.sceneActions.controlRecord, IDS.actions.recordConsole, 0, 'global', { performerPolicy: 'none', selectionPolicy: 'fixed' })],
    costGain: 3, maxCarryCost: 5, maxVisits: 2,
    routeEdges: [
      route(IDS.routes.controlToFerris, IDS.locations.ferris, '返回摩天轮检修廊', '控制室有通道返回摩天轮检修廊。'),
      route(IDS.routes.controlToBossPass, IDS.locations.boss, '消费维修通行证进入设备井', '使用维修通行证打开舞台设备井路线。', { requiredHeldItemId: IDS.items.maintenancePass, consume: true }),
      route(IDS.routes.controlToBossRadio, IDS.locations.boss, '消费员工广播凭证进入设备井', '使用员工广播凭证打开舞台设备井路线。', { requiredHeldItemId: IDS.items.staffRadio, consume: true }),
    ],
  }),
];

const actions: readonly OperationActionDef[] = [
  studentAction(IDS.actions.quickShot, [strategyTag('attack')], { kind: 'actor', relation: 'otherTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: -2 }], { sceneIds: [scene.combat] }),
  studentAction(IDS.actions.suppress, [strategyTag('attack'), strategyTag('aggressive')], { kind: 'actor', relation: 'otherTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }, { kind: 'eventTrackDelta', trackId: IDS.tracks.risk, amount: -1 }],
    { sceneIds: [scene.combat] }),
  studentAction(IDS.actions.cover, [strategyTag('protect'), strategyTag('cover')], { kind: 'actor', relation: 'sameTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }], { sceneIds: [scene.combat] }),
  studentAction(IDS.actions.observe, [strategyTag('observe')], { kind: 'none' },
    [{ kind: 'eventTrackDelta', trackId: IDS.tracks.risk, amount: -1 }], { sceneIds: [scene.combat] }),
  studentAction(IDS.actions.stepForward, [strategyTag('movement'), strategyTag('frontline'), strategyTag('protect')], { kind: 'none' },
    [{ kind: 'actorPosition', recipient: 'actor', positionId: 'front' }], { sceneIds: [scene.combat], positionIds: ['back'] }),
  studentAction(IDS.actions.frontGuard, [strategyTag('protect'), strategyTag('cover')], { kind: 'actor', relation: 'sameTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }], { sceneIds: [scene.combat], positionIds: ['front'] }),
  studentAction(IDS.actions.speakCarefully, [strategyTag('social'), strategyTag('observe')], { kind: 'actor', relation: 'otherTeam' },
    [{ kind: 'eventTrackDelta', trackId: IDS.tracks.risk, amount: -1 }], { sceneIds: [scene.social], activityIds: [activity.negotiation] }),
  studentAction(IDS.actions.deescalate, [strategyTag('social'), strategyTag('deescalate'), strategyTag('protect')], { kind: 'actor', relation: 'otherTeam' },
    [{ kind: 'eventTrackDelta', trackId: IDS.tracks.risk, amount: -2 }, { kind: 'eventFact', factId: IDS.facts.staffCooperates, op: 'reveal' }],
    { sceneIds: [scene.social], activityIds: [activity.negotiation] }),
  studentAction(IDS.actions.requestPass, [strategyTag('social'), strategyTag('direct')], { kind: 'actor', relation: 'otherTeam' },
    [{ kind: 'eventFact', factId: IDS.facts.staffCooperates, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }],
    { sceneIds: [scene.social], activityIds: [activity.negotiation] }),
  studentAction(IDS.actions.brief, [strategyTag('observe'), strategyTag('support')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.briefed, op: 'reveal' }], { sceneIds: [scene.exploration], activityIds: [activity.briefing] }),
  studentAction(IDS.actions.followTracks, [strategyTag('observe'), strategyTag('cautious')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.trail, op: 'reveal' }], { sceneIds: [scene.exploration], activityIds: [activity.clues] }),
  studentAction(IDS.actions.callStaff, [strategyTag('observe'), strategyTag('social')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.trail, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.staffRadio, op: 'grant' }], { sceneIds: [scene.exploration], activityIds: [activity.kiosk] }),
  studentAction(IDS.actions.firstAid, [strategyTag('support'), strategyTag('protect')], { kind: 'actor', relation: 'sameTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }], { sceneIds: [scene.recovery], activityIds: [activity.firstAid] }),
  studentAction(IDS.actions.searchMaze, [strategyTag('observe'), strategyTag('cautious')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.mazeRoute, op: 'reveal' }, { kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }], { sceneIds: [scene.exploration], activityIds: [activity.maze] }),
  studentAction(IDS.actions.inspectPanel, [strategyTag('observe'), strategyTag('direct')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }], { sceneIds: [scene.exploration], activityIds: [activity.ferris] }),
  studentAction(IDS.actions.rest, [strategyTag('support'), strategyTag('cautious')], { kind: 'actor', relation: 'sameTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: 2 }], { sceneIds: [scene.recovery], activityIds: [activity.backstage] }),
  studentAction(IDS.actions.handoff, [strategyTag('support'), strategyTag('direct')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.safe, op: 'reveal' }], { sceneIds: [scene.social], activityIds: [activity.handoff] }),
  studentAction(IDS.actions.searchDrawer, [strategyTag('observe'), strategyTag('direct')], { kind: 'none' },
    [{ kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }], { sceneIds: [scene.social], activityIds: [activity.negotiation] }),
  studentAction(IDS.actions.inspectConsole, [strategyTag('observe'), strategyTag('cautious')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }], { sceneIds: [scene.social], activityIds: [activity.negotiation] }),
  studentAction(IDS.actions.searchStaffEntry, [strategyTag('observe'), strategyTag('direct')], { kind: 'none' },
    [{ kind: 'heldItem', itemId: IDS.items.maintenancePass, op: 'grant' }], { sceneIds: [scene.exploration], activityIds: [activity.ferris] }),
  studentAction(IDS.actions.resetPower, [strategyTag('support'), strategyTag('protect')], { kind: 'actor', relation: 'sameTeam' },
    [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }], { sceneIds: [scene.recovery], activityIds: [activity.control] }),
  studentAction(IDS.actions.recordConsole, [strategyTag('observe'), strategyTag('direct')], { kind: 'none' },
    [{ kind: 'eventFact', factId: IDS.facts.powerPanel, op: 'reveal' }], { sceneIds: [scene.recovery], activityIds: [activity.control] }),
  {
    id: IDS.actions.chargerAttack, allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [],
    ...actionCopy[IDS.actions.chargerAttack],
    reasonIds: reason('bumper-charger'), tagIds: ['gameplay-b-strategy-park:intent:charge'],
    target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
  },
  {
    id: IDS.actions.fireworksAttack, allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [],
    ...actionCopy[IDS.actions.fireworksAttack],
    reasonIds: reason('fireworks-pressure'), tagIds: ['gameplay-b-strategy-park:intent:fireworks'],
    target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
  },
  {
    id: IDS.actions.bossAttack, allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [],
    ...actionCopy[IDS.actions.bossAttack],
    reasonIds: reason('stage-leader'), tagIds: ['gameplay-b-strategy-park:intent:leader'],
    target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
  },
];

const strategies: readonly OperationStrategyProfileDef[] = [
  { id: IDS.strategies.steadfast, biases: [
    { tagId: strategyTag('protect'), biasBps: 24000 }, { tagId: strategyTag('cover'), biasBps: 22000 },
    { tagId: strategyTag('observe'), biasBps: 15000 }, { tagId: strategyTag('attack'), biasBps: 4500 },
    { tagId: strategyTag('aggressive'), biasBps: 3000 }, { tagId: strategyTag('movement'), biasBps: 16000 },
  ] },
  { id: IDS.strategies.forward, biases: [
    { tagId: strategyTag('attack'), biasBps: 25000 }, { tagId: strategyTag('aggressive'), biasBps: 21000 },
    { tagId: strategyTag('protect'), biasBps: 5000 }, { tagId: strategyTag('cover'), biasBps: 3500 },
    { tagId: strategyTag('observe'), biasBps: 6000 },
  ] },
  { id: IDS.strategies.observer, biases: [
    { tagId: strategyTag('observe'), biasBps: 24000 }, { tagId: strategyTag('cautious'), biasBps: 19000 },
    { tagId: strategyTag('attack'), biasBps: 8000 }, { tagId: strategyTag('protect'), biasBps: 12000 },
    { tagId: strategyTag('support'), biasBps: 17000 },
  ] },
];

const pools: readonly OperationCardPoolDef[] = [
  { id: IDS.pools.combat, selector: { sceneIds: [scene.combat] }, entries: [
    { actionId: IDS.actions.quickShot, weight: 10 }, { actionId: IDS.actions.suppress, weight: 5 },
    { actionId: IDS.actions.cover, weight: 6 }, { actionId: IDS.actions.observe, weight: 4 },
  ] },
  { id: IDS.pools.frontline, selector: { sceneIds: [scene.combat], positionIds: ['front'] }, entries: [
    { actionId: IDS.actions.frontGuard, weight: 8 },
  ] },
  { id: IDS.pools.backline, selector: { sceneIds: [scene.combat], positionIds: ['back'] }, entries: [
    { actionId: IDS.actions.stepForward, weight: 5 },
  ] },
  { id: IDS.pools.negotiation, selector: { sceneIds: [scene.social], activityIds: [activity.negotiation] }, entries: [
    { actionId: IDS.actions.speakCarefully, weight: 7 }, { actionId: IDS.actions.deescalate, weight: 5 },
    { actionId: IDS.actions.requestPass, weight: 3 },
  ] },
  { id: IDS.pools.exploration, selector: { sceneIds: [scene.exploration] }, entries: [
    { actionId: IDS.actions.brief, weight: 4 }, { actionId: IDS.actions.followTracks, weight: 6 },
    { actionId: IDS.actions.callStaff, weight: 4 }, { actionId: IDS.actions.searchMaze, weight: 5 },
    { actionId: IDS.actions.inspectPanel, weight: 5 },
  ] },
  { id: IDS.pools.recovery, selector: { sceneIds: [scene.recovery] }, entries: [
    { actionId: IDS.actions.firstAid, weight: 8 }, { actionId: IDS.actions.rest, weight: 7 },
  ] },
  { id: IDS.pools.handoff, selector: { sceneIds: [scene.social], activityIds: [activity.handoff] }, entries: [
    { actionId: IDS.actions.handoff, weight: 5 },
  ] },
];

const studentActionIds = actions.filter(action => action.allowedParticipantKinds.includes('student')).map(action => action.id);
const studentProfiles: readonly StudentOperationProfileDef[] = [
  { id: IDS.profiles.hoshino, characterId: Character.Hoshino, candidateActionIds: studentActionIds, actionPriorityIds: studentActionIds,
    capabilityIds: [capability], reasonIds: reason('steadfast'), strategyProfileId: IDS.strategies.steadfast, cardPoolIds: [IDS.pools.backline] },
  { id: IDS.profiles.serika, characterId: Character.Serika, candidateActionIds: studentActionIds, actionPriorityIds: studentActionIds,
    capabilityIds: [capability], reasonIds: reason('forward'), strategyProfileId: IDS.strategies.forward },
  { id: IDS.profiles.shiroko, characterId: Character.Shiroko, candidateActionIds: studentActionIds, actionPriorityIds: studentActionIds,
    capabilityIds: [capability], reasonIds: reason('observer'), strategyProfileId: IDS.strategies.observer },
];

const eventDefinition: OperationEventContentDef = {
  id: IDS.event,
  title: '游园会停电巡查',
  description: '园区多处设施停电，队伍需要沿现场线索巡查、控制风险并完成东门交接。',
  initId: 'base:init:schale_office',
  resumeVersion: 4,
  locationIds: locations.map(row => row.id),
  initialLocationId: IDS.locations.westGate,
  maxLocationVisits: 18,
  tracks: [{ id: IDS.tracks.risk, initial: 3, min: 0, max: 8 }],
  factIds: Object.values(IDS.facts),
  knownFactIds: [],
  itemIds: [IDS.items.maintenancePass, IDS.items.staffRadio],
  cardPoolIds: [IDS.pools.combat],
  characterHandSize: 3,
  heldItemIds: [],
  objectives: [{
    id: 'park-safe-primary', description: '让设备区安全并完成东门交接。', kind: 'primary',
    predicate: { kind: 'knownFact', factId: IDS.facts.safe, present: true },
  }],
  hardFailureConditions: [{
    id: 'park-risk-failure', description: '现场风险达到上限。',
    predicate: { kind: 'track', trackId: IDS.tracks.risk, operator: 'gte', value: 8 },
  }],
  actors: [
    { id: IDS.actors.hoshino, type: 'student', displayName: '小鸟游星野', hp: { initial: 8, min: 0, max: 8 }, teamId: team, positionId: 'back', weaponId: 'sg', targetPriorityActorIds: [IDS.actors.charger, IDS.actors.fireworks, IDS.actors.boss] },
    { id: IDS.actors.serika, type: 'student', displayName: '黑见芹香', hp: { initial: 8, min: 0, max: 8 }, teamId: team, positionId: 'back', weaponId: 'sg', targetPriorityActorIds: [IDS.actors.charger, IDS.actors.fireworks, IDS.actors.boss] },
    { id: IDS.actors.shiroko, type: 'student', displayName: '砂狼白子', hp: { initial: 8, min: 0, max: 8 }, teamId: team, positionId: 'front', weaponId: 'sg', targetPriorityActorIds: [IDS.actors.charger, IDS.actors.fireworks, IDS.actors.boss] },
    { id: IDS.actors.charger, type: 'opponent', displayName: '碰碰车冲撞者', hp: { initial: 8, min: 0, max: 8 }, teamId: opposition, targetPriorityActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko] },
    { id: IDS.actors.fireworks, type: 'opponent', displayName: '烟花骚乱者', hp: { initial: 9, min: 0, max: 9 }, teamId: opposition, targetPriorityActorIds: [IDS.actors.serika, IDS.actors.hoshino, IDS.actors.shiroko] },
    { id: IDS.actors.boss, type: 'opponent', displayName: '舞台设备领头者', hp: { initial: 12, min: 0, max: 12 }, teamId: opposition, targetPriorityActorIds: [IDS.actors.shiroko, IDS.actors.hoshino, IDS.actors.serika] },
    { id: IDS.actors.staff, type: 'environment', displayName: '电玩馆维修员', hp: { initial: 1, min: 0, max: 1 }, teamId: staffTeam },
  ],
  teams: [{ id: team }, { id: opposition }, { id: staffTeam }],
  participants: [
    { actorId: IDS.actors.hoshino, kind: 'student', profileId: IDS.profiles.hoshino },
    { actorId: IDS.actors.serika, kind: 'student', profileId: IDS.profiles.serika },
    { actorId: IDS.actors.shiroko, kind: 'student', profileId: IDS.profiles.shiroko },
    { actorId: IDS.actors.charger, kind: 'opponent', candidateActionIds: [IDS.actions.chargerAttack] },
    { actorId: IDS.actors.fireworks, kind: 'opponent', candidateActionIds: [IDS.actions.fireworksAttack] },
    { actorId: IDS.actors.boss, kind: 'opponent', candidateActionIds: [IDS.actions.bossAttack] },
    { actorId: IDS.actors.staff, kind: 'environment', candidateActionIds: [] },
  ],
  playerRouteState: { playerCost: 5 },
  randomSeed: 241024,
};

/** Independent 13-location Operation pack inspired by, but not replacing, the Carousel demo. */
export const gameplayBStrategyParkDatapack: Datapack = {
  modName: 'gameplay-b-strategy-park',
  name: 'Gameplay B Strategy Park Validation',
  version: '1.0.0',
  inits: [], areas: [],
  spots: [spot('gameplay-b-strategy-park:spot:park_terminal', 'base:area:schale_main')
    .name('园区巡查终端').desc('组织学生进入策略园巡查，或继续当前巡查进度。')
    .cost(0).maxLevel(1).tags(tagPath('tactical'), tagPath('office'))
    .operationEntry('strategy-park', eventDefinition.id).build()],
  enhancements: [], activeStories: [], passiveStories: [], stories: [], items: [], funcletDefs: [], characters: [],
  operationEvents: [eventDefinition],
  operationLocations: [...locations],
  operationActions: [...actions],
  studentOperationProfiles: [...studentProfiles],
  operationStrategyProfiles: [...strategies],
  operationCardPools: [...pools],
};

export const gameplayBStrategyParkContent = Object.freeze({ eventDefinition, locations, actions, studentProfiles, strategies, pools });
