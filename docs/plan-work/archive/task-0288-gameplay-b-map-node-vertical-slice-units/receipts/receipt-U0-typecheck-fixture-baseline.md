# Receipt：Task 0288-U0 Operation UI 测试入口前置

## 完成内容

- `gameplay-b-operation-controller.test.ts` 的 `acquireStudents()` 通过 `game.mutations.setSpotLevel()` 同时取得 Carousel `GAMEPLAY_B_OPERATION_SPOT_ID` 与 Strategy Park `gameplay-b-strategy-park:spot:park_terminal`。
- `gameplay-b-strategy-park-map.test.ts` 的 `acquireStudents()` 也通过 `game.mutations.setSpotLevel()` 同时取得这两个入口 Spot。
- 两处手动 Workspace fixture 保留原有赋值、路由和渲染流程，只增加 `returnContext: controller.workspaceLocation()`。
- 未修改生产代码、类型、配置、Datapack 定义或其他测试。

## 验证

- `npx tsc --noEmit`：通过，退出码 0；两处缺少 `OperationWorkspaceState.returnContext` 的错误已消失。
- `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/gameplay-b-strategy-park-map.test.ts`：失败，2 个文件、40 个测试中 21 失败、19 通过；相较只取得各自一个 Spot 时的 23 失败、17 通过，两个交叉入口前置失败已消失，没有观察到由补充 Spot 引起的新失败。
  - 剩余可见失败包括 Carousel exit 用例的场景行动牌查询为空、Strategy Park 地图 Toast 查询为空，以及追踪牌点击后 `aria-pressed` 仍为 `false`。
  - 这些失败不是 `returnContext` 类型问题或缺少入口 Spot；当前 Operation 点击处理要求将部分行动卡拖到角色卡分配执行者，而测试仍期待点击即选中；Toast 测试查询的 `data-operation-map-toast-open` 当前源码没有对应标记。未改生产行为或扩展修复范围。

## 停止说明

两个入口 Spot 和 Workspace fixture 前置已补齐，类型检查通过；定向测试仍有 21 项旧 Operation UI 行为断言失败。按 Unit 约束保留这些行为问题供独立 Operation UI 任务处理；未修改测试之外的代码。
