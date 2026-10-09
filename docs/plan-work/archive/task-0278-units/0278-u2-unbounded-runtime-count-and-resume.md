# Unit 0278-U2：不限 SceneAction Runtime 计数与恢复

## Goal

让 SceneAction planner / Runtime 在无 sceneActionBatches 上限时允许每次显式提交一批，并将安全计数纳入现有 Run 存档恢复；补齐无 maxBeats 且无 Location 结果谓词的通用 Combat opponent 清场出口。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md | Run owner、Commit 与恢复合同 |
| 文档 | docs/docs-829/05-conventions/architecture-discipline.md | 原子状态 owner 边界 |
| 源码 | src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch | 当前批次校验与上限推进 |
| 源码 | src/arona-clicker/services/operation-runtime-service.ts：createRun、validateRestoredRun、commitSceneActionBatch | 计数、恢复及原子安装 |
| 测试 | tests/engine/operation-scene-actions.test.ts、tests/engine/operation-runtime-service.test.ts | 批次合同和 Save/Resume |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只扩展当前提交与恢复入口；超出文件白名单先更新 Task |

## Optional Read Set

- src/arona-clicker/contracts/operation.ts：OperationLocationProgress

## Do Not Read by Default

- docs/plan-work/archive/**
- PlayerState 与 SaveData 之外的生命周期模块

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Planner 当前拒绝没有有限 sceneActionBatches 的 Scene batch。 | operation-resolution-planner.ts：planSceneBatch | 需仅在 cap 缺省时跳过上限比较 |
| Runtime 采用 detached Run 计算后安装，Resolution history 保留最后 32 条；Resume 对计数 / 序号做安全整数校验。 | operation-runtime-service.ts：commitSceneActionBatch、validateRestoredRun | 不增加任意批次总数上限 |
| 成功 Combat Beat 已重算硬失败与作者 Location predicates；缺省 maxBeats 且无 Location 结果条件时此前没有通用 opponent 清场完成分支。Secondary objective 不参与 Location 成功判定。 | operation-runtime-service.ts：commitBeat、evaluateLocationProgress；operation-progress-evaluator.ts：evaluateOperationLocationOutcome | 仅统计当前 Location / Scene 启用 opponent Participant 候选行动的存活 Actor；primary objective / partial outcome / failure condition 仍控制 Location 结果 |

## Constraints

- 维持一次 Commit 一批、失败不写 Run、skip 消耗一次批次但不结算效果。
- 有上限时维持现有耗尽和 fallback 语义。
- 无上限计数按安全整数递增，溢出时在 Run 安装前失败。
- 无上限 Combat 每次成功 Beat 后重新评估清场；清场只完成当前 Location，不跨过作者 Location / Scene completion 合同。

## Allowed Files

- src/arona-clicker/services/operation-resolution-planner.ts
- src/arona-clicker/services/operation-runtime-service.ts
- src/arona-clicker/contracts/operation-scene-action.ts
- tests/engine/operation-scene-actions.test.ts
- tests/engine/operation-runtime-service.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u2-receipt.md

## Explicit Non-goals

- 不增加存档迁移 / 版本兼容、不改变 EventRun owner、不引入后台循环。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；如果必须改动 Allowed Files 外的存档编解码或新加持久状态字段，先更新 Unit 白名单。

## Completion Criteria

- [x] 无上限 implicit 与 explicit Scene 可多次逐批提交，计数安全递增。
- [x] 有限上限输入与达到上限行为保持原样。
- [x] 长批次后 Save/Resume 恢复计数、继续确定性提交；history 仍为最近 32 条。
- [x] 失败 Commit 前后 Run 深相等，批次调用不会在单次命令自动循环。
- [x] 缺省 maxBeats 的 Combat 跨多次显式 Commit 保持可战；最后一名当前启用的 opponent 被击倒后正常完成 Location / Event；显式 maxBeats 原合同不变。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/engine/operation-scene-actions.test.ts tests/engine/operation-runtime-service.test.ts | 通过 |
| 类型检查 | 不单独执行 | 由后续 Unit 后统一执行 |
