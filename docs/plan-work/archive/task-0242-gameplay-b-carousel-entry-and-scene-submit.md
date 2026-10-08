# Task 0242：Gameplay B 旋转木马战斗入口与现场行动提交

状态：completed — 已修复 Runtime / OperationView 手牌解析不一致，核实正式战斗拓扑，并将常规现场行动改为单次确认提交。

## 目标

修正试玩者对旋转木马安全行动流程的误解：正式关卡应从安全战斗开始，战斗后才进入员工 / 游客通道；现场行动不应要求先暂存再确认两次。

## 本轮范围

1. 核实 `gameplay-b@1.0.0` 正式 Datapack 包含旋转木马安全战斗，且 `platform` 是初始地点、战斗行动与唯一旋转木马目标有效，战斗后拓扑连到通道，再连到出口。
2. （后由 [[archive/task-0243-gameplay-b-carousel-action-replacement-and-reentry]] 撤销）从通道增加一条受地点访问上限约束的返回设备区路线；复核发现它会重开同一单拍遭遇且不重置 Run 状态。
3. 现场行动保留批量预览、费用校验和原子结算，但由一次明确的“确认现场行动”完成，不再常规经历“暂存方案 → 确认行动”。已有待确认批次仍须能安全提交或返回修改。
4. 不新增战斗遭遇、行动效果或通用 Engine 规则；只增加返回现有战斗节点的有限路线。测试仅在证明入口 / 拓扑与提交行为所需范围内增加。

## 验收

- 从正式试玩入口开始后，当前地点为旋转木马平台，首幕包含星野压住制动杆、芹香发送节奏信号、白子护住设备外框等对应行动；三者合法目标均为旋转木马。
- 完成平台战斗后可到通道，调查并取得员工证后员工通道可用；游客通道仍可用；两路都到出口且可以完成结算。
- 玩家能辨认当前处于“安全战斗”还是“现场行动 / 路线选择”；误将员工 / 游客通道当作战斗入口的问题消失。
- 通道行动完成后可通过安全路线前往出口。返回战斗路线的历史验收由 Task 0243 撤销，正式样例现维持一次安全遭遇。
- 通道与出口的常规现场行动一次确认即提交整批，费用仍统一扣除且校验 / 效果仍保持原子性；确认失败时已选草案仍可修订。
- 定向 Engine / UI 回归验证通过；记录试玩启动失败是否可复现及实际原因。不得声称做过浏览器验收。

## 文本-潜在解决方案

- 正式关卡拓扑优先在 `gameplayBCarouselDatapack` 的实际注册内容与 Runtime `OperationView` 上验证，不以独立 resolver 测试夹具代替正式包。
- 平台仍是唯一战斗节点；通道返回边复用同一组安全行动和目标，不复制或伪造第二种战斗。
- 现场行动使用既有 `commitSceneActionBatch` 原子提交入口，保留本地草案与费用预览；Runtime staged batch 的既有能力继续供恢复中的待确认状态使用。

## 实施记录

- 正式包 `gameplay-b@1.0.0` 从旋转木马平台开始；平台三张学生目标行动都只指向旋转木马。Task 0242 当时曾增加有限回返边；后续复核见 Task 0243，现已移除，避免无重置定义的伪第二遭遇。
- 找到此前“试玩未能开始”的实际 Runtime/UI 错误：Run 的 `PreparedBeat` 按该 Run 的 Character Hand 准备，但 `getView()` 使用原始 Profile 候选投影和预览，导致快照校验报错，UI 将渲染错误折叠成通用试玩启动失败。OperationView 现与 PreparedBeat 使用同一份 Run Character Hand。
- 办公室入口按钮改为“开始旋转木马安全战斗”；战斗面板标出安全战斗阶段，战斗结束后标出通道阶段和可选路线。
- 通道、出口现场行动保留批次费用预览与 Runtime 整批校验，但现在一次“确认现场行动”直接提交，不再进入常规的“暂存方案 → 确认行动”二次按钮流程。恢复中已有的待确认批次仍保留确认 / 返回修改路径；提交失败会保留操作草案。
- Character Hand 改造后，固定种子示例的默认路线现在达成成功结局；场景样例测试按当前确定性结果更新。通用 Engine PartialSuccess 行为仍由 Operation Runtime 测试覆盖。
- 定向验证：Operation Controller、正式 Carousel SceneAction、quick-test console、OperationView projector、SceneAction Runtime、Save/Resume 共 6 个测试文件、38 项通过；`npx tsc --noEmit` 通过；`npm run check:docs` 在修正一处既有歧义链接后通过；`git diff --check` 通过。未进行浏览器验收。
- GALHCG 闭环：用 `resolve_project` 绑定 `acprogram`，通过 `lookup` 定位 Operation EventRun Runtime / UI Workspace Renderer；回读正式 Datapack、Carousel 内容、Operation Runtime 与 UI Controller 源码和测试。`review_changes` 覆盖本 Task、索引、Runtime、UI、测试及受链接消歧影响的首读文档；所有直接 Evidence stale 数为 0，Runtime owner 分两页完整复核。新归档 Task 映射到现有 `Goal 与 Task 工作流`，共 4 个批次均 dry-run 有效并成功写入；随后精确 review 全部 unchanged。

## 相关路由

- [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]]
- [[task-0241-units/0241-u12-scene-action-admission-separation]]
- [[docs/docs-829/03-data-structures/operation-view]]

