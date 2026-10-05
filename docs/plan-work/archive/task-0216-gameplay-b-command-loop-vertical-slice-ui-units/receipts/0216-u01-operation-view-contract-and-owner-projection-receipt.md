# Receipt 0216-U1：OperationView 合约与 Owner 投影

## Outcome

已完成。`operationEntry.getView(expectedRunId?)` 从当前 Run Slot 与冻结内容生成只读 `OperationView`；没有 Run、没有完整战术内容或 Run ID 不匹配时返回 `null`。

## Changed

- 新增 `OperationView` detached contract 与 Runtime-only projector。
- OperationRuntime owner 在冻结规则内生成动态视图；Entry facade 只公开窄 `getView` 方法，没有暴露 EventRun owner 或 definitions。
- Profile 候选根据 `previewOperationIntervention()` 逐个验证地点、Actor/Team 资源、占用槽、plan conflict 与每个合法目标；候选含 Actor/Team cost。组合预览调用无 RNG 的 `resolveOperationCombinations()`。
- 视图同时提供 base PreparedBeat 与已应用草稿的 effective PreparedBeat；不足费用、无合法目标和终局状态会返回 Commit blocker。Resolution 以 UI DTO 输出，去掉 RNG cursor、roll 数值与 raw word 数，仅保留技能成功值。
- Integration tests 增加深冻结/detached、无 Resolver 重查、无 Run 突变、过期 Run ID、组合修订/非空组合、target priority、Team cost/plan conflict 与不足费用/无目标 blocker 覆盖。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过，14 tests |
| `npx tsc --noEmit` | 通过 |
| `npm run check:architecture` | 通过 |
| `npm run check:docs` | 通过，635 Markdown、0 errors |
| `git diff --check` | 通过；仅显示工作树既有 CRLF 转换提示 |

## Limits / Follow-up

- U1 未做浏览器验收；OperationView 只构成 Runtime 读取合约，不代表 UI 已完成。
- 当前视图按需生成，并按 Run/profile 候选数量执行纯预览；Controller/Surface 后续只应在必要的 Operation 状态收敛时读取，不应由 hover/scroll 触发。
- U2–U6 仍待施工；Task 0215 仍按其原记录等待 Task Owner 独立归档确认。
