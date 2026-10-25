# docs-830/05-domains/world-and-spots — 世界与据点

本文回答：玩家如何进入世界线，以及据点升级如何改变运行状态。

## Init 生命周期

`InitService` 管理新建、恢复、软重启、硬重启和进入 Init。`startNewGame()` 创建默认 `PlayerState`，登记当前 Init 并进入；`resumeInit()` 在切出活动 Init 时先保存其快照，再恢复目标 Init 的快照。没有快照的 Init 会以定义中的初始配置建立起点。

`enterInit()` 设置活动 Init 和默认 Area，初始化默认 Spot，挂载 Init 专属 Trigger，并可自动启动起始剧情。随后重挂 Affector、刷新可见性和剧情投放。区域状态与每个 Init 的快照由状态快照服务管理；Controller 在完成新建或恢复后单独调用 `GameInstance.start()` 开启会话。

```text
Lobby → 选择 Init → startNewGame / resumeInit → enterInit → start Session
```

## Spot 升级

`SpotService.upgradeSpot()` 检查据点拥有状态、等级上限、升级条件和支付选项；随后通过 `StateMutationService` 原子提交花费与等级变化，再应用升级效果并刷新可见性和 Affector 状态。

```text
升级命令 → SpotService 校验 → 原子扣费与升级 → Effects → 刷新派生状态
```

校验包含：Spot 存在且已拥有、下一等级未超过有效上限、对应等级条件满足、支付选项有效且余额足够。提交事务只包含资源/物品成本与 Spot 等级；升级效果在提交之后应用，最后重算可见性并检查 Affector。升级失败在提交前返回，不产生部分扣款。

源码入口：`src/arona-clicker/services/world/init-service.ts`、`spot-service.ts`、`src/arona-clicker/state/state-mutation-service.ts`。相关测试见 `tests/engine/def-factory/spot.test.ts`、`tests/engine/spot-payment.test.ts`。

基础状态流程见 [[docs/docs-830/02-data-and-state/state-and-events]]；会话启动见 [[docs/docs-830/03-runtime/session-and-tick]]。
