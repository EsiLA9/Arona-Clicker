# Receipt：Task 0288-U5 GameInstance MapRun 命令接线

## 完成内容

- GameInstance 只持有一个私有 MapRunService owner；开始时从当前 Registry 构造 Resolver，并在 init / load / reset / dispose 时替换为空 owner，使 MapRun 保持易失且不进入存档。
- GameReadModel 增加只读 `mapRun` 查询：返回 U4 的 detached MapRun 快照、当前活动 Encounter 的冻结投影；无活动 Run 或 Encounter 时明确返回 `null`。
- GameCommands 与 `createGameCommands()` 增加 `startMap`、`moveMap`、`completeMapEncounter` 三项窄命令；直接委托 U4 服务，不接受调用方提供成功/失败结果。
- 集成测试经 GameInstance 正常加载 base 与 Gameplay B Datapack，再通过 GameCommands 覆盖 A→B 移动、Encounter 移动锁、手动完成后留在 B、移动到出口，以及 init / load / reset / dispose 清理易失状态。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-runtime-integration.test.ts`：通过，1 个测试文件、2 个测试。
- `npx tsc --noEmit`：通过。

## GALHCG 直接路径只读复核

- `graph_project` 确认工作区对应 `acprogram` 项目根。
- 对 3 个源文件执行 `graph_health(check="changed")`：均为 `content_changed`，并提示已有 Evidence 相对当前文件内容过期；GameInstance 的 7 个 owner 分两页检查完成。
- 新集成测试与本 Receipt 返回 `unreferenced_path`，当前图没有直接 Evidence 或 `maps_to` 关联。
- 只做只读复核；没有刷新清单、写入 freshness 或改图。源码与测试仍是实现事实来源。
