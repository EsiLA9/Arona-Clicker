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

## 功能与可见性

Spot 的基础功能由是否要求持有和声明的条件决定；等级、区域等状态只有在条件表达式涉及它们时才会影响结果。`SpotFunctionalitySystem` 再把 Enhancement 按标签授予的功能并入结果，按功能类型提供给商店、地图或其他产品流程查询；UI 展示到一个 Spot，不代表该功能在当前状态下可执行。

信息揭示和 Milestone 采用“派生 Watch + Trigger Adapter”的模式：领域逻辑根据当前 Init、已访问区域和条件生成需要监听的事件源；Adapter 将 Watch 注册为 Trigger，并在内容/Init/状态变化时重建。事件命中后仍重新核对当前条件，再通过状态写入服务记录揭示或完成事实。Milestone 完成后还可由 Achievement View 投影为区域发现与成就进度。

关键入口：`services/world/spot-functionality.ts`、`information-reveal-domain.ts`、`information-reveal-adapter.ts`、`milestone-domain.ts`、`milestone-adapter.ts`。

源码入口：`src/arona-clicker/services/world/init-service.ts`、`spot-service.ts`、`src/arona-clicker/state/state-mutation-service.ts`。相关测试见 `tests/engine/def-factory/spot.test.ts`、`tests/engine/spot-payment.test.ts`。

基础状态流程见 [[state-and-events]]；会话启动见 [[session-and-tick]]。

区域地图的定义、可见投影和旅行规则从 [[area-map-overview]] 进入；信息揭示与 Milestone 的条件监听及 Achievement 查询见 [[world-reveal-and-milestones]]。

## 世界线、区域和据点的分工

| 对象 | 职责 | 状态边界 |
| --- | --- | --- |
| Init | 世界线和一组初始内容、区域及挂载生命周期 | 当前 Init 与各 Init 快照不是同一份可随意共享的区域状态。 |
| Area | 当前世界线中的位置与可访问空间 | 移动与进入条件仍由领域服务检查。 |
| Spot | 地点内可拥有、升级和提供功能的内容 | 等级和购买结果属于玩家状态；定义来自 Registry。 |
| Session | 时间推进和 Tick | 进入 Init 与 Controller 启动 Session 是不同步骤。 |

切换世界线时，服务保存活动世界线快照，再恢复目标快照或按定义建立初始状态。进入后还要协调默认位置、Trigger 和派生状态。有关快照及存档恢复的完整边界见 [[save-system-and-recovery]]。

## 示例：一次据点升级的成功与失败

`SpotService.upgradeSpot()` 先查定义和持有等级，再检查有效上限、下一等级条件和支付选择；随后将费用和新等级交给 `commitSpotTransaction()`。这一步提交之后才执行升级 Effects、刷新可见性并重查 Affector。

例如，`tests/engine/spot-payment.test.ts` 覆盖使用支付选项把 Spot 升至 2 级，也覆盖未声明支付时返回 `PaymentNotDeclared`。费用 / 等级事务失败与提交后的 Effect 是不同阶段：不能从“扣费与等级一起提交”推断后续所有效果也包含在同一事务里。

## 查询功能不等于执行功能

Spot 声明可以提供商店、地图等功能，已持有的 Enhancement 也可能按标签增加功能。`SpotFunctionalitySystem` 汇总当前结果；真正购买或进入地图时，消费方仍须检查其自身的准入、成本和当前状态。商店具体检查见 [[resources-and-commerce]]；强化与功能的关系见 [[enhancements-and-passive-pools]]。
