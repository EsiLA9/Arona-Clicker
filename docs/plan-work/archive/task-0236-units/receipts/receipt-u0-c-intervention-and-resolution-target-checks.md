# Receipt：0236-U0-C 干预预览与结算目标复核

状态：completed — 显式干预预览与 Resolution 的复核测试均按统一 Actor ID / type 过滤通过。

## Goal

确保明确指定的 Action / Actor 目标经同一目标合同在干预预览与最终 Resolution 规划再次校验，越界目标无法保存或结算。

## 实际修改

- `tests/engine/operation-intervention-preview.test.ts`：新增显式干预测试，验证声明 Actor type 范围与 Actor ID allowlist 分别拒绝越界目标，并允许目标合法时完成预览。
- `tests/engine/operation-resolution-planner.test.ts`：新增 Resolution 测试，提交草稿目标越过 ID / type 限制时 planner 返回 `operation:resolution:invalid-content`，且不修改输入快照。
- `src/arona-clicker/services/operation-intervention-preview.ts` 未修改：既有 `validateExplicitTarget()` 将显式 Actor ID 放入临时偏好后交由 `selectOperationTarget()` 校验；U0-B 已将 ID / 声明 type 过滤放入该选择器。
- `src/arona-clicker/services/operation-resolution-planner.ts` 未修改：既有 planner 在 Commit 规划时重建规范 PreparedBeat，并通过 `previewOperationIntervention()` 重算已存干预草稿；新增测试验证非法目标不能通过该边界。

## 验证

| 检查 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/operation-intervention-preview.test.ts tests/engine/operation-resolution-planner.test.ts` | 通过：2 个文件、17 个测试 |
| `npx tsc --noEmit` | 通过 |
| `git --no-pager diff --check` | 退出码 0；仅显示并行工作树既有文件的 CRLF 提示 |

## GALHCG 影响

仅修改既有 Engine 测试路径，无新增地图关系；任务负责人在阶段收尾时复核受影响的 Evidence / `maps_to` freshness。
