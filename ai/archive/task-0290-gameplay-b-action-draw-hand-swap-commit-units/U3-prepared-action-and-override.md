# U3：Prepared Action、Target 与共享 Override

**状态：complete — Prepared、Target、Swap 与 PlayerCommand 草稿已实现并通过独立复核**

## 目标

为每名队员确定自然准备行动和目标，并实现免费 Hand 内 Swap 与收费 Hand 外 PlayerCost Command 的独立草稿语义。

## 允许改动文件

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- 新增一个纯 Action / Target Preview resolver（实现时由总控确定源码文件名）
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`

如果字段需要跨层改动或进入其它 Owner，先停并交回总控拆分。`Prepared` 的有效值必须由 Hand 与共享 Override 推导或保存在同一事务态，不得形成两份可写权威。

## Read Set

- Task 0290 的 Prepared / Swap / Command / target 合同。
- `operation-plan-preparation.ts`、`operation-intervention-preview.ts`：参考目标校验和 detached Preview 模式。
- `MapRunService` 当前状态校验与 Map Workspace 查询测试。

## 约束

- 默认 Prepared Action 是 Hand 第一项。无唯一目标时等待玩家选择；非法目标不成为有效准备结果。
- 每轮只有一个全队 Override：`swap` 或 `playerCommand`。Swap 只能选同一角色 Hand 内另一项且免费；Command 只能选合法 Hand 外 Action，额外需要 1 PlayerCost。
- 预览 / 修改草稿不会提交费用、效果、轮次或 RNG。无效或过期请求不占槽；有效草稿可修改 / 清除，不能和另一种 Override 叠加。
- Wait 不是抽出的物理卡，也不消费资源；它只代表此角色没有候选。
- 自动 Planner 不能替换第一抽取项或玩家 Override；只允许补足合法默认 Target。

## 完成条件

- [x] 第一张抽取 Action 成为 Prepared；目标合法，展示无目标 / 单目标 / 多目标三种情况。
- [x] Hand 内 Swap 免费成功，且准备选择在重复 Preview / 查询后保持稳定。
- [x] Hand 外 PlayerCost Command 预览能明确显示 1 点成本；与 Swap 结果和范围可区分。
- [x] 非法 Swap、重复槽、不可支付 Command、失效目标与过期草稿零写入；清除草稿恢复自然 Prepared。
- [x] 另一角色不能通过建立第二份 Override 绕过全队每轮一个槽。
- [x] 独立只读审查无阻塞问题；Receipt 附行为矩阵与测试结果：[[receipt-U3-prepared-action-and-override]]。

