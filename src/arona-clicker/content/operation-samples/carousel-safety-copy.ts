import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';

/** Static demo presentation only. Runtime resolution and action legality never read this catalog. */
export const CAROUSEL_SAFETY_PRESENTATION = Object.freeze({
  event: {
    title: '旋转木马的异常震动',
    introduction: '设施安全锁连续发出警报。夏莱小组要在游客继续靠近前稳定设备。',
    locationId: CAROUSEL_SAFETY_IDS.location,
    maximumBeats: 2,
    localOutcome: { trackId: CAROUSEL_SAFETY_IDS.track, safeAtOrBelow: 3 },
  },
  locations: {
    [CAROUSEL_SAFETY_IDS.location]: {
      name: '旋转木马平台',
      description: '停靠区拥挤，制动杆还在震动。',
    },
  },
  tracks: {
    [CAROUSEL_SAFETY_IDS.track]: {
      name: '设施危险度',
      description: '数值越高越不稳定；试玩结束时 3 或以下视为已控制。',
    },
  },
  actors: {
    [CAROUSEL_SAFETY_IDS.actors.hoshino]: {
      name: '星野', role: '一线防护', description: '正面稳住制动杆；她的防护能力可执行紧急停机。',
    },
    [CAROUSEL_SAFETY_IDS.actors.serika]: {
      name: '芹香', role: '现场协调', description: '用节奏信号同步制动，或消耗小组协调余量疏导游客。',
    },
    [CAROUSEL_SAFETY_IDS.actors.shiroko]: {
      name: '白子', role: '精确支援', description: '稳住设备外框，降低关键部件受损风险。',
    },
    [CAROUSEL_SAFETY_IDS.actors.saboteur]: {
      name: '破坏者', role: '对手', description: '试图破坏设施安全闩。',
    },
    [CAROUSEL_SAFETY_IDS.actors.agitator]: {
      name: '闹事者', role: '对手', description: '制造混乱，让现场更难控制。',
    },
    [CAROUSEL_SAFETY_IDS.actors.ride]: {
      name: '旋转木马', role: '环境目标', description: '目标耐久归零时，设备无法继续稳定运行。',
    },
  },
  actions: {
    [CAROUSEL_SAFETY_IDS.actions.brace]: { name: '压住制动杆', description: '稳住设备；与芹香的节奏信号可形成合流。' },
    [CAROUSEL_SAFETY_IDS.actions.emergencyStop]: { name: '紧急停机', description: '消耗星野 1 点体力，危险度 -4；会放弃制动合流。' },
    [CAROUSEL_SAFETY_IDS.actions.signal]: { name: '节奏信号', description: '降低危险度，并可与制动动作形成合流。' },
    [CAROUSEL_SAFETY_IDS.actions.crowdGuide]: { name: '疏导游客', description: '消耗小组 1 点协调资源，危险度 -3；无法参与制动合流。' },
    [CAROUSEL_SAFETY_IDS.actions.shield]: { name: '护住设备外框', description: '保护关键目标。' },
    [CAROUSEL_SAFETY_IDS.actions.sabotage]: { name: '破坏安全闩', description: '降低设备耐久。' },
    [CAROUSEL_SAFETY_IDS.actions.alarm]: { name: '制造混乱', description: '推高现场危险度。' },
    [CAROUSEL_SAFETY_IDS.actions.surge]: { name: '机械惯性', description: '旋转仍会推高危险度。' },
  },
  abilities: {
    'gameplay-b:operation-capability:frontline-protection': '星野的防护能力解锁“紧急停机”，提供主动压低危险度的路线。',
    'gameplay-b:operation-capability:crowd-coordination': '芹香的现场协调能力解锁游客疏导路线。',
    'gameplay-b:operation-capability:precision': '白子的精确能力解锁设备外框防护。',
  },
  reasons: {
    'gameplay-b:operation-reason:hoshino-veteran': '经验丰富，能及时稳住制动装置。',
    'gameplay-b:operation-reason:serika-crowd-awareness': '擅长留意人群动向。',
    'gameplay-b:operation-reason:shiroko-precision': '能精确判断设备受力点。',
    'gameplay-b:operation-reason:brace-the-brake': '制动杆仍可手动稳住。',
    'gameplay-b:operation-reason:emergency-stop': '停机可迅速降低危险，但会消耗体力并放弃合流。',
    'gameplay-b:operation-reason:signal-rhythm': '节奏信号可以同步制动。',
    'gameplay-b:operation-reason:guide-the-crowd': '协调资源可快速疏导游客。',
    'gameplay-b:operation-reason:shield-the-frame': '护住框架可降低设备损伤。',
    'gameplay-b:operation-reason:sabotage-the-latch': '对手正接近安全闩。',
    'gameplay-b:operation-reason:raise-an-alarm': '人群混乱会让危险升高。',
    'gameplay-b:operation-reason:mechanical-surge': '设备惯性尚未消退。',
  },
} as const);
