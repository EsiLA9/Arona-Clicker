# Execution Receipt：Task 0157 U10

日期：2026-09-26

## 结果

- `refreshAchievementRows` 仅在 Controller 已启动、`panelState.service === 'records'` 且 Records Workspace 节点仍连接到 DOM 时读取投影；只查询现有 `data-achievement-id` 行，并用 `textContent` 更新已存在的状态、进度和数值节点。
- `refreshLight` 调用同一 patch 作为 Tick 间隔的兜底；`bindEvents` 对 `resourceChanged`、`spotProduced`、`itemCollected` 和 `tick` 仅在 Controller 已启动且当前服务为 Records 时合并排入微任务，避免非 Records 页面为高频事件创建空微任务，并避免在同步效果／完成提交前读取旧投影。
- 时序依据：`EventBus.dispatch` 先同步执行事件类型处理器，再执行 `onAny`；MilestoneAdapter 在 Runtime wiring 中先于 UI mount 阶段的订阅存在。微任务在事件同步分发与嵌套效果结束后应用 patch。
- 定向测试验证 resourceChanged、itemCollected、spotProduced 与 tick 后进度和完成状态更新；行与 Records 根节点身份不变，不调用整页 `render()`；沿用离页断言确认切离 Records 后不再读取投影或改写显示节点。微任务执行时仍检查 Records 路由及其 DOM 节点连接状态。
- 仅更新当前已有成就行；新增发现项、热插入和定义变化时的结构更新不在本 Unit 范围内。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/controller-events.test.ts --reporter=dot --silent --maxWorkers=1 --minWorkers=1` | 通过；1 个文件、8 项测试通过，覆盖 resourceChanged、itemCollected、spotProduced 与 tick |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 326 |

## 限制

- 本 Unit 不处理页面打开期间新发现的 Achievement 热插入；重新打开 Records 时由 U09 全量投影渲染新条目。
