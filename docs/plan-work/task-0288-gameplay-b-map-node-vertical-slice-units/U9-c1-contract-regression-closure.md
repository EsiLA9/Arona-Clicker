# Unit 0288-U9：关闭 C1 存档与 Map 版本校验回归

## Goal
让 U5 生命周期测试与 U6 已冻结的 MapRun Save / Resume 行为一致；在正式 Registry 入口拒绝无效 `resumeVersion`，避免无法启动的 Map 作为有效内容通过校验。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/task-0288-gameplay-b-map-node-vertical-slice.md`、`draft-0287-gameplay-b-phase-b-contract.md` | C1 验收与版本兼容合同 |
| 文档 | `docs/docs-829/05-conventions/testing.md`、`architecture-discipline.md` | 回归测试选择与 Registry 内容校验边界 |
| 源码 | `src/data-services/registry/registry-validate.ts`、`src/data-services/contracts/gameplay-map.ts` | Map 拓扑验证及 resumeVersion 字段 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/runtime-game-instance.ts` | Save / Resume 的实际行为 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts` | Map Registry 验收入口 |
| 测试 | `tests/engine/gameplay-b-map-runtime-integration.test.ts` | GameInstance 生命周期回归 |

## Context Budget
- 目标 6k–12k tokens；历史文档 0 篇；最多 3 个实现文件 / 180 行净改动。Receipt 与本 Unit / guide 更新不计入实现预算。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| U6 只将进行中的 MapRun 保存为 checkpoint，`load(save())` 应恢复相同 Run ID 与进度。 | `MapRunService.createSaveSnapshot / restoreSaveSnapshot`、`GameInstance.save / load` |
| U5 生命周期集成测试仍断言 `load(save())` 后 MapRun 为空，独立运行时因此失败。 | `tests/engine/gameplay-b-map-runtime-integration.test.ts` |
| MapRun 启动与恢复都要求正的安全整数 `resumeVersion`，但 Registry 的 `validateMapTopologies()` 未检查该字段。 | `MapRunService.start / restoreSaveSnapshot`、`registry-validate.ts` |

## Constraints
- `load(save())` 必须验证恢复当前位置、进度与原 Run ID；`init`、`reset`、`dispose` 仍须清空易失 MapRun owner。
- 不含 `mapRun` 的旧 SaveData 在 Load 时不得残留之前的 MapRun；不得改动 PlayerState 与旧 OperationRun 恢复语义。
- Registry 只接受 `Number.isSafeInteger(resumeVersion) && resumeVersion >= 1` 的 Map。
- 只修正测试语义与静态定义验证；不调整 MapRun owner、存档格式或 UI。
- 不修改生成 Schema。

## Allowed Files
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`
- 本 Unit 的 Receipt：`receipts/receipt-U9-c1-contract-regression-closure.md`（流程记录，不计入实现预算）
- `task-0288-units-guide.md`（仅登记本 Unit 与执行依赖）

## Explicit Non-goals
- MapRun Runtime、SaveData 类型 / Codec、Map 内容样例、UI、GameCommands、其他 Datapack 字段或 Schema。

## Stop Conditions
1. 需要修改白名单外生产文件、SaveData 格式或生成 Schema。
2. U6 Save / Resume 实际行为与冻结合同不一致，或出现 PlayerState / OperationRun 变化。
3. 超过 3 个实现文件 / 180 行净改动。
4. 定向测试或类型检查失败且原因无法解释。

## Completion Criteria
- [ ] 活动 MapRun 经 Save / Load 后恢复原 Run ID、位置与进度。
- [ ] `init`、`reset`、`dispose` 仍清除 MapRun；旧 SaveData 不带 `mapRun` 时不会留下先前运行。
- [ ] Registry 拒绝 0、负数、分数、NaN、Infinity 与超出安全整数的 `resumeVersion`，接受正安全整数。
- [ ] PlayerState 与 OperationRun 路径不变。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 全部通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档检查 | `npm run check:docs` | 通过 |
