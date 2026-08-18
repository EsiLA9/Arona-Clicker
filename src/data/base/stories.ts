// ============================================================
// data/base/stories.ts - Small story slice for the prototype
// ============================================================

import { ActiveStoryDef, PassiveStoryDef, and, Resource } from '../../engine/types';

export const baseStories: (ActiveStoryDef | PassiveStoryDef)[] = [
  {
    id: 'base:story:schale_welcome',
    name: '欢迎来到夏莱',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '欢迎回来，老师。夏莱的设备已经准备好了。',
        sendText: '设备准备完毕，可以开始调度。',
      },
      {
        speaker: '老师',
        text: '那就先把这里运转起来吧。',
        // 回复按钮文案；点击后推进到选项
        sendText: '先确认一下设备清单……',
      },
      {
        speaker: '老师',
        text: '清单确认完毕，可以开始调度了。',
        choices: [
          {
            text: '从整理办公室开始',
            effects: [{ op: 'setFlag', target: 'welcome_choice', value: 'office' }],
          },
          {
            text: '先查看生产设备',
            effects: [{ op: 'setFlag', target: 'welcome_choice', value: 'production' }],
          },
        ],
      },
      {
        speaker: '阿罗娜',
        text: '好的。设备会在每个 Tick 自动结算，资源足够后就能继续升级。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 10 },
          { op: 'addItem', target: 'base:item:energy_drink', value: 1 },
          // 完成欢迎剧情后赠送战术指挥台
          { op: 'setSpotLevel', target: 'base:spot:tactical_desk', value: '1' },
        ],
      },
    ],
  },
  {
    id: 'base:story:schale_briefing',
    name: '设备简报',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 5,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    // 信息揭示示例：累计产出 30 信用点后才知晓该剧情标题
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'stat', key: '$GlobalProducedAmount base:resource:credit', comparator: '>=', value: 30 }) },
    ],
    pages: [
      {
        speaker: '阿罗娜',
        text: '设备状态稳定。今天也会按统一 Tick 继续工作。',
        sendText: '了解，阿罗娜。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 2 }],
      },
    ],
    // 闲聊完结奖励：首次 +15 青辉石（Global），重复 +5
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_tea',
    name: '阿罗娜的茶点',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 12,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '老师，杯子里只剩下一层茶渍了。要不要我准备一些新茶？',
        sendText: '那就麻烦你了。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_printer',
    name: '打印机的抱怨',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 15,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '信用点制造机又卡纸了……不过它其实只是在用这种方式抗议加班。',
        sendText: '让它休息一下吧。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 4 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_archive',
    name: '档案室的尘埃',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 18,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '资料室的卷宗堆得比我还高了。老师，也许该归档一下？',
        sendText: '明天再说吧。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_sunset',
    name: '窗边的晚霞',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 20,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '太阳要下山了。夏莱的窗户正好能看见整片晚霞。',
        sendText: '很适合停下来看看。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 5 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  // ============================================================
  // 阿比多斯学院 — 剧情
  // ============================================================
  {
    id: 'base:story:abydos_welcome',
    name: '沙漠中的学园',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '白子',
        text: '……你来了。阿比多斯对策委员会，欢迎你的加入。',
        sendText: '请多关照，白子。',
      },
      {
        speaker: '星野',
        text: '呼啊～又多了一个人呢。不过大叔我今天想偷懒……让野乃美带你转转吧。',
        sendText: '星野前辈，请认真一点！',
      },
      {
        speaker: '野乃美',
        text: '老师，这边是校舍和泳池。虽然设施有点旧了，但大家都很努力在维护。',
        sendText: '先从校舍开始视察吧。',
        choices: [
          {
            text: '先去对策委员会室看看',
            effects: [{ op: 'setFlag', target: 'abydos_choice', value: 'committee' }],
          },
          {
            text: '去泳池那边巡逻',
            effects: [{ op: 'setFlag', target: 'abydos_choice', value: 'pool' }],
          },
        ],
      },
      {
        speaker: '芹香',
        text: '老师，请多帮忙了！我们一定会把学园恢复成以前的样子！',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 15 },
          { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
        ],
      },
    ],
  },
  {
    id: 'base:story:abydos_daily_committee',
    name: '对策委员会的日常',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 6,
    weight: 2,
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '彩奈',
        text: '今天的巡逻报告都整理好了。野乃美前辈说沙漠方向的设备状态良好。',
        sendText: '做得好，彩奈。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 4 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_siesta',
    name: '星野的午睡',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 14,
    weight: 1,
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '星野',
        text: '呼……沙发真是人类最伟大的发明之一啊。老师要不要也躺一会？',
        sendText: '不行，工作还没做完。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 6 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_serika_shift',
    name: '芹香的兼职',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 10,
    weight: 2,
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '芹香',
        text: '打工结束了！老师，今天便利店有过期便当，我顺便带了一些回来……省一点是一点嘛。',
        sendText: '辛苦了，芹香。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_money',
    name: '还债日记',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 16,
    weight: 1,
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '野乃美',
        text: '这个月的还债计划比上个月多完成了 3%。老师，阿比多斯的债务正在一点点减少呢。',
        sendText: '一步一步来。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 7 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  // ============================================================
  // 千禧年学院 — 剧情
  // ============================================================
  {
    id: 'base:story:millennium_welcome',
    name: '数据与新生',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:millennium'],
    pages: [
      {
        speaker: '优香',
        text: '老师，欢迎来到千禧年学院。我是财务担当早濑优香，这边是研究楼的数据分析站。',
        sendText: '效率很高，不愧是千禧年。',
      },
      {
        speaker: '乃爱',
        text: '根据优香前辈的预算表，实验室的信用点产出效率还有 12% 的优化空间。',
        sendText: '那就先从优化开始吧。',
        choices: [
          {
            text: '让优香负责财务优化',
            effects: [{ op: 'setFlag', target: 'millennium_choice', value: 'yuuka' }],
          },
          {
            text: '去游戏开发部看看',
            effects: [{ op: 'setFlag', target: 'millennium_choice', value: 'game' }],
          },
        ],
      },
      {
        speaker: '桃依',
        text: '老师老师！我们的游戏马上就要完成了！啊，不过在这之前得先把信用点赚够……',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 12 },
          { op: 'addItem', target: 'base:item:data_chip', value: 2 },
        ],
      },
    ],
  },
  {
    id: 'base:story:millennium_calculation',
    name: '优香的财务报告',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 6,
    weight: 2,
    availableInits: ['base:init:millennium'],
    pages: [
      {
        speaker: '优香',
        text: '本期的信用点收入比上期增加了 8.5%。虽然数据很好看，但请不要因此放松管理。',
        sendText: '放心，优香。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 5 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_game_dev',
    name: '游戏开发部的坚持',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 12,
    weight: 2,
    availableInits: ['base:init:millennium'],
    pages: [
      {
        speaker: '美依',
        text: '姐姐，游戏引擎又崩溃了。不过别担心，数据都自动备份了。',
        sendText: '需要帮忙调试吗？',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 6 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_hack',
    name: '小雪的恶作剧',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 18,
    weight: 1,
    availableInits: ['base:init:millennium'],
    pages: [
      {
        speaker: '小雪',
        text: '嘿嘿，我发现了一个系统漏洞……不过老师放心，我只是用那个算力挖了一些信用点！',
        sendText: '记得报告给乃爱。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 8 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_server',
    name: '服务器的秘密',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    cooldownFrames: 15,
    weight: 1,
    availableInits: ['base:init:millennium'],
    pages: [
      {
        speaker: '乃爱',
        text: '服务器机房的利用率已经达到了 94%。按照这个趋势，我们需要在下个月申请扩容预算。',
        sendText: '让优香批一下。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 7 }],
      },
    ],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  // ============================================================
  // Demo: 全局顺序故事链 (hasReadStory)
  //   渐进揭示：(上)完成 → (下)名称揭开 + 可开始。
  //   跨 Run 永久记忆：完成过上篇就不会再隐藏下篇。
  // ============================================================
  {
    id: 'base:story:serika_side_1',
    name: '芹香的烦恼 (上)',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:abydos'],
    pages: [
      {
        speaker: '芹香',
        text: '老师……其实我最近在便利店遇到了一点麻烦。有个顾客总是说我的找零不对。',
        sendText: '怎么回事？',
      },
      {
        speaker: '芹香',
        text: '我也不确定是不是自己的问题……但店长已经开始注意到了。',
        sendText: '我会帮你查清楚的。',
        // 多击任务：连续点击 4-5 次（base 4 + rand 0..1）完成"调查"，进度条填满后才推进
        clickWork: { base: 4, rand: 2 },
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 5 },
        ],
      },
    ],
  },
  {
    id: 'base:story:serika_side_2',
    name: '芹香的烦恼 (下)',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }),
    availableInits: ['base:init:abydos'],
    // reveal: 完成上篇后，下篇名称和条件才从 "???" 揭开。
    //   name + condition 同阶段揭示 → 不会在 "???" 状态下泄露条件文本。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }) },
    ],
    pages: [
      {
        speaker: '老师',
        text: '芹香，我查过了——那个顾客在好几家便利店都投诉过找零问题，是惯犯了。',
        sendText: '真的吗？',
      },
      {
        speaker: '芹香',
        text: '原来不是我的错……太好了。谢谢老师专门去调查！',
        sendText: '不用谢，这是老师应该做的。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 8 },
          { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
        ],
      },
    ],
  },
  // ============================================================
  // Demo: 当前 Run 内逐一揭示的故事链 (hasReadStoryInRun)
  //
  //   设计模式：n 已完成 →  n+1 可开始 + n+2 名称暗示
  //   —————————————————————————————————————————————
  //   run_chain_1 是入口，始终可见可玩。
  //   run_chain_2 的名称和开播权绑定在 run_chain_1 完成上。
  //   run_chain_3 的名称在 run_chain_1 完成时暗示，开播权在 run_chain_2 完成时解锁。
  //
  //   玩家体验（每次新 Run）：
  //   - 初始：只看到 (一) 可玩，(二)(三) 均为 "???"
  //   - 完成 (一)：(二) 揭开名称+可开始，(三) 揭开名称但"条件不足"
  //   - 完成 (二)：(三) 变为可开始
  //   - 新 Run 全部重置回到 "???"
  // ============================================================
  {
    id: 'base:story:run_chain_1',
    name: '深夜巡逻 (一)',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:schale_office'],
    pages: [
      {
        speaker: '阿罗娜',
        text: '老师，这么晚了还不休息吗？走廊里的灯已经调暗了。',
        sendText: '我想再巡视一圈。',
      },
      {
        speaker: '阿罗娜',
        text: '那我和你一起去。两人走比一个人安全。',
        sendText: '走吧，阿罗娜。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 5 },
        ],
      },
    ],
  },
  {
    id: 'base:story:run_chain_2',
    name: '深夜巡逻 (二)',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }),
    availableInits: ['base:init:schale_office'],
    // reveal: 名称+条件都在完成 (一) 后揭开，与开播权同步。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
    ],
    pages: [
      {
        speaker: '阿罗娜',
        text: '档案室的门开着。我记得下班前明明锁好了的……',
        sendText: '进去看看。',
      },
      {
        speaker: '阿罗娜',
        text: '啊，只是窗户没关好，风吹开了门。吓我一跳呢。',
        sendText: '虚惊一场。关好窗户吧。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 6 },
        ],
      },
    ],
  },
  {
    id: 'base:story:run_chain_3',
    name: '深夜巡逻 (三)',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_2', comparator: '==', value: 1 }),
    availableInits: ['base:init:schale_office'],
    // reveal: 双阶段揭示。
    //   name 在 (一)完成时揭开 → 暗示有第三章。
    //   condition 在 (二)完成时揭开 → 同时开播权解锁。
    //   中间阶段玩家看到 "深夜巡逻 (三)" 但 "条件未知"，营造悬疑感。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_2', comparator: '==', value: 1 }) },
    ],
    pages: [
      {
        speaker: '阿罗娜',
        text: '天快亮了。老师，巡逻结束了，一切都正常。',
        sendText: '辛苦了，阿罗娜。',
      },
      {
        speaker: '阿罗娜',
        text: '老师才辛苦了。明天也请多多指教。',
        sendText: '晚安（早安），阿罗娜。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 10 },
          { op: 'addItem', target: 'base:item:energy_drink', value: 2 },
        ],
      },
    ],
  },
];
