# Task 01（现有 0421）：公共 Host、生命周期及更新入口收敛

状态：已完成

正式 Task：Task 0421；原施工节点：Task 01。
前置：当前工作树与 Task 0420。
后继：0423/0424/0425/0426。
完整原始指令保存在 ai/plan/upper-chat-tasks/01-host-lifecycle.md；本 Task 正文保留该指令全文。

## 施工目的

在当前已建立的 EditorWorkbench.project()、EditorExplorerProjection、BrowseInstanceManager 和 WorkspaceColumns 基础上，完成实际接线。不得新建另一套 Host。目标不是让 Story/World 分别装配出的页面恰好兼容，而是让公共 Host 决定实际组合，业务只提供内容、命令、查询与必要的局部 patch。

当前本地报告 5 files / 94 tests：85 通过、9 失败，typecheck/architecture/docs 通过。先核实未提交差异和最近日志，再继续施工；不能假定九项都是旧测试，也不能回退已有修改。

## 1. 建立失败证据与前置状态

读取 Task 0421、0420 实际交付及当前 git diff。获取 9 项失败的完整测试名、断言、调用入口、实际/预期和相关变更路径，按真实行为回归、已退出私有接口、过时合同、已知基线或环境失败分类。每项指出保护的行为是什么；只允许在证明原业务约束仍成立后改测试入口。若有基线失败，使用已有日志、可隔离的基线或最小复现证明，不切换/重置用户当前工作区。对与目录实例化有关的旧合同记录后继 Task，但不把当前 Host 失败随意延后。

## 2. 收束实际组合入口

检查 src/ui/workspace/editor-workbench.ts、editor-workspace-frame.ts、editor-workspace.ts、workspace-renderer.ts、src/ui/controller/controller.ts、src/ui/story-editor/controller.ts、view.ts、src/ui/runtime-editor/world-browser.ts。

以 EditorWorkbench.project() 为唯一组合语义。输入从真实 activeExplorerType、对应 Explorer snapshot、Manager active record、editorLayout 和当前合法临时场景取得。不得使用上一次请求或默认 Story/空 snapshot 掩盖正常运行的参数缺失。审查 project() 当前以 businessColumns.find(slot === 'left') 优先覆盖 Explorer 的行为：正常实例禁止提供左栏；仅确有合法临时场景（例如试播或明确的文档辅助工具）可以通过有所有者、退出条件和范围的显式覆盖接入，不以任意 business column 作为隐式特权。目录管理旧模式仅暂留到 Task 03，不得扩大例外。

初次 render、公共区域刷新、Story.refresh()、World 摘要刷新、setActiveEditorExplorer()、最后实例关闭与外部 DEV 导航应使用同一组合依据。允许局部投影后只更新本次需要的栏位，不强迫每次重绘全部 DOM。Story 已有 keyed patch、输入/浮层恢复继续作为内容区域的 patch 能力使用；不让它生成 Story 左栏或全套 Chrome。World 更新目标后同时让实例条、摘要和必要属性反映真实 Manager presentation，不留独立 innerHTML 路径漏更新。

## 3. 事件和挂载所有权

审查 UIController.bindEditorWorkbench()、StoryEditorController.bindWorkspace()/configureFrame()/bindExplorerColumn()/bind()、World 绑定及 WorkspaceColumns.adopt/mount/update。将 mode/view/exit、work-type、activate/close/duplicate、显式 locate 和公共 resource-open 的事件入口各自收口。业务命令仍由当前 Provider 解释，不能靠事件传播恰好屏蔽第二次写入。

同一个 Story Explorer 在 Story 活动、World 活动、空 Workbench 三种情况下使用同一 bindColumn；来源下拉、查询、筛选、目录管理等事件不因中栏类型不同而失效。Story 文档正文绑定不得接管 Explorer 通用事件。每个事件只发出一次语义动作，避免根监听与栏目监听重复消费。保留领域动作所需的业务委托。

栏位 slot/key 保持 editor-workbench 下的稳定身份，bindingKey/definitionId 表达实际绑定契约；改变 Provider 时释放旧监听和 scrollbar 资源，普通数据更新不重新绑定。处理器读取实时对象，不能捕获陈旧 active record、source 或 layout。验证被替换节点的 cleanup；不可通过每次改变 bindingKey 规避 stale closure。

## 4. 区分激活、打开、定位及失败恢复

沿用 editor-resource-request.ts 已有 EditorResourceRef / EditorResourceOpenRequest，origin 已区分 explorer-placement、instance-link、external、development。不要另造同义请求。核对 parser 将空 sourceKey 转为 undefined 的行为是否丢失显式 runtime 语义；在 Provider 归一化并保证资源身份与来源一致。请求必须按资源 provider 选择目标，不按当前 Explorer 类型猜测。

- activate：保存必要状态、执行门禁、准备目标、恢复并提交活动 ID；不改 Explorer source/query/filter/placement/reveal/focus/scroll。
- open：根据明确资源请求准备/复用实例，来自目录时保存实际 placement；不追加自动 locate。失败时是否保留用户新点击的目录选择应保持明确且一致，不能污染活动实例；本轮建议失败恢复原选择，若保留用户点击则明确不标成已成功打开。
- locate：仅显式定位改变 Explorer 类型、临时显露、祖先及焦点，保留基础条件；不附带创建实例。

检查 Story.restoreBrowseInstance、requestBrowseDirectoryReveal、openBrowseTarget、World commitWorldTarget 与 Manager 准备回调。prepare 阶段不得销毁原有效内容；若目标准备/恢复部分失败，需要补偿实际业务状态、临时场景和栏位，而不只是回写 activeId。合法完成的持久化保存不撤销。序列化互斥导航或使用明确 busy 策略，复用现有机制。

外部 route 仍可兼容 story-editor/world-editor，但只能表达外部进入或派生内部状态，不成为第二活动业务权威。真实退出恢复原游戏位置与主题；内部切换不执行整个退出。Classic 已有单文档策略保留，不将 Advanced 行为强制套用。

## 5. 局部更新迁移

复用 UIUpdateDispatcher / WorkspaceColumns。将 Explorer、Content、Inspector、Instance Strip、Ribbon、Layout 等受影响范围映射到现有更新机制，避免第二调度器。Story 正文变化不刷无关 Explorer；资源名称变化可刷新目录但须消费当前来源/查询。左栏滚动归实际挂载的 Explorer，中右栏滚动归实例。隐藏栏位不以零值覆盖记录。公共 Chrome 更新不能改变业务输入节点身份。

## 验收与检查点

CP1（必需调查证据，不是交付终点）：九项失败逐项归因，保留实际测试名、断言、调用入口、保护行为和处理结论。调查完成后必须继续施工。

CP2（0421 的核心完成条件，不可跳过）：公共 Workbench 组合入口、事件绑定和栏位行为身份实际迁移；Story/World 的重复公共分支及已迁移旧入口退出。仅报告失败原因、保留旧绑定或把问题推给后续任务，均不算通过。

CP3：activate/open/locate、失败恢复和局部更新通过定向集成测试；记录尚未迁移的目录特殊模式及其唯一退出任务 Task 0424。

至少测试：Story 活动→World Explorer→编辑 Story 节点后实际左栏、rail 和业务内容一致；World 活动→Story Explorer→改来源查询→更新 World 后控件仍可用；切换三次 Explorer 后每次事件只执行一次；保存/目标准备失败后原内容可操作；正常/空 Workbench 左栏挂载一致；合法外部退出恢复返回位置；无关栏位 node identity 保持。运行现有失败相关 suites，报告新结果与未验证的浏览器项目。

本 Task 不要求提前完成 World 搜索或目录实例化；不得为满足其验收而留下长期双写或新增平行服务。完成后进入 Task 02。
## Task 0421 交付检查点

状态：已完成。CP1 是调查证据且已完成；CP2 Host、公共事件入口与栏位投影迁移是不可跳过的交付条件，已完成。CP3 关键导航、失败恢复及局部更新定向验证通过。没有推进后续 0423。

### 初始九项失败归因与处理

| 失败用例 | 保护的行为 | 归因与处理 |
| --- | --- | --- |
| World Explorer 切换与大厅显式返回 | 工作类型切换不等于活动实例切换；显式退出恢复大厅 | 旧 World 私有监听与公共 Host 同时承担布局/定位职责，迁移至 Host，并以 Manager 活动 Provider 判定当前业务；修复后通过。 |
| Story/Entry 历史共享且保存 Story 工作 | 共享实例历史不丢草稿内容 | Host 拦截公共资源打开后，Story 原处理器的尾部刷新不再执行；打开当前 Story 时显式 requestRefresh/flush，修复后通过。 |
| 激活既有搜索结果后保留高级搜索与折叠 | 活动实例与 Explorer 查询、展开状态独立 | Host 打开流程需按资源请求激活实例、保持 Explorer 状态并刷新实际 Story 投影；修复后通过。 |
| Classic/Advanced 布局切换时保留挂载编辑器和停放实例 | 框架模式变化不销毁业务会话 | 旧 route 门控与实例 Manager 状态不一致；改用活动 Manager Provider 作为业务身份，route 仅镜像外部进入状态；修复后通过。 |
| 节点插入及当前 Ribbon 场景命令 | 业务命令作用于活动 Story，公共 Ribbon 与内容一致 | 同属 Host 介入后的活动实例/刷新路径问题；由 Manager 活动 Provider 和统一命令入口处理，修复后通过。 |
| Entry 标志信息及源节点定位 | Entry 身份、子名称与源 Story 导航保持正确 | 公共打开/定位入口分散导致业务处理被跳过；迁移为 Host 派发并保留 Story 领域委托，修复后通过。 |
| 删除本地草稿并重新打开未变来源 | 删除仅作用于草稿，来源内容可恢复 | 活动身份仍由旧 route 分支判断；移除重复判断并基于 Manager Provider 刷新，修复后通过。 |
| Runtime 按显式按钮替换 StoryDef | 草稿保存与 Runtime 发布门禁不混淆 | 切换/刷新后的公共命令未稳定对应活动 Story；由 Host 绑定实时读取 Manager 活动 Provider，业务发布逻辑仍留在 Story，修复后通过。 |
| 第二 Choice 保存、显式 Registry 发布与重新加载 | 多 Choice 数据与显式发布语义完整 | 与 Story 活动状态/刷新路径相同；修复后通过，原有业务门禁与数据流程未降级。 |

以上失败不是需长期保留的过时测试合同或已知基线；均为本轮 Host 接线导致的真实回归，修复后没有降低断言。另在最终复跑中发现并修复 World 显式定位边缘情况：从中栏链接切换实体后，Explorer 仍选中旧 placement；显式定位现在在旧 placement 不匹配时回退到目标实际路径，并使用统一 `setEditorWorkspaceView()` 更新可见外壳。

### 实际迁移

- `UIController.bindEditorWorkbench()` 是公共 mode/view/exit、工作类型、实例生命周期、duplicate/locate 和资源打开事件的组合入口；移除 `bindWorldBrowser()` 及其 World 私有 AbortController 和重复点击监听。
- `EditorWorkbench.project()` 禁止正常业务实例长期提供左 Explorer；Story 试播以显式 `story-preview` 临时左栏覆盖接入，并由临时视图约束其范围。
- Story 通过 Host 处理资源请求、复制与显式定位；`StoryEditorController.isOpen()` 与 UIController 的实例判断读取 Workbench/Manager 活动 Provider，不以 route 作为第二权威。
- World 实体资源请求校验 provider/kind/id/resourceKey；活动 World 内的关系链接仅局部更新目标摘要和公共状态，不替换 Explorer 树 DOM。显式定位再切换 Explorer 并显露目标。
- `editorResourceOpenRequest()` 区分缺省 source hint 与显式空 runtime source；Story Provider 核对来源投影和资源身份后再打开。
- Story 内容 DOM patch 增加相同外壳时跳过无变化 patch，维持输入及栏目节点身份。
- 激活 Story 实例的恢复现在返回补偿闭包；公共 Manager 提交失败时恢复 Story 内容/草稿和路由镜像。已经合法完成的持久化保存不回滚。

### 验证与边界

- `npm test -- tests/ui/runtime-editor/runtime-editor-world-browser.test.ts tests/ui/story/story-editor-workspace.test.ts tests/ui/story/story-editor-workspace-session.test.ts tests/ui/workspace/workspace-columns.test.ts tests/ui/workspace/editor-workbench.test.ts`：5 suites / 96 tests 全部通过。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（144 Markdown / 0 errors）、`git diff --check` 均通过。测试日志位于忽略的 `.test-artifacts/latest.log` 与 `latest-summary.json`。
- 按用户要求跳过真实浏览器验收；World/Story 混合编辑、焦点与 caret、悬浮滚动条等视觉行为留给人工验收。没有提交或推送。
- 工作区保留原有用户改动，包括 `ai/plan/ui-visual-follow-ups.md` 删除；测试未写入或追踪。
- 恢复下一步：从 Task 0423 开始，先读取 Task 0386、当前活动 Task、0421 本交付检查点及当前工作区差异；0423 只提取目录工作状态，不提前要求 0424 完成实例化。
