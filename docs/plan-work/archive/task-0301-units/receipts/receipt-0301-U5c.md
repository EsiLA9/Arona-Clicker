# Receipt 0301-U5c

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `tests/engine/gameplay-b-map-save-resume.test.ts` 扩展官方三机器人两轮流程、目标重选、Swap / 手动 target 及 Save / Resume 断言；`tests/ui/gameplay-b-map-workspace.test.ts` 加入官方 Datapack Workspace 无需手点目标即可 Commit 的验收；`tests/ui/gameplay-b-map-vertical-slice.test.ts` 对齐当前 Map location card 交互并验证正式普通战斗回合；Task 0301 与本 Unit / Receipt。 |
| 未完成内容 | 无。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 官方 Map-only Datapack 经 MapRun Owner / Runtime 和 UI 执行；没有旧 Operation、UI 目标推断或额外状态 Owner。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Engine / Registry / Save / Resume | `npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts tests/engine/gameplay-b-map-relations.test.ts tests/data/gameplay-b-map-registry.test.ts` | 通过 | 7 文件、225 项通过。 |
| 正式地图垂直切片 | `npx vitest run --silent tests/ui/gameplay-b-map-vertical-slice.test.ts` | 通过 | 3 项通过；从 Spot 正常入口开始、执行自然行动、显示 Enemy Action Receipt 并完成 Map。 |
| Workspace Enemy / official sample | `npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts -t "Enemy Hands|Enemy Wait|official three-Robot|renders battle HP"` | 通过 | 4 项通过；只读 Hand、Wait、官方三机器人自动提交与 HP / Receipt 刷新。 |
| Flow / DOM | `npx vitest run --silent tests/ui/map-flow-adapter.test.ts tests/ui/map-dom-updates.test.ts` | 通过 | 2 文件、24 项通过；Enemy Receipt 内容和局部 DOM 更新通过。 |
| 完整 Workspace 文件 | `npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts --pool=threads --maxWorkers=1 --minWorkers=1` | 有 1 项失败 | 其余 27 项通过；`shares one real card target between the Map and a read-only Flow copy` 在整文件运行时仍无法高亮 Flow 候选，单独运行该测试通过。属于事件敏感的既有用例；P4 新增只读 Enemy UI 与正式样例定向用例均通过。 |
| 类型 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 架构 | `npm run check:architecture` | 通过 | Engine / Data Services outward import 边界通过。 |
| Schema | `npm run gen:schema`；`npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 | Schema 已生成，10 项 sync tests 通过。 |
| 文档 | `npm run check:docs` | 失败，既有问题 | 48 个旧 Operation / Gameplay B Demo 文件路径失效；Task 0301 本轮新增文档没有出现在报错清单。该问题在本 Task P0 已记录。 |
| 差异 | `git diff --check` | 通过 | 无空白错误；Git 仅提示已有 CRLF 文件的转换提示。 |

## 遇到问题

- 完整 Workspace 单文件执行会使一个读取只读 Flow 卡牌共享关系的旧事件测试失败，但该测试单独执行通过。官方 Enemy 卡牌 / Workspace 新验收均通过。
- 仓库文档检查仍被 48 个既有失效路径阻塞；当前 Task 新增的 Plan Unit 文档未新增检查错误。

## 需上游确认项

- 无；上述失败项已定位为现有测试事件敏感性和旧文档路径，不改变本次已授权的 Enemy autonomous Action 合同。
