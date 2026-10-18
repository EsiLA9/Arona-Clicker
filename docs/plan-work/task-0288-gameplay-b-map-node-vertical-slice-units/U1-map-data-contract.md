# Unit 0288-U1：定义 Map 的最小静态内容合同

## Goal
在 Datapack 类型层增加 Map、内嵌 Node / Edge / Encounter 的最小定义，并注册 `map` 实体 ID 类型。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/task-0288-gameplay-b-map-node-vertical-slice.md` | 本阶段范围与验收 |
| 文档 | `docs/plan-work/draft-0287-gameplay-b-phase-b-contract.md` | 冻结的数据关系与 Node 规则 |
| 文档 | `docs/docs-829/03-data-structures/datapack-contracts.md` | ID / Datapack 合同 |
| 源码 | `src/data-services/contracts/datapack.ts`、`src/data-services/index.ts` | 顶层表与公开类型出口 |
| 源码 | `src/engine/core/entity-id.ts` | 实体 ID 注册类型 |

## Context Budget
- 目标：8k–20k tokens；文档 Read Set 3 篇；历史文档 0 篇。
- 超预算先缩小调查；不得因为字段实现去读取生成 Schema。

## Confirmed Facts
| 事实 | 依据 | 备注 |
|---|---|---|
| Datapack 当前没有 Map 顶层表。 | `src/data-services/contracts/datapack.ts` 的 `Datapack` | 本 Unit 增加可选 maps 表 |
| 当前三段式实体类型来自 `ENTITY_TYPES`。 | `src/engine/core/entity-id.ts` | Map ID 类型名冻结为 `map` |

## Constraints
- 遵守 [[AGENTS.md]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]；禁止碰生成 Schema。
- 字段按冻结合同建模：Map 有 ID / 名称 / resumeVersion / 起点 / 出口 / 内嵌 Nodes / Edges；Node 有局部 ID / 展示信息 / 可选一个 Encounter；Encounter 有标题、描述及唯一 C1a 完成声明 `completion: { kind: "manual", label: string }`；Edge 连接局部 Node ID。
- `completion.kind` 首版只接受 `manual`；这是一个合法完成按钮，不引入可编程脚本、通用 Action 或 Condition / Effect 执行器。
- 只定义静态内容结构；不要在本 Unit 创建 Runtime、Resolver、Spot 引用或编辑器 Schema。

## Allowed Files
- New file: src/data-services/contracts/gameplay-map.ts
- src/data-services/contracts/datapack.ts
- src/data-services/index.ts
- src/engine/core/entity-id.ts
- New file: tests/engine/gameplay-b-map-id.test.ts

## Explicit Non-goals
- Registry 校验、MapRun、Resolver、UI、样例 Datapack。
- Map 坐标画布、动态队伍、Condition / Effect DSL、通用 Encounter Type 枚举。

## Stop Conditions
1. 需要改白名单外文件或新增未列文件。
2. 超过 4 个文件或约 400 行净增量。
3. 必须依赖生成 Schema 或发现 Datapack/ID 事实与 Read Set 冲突。
4. 新增字段迫使选择尚未裁定的内容语义。
5. 类型检查不可运行或失败且原因不明。

## Completion Criteria
- [ ] 静态 Map / Node / Edge / Encounter 类型表达冻结的 C1a 内容关系。
- [ ] `Datapack.maps` 可选，Map 类型从 `data-services` 公共入口导出。
- [ ] `map` 被识别为合法三段式实体类型。
- [ ] 不修改生成 Schema。

## Verification
| 项 | 命令 | 期望 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 定向 ID 检查 | `npx vitest run tests/engine/gameplay-b-map-id.test.ts` | 通过 |
