import { story, line, narrate, click } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseSchaleMainStories: StoryDef[] = [
  story('base:story:schale_welcome', '欢迎来到夏莱').scene(
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
        { op: 'setSpotLevel', target: 'base:spot:tactical_desk', value: '1' },
      ),
  ).build(),
  story('base:story:schale_briefing', '设备简报').scene(
    narrate('· 例行设备简报 ·'),
    line('阿罗娜', '设备状态稳定。今天也会按统一 Tick 继续工作。', '了解，阿罗娜。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 2 }),
  ).build(),
  story('base:story:schale_flow_show', '流剧场预演').scene(
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
    line('阿罗娜', '旁白还能自由换行：多行文本会按原文断行显示。', '一目了然。').effects({ op: 'showChatText', target: 'perf:multiline', value: { text: '—— 第一幕 · 开场 ——\n月光洒进夏莱的落地窗。\n远处传来学生的脚步声。', x: 0.5, y: 0.7, align: 'center', style: { font: 'sans', fontSize: '16px', color: '#e8e0d0', backgroundColor: '#26324a' } } }),
    line('阿罗娜', '比如这条在右下角的提示，稍后我会用它的 id 单独擦掉。', '好，期待你的操作。').effects({ op: 'showChatText', target: 'perf:note', value: { text: 'TIP · 右下角提示', x: 0.85, y: 0.18, align: 'right' } }),
    narrate('阿罗娜挥了挥手，右下角那条提示消失了，其余文本仍在。', 'center').effects({ op: 'clearIdChatFlow', target: 'perf:note', value: 0 }),
    line('阿罗娜', '接下来是全剧场清场。舞台上下的聊天内容都会被清空。', '见证一下。').effects({ op: 'clearAllChatFlow', target: '', value: 0 }),
    narrate('—— 第二幕 · 清场之后 ——', 'center'),
    line('阿罗娜', '清场后只剩新写的文本。这就是「清理流」的用法。', '比想象中干净利落。').effects({ op: 'showChatText', target: 'perf:act2', value: { text: '第二幕 · 重新开始', x: 0.5, y: 0.5, align: 'center' } }),
    line('阿罗娜', '还可以把一段完整的对话直接「贴」到窗格上，复用它的气泡样式。', '连头像和名字都有。').effects({ op: 'showChatText', target: 'perf:talklet', value: { talklet: { speaker: '阿罗娜', text: '定位气泡：这是被贴到窗格左下角的完整对话。', side: 'left' }, x: 0.1, y: 0.15, align: 'left' } }),
    line('阿罗娜', '羁绊入口卡片也能这样定位。试试点它？', '我来点。').effects({ op: 'showChatText', target: 'perf:kizuna', value: { talklet: { speaker: '阿罗娜', text: '羁绊入口', kizuna: { storyId: 'base:activestory:run_chain_1', title: '羁绊剧情 · 深夜巡逻（一）', buttonText: '进入羁绊剧情' } }, x: 0.5, y: 0.35, align: 'center' } }),
    line('阿罗娜', '以上就是流剧场预演的全部内容。演出文本清场，谢幕。', '辛苦了。').effects({ op: 'clearAllChatFlow', target: '', value: 0 }),
  ).build(),
  story('base:story:schale_theme_lite_test', '夏莱主厅·主题演出压力测试').scene(
    narrate('—— 夏莱主厅 · 主题演出压力测试 ——', 'center').effects(
      { op: 'setTheme', target: '', value: {
        colorGroupId: 'base:colorgroup:coral',
        palette: ['#ff7a59', '#ffd166', '#fff3ee'],
        nodes: { primary: '#ff7a59', accent: '#d94841', active: '#f59e0b', highlight: '#ffe08a' },
        background: [
          { id: 'scene', kind: 'gradient', value: 'linear-gradient(135deg, #fff3ee 0%, #ffe0c7 48%, #fff7d6 100%)', opacity: 1, position: 'center', size: 'cover', attachment: 'fixed' },
          { id: 'theme-test-glow', kind: 'gradient', value: 'radial-gradient(circle at 82% 20%, #ffffff 0%, transparent 42%)', opacity: 0.9, position: 'center', size: 'cover', attachment: 'fixed' },
        ],
      } },
      { op: 'showChatText', target: 'theme-test:banner', value: { text: 'THEME LITE / OPEN', x: 0.5, y: 0.12, align: 'center', style: { font: 'mono', fontSize: '13px', color: '#8a3b12', backgroundColor: '#fff1df' } } },
    ),
    line('阿罗娜', '老师，欢迎来到主题演出压力测试。当前先覆盖夏莱主厅的全屏背景、聊天气泡和状态色。', '开始测试。'),
    narrate('场景一：基础覆盖。主题临时层应高于主厅默认主题。', 'left'),
    line('阿罗娜', '这一页会再次写入同一个剧情主题槽，检查重复设定是否完整重写，而不是偷偷叠加旧值。', '继续。').effects(
      { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:momotalk-pink', tokens: { primary: '#db2777', bg: '#fff1f7', playerBubble: '#9d174d' }, nodes: { active: '#be185d' } } },
    ),
    click('场景二：多击页面。用于观察主题覆盖期间的进度条、按钮 active 与禁用态。', 3, 2),
    narrate('隐藏的配置页也完成了。它只推进演出，不应该改变跳转链和主题 Owner。', 'center').effects(
      { op: 'showChatText', target: 'theme-test:hidden', value: { text: 'hidden talklet counted', x: 0.18, y: 0.76, align: 'left', style: { background: false, color: '#9d174d', font: 'mono', fontSize: '11px' } } },
    ),
    line('老师', '现在测试范围裁定：你想把临时主题送进哪条演出分支？')
      .choiceJump('插入一段短演出，之后回到主线', 'base:story:schale_theme_lite_insert', 'insert', { op: 'setFlag', target: 'theme_test_route', value: 'insert' })
      .choiceJump('直接切换到收束分支', 'base:story:schale_theme_lite_finish', 'goto', { op: 'setFlag', target: 'theme_test_route', value: 'goto' }),
    line('阿罗娜', '插入返回或 goto 转移都不应重置主题计时；回到这里后我们继续验证剩余层的恢复。', '我记下了。').effects(
      { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:sky', background: [{ id: 'scene', kind: 'gradient', value: 'linear-gradient(135deg, #e0f2fe, #dbeafe)', opacity: 1, position: 'center', size: 'cover', attachment: 'fixed' }] } },
    ),
    narrate('场景三：覆盖层撤回后的恢复。主厅默认主题、区域主题与仍有效的演出层应重新解析。', 'center'),
    line('阿罗娜', '最后清理演出专用文本。主题结果应该只剩夏莱主厅自己的声明，不写入玩家主题槽。', '测试完成。').effects(
      { op: 'clearIdChatFlow', target: 'theme-test:banner', value: 0 },
      { op: 'clearIdChatFlow', target: 'theme-test:hidden', value: 0 },
      { op: 'clearAllChatText', target: '', value: 0 },
    ),
  ).build(),
  story('base:story:schale_theme_lite_insert', '夏莱主题测试·插入支线').scene(
    narrate('—— 插入支线：局部 Host / Region 检查 ——', 'center').effects(
      { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:ink', tokens: { panel: '#101828', text: '#eef2ff', bg: '#0f172a' }, nodes: { active: '#38bdf8', highlight: '#a5f3fc' } } },
    ),
    line('阿罗娜', '这是 insert 子剧情。深色临时主题只属于当前演出上下文，返回主线时应由剩余层重新解析。', '继续观察。'),
    narrate('插入支线结束，返回主线。', 'center'),
  ).build(),
  story('base:story:schale_theme_lite_finish', '夏莱主题测试·直接收束').scene(
    narrate('—— goto 分支：直接收束 ——', 'center').effects(
      { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:indigo', nodes: { primary: '#4f46e5', active: '#22d3ee', danger: '#fb7185' }, background: [{ id: 'scene', kind: 'gradient', value: 'linear-gradient(135deg, #eef2ff, #cffafe)', opacity: 1, position: 'center', size: 'cover', attachment: 'fixed' }] } },
    ),
    line('阿罗娜', 'goto 分支会直接结束原 Story 的剩余页面。请检查主题清理仍然走统一的 execution disposal。', '确认收束。'),
  ).build(),
];
import { Resource } from '../types/ids';
