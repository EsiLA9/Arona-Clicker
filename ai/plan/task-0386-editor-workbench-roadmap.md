# Task：Editor Workbench Roadmap 与长期设计合同

状态：待核验

## 目标与验收

- 目标：作为 Stage 02–07 的唯一长期架构合同和执行索引，保存已裁定的状态所有权、跨阶段行为不变量、迁移边界、通过条件及每个可执行 Task 的入口。
- 完成条件：Stage 02 前置核对至 Stage 07 收敛都能从本页和其链接 Task 恢复；后续 Task 可以调整实现接口，但不得以调查不足、渐进迁移或文件拆分为由改变下列产品行为或长期所有权。
- 边界：本页是路线和合同，不代替各 CP Task 的当前源码复核、代码变更和验证；本轮只扩充任务文档，不施工。

## 长期设计合同

### 唯一所有者与不变量

| 能力 | 最终唯一权威 | 允许由业务提供 | 不允许形成 |
| --- | --- | --- | --- |
| 布局偏好 | `EditorLayoutService`：mode/view、左右栏期望宽度、Ribbon 偏好、Classic/Advanced 偏好；基础偏好统一持久化 | 可用栏位及临时场景所需能力 | Story、World、实例各自持有或互相同步布局偏好 |
| Workspace 外壳 | 公共 Workbench／Workspace Host，沿用 `WorkspaceFrame` 与 `WorkspaceColumns` 的稳定栏位身份和释放生命周期 | 栏位内容、业务刷新回调、离开门禁与业务命令 | Story/World 分别安排公共 Layout、Ribbon、Resize、Chrome 装配；平行 Column Manager 或全局重绘调度器 |
| Browse Instance 生命周期 | 公共 `Browse Instance Manager`：稳定 ID、集合顺序、激活身份、生命周期、创建/复制/关闭/复用和后继选择 | Provider 的资源身份、业务初态、捕获/恢复、门禁、有效性、标题/图标/状态及策略 | 两套可写的 instances/active/nextId；公共服务硬编码 StoryDraft 或 World Entity |
| Workbench 工作维度 | Workbench 分开持有左栏 `activeExplorerType` 与 `activeBrowseInstanceId` | Provider 选择、资源投影和命令 | 左栏 Work Type 作为编辑器路由；激活实例自动切 Explorer；切 Explorer 触发业务保存门禁或替换中右栏 |
| Explorer 通用交互 | 公共 Explorer 服务：查询、普通展开、节点选择、滚动、聚焦、临时 reveal、显露祖先及生命周期 | Provider 的树投影、筛选语义、资源身份、放置身份、多放置消歧、资源打开与业务操作 | 两套完整浏览 Controller、公共状态与业务状态双向同步、把 Story 草稿/来源语义塞进公共服务 |
| 栏位 DOM 生命周期 | `WorkspaceColumns` 的 keyed identity、挂载、更新和释放 | Story 精细正文 patch；World 摘要局部刷新 | 为表面统一而全量重建，或以业务更新取代栏位身份管理 |

### 跨阶段必须保持的行为

1. **布局与内容独立**：Story、Entry、World 资源或实例切换均继承同一基础布局；窗口压缩和临时布局不得覆盖期望宽度或持久偏好。业务临时场景优先于开发测试覆盖。显式布局命令才提交基础偏好。
2. **实例切换原子性**：先确认目标身份与可用性，再跑当前业务离开门禁、捕获当前状态、准备/恢复目标，成功后才提交活动身份与标签/内容。任一门禁或恢复失败，原会话仍可操作，不能留下活动 ID、空标签、半初始化路由或覆盖残留；不得重复保存或清空既有草稿。
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
| 02.5 导航 | DEV-only URL 与脚本入口共用正式业务语义；不造 Router/RPC；提供实际 current/readiness；失败恢复；临时布局走现有有效布局投影 | 导航等资源、样式和宿主可操作后才成功；无效/门禁/准备失败保留旧会话；重定向保留查询；生产无 API；不改存档/草稿 |
| 03 Story/Entry Manager | 抽公共生命周期，Story 是首个 Provider；保留独立 Story/World 路由和业务恢复；World 暂不接入 | Story/Entry 多实例打开、复用、显式复制、激活、关闭均通过 Manager；保存门禁与恢复失败原子；Story 不再有第二套通用集合/ID/活动写入口 |
| 04 World Provider | World 单实例复用策略接入同一 Manager；保留只读实体浏览和当前 World tree 行为；可暂保两路由及不同标签投影 | Story/World ID 与集合统一且不冲突；切换路由不丢实例；World 实体打开复用正确；关闭实例不等同退出；Manager 无领域硬编码 |
| 05 Workbench | 统一会话/外部返回/主题/Manager/Explorer 选择；Work Type 与实例双维度；统一命令作用域、混合实例、空 Workbench、临时场景和稳定栏位 | 左栏与活动实例独立；Story/Entry/World 同集合；命令目标正确；显式定位才切 Explorer；空工作区可继续开资源；退出仍过门禁并返回 |
| 06 Explorer | Provider 提供树/领域语义；公共状态机接管通用搜索、展开、选择、滚动、定位、显露、聚焦和生命周期；分业务逐步迁移并删除旧 Controller | Story/World 状态独立可恢复；资源身份/树放置身份正确；多放置定位正确；搜索/显露恢复用户状态；不改活动实例；左栏更新不重建中右栏；不存在两套完整通用 Controller |
| 07 收敛 | 所有权审计、删除过渡路径、真实 Provider/Workbench 接入文档、视觉模式增量维护、集中集成验证和最终交付 | 单一权威无旧写入口；新 Provider 文档能指向真实入口并走通示例；Stage02未验浏览器项目有结论；报告包含变更、验证、遗留和退出路径 |

## 单独 Task 序列与依赖

Task 0388–0418 每份对应一个可验收工作节点。编号顺序为依赖顺序；具体实现前仍须核对该 Task 的当前源码与测试，不预写未经核实的 API。各 Task 的当前文件、调用方和测试入口以其阶段开工时的源码复核为准。前序已通过的行为不因后续阶段自动重测；只有受影响的行为在相关 Task 中回归。

| 顺序 | Task | 交付节点 |
| --- | --- | --- |
| 1 | [[ai/plan/task-0388-editor-workbench-stage-02-preflight]] | Stage 02 前置事实和待验收项分流 |
| 2–5 | [[ai/plan/task-0387-editor-workbench-dev-navigation]]、[[ai/plan/task-0389-editor-workbench-dev-navigation-coordinator]]、[[ai/plan/task-0390-editor-workbench-dev-url-layout]]、[[ai/plan/task-0391-editor-workbench-dev-navigation-validation]] | Stage 02.5 A–D |
| 6–10 | [[ai/plan/task-0392-editor-instance-story-contract]]、[[ai/plan/task-0393-editor-instance-manager-core]]、[[ai/plan/task-0394-editor-instance-activation-atomicity]]、[[ai/plan/task-0395-editor-instance-story-lifecycle]]、[[ai/plan/task-0396-editor-instance-story-authority-removal]] | Stage 03 A–E |
| 11–14 | [[ai/plan/task-0397-editor-world-provider]]、[[ai/plan/task-0398-editor-world-single-instance-policy]]、[[ai/plan/task-0399-editor-world-manager-integration]]、[[ai/plan/task-0400-editor-provider-boundary-audit]] | Stage 04 A–D |
| 15–20 | [[ai/plan/task-0401-editor-workbench-session-owner]]、[[ai/plan/task-0402-editor-workbench-independent-explorer]]、[[ai/plan/task-0403-editor-workbench-resource-activation]]、[[ai/plan/task-0404-editor-workbench-command-scopes]]、[[ai/plan/task-0405-editor-workbench-host-and-empty-state]]、[[ai/plan/task-0406-editor-workbench-cross-business-validation]] | Stage 05 A–F |
| 21–26 | [[ai/plan/task-0407-editor-explorer-provider-identities]]、[[ai/plan/task-0408-editor-explorer-state-owner]]、[[ai/plan/task-0409-editor-explorer-dom-interactions]]、[[ai/plan/task-0410-editor-explorer-search-and-reveal]]、[[ai/plan/task-0411-editor-explorer-shared-presentation]]、[[ai/plan/task-0412-editor-explorer-story-world-migration]] | Stage 06 A–F |
| 27–32 | [[ai/plan/task-0413-editor-workbench-ownership-audit]]、[[ai/plan/task-0414-editor-workbench-remove-transitional-paths]]、[[ai/plan/task-0415-editor-workbench-provider-guide]]、[[ai/plan/task-0416-editor-workbench-visual-knowledge]]、[[ai/plan/task-0417-editor-workbench-final-integration]]、[[ai/plan/task-0418-editor-workbench-final-delivery]] | Stage 07 A–F |

## 执行合同与验证策略

- 执行者在每个节点开工时读取命中领域资料，复核当前代码和测试后修改本 Task 的依据，不提前调查所有后续阶段。
- 实现选择依序复用既有服务、扩展公共能力、迁移成熟业务实现；只有真实能力缺口才加新机制。不得为整洁拆出平行框架。
- Task 内可以在实现复杂时追加小 CP，但不得把调查、空接口或计划页视作代码完成。已确定目标不因细分而重新审批。
- 每个已完成节点记录实际修改的文件/符号、所有权迁移、旧路径退出、验证命令与结果、未解决问题和下一 Task 第一个动作。测试日志留在项目规定目录；本任务文档只记录摘要。
- 状态迁移、门禁和失败恢复优先定向测试与调用方检查；稳定 DOM/刷新使用 DOM 测试或既有 refresh observation；CSS 归属核对加载链和选择器；真实几何、滚动、遮挡、浮层及视觉变化才做对应浏览器验证。阶段末做风险驱动的集成检查。
- Stage 02 遗留的正文输入、Entry 属性、悬浮滚动条、目录管理/试播浏览器检查不得丢失；若后续相关代码未覆盖它们，不重复整套验收，Stage 07 集中核对仍待人工处理的项目。
- Task 状态与 Checkpoint 状态分开记录。是否创建本地 Git checkpoint commit 只按用户明确授权；禁止自动提交用户无关差异、重置、改写历史或远程推送。
- 普通实现选择由执行者决定。仅当目标冲突、不可逆数据风险、关键验证持续失败或环境使必要验证不可能时停止受影响路径；受阻不影响的独立工作可以继续。Stage 07 完成后停止。

## 当前进展

- 已完成：把此前自主施工 Prompt 中 Stage 03–07 的所有权、业务不变量、阶段边界、通过条件、过渡路径退出要求及验证/Checkpoint 约定保存到项目 Task；将各 CP 拆为独立 Task。
- 正在进行：等待用户核验任务文档序列；本轮未开始 Stage 02 preflight 或后续代码施工。
- 下一步：按序先审阅 Task 0388；核验通过后由施工授权方启动，读取源码并记录实际 checkpoint。

## 结果与问题

- 结果：持续 Roadmap 和 32 个单独工作节点已建立；Stage 02.5 任务原稿拆分成独立节点后保留在序列首位。
- 验证：本轮文档静态核验待执行；未运行代码测试、未操作浏览器、未修改产品实现。
- Git：不创建本地检查点提交，不推送。
