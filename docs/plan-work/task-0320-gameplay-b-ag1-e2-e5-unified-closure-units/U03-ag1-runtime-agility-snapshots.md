# Unit 0320-U03：AG-1 MapRun 敏捷输入快照

## Goal

在创建与恢复 MapRun 时冻结作者声明的 Party／Enemy 敏捷补足数值。AG-1 Run 必须保存完整且有序的身份数值快照，恢复时独立核对其与当前 Map 合同相符；E1 Run 继续不含 AG-1 快照字段。此 Unit 只接通输入快照与恢复校验，不计算来源最终敏捷、不排序、不支付费用、不执行效果。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单、预算与停止条件 |
| 规范 | `docs/docs-829/05-conventions/architecture-discipline.md` | Owner 状态归属与 detached 边界 |
| Task | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` | P1 目标与 AG-1 边界 |
| 前置 Unit | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U01-ag1-author-contract.md` 及 Receipt | 作者字段名与闭合 Registry 约束 |
| 排序接口 | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U02-ag1-pure-source-order.md` | 确认下游只接收已冻结 final/base，不在本 Unit 排序 |
| 源码 | `src/arona-clicker/contracts/map/map-run.ts`：`MapRun`、`MapRunEncounterSnapshot` | Run／Encounter 的唯一状态快照合同 |
| 源码 | `src/arona-clicker/services/map/map-run-service.ts`：`start`、`createEncounterSnapshot`、`restoreRunState`、`restoreEncounterSnapshot` | 作者值物化与 Save/Resume 恢复校验落点 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts` | 开局、Encounter 创建及保存恢复行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k tokens；只读创建／恢复快照所需路径与对应测试 |
| 文档 Read Set | 4 篇／节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若需改计划队列、费用或 Receipt 规划，停止并交负责人拆交后续 Unit |

## Constraints

- MapRun 根部新增 AG-1 Party 补足快照 `partyAgility`；按 `partyCharacterIds`／Run party 固定顺序完整记录每名 Party 成员，作者表省略成员物化为 0。不得把战斗敏捷放进 `MapRunPartyMember` 的角色身份字段。
- 活动 Encounter 新增 Enemy 补足快照 `enemyAgility`；严格按当前 Encounter 定义的 Enemy 顺序完整记录，作者省略值物化为 0；无 Enemy 的 AG-1 Encounter 存为显式空数组。
- 两种快照中的身份唯一、无遗漏、无多余且顺序正确；敏捷值必须是非负安全整数。Restore 不从 Cultivate、Gear、实时角色服务、UI 或旧快照之外的来源补读。
- Restore 必须核验快照与当前 Map／Encounter 的作者输入相符；同版本作者数据被修改而保存数值不匹配时拒绝恢复。`resumeVersion` 已不匹配时仍先走现行 `content-version-mismatch` 路径。
- AG-1 Save 缺少所需快照、出现重复／未知身份、改变顺序或非法数值时拒绝；E1 Save 不得带 AG-1 快照，既有 E1 保存恢复行为保持。
- `MapRunService` 只修改开局、Encounter 创建及 Restore 相关函数。明确禁止修改 `resolveEncounterCommitPlan`、费用／效果执行顺序、Receipt 规划和 Commit 安装。
- 不新增旧 AG-1 Save 迁移；不能以新作者 Map 静默解释旧 AG-1 checkpoint。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`（仅本 Unit 指定的创建／恢复路径）
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U03-ag1-runtime-agility-snapshots.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U03-receipt.md`

## Explicit Non-goals

- 不改作者合同、Registry、Schema 或 U02 排序器。
- 不计算 `finalAgility`，不组装 AG-1 执行来源，不改速度排序、费用预检、资源效果或终局检查。
- 不写 scheduler version、Commit 执行序列或 AG-1 Receipt；这些归后续 Runtime Unit。
- 不改 UI、外部成长数值、Hand RNG、MapRun Item 双 Owner 协调或全局 Save 格式。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 `MapRunService` 现状使本 Unit 必须触碰来源规划／Commit 路径，停止并上报，不把 P1 后续改造合并进来。

## Completion Criteria

- [ ] 新 AG-1 MapRun 按固定 Party 顺序保存补足快照，缺失值为 0；E1 新 Run 不产生 AG-1 快照字段。
- [ ] 新 AG-1 Encounter 按定义 Enemy 顺序保存完整补足快照，无 Enemy 时保存空数组；活动 Encounter 转换不复用旧 roster 数值。
- [ ] AG-1 Run／Encounter 快照正常往返恢复；缺项、多项、重复／未知身份、错误顺序、非法数值与同版本作者数值不一致均拒绝。
- [ ] E1 既有保存恢复测试保持通过；E1 存档注入 AG-1 字段会拒绝。
- [ ] 运行两组定向测试、`npx tsc --noEmit` 与 `git --no-pager diff --check`；Receipt 记录实际结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| MapRun 初始化与 Encounter 创建 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| Save/Resume 边界 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 实施记录

- Run 根快照新增 `partyAgility`，按固定 Party 顺序完整物化 Map 补足值；Encounter 新增 `enemyAgility`，按当前 Enemy roster 顺序保存，作者缺省值为 0，无 Enemy 时为空数组。E1 Run 继续省略这两个字段。
- Save/Resume 对 AG-1 快照执行闭合对象检查（含 Symbol 与访问器拒绝）、身份／顺序／完整性、非负安全整数和当前作者值比对；E1 存档注入任一 AG-1 快照字段会拒绝。`start`、Encounter 创建及 Restore 已接线；未改来源规划、费用、Receipt 或 Commit 安装逻辑。
- 首轮定向测试发现 Save/Resume 测试仍断言所有样例 Map 的 `resumeVersion >= 3`；现有 `status-example` 与 `prepared-tag-combo` 版本为 1，U01 Registry 测试已使用逐 Map 版本表。已将该断言修正为当前合同所需的正安全整数检查；版本不匹配行为仍由同测试独立覆盖。
- 最终结果见 [[receipts/U03-receipt]]。
