# Receipt 0289-U3：MapRun checkpoint 往返与拒绝校验

**结果：实施完成；独立复核无阻塞发现。**

## 修改内容

- 在既有 `MapRunSaveSnapshot { mapId, resumeVersion, run }` 中保存并恢复固定 Party 与当前 PlayerCost，没有新增 SaveData 根字段。
- GameInstance 将静态 Registry Variant → Character (`proto`) 查询提供给唯一 MapRunService；恢复验证固定队伍顺序与 Variant 配对，不读取或写入 PlayerState。
- `MapRunService` 恢复 Party 时只投影 `characterId` 与 `variantId`，不把 checkpoint 注入的 HP / Actor 字段带进状态。拒绝数据在全部校验通过前不会安装到 Owner。
- MapRunService 可无 Variant lookup 地供仅内存启动测试使用；恢复任何非空 checkpoint 时若缺少 lookup 则拒绝。
- 修复 Save / Resume 测试中的两处过期 `MapRunService.start()` 调用。新增覆盖非初始余额恢复、Variant 错配、额外字段净化、失败恢复不污染 Owner 及缺少 lookup 时拒绝。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts --reporter=dot --silent`：1 个文件、6 个测试通过。
- `npx tsc --noEmit`：通过。
- Luna Max 独立只读复核：无阻塞 / 非阻塞发现。

## 边界与影响审查

- 改动限制在 U3 Allowed Files：`map-run-service.ts`、`runtime-game-instance.ts`、`gameplay-b-map-save-resume.test.ts`。`map-run.ts` 无需调整。
- MapRunService 仍是唯一可写 Owner；Registry lookup 仅负责 Variant 身份只读校验。
- 未改变 SaveData 根结构、PlayerState、OperationRun、Datapack Schema，也未引入 HP / Hand / Action / 失败 Run 状态。
- GALHCG 只读复核：直接变更路径没有图谱关联；未改图或刷新 freshness。
