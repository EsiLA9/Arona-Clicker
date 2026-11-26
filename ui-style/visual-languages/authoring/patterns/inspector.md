# Inspector、属性表单与页签

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## StoryDef 常驻页签

StoryDef 右栏通过 `renderTabs()` 提供「概述／关系／Flag表／其他工具包」四个常驻面板。切换更新 `hidden` 与激活态，按页记忆右栏滚动，节点属性保留自己的局部条件与 Navi，Entry 信息栏也提供 Flag 表。Flag 表内的行和绑定见 [[ui-style/visual-languages/authoring/patterns/flag|Flag 表]]。入口为 `src/ui/story-editor/view.ts` 的 `renderStoryInspector()` 所在区域及 `tests/ui/story/story-editor-inspector-tabs.test.ts`。

## 节点类型与字段排列

Story 编辑器的属性栏顶部以 Switch 切换 Talklet、Click、Operation、Transfer、移动到 Area 与移动到 Chara。当前分支、可选能力、诊断与节点操作在 Switch 下方排列。节点流按 `nodes` 顺序自由组合。旧 stage 字段隐藏在兼容数据中，不作为编辑步骤。其他字段沿用右栏既有 label / input / select / textarea 与 `.mini-action`，不引入独立表单框架或新配色。Talklet、Button 与入口卡的共享正文仍在子类型字段上方编辑。Choice 只编辑各自选项文案，不显示不能代表候选的共享“正文”输入。Click 交互选项与属性平铺，不再共用小型属性容器。Operation 的行为和命令字段平铺，复用 Transfer 的排列。覆盖层坐标并排，留空沿用默认。移动通知用默认／显示／隐藏单选。持久标记、Extra 和数值效果各有一个值类型入口，结构化类型在其下显示构造内容。入口卡的续接开关下直接列出地点和可增删的回传 Flag。有序列表使用 `.story-editor-list-heading`（标题＋添加）与 `.story-editor-property-row` 浅底虚线行，行操作按钮固定在行尾。只读复杂值使用 `.story-editor-readonly` 展示原值并提供显式清理按钮，不用输入框伪装可编辑。字段诊断沿用 `.story-editor-error`，每条诊断右挂“清理该字段”危险操作，作者可见地决定是否丢弃来源字段。样式入口为 `src/ui/css/story-editor.css`，属性 DOM 行为见 `tests/ui/story/story-editor-properties.test.ts`。

[[ui-style/visual-languages/game-ui/patterns/workspaces-and-story#剧情推进与 Operation 反馈|运行态衔接与播报]] 记录相应的玩家侧表现。

## Click 单按钮

Story 编辑器的单按钮 Click 属性只编辑正文与按击次数，不嵌套结果动作或转移表单。行为通过后续独立节点编辑。旧 result 仅展示原始值诊断和显式移除入口，不提供编辑或发布。入口为 `story-editor/property-fields.ts`，行为由 `tests/ui/story/story-editor-properties.test.ts` 核验。

## Choice 的选项表单和条件摘要

Choice 每个选项只有一层虚线表项，选项 ID 与改名操作同行，`marks[]` 用紧凑 Flag 行。右栏显示 `showWhen` 条件摘要，编辑复用条件树弹窗并保留 Choice 的 AND／OR 根语义，确认才写回。选项文案和 `requiresFlag` 直接编辑。Choice 不再有共享正文输入、共同动作或单项通用结果表单。拖放后续节点仍在选项预览卡建立绑定。解绑只清除该节点读取条件，选择标记声明保留，作者可在属性栏显式移除。旧 `sharedActions`、option `condition` / `result` 原样显示诊断并阻止 Runtime 投影。旧 `condition` 的禁用语义不会转作 `showWhen`。`property-fields.ts` 沿用路径与 rowId，`controller.ts` 经 `workspace.story-editor` 区域更新保留焦点、滚动和其余行。验证入口为 `tests/ui/story/story-editor-properties.test.ts`。

## 外观页的呈现字段

Talklet 的外观页可选择「对话／旁白」「纯文字」「标题」「徽标」「注记」模板，并编辑局部样式。Click 使用同一外观页入口编辑局部按钮样式。外观不改变当前节点内容或演出，默认恢复动作落在所属页。

Story 编辑器的“呈现”使用常显大标题，下方平铺“气泡位置、文字对齐、头像显示、头像引用”四项，每项以 label、控件和用途说明组成。不套可选区块、竖线缩进或内部卡片。未设置时沿用默认，下拉框选值后仍可切回默认。复用 `property-fields.ts` 的 `presentationEditor`、`.story-editor-property` 与 `.story-editor-hint`，仅 `.story-editor-presentation` 负责标题和字段间距。字段使用原有路径 key 局部协调，保留输入焦点、光标与属性栏滚动。行为证据见 `tests/ui/story/story-editor-properties.test.ts`。

## Talklet／Click 基础区与常驻设计页

Talklet / Click 基础设计器复用 `.story-editor-property-content`，增加一个以 node.id 为 key 的语义 section（`data-story-basic-properties`），供基础表单独立挂载。由「内容｜外观｜演出」常驻页签切换，不新增滚动宿主。按击基础次数、随机增量直接平铺，输入节奏在适用的对话下于「演出」页直接填写，空白省略与数值 0 分开处理。入口卡续接与 Choice 出现条件在缺省时只显示创建 / 恢复按钮，存在时显示原有可关闭区块。沿用 `workspace.story-editor` region 和 `patchEditorDOM`，普通输入保留基础区、控件、光标及其他栏滚动。相关分支改变时只协调其字段，沿用既有浮层清理。入口为 `renderStoryNodeBasicProperties()` / `controller.ts`，行为见 `tests/ui/story/story-editor-properties.test.ts`。

## 固定动作与工具包

Story 作者配置沿用右栏原滚动宿主：概述保留基本字段，关系页放置关联 Entry，其他工具包依次放置试播、检查与应用、数据包、文档身份和文档扩展。副本 ID、试播入口和目标数据包分别与对应命令同组，组内空间不足时换行。Story、StoryEntry 固定操作区与试播工具沿用有边框的 `.mini-action`，由 `.story-editor-actions--tools` 统一操作组内的高度、字号和焦点环。原有危险操作保留 `.mini-action--danger`。共享按钮在普通面板回退到 `--line` 和面板文字色，在卡片继承卡片主题变量，见 `src/ui/css/cards.css`。各入口同称「试播」，字段标签说明入口及保存目标。

## 结构值编辑

结构值的路径标题标识实际数据关系，不套多层卡片或竖线缩进。类型构造、字段增删、列表换序与引用候选复用普通 label / select / input 与 mini-action。切换构造说明会替换本项。编辑器不提供 Entry 羁绊绑定字段，旧绑定只在兼容数据和运行时保留。跨 Entry 内容通过剧情入口卡选目标 StoryEntry。结构值输入和行沿稳定 key 更新，编辑 Entry ID、换序和错误输入不重建输入或滚动宿主。入口为 `authoring-view.ts` / `structured-value.ts` 与 `.story-editor-authoring/.story-editor-value`。状态与接口边界见 [[runtime-editor-and-project-checks]]，DOM 证据见 `tests/ui/story/story-editor-authoring.test.ts`。

## StoryEntry 中栏页签与表单

StoryEntry 中栏复用列头和底栏，「基本信息／奖励信息／详细门控」固定在列头第二行。试播、保存、检查和应用在经典模式位于列底栏，在高级模式集中到顶部快捷操作与管理命令。表单使用原来的单一滚动宿主，切页只更换正文表单并更新页签激活态，每页独立恢复原滚动。基本信息以命名文字框编辑入口身份和开幕标题，关联剧情复用原有选择器，剧情重读显示「允许重读／不开放重读」。标签和扩展数据收在折叠区，删除入口位于页末。重读机制见 [[story-and-effects]]。奖励页的首次、重复和条件效果各有独立区域，条件奖励操作跟随对应列表或条目。详细门控将触发与限制、关联抽取池分区，抽取池沿用稳定结构行 key 的 details。两列字段与奖励区域由 `.story-editor-entry-grid` 按中栏可用宽度排布，较长的按钮组可换行。结构值、字段焦点和弹窗生命周期沿用 Story 编辑器现有更新入口。源码见 `view.ts`、`authoring-view.ts` 与 `story-editor.css`，回归见 `tests/ui/story/story-editor-authoring.test.ts` 与 `tests/ui/story/story-editor-entry-activation.test.ts`。
