# Receipt Task 0288-U8：正常 Spot 入口与端到端验收

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；非施工者独立复跑与审查通过 |
| 实际修改 | `src/ui/components/map-entry.ts` 新增 mapEntry 按钮渲染；`production.ts` 在普通 Spot 卡片显示 Datapack 声明的 Map Entry；`controller-actions-operation.ts` 委托开始 / 继续 / 返回 / 移动 / 手动完成；`controller.ts` 增加 route-only Map 返回与窄 Map region refresh；新增 `tests/ui/gameplay-b-map-vertical-slice.test.ts`。 |
| 记录修改 | 本 Receipt 与主 Task 的 U8 验证记录。 |
| 范围外变更 | U8 未修改 Pack 注册、Registry、Datapack 内容、Schema、Runtime、Save、Spot、通用 UI 更新架构或 Map Workspace 渲染器。共享工作区的其他既有改动未覆盖。 |

## 施工边界

- **Goal：**从普通 Datapack Spot 经正常默认包加载路径进入 / 继续 MapRun，并以 UI 完成 A→B→Encounter→B→C。
- **Allowed Files：**`map-entry.ts`、`production.ts`、`controller-actions-operation.ts`、`controller.ts`、新 UI 集成测试、U8 Receipt 与主 Task 的追加验证记录。
- **Non-goals：**不删改旧 Operation / Spot / Event / Strategy Park 内容；不实现 C2–C4；不改生成 Schema、Pack 注册、Registry 或通用 Controller 更新架构。
- **Stop Conditions：**未遇到白名单外注册依赖、手造 MapRun / 写死 Map ID 需求、全量重写 actions 或无法解释的验收失败。

## 实际接线

- Spot 卡片只从当前可用的 Spot Functionalities 渲染 `kind: 'mapEntry'`，开始按钮所用 Map ID 直接来自 Datapack functionality；继续按钮只在 ReadModel 显示同 Map 的活动 Run 时出现。UI handler 重验当前 Area、Spot 揭示 / 持有状态及 functionality 身份，不直接读 `Registry.maps`；开始操作交给 `GameCommands.startMap()` 与 Runtime Resolver 权威解析。
- 地图开始 / 继续与返回只切换 `WorkspaceRoute { kind: 'map', runId }` 并执行路由所需 render，不向 `PanelState.workspace` 复制 MapRun。移动 / Encounter 完成只调用 `GameCommands`，请求 `workspace.map` region 更新，从 ReadModel 取 detached Workspace view 并只替换 `[data-map-workspace-region]`；保留各列滚动、焦点与 Popover 生命周期。
- 新 UI 集成由 `createAppRuntime()`、`loadDefaultDatapack()` 与 `controller.mount()` 建立正常默认包 / Registry / UI 链，不调用 `game.init([...])`，不导入示例 Map ID 或手工构造 MapRun。测试从 Registry 中的正常 Spot 定义动态发现 mapEntry；Spot 未持有时先通过真实 UI 的免费获取按钮获取。

## 测试与验证

- `npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts`：通过，1 个文件 / 1 项测试。覆盖正常默认包装载、UI 进入默认 Init、免费获取未持有 Spot、开始后返回并继续同一 Run、从 Runtime Map ReadModel 驱动的 A→B→手动完成 Encounter→停在 B→主动移至出口 C。
- 在初始位置直接提交非相邻移动和无活动 Encounter 的完成命令，二者均拒绝且 Run 快照不变；Encounter 活动时提交移动也拒绝且快照不变。
- 移动与 Encounter 完成后 `regionRefreshes` 各增加 1，`fullRenders` 保持不变；进入 / 返回通过路由 render 更新界面。
- `npx tsc --noEmit`：通过。
- `npm run check:docs`：通过，施工时扫描 853 篇 Markdown，`errors: 0`；总控在 C1 收口时再复核通过，扫描 853 篇 Markdown。
- 浏览器人工操作：未单独启动；默认包和完整 UI 命令路径由上述 happy-dom 集成测试实际回放。

## 遇到问题

初次回放发现新游戏选择页的 Init CTA 在购买后的局部 detail 替换中尚未重新绑定，且开始命令将 render 排入微任务。测试现按 UI 的选择 / 免费购买 / 等待 render / 开始顺序操作；最终整条端到端测试通过。没有生产代码越界或剩余阻塞。

## 独立审查

`runtime_state` 子 Agent 作为非施工者独立复跑 `npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts`，1 文件 / 1 测试通过；复核了正常默认包链、Spot functionality、GameCommands、route-only Map 位置、局部 Map region refresh、scroll / focus / popover 边界及 Allowed Files，未发现阻断缺陷。`controller-actions-operation.ts` 中既有 hover overlay / SceneAction 改动与 U8 Map 接线独立，未计入 U8 范围结论。独立审查未重跑 TypeScript 或文档检查；二者施工者结果见上表。

对 U8 直接影响的文件执行 `graph_health(check="changed")` 只读复核：新 `map-entry.ts` 尚无直接 Evidence / `maps_to` 关联；`production.ts`、`controller-actions-operation.ts` 与 `controller.ts` 的既有 Evidence 已过期。检查未写入语义图或 freshness。
