# Task：Stage 02：Editor Workspace 公共表现、栏位宿主与框架交互规整

状态：待处理

## 目标与验收

- 目标：Story、StoryEntry、World 继续共享 Stage 01 的 `editorLayout`，并进一步由现有 Workspace 模块统一装配高级编辑器外壳、公共 CSS、布局命令与栏位生命周期；业务只提供栏位内容和业务命令。
- 完成条件：Story 与 World 独立进入时都能加载公共外壳、目录树和滚动表现；布局、Classic/Advanced、Ribbon、分隔线操作由公共入口处理；Story 的局部更新与 `WorkspaceColumns` keyed 生命周期仍保持，业务变化不再无条件重建无关栏位；现有两种主题和主要 Story／World 操作无回归。按本 Task 的浏览器清单和定向测试验收。
- 边界：不实现 Stage 03–06 的公共 Browse Instance Manager、World 实例接入、Workbench 路由解耦或完整 Explorer 状态统一；不重设计视觉语言、不改业务保存协议、不建立平行 Column Manager 或全局渲染调度器。

## 当前依据与改动方案

- 当前依据：
  - `src/ui/css/story-editor.css` 的 `.editor-workspace` 框架规则集中在约 785–1118 行；目录滚动条与共享 Story／World 树行、Chevron 规则位于约 128–247 行；同一文件还含 Story 正文、节点和试播样式，公共与 Story 业务选择器目前混杂。
  - `src/ui/css/game.css` 全局导入 `editor-shared.css`；`src/ui/utilities/surface-styles.ts` 分别动态加载 `story-editor.css` 和 `runtime-editor.css`。因此 World 是否独立获得完整框架表现，取决于实际 World 入口的 surface 加载及 CSS 顺序，不能仅凭规则已移动判断完成。
  - `src/ui/workspace/editor-workspace.ts` 已有 `EditorLayoutService`、外壳渲染、实际栏宽投影和 `bindEditorWorkspaceResize()`；Ribbon 拖动、栏位拖动、双击复位已在该公共绑定内。Story `src/ui/story-editor/controller.ts` 仍自行处理 view select 与 Classic/Advanced 命令；World `src/ui/controller/controller.ts` 的 `bindWorldBrowser()` 也自行设置 view/mode、更新栏宽并触发刷新。通用命令仍有两套绑定。
  - Story `storyEditorChrome()` 和 World `renderWorldBrowser()` 都通过 `createEditorWorkspaceFrame()`／`renderEditorWorkspace()` 使用公共装饰，但内容组装和更新路径不同。Story Controller 保留局部渲染与焦点／滚动恢复；World 通过公共 `WorkspaceFrame` 渲染目录和摘要，并在实体链接时局部更新摘要。
  - `src/ui/components/shared/workspace-frame.ts` 定义 `WorkspaceColumnSpec` 与 `WorkspaceFrameSpec`；`src/ui/workspace/workspace-columns.ts` 的 `WorkspaceColumns.mount()` 已按稳定身份/keyed 内容更新、重排、释放及焦点恢复。`src/ui/workspace/editor-workspace-frame.ts` 仅提供编辑器栏位装饰和 Frame 包装。Stage 02 应沿用这些能力。
- 具体调整：
  - 先逐项核对 `story-editor.css`、`editor-shared.css`、World／Story 样式加载路径及选择器的实际消费者；将 Editor Shell、Ribbon／工具组、实例条、Work Type Rail、轨道／分隔线、公共状态栏迁到公共框架样式模块，将目录树／Chevron／层级线／悬浮滚动条放到公共目录表现模块，将确实共用的 Review 基础样式放到共享表现模块。Story 正文、节点卡片、Entry 表单、试播和专有属性样式留在 Story。调整 `surface-styles.ts` 与全局 CSS 导入顺序，使 Story 或 World 单独进入时都加载相同公共规则；删除迁出后的重复规则，不用后置覆盖层掩盖旧归属。
  - 在 `editor-workspace.ts` 的现有装饰、绑定入口中收口浏览视图、Classic/Advanced、Ribbon 与分隔线命令。公共绑定接收宿主刷新及业务委托回调；Story／World 只保留打开、保存门禁、实例、Work Type 和专属业务命令。退出命令经公共入口调用业务退出回调，Story 的 `beforeLeave` 保存门禁保持在业务边界。复用现有 `bindEditorWorkspaceResize()` 能力，避免出现第三个大型 Controller。
  - 继续以 `EditorWorkspaceChrome` 提供公共顶部命令／状态与栏位能力，以既有 `WorkspaceColumnSpec`／`WorkspaceFrameSpec` 作为业务内容输入；只在确有重复的装配或绑定处补薄契约。Story 与 World 的刷新继续由各自协调器提交变化：公共宿主只更新变化的外壳区域或 keyed 栏位，不以每次内容更新重建整个 Workbench。保留 Story 的正文 patch、输入、试播及属性编辑稳定性，也保留 World 的实体摘要局部更新。
  - 与 `task-0383-editor-session-and-review-tools`、`task-0384-editor-directory-navigation` 的交付范围有重叠：施工时先核对它们当前实现与用户验收状态，复用已经落地的目录渲染、Review 或操作，不再复制实现；本 Task 负责把共享表现放到正确的公共加载入口并收口宿主职责。涉及未验收的行为时，保留其既有验收边界，不把本 Task 的结构整理误记为前序 Task 已验收。
- 衔接与验证：
  - 更新 Story `bindWorkspace()` 与 World `bindWorldBrowser()`，移除两边重复的公共 view/mode/Ribbon/分隔线处理，接入公共回调；实例激活、关闭、复制、Work Type 切换继续调用现有业务函数。观察器、事件 listener 与订阅沿各自 AbortSignal／dispose 生命周期清理。
  - 定向测试覆盖 `tests/ui/story/story-editor-workspace.test.ts`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts` 与 `tests/ui/workspace/workspace-columns.test.ts`：公共命令两业务共用、World 无需加载 Story CSS、布局偏好与压缩拖动无回归、局部更新不替换稳定栏根／滚动／焦点、释放时无重复绑定。
  - 实际浏览器分别从大厅独立打开 Story 与 World；检查三栏／双栏／专注、Classic／Advanced、Ribbon 与分隔线；切换两个主题，检查目录悬浮滚动条显隐不造成行位移；输入 Story 正文、修改 Entry 属性、切换 World 实体后确认没有无关区域重建；切换实例、目录管理、试播、退出并重复进入。以现有主题和 DOM 身份／scroll key 检查核对更新范围。
- 待核实：Task 0383、0384 的待验收状态与本阶段部分目录／Review 样式工作有交叉；开工前对照它们的实际代码差异与验收结果，明确哪些工作已完成、哪些只需迁移样式归属，避免重复施工。

## 工作项

- [ ] 核对 Task 0383／0384 的实现与验收边界，形成不重复施工的公共职责清单。
- [ ] 核对 Story／World surface CSS 加载顺序，迁移公共框架、目录和 Review 规则，保留 Story 业务样式并清理重复选择器。
- [ ] 将布局视图、模式、Ribbon、分隔线命令收口到现有 Editor Workspace 绑定入口，Story／World 改为提供刷新、退出门禁及业务命令回调。
- [ ] 沿用 `WorkspaceColumnSpec`、`WorkspaceFrameSpec` 与 `WorkspaceColumns`，规整公共宿主接入，不重建整套渲染系统；保留 Story 与 World 的局部更新边界。
- [ ] 补充并运行相关定向测试、类型检查、架构／文档及差异检查。
- [ ] 完成 Story、World、两种主题、滚动条、局部更新与退出路径的真实浏览器验证；更新相关公共接入文档，报告已迁移样式、统一命令、保留的旧实现及未覆盖项。

## 当前进展

- 已完成：依据 Stage 02 Prompt 核对公共样式入口、Story／World 的框架绑定点、Workspace Columns 生命周期及直接相关 Task 0383／0384 的重叠范围；Stage 01.1 已在本对话完成并通过定向验证。
- 正在进行：未开始施工，等待本 Task 后续启动及人工验收。
- 下一步：开工时先比对 Task 0383／0384 的验收结果与当前差异，然后从 `story-editor.css` 的公共框架／目录规则和 `surface-styles.ts` 的独立加载路径建立迁移清单。

## 结果与问题

- 验证结果：待施工。
- 发现问题：尚无 Stage 02 实施结果；Task 0383／0384 中公共目录与 Review 相关部分可能与 CSS／宿主整理重叠，需按其验收状态协调。
