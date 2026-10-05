# Task 0234：Gameplay B Operation 原型式真卡牌面与牌层交互

状态：in progress — U0 检查入口与 U1/U2 真牌面实施及独立严格审查已完成；U3 的 Edge 实际验收和最终 GALHCG 写后核验仍未闭环。

## 目标

把 Gameplay B Operation 中的战斗预备行动、场景行动与玩家场景牌呈现为原 Demo 可辨认的独立牌面及牌层交互。玩家操作的对象应是一张有稳定牌面、尺寸比例、内容层级和位置关系的牌，不是把一组按钮放进带边框、圆角的前端容器。

视觉和交互参照原 Demo 的 prepared action cards：牌面贴近其所属角色或场地，显示标题、效果说明和费用；按卡牌比例缩放、错位叠放、轻微倾斜；聚焦、悬停或拖拽时提升层级并展示合法目标关系。此 Task 将这套牌面语言延伸到当前 AC Operation 的 Individual / Global 行动和每个实体的玩家 SceneCard 手牌，同时保留 Task-0232 已实现的 OperationView、暂存、确认、结算及中心结果流语义。

独立完成定义：卡牌本身成为主要可见、可聚焦和可操作对象；角色、场地与手牌之间的拥有关系可从牌层直接读出；目标操作能沿用合法候选与现有 Runtime 命令；在常规及窄窗口中仍能辨认牌面，不退化成大面积按钮墙。

## 设计边界

- 本 Task 包含：当前战斗行动 / Intent / 技能预备牌、Individual 学生场景行动牌、Global 全队场景行动牌、逐实体玩家 SceneCard；它们在 Operation 内使用统一但可区分类型的牌面结构。
- 增加一个开发态专用的便捷检查入口，以正式样例和 Runtime/View 建立可重复的牌面验收场景；仅显式开发参数启用，不进入普通玩法流，不持久化试玩状态。该入口与现有 Quick Test Console 分离，不修改其源文件、测试、注册表或内容。
- 交互主路径仿照 Demo：当前牌直接附着在所属人物卡或场地牌层；点击、键盘激活和拖拽可编辑合法行动/目标；拖拽过程可显示合法人物高亮及临时关系线。操作仅更新当前 UI 草稿，仍由既有整批暂存 / Commit 命令写入 Run。
- 必须区分 Demo 原有范围：Demo 的战斗 prepared action card 是独立叠放牌面；其非战斗玩家 SceneCard 选择本来是行式控件。本 Task 按用户要求，将当前 AC 的玩家手牌也扩展为真实牌面，不宣称这是对 Demo 场景选择旧 UI 的逐像素复刻。
- 牌面视觉优先使用 Demo 的文字层级和 CSS 表现；Demo 牌面本身不依赖插画。本 Task 不新增卡牌图片、Datapack 字段、Operation 规则、PlayerState / SaveData 状态或通用卡牌引擎。
- 路线摘要、Cost Dock、中心结算流继续承担 Task-0232 规定的信息职责；不得把所有面板一概改成“卡片 UI”。
- Task-0232 的实现作为基线；本 Task 有意把该 Task 的通用卡牌系统、拖拽和 SVG 关系线非目标，限定性地重新纳入上述 Operation 牌层。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 原 Demo 的战斗预备牌是独立牌面节点，附着到角色对应的 prepared-card-layer；牌面含标题、说明、费用。 | prototypes/gameplay-b/src/view.ts:2447–2470；prototypes/gameplay-b/src/style.css:166–180。 | 用作牌面和牌层的直接视觉 / 结构参照，不把外层身份卡误作行动牌。 |
| Demo 牌面约为 112×62 横向比例，支持类型色边、轻微旋转、错位层叠、hover/focus 提层及关系线；拖动合法行动牌可指向人物目标。 | prototypes/gameplay-b/src/style.css:166–180；prototypes/gameplay-b/src/view.ts:1852–1972、2170–2299；Draft-0231 原型行为记录 B2/B3。 | 适配窄窗口时可整体缩放或横向滚动，但必须保留独立牌面轮廓和人与牌的关系。 |
| Demo 的非战斗手牌选择是 scene-card-row、按钮及目标 select，不是战斗预备牌面。 | prototypes/gameplay-b/src/view.ts:1625–1733；prototypes/gameplay-b/src/style.css:235–246；原型行为记录 A3/A4。 | 本 Task 明确要求把当前 AC 手牌升级为独立牌面，不能以“原 Demo 本来也用按钮”规避用户要求。 |
| Task-0232 的 AC 战斗行动摘要和候选项仍由人物身份卡内的文本、折叠区及按钮表达；SceneAction 为 section 外壳加行动按钮；手牌 article 内含加入、执行者和目标按钮。 | src/ui/components/operation-workspace.ts:71–116、132–160、180–222；src/ui/css/operation-workspace.css:255–319、407–437。 | 目前属于人物卡归属与控件容器化，不是 Demo 的独立叠放牌面；本 Task 专门补这段差距。 |
| OperationView 已投影人物行动、玩家卡实例、合法执行者和逐执行者合法目标；读面 detached，Runtime 有现成批次草稿与校验命令。 | src/arona-clicker/contracts/operation-view.ts: OperationView / OperationViewSceneCard；src/arona-clicker/services/operation-view-projector.ts: projectSceneActions / projectPlayerCards；tests/ui/gameplay-b-operation-controller.test.ts。 | 牌面消费现有候选和命令，不反向读取 Runtime / Registry，不扩规则或状态合同。 |
| Task-0232 的 region morph 已为场景卡、手牌、角色、路线和 Dock 添加稳定 key；本地选择通过 behavior 更新，成功命令经单一 Operation region 收敛。 | src/ui/controller.ts: operationMorphKey / refreshOperationWorkspaceRegion；src/ui/controller-actions-operation.ts；docs/docs-829/06-wiki/50-ui/refresh-update.md。 | 牌层需要稳定 cardInstanceId / actorId 身份，交互需保留滚动、焦点与未变化节点。 |
| src/ui/main.ts 只在显式 DEV 查询参数下动态挂载本地试玩控制台；现有 console 源码与测试有并行未提交的 Task-0233 改动。 | src/ui/main.ts: gameplayBQuickTestConsoleEnabled；src/ui/development/gameplay-b-quick-test-console.ts；tests/ui/gameplay-b-quick-test-console.test.ts。 | 新检查入口用独立 query 参数和独立模块，不改现有 console 及 Task-0233 路径。 |

## 施工切片

### U0：开发态真牌面检查入口

**Goal**：建立一条可重复进入正式 Gameplay B 样例的本地检查路径，让视觉与交互实现可以通过实际 Operation Surface 验收。

**Read Set**：本 Task；[[docs/ai/context-packs/ui-presentation]]；src/ui/main.ts: boot / gameplayBQuickTestConsoleEnabled；src/ui/controller-actions-operation.ts: startSample；正式 Gameplay B Datapack 与 Operation 固定阵容准入；tests/ui/gameplay-b-operation-controller.test.ts 的真实事件流准备方式。

**Constraints**：只在 import.meta.env.DEV 且显式 query 参数匹配时挂载；必须使用正式 Run、OperationView 与既有事件内容。样例数据只存在于当前进程内存，刷新后清除；不能写 SaveData、修改默认 Datapack、Registry 或生产入口。检查工具独立于现有 Quick Test Console。

**Allowed Files**：

- src/ui/main.ts
- src/ui/development/gameplay-b-card-inspector.ts（新增）
- tests/ui/gameplay-b-card-inspector.test.ts（新增）
- docs/plan-work/task-0234-gameplay-b-demo-card-surface.md（Receipt）

**Completion Criteria**：

- [x] 仅显式开发 query 参数显示“卡牌检查”入口；未设置参数或生产构建不挂载任何检查入口。
- [x] 一次操作可用固定 Gameplay B 样例建立正式 Operation Run 并打开真实 Operation Surface，提供 battle、Individual/Global、手牌及目标牌面检查路径；不靠伪造 OperationView。
- [x] 必要的试玩阵容仅存在于独立临时 Runtime；退出 / 刷新后丢弃，不覆盖主 Runtime、既有 roster 或用户存档。
- [x] 不改 src/ui/development/gameplay-b-quick-test-console.ts、src/ui/css/gameplay-b-quick-test-console.css、tests/ui/gameplay-b-quick-test-console.test.ts、src/data-services/registry/registry.ts。

**Verification**：`npx vitest run tests/ui/gameplay-b-card-inspector.test.ts` 3/3 通过；`npx tsc --noEmit` 与 `git diff --check` 通过。测试覆盖 DEV/query gate、正式 Run / Operation Surface、战斗与 Individual/Global/手牌目标路径、独立 Runtime 销毁，以及主页面真实保存命令不改变预存 SaveData。随后作为 U1/U2 的浏览器检查入口。

**Stop Conditions**：若启动试玩必须改动现有 Quick Test Console、写入存档或增加 Runtime API，先交回 Task Owner，不扩散入口范围。

### U1：独立牌面与真实牌层

**Goal**：把当前战斗、Individual / Global SceneAction 和玩家手牌的主要操作对象改为独立牌面；每张牌有自己的稳定身份、牌面内容和拥有者 / 区域。

**Read Set**：本 Task；[[task-0232]]；[[draft-0231-gameplay-b-original-demo-activity-and-battle-round]]；[[docs/ai/context-packs/ui-presentation]]；[[docs/ai/frontend-design-project-overlay]]；目标 component、CSS 与两份 UI 定向测试；原 Demo 仅读 prototypes/gameplay-b/src/view.ts 与 style.css 的上述源码索引。

**DOM budget**：每个当前行动 / Intent 一张常驻牌；替代行动仅在按需打开的卡牌选择层中渲染；每个当前手牌实例一张牌面；关系 SVG 只在 hover/focus/drag 所需范围绘制。复用 Operation Workspace 和角色节点，不重建整页。Receipt：新增稳定牌面节点数随当前 OperationView 中已投影的可见行动、Intent 和实体 `cardInstanceId` 一对一增长；替代牌仅随选择层展开挂载。牌面及替代层在现有 Operation region 内，点击/键盘选择与目标编辑走当前 Surface 行为，候选结构变化和既有 Runtime 命令才触发单次 Operation region 更新；不新增 Workspace / 人物身份卡重建。

**Allowed Files**：

- src/ui/components/operation-workspace.ts
- src/ui/css/operation-workspace.css
- tests/ui/operation-workspace-view.test.ts
- docs/plan-work/task-0234-gameplay-b-demo-card-surface.md（Receipt）

**Completion Criteria**：

- [x] 学生行动和敌方 Intent 的当前牌面是独立节点，直接贴近所属角色卡；Global 行动牌有明确的共享场地区域；玩家手牌每个物理 cardInstanceId 各是一张真实牌面。
- [x] 牌面以标题、效果 / 目标摘要、费用及选择 / 禁用状态构成可辨认的正面；参考 Demo 的横向比例、色边与错位叠层，响应式缩放不得压扁成普通列表行。
- [x] 当前行动的替代项即使按需展开，也以独立牌面呈现；不能用一列文字按钮冒充牌组。
- [x] 选择元素本身是牌面，不以带圆角的 section/article 包裹“加入”按钮、执行者按钮墙和目标按钮墙冒充完成。
- [x] 牌面内容全部来自当前 OperationView / 已有展示映射；无效或缺失候选不虚构牌面或效果。

**Verification**：`npx vitest run tests/ui/operation-workspace-view.test.ts` 与 `npx tsc --noEmit` 通过；独立严格审查第三轮签署通过，无 P0/P1/P2。

**Stop Conditions**：如牌面需要新的领域字段、跨 Run 状态、Datapack 配置或超出此 Operation 范围的通用卡牌模型，停止并交回 Task Owner 裁定。

### U2：牌与人物目标的关系交互

**Goal**：使牌面到合法目标的操作遵循 Demo 的牌 → 目标关系，而不是持久显示大量目标按钮。

**Read Set**：本 Task；Task-0232 中 SceneCard View 候选与批次草稿事实；src/ui/controller-actions-operation.ts: readSceneBatchCommand / handleOperationClick；src/ui/controller.ts: operationMorphKey / refreshOperationWorkspaceRegion；tests/ui/gameplay-b-operation-controller.test.ts；原 Demo B3 交互源码。

**Allowed Files**：

- src/ui/components/operation-workspace.ts
- src/ui/controller-actions-operation.ts
- src/ui/controller.ts
- src/ui/css/operation-workspace.css
- tests/ui/gameplay-b-operation-controller.test.ts
- docs/plan-work/task-0234-gameplay-b-demo-card-surface.md（Receipt）

**Completion Criteria**：

- [x] 指向某人的单目标操作可以从牌面拖到合法人物；拖拽时仅高亮 View 允许的目标并显示临时关系线，放下后牌面明确显示目标关系。
- [x] 多目标 / 固定目标仍沿用当前 planner 许可与批次语义；必要时显示局部确认层，但不能退回常驻 select 或候选按钮墙。
- [x] 拖拽阈值、取消、失焦和 Escape 行为明确；非法目标不更新草稿，合法投放只更新本地草稿，不写 Run、不查询新 View。只有现有暂存 / Commit 操作进入 Runtime 命令。
- [x] 键盘和触屏可通过牌面激活、聚焦目标或等价的简洁可访问交互完成同一决策；拖拽不得成为唯一通路。
- [x] 费用预览、选中、失败保留选择及 Runtime 拒绝提示保持 Task-0232 已验收语义。

**Verification**：`npx vitest run tests/ui/gameplay-b-operation-controller.test.ts` 与 `npx tsc --noEmit` 通过；controller 定向测试走真实命令链验证投影目标、结算结果与拖拽草稿隔离。独立严格审查第三轮签署通过，无 P0/P1/P2。

**Stop Conditions**：若现有 OperationView 目标合同无法表达所需关系，停止并回报具体字段缺口；本 Unit 不自行增加 DTO / Runtime 合同。

### U3：交互连续性、浏览器验收与文档

**Goal**：证明真牌面在常规和较窄窗口保持清晰；牌面更新不破坏人物身份卡、中心记录流、Dock、焦点或阅读位置；将稳定实现更新到当前 UI 刷新文档。

**Read Set**：本 Task；[[docs/docs-829/06-wiki/50-ui/refresh-update]]；[[docs/docs-829/05-conventions/doc-maintenance]]；U1/U2 component、controller、CSS 与测试。

**Allowed Files**：

- src/ui/controller.ts
- src/ui/css/operation-workspace.css
- tests/ui/gameplay-b-operation-controller.test.ts
- docs/docs-829/06-wiki/50-ui/refresh-update.md
- docs/plan-work/task-0234-gameplay-b-demo-card-surface.md（Receipt）

**Completion Criteria**：

- [ ] hover / focus / 普通卡牌选择走 behavior 更新；投放导致候选集合变化时最多一次 Operation region 收敛；无全 Workspace render。
- [ ] Workspace frame、人物身份卡、未变化牌、中心记录流、Dock 和日志阅读位置按既有连续性预算保持 identity / position；错误或取消后焦点回到牌面或明确状态提示。
- [ ] Edge 实际展示 Individual、Global 和至少一种可拖拽的目标场景；记录常规与窄窗口截图。必须看出牌面本身、归属人物/场地、层级与目标关系；若只看到有边框的控件组，即不通过。
- [ ] 现场以键盘完成牌选择、展开候选、选择目标、取消和提交；无断开锚点、焦点丢失、遮挡牌面或正文裁切。
- [ ] 刷新与 UI 文档只写已稳定事实；Task Receipt 记录截图 / 浏览器、定向测试和 GALHCG 写后状态。

**Verification**：两份 UI 定向测试、npx tsc --noEmit、npm run check:docs、git --no-pager diff --check；Edge 实测。Edge 不可用时如实记录并保持 Task 未完成，不用 happy-dom 或 IAB 替代规定的 Edge 证据。

## 总体验收

- [ ] 卡牌是独立视觉与操作对象；仅增加 panel 边框、圆角、阴影或把按钮包在 article 内不能通过验收。
- [ ] 主要 Operation 行为和每张玩家 SceneCard 都使用牌面形态；牌面之间的角色 / 场地归属与目标关系一眼可读。
- [ ] 宽 / 窄窗口下牌面仍保持比例、层次及可读性；候选不退化为大量按钮或下拉表单。
- [ ] 点击 / 键盘 / 拖拽在投影合法范围内完成操作；既有费用、批次提交、结算、撤销和拒绝语义不变。
- [ ] View 读取保持只读；局部选择不触发 View 查询或 Run 写入；刷新、焦点、滚动与节点 identity 符合 UI overlay。
- [ ] GALHCG 对本 Task 与 index 的路径审查 / Evidence / maps_to 已闭环；浏览器截图、验证命令和实际结果写入 Receipt。
- [ ] 开发态检查入口可重复进入正式样例，并在退出 / 刷新后不残留持久化试玩状态。

## 当前核验（2026-10-05）

- 只读对照原 Demo 和 Task-0232 当前代码。原 Demo 战斗牌面为 112×62 独立节点、角色锚定层、叠放旋转与拖拽关系；Task-0232 已提交 UI 则仍以摘要、折叠区和按钮控件实现对应 Operation 行为。
- 原 Demo 的非战斗场景玩家牌选择本身也是行式控件；本 Task 的 SceneCard 真牌面要求是用户新增的设计裁定，不归称为原 Demo 已有 UI。
- Task-0232 的 U0–U3 代码、机制文档和 GALHCG 已提交；它仍等待 Edge 与现场键盘验收。本 Task 只在现有实现上重塑表现和交互，不代表 Task-0232 已整体完成。
- U0 开发检查入口已完成：`?gameplayBCardInspector=1` + DEV gate 挂载独立临时 Runtime；通过正式 OperationEntry 与 OperationView 渲染样例。主存档预存后再经主页面保存按钮，导出内容完全一致；关闭检查后临时 Runtime 被销毁。定向测试 3/3、类型检查和 diff check 通过。
- U1/U2 已完成并经独立严格审查第三轮签署通过。牌面选择器、目标编辑、Stage 草稿读取和 region rebuild 恢复状态均按同一 OperationView / 本地草稿边界实施；取消拖拽与失焦不会写 Run。独立复跑 U1/U2 两套测试 16/16 通过；合并定向套件（含 U0）19/19、`npx tsc --noEmit` 与 `git diff --check` 通过。
- U3 已更新当前 UI 刷新文档。用本地样例在 Codex IAB 补充查看了桌面与 390px 窄视口下的战斗、个人、全队和手牌牌面，并补充键盘激活观察；这些仅作视觉 / 操作补充，不替代本 Unit 要求的 Edge 证据。Edge 浏览器扩展两次都返回 `nodeRepl.fetch request failed`，没有打开标签，因此没有 Edge 截图或现场键盘流程证据；按本 Task 验收约定，U3 和总体验收保持未完成。代码 / Receipt 稳定后，由 GALHCG Agent 对最终变更路径执行映射更新及写后核验。
- Task-0232 的当前证据仍只证明卡片容器/控件交互，不作为 U0 开发入口或原型式牌面的完成证据。

## GALHCG 影响闭环

- 首次解析项目路径为 ACProgram，root_path 与 workspace_path 一致；overview 按 next_cursor 读完整三页。lookup 命中 UI Workspace Renderer、Operation EventRun Runtime 与准确名称 Goal 与 Task 工作流；字面查询 Goal workflow 零命中后改用图中准确名称复查成功。
- 新 Task 文件经 docs/plan-work 限定 refresh 后 indexed；docs/plan-work/00-index.md 原有 Evidence 写前 review 为 content_changed，完整返回 4 owners。两条路径均已 resolve、preview；无新 Concept。
- 地图维护：完整更新项目规划 Module 的 4 条 Evidence、Project→planning-records contains Evidence 及 Goal 与 Task 工作流→index / 新 Task 两条 documentation maps_to。节点批 4 refs 与边批 3 refs 均经 plan、valid dry-run 后提交；新 Task File 仅映射到 Goal-workflow documentation，未扩张为 UI 实现事实。
- 写后核验：Task 与 index 的 review 均 unchanged、stale=0；Task path 精确搜索命中；Goal→Task traversal 达到目标且分页完整；Goal-workflow 在 docs/plan-work 的 documentation inventory 完整返回 8 个关联文件。Task File owner Evidence 已按本 Receipt 最终文本刷新，写后 review 为 unchanged / stale=0。

## 剩余工作

- Task-0232 尚待 Edge 实际流程与现场键盘验收；此状态不改变 Task-0234 的设计结论。
- 本 Task 内：Edge 常规 / 窄窗口截图与现场键盘验收、最终 GALHCG 映射及写后核验。

## 相关路由

[[task-0232]] · [[draft-0231-b]] · [[draft-0231-gameplay-b-original-demo-activity-and-battle-round]] · [[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/galhcg-project-map]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/ai/frontend-design-project-overlay]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]]
