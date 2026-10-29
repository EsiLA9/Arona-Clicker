# Task 0248：Gameplay B 场景牌激活、可跳过推进与目标连线

状态：completed

## 目标

让场景牌既能由现场直接激活，也能交给合格学生执行；批次只结算玩家实际选择的行动，不要求花完可用 Cost 或让每名学生都选牌。把卡牌连线从中心点到中心点改成按牌与目标所在方位选取出线点和入线点。

本 Task 覆盖 Operation SceneAction、PlayerSceneCard、场景批次校验/结算、Scene UI 交互与卡牌关系线；不改战斗 Beat 规则、世界地图路线 Gate、存档字段或独立 Datapack Editor UI。

## 现状核验与决策

1. SceneAction / PlayerSceneCard 目前只有 `selected-student` 与 `none` 两种 PerformerPolicy。前者要求学生执行；后者禁止学生执行，且 Actor Target 只能用绝对 Actor ID/type 过滤。
2. Global 批次必须恰好选择一个非 fixed SceneAction；Individual 批次必须为每名存活学生选一项。固定卡牌自动加入，不可撤销。
3. PlayerCost 结算已是上限校验（实际总费用不得超过余额），不是必须花完余额；需要补证据并让 UI 明确显示实际选取费用。
4. 每个地点的 SceneAction 批次数目前是必须消耗的额度，批次不能提交空选择；路线需等待批次用完或地点目标完成。
5. Operation 卡关系线目前从卡牌矩形中心连接到目标矩形中心，未按牌与目标的左右、上下位置挑边。

## 语义合同

### PerformerPolicy

- `selected-student`：只能由一名符合能力/存活条件的学生执行。
- `none`：只能由现场直接激活；Actor Target 必须是绝对 ID/type 限定，不可依赖执行者的 self/team 关系。
- `optional-student`：场景牌可直接激活，也可交给一名合格学生执行。无执行者分支仅允许无目标 Action，或能够由绝对 Actor ID/type 定义的目标；需要执行者才能计算的资源费用、自身效果和 team-relative target 必须走学生分支。Registry、Runtime、View、UI 与 schema 同步验证这一约束。

### 选择、Cost 与推进

- `selectionPolicy: fixed` 继续表示自动加入、无法取消；`required` 表示玩家主动选择的牌型，不再表示每个批次/每名学生都必须选一张。
- Global 批次可选零或一项非 fixed SceneAction；Individual 批次每名存活学生可各选零或一项非 fixed SceneAction。固定项照常由 Runtime 自动补齐。玩家手牌只结算实际加入的 required 卡牌。
- 空批次是显式“跳过本批”。提交一次空批次消耗一个批次机会但不扣 PlayerCost、不移牌、不结算非 fixed Action；剩余批次可继续操作或逐批跳过。有限批次数仍是当前地点完成条件之一，不能用跳过绕开 Objective、Route Gate 或结果条件。
- PlayerCost 是上限：选中行动的费用总额 `<= balance` 即可提交；未用余额保留。确认按钮显示“本批支付 N Cost”，空批次显示“跳过本批”。不足余额时明确列出差额和需调整的选择。

## 连线端口规则

用现有 overlay SVG path 表现关系，不新增装饰 DOM。每次 drag、hover 或 focus 按当前 getBoundingClientRect 计算连接端口：

- 目标在卡右侧：卡牌右边中点出线，目标左边中点入线；目标在卡左侧则反向。
- 水平方向差小于垂直方向差时，上下边替代左右边：目标在下方时卡牌下边出线、目标上边入线，反之亦然。
- 这套规则同时适用左侧学生牌→中间/右侧目标、中间 SceneAction→左/右目标、右侧对手牌→左/中目标，以及同方目标；不得写死“始终朝右”。
- 卡牌被目标卡片包围/矩形重叠时，选择目标边界上离卡牌中心最近的一边，并从卡牌面向该边的一侧出线；端口重算只更新既有 SVG path 的 `d` 与诊断属性。
- Hover、focus、拖动继续共用同一端口算法和合法目标合同；无目标或非法目标隐藏关系线。

## 施工单元

### U0 — 现状与任务设计（完成）

- 核对 Operation Runtime、Registry/Schema、OperationView、Renderer、Controller、关系线绘制与样例/测试。
- 选择 `optional-student`、可跳过空批次、部分选择、Cost 上限与几何择边算法合同；无额外 Track 或 SaveData 字段。

### U1 — PerformerPolicy 扩展

- 更新 Datapack contract、runtime contract、validation、registry projection、OperationView 与 candidate projection。
- 更新 batch planner：optional-student 的 actorless 分支仅接受合法绝对目标/无目标；绑定学生时使用该学生的关系目标并校验 actor resource/effect。
- 更新 SceneAction / PlayerSceneCard 选择与按钮 tray；optional 卡 click 表示就地激活，拖到学生表示指定执行者；再次拖动只选合法目标。
- 更新 schema 生成文件只能通过 `npm run gen:schema`。

### U2 — 部分选择与跳过批次

- 放宽 Runtime planner 只要求最大选择数：Global 非 fixed 最多一项；Individual 每名学生最多一项；零项合法。Fixed 项照常自动插入，目标和费用仍严格校验。
- SceneDraft、Controller 与 UI 不再偷偷预选 required Action；普通卡单击选中/取消，`fixed` 不可取消。
- 加入明确的“跳过本批”控制，空批次通过现有原子 SceneAction commit 消耗一次批次；任何选中费用小于等于余额都能结算，剩余 Cost 不构成阻塞。
- 更新费用预览、错误文案与逐批跳过/Objective/Route/终局测试。

### U3 — 方向性连线

- 实现可独立测试的矩形择边/曲线几何；复用于场景卡、玩家卡与战斗牌合法目标预览。
- 为左→右、右→左、中→左/右、同方上下和矩形重叠编写测试；行为刷新只改既有 SVG path 属性。

### U4 — 样例验收与文档/GALHCG

- 更新旋转木马出口样例：出口的全队急救可就地激活或交给学生执行，且可跳过不必要的批次/牌；原成功路径仍可用。
- 使用确定性 Runtime 与 UI 测试验证 partial/no-action/actorless/optional-student、cost under-spend、fixed auto inclusion、合法目标和线锚点。
- 更新 OperationView / Runtime / UI 机制文档，运行定向测试、`npx tsc --noEmit`、`npm run gen:schema` 后 Schema 测试、`npm run check:docs`、`git diff --check`；维护所有改动路径的 GALHCG Evidence/maps_to。

## DOM 与交互预算

- 新增 wrapper：0；复用现有 SceneAction 牌、角色卡、操作 dock 与 SVG path。
- behavior patch：pointer/focus/hover 仅重算 SVG path；单项选择只更新牌面、选择摘要、费用预览和目标 tray。
- region 更新：提交批次后只更新 Operation workspace region；状态类别/批次/地点变化才结构性刷新。
- full render：不因 hover、focus、click、拖动或跳过动作触发。
- Focus：点击选牌保留焦点；提交/跳过后聚焦当前行动区的 dock 按钮或下一批主控件；Esc 关闭 tray。
- Hover：未受影响角色卡/地图与日志节点保持 identity；退出关系预览隐藏既有 path。

## 验收清单

- [x] `optional-student` 可由现场直接激活，也可拖到合格学生激活；target/cost/effect 依分支校验，不产生空 performer 资源支付。
- [x] 每批可选零项或部分项；fixed 项仍自动加入且不可撤销。
- [x] 跳过空批次只消耗一次批次额度，不扣费用/不消耗手牌/不伪造 Action Resolution；最后一批后的地点和 Event 结果按既有规则推进。
- [x] PlayerCost 余额大于实际选择费用时提交成功，余额保留；超过余额时提交原子失败且 UI 指明费用差。
- [x] 旋转木马出口可在无学生 performer 情况下使用就地行动、也可交由学生；不选急救行动仍可跳过并结案。
- [x] 连线端点按左右/上下与重叠类别选择，drag/hover/focus 端口一致，DOM 节点没有因预览而重建。
- [x] schema、机制文档、测试与 GALHCG 证据完整。

## 当前待注意

- Existing `required` 名称保留为兼容的“玩家可选牌”标记；是否未来改名为 `selectable` 属于独立 schema 清理，不在本 Task 扩大范围。
- `sceneActionBatches` 仍表示地点可推进前需消耗的批次数额度。玩家可以用选择/跳过消耗额度，但本 Task 不增加任意提前跳出地点的 route override。
- Actorless actor-target Action 只接受现有绝对 Actor filters；为现场提供动态、关系式、多源目标解析应另立机制 Task。

