# Receipt 0290-U2：Encounter Hand 抽取与 checkpoint

**结果：实现完成；独立只读复核通过。**

## 修改内容

- `MapRun` 内新增 Encounter-local round、按固定队伍顺序保存的 Hand、抽样 seed / cursor，以及 MapRun-local Actor / Team resource 余额。
- 新增无状态的加权不放回抽样 resolver：每名角色最多抽 3 个互异 Action；候选不足少抽；无候选保留空 Hand；抽样只在正式进入 Encounter 时发生。
- 抽样前根据当前 MapRun 余额排除付不起的 Action。Actor cost 使用当前角色余额，Team cost 使用共享余额；同一资源的多笔 cost 会合计，缺失余额按 0。整队 Commit 仍需重新联合检查共享资源。
- Encounter seed 在 `start()` 或进入尚未完成的 Encounter 时生成一次并保存；View、Snapshot、Save、Restore 不生成新 seed 或推进游标。
- Restore 在安装 MapRun 前验证队伍、节点、候选关系、资源余额、seed / cursor，并从保存游标重演 Hand 对比；无效 checkpoint 拒绝后不部分写入。
- Encounter 完成后清理 Hand 和随机状态，保留 MapRun-local PlayerCost 与 Actor / Team 资源。可写 Owner 仅持有 `activeEncounter`；旧 `activeEncounterNodeId` 只由 snapshot 上不可枚举 getter 派生。
- 更新 MapRun、Save / Resume 和 Runtime Integration 测试，适配固定队伍的多成员 Hand。

## 验证

- 三个定向 Vitest 文件合计 **20/20** 通过。
- `npx tsc --noEmit` 通过。
- 白名单文件 `git diff --check` 和尾随空白检查通过。
- 独立只读复核通过；复核者未改文件、未运行测试。复核覆盖余额过滤、Encounter seed 生命周期、Restore replay、单一状态 Owner 与 U2 文件白名单。

## 边界

- U2 只在 Encounter 入场抽取第一轮 Hand；U4 负责在成功 Commit 后生成下一轮 Hand。
- 本 Unit 不实现 Prepared Action、Target 选择、Swap、PlayerCost Command 或整轮 Commit。
- 未增加物理卡实例、抽弃牌堆或构筑系统。
