# Task 05（新建）：从 Story 提取公共搜索、树投影、递归渲染与交互

状态：已完成（定向验证通过；浏览器留用户手验）

正式 Task：Task 0426；原施工节点：Task 05。
前置：Task 0425。
后继：Task 0422。
完整原始指令保存在 ai/plan/upper-chat-tasks/05-story-explorer-migration.md；本 Task 正文保留该指令全文。

## 施工目的

让 Task 04 的节点结构成为公共 Explorer 的实际执行输入。Story 率先接入并退出旧的完整搜索/树渲染过程。本 Task 完成后，World 接入不需要自己实现搜索匹配、祖先保留、树行 HTML、展开选择与滚动逻辑。

主要源码：workspace/editor-explorer-service.ts、editor-directory.ts、editor-directory-scroll.ts、css/editor-directory.css；story-editor/sidebar-tree.ts、view.ts、controller.ts 以及 Task 04 新增节点投影。遵守现有 Authoring 视觉语言，沿用 28px 树行、层级引导、已有 Hover、选中、滚动样式；本轮不主动重设计。

## 1. 明确公共管线的输入与输出

复用 EditorExplorerService 为公共通用状态 owner，允许其直接协作模块承担纯树投影与渲染函数。不新增第二 ExplorerService 或第二 query store。建议按以下数据流：

```ts
// 示意：可组合成现有函数，不要求同名 API 或多个新 Class
projectExplorerTree({ roots, domainVisibility, query, reveal, expansion, selectedPlacementKey })
  -> { roots: projectedNodes, matchCount, resolvedReveal, emptyReason }
renderExplorerTree(ctx, projectedNodes, presentationContext)
  -> HTML / existing keyed update inputs
```

roots 是 Task 04 在自由文本搜索前生成的节点；domainVisibility 由 Provider 解释资料包、Init、Story/Entry 模式等限制。公共投影只读，不因渲染更新基础展开、来源或真实选择。输出包含可见子节点、实际子项能力、匹配/祖先状态、有效展开和可见性原因；这些是派生结果，不保存成新的可写镜像。领域特殊排序/组合顺序保持不变。

## 2. 迁移自由文本搜索与祖先保留

从 sidebar-tree.ts 的 inSearch、visibleStories、visibleEntries、branch 中分离 query.trim().toLocaleLowerCase()、字段匹配和搜索期间的祖先路径保留。保留 Story 现有匹配粒度（名称/ID，目录本身可匹配，Entry 与关联 Story 的实际组织约束）；对于目录名称匹配后是否展示其全部子项，先检查旧行为并将实际策略写入清晰的公共搜索策略，不能无意改变结果。World 后续可采用同一默认策略，只有领域真实差异才由少量策略参数表达。

使用统一的递归/遍历：先判断领域可见性与节点自身匹配，再从子节点匹配结果保留必要祖先；显式 reveal 是独立的临时通道，可保留其目标与路径，不把所有无关节点放进结果。根无结果时显示统一无匹配状态（可由 Provider 提供文案，不复制框架）。区分全树空、领域筛选无结果、文本搜索无结果及来源不可用。

不要在 Provider 中先执行自由文本匹配再传给公共搜索。若 Story 的关联 Entry/Story 有专属语义，用明确可检索字段、关联分组或小型领域可见性策略表达；不允许提供整套自定义 searchTree/recursiveRenderer 逃避公共实现。公共算法不导入 StoryDraft、WorldCatalog、StoryDirectoryDef 等领域类型。

## 3. 迁移展开策略、选择和显露

沿用 EditorExplorerService 的 queries、expanded/searchExpanded、expandedOverrides/searchExpandedOverrides、selectedPlacementKey、reveal、focusRequest、scrollTopByHost。核对当前实际字段含义，不增加镜像状态。普通展开状态与搜索期间覆盖分开：无查询采用基础默认与用户覆盖；有查询时匹配祖先临时展开，用户仍可折叠搜索结果，清除查询恢复基础状态。不同 query channel 的既有恢复语义保留；明确 query 改变时清理哪些临时展开，不清空普通折叠。

公共投影接收默认展开提示，Provider 不在自身递归中计算完整 effective open。显式 reveal 必须保留基础 query/filter/source；按 Task 01 已裁定策略进入暂时显露。跨来源时若需要重新解析树，应以临时来源取得数据而不改基础用户选择，提供可辨识状态；用户改查询/源或清除定位时解除临时显露。定位失败不改基础状态，不猜测同名资源。资源存在多个 Placement 时优先明确请求的 placement，然后采用已裁定的领域消歧策略。

普通实例激活不创建 reveal、不清空 selectedPlacementKey、不触发 focus。可派生 active marker，不能假装用户选择了某一 placement。来自目录的 open 请求通过既有 EditorResourceOpenRequest 传实际 resource/placement/source；公共事件只调用一次，不以中栏是否 Story 决定行为。

## 4. 公共搜索工具与递归渲染

在现有 editor-directory.ts 或相邻协作模块提取公共搜索控件入口。复用现有 Story 输入、样式、data-editor-explorer-query、现有查询 channel 与输入回调，不另造第二组件体系。Provider 可提供 source/Init/mode 等专属工具作为插槽/描述；共享搜索控件、清除、结果状态、滚动宿主应使用同一真实入口。

迁移 leaf/branch 中可公共化的树行结构、递归列表、展开按键、层级布局、选中/活动标记、辅助信息、管理动作。保留 renderEditorDirectoryRow/List/Toggle、scroll 等既有成熟原语，扩展而非重写。节点可以同时拥有资源打开与展开动作（World Init/Area）；两者有各自明确目标。纯目录结构节点允许管理或打开目录实例，不能把所有行默认解释为 Story 文档。Provider 只传描述/操作，不返回完整树行 HTML、嵌套树或独立搜索框。

真正 empty 的目录不生成 data-editor-expand 按钮或禁用 Chevron；用同宽非交互占位维持层级，可显示简短“空目录/暂无内容”，保留 gear/管理入口。筛选后无可见子项提示“无匹配项”或适用语义，不将原始目录标为 empty；默认不显示无效展开。真实 deferred 数据若存在合法加载能力才显示可操作 Chevron/加载状态。现有 @characters 的延迟 DOM 优化只在折叠时不生成部分 DOM，不改变节点数据；展开时按公共渲染策略补齐，不能误判父目录为空。注意 World 叶节点仍可打开资源。

## 5. 接入实际挂载与局部更新

由 Task 01 的公共 Host/Explorer bindColumn 路径挂载同一控件与树。复用 EditorExplorerService.bindColumn 的 input/scroll/expand/selection 生命周期，将公共 query 输入转换为公共投影刷新请求。Provider 专属 source/filter 操作仍只更新 Explorer 数据。对搜索、展开等局部更新使用现有 keyed patch 或最小区域更新，保留搜索 input identity、caret、scroll host、监听和不受影响中右栏。避免每次按键整页重建；不要创建第二渲染 scheduler。

审查当前 Story bindExplorerColumn 的 onQuery、expansionLayer、onExpand、deferred 等实际消费者，迁出通用算法。保留必要领域委托，删除在完整 Story bind() 中重复的目录输入/展开/选择行为。验证事件不被 stopImmediatePropagation 意外吞掉合法 resource-open 或专属动作；每个动作只执行一次。切换到 World 活动或空 Workbench 时，Story Explorer 搜索/来源/管理仍走同一入口。

## 6. 旧实现退出

sidebar-tree.ts 可保留领域树构造、资源描述、筛选与必要单向 renderSidebarTree 包装；不再持有自由文本 inSearch、完整通用 branch/leaf HTML 递归、独立 effective expansion 或公共搜索输入构造。检查所有旧调用方，删除迁移后未使用的变量、函数、data 属性与 CSS；仍有真实领域消费者的兼容属性说明原因，不以保留兼容为由维护两套树。Task 06 使用本 Task 的公共 API，而不是复制 Story 包装函数。

## 验收和检查点

CP1：公共投影纯函数/状态服务接入，Story 实际使用搜索前节点。CP2：公共搜索栏和树渲染接入，旧递归与输入路径退出。CP3：连续操作验证与空节点回归。

测试实际 Story DOM：名称/ID 搜索、目录匹配及祖先、无结果、清除恢复普通展开、搜索折叠覆盖、跨来源临时定位、同一 Entry 多 placement、自动角色空目录与父目录延迟生成、管理动作、来源/Init 模式变更、输入焦点/scroll host 保持、Story/World/空活动状态下同一 Explorer 功能。至少一个通过真实输入事件触发公共搜索并验证实际渲染结果的用例，不仅测试纯函数。记录真实视觉与几何仍待用户手验。完成后进入 0422，不提前建设 World 另一套实现。

## 实际施工检查点

- CP1：Story 继续由 `buildStoryExplorerNodes()` 在文本搜索前产生节点；`projectEditorExplorerTree()` 统一执行名称/ID 匹配、领域可见性、祖先保留、reveal 通道、选择/活动标记与有效展开状态。公共投影不写回 Explorer 状态。目录名命中只保留该目录及其匹配后代，不自动显示无关子项；目录无匹配子项时显示“无匹配项”。显式 reveal 可暂时越过 query/Init/模式筛选，仍只显示目标与必要祖先。
- CP2：`renderEditorExplorerSearch()` 复用公共 query channel；Story 的目录与发出方搜索均由 `EditorExplorerService.bindColumn()` 接收真实 input 事件并请求局部 Sidebar patch。保留 source/Init/mode 等 Story 筛选为 Provider 语义。树行、递归列表、资源属性、展开/选择、active marker、空结果及 empty/deferred DOM 策略由 `renderEditorExplorerTree()` 输出；Story 原自由文本匹配、私有递归 HTML 和展开层选择分支退出。管理动作通过通用节点 action 描述携带真实目录资源和业务属性。
- 交互边界：Story Controller 不再处理 Explorer 行上的 Story/Entry 私有资源点击；公共 Workbench 资源请求是唯一打开入口。普通实例切换不创建 reveal、不清空 placement selection、不触发搜索焦点；显式定位保留基础 query/filter/source 并临时显示路径。公共 active resource marker 随 Manager 活动资源变化刷新；普通布局/窗口渲染不重复重建 Explorer DOM。Story/Entry 关联排序在“全部”模式下仍按 Story 分组，在 Entry-only 模式下保持旧的 Entry 顺序。
- empty/deferred：空目录不生成展开按钮，仍保留管理入口；搜索过滤导致目录暂时无可见子项时不把其 `childState` 改成 empty，并显示无匹配提示。`@characters` 折叠时仍省略已存在的空叶 DOM；展开点击由公共服务更新 search/base expansion，再通过 Story 的轻量回调补齐 DOM。
- 验收：`npm test -- tests/ui/story/story-editor-workspace.test.ts tests/ui/workspace/editor-explorer-service.test.ts tests/ui/story/story-editor-pack-source.test.ts tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`，4 suites / 86 tests 通过。覆盖 Story 实际输入事件、搜索期间 caret/input identity、祖先保留、搜索折叠与清除恢复、reveal 穿过过滤、空目录管理和角色目录 deferred DOM、资源点击只触发一次、Story/World Explorer 状态独立及跨 Provider 实例操作。`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（144 Markdown / 0 errors）与 `git diff --check` 通过。
- 浏览器：遵从用户授权跳过直接核验，视觉与真实鼠标操作留给用户手验。无提交或推送。
- 下一步：Task 0422 将 World 的真实 Explorer 消费路径接入本 Task 的公共节点投影、搜索、递归渲染和交互入口；不得复制 Story 包装或搜索状态。
