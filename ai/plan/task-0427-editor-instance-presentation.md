# Task 07（新建）：公共实例表现合同、标签更新与 SVG 角色约束

状态：待处理

正式 Task：Task 0427；原施工节点：Task 07。
前置：Tasks 0424 and 0422。
后继：Task 0428。
完整原始指令保存在 ai/plan/upper-chat-tasks/07-instance-presentation.md；本 Task 正文保留该指令全文。

## 施工目的

消除 Workbench 对 Story/Entry/World/目录类型及 SVG 的隐式猜测，使实例表现由实际 Instance Provider 提供，公共实例条只承担统一容器、交互和布局。保留已采用的实例条视觉语言，不引入新的 Logo 或图标系统。用户观察到实例小窗显示异常，源码仅确认图标语义与尺寸约束不一致，真实视觉结果需要用户手验。

前置：Task 03 目录实例、Task 06 World 接入。主要源码：workspace/browse-instance-manager.ts 的 BrowseInstancePresentation、editor-workbench.ts 的 createEditorWorkbenchChrome()、editor-workspace.ts 的 renderEditorWorkspaceRegions()、css/editor-workspace.css、css/editor-directory.css、story-editor/workspace-session.ts、runtime-editor/world-browser-provider.ts、world-browser.ts 以及目录 Provider。读取当前 ui-style 中实例条/工具带与图标的 Adopted 规范，不把未实施提议当作事实。

## 1. 盘点表现数据的生产者与实际消费者

追踪每种实例的 seed、prepare、reuse、rename、资源切换、restore、unavailable、close 等更新 presentation 的入口；包括 Story 空实例、Story 文档、Entry、目录管理、World Init/Area/Spot。确认当前是否存在直接写 DOM title、实例标签文字、status 或重复推断 type 的路径。

基线 BrowseInstancePresentation 已有 title、kind?、icon?、status?；createEditorWorkbenchChrome() 却按 providerKey==='world' 和 kind==='entry' 猜类型，未知 kind 会落入 Story；World Work Type 图标来自 editorToolIcon('locate')，Story 文档 SVG 使用 editor-document-icon class。将这一现状作为迁移对象，不重新建立另一份实例表现状态。

## 2. 统一表现合同，不建立大型 registry

沿用并按实际需要扩展 BrowseInstancePresentation。建议：

```ts
interface BrowseInstancePresentation {
  readonly title: string;
  readonly kind?: string; // 如现有空实例需要无 kind，保留明确语义
  readonly typeLabel?: string;
  readonly icon?: string; // 仅限项目已认可的内部实例 SVG；也可复用已有受控 iconKey
  readonly status?: string;
}
```

选择一种既有图标表达，不同时引入 raw SVG、iconKey、新注册器等三套接口。若项目已经有适用图标字典则直接使用；否则 Provider 可调用现有正式实例图标函数。不要让外部资源名称、数据包字段或用户文本拼成未转义 SVG/HTML。标题、类型标签、辅助文案按现有 escapeHtml 合同转义。

由 Provider 在创建和每次有效业务身份变化时生成 presentation。Story/Entry 继承已经定型的文档图标；目录和 World 未经明确裁定的实例图标允许缺省。不要因为未知 kind 或空 title 自动使用 Story Logo、打开图标或定位图标。Work Type 图标、实例图标、Action 图标分别有角色；保留当前已采用的 Work Type 设计，不将其自动搬到实例条。通用 Workbench 不需要导入 Story 文档 icon 或 World work icon 来推断实例表现。若 Work Type 自身仍需来源，保留其独立明确的描述入口。

实例显示资格也应明确：合法已打开实例即使无图标或暂时不可用，仍应在实例条中显示并可关闭。不要依赖 presentation.kind 或 resourceKey 的偶然 truthiness 来隐藏真实实例；若确有非用户可见的过渡空实例，定义其生命周期并最终退出，不能借此生成幽灵标签。空 Workbench 无活动实例时正常显示 Explorer 与空中右栏。

## 3. 收束标签渲染和更新入口

修改 createEditorWorkbenchChrome()，从 Manager snapshot 的每条实例 presentation 直接取得 title/typeLabel/icon/status，从 Manager active ID 派生 selected，不按业务类型写条件树。公共 renderEditorWorkspaceRegions() 负责标签容器、标题、关闭按钮与无障碍文本；保留语义明确的 data-editor-instance 和 stable key。不要给目录、World、不可用实例分别实现特殊标签组件或状态栏。

更新路径使用现有 Manager 更新 API 和 Task 01 的公共区域刷新。实例 title 改变后实际 Instance Strip 更新，与 Content/Inspector 一致。World Spot→Area→Init 保持同 ID；目录移动/改名后按 Task 03 更新资源身份同时更新 title；Story/Entry 草稿重命名和来源恢复后正确更新。非活动实例受合法数据变更影响时可更新标签，但不得激活它或改 Explorer。失败不提交错误 presentation；旧有效标签仍对应旧有效内容。

## 4. 统一 SVG 及实例条几何约束

基线 editor-workspace.css 中实例条 36px，关闭按钮 24px、inset 6px，activate 按钮 gap 6px，既有选中表面与标题省略需保留。editor-directory.css 中 `.editor-document-icon` 为 16px，其他 SVG 未必适用。将统一图标容器置于实例条公共 markup，给容器明确固定尺寸、flex: 0 0 对应尺寸、对齐，并约束其直接 SVG 宽高及合理 display。尺寸优先沿用已采用的实例图标尺寸；若文档没有明确独立值，可用现有 16px 文档图标为本轮保守基准并在实际手验中确认。不要用宽泛 `.editor-workspace svg` 影响 Ribbon/rail/树图标，也不要把树 class 当作实例条尺寸依赖。图标缺省时不渲染无意义空 SVG 或多余占位（如已有明确对齐规范则遵循它）。

检查长标题、极窄可见区域、关闭按钮 overlay、active/inactive/hover/focus 状态、横向溢出、文本 ellipsis 以及 selected tab 与画布连接。保留 36px/24px 既有视觉约定，不通过提高实例条高度掩盖过大 SVG，不为本 Task 重设计标签。必要时将实际尺寸规则补入 Authoring 组件记录，保留原有知识，不摘要全库。

## 5. 验收与检查点

CP1：列出表现生产者/消费者，统一现有 Presentation 合同及 Provider 实际供给，移除业务推断；CP2：公共标签 markup/CSS 与刷新接入；CP3：定向连续行为测试与手验脚本说明。

测试 Story/Entry/目录/World 四种真实实例，类型与标题从 Provider 供给，未定型 icon 不产生 fallback，未知合法类型不被解释成 Story；World 内部资源跳转与目录改名后同 ID、标签实际 DOM 更新；长标题保留关闭按钮结构；关闭/激活事件各执行一次；Story 业务刷新和 Explorer 搜索不会改变其他实例标签；不存在 Provider 侧自制实例条。CSS/DOM 测试验证公共容器与尺寸声明，不能宣称真实浏览器 SVG 视觉已通过。提供实际 DEV Navigation 命令及最小手验场景：混合四类标签、长标题、活动切换、目录保存、World 内部跳转，标记用户待验。
