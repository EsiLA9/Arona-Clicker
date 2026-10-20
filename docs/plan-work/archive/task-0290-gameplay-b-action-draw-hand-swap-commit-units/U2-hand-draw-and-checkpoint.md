# U2：Encounter Hand 抽取与 checkpoint

**状态：complete — MapRun 内的 Encounter Hand、资源可支付过滤与 checkpoint 已实现并通过独立复核**

## 目标

把 Encounter round、每名队员的 Hand 顺序和抽样状态放进 MapRun 唯一 Owner；进入 Encounter 时 Draw 一次，持久化后可稳定恢复。

## 允许改动文件

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- 新增一个无状态的 Gameplay B Hand resolver（实现时由总控确定源码文件名）
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`（仅同步固定两人队伍的准入 fixture 与 U2 Encounter Hand 断言）

若需要修改文件范围外的 Runtime 接线，交回总控拆分。不得创建第二个 Save Owner。

## Read Set

- Task 0290 的冻结 Draw / Hand、生命周期和验收规则。
- `src/arona-clicker/services/operation-card-candidate-resolver.ts` 与 `operation-tactical-rng.ts`：只复用合适的加权、不放回与确定性随机机制。
- `src/arona-clicker/services/map-run-service.ts` 的进入 / 完成 Encounter 和 restore 路径。
- `tests/engine/gameplay-b-map-run.test.ts`、`gameplay-b-map-save-resume.test.ts`、`gameplay-b-map-runtime-integration.test.ts`。

## 约束

- 当前活跃 Encounter 快照包含 nodeId、round、按固定队伍顺序的 Hand、抽样状态和必要版本信息；不要让 `activeEncounterNodeId` 和新 Encounter 快照成为两个独立权威。
- 若既有只读调用仍需读取 `activeEncounterNodeId`，仅可在 detached Snapshot 上提供从 `activeEncounter.nodeId` 推导的不可枚举只读 getter；可写 Owner 与 checkpoint 不能持有 / 序列化第二字段。
- 本 Unit 只在正式进入 Encounter 时 Draw；抽样确定性，View / Preview / restore 不推进 RNG。U4 接入后，只有成功 Commit 才能触发下一轮 Draw。
- 每个角色 Hand 最多 3 个互异 Action ID；合法候选不足少抽；空候选保留为空并投影 Wait，不重新尝试抽取。
- Draw 仅从当前确实可支付其 Actor / Team resource cost 的 Action 中抽取；Resolver 读取 MapRun 当前余额。后续整轮 Commit 仍须对完整队伍行动重新联合校验，因为多个行动可能争用同一 Team resource。
- 当前 Encounter 结束即清理 Hand / RNG 等 Encounter-local 状态；MapRun-local PlayerCost 与 Actor / Team resources 保留。
- Restore 在安装前完整验证地图版本、Hand ID / 参与者 / 候选关系和 RNG 数据；拒绝不允许部分写入。

## 完成条件

- [x] 加权不放回生成真实 Hand，测试覆盖不同权重、候选少于 3、空候选、不可支付 Action 排除和 ID 不重复。
- [x] 同一活动 Encounter 的重复 Snapshot / Save / Restore 不重抽或改写 Hand。
- [x] 保存 / 恢复 Hand 顺序和抽样上下文后续跑与未中断路径一致。
- [x] 完成 Encounter 清掉所有局部行为状态，并保留 MapRun-local resource。
- [x] 不提供独立 reroll 命令；U4 后续接入时必须验证只有成功 Commit 才会进行下一轮 Draw。
- [x] 独立只读审查无阻塞问题；Receipt 记录测试和恢复拒绝结果：[[receipt-U2-hand-draw-and-checkpoint]]。

