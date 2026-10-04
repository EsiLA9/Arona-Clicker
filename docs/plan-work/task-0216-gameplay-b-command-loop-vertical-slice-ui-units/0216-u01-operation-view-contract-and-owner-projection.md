# Unit 0216-U1：OperationView 合约与 Owner 投影

## Goal

为当前 Operation Run 增加窄只读 `OperationView`，通过 `operationEntry.getView(expectedRunId?)` 返回 detached 投影。保持 Run owner、冻结规则与内容解析器留在 Runtime 内部。

## Must Read / Read Set

- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/contracts/operation-beat.ts`
- `src/arona-clicker/contracts/operation-action.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `src/arona-clicker/services/operation-entry-service.ts`
- `src/arona-clicker/services/operation-intervention-preview.ts`
- `src/arona-clicker/services/operation-combination-resolver.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`

## Confirmed Facts

- `GameInstance.operationEntry` 是独立 facade；不把 Operation 状态放进 GameView。依据：`src/arona-clicker/runtime-game-instance.ts`。
- Run Slot 私有持有启动时冻结的 rules；读取不能再次调用 resolver。依据：`src/arona-clicker/services/operation-runtime-service.ts`。
- EventRun snapshot 提供静态学生资格、当前计划、Intervention、Resolution、track 等动态事实；它不含 opponent/environment 候选，也不逐项裁定当前地点、目标与共享费用是否合法。依据：`src/arona-clicker/contracts/operation.ts`。
- 动态候选必须结合 owner 冻结的 rules 与当前状态复用 `previewOperationIntervention()`；协同预览复用 `resolveOperationCombinations()`，不能自行简化费用/目标检查，也不能调用会掷技能的完整 Resolution planner。
- 低层 Runtime fixture 可以没有 tactical content；对这种 Run，公开 UI `getView()` 返回 null。带 `expectedRunId` 的读取若 Run 已更换也返回 null，避免旧 route 误读新 Run。

## Allowed Files

- `src/arona-clicker/contracts/operation-view.ts`
- `src/arona-clicker/services/operation-view-projector.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `src/arona-clicker/services/operation-entry-service.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u01-operation-view-contract-and-owner-projection-receipt.md`

## Constraints

- DTO 只包含 detached、可序列化 ID/value/合法候选/理由快照；不输出 EventRun、rules、resolver、ActionDef、mutable 引用、随机游标、roll 值或原始 RNG 消费量。可投影 Action cost 的 scope/resource/amount。
- View 从 Run Slot 当前已冻结 rules 和状态投影；禁止读取 View 时重新 resolve 内容或推进 RNG。
- 新字段按最小 UI 需求裁定；不得顺便改全局 GameReadModel / GameView。

## Explicit Non-goals

- 不定义游乐园样例展示文本、不接 UI route/controller、不更改存档。
- 不实现目标路线、正式结局或 EventOutcome。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若 View 必须触碰白名单外 Runtime facade/契约文件，停止并由 Task Owner 更新 Unit。

## Completion Criteria

- [x] facade 暴露窄 `getView(expectedRunId?)`，没有 raw owner/rules 出口；无 tactical content 或 Run ID 不匹配时返回 null。
- [x] 投影可读当前 Actor/Team/Track/基准及干预后计划/Intervention/Resolution 与逐项合法动作/目标候选及阻塞理由。
- [x] 替代 Action 暴露准确 Actor/Team cost；Resolution view 去除游标与技能 roll 细节，仅保留技能是否成功。
- [x] 返回对象深度 detached；调用前后状态、版本、resolver 次数及 RNG 不变。
- [x] 候选可用性复用纯干预预览逐个验证；非空组合只按有效计划投影，不掷 Skill RNG。
- [x] 运行时集成测试覆盖空状态/活动 Beat/已结算 Beat/无效 runId。

## Verification

- `npx vitest run tests/engine/gameplay-b-event-runtime-integration.test.ts`
- `npx tsc --noEmit`
- `npm run check:architecture`
