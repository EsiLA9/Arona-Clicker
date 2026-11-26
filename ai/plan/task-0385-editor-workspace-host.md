# Task：Stage 02：Editor Workspace 公共表现、栏位宿主与框架交互规整

状态：待验收

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
- 核对结果：Task 0384 仍为待验收，现有目录 DOM／定位能力已复用，本 Task 只迁移共享表现；Task 0383 仍等待用户浏览器验收，本 Task 只迁移共享 Review 基础样式，不替前序 Task 更新验收状态。

### 本轮施工约束

- 公共绑定使用一个薄的组装入口，业务只传刷新、退出门禁和业务命令委托；不要求业务分别安排 Layout、Ribbon、Resize、Chrome helper 的绑定顺序，也不新增大型 Host Controller。
- 统一 Workspace 栏位身份、公共外壳与生命周期，不强制统一栏位内部更新算法。保留 Story `patchEditorDOM()`、输入／焦点／弹窗锚点／试播更新，以及 World 的摘要局部刷新。
- 已确认共享的目录树／行 CSS 使用稳定公共选择器，不继续给 Story 专有类追加共享规则；仅调整本阶段涉及且确认共享的组件，保留 Story 专属注记及其他业务表现类，不做全仓 class 改名。
- Stage 01.1 的压缩拖动、迁移失败保护及临时试播布局只做回归核验，不重复施工。

## 工作项

- [x] 核对 Task 0383／0384 的实现与验收边界，形成不重复施工的公共职责清单。
- [x] 核对 Story／World surface CSS 加载顺序，迁移公共框架、目录和 Review 规则，保留 Story 业务样式并清理重复选择器。
- [x] 将布局视图、模式、Ribbon、分隔线命令收口到现有 Editor Workspace 绑定入口，Story／World 改为提供刷新、退出门禁及业务命令回调。
- [x] 沿用 `WorkspaceColumnSpec`、`WorkspaceFrameSpec` 与 `WorkspaceColumns`，规整公共宿主接入，不重建整套渲染系统；保留 Story 与 World 的局部更新边界。
- [x] 补充并运行相关定向测试、类型检查、架构／文档及差异检查。
- [ ] 补完余下真实浏览器验收：Story 正文输入与 Entry 属性编辑、Story 与 World 分别检查两种主题、目录悬浮滚动条、目录管理和试播。公共 CSS 隔离、World 实体局部更新、布局切换、退出／重新进入已在本 Task 记录的独立浏览器会话中验证。

## 当前进展

- 已完成：核对 Task 0383／0384 的当前实现和范围，复用其目录渲染、Review 与定位能力；未重复实现目录或 Review 服务。Stage 01.1 只做压缩拖动、持久化迁移失败保护和试播布局的回归检查。
- 已完成：迁移公共 Workspace Shell 规则至 `editor-workspace.css`；迁移目录树、行、Chevron、层级线和悬浮滚动条规则至 `editor-directory.css`；迁移 Review 字段基础样式至 `editor-shared.css`。Story 的正文、节点、Entry、试播和属性编辑规则留在 `story-editor.css`。公共目录选择器统一使用 `.editor-directory-*`。
- 已完成：Story／Runtime 共用的 `condition-reference-picker` 改用 `.editor-list-item`、`.editor-empty`、`.editor-actions`；其公共基础规则不再依赖 Story 命名。剩余 Story 行、空态和操作基础规则移回 Story stylesheet。
- 已完成：World 顶栏以 `world-editor` surface 加载公共工作区和目录 CSS；Story surface 先加载公共规则再加载 Story 专有 CSS。World 独立启动的实际 CSSOM 包含 `game.css`、`editor-workspace.css`、`editor-directory.css`，无 `.story-editor-node` 规则。
- 已完成：新增 `bindEditorWorkspace()` 作为公共框架绑定入口，内部装配布局选择、Classic／Advanced、Ribbon、splitter 和退出命令；`setEditorWorkspaceView()` 供业务执行显式布局命令。Story／World 只传边缘能力、局部刷新、滚动恢复和退出回调。
- 已完成：Story 继续使用 `patchEditorDOM()` 与现有 `WorkspaceColumns` keyed 生命周期；World 保留摘要局部更新。视图切换前后 Story 保存并恢复当前实例滚动位置，覆盖了回归测试发现的右栏恢复问题。
- 已完成：更新 `docs/docs-830/04-presentation/workspace-columns-and-layout.md`，记录公共绑定、surface 样式所有权与差异化更新边界。
- 正在进行：等待人工浏览器验收；Stage 03–07 不在本 Task 范围内。

## 结果与问题

- 验证：`npx tsc --noEmit` 通过；相关 UI 回归测试 4 个文件、88 项通过；`npm run check:architecture` 通过；`npm run check:docs` 扫描 105 份 Markdown、0 错误；`git diff --check` 通过。
- 浏览器：在独立 Vite 实例（5174）分别验证 World 首次进入只载入公共 CSS、Story 进入后再载入 Story CSS；验证 Story Advanced 下切换至 World 保持三栏／高级状态、World Classic／Advanced、三栏／双栏／专注、显式显示目录、阿比多斯黄沙主题、实体变更后目录状态保持，以及退出并重新进入。
- 浏览器限制：原 5173 dev server 的转换后顶栏模块仍返回旧的 `world-editor`→`story` 映射；当前源码及 5174 独立服务器均为 `world-editor`→公共加载器。手工验收前需刷新或重启原 5173 dev server，避免验收到旧模块。
- 未覆盖：Story 正文输入与 Entry 属性编辑未在临时空白 origin 中写入真实内容；相关 Story patch 和栏位稳定性由现有定向回归测试验证，用户人工验收可继续检查内容编辑细节。
- 保留范围：没有合并 Story／World 实例集合、拆分 Controller、大规模迁移 CSS、统一全部 Explorer 浏览状态；这些仍属于后续 Stage 03–07。
