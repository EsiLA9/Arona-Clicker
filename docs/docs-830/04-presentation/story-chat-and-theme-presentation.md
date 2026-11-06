# docs-830/04-presentation/story-chat-and-theme-presentation — 剧情聊天与主题表现

本文回答：Story 查询如何变成聊天流，以及运行时主题如何投影到 UI 宿主。

Talklet 的 `content.characterId` 保存发出方角色引用；默认名称和头像来自该角色及其默认差分。`content.displayName` 是仅覆盖名称的临时文案，不参与角色 / 头像匹配；旧故事的 `speaker` 仍作为旧身份与名称的兼容来源。`presentation.avatar` 显式图片覆盖角色头像，清空后恢复默认；avatarMode 继续控制显隐。角色引用与临时名贯穿正文页、Runtime 输出 / 打字队列、重读、覆盖层、聊天历史和快照校验，UI 通过同一 `resolveStorySpeaker()` 解析姓名与默认头像，避免别名碰巧等于其他角色时换头像。回归见 `tests/ui/story-speaker.test.ts` 与 `tests/engine/story-playback-coordinator.test.ts`。

聊天栏的独立装配接口见 [[workspace-columns-and-layout]]。多个显示读取同一 owner 的 Runtime 播放视图，不各自创建剧情推进器或 Story 计时器；点击命令从所在窗格的显式 owner 绑定取目标，显示滚动按实例隔离。普通播放默认从触发时所在的对话流开始；Entry 的 `travelToStartContext` 可要求真实前往 StoryDef 起始空间。重播始终虚拟切到该上下文，Area 三栏与设施按虚拟 Area / Init 渲染，主题也按同一上下文解析；AreaHero 和手动移动交互在播放期间禁用。Entry 开启此选项时另执行真实前往。显式移动节点的 `storyContextMoved` 将后续空间变化交给 Controller：`moveToArea` 正常播放时强制旅行并切换真实 Area，重播中的显式移动只更新虚拟场景并显示“演出场景/演出移动”。

## Story 到聊天条目

正式子故事与 areaContinue 到场后正文复用通道的播放 / token 接口，但 `StoryNodeSource.isReplay === false` 的正文写入当前场景的普通会话历史。Area 场景使用所属 Init 的普通流，Chara 场景使用该角色流；换场和进场本身不清流，也不将 Area 现场对白搬回角色聊天。只有真正重读使用私有输出。`getActiveStoryChannel()` 供读档后重建当前播放绑定，渲染不推进游标。ChatStream 的正式绑定直接引用当前会话数组，共享稳定输出 ID，不复制历史到临时沙盒；通道的临时主题仍独立激活并按运行清理。

结束路由按 `storyRunEnded.isReplay` 判断：只有明确为 true 的重读完成才打开故事页。正式子完成释放通道绑定，停留在子 Entry 最终场景与正文，不自动召回父会话或生成召回按钮；当前场景沿用原有故事、闲聊、Choice 与阻塞规则恢复合法 Click。父局部结果已回传，但后文不因子完成、刷新或读档自动播放；最终场景恰为父空间时，由下一次普通“继续故事”Click 接续，否则等玩家自行返回原空间再接续。旧 entryCard 的确认留在当前页面。

新 kizunaCard / areaContinue 复用原爱心卡片结构与确认浮层；绑定目的地时显示地点名称且不提供远程开播 token，需到场手动接取。子运行中为等待提示，结果已返回时父空间改用普通“继续故事”Click，过期卡片不提供当前命令。编辑预览也复用同一外观。卡片只改变聊天区域内容，不新增滚动宿主；场景身份变化才切换工作区。

Controller 读取 `game.story.getPlaybackView(owner)` 的输出、phase、token、typing 和 banner；重读则通过 `getReplayPlaybackView(replayId)` 读取。`ChatStream` 以 owner 或 replayId 将结果映射到普通聊天流或独立临时流，使用 Runtime 稳定输出 ID 关联本地 DOM 条目身份；反复读取、多个显示和重新挂载不会重复投递或推进。打字、思考、效果间隔、开幕标题以及自动衔接由 `StoryPlaybackCoordinator` 持有。无 UI 挂载时 Runtime 仍可完成已开始的有限表现步骤。

```text
Runtime 输出与表现阶段 → owner / replayId 查询 → ChatStream 投影
                      → ChatEntry / FlowEntry → renderer → FlowScroll
UI 继续 / 输入 / 节奏加速 → Controller → GameCommands → Runtime
```

聊天条目由 `src/ui/components/story/story.ts` 的 renderer 输出，Map 信息流也复用 Flow 条目能力。渲染器负责转义文本、呈现图片/头像/选项等类型；任意 HTML 和内联脚本不是内容接口。继续、输入和节奏加速分别提交显式命令与当前 token，Runtime 检查阶段；UI 动画、刷新与滚动不会调用隐式送达确认。正式 Story 横幅显示 Runtime 的剩余时间；独立于 Story run 的旧效果仍可使用 UI 自己的横幅计时。

Story 正文、实际动作通知和尾奖励属于 Runtime 输出；商店、地图等非 Story 的本地通知仍由 UI 聊天历史持有。ChatStream 保留 Runtime 内部序号顺序，普通通知按时间合并；玩家移动提示使用提交移动前捕获的输出位置，保证已有正文、移动提示、到达正文的顺序，即使同一毫秒或延迟刷新也稳定。Runtime 输出保留 `storyOutputId`，保存 UI 历史时排除这些条目及瞬态 typing。读档后分别恢复非 Story 历史和 Runtime 输出，避免同一正文保存两次。清空 Runtime 流通过 epoch 通知投影清理显示，不以本地数组长度改变业务进度。

Choice 提交成功后，Runtime 输出保存完整选项组和所选 option ID，排在该选项的结果通知之前。UI 复用当前 Choice 卡片，将全部按钮禁用并标记已选择项，不携带可提交的 token 或命令绑定；连续 Choice 的下一组仍以当前输入独立渲染。历史卡片随 Runtime 输出保存和恢复，遵循同一条目上限与清空规则。

## 主题与 Presentation 投影

画布文字色由背景图层合成代表色决定：`controller-theme.ts` 在语义兼容变量写入后再设置 `--ink-on-canvas` / `--muted-on-canvas`，防止最终背景的判定被 `tokens.bg` 或语义底色覆盖。顶部 AronaClicker 标识的 `.brand-lockup` 消费该画布前景色；Init / GlobalEnh 选择页同样按聚焦背景生成局部变量。`readableOnColor` 对无法解析的颜色默认返回浅色文字；画布背景缺失或无法合成时也使用浅色文字，已知亮底仍返回深字。字色按现有图层代表色服务近似计算，不读取图片像素。验证见 `tests/ui/header-brand-color.test.ts`、`selector-theme.test.ts` 与 `tests/engine/color-framework.test.ts`。

`controller-theme.ts` 从 ColorSystem 的当前运行时主题解析 tokens、背景定义和 Presentation 定义。`buildBackgroundView()` 解析背景资源；`buildPresentationView()` 将宿主、状态、图层、组件和资源校验为只读视图；`createUIContext()` 将这些视图提供给组件。组件使用稳定 `hostId`、`themeScope` 查询适用背景、形状、装饰和文字颜色。

玩家主题选择、Area 主题、学生主题与剧情临时表现属于不同投影来源。常规游戏页依据当前选择生成运行时主题；学生对话或主题演出可暂时替换投影，结束后恢复原选择。主题改变通常刷新根级 CSS variables 与受影响宿主；单个实体表现变化可定向刷新该实体，而不默认重建整页。

Theme 内容编辑与玩家主题选择是两条写入路径。`ThemeContentEditorService` 以正在编辑的数据包为 owner，按稳定 ID/字段路径编辑 ThemeDef，提供运行时预览和冲突检测，提交回编辑包，不写玩家存档或自动应用整个包。`UserThemeService` 管理玩家自己的主题草稿/保存数据；`UserThemeLayerService` 再把已保存主题投影成运行时表现层。ColorSystem 负责把这些选择与临时主题层解析成当前 UI 可查询的主题。

| 表现来源 | 保存/归属 | 投影与清理 |
| --- | --- | --- |
| 玩家 ColorGroup / ThemeDesign 选择 | `PlayerState.activeTheme` 与主题槽 | ColorSystem 合成当前游戏主题 |
| 玩家自定义主题 | `userTheme` / `customThemes` | UserThemeLayerService 转成可组合的运行时图层 |
| Story / Area / Init 主题效果 | 带 owner 与生命周期的临时层 | 生命周期事件结束时由 RuntimeEffectReactor 清理 |
| Entity Presentation 覆盖 | 按实体 key、owner、lifetime 保存 | EntityPresentationService 查询并按 Story / Area / Init 清理 |

### 例子：预览与保存一份主题

`tests/engine/theme-content-editor-service.test.ts` 中，作者在 editing Pack 打开一个 ThemeDesign，把背景色改为 `#e9f1fb` 后调用 `preview()`；运行时主题暂时显示该颜色。调用 `save()` 后，定义写回目标 editing Pack，预览层清理，运行时主题恢复此前的投影。若同一个包在会话打开后被其他操作改变，保存返回 `content-conflict`，避免覆盖新内容；这不等于数据包已经应用到当前游戏。

玩家自定义主题使用另一套会话：`UserThemeService.beginEdit()` 记下用户主题 revision；一个会话成功保存后，基于旧 revision 的另一会话会得到 `revision-conflict`，须重新载入。`tests/engine/user-theme-service.test.ts` 验证保存更新全局玩家主题状态和冲突处理。检查页面未恢复时，再看 `tests/ui/controller-theme-cleanup.test.ts` 中的界面清理路径，而不是只检查包内 ThemeDef。

源码入口：`src/ui/presentation/chat-stream.ts`、`src/ui/components/story/story.ts`、`src/ui/flow/flow-entry.ts`、`src/ui/controller/controller-theme.ts`、`src/ui/presentation/background-service.ts`、`presentation-service.ts`、`theme-cascade-service.ts`、`src/ui/runtime/context.ts`。

相关测试见 `tests/ui/story-node-delivery.test.ts`、`story-node-input.test.ts`、`presentation-service.test.ts`、`controller-theme-cleanup.test.ts`、`tests/engine/entity-presentation-service.test.ts`。Story 推进机制见 [[story-and-effects]]；刷新语义见 [[ui-refresh-focus-scroll]]。

## 例子：在聊天中阅读剧情

当 Runtime 输出或表现阶段变化时，`storyPlaybackChanged` 触发对应 owner 的刷新；全局流与角色对话流使用不同 key。调查重复显示时，检查 Runtime 输出 ID、storyOutputId 和 owner；调查无法推进时，检查 Runtime phase、当前 token、输入资格与失败诊断。Operation 和 finishing 的通知顺序由 Runtime 步骤保证，不由 UI 抢先插入声明式奖励。

有新内容时是否自动滚到末尾由滚动恢复策略决定：原本贴底且允许跟随时才跟随；普通聊天上翻时按比例恢复，Map 信息流使用锚点模式。其刷新前后入口见 [[ui-refresh-focus-scroll]]。
