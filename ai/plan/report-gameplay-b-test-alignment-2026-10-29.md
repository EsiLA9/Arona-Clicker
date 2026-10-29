# Gameplay B 测试与现行代码对齐（2026-10-29）

状态：已修复，全量 `npm test` 349 文件 / 3491 项通过。

## 背景

跑 task-0336 全量回归时发现 10 个文件、25 项失败，全部落在 `gameplay-b-*` 与 `engine-contracts`。这些文件与被测生产代码都在工作树里未改动，说明失败来自**已提交的样例地图演进与部分测试未同步**，与本轮 Story 编辑器工作无关。

修复原则：生产代码与 Registry 校验被视为正确（编码样例地图的行为就是作者错误），只改测试或测试 fixture；只在测试内替换样例地图时使用最小覆盖，不新增生产分支。

## 五类根因与处理

| 根因 | 影响文件 | 处理 |
| --- | --- | --- |
| 样例地图新增 `archive` Node、`verify-clue` Action、`resumeVersion` 6、`initialActorResources` 2 条、Node b 改为计数器条件完成 | `gameplay-b-map-registry`、`gameplay-b-map-resolver`、`gameplay-b-map-runtime-integration` | 更新陈旧期望（版本表、Node 列表、边列表、完成方式）；`map-registry` 的版本表补齐新地图 `status-damage-reward-example`，并把缺失 ID 一次性列出便于后续维护 |
| 派生 fixture 整体替换 `actions` / `initialTeamResources`，但继承的 Encounter、Edge 仍引用已删除的 Action 或 Team 资源 | `gameplay-b-map-relations`、`gameplay-b-map-source-transactions` | 新增 `tests/engine/gameplay-b-map-test-fixtures.ts::withoutDanglingEncounters`，只丢弃无法解析的 Encounter 与 Edge 条件，保持派生文档合法 |
| 需要“按需完成 Encounter”的 Round-trip / 命令面测试仍假设手动完成 | `gameplay-b-map-run`、`gameplay-b-map-save-resume`、`gameplay-b-map-runtime-integration` | 用 `withManualEncounterCompletion` + `withMap` 在同一份样例地图上覆盖 completion，不重放与断言无关的三次线索行动 |
| 存档信封是序列化 JSON，`undefined` 键消失；Actor 资源只剩 Stamina | `gameplay-b-map-save-resume` | 期望改为与 `JSON.parse(JSON.stringify(active))` 比较，并按当前地图声明收紧 actorResources |
| `GameInstance` 构造在 wiring 之后立刻使用 `eventBus`/`registry` 并创建 MapRun owner；旧测试用 no-op wiring，且 `services are not wired` 守卫已从源码删除 | `engine-contracts`、`gameplay-b-event-runtime-integration` | 自定义 wiring 改为委托 `wireGameInstance` 并断言调用发生；删除已不存在的守卫断言，保留“facade 不暴露 owner”断言 |
| Item 草稿新增显式 `additionalTarget: null` 槽位 | `gameplay-b-map-source-transactions` | 期望补上该字段 |
| Edge 条件投影带 `kind` 判别字段 | `gameplay-b-basic-map-p0-p3` | 期望补 `kind: 'teamResourceAtLeast'` |

## 结论与边界

- 生产代码、Registry 校验与 MapRun 行为未为迁就测试放宽。
- 共享 helper 只在测试目录，用于派生样例地图；样例地图本身保持唯一权威。
- 未做浏览器验收；`npm run check:architecture`、`npm run check:docs`、`npx tsc --noEmit` 与全量测试均通过。

后续若再次扩展样例地图，优先同步 `gameplay-b-map-registry` 的版本表与派生 fixture 的引用清理，避免同类连锁失败。
