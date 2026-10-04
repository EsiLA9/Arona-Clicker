# Receipt 0216-U6：体验验收、机制文档与 GALHCG

## Outcome

已完成 Gameplay B U6。新增独立 `OperationView` 当前机制说明，补齐 UI 模块、Workspace Routing 与增量刷新文档；完成 DEV-only 本地试玩控制台，GALHCG 节点与文件映射核验见下文。

## Browser Acceptance

- 本地 AC 游戏页面以 `?devConsole=gameplay-b` 开启试玩控制台。命令 `获得角色 星野 芹香 白子` 经白名单解释后调用 `StateMutationService.acquireCharacter()`；不自动进入 Run，不写 Save / IndexedDB。控制台只在 Vite DEV 与显式 URL 参数同时成立时动态加载。
- 通过游戏正常流程进入夏莱办公室后录入角色，Operation entry 走真实准入并显示 3 位已准入学生。无角色普通入口此前实测展示“不会自动补发”准入失败消息。
- 可用浏览器截图为 **1412×811 px**（截图像素；宿主未提供精确 1280×720 viewport 设置）。宽桌面界面中风险侧栏较窄，聊天行动列按 `.78fr / 2.22fr` 约占可用区 74%，高于 60% 要求；不验收窄屏移位。
- 手动路线（固定 Seed 17）：无干预危险度 `3 → 4 → 5`，显示“处置失败”；紧急停机 `3 → 1 → 2`，显示“安全处置”；重复紧急停机仍为 `3 → 1 → 2`；游客疏导 `3 → 3 → 4`，显示“处置失败”。第一回合日志显示逐项轨道变化与已支付费用；两 Beat 后 Submit 禁用，Run 正式状态不被 UI 判读改写。
- 操作焦点留在已选择行动；返回聊天后焦点到“查看试玩结论”入口。U5 自动化 UI 测试覆盖区域更新数、scroll snapshot、焦点恢复、节点 identity 与 refresh observation。
- 刷新本地页面后新 Runtime 回到无存档的 Init 选择，试玩控制台获得的角色不持久化。

## Documentation

- `docs/docs-829/03-data-structures/operation-view.md`：OperationView 内容、Runtime/Save 边界及 UI 消费路径。
- 更新 `docs/docs-829/03-data-structures/00-index.md`、`docs/docs-829/02-modules/ui.md`、`docs/docs-829/06-wiki/50-ui/workspace-routing.md`、`docs/docs-829/06-wiki/50-ui/refresh-update.md`。
- Task 0216 将实际宿主浏览器截图尺寸记为 1412×811 px；没有把截图像素尺寸误记为 CSS viewport。

## GALHCG

已更新既有 Concept 与路径关系，没有为单个组件建立新 Concept：

- `concept:operation-event-run-runtime`：节点 20/20 fresh；新增 `operation-view.ts`、`operation-view-projector.ts` 实现和 `operation-view.md` 文档映射，三条关系均 1/1 fresh。
- `concept:ui-workspace-renderer`：节点 11/11 fresh；补齐 Operation Workspace、样式、路由/刷新文档及测试映射，更新关系均 fresh。
- `concept:ui-command-to-runtime`：节点 2/2 fresh；补齐 Operation Controller 写入口及其测试映射，既有 Runtime 与 UI 模块关系更新为当前证据，均 fresh。
- `concept:test-harness-and-configuration`：节点 6/6 fresh；登记 Vite DEV 显式启用的内存快速测试台入口、实现、样式与解析测试，更新关系均 fresh。
- `module:game-ui` 节点 3/3 fresh；`concept:ui-presentation-layer` 到 `src/ui/main.ts` 的更新关系 fresh。

所有更新与新增节点/关系均执行 `verify_freshness` 并返回完整 fresh；`context` 回读确认新增映射。Operation Runtime 节点保留 20 条已有证据，新增 OperationView 文件单独以 `maps_to` 关系维护，使节点 freshness 能在服务的 20 文件核验上限内完整验证。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/workspace-router.test.ts tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-quick-test-console.test.ts --silent` | 6 files / 37 tests passed |
| `npx tsc --noEmit` | passed |
| `npm run check:architecture` | passed |
| `npm run ui:callgraph` | passed；116 files、3544 reliable edges、268 DOM writes |
| `npm run check:docs` | passed；643 Markdown、0 errors |
| `git diff --check` | passed；U6 变更无 whitespace errors |
