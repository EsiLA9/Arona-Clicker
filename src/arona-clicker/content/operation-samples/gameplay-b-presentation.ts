import { CAROUSEL_SAFETY_IDS as SAFETY } from './carousel-safety-ids';
import { CAROUSEL_SAFETY_PRESENTATION as SAFETY_COPY } from './carousel-safety-copy';
import { CAROUSEL_SCENE_ACTION_IDS as SCENE } from './carousel-scene-action-slice';

/** Localized copy for the one packaged V1 slice; rules and legal choices stay in its Datapack. */
export const GAMEPLAY_B_PRESENTATION = Object.freeze({
  event: {
    id: SCENE.event,
    title: '旋转木马安全行动',
    introduction: '设施警报仍未解除。先稳住现场，再检查控制台并确认游客都能安全离场。',
  },
  locations: {
    [SCENE.locations.platform]: {
      name: '旋转木马平台',
      description: '破坏者仍在活动；小组可以按各自判断行动，你只能临场修订一名学生的计划。',
    },
    [SCENE.locations.concourse]: {
      name: '游乐园通道',
      description: '队员可以分头检查控制台或引导游客。检查控制台会找到员工证。',
    },
    [SCENE.locations.exit]: {
      name: '出口集合点',
      description: '选择一项全队协同行动；玩家手牌可以和这项行动一起打出。',
    },
  },
  tracks: {
    [SAFETY.track]: {
      name: '设施危险度',
      description: '结束时 3 或以下可安全结案；5 或以下可部分结案。',
    },
    [SCENE.track]: {
      name: '队伍整备度',
      description: '通道行动和全队急救会提高现场整备度。',
    },
  },
  facts: {
    [SCENE.fact]: '旋转木马控制台已检查',
  },
  items: {
    [SCENE.item]: '员工证',
  },
  actors: {
    [SAFETY.actors.hoshino]: { role: '前线防护', description: '稳住设备；必要时可花费体力紧急停机。' },
    [SAFETY.actors.serika]: { role: '现场协调', description: '同步制动节奏，也能帮助游客通过通道。' },
    [SAFETY.actors.shiroko]: { role: '精确支援', description: '稳定设备外框，并协助现场检查。' },
    [SAFETY.actors.saboteur]: { role: '对手', description: '持续靠近设备安全闩。' },
    [SAFETY.actors.agitator]: { role: '对手', description: '试图制造现场混乱。' },
    [SAFETY.actors.ride]: { role: '环境设施', description: '设备的危险度与耐久会在行动中变化。' },
  },
  actions: {
    ...SAFETY_COPY.actions,
    [SCENE.actions.investigate]: { name: '检查控制台', description: '发现员工证并记录设备已检查。' },
    [SCENE.actions.guideCrowd]: { name: '引导游客', description: '消耗 1 点 PlayerCost，改善通道秩序。' },
    [SCENE.actions.treatTeam]: { name: '全队急救', description: '为每名选定队员恢复 1 点 HP，并降低现场危险度。' },
  },
  sceneActions: {
    [SCENE.sceneActions.inspect]: '检查控制台',
    [SCENE.sceneActions.guide]: '引导游客',
    [SCENE.sceneActions.firstAid]: '全队急救',
  },
  playerCards: {
    [SCENE.actions.treatTeam]: '团队急救包',
  },
  resultText: {
    success: '主要目标已完成，设施风险已降到安全范围。',
    partialSuccess: '现场暂时稳定，但仍有目标没有完全达成。',
    failure: '危险度仍高，行动未能安全收尾。',
  },
} as const);
