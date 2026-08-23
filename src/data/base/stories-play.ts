// ============================================================
// data/base/stories-play.ts — 演出本体（baseStories）
// 由 stories.ts 拆分而来，存储全部 story 演出内容。
// ============================================================

import { StoryDef, Resource } from '../../engine/types';

export const baseStories: StoryDef[] = [
  {
    id: 'base:story:schale_welcome',
    name: '欢迎来到夏莱',
    talklets: [
      {
        kind: 'narration',
        align: 'center',
        text: '—— 夏莱办公室 · 清晨 ——',
      },
      {
        speaker: '阿罗娜',
        text: '欢迎回来，老师。夏莱的设备已经准备好了。',
        sendText: '设备准备完毕，可以开始调度。',
        muteReply:true
      },
      {
        speaker: '老师',
        text: '那就先把这里运转起来吧。',
        // 回复按钮文案；点击后推进到选项
      },{
        kind:'click',
        text:'Arona检查了一下......。',
        clickWork: { base: 4, rand: 2 },
      },
      {
        kind: 'narration',
        align: 'center',
        text: '* 阿罗娜在平板上划出设备清单，一项项核对。*',
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
    talklets: [
      {
        kind: 'narration',
        text: '· 例行设备简报 ·',
      },
      {
        speaker: '阿罗娜',
        text: '设备状态稳定。今天也会按统一 Tick 继续工作。',
        sendText: '了解，阿罗娜。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 2 }],
      },
    ],
  },
  {
    id: 'base:story:schale_tea',
    name: '阿罗娜的茶点',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '老师，杯子里只剩下一层茶渍了。要不要我准备一些新茶？',
        sendText: '那就麻烦你了。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
  },
  {
    id: 'base:story:schale_printer',
    name: '打印机的抱怨',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '信用点制造机又卡纸了……不过它其实只是在用这种方式抗议加班。',
        sendText: '让它休息一下吧。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 4 }],
      },
    ],
  },
  {
    id: 'base:story:schale_archive',
    name: '档案室的尘埃',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '资料室的卷宗堆得比我还高了。老师，也许该归档一下？',
        sendText: '明天再说吧。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
  },
  {
    id: 'base:story:schale_sunset',
    name: '窗边的晚霞',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '太阳要下山了。夏莱的窗户正好能看见整片晚霞。',
        sendText: '很适合停下来看看。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 5 }],
      },
    ],
  },
  {
    id: 'base:story:schale_planner',
    name: '日程表攻防',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '老师，明天的日程已经排好了……虽然您八成会全部推迟。',
        sendText: '说得这么直白真的好吗。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
      {
        speaker: '阿罗娜',
        text: '那就把最难的报告安排在深夜时段吧——反正您那个时候反而很有精神！',
        sendText: '那就这么定了。',
        // 彩蛋链：开启深夜模式，解锁「深夜闲聊」池
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 2 },
          { op: 'setFlag', target: 'night_mode', value: '1' },
        ],
      },
    ],
  },
  {
    id: 'base:story:schale_vending',
    name: '贩卖机的秘密',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '走廊尽头的自动贩卖机，第三排的咖啡罐……其实是装了能量饮料的伪装版。',
        sendText: '谁干的？',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 4 }],
      },
    ],
  },
  {
    id: 'base:story:schale_night',
    name: '深夜的夏莱',
    talklets: [
      {
        speaker: '阿罗娜',
        text: '老师，都这个时间了还不休息吗？……好吧，那我把台灯调暗一点。',
        sendText: '再十分钟就好。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 6 }],
      },
    ],
  },
  // ============================================================
  // 阿比多斯学院 — 剧情
  // ============================================================
  {
    id: 'base:story:abydos_welcome',
    name: '沙漠中的学园',
    talklets: [
      {
        kind: 'narration',
        text: '—— 阿比多斯学院 · 对策委员会室 ——',
      },
      {
        speaker: '白子',
        text: '……你来了。阿比多斯对策委员会，欢迎你的加入。',
        sendText: '请多关照，白子。',
      },
      {
        kind: 'narration',
        align: 'right',
        text: '* 门边探出半个脑袋，星野正打着哈欠。*',
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
    talklets: [
      {
        speaker: '彩奈',
        text: '今天的巡逻报告都整理好了。野乃美前辈说沙漠方向的设备状态良好。',
        sendText: '做得好，彩奈。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 4 }],
      },
    ],
  },
  {
    id: 'base:story:abydos_siesta',
    name: '星野的午睡',
    talklets: [
      {
        speaker: '星野',
        text: '呼……沙发真是人类最伟大的发明之一啊。老师要不要也躺一会？',
        sendText: '不行，工作还没做完。',
        effects: [
          { op: 'addResource', target: Resource.Credit, value: 6 },
          // 临时演出主题示例：这段剧情期间界面短暂切换为泳装星野的清凉蓝调
          { op: 'setTheme', target: '', value: { colorId: 'base:color:hoshino-swim' } },
        ],
      },
    ],
  },
  {
    id: 'base:story:abydos_serika_shift',
    name: '芹香的兼职',
    talklets: [
      {
        speaker: '芹香',
        text: '打工结束了！老师，今天便利店有过期便当，我顺便带了一些回来……省一点是一点嘛。',
        sendText: '辛苦了，芹香。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 3 }],
      },
    ],
  },
  {
    id: 'base:story:abydos_money',
    name: '还债日记',
    talklets: [
      {
        speaker: '野乃美',
        text: '这个月的还债计划比上个月多完成了 3%。老师，阿比多斯的债务正在一点点减少呢。',
        sendText: '一步一步来。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 7 }],
      },
    ],
  },
  // ============================================================
  // 千禧年学院 — 剧情
  // ============================================================
  {
    id: 'base:story:millennium_welcome',
    name: '数据与新生',
    talklets: [
      {
        kind: 'narration',
        text: '—— 千禧年学院 · 研究楼 ——',
      },
      {
        speaker: '优香',
        text: '老师，欢迎来到千禧年学院。我是财务担当早濑优香，这边是研究楼的数据分析站。',
        sendText: '效率很高，不愧是千禧年。',
      },
      {
        kind: 'narration',
        align: 'left',
        text: '* 优香翻开预算表，投影屏上跳出一串数据。*',
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
    talklets: [
      {
        speaker: '优香',
        text: '本期的信用点收入比上期增加了 8.5%。虽然数据很好看，但请不要因此放松管理。',
        sendText: '放心，优香。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 5 }],
      },
    ],
  },
  {
    id: 'base:story:millennium_game_dev',
    name: '游戏开发部的坚持',
    talklets: [
      {
        speaker: '美依',
        text: '姐姐，游戏引擎又崩溃了。不过别担心，数据都自动备份了。',
        sendText: '需要帮忙调试吗？',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 6 }],
      },
    ],
  },
  {
    id: 'base:story:millennium_hack',
    name: '小雪的恶作剧',
    talklets: [
      {
        speaker: '小雪',
        text: '嘿嘿，我发现了一个系统漏洞……不过老师放心，我只是用那个算力挖了一些信用点！',
        sendText: '记得报告给乃爱。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 8 }],
      },
    ],
  },
  {
    id: 'base:story:millennium_server',
    name: '服务器的秘密',
    talklets: [
      {
        speaker: '乃爱',
        text: '服务器机房的利用率已经达到了 94%。按照这个趋势，我们需要在下个月申请扩容预算。',
        sendText: '让优香批一下。',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 7 }],
      },
    ],
  },
  // ============================================================
  // Demo: Story 跳转链 + 条件奖励 + 重阅读守卫
  //   千禧年 · 游戏开发部的危机
  // ============================================================
  {
    id: 'base:story:millennium_game_crisis_intro',
    name: '游戏开发部的危机 · 开场',
    talklets: [
      {
        kind: 'narration',
        text: '—— 千禧年学院 · 游戏开发部 ——',
      },
      {
        speaker: '桃依',
        text: '老师！游戏引擎又出 bug 了！发行日期就在明天！',
        sendText: '冷静一下，桃依。',
      },
      {
        speaker: '美依',
        text: '姐姐说她自己能搞定，但已经连续调试 12 个小时了……',
        // insert：插入子剧情（美依的悄悄话），播完后返回本 Story 下一页。
        // 读取统一化：与普通 talk 一致逐页点击推进（引擎不再吸收纯展示页）。
        jumpToStory: 'base:story:millennium_game_crisis_whisper',
        jumpMode: 'insert',
      },
      {
        speaker: '老师',
        text: '好，我来想办法。',
        choices: [
          {
            text: '亲自上手调试',
            effects: [{ op: 'setFlag', target: 'game_crisis_route', value: 'debug' }],
            jumpToStory: 'base:story:millennium_game_crisis_debug',
          },
          {
            text: '买冰淇淋犒劳大家',
            effects: [{ op: 'setFlag', target: 'game_crisis_route', value: 'bribe' }],
            jumpToStory: 'base:story:millennium_game_crisis_bribe',
          },
        ],
      },
    ],
  },
  {
    id: 'base:story:millennium_game_crisis_whisper',
    name: '美依的悄悄话',
    talklets: [
      {
        speaker: '美依',
        text: '（小声）其实姐姐昨天偷偷哭了一场……她压力很大的。',
        noAvatar: true,
      },
      {
        speaker: '桃依',
        text: '（小声）别说出去啊老师！这是我们开发部的秘密！',
        noAvatar: true,
      },
    ],
  },
  {
    id: 'base:story:millennium_game_crisis_debug',
    name: '游戏开发部的危机 · 调试',
    talklets: [
      {
        speaker: '老师',
        text: '我看看这个报错……原来是内存泄漏。',
        sendText: '我来修。',
      },
      {
        speaker: '美依',
        text: '老师太厉害了！修好了！',
        // Talklet 级 goto：分支结局跳转到共同收尾
        jumpToStory: 'base:story:millennium_game_crisis_end',
      },
    ],
  },
  {
    id: 'base:story:millennium_game_crisis_bribe',
    name: '游戏开发部的危机 · 补给',
    talklets: [
      {
        speaker: '老师',
        text: '先吃点东西休息一下吧。',
        sendText: '我请客。',
      },
      {
        speaker: '桃依',
        text: '哇，是冰淇淋！吃完就有干劲了！',
        jumpToStory: 'base:story:millennium_game_crisis_end',
      },
    ],
  },
  {
    id: 'base:story:millennium_game_crisis_end',
    name: '游戏开发部的危机 · 收尾',
    talklets: [
      {
        speaker: '桃依',
        text: '游戏完成！明天一定能顺利发行！',
        effects: [{ op: 'addResource', target: Resource.Credit, value: 20 }],
      },
      {
        speaker: '美依',
        text: '感谢老师！没有你的话我们都不知道该怎么办了。',
        sendText: '这是老师应该做的。',
      },
    ],
  },
  // ============================================================
  // Demo: 全局顺序故事链 (hasReadStory)
  // ============================================================
  {
    id: 'base:story:serika_side_1',
    name: '芹香的烦恼 (上)',
    talklets: [
      {
        speaker: '芹香',
        text: '老师……其实我最近在便利店遇到了一点麻烦。有个顾客总是说我的找零不对。',
        sendText: '怎么回事？',
      },
      {
        speaker: '芹香',
        text: '我也不确定是不是自己的问题……但店长已经开始注意到了。',
        sendText: '我会帮你查清楚的。',
      },
      {
        kind: 'narration',
        align: 'left',
        text: '* 你翻开收银记录，一条条核对当晚的找零流水。*',
      },
      {
        speaker: '老师',
        text: '（调查中……）',
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
    talklets: [
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
  // ============================================================
  {
    id: 'base:story:run_chain_1',
    name: '深夜巡逻 (一)',
    talklets: [
      {
        kind: 'narration',
        text: '—— 深夜 · 夏莱走廊 ——',
      },
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
    talklets: [
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
    talklets: [
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
