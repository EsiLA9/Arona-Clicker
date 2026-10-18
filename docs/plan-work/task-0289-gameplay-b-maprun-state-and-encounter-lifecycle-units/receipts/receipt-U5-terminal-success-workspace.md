# Receipt 0289-U5：终态 Workspace

**结果：实施完成；独立复核无阻塞发现。**

## 修改内容

- `MapRunWorkspaceView` 改为显式 `active | success` 联合：活动分支包含 Map / Run / Encounter 投影；成功分支只含 U4 的 `MapRunSuccessResult`。
- GameInstance 查询活动 Run；活动 Run 已清理时，按 Run ID 查询最小成功结果。不会从结果重建地图位置、队伍或节点进度。
- Map Workspace 成功页显示地图名与出口名称，隐藏节点进度、移动与遭遇控件，并保留“返回游戏”按钮。
- Workspace / 竖切片测试通过正常的角色 Variant 获取流程满足固定队伍准入；从 Spot 进入、完成、返回游戏及再次开放新地图入口都从实际 UI 链路验证。

## 验证

- `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/gameplay-b-map-vertical-slice.test.ts --reporter=dot --silent`：2 个文件、5 个测试通过。
- C1 / C2 联合回归：Registry、Map ID、Resolver、MapRun、Save / Resume、Runtime 集成、Workspace 与竖切片共 8 个文件、60 项通过。
- `npx tsc --noEmit`：通过。
- `npm run check:docs`：通过，0 错误，扫描 863 篇 Markdown。
- Luna Max 独立只读复核：无阻塞发现。

## 边界

- 改动限制于 U5 五个 Allowed Files；未改 Controller、Workspace route、Map Entry 内容语义、失败 UI 或 SaveData。
- 失败结果页与失败后重新开 Run 将在 C4 随 HP 触发一起实现。
