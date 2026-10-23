# Task 0319：Gameplay B E5 Prepared Tag 连携攻击

状态：completed（2026-10-22）— 已交付冻结的 Party Prepared Tag 数量条件、回合起始快照、Receipt 重算与正式可进入的连携攻击 Map。

## 目标

让 Map Action 按当前 Encounter 本轮实际准备的 Party Actions 读取静态 Tag 数量，并在条件成立时顺序执行追加效果。首片交付“至少准备两张爆破卡，追加 1 点主目标伤害”的作者样例。

本 Task 不实现相对 CardRef、伤害／治疗 Modifier、交换顺序、递归触发或通用队列。其他 E5 能力继续各自冻结和立项。

## 冻结合同

- Effect Program 新增叶条件 `{ kind: 'preparedTagCount', side: 'party', tag: TagRef, comparison, value }`；`comparison` 使用 `eq | lt | lte | gt | gte`，`value` 为非负安全整数。Side V1 只允许 `party`。
- 每个完整回合计划开始时，从 `GameplayBActionPreview.preparedActions` 生成一次不可变快照；每个 Party Character 最多贡献其一个非空 `preparedActionId`。快照先于任何来源效果计算，所有 Party、Ability、Item 与 Enemy Effect Program 共用同一份快照。
- 快照包括本轮已选 Hand Action 与已选 PlayerCommand Action；Wait（`preparedActionId: null`）、未选 PlayerCommand 候选、Ability／Item、Enemy Hand／Enemy Intent、卡牌 UI 的重复呈现均不计入。Action 后续因 `noLegalTarget` 等原因跳过时仍算本轮已准备的 Party Action。
- 每个准备来源至多计 1 张：同一 Action 声明多个匹配 Tag 或重复展示仍只计一次；不同 Character 实际各持有并准备同一 Map Action 时计为两张。按既有完整 TagRef 与同 namespace 层级前缀规则匹配；候选权重和 Pool 来源不增加计数。
- `preparedTagCount` 只读上述回合起始快照，不随先前来源的效果、HP、Enemy Intent 或后续分支变化。该条件不得用于 Encounter completion；completion 没有 Prepared 快照。
- 连携伤害是同一 Effect Program 的普通有序语句：先执行作者写出的基础 `damage`，再经 `when` 条件执行 `damage 1`。沿用既有单条 Target／伤害边界和整轮访问预算，不生成事件、不重入来源、不产生递归链；已归零目标的后续伤害为 0。
- Planner trace 对叶条件记录完整的 side、TagRef、快照 count、comparison、value 与 result。Receipt Validator 根据已提交 Party settlement 中各角色的实际 `actionId`，从当前 Map Action Tag 定义独立重算同一快照和所有条件结果；Wait 与未选命令没有 actionId，Enemy Actions 与 Actorless sources 不纳入计数。保存／恢复重验不依赖 UI Card 数或临时浏览器状态。
- 既有 E1/E2 Program、Visit 与 Receipt 语义保持；不增加 Run 持久状态。新增示例 Map 使用独立 Map ID，并由 Gameplay B 正式 Datapack 装载。

## 已核实事实

- Task 0317 已实现 Map Action `tags?: TagRef[]`，候选池用 `matchesTag()` 的同 namespace 层级前缀语义；静态 Tag 当前只参与分类和候选选择。
- `resolveEncounterCommitPlan()` 先解析包含每名 Party 成员有效准备行动的 Preview，再按 Party、Actorless、Enemy 顺序规划来源；Enemy 意图和未选 PlayerCommand 选项分别保存在不同字段。
- `planMapEffectSource()` 已按有序有限 Effect Program 评估 `when`，并将 guard reads 放进 Effect Trace。`MapEffectReceiptValidator` 会根据 Action Program 重建分支、条件访问与状态链。
- `MapRunEncounterCommitReceipt.settlements` 按固定 Party roster 为每人保留实际 `actionId` 或 Wait 的 `null`，`overrideKind` 能区分 PlayerCommand；Enemy 结算在单独 `enemyActions` 字段。
- 当前条件语法只有 HP、局部 Counter／Flag 和逻辑组合；生成 Schema 来自源合同，不手工编辑生成 JSON。

## 验收

- 合法 TagRef／比较／数量能被 Syntax、Registry 与生成 Schema 接受；错误 Side、裸／非法 TagRef、未知比较、负数／非安全整数值和 completion 中的 Prepared 条件被拒绝。
- 规划器证明 Party Prepared Tag 快照先冻结：每名 Party 准备源至多计一次、selected PlayerCommand 计入、Wait／未选 Command／Enemy Intent 排除；同一快照传给后续来源，来源效果不能改写计数。
- Receipt 重放能从 Party settlement 重算条件，拒绝伪造 Tag、count、comparison、result 或错误分支；保存／恢复及终局 Receipt 校验保持一致。
- 可进入的 DataPack 示例演示两张爆破卡使一张支援攻击按顺序造成 2+1 伤害；不足两张时只造成 2，主目标剩余 HP 不足时正常 clamp。
- E1/E2 现有 Program、准备费用与 Status Receipt 边界不变；Schema、类型、架构与文档检查通过。本 Task 不增加 UI，也无需实屏验收。

## 施工单元

### U01 — 作者条件、语法、Registry 与 Schema

Allowed Files：

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由生成器更新）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`（仅必要时）

完成条件：新增闭合 `preparedTagCount` 条件、TagRef 与边界校验；递归拒绝 completion 中的 Prepared 条件；生成 Schema 与 Registry 语境同步。

### U02 — 快照、纯规划与 Receipt 重放

Allowed Files：

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- `tests/engine/gameplay-b-effect-program.test.ts`
- `tests/engine/gameplay-b-effect-program-commit.test.ts`
- `tests/engine/gameplay-b-effect-receipt.test.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`

完成条件：整轮开始时取唯一 Party Prepared Tag 快照并注入每个 source plan；Condition read trace 可审计；回执重放从固定 Party settlement 和 Map Tag 独立复算。

### U03 — 正式 DataPack 示例与作者文档

Allowed Files：

- `src/arona-clicker/content/gameplay-b/gameplay-b-prepared-tag-combo-example.ts`（新文件）
- `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`
- `tests/engine/gameplay-b-prepared-tag-combo-example.test.ts`（新文件）
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/examples/gameplay-b-prepared-tag-combo.md`（新文件）
- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/00-index.md`
- `docs/plan-work/task-0319-gameplay-b-prepared-tag-combo.md`

完成条件：正式包提供可进入的独立 Map；示例测试验证两张 Tag 卡触发 2+1、有一张时不触发，作者文档列出准备快照、计数和边界。

## 验证计划

- 运行条件 Syntax／Registry／Planner／Commit／Receipt／Save-Resume 与真实示例的定向测试，以及 Schema 同步测试。
- 运行 `npm run gen:schema`、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 和 `git --no-pager diff --check`。
- 完成时按项目入口只读检查直接影响文件；不编辑图、不刷新索引或写 freshness。

## 执行结果（2026-10-22）

- U01 完成 `preparedTagCount` 条件合同、TagRef 与数值校验，并拒绝 completion 使用 Prepared 快照；生成的 Datapack Schema 已同步。
- U02 从 Preview 的有效 Party Prepared Actions 冻结快照，所有来源共享；选中 PlayerCommand 计入，Wait 与未选选项排除。Planner 对 TagRef 层级匹配并为 guard 记录 count；Receipt 验证从实际 Party settlements 和当前 Map Action Tag 独立重算。修改 Receipt count 后被校验与 Save/Resume 拒绝。
- U03 新增“爆破连携演练”正式 Map Entry 和作者示例；两张爆破准备卡按 2 点基础伤害再追加 1 点结算，一张时只造成基础 2 点。
- `npx vitest run --silent` 定向运行 7 个文件，共 **112/112** 通过：Syntax 9、Effect Registry 15、Planner 19、Prepared Tag 示例 3、Save/Resume 7、Receipt 44、Schema 同步 15。
- `npm run gen:schema`、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（1191 篇 Markdown，0 errors）与 `git --no-pager diff --check` 均通过。没有新增 UI，本 Task 不需要实屏验收。
- GALHCG 对 [[docs/docs-829/03-data-structures/datapack-contracts]] 的 changed-scope 只读复核已分页完成：该文件有 7 个关联 owner，其中 4 条 Evidence 因文件内容变化而 stale；这与此前 E3／E4 收尾报告一致。其他直接实现文件无已核实的关联依据，不据此造图或补边。本 Task 未编辑图、未刷新索引、未写 freshness。

## 后续 E5 子题

Task 0319 只交付 Party Prepared Tag 数量条件与一次性顺序追加样例，不代表 E5 整体完成。相对 CardRef 的合法受用对象、可观察费用接收者、效果 Modifier、战术位置、临时 Item、成长快照、Result Adapter 等未完成能力统一归并到 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]。
