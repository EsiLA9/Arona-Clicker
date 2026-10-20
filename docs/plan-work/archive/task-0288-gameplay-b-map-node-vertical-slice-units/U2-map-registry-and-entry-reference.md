# Unit 0288-U2：登记并校验 Map 与 Spot 入口引用

## Goal
让正式 Registry 合并、清空并校验 Map 定义与 Map 内拓扑，同时为普通 Spot 增加显式 `mapEntry → mapId` 引用。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md`、`docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` | 固定语义与 C1a 范围 |
| 文档 | `docs/docs-829/03-data-structures/registry.md` | Registry 表与引用校验 |
| 源码 | `src/data-services/registry/registry.ts`、`registry-validate.ts` | 表登记与静态检查模式 |
| 源码 | `src/data-services/contracts/world.ts` | Spot Functionality 定义 |
| 源码 | `src/engine/contracts/spot-functionality-query.ts` | UI 查询投影保留 Map Entry 目标 |
| 测试 | `tests/data/spot-operation-entry.test.ts`、`tests/engine/registry.test.ts` | 引用失败与表行为模式 |

## Context Budget
- 目标 12k–25k tokens；历史文档 0 篇；默认仅读列出的文件。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| Registry 通过 `tableSteps` 同步 merge / clear。 | `registry.ts:Registry.tableSteps` |
| `operationEntry` 在 Registry 检查目标 Event 是否存在。 | `registry.ts:validateSpotOperationEntryRefs` |

## Constraints
- 按 [[AGENTS.md]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]] 执行；生成 Schema 禁改。
- Map 的 Node / Edge / 起点 / 出口关系必须在 Registry 入口校验；拒绝重复局部 Node ID、未知起点/出口/端点、自环或重复边（如现行数据约定无法表达则停）。
- `mapEntry` 使用 `mapId`，不能重解释 `operationEntry`。

## Allowed Files
- src/data-services/registry/registry.ts
- src/data-services/registry/registry-validate.ts
- src/data-services/contracts/world.ts
- src/engine/contracts/spot-functionality-query.ts
- New file: tests/data/gameplay-b-map-registry.test.ts

## Explicit Non-goals
- Resolver、MapRun、UI、样例包、旧 Operation 退役或 Schema 生成。

## Stop Conditions
1. 需要白名单外改动（尤其是额外引用扫描或编辑器 schema 文件）。
2. 超过 5 个文件 / 500 行净改动。
3. Read Set 外新增阅读超过 2 个文件仍无法解释修改点。
4. 源码规则与冻结合同冲突，或必须自行定义尚未冻结的拓扑语义。
5. 定向测试、类型检查无法执行或失败且无法定位。

## Completion Criteria
- [ ] 合法 Map 被 Registry 接受并可查询。
- [ ] 拓扑坏引用与重复 Node ID 被拒绝。
- [ ] Spot `mapEntry` 缺失、未知 Map ID 时被拒绝；`operationEntry` 行为保持原义。
- [ ] Registry clear / merge 覆盖 Map 表。
- [ ] `mapEntry.mapId` 保留在 `SpotFunctionalityView`，供正常 UI 从内容读取入口目标。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 定向测试 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
