# UI 视觉结构待处理清单

条目来自当前源码对照，均为待评估的改进方向。浏览器视觉效果待核。已经采用的视觉规范见 [[ui-style/00-index|UI 风格指引]]。

| 类型 | 当前依据 | 后续处理及验收边界 |
| --- | --- | --- |
| 同一工具宿主的视觉衔接 | Runtime 外壳和表单使用 `--re-*`，图鉴与内容浏览区域使用 `--codex-*`。两套表面、边框和强调角色在同一工具中相接。见 `src/ui/css/runtime-editor.css` 与 `src/ui/runtime-editor/codex/codex.css`。 | 对照「内容浏览器 → 条目编辑」以及「图鉴 → 技术详情」的全路径。先检查分隔、文字对比、焦点与选中态，再决定共用哪些视觉角色。保留资料阅读与编辑提交的功能差异。 |
| 检索三栏的结构分叉 | 图鉴经 `renderContentWorkspace()` 使用共享纯布局，Draft 浏览器在 `renderRuntimeEditorWorkspace()` 内自行生成类似 Grid。见 `src/ui/runtime-editor/codex/workspace.ts` 与 `src/ui/runtime-editor/view.ts`。 | 评估两者能否共用导航、条目、详情及可选底栏的布局合同。验证搜索位置、各自滚动和焦点、详情更新、固定应用栏与 Draft 写入路径。 |
| 编辑列表行的状态表达 | `.editor-list-item` 与 `.story-editor-list-item` 分别定义表面和边距，Story 另有局部选中、禁用和发出方变体。见 `src/ui/css/editor-shared.css` 与 `src/ui/css/story-editor.css`。 | 用 Story 发出方、关系引用和共享条件候选做对照。确认等价列表行的留白、长 ID 换行、选中、禁用和同行操作。先统一共用视觉角色，组件抽取以能保留各自点击语义为条件。 |
| 作者工具动作的层级 | Story 正文 footer、属性工具页和 Advanced 工具带分别装配文档、正文与节点动作。StoryEntry 随模式移动试播、保存、检查和应用。见 `src/ui/story-editor/view.ts` 与 `src/ui/workspace/editor-workspace.ts`。 | 明确跨实例、当前文档、选中节点三种作用范围及位置规则。在 Classic／Advanced、Story／StoryEntry 间核对主操作是否可发现，且正文滚动和现有命令绑定连续。 |
| 通用工作区与图形画布的细节衔接 | Console 外壳和星图顶栏已有外边距对齐。地图与 Operation 的正文内边距、滚动和中栏动作布局由各自样式定义。见 `src/ui/css/layout.css`、`src/ui/css/selectors.css`、`src/ui/css/map-workspace.css` 与 `src/ui/css/operation-workspace.css`。 | 先比较同角色的顶栏、栏头、主要动作和分隔。只统一语义一致且肉眼可见的差异。保留星图铺底、Map 消息流和 Operation 手牌交互所需的空间与锚点。 |
