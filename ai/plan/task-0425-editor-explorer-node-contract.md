# Task 04（新建）：公共 Explorer 节点数据结构与搜索前领域投影

状态：已完成（搜索前节点合同通过；公共搜索/渲染待 0426）

正式 Task：Task 0425；原施工节点：Task 04。
前置：Task 0421。
后继：Task 0426。
完整原始指令保存在 ai/plan/upper-chat-tasks/04-explorer-node-contract.md；本 Task 正文保留该指令全文。

阶段边界：本 Task 的完成条件是领域 Provider 在自由文本匹配前输出节点投影，并由 Story 真实消费者使用。可暂留旧搜索和渲染算法，但它们必须处理新节点输入；此时不得宣称搜索、递归树渲染或通用交互已经公共化。Task 0426 必须实际接管并退出这些旧算法。

完成边界：Task 0425 即使通过节点投影与 Story 消费验收，也只代表搜索前领域数据边界成立。0426 必须让真实 Story 入口消费公共搜索、树遍历/渲染及通用浏览交互，并移除仍由 Story 私有实现承担的等价算法；0428 以生产调用链和代码退出证据复核这一后继闭合，不接受停留在本 Task 的过渡消费者。

## 施工目的

让公共 Explorer 获得完整、可检索、可定位的结构化节点数据，而不是只能操作 Story/World 已经各自生成的 HTML。此 Task 的成果是一个真正处于搜索前的领域适配边界，并有真实 Story 运行消费者；下一 Task 收归公共搜索、渲染和交互。不得仅新增 interface、fixture 或在旧过滤结果外包一层公共对象。

主要源码：src/ui/story-editor/sidebar-tree.ts、pack-source.ts、view.ts、controller.ts、directory-status.ts；src/ui/runtime-editor/world-browser-provider.ts、world-browser.ts；src/ui/workspace/editor-explorer-service.ts、editor-resource-request.ts、editor-directory.ts、editor-workbench.ts。基线 Story sidebar-tree.ts 中 inSearch、visibleStories、visibleEntries、leaf、branch、directoryRows 同时查询、筛选、递归、展开和生成 HTML。World 已有 buildDefaultWorldTree、WorldTreeNode、worldEntityKey、worldTreePlacementIdentity。

## 1. 分解现有数据流，不从 HTML 逆向还原领域数据

逐段核对 Story 当前：来源归一化、草稿与 registry 合并、Init 条件、Story/Entry 模式、目录构建、preferred Entry placement、未归档资源、自动角色目录、手动资料、可显示状态、自由文本 inSearch、reveal 例外、fold/selected、deferred 优化、HTML。区分哪些是在组织领域数据，哪些是在根据查询裁剪节点，哪些是纯表现。

必须在自由文本匹配之前形成领域节点。领域 Provider 可以预处理来源和固有资源权限；对于会影响“无匹配”和显式定位的 Init/模式筛选，保留基础树或可按明确 source 重新取得的全量数据与可见性信息。不能将筛选裁剪后的 child count 当作真实目录为空。禁止公共服务从 HTML、data-* 或 CSS class 推断资源和子节点能力；data-* 仅为渲染后的交互接口。

Story 继续复用 buildStoryDirectory/buildEditorStoryDirectories、目录 ID、层级路径、Entry placement/归属及草稿数据来源。World 继续复用 buildDefaultWorldTree，保留 Init/Area/Spot 和归属缺失节点。领域算法、排序以及 Story 与关联 Entry 的组合顺序不得因通用化被无意改变。

## 2. 建立最小公共节点合同

以下为建议类型，直接复用既有 EditorResourceRef 和身份函数，不强行改名：

```ts
interface EditorExplorerNode {
  readonly placementKey: string;
  readonly resource?: EditorResourceRef;
  readonly sourceKey?: string; // 若资源身份已含来源，这里只作为实际 open 所需提示
  readonly label: string;
  readonly searchableText: readonly string[];
  readonly children: readonly EditorExplorerNode[];
  readonly childState: ExplorerChildState;
  readonly presentation?: ExplorerNodePresentation;
  readonly actions?: readonly ExplorerNodeAction[];
}
type ExplorerChildState =
  | { kind: 'empty' }
  | { kind: 'loaded'; totalCount: number }
  | { kind: 'deferred'; expectedCount?: number };
```

`parentPlacementKey` 可由树结构派生；只有存在真实调用需求时才在节点中保存，避免父键与实际嵌套矛盾。`sourceKey` 需要与既有 EditorResourceOpenRequest 一致：对 runtime 等空字符串语义明确归一化，保证打开、查找与复用识别同一来源。目录资源若已由 Task 03 迁入，管理动作使用明确目录 ref；如尚未迁入，只允许现有管理动作单向适配，不假造普通 Story 文档资源。没有可打开资源的结构性分组节点仍是合法节点。

`presentation` 应为小型、语义明确的内容（辅助标签、tooltip、已定型图标、异常、草稿/默认标记等），不传一整段业务 HTML 让 Provider 自行画完整树行。`actions` 描述领域操作的实际 id、label、权限/disabledReason 和必要目标数据；行为由 Provider 委托执行，不把业务写入逻辑塞进公共树递归。可复用现有 mini-action 与资源请求属性生成器，不建设新的通用命令总线。

`searchableText` 至少涵盖当前可检索名称和 ID；不要把任意领域对象 JSON 化搜索。Story 的目录名称、资源 ID、现有别名和 Entry 关联规则按实际语义保留，World 名称/ID 同样通过字段提供。文本归一化和匹配由下一 Task 的公共搜索负责；本 Task 不为 World 提前复制 inSearch。

## 3. 明确身份、选择和状态模型

- Resource identity 用于 open/reuse/locate，可能在多个 Placement 出现。
- Placement identity 用于展开、选中、路径查找和滚动定位，必须在实际树作用域唯一；包含必要来源/Init/逻辑路径，复用现有编码，避免显示名或当前过滤位置作为 key。
- Instance local selection 属于中右栏业务状态，不写回树选择。
- Active resource marker 是派生信息，只允许表示某资源已打开/当前活动；它与用户选中的具体 Placement 是不同状态。

检查 Story 对同一 Entry 的多个 Init 放置、草稿与运行资源相同显示 ID、多个来源下同名节点。构造小型真实 fixture，验证资源与 Placement 的对应关系。禁止为了共享 Tree 而以资源 ID 合并不同位置。源/树切换时，旧 placement 若不存在，应由公共状态/定位策略明确处理；不随机选第一个同名节点。

## 4. 子节点能力与数据生成状态

真实 empty 指已知没有实际子节点。loaded 的 totalCount 表达领域节点的真实子项（包括暂不显示的节点）；children 可保留完整结构，或有明确的可见性投影。筛选结果的 visibleCount 由下一阶段公共搜索派生，不反写 childState。deferred 仅用于数据确实尚未产生/加载的能力，不为当前 Story 自动角色目录的延迟 DOM 生成虚构异步 loader。

当前 Story 在 @characters 折叠时会省略一部分已存在的空角色目录 DOM；它们仍是数据节点。将此优化标记为渲染策略，不能把父级变成 empty。保留真正空角色目录的管理动作、状态和层级结构。若全量投影节点量较大，先测真实树构建开销，保持已有延迟 DOM 优化，不把所有节点挂载到页面；不建立无界缓存。

## 5. 实际 Story 消费路径

修改 sidebar-tree.ts，使领域构建函数输出节点投影。保留原 public renderSidebarTree() 作为过渡入口，但它必须实际消费这些节点，而不是继续从原始领域数据另建一棵树。允许本 Task 暂时保留原文本搜索/渲染算法，改为针对节点输入执行；不要求提前完成 Task 05。记录每个暂留算法及其退出点。必要时把原叶/分支 HTML 生成拆成短期节点消费者；禁止并行维护两份独立树。

World 只验证适配可行性及身份/节点投影测试，可到 Task 06 再切实际渲染入口；不能为此 Task 的验收要求 World 已完整接入。公共节点合同必须有真实 Story 消费者和 World 数据模型可接入的证明，而非面向未知编辑器的巨大接口。

## 验收和检查点

CP1：原始数据流和责任清单、公共节点类型及身份规则；CP2：Story 领域构建输出节点，真实 sidebar 消费；CP3：节点数据与原有可见行为的定向测试。

至少验证：无查询时 Story/Entry、自动目录、手动路径、未归档与根目录顺序/内容保持；同一 Entry 多 placement 仍存在；不同来源身份不碰撞；空目录与被领域条件过滤的目录可区分；折叠延迟 DOM 不丢失完整数据；目录 manage 动作仍带真实目标；查询和 reveal 旧行为在此过渡节点不回归。核对 World fixture 的 Init/Area/Spot/孤立节点可表达，不提前声称统一搜索完成。记录仍存在的旧搜索与渲染实现供 Task 05 删除。

## 实际施工检查点

- CP1：新增 `src/ui/workspace/editor-explorer-nodes.ts` 的最小共享节点、子节点状态、语义表现及 Provider action 合同。Resource identity 和 placement identity 分开；数据属性只通过后续 DOM 适配输出。
- CP2：`buildStoryExplorerNodes()` 在 Story 自由文本匹配前完成来源投影、完整 Init/目录层级、Story/Entry placement、resource key、可检索文本与真实 `childState`；`renderSidebarTree()` 现在实际消费该节点树，领域补充数据通过 placement key side map 查询，不另从 Registry 重建第二棵 HTML 树。Story 既有模式/查询/Reveal 语义与 Story-Entry 排序沿节点消费逻辑保留。
- 身份和节点状态：同一 Entry 的两个 Init placement 共享 resourceKey、拥有不同 placementKey；空手动目录是 `empty`，完整 @characters 子节点计数保留，即使渲染层折叠时省略空叶 DOM。目录管理通过节点 action 的 typed resource/source 委托，不把 Story 写入逻辑放进通用节点合同。
- World 可接入证据：`worldExplorerNodes()` 复用 `buildDefaultWorldTree()` 的 Init/Area/Spot 和 `worldTreePlacementIdentity`，为孤立资源保留“归属缺失”结构组；本 Task 不改 World 的实际渲染路径，后续仍由 Task 0422 接入公共消费。
- 过渡实现清单：Story 的 `storyVisible` / `entryVisible` / `textMatches`、`directoryRows` 递归、折叠与 SVG/HTML 生成仍由 `renderSidebarTree()` 承担，但它们消费 `EditorExplorerNode`；Task 0426 必须实际迁移搜索、树遍历/渲染和通用交互并退出这些私有算法。此 Task 不是 Explorer 公共搜索或渲染完成。
- 验收：`npm test -- tests/ui/story/story-editor-pack-source.test.ts tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`，2 suites / 27 tests 通过；涵盖实际 Story 消费场景、两个 Init 的重复 Entry placement、资源与位置身份、空/非空节点能力及 World 投影。一次基础运行数据的完整 Story projection 为 178 nodes，节点构建约 2.5 ms（Happy DOM 测试环境；仅作量级核对，不代表浏览器 DOM 时间）；未添加缓存，延迟 DOM 策略继续由现有渲染器执行。`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（144 Markdown / 0 errors）及 `git diff --check` 均通过。
- 浏览器：遵从用户授权跳过；视觉/交互留给用户手验。无提交或推送。
- 下一步：Task 0426 必须让 Story 真实运行路径采用公共搜索、树遍历/渲染与浏览交互，删除本 Task 列明的过渡私有算法；Task 0428 检查实际消费者和删除证据。
