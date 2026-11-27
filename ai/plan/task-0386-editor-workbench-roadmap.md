# Task：Editor Workbench Roadmap 与长期设计合同

状态：进行中

## 目标与验收

- 目标：作为 Stage 02–07 的唯一长期架构合同和执行索引，保存已裁定的状态所有权、跨阶段行为不变量、迁移边界、通过条件及每个可执行 Task 的入口。
- 完成条件：Stage 02 前置核对至 Stage 07 收敛都能从本页和其链接 Task 恢复；后续 Task 可以调整实现接口，但不得以调查不足、渐进迁移或文件拆分为由改变下列产品行为或长期所有权。
- 边界：本页是路线、所有权合同和执行索引，不代替各 CP Task 的当前源码复核、代码变更和验证；连续施工已经授权。每个节点按显式序列执行，Stage 末尾集中验证。

## 长期设计合同

### 唯一所有者与不变量

| 能力 | 最终唯一权威 | 允许由业务提供 | 不允许形成 |
| --- | --- | --- | --- |
| 布局偏好 | `EditorLayoutService`：mode/view、左右栏期望宽度、Ribbon 偏好、Classic/Advanced 偏好；基础偏好统一持久化 | 可用栏位及临时场景所需能力 | Story、World、实例各自持有或互相同步布局偏好 |
| Workspace 外壳 | 公共 Workbench／Workspace Host，沿用 `WorkspaceFrame` 与 `WorkspaceColumns` 的稳定栏位身份和释放生命周期 | 栏位内容、业务刷新回调、离开门禁与业务命令 | Story/World 分别安排公共 Layout、Ribbon、Resize、Chrome 装配；平行 Column Manager 或全局重绘调度器 |
| Browse Instance 生命周期 | 公共 `Browse Instance Manager`：稳定 ID、实例集合顺序、`activeBrowseInstanceId`、生命周期、创建/复制/关闭/复用和后继选择 | Provider 的资源身份、业务初态、捕获/恢复、门禁、有效性、标题/图标/状态及策略 | 两套可写的 instances/active/nextId；公共服务硬编码 StoryDraft 或 World Entity |
| Workbench 工作维度 | Workbench 只持有 `activeExplorerType`；活动实例 ID 只由 Manager 持有。Workbench 经 Manager 读取并协调活动实例，不存副本 | Provider 选择、资源投影和命令 | 左栏 Work Type 作为编辑器路由；Workbench 镜像/同步 `activeBrowseInstanceId`；激活实例自动切 Explorer；切 Explorer 触发业务保存门禁或替换中右栏 |
| Explorer 通用交互 | 公共 Explorer 服务：查询、普通展开、节点选择、滚动、聚焦、临时 reveal、显露祖先及生命周期 | Provider 的树投影、筛选语义、资源身份、放置身份、多放置消歧、资源打开与业务操作 | 两套完整浏览 Controller、公共状态与业务状态双向同步、把 Story 草稿/来源语义塞进公共服务 |
| 栏位 DOM 生命周期 | `WorkspaceColumns` 的 keyed identity、挂载、更新和释放 | Story 精细正文 patch；World 摘要局部刷新 | 为表面统一而全量重建，或以业务更新取代栏位身份管理 |

### 跨阶段必须保持的行为

1. **布局与内容独立**：Story、Entry、World 资源或实例切换均继承同一基础布局；窗口压缩和临时布局不得覆盖期望宽度或持久偏好。业务临时场景优先于开发测试覆盖。显式布局命令才提交基础偏好。
2. **实例切换原子性**：Manager 和导航协调器从第一版接口起就提供可失败的准备/提交边界，不先建立失败必然破坏状态的接口。先确认目标身份与可用性，再跑当前业务离开门禁、捕获当前状态、准备/恢复目标，成功后才提交活动身份与标签/内容。失败后原业务内容、草稿引用、路由、临时布局和宿主仍可操作；不得留下活动 ID、空标签、半初始化路由或覆盖残留，不重复保存或清空既有草稿。已经合法完成的持久化保存不承诺回滚。
3. **业务恢复归 Provider**：Story/Entry 保持资源来源、包、草稿、历史、节点/插入锚点、Inspector/页签、滚动及业务错误的既有恢复语义。复制时浏览历史、滚动、选择等可变状态独立；草稿是否共享遵守现有业务规则，禁止简单深拷贝制造第二份失控草稿。
4. **World 复用而非旁路**：World Provider 默认对 Init/Area/Spot 使用公共 Manager 的单实例复用策略，切换实体是同一浏览实例内的业务目标改变；只读浏览不引入虚假草稿/保存门禁，不要求复制能力。关闭 World 实例和关闭 Story 实例使用同一实例关闭语义。
5. **空 Workbench 与显式退出**：关闭非末实例不退出编辑器；末实例关闭优先留下可通过 Explorer 继续打开资源的空 Workbench。真实退出是独立命令，统一执行需要的业务门禁，再恢复唯一外部返回位置和主题会话；失败不销毁 Workbench。
6. **Explorer 与活动实例独立**：切换 Explorer 只更新左栏及其查询/筛选工具；活动实例决定中栏、右栏、实例条和业务 Ribbon。普通切换不自动改变另一个维度。只有“定位当前资源/显示目录”等明确命令可切换 Explorer 并显露路径。
7. **命令按对象归属**：Workbench 级为布局、主题、退出和公共实例操作；Explorer 级为搜索、筛选、目录管理和资源入口；Active Instance 级为保存、试播、检查、应用和当前资源操作；Selection 级为节点/字段增删改。命令可同处 Ribbon，但目标不得由左栏 Work Type 推断。
8. **树节点与资源身份分离**：资源身份用于打开/复用；Tree Placement Identity 用于某资源在某个父路径中的展开、选中、搜索和定位。Entry 等多放置资源不能仅用资源 ID 作为节点 key，定位必须遵循当前路径、Provider 优先级或显式指定，不可任取同名项。
9. **搜索和显露可恢复**：搜索临时投影不得覆盖用户普通折叠状态；清空搜索恢复原结构。显式定位可临时解除阻碍目标的查询/筛选、展开祖先、滚动、选中/聚焦；不能永久清空查询或全部筛选。定位失败明确反馈，不选择相似项。
10. **渐进迁移必须收尾**：每阶段允许短期兼容桥，但 Stage 07 必须移除旧状态写入口、重复 ID 分配、整套旧 Controller、重复刷新或树交互生命周期及公共 CSS 的业务别名。仍有消费者的兼容入口需明确保留原因；不得把双权威同步作为最终状态。

## 阶段职责、边界与通过条件

| 阶段 | 独立职责及迁移边界 | 通过条件 |
| --- | --- | --- |
| 02 前置核对 | 核实 Stage 01/01.1/02 当前源码、surface CSS 装载、`WorkspaceColumns` 及 5173/当前 dev server；只修复直接阻塞后续的缺陷，未阻塞的手验留记录 | 布局仍唯一；公共绑定和样式确实被 Story/World 使用；稳定栏位机制有效；Stage01.1 回归通过；遗留浏览器检查有明确负责人阶段 |
| 02.5 导航 | DEV-only URL 与脚本入口共用正式业务语义；不造 Router/RPC；提供实际 current/readiness；失败恢复；可选 Mode/View 覆盖只有无需并行布局架构即可接入时才启用 | 导航等资源、样式和宿主可操作后才成功；无效/门禁/准备失败保留旧会话；重定向保留查询；生产无 API；不改存档/草稿或基础布局偏好 |
| 03 Story/Entry Manager | 抽公共生命周期，Story 是首个 Provider；保留独立 Story/World 路由和业务恢复；World 暂不接入 | Story/Entry 多实例打开、复用、显式复制、激活、关闭均通过 Manager；保存门禁与恢复失败原子；Story 不再有第二套通用集合/ID/活动写入口 |
| 04 World Provider | World 单实例复用策略接入同一 Manager；保留只读实体浏览和当前 World tree 行为；可暂保两路由及不同标签投影 | Story/World ID 与集合统一且不冲突；切换路由不丢实例；World 实体打开复用正确；关闭实例不等同退出；Manager 无领域硬编码 |
| 05 Workbench | 统一会话/外部返回/主题/Manager/Explorer 选择；Work Type 与实例双维度；统一命令作用域、混合实例、空 Workbench、临时场景和稳定栏位 | 左栏与活动实例独立；Story/Entry/World 同集合；命令目标正确；显式定位才切 Explorer；空工作区可继续开资源；退出仍过门禁并返回 |
| 06 Explorer | Provider 提供树/领域语义；公共状态机接管通用搜索、展开、选择、滚动、定位、显露、聚焦和生命周期；分业务逐步迁移并删除旧 Controller | Story/World 状态独立可恢复；资源身份/树放置身份正确；多放置定位正确；搜索/显露恢复用户状态；不改活动实例；左栏更新不重建中右栏；不存在两套完整通用 Controller |
| 07 收敛 | 所有权审计、删除过渡路径、真实 Provider/Workbench 接入文档、视觉模式增量维护、集中集成验证和最终交付 | 单一权威无旧写入口；新 Provider 文档能指向真实入口并走通示例；Stage02未验浏览器项目有结论；报告包含变更、验证、遗留和退出路径 |

### 前序 Task 的职责边界与集中验收

- Task 0389 的导航协调器与 Task 0393 的 Manager 核心从接口起就必须保证失败可表达且不会先破坏权威状态；Task 0391、0394 分别把真实业务失败路径接入并完成回归。失败后的恢复范围包含业务内容、草稿引用、route、临时布局及宿主；已经由正式门禁成功完成的持久化写入不回滚。
- 0393 只建立公共 Manager 基础。0394 接入 Story 激活/恢复时，必须同时让现有 Story 实例记录、顺序和活动项由 Manager 唯一持有，因为 activeBrowseInstanceId 必须指向 Manager 集合；Story Workspace 只保留只读单向投影。必要的旧调用入口可以单向委托 Manager，但不保留第二数组/active 指针。0395 收敛创建/复用/复制/关闭业务策略，0396 删除 Story 私有通用生命周期投影和残余权威。未迁移职责暂由原业务策略持有，已迁移状态只允许一个写入者；0394–0396 连续完成后集中验收 Stage03，不要求各 CP 之间人工停验。
- 0397 只提取 World Provider 业务状态，0398 落实并验证 Manager 可表达的单实例复用策略，0399 才接入运行路径并退出 World 私有生命周期。不能在 0397/0398 提前重写 World route 或实例关闭行为。
- 0401 建立 Workbench session 并容许 Manager 集合为空；空白栏位、可继续打开资源及退出界面由 0405 实际落地。0402 只建 Explorer/活动实例基础独立和栏位/Ribbon 隔离，0403 接入混合实例，0404 才完成四类命令作用域，0405 负责复杂临时场景和交互连续性。
- 0390 负责 parser、重定向和参数边界；现有业务 `viewOverride` 不能跨 Story/World 提供统一开发 Mode/View 投影，若扩展需要布局架构修改则本轮明确拒绝/延期，不阻塞导航。Story/World 真实导航、成功时机、失败恢复和开发 API 浏览器验收集中到 0391，避免重复跑相同路径。
- Stage 集中验收由 0406（Stage05）、0412（Stage06迁移收口）、0417（Stage07最终集成）承担。前序 Task 只验证自身已迁移职责，不得要求后续职责提前存在。
- Stage02未完成浏览器项分配如下：Story输入/光标、Entry属性、目录管理/试播恢复核对由0405/0406相关更新覆盖；Story/World公共布局、Ribbon和主题入口由0406按受影响范围核对；树行/滚动条样式与真实滚动由0411/0412核对；仍未被后续改动覆盖的项目在0417集中结案。0388只分流并核实直接阻塞，不要求重跑整套手验。

### 已归档 Task 结果的恢复入口

阶段 Task 归档后仍在本表补一行实际结论和关键证据路径；本表保留简短摘要，原 Task 正文可按 `ai/archive/history.zip` 路径读取。

| Task | 交付摘要 | 证据 |
| --- | --- | --- |
| 0388 | Stage02 前置核对通过：公共布局唯一；Story/World 公共样式与绑定接入；WorkspaceColumns 稳定；5173 返回工作树模块；定向 88 项通过。未改产品源码。 | `ai/plan/task-0388-editor-workbench-stage-02-preflight.md`（`history.zip` 原路径）；`.test-artifacts/latest.log` |
| 0387 | Stage 02.5-A 调查完成：启动数据装载、首帧/Controller 可用、surface 样式 promise、Story/World 正式导航及保存门禁/同步 render 成功信号已定位。未改产品源码；真实浏览器验证集中到 0391。 | `ai/plan/task-0387-editor-workbench-dev-navigation.md`（`history.zip` 原路径）；`src/ui/main.ts`、`controller.ts`、`surface-styles.ts` |
| 0389 | Stage02.5-B完成：DEV-only coordinator/API在mount后注册；current读真实route、resource及有效shell布局；样式/目标预检、busy拒绝、Story/World正式委托已接入；7项定向测试和typecheck通过。未做浏览器验收。 | `ai/plan/task-0389-editor-workbench-dev-navigation-coordinator.md`（`history.zip`原路径）；`.test-artifacts/latest.log` |
| 0390 | Stage02.5-C完成：`/game` query保留；DEV URL解析调用0389协调器；重复/不完整及Mode/View参数明确失败。导航定向测试9项、typecheck和5173 redirect header通过。未做浏览器导航验收；Mode/View覆盖延期。 | `ai/plan/task-0390-editor-workbench-dev-url-layout.md`（`history.zip`原路径）；`.test-artifacts/latest.log` |
| 0391 | Stage02.5-D完成：Story目标URL显示真实正文；World Area URL展开并选中目标；无效World目标保留Game页；World挂载定位失败恢复选中与展开。定向13项、typecheck、docs检查通过；脚本API经协调器用例验证，浏览器只读自动化未直接调用脚本。DEV导航指南已补充。 | `ai/plan/task-0391-editor-workbench-dev-navigation-validation.md`（`history.zip` 原路径）；`src/ui/development/dev-navigation.ts`、`tests/ui/development/dev-navigation.test.ts`、`.test-artifacts/latest.log` |
| 0392 | Stage03-A调查完成，未改生产代码：确认 Story 私有集合/数字 ID/active 引用、Provider 浏览快照和草稿独立所有权；记录来源复用身份、复制隔离、门禁及空末实例行为，并为 0393/0394 明确事务接口与未迁移状态单向兼容边界。 | `ai/plan/task-0392-editor-instance-story-contract.md`（`history.zip` 原路径）；`src/ui/story-editor/workspace-session.ts`、`story-editor/controller.ts`、`story-editor/model.ts`、`tests/ui/story/story-editor-workspace-session.test.ts` |
| 0393 | Stage03-B完成：新增隔离的 `BrowseInstanceManager` 核心，唯一管理 opaque ID、有序集合、active ID 与创建/激活/关闭/复制/复用/后继/更新；准备失败不改 Manager 状态。Manager 暂未接 Story 运行路径，旧路径按 CP 边界继续唯一写入。定向7项、typecheck、architecture及diff检查通过。 | `ai/plan/task-0393-editor-instance-manager-core.md`（`history.zip` 原路径）；`src/ui/workspace/browse-instance-manager.ts`、`tests/ui/workspace/browse-instance-manager.test.ts`、`.test-artifacts/latest.log` |
| 0394 | Stage03-C完成：Story 的唯一实例记录、顺序与 active ID 已由 Manager 持有；workspace 只读投影。激活先通过 gate/capture/目标恢复和 host 准备，最后提交 Manager active ID。保存拒绝、capture/restore失败保留旧草稿、route/布局/宿主；试播失败门禁保留临时三栏。Story Workspace 53项、事务定向14项及临时场景1项通过，typecheck/architecture/docs通过。 | `ai/plan/task-0394-editor-instance-activation-atomicity.md`（`history.zip` 原路径）；`src/ui/workspace/browse-instance-manager.ts`、`story-editor/workspace-session.ts`、`story-editor/controller.ts`、`story-editor/view.ts`、`.test-artifacts/latest.log` |
| 0395 | Stage03-D完成：Story Provider 按 kind/resource/source/package 生成 Manager reuse identity；open-or-reuse/duplicate/create/close/后继均通过 Manager 准备回调；Provider/门禁失败不提交 active 或留候选。后台关闭不跑 gate，活动 close gate一次，末项保留空 Story context。受影响5文件84项、追加close后继恢复失败1项、typecheck/architecture/docs通过。 | `ai/plan/task-0395-editor-instance-story-lifecycle.md`（`history.zip` 原路径）；`browse-instance-manager.ts`、`story-editor/workspace-session.ts`、`story-editor/controller.ts`、相关 Story tests、`.test-artifacts/latest.log` |
| 0396 | Stage03-E完成并通过 Stage03 集中验收：删除 StoryWorkspaceSession/state.workspace 过渡壳，Controller/首帧渲染从同一 Manager 读取；无 Story 私有数组/active/nextId 写入口。检查 Manager 无业务/布局依赖。受影响 Story/pack/Manager/DEV suite 84项、typecheck/architecture/diff通过。 | `ai/plan/task-0396-editor-instance-story-authority-removal.md`（`history.zip` 原路径）；`src/ui/workspace/browse-instance-manager.ts`、`story-editor/controller.ts`、`story-editor/model.ts`、`story-editor/view.ts`、`workspace/workspace-renderer.ts`、`.test-artifacts/latest.log` |
| 0397 | Stage04-A完成：新增 World Provider 资源目标、身份、有效目标准备、Init/Area/Spot tree projection 与只读摘要模型。`WorldBrowserSession.selected` 退出，UI/DEV 从 Provider target 单向读取；旧数字实例 ID、World route、关闭/创建生命周期及 Explorer 状态暂留。World+DEV 2 files/25 tests、typecheck/architecture通过。 | `ai/plan/task-0397-editor-world-provider.md`（归档后 `history.zip` 原路径）；`src/ui/runtime-editor/world-browser-provider.ts`、`world-browser.ts`、`controller/controller.ts`、`development/dev-navigation.ts`、`.test-artifacts/latest.log` |
| 0398 | Stage04-B完成：Manager `openOrReuse()` 增加可失败的 Provider reuse 准备/提交边界；World 固定 browse reuse identity，按实体更新 resourceKey 和 target state。Init→Area→Spot 保持实例 ID，invalid target/reuse preparation fail 不变更快照，Story 记录不受影响。3 files/35 tests、typecheck/docs/architecture/diff通过；未接入实际 World 路径。 | `ai/plan/task-0398-editor-world-single-instance-policy.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/browse-instance-manager.ts`、`src/ui/runtime-editor/world-browser-provider.ts`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`、`.test-artifacts/latest.log` |
| 0399 | Stage04-C完成：Manager 唯一装配/所有权提升至 UIController，Story/World 共享有序集合与 active ID；移除 `PanelState.worldBrowser`、World numeric ID 和 Story 私有 Manager 构造。Story A→World→Story 保持目标/草稿与 World target/目录滚动；World 标签关闭回到最近 Story，显式 exit 独立保留 World 实例。5 files/93 tests、typecheck/docs/architecture/diff通过；浏览器集中到0400。 | `ai/plan/task-0399-editor-world-manager-integration.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/editor-browse-instances.ts`、`browse-instance-manager.ts`、`runtime-editor/world-browser-provider.ts`、`runtime-editor/world-browser.ts`、`controller/controller.ts`、`story-editor/controller.ts`、`.test-artifacts/latest.log` |
| 0400 | Stage04-D完成并通过Stage04集中验收：Manager 无 Story/World 导入、类型或分支；Provider seed/回调提供身份与策略，UIController是唯一 Manager 装配点。真实浏览器验证 Story A→World→Story、World Init→Area→Spot同ID、World关闭回Story、退出后重进复用ID。5 files/93 tests、typecheck/docs/architecture/diff、浏览器console errors=0通过；测试后恢复Classic。 | `ai/plan/task-0400-editor-provider-boundary-audit.md`（归档后 `history.zip` 原路径）；`browse-instance-manager.ts`、`editor-browse-instances.ts`、两个 Provider、`.test-artifacts/latest.log` |
| 0401 | Stage05-A完成：新增 `EditorWorkbench` 作为Manager/`activeExplorerType`/theme-return单一外部会话owner；删除 `UIController.editorSession`。Manager创建时为空；显式进入Story/World才由Provider建record。几何偏好继续归EditorLayoutService，route复用既有workspaceNavigation；空态展示延后0405。6 files/94 tests、typecheck/docs/architecture/diff通过。 | `ai/plan/task-0401-editor-workbench-session-owner.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/editor-workbench.ts`、`editor-browse-instances.ts`、`controller/controller.ts`、`story-editor/controller.ts`、`.test-artifacts/latest.log` |
| 0402 | Stage05-B完成：Workbench Explorer 选择与 Manager active ID 解耦；`enterEditorRoute()` 不再隐式改 Explorer。Rail 切换用 `WorkspaceColumns.update()` 只替换稳定 `editor-explorer` 栏，保留中右栏 DOM、活动实例及业务 Ribbon；跨 route World Explorer 滚动按显示中的 Explorer 状态恢复。跨 Provider 资源点击、命令作用域和完整 Explorer 交互留给 0403/0404/Stage06。4 files/83 tests、typecheck/architecture/diff通过；真实浏览器核验按用户要求留待手动验收。 | `ai/plan/task-0402-editor-workbench-independent-explorer.md`（归档后 `history.zip` 原路径）；`src/ui/controller/controller.ts`、`workspace/workspace-renderer.ts`、`runtime-editor/world-browser.ts`、`story-editor/view.ts`、`story-editor/controller.ts`、`.test-artifacts/latest.log` |
| 0403 | Stage05-C完成：Workbench click delegate 将 Story/Entry 和 World Explorer 目标送入各自 Provider，再经同一 Manager 创建/复用/激活；Story/World 标签来自完整 Manager snapshot，实例激活不改 Explorer，显式定位才切 Explorer。跨 Provider 激活前执行 Story 门禁和目标恢复，失败保留 route/active ID；关闭非活动 Provider 标签不切当前 route。5 files/90 tests、typecheck/docs/architecture/diff通过；真实浏览器核验按用户要求留待手动验收。 | `ai/plan/task-0403-editor-workbench-resource-activation.md`（归档后 `history.zip` 原路径）；`src/ui/controller/controller.ts`、`src/ui/story-editor/controller.ts`、`workspace/workspace-renderer.ts`、`story-editor/view.ts`、`runtime-editor/world-browser.ts`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`、`.test-artifacts/latest.log` |
| 0404 | Stage05-D完成：公共 mode/view/layout/exit 继续走 Workbench binding；Manager tabs 与跨 Provider open 由公共 click delegate 按 Manager Provider 路由；Story 活动 route 的 save/preview/history/selection 仍由 Story handler 接收。补齐 World active + Story Explorer 时的 Story 搜索/筛选列绑定，Explorer query 不改 Manager active ID 或 World 中右栏。5 files/92 tests、typecheck/docs/architecture/diff通过；真实浏览器核验按用户要求留待手动验收。World 搜索控件尚不存在，留给 Stage06 公共 Explorer。 | `ai/plan/task-0404-editor-workbench-command-scopes.md`（归档后 `history.zip` 原路径）；`src/ui/controller/controller.ts`、`src/ui/story-editor/controller.ts`、`tests/ui/runtime-editor/runtime-editor-world-browser.test.ts`、`.test-artifacts/latest.log` |
| 0405 | Stage05-E完成：Story/World/试播/目录管理/空态共用稳定 Workbench frame 与 Explorer/content/inspector column IDs；全局 render 保留已挂载帧，Story 局部 patch 按列更新；末实例关闭留下可继续打开资源的空 Workbench，Story 保存门禁与 World 公共关闭语义保留。2 files/72 tests、typecheck/docs/architecture/diff通过；浏览器由用户手验。 | `ai/plan/task-0405-editor-workbench-host-and-empty-state.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/editor-workspace-frame.ts`、`workspace-columns.ts`、`workspace-renderer.ts`、`controller/controller.ts`、`story-editor/controller.ts`、Story/World tests、`.test-artifacts/latest.log` |
| 0406 | Stage05-F自动化集中验收完成：验证跨 Provider 打开/激活/关闭、Explorer 不随活动实例切换、显式 World 定位、Story 门禁失败、空 Workbench/真实退出返回，以及 Story 临时试播与栏位 DOM 身份。修复 `WorkspaceColumns.mount()` 接管静态帧时重复栏位，新增回归。5 files/99 tests、typecheck/docs/architecture/diff通过。按用户要求未直接浏览器验收，视觉/交互待手动。 | `ai/plan/task-0406-editor-workbench-cross-business-validation.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/workspace-columns.ts`、Story/World/Workbench/DEV suites、`.test-artifacts/latest.log` |
| 0407 | Stage06-A完成：Story 树节点分别输出 source-aware resource identity 与 parent placement identity；World resource identity 仍为 kind/id，tree placement key 改为沿父链生成，alias 可用 preferred placement 精确定位。同资源不同 placement 不共享行 key；展开/选中 owner 未提前迁移。4 files/110 tests、typecheck/docs/architecture/diff通过；浏览器未执行。 | `ai/plan/task-0407-editor-explorer-provider-identities.md`（归档后 `history.zip` 原路径）；`story-editor/sidebar-tree.ts`、`runtime-editor/world-browser-provider.ts`、`runtime-editor/world-browser.ts`、identity/World tests、`.test-artifacts/latest.log` |
| 0408 | Stage06-B完成：新增 Workbench 唯一持有的 `EditorExplorerService`，按 Story/World 隔离查询 channel、普通/搜索展开覆写、selected placement、scroll host、focus/reveal；删除 Story state 的 search/fold/reveal/scroll mirror 与 World instance 的 expanded/selected/scroll。Provider 仍解释 Story source/Init filter，World active target 不变。7 files/145 tests、typecheck/docs/architecture/diff通过；未做浏览器手验。 | `ai/plan/task-0408-editor-explorer-state-owner.md`（归档后 `history.zip` 原路径）；`src/ui/workspace/editor-explorer-service.ts`、`editor-workbench.ts`、Story/World adapters、相关 suites、`.test-artifacts/latest.log` |
| 0409 | Stage06-C完成：`EditorExplorerService.bindColumn()` 统一 placement 展开、选择、滚动捕获及 disposer；Story/World 使用共同 DOM identity 属性，Story deferred-folder 与打开资源、World target/摘要仍由业务 Controller 处理。Story 行局刷、World 树/摘要与 `WorkspaceColumns` 稳定栏位保留。7 files/139 tests、typecheck/docs/architecture/diff通过；浏览器未操作。 | `ai/plan/task-0409-editor-explorer-dom-interactions.md`（归档后 `history.zip` 原路径）；`editor-explorer-service.ts`、Story/World binders、`workspace-columns.ts`、Story/World/Explorer tests、`.test-artifacts/latest.log` |
| 0410 | Stage06-D完成：Story 搜索投影保持普通折叠；显式定位保留查询及 Init 筛选、按有效 Init/活动 Init/树顺序选择单一放置，并对阻挡过滤临时显露目标；Entry 只投影至实际可用 Init。World 摘要实体链接在专注模式不打开目录；显式定位成功后恢复目录栏，后置失败恢复之前的 Explorer/目标/布局。3 files/76 tests、focus 路径新增回归 2 tests、typecheck/docs/architecture/diff通过；浏览器留用户手验。 | `ai/plan/task-0410-editor-explorer-search-and-reveal.md`（归档后 `history.zip` 原路径）；`story-editor/sidebar-tree.ts`、`controller/controller.ts`、Story/World tests、`.test-artifacts/latest.log` |
| 0411 | Stage06-E完成：核实 Story/World 通过 `surface-styles.ts::loadEditorWorkspaceStyles()` 共用 `editor-directory.css`；目录树、行、选中/hover/focus、Chevron、层级线和滚动条均使用公共组件/选择器。删除 Story 行与公共默认 padding 重复的 CSS；保留 Story label small 真实变体。2 files/33 tests、typecheck/docs/architecture/diff通过；宽屏主题与滚动条由用户手验。 | `ai/plan/task-0411-editor-explorer-shared-presentation.md`（归档后 `history.zip` 原路径）；`editor-directory.css`、`story-editor.css`、`surface-styles.ts`、CSS/World tests、`.test-artifacts/latest.log` |
| 0412 | Stage06-F完成：`EditorExplorerService.bindColumn()` 实际接管 query、search fold reset/reveal invalidation、expand、selection、scroll capture；公共 `revealPlacement()` 做 path expand/scroll/focus。删除 Story advanced query/selection 和 World tree expand/selection DOM 重复绑定；保留 Story filters/projection/patch、World Provider path disambiguation/summary 局刷。7 files/140 tests、typecheck/docs/architecture/diff通过；浏览器手验未做。 | `ai/plan/task-0412-editor-explorer-story-world-migration.md`（归档后 `history.zip` 原路径）；`editor-explorer-service.ts`、Story view/controller、UIController World binder、Explorer/Story/World/DEV tests、`.test-artifacts/latest.log` |
| 0413 | Stage07-A 只读 owner 审计完成：Layout/Workbench/Manager active ID/Explorer/Provider/WorkspaceColumns/theme-return 均核实唯一 owner；旧 per-type layout 仅为迁移读源；`sidebarVisible`、World view/ID 等旧权威无命中。唯一明确的潜在死 adapter 是只供测试使用的 Story-only `browseInstanceSnapshot()`，交给 0414 核查/移除；无代码变更。 | `ai/plan/task-0413-editor-workbench-ownership-audit.md`（归档后 `history.zip` 原路径）；`editor-workspace.ts`、`editor-workbench.ts`、`browse-instance-manager.ts`、Providers、`editor-explorer-service.ts`、`workspace-columns.ts`、`editor-return.ts` |
| 0414 | Stage07-B完成：删除无生产消费者的 `StoryEditorController.browseInstanceSnapshot()` facade；4 处 lifecycle tests 改从 Workbench 唯一 Manager snapshot 读取并在测试层过滤 Story。保留有实际生产消费者的 UIController 单向 `browseInstances` getter。4 tests、typecheck/docs/architecture/diff通过。 | `ai/plan/task-0414-editor-workbench-remove-transitional-paths.md`（归档后 `history.zip` 原路径）；Story Controller、测试 helper/workspace tests、`.test-artifacts/latest.log` |
| 0415 | Stage07-C完成：更新 `workspace-columns-and-layout.md` 的编辑器接入指引，按真实 owner/调用链说明 Workbench、Manager、Story/World Provider 生命周期、失败准备、World 单实例策略、Explorer resource/placement identity 与公共交互边界；修正旧的 Story 私有实例管理描述，添加当前源文件和测试链接。`check:docs` 0 errors、diff通过；纯文档任务。 | `docs/docs-830/04-presentation/workspace-columns-and-layout.md`；相关 Workbench/Manager/Story/World/Explorer 源码与测试链接 |
| 0416 | Stage07-D完成：更新 Authoring Workbench/Explorer 视觉知识，纠正 World 默认双栏、业务侧私有 Explorer 状态等过时描述；标出公共 `.editor-directory-*` row/Chevron/选中/focus/hover 契约、左右栏/实例关系与 Story/World 真实差异。CSS/组件证据链接已核；`check:docs` 0 errors、diff通过。颜色主题、屏幕几何与滚动条视觉留人工验收。 | `ui-style/visual-languages/authoring/patterns/workbench.md`、`patterns/explorer.md`；`editor-workspace.css`、`editor-directory.css`、`editor-explorer-service.ts`、Workbench/Explorer 测试 |
| 0417 | Stage07-E综合自动化验收完成：7 suites/140 tests，typecheck、architecture、docs（0 errors/129 markdown）、diff通过。按用户要求未操作浏览器；已在 Task0417 列出 Workbench/Stage02/0384/0385 的手动验收路径和旧5173服务刷新提示。无代码改动、无存档写入、无提交/推送。 | `ai/plan/task-0417-editor-workbench-final-integration.md`（归档后 `history.zip` 原路径）；`.test-artifacts/latest.log`、Workbench/Story/World/Explorer/DEV suites |
| 0418 | Stage07-F最终交付完成：将唯一 owner、Provider 责任、旧权威退出、接入/DEV 路径、Stage/CP 结果、自动验证与浏览器人工待验影响汇总到本 Roadmap 和现行机制页；归档/索引闭合，无代码变更、无 commit/push。`check:docs` 与 `git diff --check` 通过。Stage07完成后按 Roadmap 停止。 | `ai/plan/task-0418-editor-workbench-final-delivery.md`（归档后 `history.zip` 原路径）；Task0386 Roadmap 最终交付段、Task0417人工验收清单、Workspace/DEV 机制页 |

## 单独 Task 序列与依赖

Task 0387–0418 对应独立工作节点。执行依赖以本表为准，不机械按编号排序；0388 前置核对已完成并将归档。每项施工前复核其当下源码与测试，不预写未经核实的 API。前序已通过的行为不因后续阶段自动重测；只有受影响的行为在相关 Task 或 Stage 集中验收中回归。

| 顺序 | Task | 交付节点 |
| --- | --- | --- |
| 1 | Task 0388（已归档：`ai/plan/task-0388-editor-workbench-stage-02-preflight.md`） | Stage 02 前置核对已完成；遗留人工验收不阻塞 02.5 |
| 2 | Task 0387（已归档：`ai/plan/task-0387-editor-workbench-dev-navigation.md`） | Stage 02.5-A 启动、正式入口、ready/success 信号调查完成 |
| 3 | Task 0389（已归档：`ai/plan/task-0389-editor-workbench-dev-navigation-coordinator.md`） | Stage 02.5-B 导航协调器和current读取完成 |
| 4 | Task 0390（已归档：`ai/plan/task-0390-editor-workbench-dev-url-layout.md`） | Stage 02.5-C URL导航/query保留完成；Mode/View覆盖延期 |
| 5 | Task 0391（已归档：`ai/plan/task-0391-editor-workbench-dev-navigation-validation.md`） | Stage 02.5-D 完成；导航验收结论与遗留 Stage02 浏览器项已记录 |
| 6 | Task 0392（已归档：`ai/plan/task-0392-editor-instance-story-contract.md`） | Stage03-A Story/Entry Provider 合同调查完成；实现前置事实见本表摘要 |
| 7 | Task 0393（已归档：`ai/plan/task-0393-editor-instance-manager-core.md`） | Stage03-B 公共 Manager 核心完成；Story 运行接入延后 |
| 8 | Task 0394（已归档：`ai/plan/task-0394-editor-instance-activation-atomicity.md`） | Stage03-C：Manager 持有 Story 集合/active，激活恢复失败安全已完成 |
| 9 | Task 0395（已归档：`ai/plan/task-0395-editor-instance-story-lifecycle.md`） | Stage03-D：Provider identity、创建/复用/复制/关闭策略接入 Manager |
| 10 | Task 0396（已归档：`ai/plan/task-0396-editor-instance-story-authority-removal.md`） | Stage03-E：Story旧权威退出并完成 Stage03集中验收 |
| 11–14 | Task 0397/0398/0399/0400（已归档） | Stage 04 A–D |
| 15–20 | Task 0401–0406（已归档） | Stage 05 A–F 完成；视觉/交互浏览器项由用户手动验收 |
| 21–26 | Task 0407/0408/0409/0410/0411/0412 已归档（摘要见上表） | Stage 06 A–F |
| 27–32 | Task 0413–0418 均已归档（摘要见本表） | Stage 07 A–F 已完成 |

## 执行合同与验证策略

- 执行者在每个节点开工时读取命中领域资料，复核当前代码和测试后修改本 Task 的依据，不提前调查所有后续阶段。
- 实现选择依序复用既有服务、扩展公共能力、迁移成熟业务实现；只有真实能力缺口才加新机制。不得为整洁拆出平行框架。
- Task 内可以在实现复杂时追加小 CP，但不得把调查、空接口或计划页视作代码完成。已确定目标不因细分而重新审批。
- 每个已完成节点先在自己的 Task 记录实际修改的文件/符号、所有权迁移点、退出的旧写入口、验证、遗留问题和下一动作；归档前把可恢复摘要写入本表并从这里链接证据。测试日志留在项目规定目录，不复制日志全文。
- 状态迁移、门禁和失败恢复优先定向测试与调用方检查；稳定 DOM/刷新使用 DOM 测试或既有 refresh observation；CSS 归属核对加载链和选择器；真实几何、滚动、遮挡、浮层及视觉变化才做对应浏览器验证。阶段末做风险驱动的集成检查。
- Stage 02 遗留的正文输入、Entry 属性、悬浮滚动条、目录管理/试播浏览器检查不得丢失；若后续相关代码未覆盖它们，不重复整套验收，Stage 07 集中核对仍待人工处理的项目。
- Task 状态与 Checkpoint 状态分开记录。是否创建本地 Git checkpoint commit 只按用户明确授权；禁止自动提交用户无关差异、重置、改写历史或远程推送。
- 普通实现选择由执行者决定。仅当目标冲突、不可逆数据风险、关键验证持续失败或环境使必要验证不可能时停止受影响路径；受阻不影响的独立工作可以继续。Stage 07 完成后停止。

## 当前进展

- 已完成：保存 Stage 03–07 长期合同并将全部 CP 拆为独立 Task；按最新裁定修正 Manager 活动 ID 唯一权威、逐 CP 迁移边界、失败安全基础契约、Stage 集中验收和归档恢复入口。Task 0388 前置核对完成。
- 已完成：Stage 02.5-D Task 0391；Story/World URL、无效目标、Game URL 真实浏览器检查完成，World 后置定位失败恢复与 DEV 导航指南已交付。
- 已完成：Stage03-A Task 0392；Story Provider 状态所有权、资源/来源复用身份、失败与关闭边界已按源码核对。
- 已完成：Stage03-B Task 0393；隔离的公共 Browse Instance Manager 核心可用，旧 Story 路径仍是现行唯一权威。
- 已完成：Stage03-C Task 0394；Story 记录集合/active ID 已切到 Manager，Provider 激活失败恢复已按实际 UI 路径接入。
- 已完成：Stage03-E Task0396；Story 私有 session/state 兼容壳退出，Manager单一所有权经源码审计和84项影响集成回归验证，Stage03整体通过。
- 已完成：Task0397，抽取 World 只读资源 Provider 状态；代码与恢复记录见上表。
- 已完成：Task0398，Manager 可执行 World 单实例 Provider 复用策略；运行入口尚未接入。
- 已完成：Task0399，Story 与 World 的真实实例生命周期已汇入 UIController 唯一 Manager；World 私有 ID/session 生命周期权威退出。
- 已完成：Task0400，公共 Manager Provider 边界审计通过，Stage04真实浏览器/自动化集中验收通过；代码/证据见上表。
- 已完成：Task0401，Workbench session owner 与空集合基础已落地；见上表。
- 已完成：Task0402，Workbench Explorer 选择与活动 Browse Instance 解耦；Rail 切换仅更新左栏，四种 Explorer/活动业务 route 组合可渲染，代码与验证摘要见结果表。
- 已完成：Task0403，跨 Provider Story/Entry/World 资源打开、混合实例标签、Provider 激活/关闭及显式定位通过；失败不留候选实例或错误活动状态，结果见上表。
- 已完成：Task0404，Workbench/Explorer/Active Instance/Selection 命令保持各自 owner；Story Explorer 在 World 活动时搜索/筛选正确作用于左栏 Story 状态，业务 Story 命令仍只在 Story route 执行。World Explorer 暂无搜索控件，Stage06统一实现。
- 已完成：Task0405/0406，稳定栏位宿主、空 Workbench 与 Stage05 集中自动化验收；见上表。
- 已完成：Task0407–0410，完成 Explorer resource/placement identity、Workbench Explorer 唯一通用状态、Story/World 公共 DOM 交互及搜索/显式定位生命周期；见上表。
- 已完成：Task0411，公共 Explorer 表现和 CSS 加载路径经源码/消费者审计；移除一条 Story 重复样式，视觉手验留用户。
- 已完成：Task0412，Explorer 通用 query/expand/select/reveal/scroll/focus 交互收归公共 service；Stage06 迁移闭合，业务 Provider 保留专属投影与资源语义。
- 已完成：Task0413，源码审计确认 Layout/Workbench/Manager/Explorer/Provider/WorkspaceColumns/theme-return 各有唯一 owner；历史 per-type layout 仅保留迁移读取。Story-only snapshot adapter 只被测试调用，作为 0414 唯一明确清理候选。
- 已完成：Task0414，移除 Story-only test adapter production facade；唯一 Manager snapshot 读取由测试 helper 过滤，保留必要的 UIController 单向 Manager 门面。
- 已完成：Task0415，真实 Provider/Workbench/Explorer 接入路径和测试入口已记录到 Workspace 机制页。
- 已完成：Task0416，Authoring Workbench/Explorer 视觉知识已按实际公共 class 与当前 owner 修正；浏览器视觉结论继续由用户验收。
- 已完成：Task0417，7 suites/140 tests 与 typecheck/architecture/docs/diff 通过；Stage02/0384/0385的真实浏览器路径与未验范围已记入 Task0417，按用户要求留手动。
- 已完成：Task0418最终交付与归档；Stage07已结束，本 Roadmap 按约停止。

## Stage 07 最终交付

> 后续源码审查发现公共表现与数据合同仍有分裂。新的收敛授权及四个连续施工 Task 见 [[ai/plan/00-index]] 与 Task 0419–0422；本 Roadmap 以下结果保留为 Stage 02–07 的历史交付记录，不表示收敛工作已完成。

### 后续 Editor Workbench Convergence

- Task 0419（已完成并归档至 `ai/archive/history.zip`）：抽出 Story Explorer state/projection。`StoryEditorController.explorerState` 是 Story Explorer 专属浏览状态 owner；目录查询投影不再合并为 StoryEditorState，来源解析与 Story instance 内容来源拆开，空 Manager 下构建 Explorer 不创建合成实例。定向 3 suites / 62 tests、TypeScript、architecture、docs 与 diff 均通过；无浏览器操作。
- Task 0420（已完成）：Explorer 与活动实例 Provider 通过单一只读 Workbench projection 组合；公共 Frame/Chrome/slot 不再由 Story/World 分别构造。7 个相关 UI suites / 122 tests、TypeScript、architecture、docs 与 diff 通过；浏览器留用户手动验收。
- Task 0420（已完成）：Provider 合同与唯一 Workbench combination projection；保持既有 `EditorWorkbench`、`WorkspaceFrame` 与 `WorkspaceColumns`，不新建 Host/Router/Manager。7 个相关 UI suites / 122 tests、TypeScript、architecture、docs 与 diff 通过；浏览器留用户手动验收。Task 文档归档后保留原路径于 `ai/archive/history.zip`。
- Task 0421（当前）：在唯一 projection 上收公共绑定、命令作用域、activate/open/locate、生命周期失败恢复与局部 refresh。
- Task 0422（后续）：接入 World 搜索/定位，做八条连续场景集成回归，完成文档和旧入口退出审计。本轮到此停止。

- 唯一布局 owner：`EditorLayoutService` / `editorLayout`，跨 Story、World 与所有 Browse Instance 持有 Classic/Advanced、视图、Ribbon 与期望栏宽。旧 per-workType key 仅用于迁移读取，不是活动写入口。
- Workbench owner：`EditorWorkbench` 持有会话 theme/return、`activeExplorerType`、唯一 `BrowseInstanceManager` 与唯一 `EditorExplorerService`。Explorer type 只控制左栏；Manager 的 active ID 控制活动中右业务内容，二者独立。
- 唯一 Browse Instance active ID/集合：`BrowseInstanceManager`。Story/Entry 与 World 作为 Providers 使用同一集合；Story 负责 source-aware resource identity、草稿门禁、capture/restore/copy；World 负责 `kind:id` 资源身份、父链 placement 与固定 `world-browser` reuse 策略。最后实例关闭留空 Workbench，退出编辑器是独立命令。
- 唯一通用 Explorer 状态：`EditorExplorerService` 按 Explorer type 管 query、普通/搜索折叠、placement selection、scroll host、focus/reveal，并实际绑定通用 query/expand/select/reveal/scroll。Provider 留资源树投影、筛选、多放置消歧与业务操作；共享 DOM/CSS 使用稳定 `.editor-directory-*` 契约。
- 接入与 DEV：真实 Provider/生命周期/Explorer 身份入口见 `docs/docs-830/04-presentation/workspace-columns-and-layout.md`；DEV 导航 API、URL query 与失败门禁见 `docs/docs-830/07-tooling/runtime-editor-and-project-checks.md` 与 `src/ui/development/dev-navigation.ts`。
- 迁移退出：Story 私有实例集合/active ID、World 私有 numeric ID/session 生命周期、Story/World 布局副本与 World view、Explorer 业务侧通用 query/fold/selection/scroll writer、Story-only `browseInstanceSnapshot()` 生产 facade 已退出。旧存储迁移读取、真实 Story/World Provider 适配及单向 UIController Manager getter因有明确作用保留。
- 自动验证：Task0417 的 7 个相关 UI suites / 140 tests、TypeScript、architecture、docs、diff 全通过。日志为 `.test-artifacts/latest.log`。没有执行全量无关测试。
- 人工待验：遵从用户要求，本轮未操作浏览器。Task0417归档页保留具体操作清单；仍待确认 Story/Entry 正文与属性输入焦点、两种编辑器主题/真实栏宽、悬浮滚动条无挤压、目录管理/试播布局往返、跨来源实例定位与 World focus 普通链接/显式定位、末实例空态/退出返回和反复进退无重复事件。Task0384/0385与0383继续标记待人工验收，不据自动测试改成“通过”。旧5173若有过期转换模块需先刷新/重启。
- Git：未创建本地 checkpoint commit，未推送；共享工作区中此前存在的其他差异未被重置。

## 结果与问题

- 结果：Roadmap 和 32 个独立节点（Task0387–0418）已全部完成/归档；Stage07最终交付完成并停止。Task0383/0384/0385 与 Stage02视觉/交互清单保留用户手动验收，不由本 Roadmap 代签通过。
- 验证：0388–0406历史验证见前序记录；0407 identity/World 110项及 World rebuild 18项；0408 7 files/145 tests；0409 7 files/139 tests；0410 3 files/76 tests，新增 focus 定位路径 2 项；0411 2 files/33 tests；0412 7 files/140 tests；0413 源码 owner 审计（只读）；0414 4 个 targeted lifecycle tests；0415 docs check 0 errors（131 markdown）、diff通过；0416 docs check 0 errors（130 markdown）、diff通过；0417 7 files/140 tests、typecheck、architecture、docs（129 markdown/0 errors）、diff通过；0418 final docs check与diff通过。未创建本地checkpoint commit或远程推送。
