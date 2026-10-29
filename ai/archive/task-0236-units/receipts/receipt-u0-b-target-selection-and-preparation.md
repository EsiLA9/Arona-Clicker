# Receipt：0236-U0-B 统一目标匹配与自动计划

状态：completed — U0-A 按裁定改为 Event Actor `type` 字符串范围后，目标筛选与自动计划定向验证通过。

## Goal

让目标 ID / 类型范围参与合法目标计算与自动计划，同时保持未声明过滤时的历史范围与偏好顺序。

## 实际修改与语义核验

- `src/arona-clicker/services/operation-target-selection.ts`：在 relation 候选计算后、偏好排序前，按 `allowedActorIds` 和 `allowedActorTypes` 做交集过滤；缺省数组保持原路径与偏好顺序不变。
- `tests/engine/operation-target-selection.test.ts`：覆盖 Actor ID 精确过滤、声明 `type` 精确过滤、两字段求交、过滤后再应用优先级，以及无匹配 type 时返回 unavailable。
- `tests/engine/operation-plan-preparation.test.ts`：通过已有统一 selector 验证自动计划落在允许的 ID / type 对象上，并在所有 relation 候选被排除时保留 `NO_LEGAL_TARGET` Wait 原因。测试显式设置 Event Actor `type: 'carousel-platform'` 与运行 `participantKind: 'environment'`，确认两者不混淆。
- `src/arona-clicker/services/operation-plan-preparation.ts` 未修改：该函数本来就调用 `selectOperationTarget`，U0-B 通过集成测试确认过滤已进入自动计划。
- 首轮因当时的 `allowedActorKinds` 字段语义含混而中断；上游确认 `allowedActorTypes` 匹配 `OperationActorDef.type: string` 后重开 U0-A 并更正合同，随后完成本 Unit。

## 验证

| 检查 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/operation-target-selection.test.ts tests/engine/operation-plan-preparation.test.ts` | 通过：2 个文件、28 个测试 |
| `npx tsc --noEmit` | 通过 |
| `git --no-pager diff --check` | 退出码 0；仅显示并行工作树既有文件的 CRLF 提示 |

## GALHCG 影响

本 Unit 修改既有目标选择源码与 Engine 测试，无新增地图概念或关系。相关 Evidence / `maps_to` freshness 由任务负责人在本阶段收尾时统一复核。
