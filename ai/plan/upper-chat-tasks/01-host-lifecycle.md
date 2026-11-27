# Task 01（现有 0421）：公共 Host、生命周期及更新入口收敛

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

CP1：九项失败逐项归因，保留实际测试名和处理结论。CP2：组合入口及绑定实际迁移，旧分支退出。CP3：激活/open/locate 和局部更新通过定向集成测试。记录尚未迁移的目录特殊模式及退出 Task 03。

至少测试：Story 活动→World Explorer→编辑 Story 节点后实际左栏、rail 和业务内容一致；World 活动→Story Explorer→改来源查询→更新 World 后控件仍可用；切换三次 Explorer 后每次事件只执行一次；保存/目标准备失败后原内容可操作；正常/空 Workbench 左栏挂载一致；合法外部退出恢复返回位置；无关栏位 node identity 保持。运行现有失败相关 suites，报告新结果与未验证的浏览器项目。

本 Task 不要求提前完成 World 搜索或目录实例化；不得为满足其验收而留下长期双写或新增平行服务。完成后进入 Task 02。
