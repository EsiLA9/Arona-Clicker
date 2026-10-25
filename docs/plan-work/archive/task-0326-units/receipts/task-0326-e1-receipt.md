# Receipt 0326-E1 — MapRun逐节点战斗初始化

> Parent Task: [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[docs/plan-work/archive/task-0326-units/task-0326-e1]]

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（本Unit实现与独立测试完成；最终合并回归待主Agent确认） |
| 实际修改 | `src/data-services/contracts/gameplay-map.ts` 新增 `partySetup` 合同及 node-local TSDoc；`src/arona-clicker/services/map/map-run-service.ts` 导出 `getMapDefinitionAtNode` 并按首次进入节点重置HP/cap、敏捷、PlayerCost、Actor/Team资源、MapRun statuses和上一阶段回执，更新stage-specific Hand draw、预览、结算、workspace cap与restore校验；新增 `tests/engine/map-stage-initialization.test.ts`；本Task登记本Unit与Receipt |
| 未完成内容 | 无；新增的“仅首个活动/round 1允许无回执恢复”守卫已包含在主Agent最终合并验证中；partySetup生成Schema已同步。本Unit未接Runtime/UI/场景Binding |
| 范围外变更 | 无；只读审计确认的 `field-investigation` 内容与旧测试差异未修改 |
| GALHCG影响闭环 | `graph_project` 确认 `project_id=acprogram`。按主Agent给出的17条直接影响路径逐一只读执行 `graph_health(check="changed", options.path=...)`，revision 39006；6条已有直接映射，均为 `content_changed` 且Evidence陈旧（runtime-game-instance 4/4，runtime-commands 1/1，runtime.ts 1/1，event-catalog 1/1，controller-actions-operation 3/3，engine-defs.gen.json 5/5）；另11条返回 `unreferenced_path`（无直接Evidence/maps_to）。两条owner_total=7的路径均分页读完（5+2），其余owner分页完整。所有检查均 `read_only=true`、`freshness_written=false`；没有改图、刷新或写观察，留待Task收尾统一判断。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 阶段初始化回归 | `npx vitest run tests/engine/map-stage-initialization.test.ts` | 通过：1 test | 覆盖三阶段状态重置、cap治疗、stage-start与中途恢复、篡改HP拒绝、重访已完成节点不重置、restart回首战。主Agent最终34项合并测试包含restore守卫并全部通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过（执行时工作树） | 最后追加的restore活动索引守卫及全量接合仍待主Agent最终类型检查。 |
| Schema | 主Agent运行 `npm run gen:schema`；只读核对生成协议 | 已同步 | `engine-defs.gen.json` 含 `partySetup` 及 `GameplayMapPartySetupDef`。本Unit没有修改生成文件。 |
| 差异检查 | `git diff --check HEAD -- src/data-services/contracts/gameplay-map.ts src/arona-clicker/services/map/map-run-service.ts` | 无诊断 | 只检查本Unit两个源码文件。 |
| MapRun现有回归 | `npx vitest run tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-basic-map-p0-p3.test.ts` | 本Unit未运行 | 主Agent正在统一最终回归，结果以主Agent Receipt为准。 |
| 普通地图失败归因 | 对比 `git diff HEAD -- src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` 与4个旧测试文件 | 已核实为既有内容差异 | Field-investigation Map 从 manual `完成调查` 改为 counter condition `记录3条线索`，并新增 `verify-clue` 与档案室支线；`gameplay-b-map-run`、`gameplay-b-map-save-resume`、`gameplay-b-map-runtime-integration` 与 `gameplay-b-map-workspace` 测试均未相对HEAD修改，仍硬编码manual/旧文案并调用 `completeMapEncounter`。这批失败与本Unit的 `partySetup` 路径无关；未改旧样例或测试。 |

### 遇到问题

- 主Agent最终合并验证通过：Runtime 8、Scenario 5、E1 1、Spot UI 5、Schema 15，共34项。另报告旧12个文件共161 tests通过。
- `field-investigation` 内容与未更新的普通Map回归测试存在契约差异，具体为其Encounter结束从手动完成改为条件完成；主Agent负责决定旧样例/测试后续处理。本Unit不处理此范围。

### 需上游确认项

- 无；最终合并验证及TypeScript检查已完成。
- 决定是否另立工作更新 `field-investigation` 旧测试以匹配现行Map内容；本次只提供只读证据。

### 事实更新建议

- `GameplayMapNodeDef.partySetup` 是 node-local；需要阶段HP/cap/敏捷的战斗节点须分别声明。Setup首次合法入场时清除上一个Encounter Commit回执窗口；restore保留当前节点状态，不重放Setup。此规则已写入类型TSDoc。静态Datapack schema生成已由主Agent同步。
