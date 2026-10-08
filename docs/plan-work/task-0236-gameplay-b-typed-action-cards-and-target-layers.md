# Task 0236：Gameplay B Operation 类型受限行动牌与角色状态牌层

状态：in progress — U0–U2 实现、独立审查、自动验证与 IAB 常规 / 窄视口交互验收完成；Edge 扩展在本轮无法连接，等待 Edge 实测后最终收口。

## 目标

修正 Gameplay B Operation 战斗区的角色附着行动牌：牌只能作用于其规则声明的对象组 / 对象类型；第一幕星野、芹香、白子的目标行动必须只允许指向旋转木马。点击当前行动牌后，在牌右侧展开真正独立的替代行动牌；目标行动通过把牌拖放到当前合法对象来选择。同步调整牌、人物、高亮和目标线的 z 轴顺序，并像原 Gameplay B 人物牌一样显示 HP 与当前行动 sCost。

本 Task 中的“我方卡牌”指附着在学生人物卡上的战术 Action 牌，不是后续地点里的有限玩家 SceneCard 手牌。

## 设计边界

- 包含：战术 Action target 合同、第一幕样例行动目标、自动计划 / 干预 / OperationView / Resolution 的目标一致性、角色附着行动牌与替代牌层、合法目标拖放、z 轴层级、学生卡 HP 与 sCost 展示。
- 明确非目标：更改战斗数值、调整一槽干预上限、重做敌方行动、重做 Individual / Global 场景行动或玩家 SceneCard 卡组、照搬原 Demo 全部地图 / 玩法或其底部替代选项按钮面板。
- 目标限制必须进入声明式 Action 规则并由 Runtime 校验；仅隐藏 UI 目标或依赖 `targetPriorityActorIds` 排序不能算完成。
- 本 Task 的 Actor ID / type allowlist 仅用于战术 Beat Action。因为 SceneAction / PlayerSceneCard 也引用共享 `OperationActionDef`，任何被其引用的 Action 若声明此战术过滤字段，内容准入必须拒绝；普通未过滤 SceneAction / SceneCard 的 View、费用、效果与结算行为保持不变。
- 第一幕三张学生牌的目标集合必须精确投影为旋转木马 Actor。通用目标合同可按明确 Actor ID 和 / 或已声明 Actor 类型 / 组收窄，声明值必须在当前 Event 有对应 Actor / type；不得让未声明过滤的 `relation: 'any'` 被悄悄改义。
- 继续沿用 OperationView、单名学生干预、现有命令与原子 Beat Commit。UI 不直接读取 Runtime / Registry，不在拖动中写 Run；Action 选择与目标以既有干预预览、提交边界为准。
- 原 Demo 作为真实牌层结构与信息层级参考；行动牌节点须独立挂在共享牌层、按学生 Actor 锚点重新定位，不以嵌在人物信息卡中的按钮加卡面样式替代；AC 版式适配现有 Operation Workspace 和主题，不声称逐像素复刻。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 正式 Gameplay B Datapack 的首地点为旋转木马平台，限一轮；三名学生的战术 Action 牌附属于各自人物计划。 | `src/arona-clicker/content/operation-samples/carousel-scene-action-slice.ts`：`locations[platform].maxBeats`、`routeEdges`；`tests/engine/gameplay-b-scene-action-sample.test.ts`。 | 本 Task 将首地点作为严格对象约束的验收样例，不将后续场景牌加入战斗区。 |
| 星野的压制制动杆、芹香的节奏信号和白子的护住设备外框均声明 `target: { kind: 'actor', relation: 'any' }`；学生 Actor 把旋转木马放在 `targetPriorityActorIds` 首位。 | `src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`：Actor definitions 与 `brace` / `signal` / `shield`。 | 目标优先级只决定默认选择顺序，不限制合法对象；需新增可校验的白名单 / 类型筛选语义。 |
| `OperationActionTargetDef` 当前只有 `self / sameTeam / otherTeam / any`；明确干预预览会调用目标选择验证，`any` 可接受当前 Event 内其他学生、对手和环境 Actor。 | `src/data-services/contracts/operation.ts: OperationActionTargetDef`；`src/arona-clicker/services/operation-target-selection.ts: selectOperationTarget`；`operation-intervention-preview.ts: previewOperationIntervention`；`tests/engine/operation-intervention-preview.test.ts`。 | 目标过滤必须被自动计划、手动干预、目标投影及结算校验共用，防止只在 DOM 层限制。 |
| SceneAction 与 PlayerSceneCard 复用 `OperationActionDef`，当前其 View 候选和 SceneBatch Resolution 分别有 relation-only 目标判断。 | `src/data-services/contracts/operation.ts:OperationSceneActionDef/OperationPlayerSceneCardDef`；`src/arona-clicker/services/operation-view-projector.ts:targetCandidates/projectSceneActions/projectSceneCardCandidates`；`src/arona-clicker/services/operation-resolution-planner.ts:sceneTargetIsRelated`。 | 本 Task 不扩建场景选择 / 结算；静态内容准入禁止被场景包装器引用的 Action 使用战术专属过滤，避免绕过规则。 |
| Event Actor 的 `type` 是任意声明字符串；`OperationActorKind` 表示参与者类别，运行时 `participantKind` 单独投影，三者不能混为一个对象目标类型。 | `src/data-services/contracts/operation.ts:OperationActorDef.type / OperationActorKind`；`src/arona-clicker/contracts/operation-view.ts:OperationViewActor.participantKind`；`tests/engine/operation-target-selection.test.ts` 中 `type: 'test-actor'`。 | 目标合同按 `allowedActorTypes` 匹配 Event Actor 的精确 `type` 字符串；Carousel 仍用 Actor ID 白名单做到唯一目标。 |
| `OperationViewActor` 已投影 `participantKind`、`hp`、`maxHp`、`resources`；`OperationViewActionOption` 同时有 `cost` 和 `legalTargetActorIds`。首幕 Hoshino 有 actor `stamina=1`，Serika 有 `focus=0`，Shiroko 没有 actor-local resource；team `coordination=1` 单独归属 Team。 | `src/arona-clicker/contracts/operation-view.ts: OperationViewActor / OperationViewActionOption`；`src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`。 | HP / actor-local 资源与合法对象均可由 detached View 读取。Gameplay B 的 `sCost` 表示角色当前剩余行动资源，不是所选行动的支付额；AC 没有统一 `sCost` 字段，UI 只能把已存在的个人资源余额作为对应读数，不能将 team Coordination 或 PlayerCost 伪装成个人 sCost。 |
| 当前替代行动通过学生卡内“其他行动牌” disclosure 展开为同一行动列表中的牌；当前牌面含“当前行动”标签。拖拽关系层与目标高亮已有初版，但用户验收发现目标线视觉层级不足。 | `src/ui/components/operation-workspace.ts: renderAction / renderStudent`；`src/ui/controller-actions-operation.ts`；`src/ui/css/operation-workspace.css`。 | 替代牌要改为人物右侧浮动的独立牌面组；移除无意义标签，并在真实浏览器中验证叠放层级。 |
| 项目已有隔离的正式首幕视觉验收入口：DEV 模式通过 `?gameplayBCardInspector=1` 启动临时 Runtime、装载旋转木马 Datapack 并打开 Operation Workspace，不写主 Run / 存档。 | `src/ui/main.ts`；`src/ui/development/gameplay-b-card-inspector.ts`；`tests/ui/gameplay-b-card-inspector.test.ts`。 | 直接复用此入口做 Edge 验收，不新增重复的检查工具。 |
| 原 Gameplay B 的真实 prepared action 牌是独立节点，按 Actor 分组，放在共享 `prepared-card-layer`，通过 `preparedCardAnchors` 与角色节点和几何位置绑定；HP 与 sCost 位于人物牌的统计区。 | `prototypes/gameplay-b/src/view.ts: createCharacterCard / updateCharacterCard / createBattleCharacterCard / showPreparedBatch / updatePreparedCardPositions`；`prototypes/gameplay-b/src/style.css: .character-card, .character-stats, .battle-relation-layer, .prepared-card-layer, .prepared-action-card`。 | 施工须明确复用“独立牌 + 人物锚点 + 牌层定位 + 人物统计行”结构，不把按钮放进通用卡片容器冒充牌层。 |
| 原 Gameplay B 将战斗目标定义为带 side / row / 资格条件的 discriminated union，并先由规则投影候选，再由 Runtime 校验拖动选择；其候选合同覆盖 ally/enemy combatant，不含旋转木马环境物体。 | `prototypes/gameplay-b/src/model.ts:97–104`；`prototypes/gameplay-b/src/battle/player-card-edit.ts:60–159,235–260`；`prototypes/gameplay-b/src/view.ts:2002–2068,2161–2259`；`prototypes/gameplay-b/tests/battle-cards.test.ts:21–55`。 | 借用“类型化目标规则 → 合法候选 → 释放时再校验”的机制结构，为 Operation Actor / Environment 定义自己的对象类型；不能复用不匹配的敌我 combatant 分类。 |
| 原 Demo 的替代牌 chooser 实际是底部普通 `.player-card-choice` 按钮行；其 z-index 也不满足本 Task 更严格的层级要求。 | `prototypes/gameplay-b/src/view.ts: renderEditPanel / openChooser`；`prototypes/gameplay-b/src/style.css: .desk-layout, .character-card, .battle-relation-layer, .prepared-card-layer, .prepared-action-card`。 | 只借用其可用性 / 费用信息，不照搬底部 chooser；不能原样复制关系线数值层级。 |

## 目标交互与表现契约

- 目标候选由内容规则定义并由 Engine 校验，再投影为当前 Run 的 `legalTargetActorIds`。第一幕三个有 Actor 目标的学生 Action 只允许旋转木马；在角色、对手、其他设施或非目标 DOM 上拖放均不高亮、不落定、不改干预草稿。无目标行动不创建伪目标。
- 单击当前行动牌打开 / 关闭其右侧浮动替代牌组；每个候选是一张独立横向小牌。不可用项保留可读原因并半透明 / 弱色显示，不接受选择。选择需目标的替代牌时，从替代牌面拖到合法对象；放下后牌面显示实际目标关系。无目标替代行动通过激活牌面选择。提供键盘等价路径，不常驻目标按钮墙。
- 移除微型牌面上的“当前行动”文字。当前采用状态由人物归属、牌位 / 选中态表达，不依赖冗余角标。
- 角色卡同时显示 HP 当前值 / 上限与健康条；学生卡在人物统计区显示当前尚余的个人行动资源（沿用 Gameplay B 的 `sCost` 信息位置 / 语义）。该读数来自 `OperationViewActor.resources`，是余额而不是当前 Action option 的支付额；当前 Action 费用仍由 Action 牌面表达。没有适用个人资源时显示 `—`；Team Coordination 与场景 PlayerCost 单独呈现，不得误标为个人 `sCost`。Commit 改变资源 / HP 后读数与条形同步；只改本地计划不虚减余额。
- z 轴语义固定为：人物身份卡 < 附着行动牌（我方、对方分别归属人物） < 所有合法目标高亮 < 当前拖动目标线。要解决真实 stacking context / overflow / isolation 造成的遮挡；不能只提高一个局部 z-index 数字。替代牌组高于所属人物及相邻内容，拖动连线期间连线仍在最高层。
- 交互风格参考 Gameplay B `prepared-card-layer` 的 112×62 独立牌比例、角色锚点、错位旋转与 hover / focus 提层。颜色参考该 Demo 的 mist `#e4ece9`、paper `#f7faf7`、ink `#142f3a`、mint `#36747a`、ticket `#d7e84f`、brick `#ef7457`；实现沿用 AC 现有主题变量，不新增全局主题 / 字体系统。标志性信息关系是目标线从行动牌越过全部高亮、明确连到实际对象。
- 真牌结构验收须在 DOM 中看到学生卡只做 owner 锚点；独立行动牌作为共享牌层的直接子节点，按 Actor ID 与 owner 关联。牌位置从 owner / layer 的实际几何重新计算，并在滚动、缩放或尺寸变化后重算；仅加 `.card` 样式、移到人物卡后代或无 Actor 锚点的绝对定位均不合格。

```text
学生人物牌：头像 / HP 4 of 4 / sCost 1   [当前行动牌]
                                             [替代牌 A] [替代牌 B]
                                                   └──拖至旋转木马

堆叠顺序：人物卡 < 行动牌 < 合法目标高亮 < 目标关系线
```

## 施工切片

### U0：类型化目标规则与运行时一致性

**Goal**：让内容作者能声明 Action 可作用的 Actor ID / 对象类型集合，并让自动目标、预览、OperationView 和 Beat Resolution 使用同一筛选语义。

**Read Set**：本 Task；`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`；`src/data-services/contracts/operation.ts`；`src/arona-clicker/services/operation-target-selection.ts`、`operation-action-content-validation.ts`、`operation-intervention-preview.ts`、`operation-view-projector.ts`、`operation-resolution-planner.ts`；`tests/engine/operation-target-selection.test.ts`、`operation-intervention-preview.test.ts`、`operation-resolution-planner.test.ts`；原型目标合同参考 `prototypes/gameplay-b/src/model.ts:97–104` 和 `src/battle/player-card-edit.ts:60–159,235–260`。

**Completion Criteria**：目标筛选合同有 Registry / Datapack 校验；旧内容未声明限制时保持现有行为；首幕三行动的 OperationView 合法目标仅含 carousel Actor；自动准备、显式干预、Commit 结算一致拒绝越界目标。同步 schema 生成及其测试，不手改生成 JSON。

### U1：人物附着牌组、替代牌浮层与层级

**Goal**：把当前人物行动牌和替代牌调整为独立真牌层、拖放选择，并保证人物 / 牌 / 高亮 / 连线的严格顺序。

**Read Set**：本 Task；`docs/docs-829/06-wiki/50-ui/refresh-update.md`；`src/ui/components/operation-workspace.ts`、`controller-actions-operation.ts:observePreparedCardLayout/disposeOperationActions`、`controller.ts:UIController.destroy`、`css/operation-workspace.css`、`src/ui/development/gameplay-b-card-inspector.ts`；`tests/ui/operation-workspace-view.test.ts`、`gameplay-b-operation-controller.test.ts`、`tests/ui/gameplay-b-card-inspector.test.ts`；原 Demo `prototypes/gameplay-b/src/view.ts:111–124, 1840–1944, 2161–2259, 2432–2471` 与 `style.css:24, 102, 110–178`。

**Completion Criteria**：不再以列表 disclosure 显示替代行动；单击当前牌出现右侧独立牌面组；目标型替代牌的鼠标 click 不选择计划、不打开目标按钮 tray，只有拖到 View 允许的目标才选择；键盘 Enter 提供等价的牌内目标选择路径。`aria-pressed` 只标记当前 action 的已选目标；替代牌默认目标用 `data-default-target` 表达并作为无已选项时的键盘聚焦目标。当前牌目标显示当前计划目标，替代牌及其键盘目标 tray 显示各自 option 的默认目标；`UIController.destroy()` 幂等释放牌层 scroll / MutationObserver / ResizeObserver / pending rAF。非法 / 不可用项可读且禁用；非法 drop 不改 Run 或干预草稿；移除“当前行动”标签。Pointer/keyboard 行为保持可访问，展开 / 收起为 behavior 更新，普通交互不触发 full render；角色牌、行动牌、所有目标高亮和最高层连线在 Edge 实测顺序符合契约。

### U2：角色 HP / sCost、体验验收与文档

**Goal**：在学生人物卡复用 OperationView 显示 HP 与当前 actor-local resource balance（对应 Gameplay B sCost 信息位置），并核对整套交互的视觉和连续性。

**Read Set**：本 Task；`docs/docs-829/06-wiki/50-ui/refresh-update.md`；`src/arona-clicker/contracts/operation-view.ts`、`operation-view-projector.ts`；角色牌、Action 牌 UI 和定向测试；原 Demo `view.ts:446–495, 729–735, 876–881`、`style.css:147–154`。

**Completion Criteria**：学生卡显示正确 HP 当前值 / 上限、HP 条和 actor-local resource balance；若数据确为角色自有的行动资源，沿用 Gameplay B 的 `sCost` 标签 / 位置；普通 Action 支付额、Team Coordination 与 PlayerCost 口径清楚且不混淆。行动选择不虚减余额，成功 Commit 后资源 / HP 才更新。未变化人物卡、日志、Dock、滚动位置与焦点保持身份 / 连续性。Edge 常规与窄窗口验收截图、键盘路径和 `docs-829` 刷新文档写入 Receipt。

### 当前 Patch Unit 白名单与施工顺序

本 Task 共六个 Patch Unit，按 Unit 文件中的 Allowed Files 与 Stop Conditions 施工：

1. [[task-0236-units/u0-a-target-scope-contract]] → [[task-0236-units/u0-b-target-selection-and-preparation]] → [[task-0236-units/u0-c-intervention-and-resolution-target-checks]] → [[task-0236-units/u0-d-projection-sample-and-runtime-docs]]。
2. [[task-0236-units/u1-attached-action-card-layer]] → [[task-0236-units/u1-b-card-position-and-interaction]]：U1-A 先落共享牌层与人物状态结构，U1-B 再实现 owner 几何定位、开合、拖放与键盘交互；可与 U0 的 Engine Unit 并行。UI 只消费 OperationView 已给出的合法目标与 Actor 状态。

每个 Unit 在 `docs/plan-work/task-0236-units/receipts/` 记录实际改动、验证与 GALHCG 影响闭环。Task 的 U0/U1/U2 是结果切片，以上文件是具体 Patch Unit 白名单。

## 验收与验证

- [x] 三张首幕 Action 的合法目标集合在 View、预览和 Resolution 层均仅为旋转木马；手动注入同事件其他 Actor ID 被 Runtime 拒绝。现有未受限 `any` Action 回归行为不变。
- [x] Runtime 内容准入拒绝将带战术 Actor ID/type 过滤的 Action 复用于 Location SceneAction 或 PlayerSceneCard；未过滤场景内容的选择 / 结算语义保持不变。
- [x] 人物牌右侧替代项是独立面牌；禁用原因可读、禁用项不可拖动；鼠标拖放目标牌至旋转木马才会选择，非法 drop 后所有 Run 字段和干预槽不变。
- [x] 界面移除行动微牌“当前行动”标签；学生身份卡显示 HP / maxHP 与真实 actor-local resource balance（按语义使用 `sCost` 标签），只有 Runtime Commit 后资源余额随结算更新。
- [ ] 角色卡 < 附着牌 < 目标高亮 < 目标线的顺序已在 IAB 实际拖动中成立；Edge 中 stacking context、裁切和窄窗口仍待实测。
- [x] 鼠标拖放和键盘等价路径可用；Popover 开合不全量 render、不破坏滚动与焦点，拖动、取消和非法投放不写 Run；合法修订仍只改变一个学生的计划。
- [x] 在 Gameplay B Inspector 中，Operation 消费的 Escape 只结束局部牌面交互；未消费 Escape 与显式退出按钮仍关闭检查器。
- [x] Engine / UI / Schema 定向测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check` 通过。
- [ ] Edge 常规 / 窄视口实测与截图归档；当前 Edge 扩展连接失败，不能以 IAB 结果代替。

## 浏览器实测（2026-10-05）

- 复用 `?gameplayBCardInspector=1` 的隔离 Runtime，在 IAB `1440×900` 与 `800×900` 检查人物卡、独立行动牌和右侧替代牌组。两种视口下行动牌都挂在共享牌层，分别锚定 owner 实际矩形；牌与人物身份卡不相交，HP 与 sCost 行保持可读。800px 下替代牌组在 frame 内完整展开，禁用牌为 `opacity: 0.56` 且不可用。
- 在 `800×900` 用 Serika 当前行动牌拖至旋转木马：拖动中只有 carousel Actor 显示合法目标高亮（计算层级 z-index 310），目标线从行动牌跨过内容区连接实际设施，关系 SVG 层级为 999；释放后状态提示“已把行动目标设为 旋转木马。”，Operation `planVersion` 从 0 变为 1，隔离 Runtime 的单人计划修订成功。
- 键盘从人物行动牌按 ArrowDown 进入旋转木马目标；Escape 关闭局部托盘并把焦点还给行动牌，检查器保持打开。生命周期回归另验证销毁时 listeners / observers / pending frame 释放。
- 提交隔离首幕回合前 Serika `sCost` 为专注 0；结算后 Runtime 日志为“专注 0 → 1”，人物卡同步显示专注 1；未提交的选择没有提前虚减余额。
- Edge 扩展在本轮无法连接（两次尝试均返回浏览器连接错误）；以上为 IAB 实测，不作为 Edge 通过证据。故 Edge 层序与裁切验收仍待完成，Task 保持 `in progress`。

## 当前调研（2026-10-05）

- 两名只读子 Agent 分别核对当前 Operation target 合同和 `prototypes/gameplay-b/` 真牌层结构；未改文件。
- 当前三张牌目标宽泛是已确认事实：它们用 `relation: 'any'`，`targetPriorityActorIds` 只把旋转木马排在自动目标首位；目标候选和干预 Runtime 仍允许其他对象。新 Task 要增加规则级 allowlist / type，且不能把 prefer 顺序当合法范围。
- `OperationViewActor` 已暴露 participantKind、HP / maxHP / resources；Action option 已有 `cost` 和合法目标 ID。HP 与 actor-local balance 可依现有投影读取；Gameplay B 的 sCost 是资源余额，不能误读为 ActionOption 的 `cost`。
- 原 Gameplay B 的人物锚定真牌层为 `prototypes/gameplay-b/src/view.ts:111–124, 1840–1949, 2432–2471` 与 `prototypes/gameplay-b/src/style.css:165–178`；HP / sCost 为 `view.ts:446–495, 729–735, 876–881` 与 `style.css:147–154`。目标层结构参考 `prototypes/gameplay-b/src/model.ts:97–104`、`src/battle/player-card-edit.ts:103–159,235–260` 及 `view.ts:2161–2259`；Demo 的替代行动 chooser 是 `player-edit-panel` 底部普通按钮行（`view.ts:1368–1383, 2027–2068`），不是本 Task 的目标结构。只借用类型化候选和释放验证边界，不直接复用 ally/enemy combatant 类型表示 Operation 场景 Actor。
- Demo 的拖拽关系线拖动态 z=130，高于常规目标高亮 110/115，却低于可聚焦 / hover 行动牌 200/300；新 Task 已裁定更强的统一顺序，以实际 stacking context 浏览器证据验收。
- 角色统计的设计计划：沿 AC 现有 teal / olive / brick 卡牌类型色与主题变量，保留 Demo 的人物牌信息密度；统计行用 HP 与当前 actor-local resource balance，不新增 wrapper 或全局字体。签名元素是跨高亮层连接牌与真实受作用对象的前景关系线。
- 正式第一地点为单 Beat；`carousel-safety-slice` 的两 Beat 自动战斗测试夹具不可当作正式地点目标合同依据。

## GALHCG 影响闭环

- 身份与范围：`resolve_project(workspace_path="C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram")` 返回 `project_id=acprogram`，root/workspace 均一致。仅对 Task-0236 父页、`docs/plan-work/00-index.md`、6 个 Unit 与 6 个 Receipt 定向刷新；`docs/plan-work/task-0236-units` 的 `map_inventory(selection="unassociated")` 初始为 12/12 未关联，完成映射后为 12/12 已映射且有 Evidence，清单与 owner 分页完整、无截断。排除 Task-0235 的并行文档、`docs-829/06-wiki/40-engine/`、Registry 和 quick-test-console 路径；未新增 Concept。
- 复用既有节点：`concept:operation-event-run-runtime`、`concept:ui-workspace-renderer`、`concept:goal-workflow`、`module:data-services`、`concept:datapack-to-registry-flow`、`concept:operation-student-profile-admission`、`concept:ui-command-to-runtime`、`concept:test-harness-and-configuration`、`module:planning-records`。U0 的 4 个 Unit 与 4 个 Receipt 均以 `documentation` 映射到 Operation Runtime；U1 的 2 个 Unit 与 2 个 Receipt 均以 `documentation` 映射到 UI Workspace Renderer。新建的 12 条 Evidence edge ID：U0 `954f86158d4142fb98ebdcb86edc021d`、`eef43b61bd204b8fb53b84770e596672`、`a086c37affd74ac58b6f2bd916f0d0c3`、`94f26ca3e11d41e5b32548688289b0a1`、`9c79a0d4ccbf4ef3b0e324afc3ecfc2e`、`1d7a90da8ae84328abf642ce11fcd1a3`、`89502f4fe6cf46c7bc3b77aeac8f8916`、`c22baf3db1a24cae89d35db9920bdba7`；U1 `03bf20fb48354388bb6c823a63b2a3ba`、`fae5af1d14844e5f9cfa7b30d8257286`、`bb45a2e6e21a44509f4adbcb56f5f247`、`27e238505c98464ea7e819ffc977c2d7`。
- 既有映射 Evidence：更新了 Operation 合同、战术定义与内容校验、目标选择、首幕内容、Engine 测试和 Runtime 文档的现有 maps_to / related_to；更新 UI frame、Operation workspace、CSS、controller、Inspector 及相应测试的现有映射；并更新 `00-index.md` 的 `module:planning-records` 节点、项目 `contains` 与 `concept:goal-workflow` maps_to。另更新节点 Evidence：`module:data-services`、`concept:datapack-to-registry-flow`、`concept:operation-student-profile-admission`、`concept:ui-command-to-runtime`、`concept:test-harness-and-configuration`、`module:planning-records`。首轮映射维护合计 7 个有效写入批次、77 条 owner Evidence 引用；40 条非 Task maps_to / contains / related_to edge 均通过完整 freshness 检查（每条 1/1）。上述 6 个节点分别检查 6/6、5/5、15/15、2/2、8/8、1/1，均 fresh。后续复合节点与父页 / U0-D / U1-B 收尾见下文；本轮修正文案后 U1-A Receipt edge `bb45a2e6e21a44509f4adbcb56f5f247`、U1-B Receipt edge `27e238505c98464ea7e819ffc977c2d7` 均 ID 不变、freshness 1/1；父页三条 maps_to ID 仍为 `8c39fa69b89f4009a789f12820947f98`、`e8f1085dbe884ff993c05b978be0175c`、`4de6fc25069a4319ac935c55ec11c0c8`，已按本段最终文本重提并核验为 fresh（均 1/1）。
- 并行边界与复合节点收口：已复核归档 Task-0235 原文；其中明确把 Operation Workspace 组件及相关 Evidence 留待 Task-0236 稳定后复核。Task-0235 已归档，相关 32 条既有 Evidence 路径双轮 preview 均为同一可用 token，32/32 稳定，review_changes 的 owner 分页完整。现沿用原 20 / 12 条 Evidence 路径更新 `concept:operation-event-run-runtime` 与 `concept:ui-workspace-renderer` 的整组节点 Evidence，不改节点语义字段；写后实时 freshness 分别 20/20、12/12 fresh。Operation Runtime 覆盖 Task-0235 的 OperationView 文档以及本 Task 的 Runtime 文档、内容校验和合同路径；UI Workspace 覆盖 Task-0235 的 UI 机制文档以及本 Task 的 workspace、CSS 与 view test 路径。两个复合 owner 已完整收口；未改写 Task-0233/0235 专属关系。
- 父页与索引：本 Task 的三条既有 documentation maps_to 为 Operation Runtime `8c39fa69b89f4009a789f12820947f98`、UI Workspace `e8f1085dbe884ff993c05b978be0175c`、Goal Workflow `4de6fc25069a4319ac935c55ec11c0c8`；段落定稿后的完整预览 token 已重提到三条边，`verify_freshness` 均为 fresh（每条 1/1），精确 `review_changes` unchanged、stale=0，6 个 owner 记录按 5+1 分页完整读取。`search(mode="map")` 精确命中本 Task File（1/1，complete）；从 File 反向 traversal 完整返回指向该 Task 的三条 maps_to，方向和 documentation 角色正确。`00-index.md` 的现有 node / contains / maps_to Evidence owner 写后 review 为 unchanged、stale=0，4/4 owner 记录完整。

## 剩余工作

- 本 Task 已完成 U0/U1 实现、独立严格审查与 IAB 常规 / 窄视口验收；仅待 Edge 常规 / 窄视口实测，确认行动牌层序、裁切、焦点与滚动连续性后关闭。当前状态仍为 `in progress`。

## 相关路由

[[task-0232]] · [[task-0234-gameplay-b-demo-card-surface]] · [[draft-0231-b]] · [[draft-0231-gameplay-b-original-demo-activity-and-battle-round]] · [[docs/ai/goal-workflow]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/ai/frontend-design-project-overlay]] · [[operation-runtime]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]] · [[docs/docs-829/05-conventions/schema-sync]]
