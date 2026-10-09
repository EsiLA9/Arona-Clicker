# Receipt：0236-U0-D OperationView、第一幕样例与机制文档

状态：completed — 按上游裁定将过滤限制于战术 Beat Action，并在静态内容准入中封闭 SceneAction / SceneCard 引用旁路。

## Goal

让战术 Action 内容校验、OperationView 合法目标投影和第一幕 Datapack 共同表达并展示只作用于旋转木马的目标规则；静态拒绝场景包装器引用带过滤的 Action，并更新当前 Runtime 文档。

## 实际修改

- `src/arona-clicker/services/operation-action-content-validation.ts`：`legalTargetActors()` 在 relation 候选上取 `allowedActorIds` / `allowedActorTypes` 交集，供静态效果资源引用校验使用；并要求 ID 引用当前 Event Actor、每个 type 匹配当前 Event 至少一个声明类型。Action 被 Location SceneAction 或 PlayerSceneCard 引用时，若声明任一目标过滤字段则拒绝内容准入。
- `src/arona-clicker/content/operation-samples/carousel-safety-slice.ts`：星野的 brace、芹香的 signal、白子的 shield 均设置 `allowedActorIds: [旋转木马 Actor ID]`，同时保留 `relation: 'any'` 的通用关系与排序偏好。
- `tests/engine/gameplay-b-scene-action-sample.test.ts`：验证三个学生的战术 OperationView `legalTargetActorIds` 均仅包含旋转木马；向破坏者投放 brace 被拒绝且 Run 不变；静态校验接受现有 Actor ID / type，并拒绝不存在的 Actor ID 与 Event type。
- `tests/engine/operation-scene-actions.test.ts`：验证 Location SceneAction 与 PlayerSceneCard 两种包装分别拒绝带目标过滤的 Action；既有无过滤场景流程仍通过。
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`：说明 relation、ID allowlist、Event Actor type 交集语义、Event 引用校验、优先顺序边界与过滤 Action 的战术 Beat 限定。
- `src/arona-clicker/services/operation-view-projector.ts` 未修改：战术 actionOptions 已通过 U0-C preview 结果投影目标。场景投影与结算路径保持原规则；受内容准入检查保护，不接受带过滤字段的场景 Action。
- 首轮在发现场景旁路后按停止条件中断；上游裁定过滤仅用于战术 Beat Action，并要求内容校验阻止 SceneAction / SceneCard 引用后，在本 Unit 白名单内继续施工。

## 验证

| 检查 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/gameplay-b-scene-action-sample.test.ts tests/engine/operation-scene-actions.test.ts` | 通过：2 个文件、12 个测试 |
| `npx tsc --noEmit` | 通过 |
| `npm run check:docs` | 通过 |
| `git --no-pager diff --check` | 退出码 0；若有仅并行工作树既有文件的 CRLF 提示 |

## GALHCG 影响

本 Unit 的内容校验、首幕样例、测试与 Runtime 文档沿用 `concept:operation-event-run-runtime` 的既有映射；新增 Unit / Receipt 文档也归入该 Concept，不新建 Concept。最终收口更新本 Unit 路径与对应源码 / 测试的直接 `maps_to` Evidence。已按归档 Task-0235 的责任交接，在其归档且相关 Evidence 路径稳定后复核并刷新该 Concept 原有完整 20 条节点 Evidence；路径成员与节点语义字段均未改，实时 freshness 为 20/20 fresh，其中含 `docs/docs-829/03-data-structures/operation-view.md` 及本 Task 修改的 Runtime 文档、内容校验和合同路径。
