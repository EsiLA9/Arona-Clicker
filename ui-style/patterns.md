# UI 复用模式 — 组件、布局与内容

> 本文回答：已有页面从哪些组件和内容入口组合。范围为 ACProgram 游戏 UI；入口已核对源码，用法作为复用约定，不复制渲染函数、机制正文或完整 DOM 树。

## 复用模式

Story 编辑器的单按钮 Click 属性只编辑正文与按击次数，不嵌套结果动作或转移表单。行为通过后续独立节点编辑；旧 result 仅展示原始值诊断和显式移除入口，不提供编辑或发布。入口为 `story-editor/property-fields.ts`，行为由 `tests/ui/story/story-editor-properties.test.ts` 核验。

Story 编辑器的左侧目录栏通过 `view.ts` 的 `baseColumn` 固定为 300px，为 Story / Entry 名称、目录与发出方列表留出空间；中栏继续占用剩余宽度，右栏沿用共享属性栏宽度。列宽由既有 WorkspaceColumnSpec 交给共享 Frame，不新增布局容器或改变滚动宿主。适用于 Story 与 Entry 两种查看目标；复验入口为 `tests/ui/story/story-editor-workspace.test.ts`，未做浏览器视觉验收。

Story / Entry 中栏的历史按钮与 workspace-heading 共用一行，按钮组位于左侧且不收缩，标题占余下宽度。仅 `story-editor.css` 对中栏 titlebar-layout 进行横排与历史组排序，不增加 DOM 包装，不改变其他工作区标题栏或刷新范围。

Story 文档新建 / 改 ID 沿用 ModalManager、story-editor-property 与 mini-action：每次新建必须确认编辑态 Mod，改名限定同 Mod 并在弹窗内列出引用影响。输入只更新弹窗预览，确认沿既有 Story 编辑区域协调；草稿身份、选中节点、输入缓存与 Flag 页保持，身份相关导航键随之更新。无编辑态 Mod、目标过期、重名、跨包引用及存储失败显示原地错误；取消不创建 / 改名。入口 `story-editor/controller.ts`、`identity.ts`、`view.ts`，验证见 `tests/ui/story/story-editor-identity.test.ts`；未做浏览器验收。

Story 新建节点的可见 ID 默认采用 `talk-001` / `click-001` / `operation-001` / `transfer-001` / `move-area-001` / `move-chara-001`，按 Story 内同类型未占用序号分配；已有节点与手写 ID 保持稳定，复制沿用 `-copy-编号`。节点信息和更改 ID 控件沿用原 DOM 与区域协调，不增加命名设置或刷新范围。入口 `story-editor/model.ts`，验证见 `tests/ui/story/story-editor-model.test.ts`；未做浏览器验收。

StoryNode 右键提供复制，节点间 / 末尾横线右键提供粘贴。`node-context-menu.ts` 的单项 body 级菜单沿用 mini-action 与锚点 panel-light / ink-on-panel-light / line / panel-shadow；菜单只增加一个 role=menu 容器和操作按钮，按鼠标位置限制在视口内。关闭、外部点击、滚动、失去锚点与离开编辑器均释放菜单；原位正文 / 名称和表单输入保留原生文字右键。复制只保存会话快照；粘贴沿 `insertAtCurrentPoint` 更新草稿，以 workspace.story-editor 区域协调保留原节点、横线与滚动宿主。ID 分配和编辑缓存复制入口为 `node-clipboard.ts`，回归见 `tests/ui/story/story-editor-node-clipboard.test.ts`；未执行浏览器验收。

Story 的内容引用沿用局部标记 Navi 的 ModalManager、输入操作行与稳定列表行：`reference-navi.ts` 在已标注引用字段旁装配“选择…”按钮，保留原 select / input 及字段写入口；名称 / ID 搜索仅切换行显隐，Story / Entry 的查看来源独立于回填。候选来自原字段目录，Story / Entry 合并当前草稿；固定枚举不装配 Navi。关闭恢复原字段焦点，区域协调保留字段与滚动；空目录、缺失引用、禁写与已移除字段由原字段会话检查处理。入口为 `property-fields.ts`、`structured-value.ts`、`view.ts` 与 `controller.ts`；回归见 `tests/ui/story/story-editor-reference-navi.test.ts`，未做浏览器视觉验收。

Talklet 发出方姓名复用原 `.chat-name` 元素和 `StoryInlineTextEditor` 的双击原位编辑；姓名保持单行，Enter / 外部点击提交，Esc 恢复，中文组合输入沿用正文会话保护。右栏“发出方”选择角色，“自由显示名”仅覆盖文字，清空恢复默认；“头像引用”复用图片目录并独立覆盖角色头像。别名更新通过既有 `workspace.story-editor` 区域协调，只更新姓名和相关属性，保留姓名输入元素、头像、焦点与滚动。实现为 `inline-text.ts`、`property-fields.ts` 与共享 `story.ts`；默认角色、同名别名、图片覆盖、保存重载和原位身份由 `tests/ui/story/story-speaker.test.ts` 验证；本次未执行浏览器验收。

Story 编辑流的 Talklet 正文、Click 按钮 / 各 Choice 选项 / 入口卡文案可双击原位编辑，复用原文本元素与主题外观，不新增包裹层。活动文本仅添加细虚线轮廓并临时切为纯文本编辑；空正文保留最小命中面积。Click 编辑预览使用展示容器，正式播放仍使用原按钮。`StoryInlineTextEditor` 持有单个短暂编辑会话，按节点与稳定属性 key 同步草稿 / 右栏；`workspace.story-editor` 协调时保留活动文本子树、光标和组合输入，其余区域沿原 key 更新。点击外部、保存或离开提交，Esc 恢复原值，粘贴仅接收纯文本；Choice 行重排保留选项身份。入口为 `story-editor/inline-text.ts`、`dom.ts` 与 `controller.ts`，回归见 `tests/ui/story/story-editor-inline-text.test.ts`。

从外部星图打开 Story 编辑器时，“打开时主题”沿用当前聚焦节点的完整投影（包含背景状态变体），重新进入时更新该默认来源；编辑器内已手动选择的色组、场景或自定义主题继续保留。未指定的背景和正文 token 沿用 `theme-tree.ts` 的浅色基础角色，不从色相额外派生深蓝底。主题通过既有变量、背景和表现宿主更新，不增加界面结构。入口为 `SelectorPage.currentTheme()` 与 `StoryEditorTheme.setInitial()`；验证见 `tests/ui/story/story-editor-theme.test.ts`，未做浏览器视觉验收。

星图节点名称统一对比当前星图场景背景：`.selector-graph-canvas` 在节点局部主题之外解析 `--ink-on-canvas` 为自身 color，标签通过 currentColor 继承已解析前景色，避免节点各自的 ThemeTree 把名称误配成白字。普通 / 选中 / 迷雾名称均使用此关系，不再染主题强调色、使用半透明文字或描边；状态仍由节点图形表达。主题切换沿用既有局部变量更新，不替换标签 / 画布。入口为 `src/ui/css/selectors.css` 与 `selector-theme.ts`；明暗底、相反节点主题、各状态及原位切换由 `tests/ui/theme/selector-label-contrast.test.ts` 验证，未做浏览器人工验收。

「需要局部标记」使用原输入操作行内的 anchored listbox：聚焦展开、外部交互关闭，Navi 按钮继续提供完整来源浏览。下拉复用 panel-light / ink-on-panel-light / line 主题角色，正常匹配使用实色，未匹配仅以 0.72 opacity 稍浅显示并保留选择能力；空值或首次打开已有值均全匹配。筛选不新增刷新调度，只原位切换行状态；`workspace.story-editor` 协调后恢复同一输入会话的展开 / 筛选状态，保留行与滚动容器。入口为 `story-editor/required-flag-dropdown.ts`，测试见 `tests/ui/story/story-editor-required-flag-dropdown.test.ts`；未做浏览器视觉验收。

局部标记 Navi 沿用 ModalManager 的 body 级弹窗和滚动、现有 list-item / mini-action；字段旁只增加一个输入操作行与选择按钮。弹窗搜索过滤稳定行，选择与查看来源是独立动作；内部标记不可选择时显示禁用说明。关闭后恢复字段焦点，回填沿既有字段命令与区域协调保留原输入和滚动宿主。实现入口为 `story-editor/local-flag-navi.ts`，DOM / 选择 / 来源行为见 `tests/ui/story/story-editor-flag-navi.test.ts`；未做浏览器视觉验收。

Story 编辑器的顶部主题浮窗沿用现有 `.theme-palette` / `.theme-swatches` / `.theme-editor-entry`，列出全部色组，标记当前编辑器主题，并复用用户主题表单编辑本会话自定义主题。Area / 通讯录场景卡片以 title 提示可双击应用目标完整主题；单击仍查看属性。选择色组、双击和颜色预览只更新主题变量、背景、表现宿主与浮窗选中属性，保留顶部按钮、浮窗、Workspace、输入焦点和滚动；组件位置修改沿用既有表单结构刷新。来源、隔离和会话边界见 [[runtime-editor-and-project-checks]]，实现为 `story-editor/theme.ts`、`controller-theme.ts` 与共享 header / theme actions；验证为 `tests/ui/story/story-editor-theme.test.ts`，未做浏览器人工验收。

StoryDef 属性沿现有 renderTabs 分为概述、关系、Flag表、其他工具包四个常驻面板；切换只更新 hidden / 激活态，保留控件节点，并按 Story / 页签记忆原右栏滚动。节点属性仅保留自己的局部条件和 Navi，完整 Flag 表归入 StoryDef 的 Flag 页；Entry 信息栏显式保留其 Flag 表。Flag 项默认以沿用 Choice 标记配色的 summary 色块收起，原生 details 展开后用浅底卡片展示作用域、提供方、需求方及单独的移除操作；提供方 / 需求方的条目不重复标注写入 / 读取，回传声明保留独立文字；来源 ID 与节点分行呈现，沿用主题文字色与长文本换行；来源按钮保持独立导航，定位节点后右栏仍显示 Flag 表；从 Flag 页切换 Story 和前后浏览同样保持该页，并恢复目标 Story 的 Flag 页滚动。展开仅改变当前项的 open，按稳定 key 协调时保留，不写入草稿或触发刷新。局部 Flag 项收起时仍接受同 Story 编辑流的节点，沿用有效 / 无效投放反馈，绑定 requiresFlag 并留在 Flag 页；全局、其他 Entry 私有及无提供方的名称给出不可绑定原因。跨 Entry 获取继续复用 ModalManager 确认，来源导航独立。入口为 `view.ts`、`flag-catalog-view.ts`、`flag-table-binding.ts` 与 `controller.ts`；面板/字段/滚动及拖放由 `tests/ui/story/story-editor-inspector-tabs.test.ts` 验证，未做浏览器验收。

概述的 Story ID 复用 `.story-editor-readonly` 与主题表面，当前值旁提供“更改 ID”；不重复显示相同来源 ID，只有来源与当前值不同时显示同样式的“原 Story ID”。身份字段使用分组而非无关联控件的 label。入口为 `view.ts`、`.story-editor-identity-field`；三种来源状态由 `tests/ui/story/story-editor-identity.test.ts` 核验。

更改 Story ID 弹窗只允许修改名称部分，ModId 在创建后固定并以只读字段显示；“保存到编辑副本”只列出同一 Mod 的可用目标。入口为 `controller.ts` 的 `changeStoryId`，跨 Mod 请求仍由身份规划校验拒绝。

关系页的调用、被调用与关联 Entry 统一使用 `.story-editor-list-item.story-editor-relation-item`：沿用只读字段的浅底、边框与圆角，名称、完整 ID、调用说明分行显示，长 ID 自动折行；关联 Entry 的新增按钮与组标题同行。条目保留原 target / key，整条可跳转，缺失目标禁用；右栏继续使用原滚动宿主，不增设关系表内滚动。入口为 `relations-view.ts`、`authoring-view.ts` 和 `story-editor.css`；导航与原位更新由 `tests/ui/story/story-editor-authoring.test.ts` 验证。

Story 编辑器的移动场景预览复用 `.area-hero` 与 `.story-editor-scene-card`：移动到 Area 显示「前往区域名」，按目标 Area 声明主题构建局部 ThemeTree 渐变；移动到通讯录显示「前往角色名的通讯录」，取角色对话主题 / 默认色组主色绘制单色面并用 `readableOnColor` 确定字色。未配置与缺失目标保留文字占位。首个插入点之前的起始场景使用相同外观，显示「起始于……」并打开 Story 属性；它不属于 StoryNode，不参与拖动、排序或序列化。入口为 `story-editor/scene-view.ts`、`view.ts`；节点和起始占位沿稳定 key 更新，保留现有 flow 与滚动宿主，局部更新仍走编辑器 region。自动化证据为 `tests/ui/story/story-editor-scene.test.ts` 与 workspace 用例；未做浏览器视觉验收。

Choice 属性沿用现有 `.story-editor-list-block` / `.story-editor-property-row`，逐项编辑文案、`showWhen` 持久条件、`requiresFlag` Entry 局部出现标记与 `marks[]` 选择标记；Choice 不再有共享正文输入、共同动作或单项通用结果表单。拖放后续节点仍在选项预览卡建立绑定；解绑只清除该节点读取条件，选择标记声明保留，作者可在属性栏显式移除。旧 `sharedActions`、option `condition` / `result` 原样显示诊断并阻止 Runtime 投影；旧 `condition` 的禁用语义不会转作 `showWhen`。`property-fields.ts` 沿用路径与 rowId，`controller.ts` 经 `workspace.story-editor` 区域更新保留焦点、滚动和其余行。验证入口为 `tests/ui/story/story-editor-properties.test.ts`；未做浏览器视觉验收。

Story / Entry 的调用关系复用 `.story-editor-list` 与 `.story-editor-list-item`，在既有属性栏内以「调用表 / 潜在调用集」及「被调用表」分区，不新增滚动宿主。每项显示对象类型、名称、ID 和调用来源；缺失目标禁用。`relations-view.ts` 使用原有 Story / Entry 目标按钮属性与浏览历史，`patchEditorDOM` 按目标和调用位置 key 协调关系行，保留三栏、输入焦点与滚动容器。机制见 [[runtime-editor-and-project-checks]]，行为证据见 `tests/ui/story/story-editor-relations-model.test.ts`、`tests/ui/story/story-editor-authoring.test.ts`；未做浏览器视觉验收。

Story 编辑器浏览历史复用中栏 `renderWorkspaceTitlebar` 的 accessory 与 `.workspace-back` 控件，按钮位于既有 `panel-tabs-region`，不新增滚动宿主。Transfer 目标使用 `transfer-view.ts` 的统一方式 / 名称 / ID 行与 `.mini-action`，顶层节点及属性栏共用；缺失目标禁用。切换走 `workspace.story-editor` 区域协调，保留顶部和正文滚动宿主，历史返回后恢复对应位置。状态边界见 [[runtime-editor-and-project-checks]]，DOM 与导航行为见 `tests/ui/story/story-editor-workspace.test.ts`；未做浏览器视觉验收。

正式羁绊调用与地点续播复用 `story.ts` 的 `.kizuna-card / .yuzu-kizuna-*` 爱心卡片，标题来自关联 Entry / Story，目的地来自 Area。赴约或等待态没有可提交 token，避免远程开播；正式子结束停在最终场景，恢复该场景原有合法 `.send-button` / Choice，不另设召回按钮。结果已回到当前父空间时使用普通“继续故事”Click。沿用原聊天滚动宿主和区域刷新，不新增页面或卡片皮肤。行为验证见 `tests/ui/story/story-space-history.test.ts`、`story-continuation.test.ts`；尚未做浏览器视觉验收。

运行态已提交的 Choice 复用 `story.ts` 的 Choice 卡片和现有 disabled 样式，保留全部选项，所选项显示“已选择”。历史卡片的 `.chat-current` 根以 Runtime 输出 ID 对应的流实例 key 协调；下一组 Choice 保持独立的当前输入。更新沿用聊天区域刷新与滚动恢复，不新增滚动宿主、定时器或整页刷新。行为验证见 `tests/ui/story/story-consecutive-choice.test.ts`，保存归属见 [[story-chat-and-theme-presentation]]。

Story 编辑器左栏顶部以 Switch 切换 Story、Entry 列表和发出方目录；三种视图保持挂载，切换只显隐对应面板，保留各自搜索、滚动和编辑中的 Composer。Entry 沿用 Story 列表项样式，显示名称、ID 与 Active / Passive 类型。点击 Story 或 Entry 统一切换中右两栏，复用相同 Frame、列身份、顶部栏与滚动容器；Entry 中栏复用原有结构化字段表单和 `.story-editor-authoring`，并在独立的被动池区块编辑所属 Story 共用的 PassivePool，右栏显示调用关系；Story 右栏以入口链接替代 Entry 详情表单，PassivePool 表单与新增操作也移至 Entry 中栏，浏览历史共用中栏前进 / 后退控件。StoryNode 的 Entry 入口卡沿用爱心卡片外观，主体只选择节点；右侧目标小卡片打开 Entry，缺失目标时禁用。发出方来自当前 Registry 的旁白、老师与角色；目录项只显示圆形头像和名字，优先使用默认角色差分的色组或图片，无头像时显示名字首字。当前发出方在目录中标记。后续入口可复用该左栏视图切换，不替换三栏 Workspace。

Story 编辑器固定输入区沿用 Talklet 的头像、姓名与气泡层级；圆形发出方头像入口切换左栏到发出方目录，正文编辑留在聊天气泡内，发送使用共享 `send-button` / `send-bubble` 样式。输入更新保留 textarea 节点与焦点。“保存草稿”和“保存到运行内容”仍在操作组中；运行内容保存是显式动作，不随输入或导航自动提交。成功与错误提示使用原位状态区，保留输入、选中节点与滚动；“仅当前运行有效”说明保存范围。写入机制见 [[runtime-editor-and-project-checks]]。

节点的可选局部标记条件沿用右栏 label/input；Operation 的局部标记作为“行为类型”下的分支，操作方式、名称和值与其他行为字段处于同一属性组。写入/移除使用浅层 select，仅写入分支显示值控件，移除分支收起值。控件按语义 key 局部协调，不隐藏编辑态节点，不重建三栏或流滚动容器。

Choice 编辑预览的每个选项旁保留紧凑 `.story-editor-choice-flag-card`，拖入后续节点在该选项 `marks[]` 声明选择标记，并给目标节点写入 `requiresFlag`；同一个选择标记可服务多个后续读取者，重复拖放保持幂等。显式解绑只移除指定节点的读取条件，声明可继续供选项局部条件或 continuation 回传使用。每组 marks 由 Runtime 在成功选择时整体替换。读取标记的 StoryNode 在最左侧显示固定宽度、同 ID 稳定配色的记录；其他节点仍可拖到该记录复用标记。只在编辑态预览启用，不改 Runtime Choice 卡片；标记不是通用 StoryAction，详见 [[runtime-editor-and-project-checks]]。

Click 剧情入口卡和 insert / goto 转移共用右侧独立 `.story-editor-target-card` 小按钮，显示目标名称与 ID，沿用局部标记按 ID 稳定生成的随机深色与 104px 宽度；长文本截断并保留完整 title，缺失目标禁用。主体只选择 StoryNode 查看属性；Transfer 主体沿用 `.story-editor-action-node`，展示转移方式与目标说明。Button 完成后进入后续独立节点；Choice 不内嵌 Transfer。目标按钮复用统一 Story / Entry 浏览历史。复用入口为 `story-editor/target-view.ts`、`transfer-view.ts`、`view.ts` 与 `story-editor.css`，行为见 `tests/ui/story/story-editor-workspace.test.ts`；不增加滚动宿主，未做浏览器视觉验收。

Story 编辑器的属性栏顶部以 Switch 切换 Talklet、Click、Operation、Transfer、移动到 Area 与移动到 Chara；当前分支、可选能力、诊断与节点操作在 Switch 下方排列。节点流按 `nodes` 顺序自由组合；旧 stage 字段隐藏在兼容数据中，不作为编辑步骤。Talklet 后紧邻可用 Click 时自动衔接输入，否则送达后提供自由继续；连续 Click 逐个呈现。Runtime Operation 的可读状态效果按声明顺序以独立奖励条目加入聊天流；效果逐条显示期间，底部用橙色处理中状态短暂禁用推进，播完后自动衔接后续节点。标记与 Extra 控制状态不播报，Operation 不伪造聊天台词。其他字段沿用右栏既有 label / input / select / textarea 与 `.mini-action`，不引入独立表单框架或新配色。Talklet、Button 与入口卡的共享正文仍在子类型字段上方编辑；Choice 只编辑各自选项文案，不显示不能代表候选的共享“正文”输入。Click 交互选项与属性平铺，不再共用小型属性容器。可选能力是一个带复选框的 `.story-editor-toggle` 区块，未启用只收起子项、保留开关；启用后的字段放进左侧竖线的 `.story-editor-optional-content`，与父级形成层级而不是弹窗。有序列表使用 `.story-editor-list-heading`（标题＋添加）与 `.story-editor-property-row` 浅底虚线行，行操作按钮固定在行尾；只读复杂值使用 `.story-editor-readonly` 展示原值并提供显式清理按钮，不用输入框伪装可编辑。字段诊断沿用 `.story-editor-error`，每条诊断右挂“清理该字段”危险操作，作者可见地决定是否丢弃来源字段。样式入口为 `src/ui/css/story-editor.css`，属性 DOM 行为见 `tests/ui/story/story-editor-properties.test.ts`。

Story 编辑器的“呈现”使用常显大标题，下方平铺“气泡位置、文字对齐、头像显示、头像引用”四项，每项以 label、控件和用途说明组成。不套可选区块、竖线缩进或内部卡片；未设置时沿用默认，下拉框选值后仍可切回默认。复用 `property-fields.ts` 的 `presentationEditor`、`.story-editor-property` 与 `.story-editor-hint`，仅 `.story-editor-presentation` 负责标题和字段间距。字段使用原有路径 key 局部协调，保留输入焦点、光标与属性栏滚动；行为证据见 `tests/ui/story/story-editor-properties.test.ts`。

Talklet / Click 基础设计器复用 `.story-editor-property-content`，增加一个以 node.id 为 key 的语义 section（`data-story-basic-properties`），供基础表单独立挂载；现由“基础｜演出”常驻页签切换，不新增滚动宿主。按击基础次数、随机增量直接平铺，输入节奏在适用的对话下同样直接填写，空白省略与数值 0 分开处理。入口卡续接与 Choice 出现条件在缺省时只显示创建 / 恢复按钮，存在时显示原有可关闭区块。沿用 `workspace.story-editor` region 和 `patchEditorDOM`，普通输入保留基础区、控件、光标及其他栏滚动；相关分支改变时只协调其字段，沿用既有浮层清理。入口为 `renderStoryNodeBasicProperties()` / `controller.ts`，行为见 `tests/ui/story/story-editor-properties.test.ts`；未做浏览器视觉验收。

节点演出页沿用 `renderTabs()` 与现有属性 label / select / input，两个 page 按稳定 key 挂载，切换仅更新 hidden / 激活态；已配置时显示轻量标记及恢复默认按钮。中栏视口浮层提供纵向基准、横向基准与单位。仅当前选中节点已开启定位演出时显示一组工具，右栏保留 X/Y 输入。流中的定位节点保持正常渲染，附带超迷你“演出 / 结束演出”按钮，逐节点切换会话内编辑态；开启时选中该节点并显示演出属性页（旧 Operation 显示原属性页）。开启的预览通过共享 `bodyOverlay` 位于中栏正文视口，脱离流的滚动，切换属性对象不关闭其他节点；不再使用顶部小画布。拖拽命中区与蓝框随内容使用同一锚点平移，保留抓取偏移并写回所属节点的同一 performance.layout；取消拖拽不写入，九宫格基准同时对齐窗格和内容的同名点，百分比与 CSS 像素共用一组有符号偏移。旧定义继续读取左下原点与横向锚点。内容按自然宽度和锚点实际剩余空间排版，极贴边时保留可读空间。局部样式用于流内与定位内容；普通旁白、标题和 Choice 完成记录均走共用渲染。运行态定位展示在 `.chat-pane` 非滚动层，当前输入使用原 token，历史记录禁用。没有新的配色体系或滚动容器；新增视口包装层保留原 body、作者节点和表单身份，仍走 `workspace.story-editor` region 与 `patchEditorDOM`。入口为 `property-fields.ts` / `controller.ts`、`components/story/story.ts`，证据见 `tests/ui/story/story-editor-properties.test.ts`、`tests/ui/workspace/workspace-frame.test.ts` 与 `tests/ui/story/story-performance.test.ts`；浏览器视觉验收未运行。


Story 作者配置沿用右栏原滚动宿主：概述保留基本字段，关系页放置关联 Entry，其他工具包按文档身份、扩展、检查 / 试播 / 保存的大标题平铺；结构值的路径标题标识实际数据关系，不套多层卡片或竖线缩进。类型构造、字段增删、列表换序与引用候选复用普通 label / select / input 与 mini-action；切换构造说明会替换本项。编辑器不提供 Entry 羁绊绑定字段，旧绑定只在兼容数据和运行时保留；跨 Entry 内容通过剧情入口卡选目标 StoryEntry。结构值输入和行沿稳定 key 更新，编辑 Entry ID、换序和错误输入不重建输入或滚动宿主。隔离试播只在投影变化时刷新，离开即释放。入口为 `authoring-view.ts` / `structured-value.ts` 与 `.story-editor-authoring/.story-editor-value/.story-editor-preview`；状态与接口边界见 [[runtime-editor-and-project-checks]]，DOM 证据见 `tests/ui/story/story-editor-authoring.test.ts`。当前未做浏览器视觉验收。

Story 主题 / 覆盖层作者控件沿用同一右栏字段与中栏节点流，不再嵌套滚动容器。`presentation.theme` 的色板、token、语义颜色与背景层按具体合同呈现；空字段显示继承来源，显式覆盖可恢复继承。引用的 ColorGroup / 实体 ThemeDef 通过 `ThemeContentEditorService` 在选定编辑态包打开会话，使用其 preview / save / cancel 路径。旧 `overlay.show` 也通过所属节点的迷你按钮进入同一固定演出编辑层，重用 `renderChatTexts` 的作者预览模式，归一化 x/y 双向映射到同一草稿字段；拖动过程中只更新预览与所属节点当前表单的数值，释放时合并到 `workspace.story-editor` 区域刷新。稳定动作路径识别覆盖层，浮层锚点仍由 `patchEditorDOM` 的 mutation range 生命周期处理。执行影响说明跟随 Overlay / Transfer / Entry 动作字段。自动化行为入口为 `tests/ui/story/story-editor-properties.test.ts`、`tests/engine/story/story-authoring.test.ts` 与 `tests/engine/theme/theme-content-editor-service.test.ts`；本轮未完成桌面浏览器手动验收。

Story 编辑器中栏在每个节点前及列表末尾提供轻量插入空位，只有当前空位或拖拽目标显示横线。空位以稳定节点锚点协调，点击不会选择或创建 StoryNode；拖放通过中栏根委托接收带版本和种类的载荷，当前只移动本草稿内的 StoryNode。拖动悬停只更新目标提示，不触发整栏刷新；落点更新节点顺序时沿用节点 key，保留未变更节点 DOM 与正文滚动。当前投放目标与拖动载荷使用分型入口，后续增加向节点内元素投放和绑定时再扩展其分派，不把将来的绑定语义提前写入 Story。样式入口为 `.story-editor-insertion-point` 与 `.story-editor-node.is-dragging` / `.is-drop-target`，机制及数据边界见 [[runtime-editor-and-project-checks]]。

区域地图交通沿用 `area-map-workspace.ts` 的节点和详情区：当前区域通过主题色实心节点标记，详情显示到访状态，固定动作区区分普通前往、乘交通前往与快速返回。`area-map-dom.ts` 按节点身份原位更新；连线只显示领域中的真实连接，单向通路使用箭头；地图不授予通行资格。此为现有地图组件的扩展，行为覆盖见 `tests/ui/area-map/area-map-controller.test.ts`。

| 模式 | 入口 / 已有例子 | 用途与例外 |
| --- | --- | --- |
| 游戏启动壳 | `src/ui/index.html`、`src/ui/main.ts`、`src/ui/startup/` | 应用样式就绪前沿用既有深色静态壳：左侧当前阶段、等待时间与可滚动的载入内容，右侧八步流程及步骤计数。阶段状态、正文与诊断通过 textContent / 属性原位更新，列表和诊断按钮保持挂载；步骤进度不冒充时间百分比。颜色与系统字体沿用启动壳自身兜底，不新增字体依赖或扩成游戏主题规范。DOM 行为与桌面浏览器正常 / 慢载入已核对，规则见 [[startup-and-runtime]] |
| 工作区骨架 | `src/ui/components/shared/workspace-frame.ts` 的 `renderWorkspaceFrame` / `renderWorkspaceColumn`；`src/ui/workspace/workspace-renderer.ts` | 页面内容区拥有剩余高度和顶栏下间距，Frame 仅提供填父容器的网格；列的 header / body / 可选 footer 各自分离，复用单份 Presentation surface，不另手写相似外框 |
| Story 作者编辑三栏 | `src/ui/story-editor/view.ts` 的三个语义栏工厂、`src/ui/css/story-editor.css`；保存/路由见 [[runtime-editor-and-project-checks]] | 顶栏直接进入；沿用共享顶部与 panel surface，列表单独滚动、中栏正文及右栏属性使用共享 body 滚动，中栏输入位于固定 footer。正文复用纯聊天条目呈现，选择外层采用不收缩的纵向 Flex，随内容自然增高并保留角色/老师左右对齐；换行只作用于正文，避免模板空白撑高气泡。Click 在中栏按运行态样式预览：单按钮居中，选项卡沿用运行态右侧方向，剧情入口卡沿用卡片左右对齐；普通和多段按钮保持同一高度与箭头，多段只追加标识；预览控件禁用且不触发推进。老师回应由独立 Talklet 编写，分支回应由局部标记和 `requiresFlag` 控制；Operation 用简短系统条说明动作；属性仍在右栏编辑。作者节点只选择不播放；按作者 node.id 更新并保留表单焦点，不套运行态 ChatStream 或其 200 条上限。原型以 DOM/行为自动化验证，按用户要求不做浏览器验收 |
| 栏的复用与重新装配 | `src/ui/columns/index.ts`、`src/ui/workspace/workspace-columns.ts`；机制见 [[workspace-columns-and-layout]] | 用有序栏数组与单项 width 设计页面；稳定 key 跟随展示组，`definitionId` / `bindingKey` 表达当前正文和业务目标，slot 只作旧外观别名。跨宿主沿用来源主题与 `data-column-origin` 样式；返回由调用方显式绑定，换序/改宽保留原节点。复杂 Map/Operation 仍需各自业务动作适配；DOM / 行为回归已覆盖，浏览器视觉验收待授权 |
| 经典 Game 内容栏 | `src/ui/columns/index.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/css/area-map.css` | Game 固定装配区域导航、聊天/日志和设施/角色/强化/其他三组展示位置；AreaHero 最多呈现五条当前 Area 故事快捷入口，沿用区域地图按钮状态样式，完整故事列表仍在 Area Workspace。内容工厂不决定栏位；默认页签、资源条显隐、导航和动作由 Game 装配指定。当前有 DOM / 行为回归，未完成桌面浏览器视觉验收 |
| 区域 Workspace | `src/ui/components/world/area-workspace.ts`、`src/ui/workspace/workspace-router.ts`；`createAreaNavigationColumn()` 位于 `src/ui/columns/index.ts` | 独立路由携带 Area ID；左栏复用正式区域导航栏，中栏显示区域概览与可滚动的待接取 ActiveStoryEntry 列表，右栏显示区域详情占位；主题 panel surface 与宿主圆角沿用 WorkspaceFrame。点击接取经 GameCommands 启动，成功后返回一般 Game chat 并切到 Entry owner；当前 Area 改变时退出旧 Area 路由。行为覆盖见 `tests/ui/workspace/workspace-lifecycle.test.ts` |
| 选择页节点图谱 | `src/ui/components/navigation/selector-graph.ts`、`src/ui/navigation/selector-page.ts`、`src/ui/css/selectors.css` | 顶栏保留在最上层；SVG 轴测平面铺满选择页背景，不套画布卡片框；右侧独立浮动工作台承载详情与命令；比例尺固定在图面左下角，进入子图时提供较大的返回按钮，不额外显示状态图例。节点用 `g[role=button]`，位置 / 连线只作呈现；可见性、拥有、价格与动作仍来自 RevealStage、`UIContext` 与 GameCommands。比例尺 / 滚轮锚定缩放只改相机，购买后原位刷新节点与工作台，不整页重建 |
| 内容工具三栏 | `src/ui/components/shared/workspace-frame.ts` 的纯布局 `renderWorkspaceLayout`、`src/ui/runtime-editor/codex/workspace.ts` 的 `renderContentWorkspace`；超级图鉴实际使用 | 把已渲染的导航／条目／详情作为 Frame 直接子项；使用 `pane-switch` 窄屏显隐。该入口不创建游戏列 Host、surface 或 Presentation host；工具自己拥有表面和滚动区。可选操作 footer 仅在有内容时出现，当前图鉴不挂载。搜索留在固定区域，条目与详情各自拥有内容滚动；现有编辑器尚未迁入新骨架 |
| Tabs 与顶部区域 | `src/ui/components/shared/tabs.ts` 的 `renderTabs`、`renderPanelTabsRegion`、`renderPanelHeaderRegion`、`renderPanelActionsRegion`；`src/ui/css/workspace-controls.css` | 保持顶部宿主、主题状态与标题区域一致，不只复制按钮 class 而漏掉宿主元数据；公共顶部、标题/返回及兼容 story-trigger 按钮不依赖 Chat / Story 业务 CSS。Workspace 内容选择与跨路由导航使用语义动作，不编码物理栏位 |
| 工作区返回标题 | `src/ui/components/shared/workspace-titlebar.ts` 的 `renderWorkspaceTitlebar`；Contacts / Story / MapEntry 使用 | 标题或 Tabs 传给栏的 header，不包进正文滚动；返回控件使用 `workspace-back`，保留 `conversation-back` 别名。`.panel-tabs-region` 内容区与按钮共用 `--panel-tabs-control-height` 最小高度，纯文字与标签栏单行等高；长标题、标签可换行撑高，返回键不压缩。尚未完成本次浏览器视觉验收 |
| 固定操作与危险状态 | `WorkspaceColumnSpec.footer`；`layout.css` / `cards.css` 的 `mini-action--danger`、`primary-button--danger` | MapEntry、Area Map、Shop 的确定固定动作放到正文之外；`actions` 继续表示回调字典。危险按钮复用公共变体，不依赖兄弟 Workspace 的 CSS；禁用状态不触发可用态 hover。MapRun 的复杂 action dock 保留业务布局与 keyed 更新 |
| 同类 Mini card | `src/ui/css/cards.css` 的 `.mini-card` 与 `--card-*` | 继承视觉规则；业务渲染与内容来源由目标组件负责，没有宣称存在通用卡片渲染器 |
| Operation 手牌扇列 | `src/ui/components/operation/operation-workspace.ts` 的 `.operation-card-fan` 持有区；悬停展示由 `src/ui/presentation/operation-card-hover-overlay.ts` 承担 | 公共手牌、角色持有牌与场景行动候选共用横向交叠；卡面在独立顶层副本中显示抬高、焦点与光晕，原卡继续承接点击和拖拽。固定锚定的预备行动／敌方意图卡与购买项列表保留各自布局 |
| Spot 行动入口按钮 | `src/ui/components/operation/operation-entry.ts` 的 `renderOperationSpotFunctions`，由 `production.ts` 组合 | 沿用 `.mini-action` 和 `card.action` 主题宿主；同一 `operationEntry` 类型每按钮绑定一个关卡，放在设施操作组内，不插入聊天流。准入与继续状态从领域查询取得；已核对源码与定向测试 |
| Map / Encounter Run Workspace | `workspace-router.ts` 的 `map` runId 路由、`src/ui/components/map/map-workspace.ts`、`workspace-frame.ts` 与 `tabs.ts` | 左我方身份／HP／角色行动按钮，中 Node／Encounter 说明与最近结算文本流及固定操作区，右活动敌方／背景／节点进度；相邻地点移动选项在中部 Talklet 内按需出现。Node / Event 顶部操作组提供地图查看、重新游戏与放弃游戏：重新游戏以同一准入队伍从地图起点建立全新 MapRun；放弃游戏清除活动 MapRun 并返回进入前的位置，两者不回滚已写入的长期档案变化。三列顶部经 `renderPanelHeaderRegion` 复用统一宿主、控件高度与分割；消费共享三列宽度变量。实际滚动 owner 是 `data-map-region-key` 为 `party-scroll`、`talk-feed`、`action-options`、`context-scroll` 的内容区，窄屏另由 Map 根承接堆叠结构滚动。`UIController.refreshMapWorkspaceRegion()` 使用一份 detached View，经 `workspace/map-dom-updates.ts` 按语义 key 协调变化的消费者，保留 Frame、列根、顶部、滚动容器和有效按钮；缺失子区局部补回，只有 Map 根缺失等恢复失败才回退当前路由。命令继续由 `controller-actions-operation.ts` 一次性事件委托进入 GameCommands；只处理可视卡牌与反馈，不新增领域卡实例、完整历史日志或 UI 自有 Run 状态。行为与连续性由 Map Workspace、vertical-slice 和 map-dom-updates 测试覆盖 |
| MapEntry 行前／续行准备页 | `src/ui/components/map/map-entry-workspace.ts`、`workspace-router.ts`、`workspace-frame.ts` | route-only `map-entry` 复用三栏 WorkspaceFrame：中栏承载地图简介、提示、当前进度和明确的开始／继续操作；右栏固定显示队伍与局内资源；左栏保留游戏区域导航。复用 titlebar、panel surface、主题宿主与内容滚动区；不在准备页混入完整现场战斗操作或玩家选队。资料来自 MapEntryView，局部变更按稳定语义 key 保留 Frame、滚动和焦点；机制见 [[ui-refresh-focus-scroll]]。桌面浏览器已核验有效队伍 fresh、受伤续行、缺员／Story 门控、重开／放弃管理、终局及隔离 Origin 刷新读档后重入续行。 |
| 宿主与实体表现 | `src/ui/presentation/presentation-service.ts` 的 `renderUIHost`；`src/ui/components/presentation/entity-presentation.ts` 与 `src/ui/runtime/context.ts` 的查询 | 经只读上下文解析适用表现，不自行拼接全套主题规则或绕过实体揭示条件 |
| 弹窗与提示层 | `src/ui/interaction/modal.ts`、`src/ui/interaction/popovers.ts`；`src/ui/css/modal.css`、`src/ui/css/popover.css` | 先查共享生命周期、锚点与焦点处理入口，再扩展内容，不复制独立浮层管理系统 |

ModalManager 的普通弹窗沿用 panel / panel-light / ink-on-* 主题角色：标题 18px、正文与表单 14px、辅助说明及内容区小操作 13px；共享外壳提供 24px 内容留白、42px 表单高度、40px 底部按钮、可换行操作区和焦点反馈。原生表单元素保留语义，以背景、边框、圆角与继承字体消除浏览器默认外观差异；危险操作保留危险变体，checkbox / radio / range 不套文本框尺寸。主题编辑器与 Runtime Datapack 专用表单继续自主管理布局。仅修改 `css/modal.css`，不改变 DOM、业务字段、滚动宿主和关闭生命周期；验证见 Modal / Story 身份 / 商店 / Spot 支付共 22 项定向测试，以及 `.test-artifacts/modal-layout-preview.png` 样例截图。

MapRun 与 MapEntry 的 wrapper 仅保留业务身份并承接共享 `.workspace-page-content` 的尺寸；顶栏下间距统一在页面内容区产生，不由 wrapper 与 Frame 叠加。公共 `.topbar` 不参与收缩，保留底部分隔；MapEntry 的说明、队伍与资源分别在内容区滚动，主操作位于固定 footer。实现入口为共享 Frame、`layout.css` 与两页内容 CSS，回归见 `tests/ui/area-map/map-shell-layout.test.ts`；实际桌面几何和主题视觉仍待用户授权验收。

Map 的相邻地点选择由类型化 `FlowMapLocations` 投影到标准 Talklet。Talklet 只提供一个静态卡牌落点宿主；`renderMapActionCardButton()` 共用角色当前行动卡与 Flow 地点选择卡的卡面骨架，地点卡保持 82×58 固定尺寸，并按宿主的左右对齐、间距配置排列。卡片角度从稳定实例身份派生，刷新不会改变。宿主 / 插槽通过 `mapCardHostAttributes()` 与 `mapCardAttachmentAttributes()` 静态表达。地点卡只提供 `selectLocation` 入口，通过点击或键盘选中，再由 Map Workspace 统一 Click 按钮调用 Controller 和现有 MapRun 移动命令；空选择时该按钮阻塞。地点卡不提供卡牌目标或目标编辑入口。静态 DOM 附着、Hover 状态与作用关系保持为不同信息。当前地点与路线状态来自 Map View；锁定边不可选。遭遇或活动阻挡期间不显示；成功移动后回收旧选择条目并留下斜体旁白“从……移动到了……”。待选项只在当前 Workspace 交互会话中保留，不进入存档或历史。

Map Encounter 的按钮版将角色 Target／完整候选保留左栏，Ability／Item 草稿、共享覆盖槽与 Commit 放中栏底部，敌方 HP 在右栏。Action 声明 `additionalTarget` 时，Party Prepared 与当前选定的 Ability／Item 在 primary 组后增加独立“额外目标”按钮组；选择、清除和回显仍来自 MapRun Draft，按钮命令按当前来源分别写入，不覆盖 primary。该显式选择使用普通 DOM 委托，不扩展 map relation 拖放或关系高亮。`[data-map-encounter-region]` 仅作敌方信息锚点，不再代表整个遭遇的刷新边界；普通命令按消费者原位协调，保留 `data-map-focus-key` 控件、各滚动 owner 与范围外浮层。替换或移除节点前执行范围内浮层生命周期。最近回执来自 `actionPreview.recentCommit` 或同一只读 Run 的 `lastEncounterCommit`，按 requestId 标识更新；读者已在流底部时跟随新回执，阅读上文时保留位置。AG-1 的 Preview Dock 与最近回执 Feed 直接显示 ReadModel 的 `executionSequence` 来源顺序、目标、skip 和实际账本结果；E1 继续显示旧分组结果。卡牌目标按完整 CardRef scope 从当前只读卡牌视图解析名称，历史不可解析时显示通用“卡牌目标”。失败／成功按实际终态投影显示只读结果，不重建已清理的 Run。机制边界见 [[ui-refresh-focus-scroll]]。

当前 Encounter 单位卡在原有 HP／sCost 数值区内，仅当只读 `MapEncounterQueryView` 投影的 Shield 大于 0 时增加独立 Shield 数值行；最近 Commit 回执按 `shieldTrace` 顺序呈现每笔 Shield grant 与受击吸收／剩余伤害，数据只来自只读 ReadModel，不从 HP 或 Status 推导。一次性受击保护沿用 Effect Trace 的原有位置，在同一行显示目标、Status 来源与 Action、层数变化和拦截量，并明确标出 HP 不变、Shield 未消耗。Status 自然到期回馈沿用同一 Talk Feed，在 Action Trigger 后按独立 `statusExpiryTriggerTrace` 显示 Status、持有者、应用来源、到期前剩余时长及局内资源余额变化，不伪造 Action/Card 来源或新增容器。实现入口为 `src/arona-clicker/runtime/runtime-game-instance.ts` 与 `src/ui/flow/map-flow-model.ts`；投影和保存回执均由 `tests/ui/area-map/map-flow-adapter.test.ts` 覆盖。此扩展不增加 Workspace wrapper、CSS 或滚动区。

CardRef Modifier 目标复用同一 keyed 目标按钮组：Runtime 只投影另一个 Party Owner 当前实际 Prepared 且 AG-1 顺序严格后于来源的 damage/heal 卡，按钮内显示目标 Action 名与 `伤害/治疗 ±delta`。候选来源于 `actionPreview.preparedActions[].legalTargetCards` 与 `cardEffectModifierPreviews`，Draft/选择仍由 MapRun Owner 持有；CardRef 失效时拒绝原选择并要求重选，不按 Action ID 替换实例。复用入口：`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/ui/components/map/map-workspace.ts`、`tests/ui/gameplay-b/gameplay-b-map-workspace.test.ts`；此扩展未增加 Workspace wrapper 或 CSS。

## 内容与结构

通讯录角色页的简易培养沿用 `.char-stats` 与 `.primary-button`，`character-cultivation.ts` 以独立section承载等级/好感经验、消耗与反馈。普通训练、交流和突破通过Controller命令后按字段补文字与disabled，不替换培养按钮、角色页、联系人行或滚动宿主；范围缺失时只恢复右栏。证明入口为 `tests/ui/character/character-cultivation.test.ts`。不增加独立配色或字体。

转译演练场 Spot 沿用 `.mini-action`，点击后直接进入现有 MapWorkspace，不打开训练 Modal 或 MapEntry。战次、来源和构筑说明来自可信节点的 title/description；Hand、Prepared、目标、AG-1预览及回执复用既有卡牌区域与局部更新。返回保留来源场所位置，再入续行。旧 `components/character/variant-training-panel.ts` 仅供开发诊断。证明入口为 `tests/ui/core/variant-training-spot-entry.test.ts`；开发面板验证独立见 `variant-training-panel.test.ts`。

区域导航图复用游戏三栏 Frame/Titlebar 和左侧真实 Area rail；中栏为平面 SVG 节点画布，右栏为独立详情滚动区与操作反馈。point/landmark/portal 仅区分外观，选中/Focus 用既有 cyan 与主题文字色，行为来自领域脱敏投影。图册切换复用中栏工具条，更新只协调图册控件与地图区域，保留现有地图节点和视口。复用入口：`src/ui/components/map/area-map-workspace.ts`、`src/ui/workspace/area-map-dom.ts`、`src/ui/css/area-map.css`；既有地图基线已做桌面验收，Task0361 新增图册动态刷新与直达流程已自动化覆盖，本次桌面手工确认待完成。稳定节点 / 刷新与会话语义见 [[area-map-overview]]；不复制 Init / GlobalEnh 的母子图层级。

选择页右侧详情通过稳定的收起／展开按钮切换 `hidden` 与 `aria-expanded`，不替换工作台、滚动容器或画布。Init 的进入 CTA 先打开左侧世界线概览中转页（`renderInitOverview`），隐藏星图与右侧详情，保留顶栏、相机、子图历史和选中项；背景沿用 Init 投影，不叠加恢复区域的 Area 背景。概览只读取当前 View 或对应 Init 快照，确认进入才调用既有新建／恢复命令；返回星图或 Escape 恢复原按钮焦点与原画布。从世界线的结束游戏或硬重置入口离开时，也先停留在刚离开的 Init 概览；玩家主动返回星图后再展开节点图，排队的页面刷新保留该停留状态。该状态只由 `SelectorPage` 持有，不进入存档。复用与行为入口：`src/ui/components/world/init-select.ts`、`src/ui/controller/controller-panels.ts`、`tests/ui/controller/controller-init-select.test.ts`、`tests/ui/workspace/selector-graph-navigation.test.ts`。

选择页图间导航由 `src/ui/navigation/selector-graph-transition.ts` 在同一 SVG 中暂存新旧 world 与过渡图层，保留顶栏、画布与工作台外壳。Portal 显示母图星座时，进入按“图收成真实星座 → 沿跨图曲线绘线 → 展开子图”呈现；返回先沿曲线反向绘线，再由 Portal 比例、关联星点和两端相机推导共同的空间变换，让母图星座恢复完整母图布局，原子图的节点、边、高程与网格同步放大并可移出屏幕。原子图围绕关联星点额外扩张至三倍，逐渐失焦并在后段淡出，母图完全恢复后再整体回收；连线持续跟随关联端点，节点与高程投影的渲染尺寸最多为原尺寸的 1.5 倍。进入约 1.3 秒、返回约 1.4 秒，线抵达后才切换详情。绘线遵守 Portal 的独立开关，无星座时使用放慢的节点过渡；初次进入按图与星座的实际范围取景。节点聚焦及导航抵达的背景交接由 `src/ui/presentation/selector-scene-background.ts` 承担：保留不透明旧底，只淡入新层；快速切换冻结当前合成画面，图片就绪后交接，完成后复用已加载的新层并回收旧层。沿用原有主题与约 420ms 背景淡入，不新增装饰。行为证明入口：`tests/ui/workspace/selector-graph-navigation.test.ts`、`tests/ui/theme/selector-scene-background.test.ts`。

Map 的单位关系检查使用 `src/ui/workspace/map-relation-presentation.ts` 与 `map-relation-interaction.ts`，只消费 Runtime 的 `relations`。当前已验证的单位阶段：来源牌上浮与发起标记、选中单位的中性包围框 / 目标角标、弱虚线合法候选；自身可以叠加发起与目标标记。单位与牌面保持原节点，角色只是属性补丁，不按敌我或效果正负决定受用角色。

当前牌点击继续展开右侧替换浮层；候选是既有 Swap / PlayerCommand 的展示，不是第二套 Hand 或独立战斗卡。独立“固定作用关系”与“修改目标”入口避免同一次点击同时换牌和确认目标。Hover / Focus / 候选预览不写领域状态；单位或真实卡牌的点击 / 键盘 / 拖拽确认走 MapRun 草稿命令，只有显式提交才结算。真实卡牌的当前牌、Hand 展示与目标选择代理共享 Owner object key；代理仅选择受用牌，不换牌、不创建实例，未选 Command offer 无卡实例身份。进入目标编辑先关闭替换浮层，再安装编辑状态，避免关闭动作误选目标。目标编辑 / 拖拽优先于替换浮层、固定、普通 Hover / Focus；未知敌方目标只提示未知。sCost 显示实际余额；本轮减免按所选卡实际执行计算。同角色卡牌只高亮。Flow 独立玩法卡、保留的相对规则与作用线曾列入 Task 0298（原归档已删除） 的后续范围；当前状态需核对源码与测试。

- 内容来源：通过 `UIContext` / `GameView` / 只读查询取得名称、描述、数值与状态，优先沿用目标页面的格式化方式；读写边界见 [[read-model-and-ui]]。
- 结构依据：完整游戏工作区通过 `renderWorkspaceFrame()` 和 `WorkspaceColumnSpec` 声明 `hostId`、`workspaceOwner`、`surface` 与 `scroll`；纯布局入口接收预渲染列，不提供这些 Host 语义。按入口选择机制，不把游戏 Host 结构机械套到内容工具。
- 路由与更新边界见 [[workspace-navigation-and-rendering]]、[[ui-refresh-focus-scroll]]。

结构验证入口：`tests/ui/workspace/workspace-frame.test.ts` 覆盖 Frame、列身份和顶部区域组合。浮层、状态与目标页面测试按改动选择。本表只覆盖已核对入口，不表示所有业务页面都共用一个组件。


超级图鉴的中文分类与类型标签由 `src/ui/runtime-editor/codex/content-labels.ts` 提供；名称、说明、关系与可靠来源来自只读内容查询。主路径为资料／被引用，完整出向关系、字段树和 JSON 进入技术详情；未知字段仍可展开。`tests/ui/workspace/workspace-frame.test.ts` 验证内容工具 Frame 的直接子项、`pane-switch`、无游戏主题 Host，以及有操作内容时才输出 footer。更新边界与来源限制见 [[ui-refresh-focus-scroll]]、[[read-model-and-ui]]。此为已采用的工具特例，不改变游戏工作区默认主题规则。

StoryEntry 基础配置复用原中栏表单和右栏关系／Flag 卡片：激活方式、历史归档独立成组，只显示当前三类分支的合法字段，公共高级内容仍使用原结构编辑器。切换用 ModalManager 展示含义并确认，候选草稿先保存成功再提交；错误、取消和过期确认保留原分支。抽取池只列直接关联项，以稳定结构行 key 的 details 展开；编辑中解除关联保留本次面板，离开 Entry 后重新反查，展开状态随局部协调保持，不增加滚动宿主。入口为 entry-activation.ts、authoring-view.ts 与 dom.ts；DOM／存储失败回归见 tests/ui/story/story-editor-authoring.test.ts。
