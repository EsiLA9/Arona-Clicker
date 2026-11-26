# Story 正文、原位编辑与节点操作

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 三栏作者流和运行态外观

顶栏直接进入。沿用共享顶部与 panel surface，列表单独滚动、中栏正文及右栏属性使用共享 body 滚动，中栏输入位于固定 footer。正文复用纯聊天条目呈现，选择外层采用不收缩的纵向 Flex，随内容自然增高并保留角色/老师左右对齐。换行只作用于正文，避免模板空白撑高气泡。Click 在中栏按运行态样式预览：单按钮居中，选项卡沿用运行态右侧方向，剧情入口卡沿用卡片左右对齐。普通和多段按钮保持同一高度与箭头，多段只追加标识。预览控件禁用且不触发推进。老师回应由独立 Talklet 编写，分支回应由局部标记和 `requiresFlag` 控制。Operation 用简短系统条说明动作。属性仍在右栏编辑。作者节点只选择不播放。按作者 node.id 更新并保留表单焦点，不套运行态 ChatStream 或其 200 条上限。

源码入口为 `src/ui/story-editor/view.ts` 的三个语义栏工厂、`src/ui/css/story-editor.css`。保存/路由见 [[runtime-editor-and-project-checks]]。

## 固定输入区与保存反馈

Story 编辑器固定输入区沿用 Talklet 的头像、姓名与气泡层级。圆形发出方头像入口切换左栏到发出方目录，正文编辑留在聊天气泡内，发送使用共享 `send-button` / `send-bubble` 样式。输入更新保留 textarea 节点与焦点。Classic 在正文固定操作组提供「保存草稿」和「保存到运行内容」，Advanced 将文档动作装配到顶部工具带。运行内容保存是显式动作，不随输入或导航自动提交。成功与错误提示使用原位状态区，保留输入、选中节点与滚动。“仅当前运行有效”说明保存范围。写入机制见 [[runtime-editor-and-project-checks]]。

Story 正文中栏的固定输入区使用紧凑样式，将「正文操作」和「添加节点」两组按钮的最小高度设为 26px，并收紧垂直留白，为正文滚动区腾出空间。Classic 显示两组，Advanced 保留正文内的添加节点组。各组沿用原有的换行和按钮状态，样式见 `src/ui/css/story-editor.css` 的 `.story-editor-composer`。

## 正文、按钮与选项原位编辑

Story 编辑流的 Talklet 正文、Click 按钮 / 各 Choice 选项 / 入口卡文案可双击原位编辑，复用原文本元素与主题外观，不新增包裹层。活动文本仅添加细虚线轮廓并临时切为纯文本编辑。空正文保留最小命中面积。Click 编辑预览使用展示容器，正式播放仍使用原按钮。`StoryInlineTextEditor` 持有单个短暂编辑会话，按节点与稳定属性 key 同步草稿 / 右栏。`workspace.story-editor` 协调时保留活动文本子树、光标和组合输入，其余区域沿原 key 更新。点击外部、保存或离开提交，Esc 恢复原值，粘贴仅接收纯文本。Choice 行重排保留选项身份。入口为 `story-editor/inline-text.ts`、`dom.ts` 与 `controller.ts`，回归见 `tests/ui/story/story-editor-inline-text.test.ts`。

## 发出方姓名与头像

Talklet 发出方姓名复用原 `.chat-name` 元素和 `StoryInlineTextEditor` 的双击原位编辑。姓名保持单行，Enter / 外部点击提交，Esc 恢复，中文组合输入沿用正文会话保护。右栏“发出方”选择角色，“自由显示名”仅覆盖文字，清空恢复默认。“头像引用”复用图片目录并独立覆盖角色头像。别名更新通过既有 `workspace.story-editor` 区域协调，只更新姓名和相关属性，保留姓名输入元素、头像、焦点与滚动。实现为 `inline-text.ts`、`property-fields.ts` 与共享 `story.ts`。默认角色、同名别名、图片覆盖、保存重载和原位身份由 `tests/ui/story/story-speaker.test.ts` 验证。

## 节点 ID 与原位改名

节点信息显示默认类型前缀加三位序号，例如 `talk-001`、`click-001`、`operation-001`、`transfer-001`、`move-area-001`、`move-chara-001`。手写 ID 与已有节点保留原值，复制可见后缀为 `-copy-编号`。节点 ID 与更改控件沿用原 DOM 和区域协调。分配、冲突和兼容规则见 [[runtime-editor-and-project-checks]]，来源 `src/ui/story-editor/model.ts` 与 `tests/ui/story/story-editor-model.test.ts`。

## 插入位置与拖拽

Story 编辑器中栏在每个节点前及列表末尾提供轻量插入空位，命中区域高 12px，横线默认透明，Hover／焦点显示 1px 边线，当前空位与拖拽目标显示 2px 主题强调线。空位以稳定节点锚点协调，点击不会选择或创建 StoryNode。拖放通过中栏根委托接收带版本和种类的载荷，当前只移动本草稿内的 StoryNode。拖动悬停只更新目标提示，不触发整栏刷新。落点更新节点顺序时沿用节点 key，保留未变更节点 DOM 与正文滚动。投放目标和拖动载荷按类型分派，空位负责排序，Flag／Choice 的绑定规则见 [[ui-style/visual-languages/authoring/patterns/flag|Flag 模式]]。样式入口为 `.story-editor-insertion-point` 与 `.story-editor-node.is-dragging` / `.is-drop-target`，机制及数据边界见 [[runtime-editor-and-project-checks]]。

## StoryNode 右键菜单

StoryNode 右键提供复制，节点间 / 末尾横线右键提供粘贴。`node-context-menu.ts` 的单项 body 级菜单沿用 mini-action 与锚点 panel-light / ink-on-panel-light / line / panel-shadow。菜单只增加一个 role=menu 容器和操作按钮，按鼠标位置限制在视口内。关闭、外部点击、滚动、失去锚点与离开编辑器均释放菜单。原位正文 / 名称和表单输入保留原生文字右键。复制只保存会话快照。粘贴沿 `insertAtCurrentPoint` 更新草稿，以 workspace.story-editor 区域协调保留原节点、横线与滚动宿主。ID 分配和编辑缓存复制入口为 `node-clipboard.ts`，回归见 `tests/ui/story/story-editor-node-clipboard.test.ts`。

StoryNode 菜单的固定容器最小宽 128px、留白 4px、圆角 6px，按视口四周 4px 夹取。可用菜单项聚焦且不滚动，Esc 关闭并将焦点还给锚点，窗口 resize 与滚动都关闭菜单。替换含锚点的 DOM 前调用 `dismissBeforeMutation()`，更新结束用 `retainIfAnchored()` 清理脱离文档的锚点。样式见 `src/ui/css/story-editor.css`，实现见 `src/ui/story-editor/node-context-menu.ts`。
