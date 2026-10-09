# Unit 0241-U13：Context 与 CardCondition Admission 闭环

## Goal

闭合 U10 真实 Datapack/Registry 内容经 `OperationEntry.start()` 到 Character Hand 的校验通路。Runtime validators 必须接纳并验证 E1 新增的 Event Location `interactionSceneId` / `activityId` / `cardPoolIds` 和 Action `cardCondition`，不得把合法解析出的定义判为 unsupported。Pool 引用、selector / Condition shape 与事实 ID 必须由现有 Admission 校验，不得绕过标准入口。

## Evidence / Read Set

- `docs/plan-work/archive/task-0241-units/receipts/0241-d1-gameplay-b-strategy-park.md`：Registry counts、142 条诊断、旧 Carousel 对照及精确漏接字段证据。
- `src/data-services/contracts/operation.ts`：Location、Action Condition、CardPool author contract。
- `src/data-services/registry/operation-content-validation.ts`：Datapack 合同和 Registry 引用校验的现有源头。
- `src/arona-clicker/services/registry-operation-content-resolver.ts`、`src/arona-clicker/services/operation-participant-admission.ts`：Registry resolve 到 Admission 的数据 handoff。
- `src/arona-clicker/services/operation-definition-validation.ts`、`src/arona-clicker/services/operation-tactical-definition-validation.ts`：当前拒绝新字段的 runtime validators。
- `tests/engine/operation-participant-admission.test.ts`、`tests/engine/gameplay-b-strategy-park-sample.test.ts`：Admission 集成与 U10 可玩行为。

## Constraints

- 将改动限于已有两个 runtime closed-field validators 及其真实 Admission/RunStart 行为测试；不改 Registry resolver / Data Services validator，除非有新的 source evidence 证明其 handoff 也丢字段；当前 U10 Receipt 已排除此点。
- `Location.interactionSceneId` / `activityId` 必须是合法非空 ID，`cardPoolIds` 是无重复 ID 列表；Action `cardCondition` 必须闭合到 E1 已声明的六个 selector / Event Fact 字段，正确验证数组和 ID 形状。
- `requiredFactIds` / `forbiddenFactIds` 仍不得引用 Event 未声明事实；池和池条目 Action 引用仍由既有 Admission 闭合，不扩大泛化条件 DSL。
- 行为测试必须通过 `createRegistryOperationContentResolver`/标准 Registry，最终 `OperationEntry.start()`。分别证明：①匹配的 Pool selector 让 Pool 命中且行动进入 Hand；②selector 的 scene 或 activity 不匹配时 Pool 不命中且其行动不进入候选；③独立的 Action `cardCondition` 不匹配时，即使 Pool 命中该行动仍被过滤；④至少一个非法 Condition 或 Location 字段的反例。Pool selector 与 Action Condition 是两个过滤层，不能用一个反例替代另一个。
- 不修改 U10 数据文件、U10 测试 / Receipt、U12、UI、Editor、Schema、GALHCG 或本 Unit 白名单之外文件。完成 U13 后由 Task Owner 验收，再恢复 U10。

## Allowed Files

- `src/arona-clicker/services/operation-definition-validation.ts`
- `src/arona-clicker/services/operation-tactical-definition-validation.ts`
- `tests/engine/operation-participant-admission.test.ts`
- `docs/plan-work/archive/task-0241-units/receipts/receipt-0241-u13-context-card-condition-admission.md`

`tests/engine/gameplay-b-strategy-park-sample.test.ts` 可由 U13 运行作集成验收，但不在白名单中、不得修改；新增正负例放入 `operation-participant-admission.test.ts`。

## Completion Criteria

- [ ] 新字段经 Registry resolver 保留到 Admission/RunStart，不再产生 `contains unsupported field`。
- [ ] Location Context、CardPool 引用、Action `cardCondition` 的 shape、唯一 ID 与 Event Fact 引用均通过正例/负例验证。
- [ ] 标准 RunStart 的 Hand 解析依 Context 匹配筛选行动；Condition 不匹配的池 Action 不进入 Hand。
- [ ] U10 之前的 Carousel、Operation Admission 及策略 Hand 定向行为仍通过。
- [ ] Receipt 报告实际验证结果与允许路径；U13 本身不修改 GALHCG。U13 Engine 行为验收通过后先完成 Engine GALHCG 增量，之后恢复 Director U10/U11；内容人工验收后再独立更新 D1/D2 GALHCG。

## Verification

- `npx vitest run tests/engine/operation-participant-admission.test.ts tests/engine/gameplay-b-strategy-park-sample.test.ts --reporter=dot`
- `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts --reporter=dot`
- `npx tsc --noEmit`
- `git diff --check`

## Receipt

`docs/plan-work/archive/task-0241-units/receipts/receipt-0241-u13-context-card-condition-admission.md`
