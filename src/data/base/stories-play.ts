// ============================================================
// data/base/stories-play.ts — 演出本体（baseStories）
// 由 stories.ts 拆分而来，存储全部 story 演出内容。
// StoryDef 经 story() Builder + scene(line/narrate/click) 构造。
// ============================================================

import { story, line, narrate, click, talklet, Resource } from '../../engine/types';
import type { StoryDef } from '../../engine/types';

export const baseStories: StoryDef[] = [
  story('base:story:schale_welcome', '欢迎来到夏莱')
    .scene(
      narrate('—— 夏莱办公室 · 清晨 ——', 'center'),
      line('阿罗娜', '欢迎回来，老师。夏莱的设备已经准备好了。', '设备准备完毕，可以开始调度。', { mute: true }),
      line('老师', '那就先把这里运转起来吧。'),
      click('Arona检查了一下......。', 4, 2),
      narrate('* 阿罗娜在平板上划出设备清单，一项项核对。*', 'center'),
      line('老师', '清单确认完毕，可以开始调度了。')
        .choice('从整理办公室开始', { op: 'setFlag', target: 'welcome_choice', value: 'office' })
        .choice('先查看生产设备', { op: 'setFlag', target: 'welcome_choice', value: 'production' }),
      line('阿罗娜', '好的。设备会在每个 Tick 自动结算，资源足够后就能继续升级。')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 10 },
          { op: 'addItem', target: 'base:item:energy_drink', value: 1 },
          // 完成欢迎剧情后赠送战术指挥台
          { op: 'setSpotLevel', target: 'base:spot:tactical_desk', value: '1' },
        ),
    )
    .build(),

  story('base:story:schale_briefing', '设备简报')
    .scene(
      narrate('· 例行设备简报 ·'),
      line('阿罗娜', '设备状态稳定。今天也会按统一 Tick 继续工作。', '了解，阿罗娜。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 2 }),
    )
    .build(),

  // ============================================================
  // 主线 · 流剧场预演 —— 演示聊天流演出服务
  //   showChatText  : 可定位演出专用文本（临时 id + 百分比坐标）
  //   clearIdChatFlow: 按临时 id 擦除单条演出文本
  //   clearAllChatFlow: 清理整个聊天流（含演出文本）
  // ============================================================
  story('base:story:schale_flow_show', '流剧场预演')
    .scene(
      narrate('—— 夏莱 · 流剧场 ——', 'center')
        .effects({ op: 'showChatText', target: 'perf:title', value: { text: '夏莱 · 流剧场预演', x: 0.5, y: 0.88, align: 'center' } }),
      narrate('舞台灯光亮起，演出文本浮现在聊天窗格上。', 'left'),
      line('阿罗娜', '老师，这是「可定位的演出专用文本」。每个都带临时 id，可以单独擦除。', '我看到了，位置很精准。')
        .effects({ op: 'showChatText', target: 'perf:cast', value: { text: '—— 出演：阿罗娜 ——', x: 0.12, y: 0.7, align: 'left' } }),
      line('阿罗娜', '演出文本还能设置字型、颜色、背景、字号。你看这条衬线金字，无背景的注释。', '很雅致。')
        .effects(
          { op: 'showChatText', target: 'perf:gold', value: { text: '—— 深夜剧场 · 开幕 ——', x: 0.5, y: 0.75, align: 'center', style: { font: 'serif', fontSize: '26px', color: '#ffd700', backgroundColor: '#3a2a00' } } },
          { op: 'showChatText', target: 'perf:noBg', value: { text: '（无背景的弱化注释）', x: 0.3, y: 0.6, align: 'left', style: { background: false, color: '#8a8a8a' } } },
          { op: 'showChatText', target: 'perf:small', value: { text: '极小字号 · mono 等宽', x: 0.8, y: 0.85, align: 'right', style: { font: 'mono', fontSize: '10px', color: '#7fb3ff' } } },
        ),
      line('阿罗娜', '旁白还能自由换行：多行文本会按原文断行显示。', '一目了然。')
        .effects({
          op: 'showChatText',
          target: 'perf:multiline',
          value: {
            text: '—— 第一幕 · 开场 ——\n月光洒进夏莱的落地窗。\n远处传来学生的脚步声。',
            x: 0.5,
            y: 0.7,
            align: 'center',
            style: { font: 'sans', fontSize: '16px', color: '#e8e0d0', backgroundColor: '#26324a' },
          },
        }),
      line('阿罗娜', '比如这条在右下角的提示，稍后我会用它的 id 单独擦掉。', '好，期待你的操作。')
        .effects({ op: 'showChatText', target: 'perf:note', value: { text: 'TIP · 右下角提示', x: 0.85, y: 0.18, align: 'right' } }),
      narrate('阿罗娜挥了挥手，右下角那条提示消失了，其余文本仍在。', 'center')
        .effects({ op: 'clearIdChatFlow', target: 'perf:note', value: 0 }),
      line('阿罗娜', '接下来是全剧场清场。舞台上下的聊天内容都会被清空。', '见证一下。')
        .effects({ op: 'clearAllChatFlow', target: '', value: 0 }),
      narrate('—— 第二幕 · 清场之后 ——', 'center'),
      line('阿罗娜', '清场后只剩新写的文本。这就是「清理流」的用法。', '比想象中干净利落。')
        .effects({ op: 'showChatText', target: 'perf:act2', value: { text: '第二幕 · 重新开始', x: 0.5, y: 0.5, align: 'center' } }),
      line('阿罗娜', '还可以把一段完整的对话直接「贴」到窗格上，复用它的气泡样式。', '连头像和名字都有。')
        .effects({
          op: 'showChatText',
          target: 'perf:talklet',
          value: {
            talklet: { speaker: '阿罗娜', text: '定位气泡：这是被贴到窗格左下角的完整对话。', side: 'left' },
            x: 0.1,
            y: 0.15,
            align: 'left',
          },
        }),
      line('阿罗娜', '羁绊入口卡片也能这样定位。试试点它？', '我来点。')
        .effects({
          op: 'showChatText',
          target: 'perf:kizuna',
          value: {
            talklet: { speaker: '阿罗娜', text: '羁绊入口', kizuna: { storyId: 'base:story:run_chain_1', title: '羁绊剧情 · 深夜巡逻（一）', buttonText: '进入羁绊剧情' } },
            x: 0.5,
            y: 0.35,
            align: 'center',
          },
        }),
      line('阿罗娜', '以上就是流剧场预演的全部内容。演出文本清场，谢幕。', '辛苦了。')
        .effects({ op: 'clearAllChatFlow', target: '', value: 0 }),
    )
    .build(),

  story('base:story:schale_tea', '阿罗娜的茶点')
    .scene(
      line('阿罗娜', '老师，杯子里只剩下一层茶渍了。要不要我准备一些新茶？', '那就麻烦你了。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
    )
    .build(),

  story('base:story:schale_printer', '打印机的抱怨')
    .scene(
      line('阿罗娜', '信用点制造机又卡纸了……不过它其实只是在用这种方式抗议加班。', '让它休息一下吧。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
    )
    .build(),

  story('base:story:schale_archive', '档案室的尘埃')
    .scene(
      line('阿罗娜', '资料室的卷宗堆得比我还高了。老师，也许该归档一下？', '明天再说吧。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
    )
    .build(),

  story('base:story:schale_sunset', '窗边的晚霞')
    .scene(
      line('阿罗娜', '太阳要下山了。夏莱的窗户正好能看见整片晚霞。', '很适合停下来看看。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:schale_planner', '日程表攻防')
    .scene(
      line('阿罗娜', '老师，明天的日程已经排好了……虽然您八成会全部推迟。', '说得这么直白真的好吗。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
      line('阿罗娜', '那就把最难的报告安排在深夜时段吧——反正您那个时候反而很有精神！', '那就这么定了。')
        // 彩蛋链：开启深夜模式，解锁「深夜闲聊」池
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 2 },
          { op: 'setFlag', target: 'night_mode', value: '1' },
        ),
    )
    .build(),

  story('base:story:schale_vending', '贩卖机的秘密')
    .scene(
      line('阿罗娜', '走廊尽头的自动贩卖机，第三排的咖啡罐……其实是装了能量饮料的伪装版。', '谁干的？')
        .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
    )
    .build(),

  story('base:story:schale_night', '深夜的夏莱')
    .scene(
      line('阿罗娜', '老师，都这个时间了还不休息吗？……好吧，那我把台灯调暗一点。', '再十分钟就好。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
    )
    .build(),

  // ============================================================
  // 阿比多斯学院 — 剧情
  // ============================================================
  story('base:story:abydos_welcome', '沙漠中的学园')
    .scene(
      narrate('—— 阿比多斯学院 · 对策委员会室 ——'),
      line('白子', '……你来了。阿比多斯对策委员会，欢迎你的加入。', '请多关照，白子。'),
      narrate('* 门边探出半个脑袋，星野正打着哈欠。*', 'right'),
      line('星野', '呼啊～又多了一个人呢。不过大叔我今天想偷懒……让野乃美带你转转吧。', '星野前辈，请认真一点！'),
      line('野乃美', '老师，这边是校舍和泳池。虽然设施有点旧了，但大家都很努力在维护。', '先从校舍开始视察吧。')
        .choice('先去对策委员会室看看', { op: 'setFlag', target: 'abydos_choice', value: 'committee' })
        .choice('去泳池那边巡逻', { op: 'setFlag', target: 'abydos_choice', value: 'pool' }),
      line('芹香', '老师，请多帮忙了！我们一定会把学园恢复成以前的样子！')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 15 },
          { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
        ),
    )
    .build(),

  story('base:story:abydos_daily_committee', '对策委员会的日常')
    .scene(
      line('彩奈', '今天的巡逻报告都整理好了。野乃美前辈说沙漠方向的设备状态良好。', '做得好，彩奈。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
    )
    .build(),

  story('base:story:abydos_siesta', '星野的午睡')
    .scene(
      line('星野', '呼……沙发真是人类最伟大的发明之一啊。老师要不要也躺一会？', '不行，工作还没做完。')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 6 },
          // 临时演出主题示例：这段剧情期间界面短暂切换为泳装星野的清凉蓝调
          { op: 'setTheme', target: '', value: { colorId: 'base:color:hoshino-swim' } },
        ),
    )
    .build(),

  story('base:story:abydos_serika_shift', '芹香的兼职')
    .scene(
      line('芹香', '打工结束了！老师，今天便利店有过期便当，我顺便带了一些回来……省一点是一点嘛。', '辛苦了，芹香。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
    )
    .build(),

  story('base:story:abydos_money', '还债日记')
    .scene(
      line('野乃美', '这个月的还债计划比上个月多完成了 3%。老师，阿比多斯的债务正在一点点减少呢。', '一步一步来。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 7 }),
    )
    .build(),

  // ============================================================
  // 千禧年学院 — 剧情
  // ============================================================
  story('base:story:millennium_welcome', '数据与新生')
    .scene(
      narrate('—— 千禧年学院 · 研究楼 ——'),
      line('优香', '老师，欢迎来到千禧年学院。我是财务担当早濑优香，这边是研究楼的数据分析站。', '效率很高，不愧是千禧年。'),
      narrate('* 优香翻开预算表，投影屏上跳出一串数据。*', 'left'),
      line('乃爱', '根据优香前辈的预算表，实验室的信用点产出效率还有 12% 的优化空间。', '那就先从优化开始吧。')
        .choice('让优香负责财务优化', { op: 'setFlag', target: 'millennium_choice', value: 'yuuka' })
        .choice('去游戏开发部看看', { op: 'setFlag', target: 'millennium_choice', value: 'game' }),
      line('桃依', '老师老师！我们的游戏马上就要完成了！啊，不过在这之前得先把信用点赚够……')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 12 },
          { op: 'addItem', target: 'base:item:data_chip', value: 2 },
        ),
    )
    .build(),

  story('base:story:millennium_calculation', '优香的财务报告')
    .scene(
      line('优香', '本期的信用点收入比上期增加了 8.5%。虽然数据很好看，但请不要因此放松管理。', '放心，优香。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:millennium_game_dev', '游戏开发部的坚持')
    .scene(
      line('美依', '姐姐，游戏引擎又崩溃了。不过别担心，数据都自动备份了。', '需要帮忙调试吗？')
        .effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
    )
    .build(),

  story('base:story:millennium_hack', '小雪的恶作剧')
    .scene(
      line('小雪', '嘿嘿，我发现了一个系统漏洞……不过老师放心，我只是用那个算力挖了一些信用点！', '记得报告给乃爱。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 8 }),
    )
    .build(),

  story('base:story:millennium_server', '服务器的秘密')
    .scene(
      line('乃爱', '服务器机房的利用率已经达到了 94%。按照这个趋势，我们需要在下个月申请扩容预算。', '让优香批一下。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 7 }),
    )
    .build(),

  // ============================================================
  // Demo: Story 跳转链 + 条件奖励 + 重阅读守卫
  //   千禧年 · 游戏开发部的危机
  // ============================================================
  story('base:story:millennium_game_crisis_intro', '游戏开发部的危机 · 开场')
    .scene(
      narrate('—— 千禧年学院 · 游戏开发部 ——'),
      line('桃依', '老师！游戏引擎又出 bug 了！发行日期就在明天！', '冷静一下，桃依。'),
      // insert：插入子剧情（美依的悄悄话），播完后返回本 Story 下一页。
      // 读取统一化：与普通 talk 一致逐页点击推进（引擎不再吸收纯展示页）。
      line('美依', '姐姐说她自己能搞定，但已经连续调试 12 个小时了……').jump('base:story:millennium_game_crisis_whisper', 'insert'),
      line('老师', '好，我来想办法。')
        .choiceJump('亲自上手调试', 'base:story:millennium_game_crisis_debug', 'goto', {
          op: 'setFlag', target: 'game_crisis_route', value: 'debug',
        })
        .choiceJump('买冰淇淋犒劳大家', 'base:story:millennium_game_crisis_bribe', 'goto', {
          op: 'setFlag', target: 'game_crisis_route', value: 'bribe',
        }),
    )
    .build(),

  story('base:story:millennium_game_crisis_whisper', '美依的悄悄话')
    .scene(
      line('美依', '（小声）其实姐姐昨天偷偷哭了一场……她压力很大的。', undefined, { noAvatar: true }),
      line('桃依', '（小声）别说出去啊老师！这是我们开发部的秘密！', undefined, { noAvatar: true }),
    )
    .build(),

  story('base:story:millennium_game_crisis_debug', '游戏开发部的危机 · 调试')
    .scene(
      line('老师', '我看看这个报错……原来是内存泄漏。', '我来修。'),
      // Talklet 级 goto：分支结局跳转到共同收尾
      line('美依', '老师太厉害了！修好了！').jump('base:story:millennium_game_crisis_end'),
    )
    .build(),

  story('base:story:millennium_game_crisis_bribe', '游戏开发部的危机 · 补给')
    .scene(
      line('老师', '先吃点东西休息一下吧。', '我请客。'),
      line('桃依', '哇，是冰淇淋！吃完就有干劲了！').jump('base:story:millennium_game_crisis_end'),
    )
    .build(),

  story('base:story:millennium_game_crisis_end', '游戏开发部的危机 · 收尾')
    .scene(
      line('桃依', '游戏完成！明天一定能顺利发行！')
        .effects({ op: 'addResource', target: Resource.Credit, value: 20 }),
      line('美依', '感谢老师！没有你的话我们都不知道该怎么办了。', '这是老师应该做的。'),
    )
    .build(),

  // ============================================================
  // Demo: 全局顺序故事链 (hasReadStory)
  // ============================================================
  story('base:story:serika_side_1', '芹香的烦恼 (上)')
    .scene(
      line('芹香', '老师……其实我最近在便利店遇到了一点麻烦。有个顾客总是说我的找零不对。', '怎么回事？'),
      line('芹香', '我也不确定是不是自己的问题……但店长已经开始注意到了。', '我会帮你查清楚的。'),
      narrate('* 你翻开收银记录，一条条核对当晚的找零流水。*', 'left'),
      // 多击任务：连续点击 4-5 次（base 4 + rand 0..1）完成"调查"，进度条填满后才推进
      line('老师', '（调查中……）')
        .click(4, 2)
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:serika_side_2', '芹香的烦恼 (下)')
    .scene(
      line('老师', '芹香，我查过了——那个顾客在好几家便利店都投诉过找零问题，是惯犯了。', '真的吗？'),
      line('芹香', '原来不是我的错……太好了。谢谢老师专门去调查！', '不用谢，这是老师应该做的。')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 8 },
          { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
        ),
    )
    .build(),

  // ============================================================
  // Demo: 当前 Run 内逐一揭示的故事链 (hasReadStoryInRun)
  // ============================================================
  story('base:story:run_chain_1', '深夜巡逻 (一)')
    .scene(
      narrate('—— 深夜 · 夏莱走廊 ——'),
      line('阿罗娜', '老师，这么晚了还不休息吗？走廊里的灯已经调暗了。', '我想再巡视一圈。'),
      line('阿罗娜', '那我和你一起去。两人走比一个人安全。', '走吧，阿罗娜。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:run_chain_2', '深夜巡逻 (二)')
    .scene(
      line('阿罗娜', '档案室的门开着。我记得下班前明明锁好了的……', '进去看看。'),
      line('阿罗娜', '啊，只是窗户没关好，风吹开了门。吓我一跳呢。', '虚惊一场。关好窗户吧。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
    )
    .build(),

  story('base:story:run_chain_3', '深夜巡逻 (三)')
    .scene(
      line('阿罗娜', '天快亮了。老师，巡逻结束了，一切都正常。', '辛苦了，阿罗娜。'),
      line('阿罗娜', '老师才辛苦了。明天也请多多指教。', '晚安（早安），阿罗娜。')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 10 },
          { op: 'addItem', target: 'base:item:energy_drink', value: 2 },
        ),
    )
    .build(),

  story('base:story:hoshino_tea_time', '星野的茶点时间')
    // 星野对话空间专属演出（壁垒示例）。不复用全局「窗边的晚霞」，以直观验证壁垒生效。
    .scene(
      line('小鸟游星野', '老师，茶要趁热喝哦。食堂今天的点心也特别好吃。', '那我不客气了。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
      line('小鸟游星野', '嘿嘿，能和老师一起喝茶，感觉一天都会很顺利呢。', '我也是。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:hoshino_rooftop_hint', '星野的天台邀约')
    // 星野对话空间专属演出（壁垒示例）。不复用全局「窗边的晚霞」，以直观验证壁垒生效。
    .scene(
      line('小鸟游星野', '老师……天台的风景，现在一定很好看吧。', '想去看看。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
      // 邀约发出：聊天空间锁定，要求玩家前往天台（block 由 hoshino_conv_2 声明）
      line('小鸟游星野', '那、那我去天台等您。您也来吗？……不来我也不怪您哦。', '这就来。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  story('base:story:hoshino_rooftop_meet', '天台的相遇')
    // 天台相遇剧情（区域事件驱动，独立于聊天空间邀约）。
    // 由天台 Trigger（进入 base:area:schale_rooftop）启动，避免与邀约重复触发。
    .scene(
      line('小鸟游星野', '老师，您真的来了……！晚霞把天空染成橘色，像我们第一次见面那天一样。', '我答应过你呀。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 10 }),
      line('小鸟游星野', '……能和老师并肩看这片晚霞，就是我最想做的事。', '以后也要一起来。')
        .effects(
          { op: 'addResource', target: Resource.Credit, value: 10 },
          // 会话过程中移动到其他 Area：不判拓扑、仅限同 Init，notice=true 显示「移动到了 夏莱图书馆」
          { op: 'travelToArea', target: 'base:area:schale_main', value: 0, notice: true },
        ),
      line('小鸟游星野', '天台风大，我们去图书馆吧。那里有你说的那本旧童话……我还想听老师讲一遍。', '好，边走边讲。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 10 }),
    )
    .build(),

  // ============================================================
  // Demo: 图片系统 —— 星野自拍
  //   Talklet.avatar 与 Talklet.image 使用 `mod:type(pic):id` 三段式索引，
  //   由 pics 表（pics-assets.ts）解析成真实图片（见 docs-824/07-pic-assets.md）。
  // ============================================================
  story('base:story:hoshino_selfie', '星野的自拍')
    .scene(
      line('小鸟游星野', '老师老师！给你看我刚拍的自拍！', '哦？我看看。', { avatar: 'base:avatar(pic):hoshino', image: 'base:sticker(pic):hoshino_selfie' })
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
      line('小鸟游星野', '嘿嘿，是不是超可爱？下次也帮老师拍一张！', '好呀，那就说定了。')
        .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    )
    .build(),

  // ============================================================
  // 羁绊邀请：被动闲聊内触发羁绊剧情（clickWork + jumpToStory）
  // ============================================================
  story('base:story:hoshino_bond_invite', '羁绊邀请')
    .scene(
      narrate('——星野似乎有话想说……——', 'center'),
      line('星野', '老师，有件事想跟你说……', '嗯？什么事？'),
      talklet('星野酝酿了一下情绪……')
        .kizunaCard('base:bond:hoshino_evening', { title: '傍晚的河堤', buttonText: '进入羁绊剧情' }),
    )
    .build(),
];