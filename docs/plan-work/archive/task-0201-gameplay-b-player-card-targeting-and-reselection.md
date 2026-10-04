# Task：玩法 B 玩家行动卡改目标与普通卡重选

状态：completed — 审理、U1–U3、独立原型验证与浏览器验收均完成；已记录最终收据

## 目标

在玩法 B 独立预研原型的战斗准备阶段，让玩家在主 Click 结算前修改己方行动卡目标，或为当前 Chara 重选普通卡。拖拽时保留原卡并生成随指针移动的 ghost；合法目标高亮；单目标放下后原子应用，多目标进入临时组选择并经确认后应用。点击己方普通行动卡则展开该 Chara 的完整普通卡组选项；所有卡均显示，当前 sCost 不足、没有合法目标组或与本轮已冻结技能修正冲突的选项半透明且不可选。

只修改玩法 B 的当前 pending battle preview。敌方预告、当前 Chara 数值、回合 RNG 已产生的技能结果和 Click 结算边界保持冻结。AC Runtime、规则与 `src/ui/` 不接入。

## 子 Agent 审理与施工裁定（2026-10-03）

玩法审核、Draft 清晰度审核、引擎与交互审核均只读完成。三份意见一致指出原草案把若干自动目标规则误写成可自由缩小/扩大的目标组，并且冻结技能可能引用普通行动的 actor、target 或 actionId。按“只改目标、不改变卡牌效果语义”的范围，施工采用以下裁定：

- 保留每种 `BattleTargetRule` 的现有效果形状与基数；目标改写只在现有规则允许的候选集合内发生。`all` 始终覆盖指定排全部存活对象，不允许免费少选；因此没有替代组的 `all` 牌只显示为不可改目标。
- `lowest` 的 `rows` 是有序优先级：从左到右找到首个含合法目标的排，玩家只能在该排候选中挑 1 人；`lowest` 仍是默认目标偏好。`injured-half` 沿用现有规则，允许 HP=0 但未满且不高于半血的队友成为治疗目标（`battle-prepare.test.ts` 明确覆盖）；其他目标要求存活。`prepared-attack` 依据完整拟提交行动集检查。
- `front-and-lowest-rear` 保留“全部存活前排 + 一名存活后排”的既有组形。前排成员固定；若存在后排，只能从存活后排中替换那一个后排目标。任一排为空时保留另一排原有形状。
- `intent-target` 仅使用冻结匹配意图的目标，并保持原行动的目标数量；不得把防护/支援扩为更多人或缩成更少人。所有目标组提交前二次校验阵营、行、存活、条件、数量、重复和关联行动依赖。
- 普通卡选择、拖拽和多目标编辑先建立 UI 草稿，确认前不改 Runtime。单目标落下即原子提交；多目标编辑预选落点目标（对固定组成员保留并锁定），随后逐个补足/切换可选目标并显式确认。重选卡若唯一合法目标组只有一种则直接提交；多组候选进入相同确认流程；无目标的“观察 / 待机”选项点击即提交。Escape 取消并恢复源卡焦点。
- 冻结技能不重掷。绑定普通行动目标或 actionId 的免费技能/修正卡（如追击、余震、鼓舞、校准镜）保持只读；若当前普通行动已被冻结技能绑定，目标编辑或重选仅在所有绑定仍兼容时开放，否则显示禁用原因。可独立改目标的免费治疗/掩护技能只有在目标规则允许时开放，并与该技能行动的 `targetIds` 一并原子改写。
- 行动小卡与技能卡目标端点可继续显示既有的卡片间关系；本 Task 的拖拽改目标仅改已有 `BattleTargetRule` 表达的 Chara 目标，不把 `modifies-action` / `recipe-partner` 卡片关系伪装成角色目标。
- 点击/Enter/Space 打开普通卡选择架；方向键或 Tab 浏览，Space 切换多目标，Enter 确认，Escape 取消。拖拽仍使用 6 CSS px 阈值；无效 drop 不提交。

审理提出的建议不直接扩大玩法：特别是 `all` 子集、随意改变目标组数量、重新掷技能，以及编辑指向其他卡片的 modifier 均不纳入本次实现。

## 已裁定交互与状态边界

### 目标转移

- 可拖拽己方当前准备的普通行动卡；己方免费特殊技能卡仅在其具有明确 Chara 目标时可拖拽改目标。敌方意图、场所/探索卡以及指向另一张行动卡的 `modifies-action` 关系不可拖拽改写。
- `pointerdown` 后移动超过 6 CSS px 才开始拖拽，以区分点击重选。源卡节点留在原处；拖拽 ghost 是 `aria-hidden`、不可聚焦、`pointer-events:none` 的表现副本，由一处跨栏 overlay 承载。
- 拖拽时只高亮当前冻结快照中的合法目标。单目标卡放到合法目标后校验并一次性应用；无效目标、面板外放下、`pointercancel` 或 Escape 均不改 pending state。
- 多目标卡放到合法目标后进入目标组编辑：高亮全部候选对象，拖拽落点作为首个已选对象；固定组成员保持选中并锁定。点击角色卡逐个增删可变槽位，中央 Click 区显示“已选 N / 需要 N”与目标摘要。只有组形、数量和规则均有效时“确认”才可用。取消或 Escape 丢弃草稿；确认前主 Click 禁用。
- 目标合法性以该卡的 frozen `BattleTargetRule` 为边界，基于 pending round 的存活状态、阵营、排、条件及意图标签，以及已提交的玩家行动草稿计算；不读结算后的变化。若一个候选会使其他已提交行动的目标条件失效（例如 `prepared-attack`），该候选不可用并显示原因，不悄悄改动其他行动。

| target rule | 手选候选与目标组 |
| --- | --- |
| `lowest` | `rows` 按优先级从左到右；在首个有合法对象的排中选 1 人。玩家可在该排所有合法对象中选 1 人，`lowest` 是默认偏好；`injured-half` 必须未满且不高于半血，允许 HP=0 作为治疗目标。 |
| `all` | 固定为该 side/row 所有存活对象，保持全选，不开放缩小组的目标编辑。 |
| `front-and-lowest-rear` | 保持全部存活前排 + 一名存活后排；前排目标固定，只能把后排目标换成另一名存活后排。若一排为空，保留另一排现有形状。 |
| `intent-target` | 候选仅限当前 frozen intents 中带匹配 tag 的目标；选取数量必须与该行动原目标数量一致。 |

重复 ID、空组、被移除 Chara、跨阵营/排、改变固定组形或越过规则条件均拒绝；HP=0 仅可作为 `injured-half` 治疗目标，不可作为其他目标。`prepared-attack` 条件按拟提交后的完整行动集检查；编辑若会使另一张已提交卡失去条件，该候选不可选。支援卡也按其自身 side/row/requirement 处理，不统一强制指向敌人。

### 普通卡重选

- 点击己方当前普通行动卡（含“观察 / 待机”）打开该行动者的选择架；显示该 Chara `definition.cards` 中的全部普通卡 ghost，并额外提供零成本“观察 / 待机”。卡牌不得因 sCost 或目标池为空而被过滤。
- 可选性从同一个 pending round 起始 sCost 计算，而不是当前 AI 卡扣费后的余额；仅当 `card.cost` 超过该起始余额时因资源禁用。AI 的 `condition`、`holdCost` 和优先级是默认选卡倾向，不作为玩家手选的额外门槛。
- 选项也因无合法目标组或与本轮已触发且冻结的技能联动不兼容而禁用；ghost 保留名称、费用和原因说明，以降低半透明状态的不确定性。涉及绑定普通行动的冻结技能时，替换卡必须保留该技能前提和引用有效性；否则禁用并说明原因。不可通过重掷、撤销或制造技能行动来迁就新卡。
- 点选可用 ghost 先构造选择草稿，不增加行动次数、不支付资源。若目标规则存在多种合法组，进入同一目标选择流程；若只有一组则直接确认。观察/待机没有目标，点选后直接提交。确认后只替换该 Chara 的一张普通行动，绝不额外增加普通行动。取消恢复原选牌。

### 冻结、重建与结算

- 默认 AI 选出的行动继续作为编辑前初始值。编辑只改己方 `playerActions` 或可改目标的免费技能行动；不改 enemy intents、角色 snapshot、卡牌 effect/tags、已完成检定、Dice roll、`rngCursor` 或路线 Click 数。
- 技能检定与实际触发的免费技能在本轮准备时已冻结；改选普通卡不重新掷骰、不新增或撤销本轮技能触发。绑定普通行动的免费技能与 modifier 不可悬空；发生冲突的目标/选牌 ghost 禁用。可编辑独立目标技能时，要在同一原子提交中同步其免费行动目标，不修改技能检定结果。
- 每次确认都以 frozen round start sCost 重算当前卡费用，只扣一次；随后以确认后的普通行动和技能目标重新生成 CardTag recipe plan、卡片关系、目标高亮及 preview 文本。确认前先验证整组新数据，失败时保留原 pending state。
- `GameplayBRouteRuntime.click()` / `GameplayBBattleRuntime.click()` 仍是唯一结算入口。目标/卡牌的普通点击、拖拽、确认和取消都不增加 `clickCount`，也不追加战斗事件。
- 原批次 id 当前只由 encounter/round 标识，同轮编辑后 UI 不能因 id 未变而跳过更新。更新需按稳定 `cardRef` 局部同步卡面和关系，或以等效 keyed region 更新；不重建整页。保留无关 Chara、center content、滚动位置；提交后焦点回到被编辑的稳定卡引用。

## 已核实事实

| 事实 | 源码依据 | 影响 |
| --- | --- | --- |
| `PreparedBattleRound` 为只读快照，己方手选数据位于 `playerActions`；每项含 `cardId/tags/effect/targetIds/costPaid/sCostBeforePayment/sCostAfterPayment`。 | `prototypes/gameplay-b/src/model.ts`：`PreparedPlayerAction`、`PreparedBattleRound` | 手选必须建立经过校验的新 pending round/action，不允许 UI 直接改冻结 view。 |
| 可用普通卡来自 `BattleCharacterDefinition.cards`；`GameplayBBattleRuntime.input` 持有 party 定义，但 `BattleRuntimeView` 目前不暴露卡组。 | `prototypes/gameplay-b/src/model.ts`：`OrdinaryBattleCardDefinition`、`BattleCharacterDefinition`；`prototypes/gameplay-b/src/runtime.ts`：`GameplayBBattleRuntime.getView()` | Runtime view 需提供编辑器使用的 Chara 卡组与可用状态。 |
| 自动目标解析基于 `BattleTargetRule`；目前 `lowest` 会直接挑最低 HP，`all` 返回整排，`front-and-lowest-rear` 返回自动组，`intent-target` 从匹配 intent 收集目标。 | `prototypes/gameplay-b/src/battle/prepare.ts`：`targetIds()` | 手选合法池需明确复用或扩展规则含义，不能从当前 targetIds 凭空添加目标。 |
| 技能检查只对准备时满足条件者消耗骰子；输出含检查、免费行动、modifier、额外 effect。 | `prototypes/gameplay-b/src/battle/skills.ts`：`prepareSkills()`、`activate()` | 编辑普通卡不得调用带随机源的技能准备；本轮 skill 结果冻结，冲突选项应禁用。 |
| CardTag plan 是从己方行动、敌方意图与技能免费行动计算的派生结果；可通过 `matchPreparedBattleRound()` 重算。 | `prototypes/gameplay-b/src/battle/match.ts`：`matchPreparedBattleRound()` | 目标或选牌确认后重建配方匹配，旧的 recipe path/effect 不能残留。 |
| Battle runtime 结算当前 pendingRound/skills/recipePlan 后清空并准备新轮；Route runtime 唯一 Click 再把战斗结果写回路线事件。 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBBattleRuntime.click()`、`GameplayBRouteRuntime.click()`、`resolveBattleClick()` | 编辑 API 必须只更新 pending battle，不调用 Click、不写 route event。 |
| View 仅把当前 `advanceButton` 交给 `main.ts`；prepared-card batch id 为 encounter/round，同轮再次 `showPreparedBatch()` 会因 id 相同直接返回。 | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`showPreparedBatch()`；`prototypes/gameplay-b/src/main.ts`：advance click handler | 新增稳定的 edit callback，并解决同轮局部卡片/关系同步。 |

## Patch Unit 0201-U1：卡组选项、合法目标与原子行动重建

### Goal

提供纯计算 helper：列出全部普通卡候选及不可用原因；按 frozen target rule 构造候选池与合法目标组；验证手选目标；返回费用及目标已重建的单一 prepared action。输入不得变异，失败必须保留旧 action。

### Must Read / Read Set

- `prototypes/gameplay-b/src/model.ts`：`BattleTargetRule`、`BattleActionEffect`、`PreparedPlayerAction`、`OrdinaryBattleCardDefinition`。
- `prototypes/gameplay-b/src/battle/prepare.ts`：`targetIds()`、sCost 计算与 AI hold-cost 行为。
- `prototypes/gameplay-b/src/battle/skills.ts`：已冻结技能输出与 action modifier 的兼容条件。
- `prototypes/gameplay-b/src/content/first-battle.ts`：不同目标规则、卡牌费用、AI hold-cost 样本。
- `prototypes/gameplay-b/tests/battle-prepare.test.ts`、`prototypes/gameplay-b/tests/enemy-intents.test.ts`：默认目标和条件边界。

### Allowed Files

- `prototypes/gameplay-b/src/battle/prepare.ts`
- `prototypes/gameplay-b/src/battle/player-card-edit.ts`（新增）
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`（新增）

### Completion Criteria

- [x] 所有 Chara 普通卡（含不可用卡）可投影为可读选项；费用检查用 pending round start sCost，AI hold-cost/priority 不误作手选门槛；观察卡零成本可用。
- [x] `lowest/all/front-and-lowest-rear/intent-target` 的候选池与组规则按本 Task 表格实现；角色状态、行、阵营、requirement、intent tag 和多目标组合有正反例。
- [x] 不足 sCost、无目标池、目标组无效时返回明确 disabled reason，不构造可结算 action；单目标和多目标都拒绝重复/非法 ID。
- [x] 构造替代 action 时正确更新 cardId/name/tags/effect/targetIds/costPaid/sCostAfterPayment/reserveBypassed；从同一 round-start sCost 算费且输入只读。
- [x] Unit 定向测试通过，类型检查通过。

### Verification

- 在 `prototypes/gameplay-b/`：`npm test -- player-card-edit`、`npm test -- battle-prepare`、`npm run typecheck`。

## Patch Unit 0201-U2：Pending battle edit API 与配方重算

### Goal

为 `GameplayBBattleRuntime` 与 `GameplayBRouteRuntime` 增加仅准备期可调用的选牌/目标编辑入口；每次确认原子替换 pending 内容并重算配方。View 暴露普通卡组和候选卡状态。免费技能目标仅改显式目标，不重新准备技能。

### Must Read / Read Set

- `prototypes/gameplay-b/src/runtime.ts`：`BattleRuntimeView`、`GameplayBBattleRuntime.getView()/click()/prepare()`、`GameplayBRouteRuntime.getView()/click()/resolveBattleClick()`。
- `prototypes/gameplay-b/src/battle/match.ts`：recipe 重匹配。
- `prototypes/gameplay-b/src/battle/skills.ts`：已冻结的 `PreparedBattleSkills` 与 actor/action 关联。
- `prototypes/gameplay-b/src/content/characters.ts`：`characterSkills` 的 skill ID，确认冻结技能与 free action ID 对应关系。
- `prototypes/gameplay-b/src/view.ts`：`playerActionRef()` / `specialSkillRef()` 的稳定卡片引用格式；只读核对接口，不修改此文件。
- `prototypes/gameplay-b/tests/runtime.test.ts`：seed、round click、pending state、route event 断言。

### Allowed Files

- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/battle/match.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`

### Completion Criteria

- [x] 运行时只允许对仍 pending 的己方行动卡改选/改目标；敌方、已结算、终局和场所卡编辑请求安全拒绝且不部分写入。
- [x] 准备期确认重建 `pendingRound` 中对应的普通行动；仅允许没有 action modifier / 结算 effect 绑定的独立免费技能改目标，并同步其 free action `targetIds`。追击、余震、鼓劲、校准镜等绑定卡保持只读；冲突普通卡选项显示禁用原因。
- [x] 每次确认都用更新后的行动/技能目标重新计算 CardTag `pendingRecipePlan`；enemy intent、skill checks/diceRoll、RNG cursor、route clickCount、事件数、战斗状态与HP保持不变。
- [x] `BattleRuntimeView` 提供每个在场我方 Chara 的完整普通卡组选项及当前 frozen start sCost；UI 不需要读私有可变引用。
- [x] 随后的一次 runtime Click 正好以最终 pending round、技能和 recipe plan 结算，并按当前流程只追加正常结算事件、准备下一轮。
- [x] 定向 runtime/recipe 测试通过，类型检查通过。

### Verification

- 在 `prototypes/gameplay-b/`：`npm test -- runtime`、`npm test -- card-recipes`、`npm run typecheck`。

## Patch Unit 0201-U3：拖拽 ghost、卡组选择架与多目标确认

### Goal

在现有 prepared-card overlay 上增加拖拽、卡组选牌、目标组临时状态和确认/取消。所有普通输入只更新局部卡片和关系；主 Click 仍是唯一结算操作。

### Must Read / Read Set

- `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、prepared batch/card map、hover relation delegation、`update()`。
- `prototypes/gameplay-b/src/style.css`：`.prepared-card-layer`、`.prepared-action-card`、两侧滚动面板及 center action dock。
- `prototypes/gameplay-b/src/main.ts`：advance callback 与 runtime/view 更新顺序。
- `prototypes/gameplay-b/tests/battle-cards.test.ts`：prepared card projection 与稳定 cardRef。
- `docs/plan-work/archive/task-0198-gameplay-b-action-cards-and-hover-targets.md`、`task-0200-gameplay-b-card-relation-top-layer.md`：卡片生命周期、relation layer 与节点 identity 验收。
- `docs/ai/frontend-design-project-overlay.md`：behavior/region 刷新与 DOM budget。

### DOM Budget / Interaction Preservation

- 新增结构上限：跨栏拖拽期间最多 1 个 decorative ghost overlay；普通卡选择架每次只显示 1 名 Chara 的当前卡组；复用现有 Chara 卡、prepared-card layer 和关系 SVG，不为每个候选目标复制节点。
- Pointer move 仅更新 ghost 坐标/合法目标 class，不 `render()` 或重建 shell；选择候选/目标确认后仅同步受影响的行动卡、目标标记与 relations。
- 滚动位置保留当前 side panel 的原值；卡片在提交时以 stable `cardRef` 锚点返回焦点；取消/键盘 Escape 返回原卡焦点。
- 原卡身份在选择草稿期间保留；ghost 不参与事件委托、tab order、`cardRef` 索引或 recipe 解析。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/src/main.ts`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`

### Completion Criteria

- [x] 主键盘/鼠标均可操作；点击或 Enter/Space 聚焦己方普通行动卡（包括观察卡）打开 ghost 选择架，完整显示该 Chara 所有普通卡和观察卡；费用/目标不可用选项保持可见、半透明、有原因且不可确认。
- [x] 左键拖拽超过阈值后生成单一 ghost 并高亮合法目标；单目标 drop 原子应用；多目标经点击增删与计数摘要，在合法组确认后一次提交。
- [x] 目标草稿、ghost 与 chooser 可由确认/取消/Escape/pointercancel/lost capture/批次替换/战斗离场完整清理；提交前不得影响 pending runtime。
- [x] 拖拽、卡组候选点击、多目标勾选与确认均不增 route `clickCount` 或调用结算；选择中主 Click 不可结算。
- [x] 确认后卡片内容、sCost、target highlights、关系曲线与配方预览同步到新 pending state；同轮 action/target 变化不会被旧 batch ID 短路；不丢失未编辑 Chara、事件日志滚动或当前 panel scroll。
- [x] 1280×720 浏览器验收覆盖单目标有效拖拽、低 sCost ghost、卡组改选、取消/非法 drop、同轮两次编辑后结算与下一轮 cleanup；skill checks 无二次骰子，主 Click 每回合仍只推进一次。多目标确认器的组形、固定槽、目标数量与替换行为由 U1/U3 定向用例覆盖；当前路线内容的可变多目标只有敌方 intent 或固定全排 `all`，不加入临时内容来伪造玩家目标规则。
- [x] 原型定向/全量测试、typecheck、build，根 `npm run check:docs` 与 `git diff --check` 通过。

### Verification

- 在 `prototypes/gameplay-b/`：`npm test -- battle-cards`、上述 U1/U2 定向测试、`npm test`、`npm run typecheck`、`npm run build`。
- 浏览器：独立原型 1280×720，按 U3 场景操作并观察 `clickCount`、卡片/ghost/关系回收与焦点/滚动连续性。
- 多目标组形/交互状态：`prototypes/gameplay-b/tests/player-card-edit.test.ts` 与 `prototypes/gameplay-b/tests/battle-cards.test.ts` 使用合成合法组覆盖固定前排、可变后排槽、拖放初选、数量不足/超限、补选、确认门槛。
- 根目录：`npm run check:docs`、`git diff --check`。

## Execution Receipt 0201-U1（2026-10-03）

- 新增 `prototypes/gameplay-b/src/battle/player-card-edit.ts`：提供只读卡组选项、目标组候选/固定槽、目标合法性、起始 sCost 计费和替代行动构造。没有修改既有自动选牌算法。
- 按源码和测试保持 `lowest` 排优先级、`all` 整排基数、`front-and-lowest-rear` 的全部前排 + 一个后排槽；`intent-target` 从冻结意图收集目标并保持原组数量。`injured-half` 保留当前 R11 的 HP=0 治疗目标行为，不把它扩展到其他规则。
- 新增 `prototypes/gameplay-b/tests/player-card-edit.test.ts`：覆盖完整/不可用卡、起始 sCost、无目标、跨排优先级、全排固定、多意图目标数、倒地治疗候选、混合排固定槽、重复 ID、`prepared-attack` 依赖与失败原子性。
- 验证：`npm test -- player-card-edit` 7/7、`npm test -- battle-prepare` 9/9；原型类型检查通过。

## Execution Receipt 0201-U2（2026-10-03）

- 在 `GameplayBBattleRuntime` 中增加普通卡/独立技能目标编辑入口；`GameplayBRouteRuntime` 只转发当前战斗期间的请求。新 `BattleRuntimeView` 暴露完整卡组、回合起始 sCost 和按稳定 cardRef 编排的目标编辑能力。
- 只有校验完整拟提交行动集与冻结技能后才替换 pending round/skill snapshot；随后重算 `pendingRecipePlan`。普通编辑不改 RNG、skill checks、enemy intents、route events、HP 或 Click 数。追击/余震和 action modifier 关联仍锁定；独立急救目标可改写 free action 的目标。
- 验证：`npm test -- runtime` 28/28（两个 runtime 测试文件）、`npm test -- card-recipes` 8/8、原型类型检查通过。测试确认配方会按新目标更新，非法请求与技能不兼容重选不会部分写入或重掷。

## Execution Receipt 0201-U3（2026-10-03）

- `prototypes/gameplay-b/src/view.ts`、`src/style.css`、`src/main.ts` 加入单一跨栏拖拽 ghost、目标合法高亮、卡组选牌架、多目标临时选择/确认、Escape/pointercancel/lost capture 清理和键盘入口。当前卡片被锚定为原来的 `cardRef`；同批次更新同步卡面、sCost 标签、目标线和预览，不替换整页。
- 修复观察/待机卡不能打开重选架的问题；目标组无替代成员时卡片说明展示锁定原因；禁用选项保留半透明卡面及原因。预览更新保存滚动位置。
- `prototypes/gameplay-b/tests/battle-cards.test.ts` 增加目标组状态用例，覆盖多目标 drop 初选、固定槽、目标数不足/超限、补选及确认条件。
- 1280×720 浏览器核验：观察行动打开并关闭选择架；低 sCost 狙击 ghost 保持可见并禁用；键盘 Enter 打开卡组选项并能提交快速射击；拖拽千世攻击从冲撞者改到临时领头后预览同步；鼓舞卡对敌人非法放下后保持原目标，再改到纺希并在同一回合第二次改回由理。实际主 Click 结算修改后的准备行动，下一轮重新生成卡片。卡片关系、高亮、焦点与 invalid drop 清理均已核对。
- 当前 12 节点内容没有既有可变多目标玩家卡（`all` 必须保留全排语义，混合排规则目前只用于敌方意图），因此多目标确认 UI 用合成目标组定向用例验证，不临时更改游戏内容来制造场景。
- 验证：`npm test -- battle-cards` 6/6；原型全量测试 16 files / 134 tests；`npm run typecheck` 与 Vite build 通过。构建输出写入项目目录外 `C:\Users\15229\.codex\visualizations\2026\10\03\gameplay-b-card-edit-final-build`，没有写入或改动 `dist/`。

## 最终收据（2026-10-03）

- 三个子 Agent 的玩法、Draft 清晰度、引擎/交互只读审理先于施工；按三份意见裁定并实施，特别锁定 AoE 全组语义和技能 actionId 关联。
- 根目录 `npm run check:docs`：568 篇 Markdown、0 errors；`git diff --check` 通过。Git 报告的换行提示来自工作区既有文件，未改动这些文件。
- 本 Task 仅修改独立 `prototypes/gameplay-b/` 与本 Task 文档；没有修改 AC Runtime、引擎或 `src/ui/`，没有新增路线卡牌或战斗规则。
- 已完成 U1–U3，原型全测、类型检查、构建与浏览器验收通过；Task 可归档。

## 明确非目标

- 不接入 AC 运行时代码、`src/ui/`、正式项目入口或原型之外任何代码。
- 不重抽 enemy intent、不改变敌方目标、不更换 Chara、卡牌内容/效果/tag/费用/技能定义，不改 HP/sCost 恢复规则。
- 不因玩家编辑而重掷、重做或撤销本轮已冻结技能检定；不增加普通行动数、额外行动数或实时输入优势。
- 不调整全局三栏布局、设备兼容矩阵或重新设计卡片图层；沿用 Task 0200 层级与 Task 0198 批次寿命。

## 停止条件

- 当前 Task 的三个 Unit 是唯一施工入口；各 Unit 严守 Allowed Files。
- 若目标规则实际无法表达本 Task 列出的手选候选/组形状、已触发技能与选牌冲突没有可验证判定，或预计每 Unit 超出 3–5 个文件 / 300–500 行，先停在相关 Unit 并另拆 ADR/Task；不得顺手改变正式规则或 AC。
- 浏览器交互若要求重建整页、破坏滚动/焦点/cardRef 或把 turn settlement 移入普通卡点击，应停止并上交。

## 相关路由

- [[draft-0181-click-turn-location-gameplay-b]]
- [[draft-0183-gameplay-b-ui]]
- [[task-0198-gameplay-b-action-cards-and-hover-targets]]
- [[task-0200-gameplay-b-card-relation-top-layer]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/frontend-design-project-overlay]]
