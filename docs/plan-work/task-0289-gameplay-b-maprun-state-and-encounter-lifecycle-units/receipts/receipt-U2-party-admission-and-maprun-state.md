# Receipt 0289-U2：固定队伍准入与 MapRun-local 状态

**结果：实施完成；独立复核无阻塞发现。**

## 修改内容

- `MapRun` 新增固定队伍快照 `{ characterId, variantId }` 和当前 `playerCost`，存入现有 `MapRunSaveSnapshot.run`。
- `GameInstance.startMap()` 在创建 Run 前读取 AC PlayerState，拒绝未拥有 / 未解锁的队伍成员，并按 Variant ID 稳定排序选择已拥有 Variant。准入失败不会建立 MapRun，也不写 PlayerState。
- `MapRunService` 只接收已经准入的身份快照，不依赖 PlayerState；启动、节点移动、Encounter 完成和现有恢复路径保留 Party / PlayerCost。
- Runtime 集成测试明确覆盖未拥有 Shiroko 时的整体拒绝，以及获取角色 Variant 后才可启动。重置或读档清除 roster 后，测试会重新获取 Shiroko 再继续。
- MapRun 直接测试使用初始 PlayerCost `4`，验证节点移动、Encounter 成功和出口到达时不重置余额。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts`：2 个文件、9 个测试通过。
- `npx tsc --noEmit`：当前被 U3 白名单文件 `tests/engine/gameplay-b-map-save-resume.test.ts:41,47` 两处旧单参数 `MapRunService.start()` 调用阻塞；未在 U2 修改该文件，U3 负责更新并完成完整 Save / Resume 验收。
- Luna Max 独立只读复核：无阻塞发现。

## 复核观察与后续处理

- 独立复核指出恢复时应丢弃 checkpoint Party 对象中的合同外字段。已加入 U3：恢复时只投影 `characterId` / `variantId`，并验证非零且不同于 Map 初值的 PlayerCost 往返。
- 混合有效 / 无效队伍的单独测试尚未增加；准入逻辑会收集所有不合格成员后才抛错，因此不会先建立部分 Run。当前 U2 验收已有整体拒绝和 PlayerState 不变测试。
- GALHCG 只读复核：`runtime-game-instance.ts` 为 `content_changed` 且旧 Evidence 待维护；MapRun contract / service 与相关测试为 `unreferenced_path`。按任务边界未写图、未刷新 freshness。

## 边界

- U2 只新增 Party 身份与 PlayerCost；没有增加 HP、Hand、Action、RNG 或失败状态字段。
- 未改 PlayerState / OperationRun、SaveData 根结构、UI 或生成 Schema。
