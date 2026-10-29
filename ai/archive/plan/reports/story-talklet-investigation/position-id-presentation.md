# reports/story-talklet-investigation/position-id-presentation — 定位、临时 ID、覆盖层与演出效果

本文回答：用户记忆中的“Talklet 可定位、可按 ID 控制、可附加样式和卡片”究竟由哪些现行契约与运行链提供，以及它们与单个 Story 页的执行有何区别。

调查日期：2026-10-22。依据为当前工作树源码与测试文本，包含尚未提交的并行工作；不是某个发布版本的保证。本分册 Agent 只研究和编写文档，未修改产品实现，未独立运行测试、未执行浏览器验收。以下“测试覆盖”首先表示已阅读对应断言；根 Agent 的本轮联合验证结果另列于第 13 节。历史 Draft 未作为当前实现依据。

## 1. 核心结论与术语

用户记忆中的能力确实存在。它不是 `Talklet` 本体直接拥有 `x/y/id/style` 字段，而是由 **Talklet 页上的 `effects` 声明 `showChatText`，其 `value` 包装演出内容**。包装器可以嵌入另一个 Talklet，复用标准气泡、旁白或羁绊卡片的外观。

应分清四种身份：

| 身份 | 实际字段 | 用途 | 是否能互换 |
| --- | --- | --- | --- |
| Story 作者页 | `StoryDef.talklets[index]` | 播放次序、已读页、页效果和选项 | 作者 Talklet 没有稳定 `id` |
| 定位演出对象 | `Effect.target → ChatTextEntry.id` | 同 ID 更新、按 ID 擦除 | 不是 Story 页身份 |
| 聊天历史实例 | `ChatEntry.id`，数值 | 消息实例与协调 | 不是演出临时 ID |
| Flow 逻辑内容/实例 | `contentId / instanceKey` | 显式回收、DOM 协调 | 与覆盖层的 ID 不共用数据结构或 reducer |

定位覆盖层不是另一条 Story 执行游标。嵌入 Talklet 的 `effects / choices / clickWork / jumpToStory / typing / thinking` 不会因为出现在覆盖层里而被执行。

## 2. 证据索引

路径链接相对于本分册；行号为本次读取时的定位线索，后续并行改动可能使其移动。

| 来源 | 关键符号与位置 | 证明什么 |
| --- | --- | --- |
| [chat-presentation.ts](../../../../src/engine/contracts/chat-presentation.ts) | `ChatTextKind`、`ChatTextFont`、`ChatTextStyle`、`ChatTextEffectValue` | 包装器字段全集 |
| [talklet.ts](../../../../src/engine/contracts/talklet.ts) | `EngineTalklet`，1–10 | 引擎只规定最小演出载荷，允许附加字段 |
| [expression.ts](../../../../src/engine/types/expression.ts) | `EffectOp`，约 109–141；`ThemeEffectValue`，约 154 | 五种演出 op 和主题/表现 effect |
| [effect-engine.ts](../../../../src/engine/effect/effect-engine.ts) | `applyEffects / resolveValue` | Runtime op 与状态写入分流 |
| [runtime-wiring.ts](../../../../src/arona-clicker/runtime/runtime-wiring.ts) | `new EffectEngine`，约 120–142 | 演出 op 转请求事件 |
| [runtime-effect-reactor.ts](../../../../src/arona-clicker/services/runtime/runtime-effect-reactor.ts) | `onEvent`，约 24–71 | 请求事件转领域桥接服务 |
| [chat-flow-service.ts](../../../../src/arona-clicker/services/story/chat-flow-service.ts) | 全文，尤其 20–41 | 仅发事件，不写 PlayerState |
| [controller-events.ts](../../../../src/ui/controller/controller-events.ts) | 约 109–184 | 活跃流路由、默认坐标、开始/结束清理、横幅 |
| [chat-stream.ts](../../../../src/ui/presentation/chat-stream.ts) | `activeChatTexts / clearAll / clearAllTexts / pushChatText / clearChatText`，约 285–335 | 存储与 ID 更新/删除 |
| [story.ts](../../../../src/ui/components/story/story.ts) | `ChatTextEntry`，59–84；`renderChatTexts` 至 `renderKizunaCard`，408–521 | 定位、样式、模板与嵌入呈现 |
| [codex.css](../../../../src/ui/css/codex.css) | `.chat-text-overlay`，约 307–397 | 定位、锚点、点击、多行与视觉模板 |
| [center-panel.ts](../../../../src/ui/components/shared/center-panel.ts) | `renderChatTab`，约 75–93 | 覆盖层位于 `.chat-pane`，在滚动流之外 |
| [controller-core.ts](../../../../src/ui/controller/controller/controller-core.ts) | `resetSessionPanel / withHistories / restoreHistories`，143–206 | 覆盖层不入历史保存 |
| [story-schale-main.ts](../../../../src/arona-clicker/content/story/story-schale-main.ts) | `schale_flow_show`，约 26–46；`schale_theme_lite_test`，约 48–100 | 正式内容演示 |

## 3. 包装器完整能力矩阵

### 3.1 `ChatTextEffectValue`

| 字段 | 类型/默认 | 执行/渲染语义 | 限制与相互作用 |
| --- | --- | --- | --- |
| `text` | 可选字符串；显示时回退空串 | 无 `talklet` 时渲染直接文本 | 有 `talklet` 时不用于正文；不是 HTML |
| `talklet` | 可选 `EngineTalklet` | UI 作为领域 Talklet 的呈现片段使用 | 只渲染，不能据此执行嵌入页的剧情行为 |
| `x` | 可选数值；UI 默认 0 | 容器横向锚点；0 左、1 右 | 渲染时夹取 0..1，再四舍五入到整数百分比 |
| `y` | 可选数值；UI 默认 1 | 容器纵向锚点；0 下、1 上 | 使用 CSS `bottom`，不是 top；同样夹取和取整 |
| `align` | left/center/right；默认 left | 内容相对锚点水平位移 | 是包装器对齐；与嵌入旁白自己的 `align` 不同 |
| `kind` | default/kizuna/title/badge/note；默认分支 default | 选择直接文本视觉模板 | 有 `talklet` 时模板分支不使用这个字段 |
| `style` | 可选 `ChatTextStyle` | 内联注入到实际展示元素 | 羁绊卡片分支不传递该内联样式 |
| `title` | 可选字符串 | 无嵌入、kind=kizuna 时用于卡片标题 | 普通文本/title 模板的正文仍来自 `text` |
| `buttonText` | 可选字符串 | 无嵌入、kind=kizuna 时用于卡片按钮 | 嵌入卡片使用内层 `kizuna.buttonText` |
| `targetStoryId` | 可选字符串 | 直接卡片目标；或让嵌入片段走卡片渲染分支 | 实际交互对象是 ActiveStoryEntry，不能与 StoryDef 跳转混同 |

`EngineTalklet` 的显式字段只有 `text`、可选 `speaker/avatar/image`，并有 `[key: string]: unknown`，因此领域 `kind/side/kizuna` 可以穿过事件链。该开放索引说明引擎不理解这些领域字段，不代表所有字段会被 UI 消费。

### 3.2 `ChatTextStyle`

| 字段 | 可声明值 | 当前行为 |
| --- | --- | --- |
| `font` | default / serif / sans / mono / handwritten | default 和未知运行时字符串回退 inherit；其余映射预置字体栈 |
| `fontSize` | 字符串 | 原样拼为 `font-size`，未在该函数限制单位/范围 |
| `color` | 字符串 | 原样拼为 `color` |
| `backgroundColor` | 字符串 | 拼为 `background` |
| `background` | 布尔 | 只有 false 分支有特殊处理：transparent、透明边框、无阴影；true 不添加强制背景 |

`backgroundColor` 先写，`background:false` 后写，因此二者同在时透明设置覆盖前者。字体栈：serif=Georgia/Noto Serif SC/Songti SC；sans=Segoe UI/Noto Sans SC/PingFang SC；mono=DM Mono/JetBrains Mono/Consolas；handwritten=Comic Sans MS/KaiTi/楷体。

**边界记录：**正文与对象 ID 经过 `escapeHtml`，但 `overlayInlineStyle` 拼接 CSS 字符串、`renderOverlayText`/`renderTalk` 再拼进 style 属性。该局部链没有与 FlowMarks 同等的属性白名单或 CSS 值校验。这里只记录源码事实，不据此断言完整导入链是否允许不可信值通过，也未进行攻击测试。

## 4. 五种演出操作的真实含义

| op | target | value | 当前结果 |
| --- | --- | --- | --- |
| `showChatText` | 演出临时 ID | 包装器 | 在 UI 当前活跃流的覆盖层集合新增或替换 |
| `clearIdChatFlow` | 临时 ID | 忽略 | 删除当前活跃流的一个匹配覆盖层；不删除普通聊天历史 |
| `clearAllChatText` | 忽略 | 忽略 | 清空当前活跃流全部覆盖层；保留普通聊天历史 |
| `clearAllChatFlow` | 实现不读取 | 忽略 | 清空当前活跃流历史及覆盖层，取消该流 gate 和 autoAdvance |
| `showOpeningTitle` | 忽略 | 非空字符串可指定标题 | 向当前活跃流写入 3 秒横幅状态；不是普通 ChatTextEntry |

`clearAllChatFlow` 的 TSDoc 写着 target 可指定 VariantId；`runtime-content-reference-rules.ts` 约 342 行也把非空 target 当角色引用。然而 `RuntimeEffectReactor` 调用无参 `ChatFlowService.clearAll()`，事件也不携带目标，UI 仅清当前活跃流。这是**声明/引用检查与运行行为的明确差异**，不能向未来编辑器承诺“填 target 可清任意学生的流”。

`Effect.owner` 也没有被 chat-flow 分支传到 UI。`chatTextShown / chatTextCleared / chatFlowCleared / openingTitleShown` 事件不包含 owner/streamKey。即使该 Effect 来自后台 owner 的 Story 游标，当前这条事件链仍按触发时 UI 的 `conversationVariantId` 选集合。跨 owner 定位演出正确性需后续专门测试，不能从 Story 的游标隔离推断覆盖层也同样隔离。

## 5. 完整执行链与数据流

```text
Story 页 effects / choice.effects / 其他 Effect 调用者
  → EffectEngine.applyEffects
    → Runtime 注入 handler：chatFlowEffectRequested
      → RuntimeEffectReactor.onEvent
        → ChatFlowService.showText/clearId/clearAll/clearAllTexts/showOpeningTitle
          → EventBus：chatTextShown / chatTextCleared / ...
            → controller-events
              → ChatStream 对 PanelState 活跃集合进行操作
              → refreshChatPanel（show/clearId 路径）
                → renderChatTexts
                  → renderOverlayText 或 renderOverlayTalklet
```

这里是运行时调用/事件数据流，不是静态 import 图。Runtime handler 对这五个 op 返回 true，所以它们不走 PlayerState mutation；mutation 的对应 case 也是 no-op。服务本身只发事件。因此没有 UI 订阅者时，产生事件不等于已经有可见演出。

普通 Story 页的 effects 通常离开该页时执行；因此“在某页声明一个 showChatText”不等于该页初次可见时就已经显示。`showOpeningTitle` 首页特例见第 9 节。

## 6. 定位坐标、锚点和宿主

- `.chat-pane` 是实际宿主；覆盖层与 `.chat-stream` 是同层元素。覆盖层不在历史滚动内容内部，滚动历史不会使其一起移动。
- x/y 是相对宿主的百分比坐标，非屏幕坐标、非地图坐标、非像素；(0,0)=左下，(1,1)=右上。
- `Math.round(clamp(x)*100)` 使 0.1234 最终成为 12%；精度约为宿主尺寸的 1%。有限范围内越界会夹取；NaN 等非有限值没有在该函数专门处理。
- 包装器 `.align-center` 向左位移内容宽度一半；right 向左位移内容全宽；三种对齐都带 `translateY(50%)`，使锚点对齐内容垂直中线。
- `.chat-text-overlay` 是 absolute、max-width 70%、z-index 5；普通内容 `pointer-events:none`；仅内部 `.kizuna-card` 恢复 pointer-events:auto。
- 多行显示由 `white-space:pre-line` 提供。直接文本、title/badge/note、嵌入旁白和气泡段落均有对应 CSS。
- 未见该包装器字段提供旋转、缩放、显式尺寸、z-index、碰撞布局、时间轴、淡入淡出或拖动编辑。这不排除其他主题/背景系统有自己的布局功能，但不是本接口的字段能力。

## 7. 临时 ID、更新与清理

`ChatStream.activeChatTexts()` 返回 `chatTexts` 或 `studentChatTexts[conversationVariantId]`。同一 ID 在不同集合可并存；UI 切换对话空间后读取对应集合。

`pushChatText` 对当前集合 `findIndex(t.id===entry.id)`：命中即整条替换，并不尾插，也不合并字段。未命中才 push。更新后旧字段若未重新声明会消失，数组位置保持；也没有设置普通 Flow 的 200 条上限。

`clearChatText` 删除首次匹配；标准写入路径通常保证同集合一个 ID。空字符串 ID 未在该局部写入函数拒绝。对象 ID 不承担 Story 已读、页去重、insert 返回点或逻辑 Flow 替换语义。

清理时机：

| 触发 | 范围 | 是否清历史 |
| --- | --- | --- |
| `clearIdChatFlow` | 当前活跃集合的指定 ID | 否 |
| `clearAllChatText` | 当前活跃集合 | 否 |
| `clearAllChatFlow` | 当前活跃流+覆盖层，取消 gate/autoAdvance | 是 |
| `storyTriggered` | 当前活跃覆盖层集合 | 否 |
| `storyCompleted` | 当前活跃覆盖层集合 | 否 |
| `resetSessionPanel` | 全局及全部学生集合、聊天状态和横幅 | 是，会话重置 |

`storyCompleted` 是正常完成事件。重读模式不发此事件，因此不能声称“每次重播到结尾都会自动清覆盖层”；本轮阅读到的 engine 测试专门验证这一差异。内容自身仍可用显式 clear effect 收尾。

## 8. 嵌入 Talklet 的呈现决策表

| 条件（按优先级） | 实际呈现 | 消费字段 | 不消费/未执行 |
| --- | --- | --- | --- |
| 有 `talklet.kizuna` 或外层 `targetStoryId` | 羁绊卡片 | 内层 kizuna 或外层目标，内层标题/按钮 | 内层正文/头像、样式 inline、内层 kizuna.align 没有透传 |
| 内层 kind=narration | 旁白 | text、内层 align、外层 style | avatar/image/side；剧情执行字段 |
| 其他内层 kind，包括 click | 标准 talk 气泡 | speaker/text/avatar/image/side/noAvatar，外层 style | click 不成为点击阻塞；showAvatar 未透传；choices/effects/jump/typing/thinking 不执行 |
| 无 talklet，kind=kizuna | 羁绊卡片 | targetStoryId/title/buttonText | 直接 text、inline style |
| 无 talklet，其他 kind | default/title/badge/note | text、style | title/buttonText 不作为通用文本标题使用 |

因此它可以显示“带图片的定位气泡”和“可点击进入剧情的定位卡片”，但不能凭嵌套 Talklet 就获得一个嵌套 Story 执行器。卡片交互由 `data-kizuna` → `bindStoryActions` → 确认浮层 → `startCardStory` 完成。该入口为 goto 重开语义，可能丢弃原剧情剩余页，并可重开已完成内容；与 replayStory 不同。

`renderKizunaCard` 的默认标题为“羁绊事件”，默认按钮为“进入羁绊剧情”。外层 align 可定位整张卡；内层卡片左右对齐在覆盖层分支被省略，默认 left。内层图片通过标准 `renderTalk → renderChatImage → game.pics.urlOf` 解析，解析失败不输出图片。

## 9. 开幕横幅是第三种演出状态

`showOpeningTitle` 不写 ChatTextEntry，也没有临时 ID。`ChatStream` 用 `Map<streamKey,BannerState>` 管理 title/startedAt/timer；同流再显示先清旧 timer，替换当前横幅。默认不入历史存档。

- 首页 effects 中第一个 `showOpeningTitle` 被 `beginStory` 的 `find` 找到，在 Story 启动（含 replay）立即发事件。
- 离开首页时，`advanceStory` 会过滤首页 effects 中所有该 op，防止重复。因此首页若写多个该 op，实际只启动第一个，而不是依次启动全部。
- 非首页通常在离开该页时经普通 Effect 链呼出。
- 实际时长 `BANNER_ANIMATION_MS=3000`，CSS 同为 3 秒；`expression.ts` TSDoc 的“30 秒”已与实现不一致。一些 UI 测试等待 30001ms 只能证明较晚时刻消失，不能证明持续 30 秒。
- `startedAt` 用于重渲染时输出负 animation-delay，避免动画从头闪动。
- UI 当前活跃流有横幅时，剧情推进、选项、羁绊卡片、被动启动等 handler 有阻断守卫；横幅本身的 pointer-events 不等于业务阻断机制。
- 声明意图是标题优先级 effect.value → Entry.openingTitle → StoryDef.name。但当前 `controller-events` 回退使用 `find(e.storyId===view.storyId)` 和 `stories.get(view.storyId)`；`StoryView.storyId` 实际是 Entry ID。与 `story-gate.ts.storyDisplayTitle` 中按 Entry 正确解析的实现不同。显式 effect.value 正常时不会暴露该差异，缺省标题路径需要额外核验。

## 10. 主题与实体表现：可从页效果触发，但不是 Talklet 字段

### 10.1 当前可执行的 `setTheme`

`ThemeEffectValue` 支持 colorGroupId、palette、tokens、nodes、background、scope、entityKey。调用链为 themeEffectRequested → RuntimeEffectReactor → ColorSystem.handleThemeEffect。

| scope | 现行结果 | 持久性 |
| --- | --- | --- |
| 默认/ephemeral | 写固定 `story-ephemeral` 槽，后一次完整替换；生成临时主题层并同步单一 Runtime 主题 | 内存临时，不修改玩家当前主题选择 |
| area/student | 需要 entityKey，调用 `mutations.setEntityThemeSlot` | 持久实体主题槽；不是纯演出临时操作 |

area/student 分支构造 customTheme 时只传 colorGroupId/palette/tokens/nodes，未传 value.background。默认临时分支传 background。不能把背景支持无条件推广到所有 scope。

清理实际由 `src/ui/controller/controller-theme.ts:syncRuntimeTheme` 在 **全局** `getView().currentStory` 为空时调用 `clearStoryTheme`；不是本 Reactor 在任何 storyCompleted 上清理。对学生 owner Story、并行游标和离开 UI 的行为须单独核实。此分册不扩大为主题系统全面审计。

### 10.2 `setEntityPresentation / clearEntityPresentation`

Effect.target 是实体表现 key，value 包含 optionId/owner/lifetime，owner 回退 effect.owner，无 owner 则忽略。服务验证实体存在该 addition 选项后写内存覆盖层；同实体、同 owner 更新自身记录，用 sequence 处理来源先后。生命周期是 story/area/init/manual：storyCompleted 按事件 storyId+story lifetime 清理，areaEntered 清 area，initEntered 清 story/init/area，manual 等显式清理。

这一能力是“切换已经声明好的实体表现选项”，不是把任意 UI 元素定位到 x/y。它不修改玩家持久表现选择。

### 10.3 存在但未找到 Story 作者接线的 Talklet Theme Lite API

[theme-runtime.ts](../../../../src/engine/core/theme-runtime.ts) 定义 `TalkletThemeSpec`：owner/effectId/theme/lifetime/targets，以及 seconds/steps/areaId；提供 setTalkletTheme、removeTalkletTheme、disposeStoryExecution、completeTalklet、tick、areaChanged。支持 fulltime/areatime/seconds/step，同 owner+effectId 完整重写，并有独立单元测试。

本轮在 src 全文搜索 `setTalkletTheme / completeTalklet / disposeStoryExecution`，命中只有该通用类定义，没有找到 StoryService 或当前 setTheme 的调用。现行 Talklet 契约和 ThemeEffectValue 也没有这组作者字段。因此应标为 **通用基础设施已存在、尚未证实接入 Story 作者与播放链**；不能把 `step/seconds/targets` 宣称为现行单页作者开箱即用功能。

## 11. 存档、历史和预览的限制

`withHistories` 只把 `studentChats` 与 `chatEntries` 写为 chatHistories，且过滤 typing。它不保存 `chatTexts / studentChatTexts / banners`。resetSessionPanel 清空这些集合，restoreHistories 不重建定位演出。

若保存时 Story 游标停在某个演出已建立后的页面，恢复游标不意味着先前 showChatText effects 自动重放。当前普通 Story 历史去重恢复只解决消息送达，不解决舞台覆盖层重建。未来编辑工具若提供“跳到某页预览”，必须明确是否执行之前的舞台 effects、如何隔离 PlayerState、如何重建主题/覆盖层及如何处理卡片导航。

## 12. 真实作者片段与执行说明

以下取材于 `base:story:schale_flow_show`，可在现行内容中找到对应写法；为说明用途做了节选。

```ts
line('阿罗娜', '比如这条在右下角的提示，稍后我会用它的 id 单独擦掉。', '好。')
  .effects({ op: 'showChatText', target: 'perf:note', value: {
    text: 'TIP · 右下角提示', x: 0.85, y: 0.18, align: 'right'
  } });

narrate('那条提示消失了，其余文本仍在。').effects({
  op: 'clearIdChatFlow', target: 'perf:note', value: 0
});
```

这两个效果都在离开其声明页时执行；后一句不会按 ID 删除普通历史里的某句对话。

```ts
{ op: 'showChatText', target: 'perf:talklet', value: {
  talklet: { speaker: '阿罗娜', text: '定位气泡', side: 'left' },
  x: 0.1, y: 0.15, align: 'left'
} }

{ op: 'showChatText', target: 'perf:kizuna', value: {
  talklet: { text: '羁绊入口', kizuna: {
    storyId: 'base:activestory:run_chain_1',
    title: '羁绊剧情 · 深夜巡逻（一）', buttonText: '进入羁绊剧情'
  } },
  x: 0.5, y: 0.35, align: 'center'
} }
```

第一项是静态气泡呈现；第二项生成真实可交互剧情卡片。坐标属于包装器，嵌入 text 不承担执行游标。

正式演示 `schale_flow_show` 包含十条 showChatText（title/cast/gold/noBg/small/multiline/note/act2/talklet/kizuna）、一次按 ID 擦除和两次清流。主题测试另演示多次 setTheme 覆盖、clickWork、insert/goto 与覆盖层组合，但它的文字描述不能替代当前主题运行链事实。

## 13. 已阅读测试与尚未证明的内容

| 测试文件 | 阅读到的断言 | 证据边界 |
| --- | --- | --- |
| [chat-flow-service.test.ts](../../../../tests/engine/chat-flow-service.test.ts) | op→事件；坐标/样式/嵌入载荷透传；PlayerState 零写入；首页横幅立即一次；正常完成事件、replay 不再完成；真实演示 10 条 show、2 次清流、1 次擦除 | 事件和引擎语义，不等于浏览器定位结果 |
| [chat-text.test.ts](../../../../tests/ui/components/chat-text.test.ts) | 默认定位 left/bottom 50%；临时 ID 属性；title/badge/note 模板；嵌入 talk/narration/kizuna；字体/字号/颜色/背景输出 | renderer 字符串断言，没有真实 CSS 布局验证 |
| [story-gate.test.ts](../../../../tests/ui/story-gate.test.ts) | 横幅重渲染负 delay；展示期间点击受阻；卡片重开及确认 | 使用 fake timers / happy-dom；较长等待不能证明实际时长为 30 秒 |
| [theme-runtime.test.ts](../../../../tests/engine/theme-runtime.test.ts) | 通用 Lite API 同键重写、seconds/step/area/owner/target 限制 | 不能证明 Story 当前作者 DSL 已接线 |

根 Agent 已报告本轮执行 9 个定向测试文件、120/120 通过，包括本分册相关的 `tests/engine/chat-flow-service.test.ts` 与 `tests/ui/components/chat-text.test.ts`，以及 Talklet Builder、Story flow/replay、UI flow/typing/history/image 测试。此为根 Agent 执行结果，本分册不重复运行。

未在本轮执行：真实浏览器、定位截图、后台 owner 事件跨流复现、恢复舞台重建、异常 CSS 值、NaN 坐标、重复首页横幅声明、缺省横幅标题路径。`story-gate` 和通用 `theme-runtime` 测试不在上述 9 文件中。文中相关差异是可核对的代码事实或明确推断，不是已复现 bug 报告。

## 14. 供上层 chat 决策的问题

1. 未来是否让普通 Talklet 本体直接具备 ID/position/style，还是保留“舞台操作包装器”？两者会决定编辑器是页编辑还是舞台状态编辑。
2. 临时演出 ID 是 Story 局部、owner 局部还是流局部？目前它只是当前 UI 集合里的字符串，不能承担稳定作者节点身份。
3. 覆盖层应随 Story 执行 owner 路由，还是随 UI 活跃空间？目前实现是后者。
4. 嵌入片段是否明确只允许呈现字段，避免作者把 choices/effects/jump 填进却无效果？是否需要显式片段类型？
5. 重新加载、跳页预览与编辑后恢复时，舞台应保存快照、确定性重建，还是明确清空？
6. 普通完成、重读完成、被卡片 goto 打断应如何统一清场？现行依赖 storyCompleted 的清理并不覆盖所有结束方式。
7. Theme Lite 通用生命周期应接入 Story，还是先裁定为未接线基础设施，避免编辑器暴露无消费字段？
8. 是否统一普通 Flow 与覆盖层的身份、受控内容和样式安全边界？可以比较后裁定，不能因为共用 renderTalk 就认定已经统一。
