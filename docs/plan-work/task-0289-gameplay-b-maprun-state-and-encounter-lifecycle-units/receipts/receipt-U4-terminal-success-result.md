# Receipt 0289-U4：成功终态结果

**结果：实施完成；独立复核无阻塞发现。**

## 修改内容

- MapRun 到达出口时清除同一 Owner 中的完整活动 Run，包括队伍、PlayerCost、位置与节点进度。
- Owner 只暂存冻结的成功摘要：`runId`、`mapId`、成功 outcome、出口 Node ID 和显示名称。Query 返回冻结的 detached 副本。
- 成功结果不进入 SaveData、不参与恢复，也不能用于移动或完成 Encounter 命令；新 Run 与 GameInstance dispose 会清除旧结果。
- `MapRunQuery` 新增 `getResult(runId)`；现有 Workspace UI 投影留给 U5 改读此摘要。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-run.test.ts --reporter=dot --silent`：1 个文件、8 个测试通过。
- `npx tsc --noEmit`：通过。
- Luna Max 独立只读复核：无阻塞发现；成功终态 Workspace 切换至 `getResult` 属于 U5 范围。

## 边界

- 改动限制于 U4 Allowed Files；未改 UI、SaveData、PlayerState、OperationRun 或失败语义。
- U4 只实现成功终态；已冻结的全队 HP 归零失败规则仍在 C4 与真实 HP 结算一并接入。
