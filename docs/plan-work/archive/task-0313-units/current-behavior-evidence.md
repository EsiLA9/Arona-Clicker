# Task 0313-U1：现状核实与差异定位

执行基线：HEAD `dff006165963978d74d95809e66426c9c18aa6b3`（2026-10-21）。执行时工作树有并行未提交改动；本 Unit 没有覆盖或修改它们。主要并行状态见 `git status --short`：`AGENTS.md`、若干 `docs/ai/` / `docs/plan-work/` 文件和四个其他测试文件有改动；本 Unit 不把这些列为自身修改。执行者只新增本证据和 `receipts/task-0313-u1-receipt.md`。

## 本 Unit 边界复述

- **Goal**：以源码和现有测试核实 MapRun 当前阶段、费用、目标、终局与存档事实，供后续合同审阅引用。
- **Allowed Files**：本文件 `docs/plan-work/archive/task-0313-units/current-behavior-evidence.md`、U1 Receipt `docs/plan-work/archive/task-0313-units/receipts/task-0313-u1-receipt.md`。不更新总 Task（由负责人维护），不改产品代码、测试、数据包或 Schema。
- **Non-goals**：不执行 E1 / 敏捷 Runtime，不写新测试/原型，不实施排序、Effect Program、Counter/Flag 或扩展状态；不替人批准玩法，不重做 0309 准备页。
- **Stop Conditions**：越白名单或新增路径、超预算/Read Set，源码事实冲突、实现依赖未裁定选择或扩大范围、必需验证失败/无法解释时停止并上报。本次没有发现会阻止只读证据交付的事实冲突；实现差异进入本证据，不替未来合同定案。

## 核实来源

- 规划定位：Task 0313 §2–§7；Draft 0312 §5.1–5.5；Task 0312 §2、§3.2–3.3、§4–§5；Report 0311 §6.1、§6.3–6.4；Task 0309 §状态、§2、§本轮施工进度。Draft/Task/Report 是待核主张或历史线索，以下实现事实以当前源码与现测为准。
- 源码：`src/data-services/contracts/gameplay-map.ts`（`GameplayMapActionDef`、`GameplayEncounterDef`）；`src/arona-clicker/services/map-run-service.ts`（`initialResourceBalances`、`createEncounterSnapshot`、`resolveEncounterCommitPlan`、`prepareEncounterRoundCommit`、`restoreEncounterCommitReceipt`、`restoreEncounterSnapshot`、`restoreRunState`、`createSaveSnapshot`、`restoreSaveSnapshot`）；`services/gameplay-b-action-preview-resolver.ts`（`resolveGameplayBActionPreview`）；`services/map-card-effects.ts`（`resolveMapCardEffects`、`mapScostCost`）；`contracts/map-run.ts`（Receipt/Snapshot）；`runtime-game-instance.ts`（`commitMapEncounterRound`）。
- 测试：本次指定的四份 engine 文件实际运行；另以测试名/断言定向查看 `tests/data/gameplay-b-map-registry.test.ts` 的 Action/source 校验与 `tests/ui/gameplay-b-map-vertical-slice.test.ts` 的 map-entry 路径，不将未运行文件记为验证通过。

## 结算阶段与读写矩阵

| 阶段 | 实际计算/读取 | 暂存变化与跳过 | 真正安装点 | 代表证据 |
|---|---|---|---|---|
| 准备与折扣 | `resolveEncounterCommitPlan` 先调用 `resolveGameplayBActionPreview`，验证准备行动/目标；`resolveMapCardEffects` 校验真实 CardRef/Scope并算常量折扣。范围含 run/map/node/activity/round。`mapScostCost` 折扣只减该 Action 原始 Actor `sCost`，折扣合计上限截到原成本，不赠资源。 | 只生成 plan；未写 Run、库存、HP 或 RNG state。己方折扣预先对参与来源计算；Enemy 的卡牌效果只能给其声明顺序中后续 Enemy 增折扣。 | 先保留在 detached plan；见末尾 prepare/install。 | `map-run.test.ts` “preserves a manually confirmed sole default target…”；`map-cards.test.ts` “discounts on an unplayed Hand card…”、“a new round has no inherited discount…”、“discounts cannot fund unrelated costs…” |
| 固定队伍行动（natural / Swap / PlayerCommand / Wait） | 按 `preview.preparedActions` 固定队伍顺序遍历。自动目标在此前暂存 HP 上重选；显式选择保留。目标合法时生成 resourceChanges，并当场顺序更新规划 HP。 | `Wait` 是空行动；noLegalTarget 时留下 skip settlement，不收 Actor/Team Action cost。`playerCostSpent` 在 skip 判断前累计，因此 PlayerCommand 即使自动目标无替补仍需支付 PlayerCost。合法 PlayerCommand 的 Actor/Team cost 仍进入聚合；Swap 本身 PlayerCost=0，但替换 Action 的成本照常。 | HP 尚仅在 `partyHpAfter`；结尾与资源、来源 HP 一起进入下一个状态快照。 | `map-run.test.ts` “reselects automatic Character targets…”、“keeps an already paid PlayerCommand fee…”、“charges Swap as free and PlayerCommand once…”、“allows a full Wait round…”、“keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict” |
| 己方费用聚合与资源 | 固定队伍Action的Actor/Team costs及PlayerCommand/Ability的PlayerCost收进 `playerCostRequired` / `requiredCosts`。按 MapRun 起始余额合并同一账户预检；费用不足整轮拒绝。确认可付后，先从起始余额扣全部聚合成本，再按资源结算列表（队伍 Action → Ability → Item）应用 resource effect。正向 effect 不可资助本轮前置费用。 | skip 行不会产生 Action resource cost/effect；但 PlayerCommand skip 仍可能花 PlayerCost。 | 余额变化只暂存于 `actorBalances`、`teamBalances`，尚未安装。 | `map-run.test.ts` “keeps the natural Team budget payable, but allows a later Swap to make it unaffordable”、“keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict”；`source-transactions.test.ts` “combines Ability and PlayerCommand PlayerCost from the Commit start balance” |
| Ability / Item HP | Ability 要来自 Encounter 暴露的 Action ID；Item 要符合 Encounter 的 item→action 映射。两者为 actorless source，目标不合法/过期时报错，不生成 `sourceActor`。Registry及isActorlessSourceAction禁止其任何额外Action costs（包括Team），非空拒绝，不是忽略；Ability只收PlayerCost1，Item只扣库存1。来源 HP 被放入 `pendingHpActions`，待所有己方聚合成本及所有 resource effects 处理后，再依 Ability → Item 次序应用。普通 Character HP 已先在上一个阶段暂存。 | Ability 计 1 PlayerCost；Item 不计 PlayerCost。有效 Item 形成 `consumedCount: 1`；没有无效目标“跳过并扣除”的 settlement，目标无效则整轮拒绝。 | MapRun plan 与库存 plan 都可安装后，GameInstance 连续安装两 Owner，再发布外部 Item 事件。 | `source-transactions.test.ts` “settles all Character Actions, Ability, and Item in order; later sources pay and consume after an Enemy is defeated”、“keeps separate one-slot Ability and Item drafts…”、“MapRunService refuses an Item Commit outside…” |
| 首次终局判定 | 全队 HP=0 优先 failure；否则所有敌方 HP=0 才 battle victory；无敌人的有限 rounds Encounter 到达声明轮数才 victory。 | 若己方阶段已经终局，后续 Enemy 不执行；完整己方行动、Ability、Item 阶段已走完后才检查，故同轮击败 Enemy 不截断 Ability/Item。 | 仍在 plan 中。 | `map-run.test.ts` “keeps faction-scoped Enemy targets…, settles overkill costs, and auto-wins without an Enemy turn”；`source-transactions.test.ts` 上述 later sources 用例 |
| Enemy 循环 | `preview.preparedEnemyActions` 按 Enemy 声明/队列顺序。每只先判断自身是否 defeated，再看轮是否已终局；重选当前合法目标，计算折扣与 cost；在当时余额单只预检，足够则即时 cost→resource effect→HP，之后检查队伍失败优先于全敌击败。 | defeated / roundEnded / noLegalTarget / unaffordable 不扣该来源资源。欠费 Enemy 被标 `unaffordable`，不影响后续 Enemy。己方轮初余额预检与此不同：Enemy 可被前一 Enemy 本轮资源变化影响。 | 逐只变化仍仅存在 planner 的余额/HP Map。 | `map-run.test.ts` “skips a defeated Enemy natural action for free…”、“resolves Enemy turns in declaration order, stops on party defeat…”、“applies recovery, defense, and attack tendency…” |
| 安装、推进与外部事务 | `prepareEncounterRoundCommit` 由共享 planner 产生下个 snapshot、receipt 与 result；`canInstallPreparedEncounterCommit` 检查 plan 未过期且对应当前 slot；`installPreparedEncounterCommit` 只安装预先计算状态。 | 终局不进入下一 Enemy 阶段。非终局则调用 `createEncounterSnapshot` 推进同一 Encounter 下一轮并 draw Hand。Item 先取得 GameInstance 的库存 detached plan，双方再次校验后连续安装；回调/事件在安装后。 | `installPreparedEncounterCommit`；Item 路径由 `runtime-game-instance.ts:commitMapEncounterRound` 原子协调。 | `map-run.test.ts` “commits prepared actions and resolved targets atomically…”；`source-transactions.test.ts` “saves an Item draft without consuming…”、“retains Item debit on party failure…” |

## 来源覆盖矩阵

| 来源 | 来源/目标有效性 | 主目标与费用预检 | Skip 与费用 | 终局后未执行 | 库存副作用 |
|---|---|---|---|---|---|
| Natural 固定队伍行动 | Action 必须属于该角色且仍在准备候选；目标按 kind、Roster/当前 HP、所选状态核验。 | 先计划 HP/目标；合法来源的 Actor/Team cost 加入己方全轮起始余额聚合。`sCost` 经己方准备期折扣。 | 没有合法卡目标等 skip 不付 Actor/Team cost；Natural PlayerCost=0。自动目标可在之前暂存死亡后 fallback。 | 队伍己方阶段始终继续到 Ability/Item，再统一查终局；若终局则不执行 Enemy。 | 无外部库存。
| Swap | 请求的 Action 必须在该 Character 当前 Hand，确认后成为 Prepared Action；可还原 natural。 | 与替换后的 Action 一样参与己方聚合，Swap 操作自身免费；折扣作用于最终活动 Action/CardRef。 | 不是额外出牌；无单独资源成本。替换后行动被 noLegalTarget skip 时同 Natural。 | 同 Natural。 | 无。
| PlayerCommand | 可选 Hand-out Action 经 command 选择并在 Commit 重核；无效/旧版本拒绝。 | 额外 PlayerCost=1；Actor/Team 成本若行动可执行也汇总预检。 | `playerCostRequired` 在 noLegalTarget skip 之前累加；所以可能花 1 PlayerCost 而不付 Action 成本。 | 同 Natural。 | 无。
| Enemy | Action 必须属于当前 Enemy 的 declared pool；目标在当前阵营/HP 状态中重选。 | 每只 Enemy 到执行时按当时余额单独检查成本；扣费/资源/HP即时进行；折扣源只影响后续 Enemy。 | defeated、roundEnded、noLegalTarget、unaffordable 均不支付该来源 cost/effect。 | 该 Enemy 自身死时记 defeated；其他存活 Enemy 若前一动作造成终局记 roundEnded；后续 Enemy 不执行。 | 无。
| Ability | Action ID 必须由 Encounter 暴露；Actorless 目标符合声明，否则拒绝整轮。 | 仅1 PlayerCost进己方PlayerCost聚合；Action costs非空在Registry和Runtime拒绝，包括Team；HP在资源阶段后应用。 | 无自动 skip 分支；非法/无目标会拒绝整轮而非扣费后静默忽略。 | 本阶段不会被队伍击败 Enemy 终局截断。 | 无物品库存。
| Item | itemId/actionId 必须匹配 Encounter 映射；Actorless 目标合法。 | 无PlayerCost，仅库存消费；Action costs非空在Registry和Runtime拒绝，包括Team；HP在资源阶段后应用。GameInstance 检查 Consumable/useCondition/数量。 | 不可用/缺货/目标或 token 失效均失败且两 Owner 不写；有效使用即产生一次消耗计划。 | 队伍结算后 Enemy 被击败仍会正常安装已使用 Item；队伍失败也保留有效已提交 debit。 | 成功提交消耗 1 次；请求重放不重复消耗；可恢复到旧 Save 是整体回滚而非该 Receipt 自动撤销。
| Wait | Hand 为空且 Prepared Action `actionId=null`；必须没有目标、override 或 PlayerCost。 | 不取目标、不生成资源成本/效果。 | 以零费用结算，不改资源。 | 不改变后续队伍阶段结构。 | 无。

证据锚点：`map-run-service.ts:1092–1185, 1192–1244, 1250–1305, 1314–1475`；`map-card-effects.ts:29–35, 39–86`；`runtime-game-instance.ts:1015`；`contracts/map-run.ts:221–257`。来源顺序不等价于“所有类型按一个序列交织”：普通队伍 HP 先在队伍循环规划，Ability/Item HP 后置到费用和资源之后，Enemy 每只按自身 cost/resource/HP 即时处理。

## 目标、终局及当前覆盖边界

- **自动 vs 显式目标**：自动单位目标按配置偏好从当前活着的合法单位重选，稳定排序在同优先值时保持确定；手动确认目标不会因该目标随后被本轮早期行动击倒而悄悄换人（合法身份的 HP effect 在 0 HP 上实际 delta=0，不能复活）。若未显式锁定且原自动目标已死，可 fallback；无候选才 skip。依据 `resolveEncounterCommitPlan` 的 `partyHpAfter`/`enemyHpAfter` 与 `tests/engine/gameplay-b-map-run.test.ts`：“preserves a manually confirmed sole default target…”、“reselects automatic Character targets in order…”、“keeps faction-scoped Enemy targets…, settles overkill costs…”、“commits an automatically selected party target…”。
- **非法身份与Scope**：明确目标不在允许的固定 Party / 当前 Encounter Enemy roster、Action target kind不符、CardRef run/map/node/activity/round错配、目标过期或来源失效都会使 plan/command 被拒绝；不把“外来非法目标”当作合法目标后倒地。对应 `gameplay-b-action-preview-resolver.ts:224`、`map-card-effects.ts:39–80`、`restoreEncounterCommitReceipt`，测试 `map-run.test.ts` “sets, clears, and restores a legal party target while rejecting an invalid or stale target”、“accepts consistent multi-override receipts while rejecting forged override kinds…”；`map-cards.test.ts` “card targets resolve existing scost-bearing cards by source-relative side…”、“save/load preserves current identities…”；Registry 测试 “rejects malformed Enemy candidates…”、“does not treat an Enemy-pool Action as an actorless Ability or Item Action”。
- **目标源失效**：敌方自然目标死亡后依据当前活体重选；没有合法受用方时该 Enemy 免费 `noLegalTarget`。固定队伍 Action 自动目标没有替补时免费跳过其 Actor/Team cost；PlayerCommand 的 PlayerCost例外见矩阵。Ability/Item 的无效显式目标为整轮拒绝。
- **HP 0 与同轮结局**：HP change 截到 `[0, cap]`；目标已为0时保持0、记录delta=0。己方 Action 的 HP规划仍按固定队伍顺序逐项变化；全部己方 Actions、Ability、Item之后判一次终局。Battle全队倒地优先 failure，全部Enemy 0才 victory；Enemy阶段每只处理完也按 failure优先。失败清空活动 Encounter/Activity并产生运行期 `failureResult`；success/failure terminal result 不进入可恢复 Run存档。`source-transactions.test.ts` 确认 Item 在 party failure 时保留已提交扣除；Item debit不随 MapRun失败自动回滚。
- **覆盖缺口**：当前自动化没有新的统一敏捷度队列/交织来源规则；不要把现有 Enemy 分阶段执行、旧费用政策或Receipt分组写作未来排序合同。对具体未测组合，记“缺当前自动化证据”，交 U2/U3/U4 决定是否在文档 fixture 覆盖；本 Unit 未新加测试。

## Receipt、checkpoint、幂等及随机状态

| 对象 | 已保存字段/边界 | 恢复时核验 | 证据与含义 |
|---|---|---|---|
| Encounter Receipt | `requestId`、command/resulting Commit version、node/activity/round/draftVersion；固定队伍顺序 `settlements`，Enemy声明顺序 `enemyActions`（若有）、独立 `ability`、独立 `item`。有实际目标、resourceChanges、HP delta、cost/discount、skip reason、PlayerCost和consumedCount；没有一个统一跨源执行序列，也没有每条程序语句身份/路径。 | `restoreEncounterCommitReceipt` 核对当前 Map/Encounter/来源合法性、版本递进、顺序、cost/discount/receipt pairing、Action/目标/HP/resource变化的可接受范围等；不把 Receipt 直接当任意执行脚本重放。 | `contracts/map-run.ts:188–257`；`map-run-service.ts:1597+`；`map-run.test.ts` “accepts consistent multi-override receipts…”、“commits prepared actions… restores and deduplicates…” |
| active Encounter checkpoint | node/activity/round、party与Enemy Hands、Enemy资源与HP、行动覆写/目标选择、Ability/Item draft、draftVersion、`drawCursorStart`、`randomState={algorithm,seed,cursor}`、最新 Encounter `lastCommit`。 | `restoreEncounterSnapshot` 核对当前 Encounter、roster/hand/目标/版本/随机算法与游标关系，并用 `resolveGameplayBActionPreview` 重建可行动状态；无法核对就拒绝。 | `contracts/map-run.ts:282–320`；`map-run-service.ts:2000–2291`；`save-resume.test.ts` “round-trips an in-progress MapRun…” |
| Run checkpoint | 顶层 `{mapId,resumeVersion,run}`。Run保存固定队伍、HP、MapRun Actor/Team资源、PlayerCost、全局 `commitVersion`、位置/访问/已完成活动、active activity/Encounter、最新成功 Receipt；不存Map定义。 | Owner须为空且有 Registry Variant lookup；按当前 Registry resolve Map，要求 identity / `resumeVersion` 完全匹配，再严格恢复 Run、状态、资源与 Receipt；失败不安装。无迁移兼容层。 | `contracts/map-run.ts:335–405`；`restoreRunState`、`restoreSaveSnapshot`、`createSaveSnapshot`；测试 “round-trips…”、“rejects checkpoint restore without a Registry Variant lookup…” |
| 幂等和终局 | 相同 `requestId` 必须命令和 draft token相同；MapRun `commitVersion` 与 Encounter `draftVersion` 联合防 stale。上一成功 Receipt存档供普通重放去重；终局 Run已清 Owner时依内存 `terminalCommitReplay` 重放。terminal success/failure 不可通过 `createSaveSnapshot` 保存；失败摘要仅运行期。 | 同请求不同输入拒绝；恢复前最近 Receipt版本一致性核验。旧 Save可选择整体恢复到旧状态，非自动事件撤销。 | `prepareEncounterRoundCommit:2852–2905`、`restoreRunState:2370+`、`createSaveSnapshot:3391–3403`、`source-transactions.test.ts` replay/failure tests |
| Hand RNG | Encounter的 `randomState` 保存 algorithm/seed/cursor；`drawCursorStart`记录最新 draw前cursor。`createEncounterSnapshot` 在未传入已有state时 Math.random生成 seed，然后在该 Encounter 初始化 Hand；同 Encounter下一轮传入现有state，继续seed/cursor。 | Encounter恢复验证算法、整数seed/cursor、round-1 cursor=0、drawCursorStart≤cursor及 Hands与定义一致；保存恢复/继续由定向测试覆盖。 | `initializeEncounterSeed:586–588`、`createEncounterSnapshot:617–648`、`restoreEncounterSnapshot:2033–2044`；`map-run.test.ts` “filters unit Actions without legal targets before drawing and preserves the RNG cursor”、“draws Enemy Hands after party Hands…”、“commits prepared actions…”; `save-resume.test.ts` |

**随机路径核证**：纯 Preview（`previewEncounterCommit`→`resolveEncounterCommitPlan`）不推进Encounter，也不调用`createEncounterSnapshot`，因此不分配新seed；费用/目标规划读取已有Hand。非终局 prepare/Commit续同一 Encounter 时传入现有`randomState`，不会执行默认`initializeEncounterSeed`，但会 draw下一轮Hand并推进cursor。若终局推进到同一Node的下一个Encounter activity，`advanceCompletedActivity`→`openNodeContent`会用未传randomState的`createEncounterSnapshot`为新Encounter调用 `Math.random`；离开旧Encounter后未来进入新的 Encounter 也重新分配seed。该随机分配发生在生成 detached prepared next state的调用栈，而非纯 Preview。未制作最小复现，故不称为RNG bug；建议后续断言：固定 Math.random，重复调用“完成当前activity且打开下一个Encounter”的 prepare，观察 prepared seeds/Hands与安装/重放稳定边界，再由负责Unit裁定是否需要改造。

## Task 0312 → 当前证据 → 推荐/混淆 → 后续ID

| 0312主张/段落 | 当前事实 | 推荐与易混淆点 | 后续裁定 |
|---|---|---|---|
| Draft §5.2、Task §3.3：HP/目标先规划，确定实际来源与费用后扣起始余额、应用资源 | 方向成立但有来源边界：普通队伍 HP按队伍顺序先规划；己方PlayerCost（含Ability1）与实体Action的Actor/Team costs全轮聚合，Ability/Item额外Action costs禁止；资源按队伍→Ability→Item变化；Ability/Item HP后置；Enemy之后逐只即时 cost/resource/HP。 | 旧E1可保持分阶段兼容；要把所有来源按敏捷交织会改变真实费用和HP次序，必须提供另一个完整阶段表及可观察顺序例子。避免“统一逐条Effect程序顺序”误述现状。 | D02、D04、D05、D11、D12 |
| Task §2、§3.3：需细分skip和起始余额规则 | 防止误读（原文并未断言全skip免费）。noLegalTarget免费的是Action Actor/Team costs；PlayerCommand PlayerCost在skip前累计。己方费用以起始余额聚合；Enemy按队列逐只当时余额判断。 | 按来源和两条成本通道记录。PlayerCommand skip是否仍付PlayerCost在当前事实中明确为会；未来是否在敏捷规则保留/改写归玩法裁定。 | D02、D04、D11 |
| Draft §5.4、Task §3.2：非法目标拒绝；自动fallback；合法目标同轮被击倒不悄换/HP0不复活 | 与当前目标重核大致一致；自动目标在当前规划 HP上可fallback；明确选择保留，HP0 delta0；外来非法/过期/Scope错配另属拒绝。 | 将“合法且之后倒地”与“开局即非法或来源失效”分开。已知行为为当前实现，不自动批准新敏捷执行顺序时的窗口和补偿。 | D04、D07、D11 |
| Draft §5.5、Task §4：终局、未执行来源与保存 | 当前终局先完成固定队伍、Ability、Item，再判；然后Enemy逐只进行，遇terminal对后续标roundEnded；failure优先。Task对失败时库存/rollback边界的历史证据也由transaction测试补强。 | 敏捷Runtime若中途终局，应选即时停还是阶段末停并明确已付来源；纯技术存档结构可由合同记录，不需人类选型。 | D05、D07、D11 |
| Task §3.2、§5：Receipt顺序/恢复/幂等/RNG | Receipt按party/Enemy分组另列Ability/Item，没有统一事件序列。checkpoint存活跃Run与Encounter完整当前状态和游标；以当前Registry及resumeVersion恢复；terminal结果仅运行期。新Encounter seed默认由Math.random产生；pure Preview无该调用，但activity推进prepare调用链可能新建Encounter。 | 新的有序结果若让后续审阅/恢复依赖跨来源执行顺序，Receipt需定义一个有界、可复验表达；不要误说当前Receipt已经能表达全局执行顺序。RNG只记录上述可观察边界，未重现不报bug。 | D07、D11、D12；随机重入断言待U4/后续产品测试范围明确后再决定 |
| Task §2、0309、Report 0311：Map entry/准备页 | Task 0309现状态 `complete`；其进度列U1–U10，U9迁入vertical-slice回归，U13浏览器验收。Report 0311属于历史快照；报告旧失败不得替代本次运行。 | 不再重做准备页；实际入口/map-entry链由现有vertical-slice文件作为历史完成依据。本U1只运行了四份engine基线测试，不声称本次运行UI/data测试。 | 无（事实已足够）；U5统一回写/地图复核 |

## 测试证据

指定命令原样运行并通过：

`npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-save-resume.test.ts`

为获得清楚的逐文件计数，在同四文件上追加 `--silent` 复跑一次（同样成功）：

| 文件 | 测试数 | 实际结果 |
|---|---:|---|
| `tests/engine/gameplay-b-map-run.test.ts` | 46 | pass |
| `tests/engine/gameplay-b-map-cards.test.ts` | 18 | pass |
| `tests/engine/gameplay-b-map-source-transactions.test.ts` | 7 | pass |
| `tests/engine/gameplay-b-map-save-resume.test.ts` | 7 | pass |
| **合计** | **78** | **4 files passed / 78 tests passed** |

Vitest v2.1.9；定向复跑duration 6.04s，exit code 0。初次运行也通过，因本地事件输出很大而被界面截断，复跑只为取得可读逐文件计数。额外只读查看的测试名/断言不算执行验证；未运行 `check:docs` 或全局类型/测试（U1指定命令只有以上四份）；文档空白、链接和U5地图收尾仍由主Agent/U5统一核查。

## 事实结论和待后续裁定

- 当前 planner不是统一来源逐条排序executor。己方固定队伍HP/目标在顺序循环更新；全轮己方/Ability/Item费用按起始余额预检后应用资源变化；Ability/Item HP之后再处理；终局点后才进入Enemy逐只动态执行。这是 E1 兼容线与未来敏捷顺序的关键差异。
- Skip不等于所有费用免费：对没有合法目标的PlayerCommand，PlayerCost仍可能支付；Actor/Team Action costs/effects不支付。Enemy skip成本则不支付。
- Receipt是分组摘要，不能声称它有全来源的统一执行序列。Save/Resume有 `mapId + resumeVersion + run`、完整active Encounter/RNG和严格当前内容核验；terminal result不持久化。
- 纯 Preview没有seed分配；完成Encounter推进到下一Encounter activity的prepare调用链会建新Encounter并可能分配Math.random seed。当前没有最小复现支持“有bug”结论。
- 尚需玩法裁定/对未来混合排序有影响：D02费用/折扣、D04目标失效和skip、D05终局/停轮、D07 Receipt/Resume表达、D11来源入队/Actorless/快照、D12 E1兼容与敏捷的先后合同。U1不批准、不选择这些玩法差异。
- GALHCG变更/健康复核留给U5统一只读复核；本Unit只用 `graph_project` 身份核对与局部 `graph_search` 定位，未刷新、编辑图或写 freshness。

## Hand 候选边界补记

本轮费用证据不等于可在任意起始余额中直接提交任意 Action。现有测试表明 Hand draw 会按自然行动资格/起始费用预算筛选候选，且按 Party 顺序为自然 Hand 保留 Team 成本；未付得起的 Wait Hand 不会被抽出。PlayerCommand 候选单独暴露 `canPayPlayerCost` 与 `canPayActionCosts`，执行时再次核验。证据：`tests/engine/gameplay-b-map-run.test.ts` “reserves natural Hand-first Team costs in party order and does not draw an unaffordable Wait hand”、“filters unit Actions without legal targets before drawing and preserves the RNG cursor”、“rejects unpayable Action costs and unavailable PlayerCost Commands with zero writes”；`gameplay-b-action-preview-resolver.ts:600–614`。因此后续敏捷度费用fixture需选用现有可合法准备/抽取的来源，并设计真实余额/补给，避免把“不可被选入Hand的欠费Action”当成新排序合同的入场来源。此为测试设计提醒，不替代U2/U3玩法裁定；A04仍明确限制敏捷度不影响抽取概率或行动次数。
