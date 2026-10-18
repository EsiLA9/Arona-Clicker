# Receipt Task 0288-U7：增加 Map / Encounter 工作区投影

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `runtime.ts` / `runtime-game-instance.ts` 增加 `MapRunQuery.getWorkspaceView(runId)`，返回冻结的 Run、Map、Node、Edge 与 Encounter 展示快照；`workspace-router.ts` / `workspace-renderer.ts` 增加 runId-only `map` route；新增 `map-workspace.ts` / `map-workspace.css`；新增 `gameplay-b-map-workspace.test.ts`；在 `ui-style/patterns.md` 记录真实复用边界。 |
| 未完成内容 | 无（Map 命令与动作委托由 U8 接入） |
| 范围外变更 | 无 |

## 施工前 DOM / Component Sketch

- **状态来源：**`WorkspaceRoute { kind: 'map', runId }` 只作定位；Workspace 通过 `GameReadModel.mapRun` 查询当前 `MapRun` 与 detached / readonly 地图投影。Runtime owner 持有唯一位置；UI 不读 Registry、不复制 Datapack 定义、不持有可写 MapRun 副本。
- **节点结构：**复用 `renderWorkspaceFrame(id: 'map')`。左列显示 Map 标题与 Node 进度列表；Node 使用稳定 `data-map-node-id` 语义键和当前 / 已访问 / Encounter 完成 / 出口文本状态。中列显示当前 Node 与来自当前 Node 出边的相邻目的地；只有实际相邻 Node 渲染移动动作。右列按同一投影显示活动 Encounter、数据声明的完成标签和移动锁定原因；非 Encounter 时显示当前 Map / 出口状态。Map 与 Encounter 共用同一 Route。
- **返回：**Frame 标题区域提供 `data-map-back` 动作。Route 进入与退出可重建 Workspace；退出恢复保存的 `WorkspaceLocation`。U7 只输出动作标记，不绑定 Spot 或 GameCommands。
- **滚动 / 焦点：**左右内容列由 WorkspaceFrame 声明 `scroll: 'content'`，Node 列表用稳定容器 `data-map-node-list`；不添加画布或浮层。正常移动 / 完成后目标仅为 `[data-map-workspace-region]`，U8 委托器应只更新该 Map 区域，保留列外 shell、滚动位置和不受影响的焦点。若焦点动作节点在状态变化后消失，将焦点转到当前 Node / Encounter 标题；当前组件不创建 Popover 锚点。
- **局部刷新边界：**`game ↔ map` 路由身份变化允许重建 Workspace；MapRun 普通命令不应全量重建 `#app` 或旁侧 shell。Map 组件导出纯渲染入口与稳定区域标记，供 U8 的命令委托刷新本区域。该组件本身不调用命令、不改运行状态。
- **样式加载与视觉：**使用现有 WorkspaceFrame / `.mini-card` / 面板、文本和主题状态角色；WorkspaceFrame 与面板布局选择器限定在 `.workspace-frame--map`，其余组件规则使用 `.map-workspace__` 专属前缀隔离。由 `map-workspace.ts` 导入对应 CSS，避免改动白名单外的 `main.ts`。

## 测试与验证结果

- `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/workspace-router.test.ts`：通过，2 个测试文件 / 13 项测试通过。覆盖 detached/frozen 投影、无 legacy Workspace 的 route-only Map 显示、相邻 Edge、Encounter 锁定与声明完成标签、回到地点 / 出口投影及返回游戏 route；另以合成的合法终态投影确认“出口 Node 自身的 Encounter 已完成”时仍同时显示成功结局和完成上下文。
- `npx tsc --noEmit`：通过，无类型错误。
- 代码边界复核：Map UI 只读取 `GameReadModel.mapRun.getWorkspaceView()`；投影由 Runtime 持有的 `MapContentResolver` 构造，不从 UI 读 Registry，也不缓存可写 MapRun。布局复用 `WorkspaceFrame` 与现有面板 / 卡片 token；WorkspaceFrame / 面板规则限定在 `.workspace-frame--map`，其余组件选择器统一使用 `.map-workspace__` 前缀。
- 浏览器人工检查：未单独启动浏览器；本 Unit 的 DOM 行为由上述 happy-dom 测试覆盖。

## 遇到问题

测试先发现锁定说明选择器与组件标记不一致，以及当前地点的完成状态未同时显示；已分别改为查询稳定 ID，并让当前地点同时呈现“当前位置 / 遭遇已完成”。后续复核发现成功分支需要优先于普通完成状态，现改为在成功块里保留出口遭遇已完成说明，并有 focused render assertion。类型检查先发现查询闭包参数缺少 `string` 注解，已补齐并通过。

## 需上游确认项

无。U7 输出 `data-map-back`、`data-map-move-to`、`data-map-complete-encounter` 与 `[data-map-workspace-region]`；实际导航和命令委托属于 U8。
