# docs-830/05-domains/operation-runtime-and-admission — Operation 准入、Run 与存档

本文回答：Operation 如何确认本局参与者与内容、创建 Run，并在存档中恢复。

## 准入与创建

`OperationEntryService.start()` 接受事件 ID 和角色 ID。准入流程检查当前可用事件、角色持有/解锁状态、角色 Profile 配对及 Init 限制，并从 Registry 解析事件、行动和战术配置。Actor/Profile 初始事实随后投影为本局快照；长期角色对象不会成为 Run 的可变宿主。

```text
事件 ID + 角色 ID
  → OperationAdmission
  → Actor/Profile 快照与可信规则
  → OperationRuntimeService.start()
  → EventRun / 首个 PreparedBeat
```

Run owner 校验内容、复制并冻结本局规则。一个 owner 同时只允许一个进行中的 EventRun。其生命周期事件包括 `runStarted`、地点进入/完成、Beat 解析和 `runFinished`；操作观察记录由独立的 `OperationObservationStore` 保存，供诊断查询。

内容校验分成 Datapack 装载和 Run 准入两处：Registry 阶段核验事件、Location、Scene、Action、Profile、CardPool 等定义之间的结构与引用；准入阶段再结合实际参加者核对 Actor/Profile 配对、目标 Actor、资源作用域和已声明的 Action/Skill。SceneAction 候选、Purchase Offer 与 reserved marker 也有专门合同检查。错误在 Run 创建前返回诊断。

`OperationObservationStore` 保存有界的调试摘要，不参与战斗规则，也不进入 Run Resolution。观察层最多保留 20 条记录，每条不超过 8 KiB，并裁剪过长字符串、超大记录与日志条目，供调试 UI 安全读取。

## 存档与恢复

`GameInstance.save()` 将 `operationEntry.createSaveSnapshot()` 的结果放入 `SaveData.operationRun`。读档时 Entry 层重新解析事件内容，再核对 `resumeVersion`、当前 Init、角色与 Profile 事实，最后由 Run owner 验证并安装快照。缺失或版本不匹配时该 Run 会被拒绝恢复，Runtime 记录诊断并允许重新开始事件。

OperationRun 因此是隔离的局内状态，但具有独立的存档快照；它不并入 PlayerState 的 Init 字段。

源码：`src/arona-clicker/services/operation/operation-entry-service.ts`、`operation-participant-admission.ts`、`operation-runtime-service.ts`、`operation-observation.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`。相关测试见 `tests/engine/student-operation-runtime.test.ts`、`tests/engine/operation-runtime-service.test.ts`。

行动准备与提交见 [[operation-action-planning]]；普通 PlayerState / Init 状态归属见 [[state-and-events]]。

## 哪些事实进入本局

| 输入 / 对象 | 用途 | 生命周期 |
| --- | --- | --- |
| Registry 中的 Event、Action、Profile 等定义 | 描述事件与可信战术内容，供准入解析 | 内容定义可在本局之外管理；启动时校验并形成运行输入。 |
| 已选角色和 Profile | 决定本局 Actor 与可用能力的来源 | 准入后形成 Run 内快照，不把长期角色对象当作局内可变状态。 |
| EventRun | 持有本局位置、进度、资源、随机状态及计划 | 由 owner 管理，可单独生成存档快照。 |
| Observation | 提供有界调试摘要 | 不参与 Resolution，也不作为 Run 的权威数据。 |

Registry 校验回答“内容结构和引用是否可用”；准入还必须回答“这些实际参与者能否与这些内容组合”。通过前置检查不代表之后所有行动都合法，每次命令仍有自己的校验。

## 示例：恢复版本不一致

`tests/engine/operation-runtime-service.test.ts` 以 `resumeVersion: 1` 启动并生成快照，再用版本 2 的定义尝试恢复。Run owner 抛出版本不匹配错误，快照没有部分安装。测试也覆盖非法的负 `PlayerCost` 被拒绝并保持无 Run。

在 `GameInstance` 读档路径中，局内 Run 的恢复失败会记录诊断并允许重新开始事件；这不等于把整份玩家存档当作合法的 Operation 快照，也不意味着忽略所有其他读档错误。

## 什么时候查询、什么时候写入

UI 读取 `OperationView` 或观察摘要来呈现状态；创建、行动、路线和奖励通过 Entry 暴露的命令到达 Run owner。完成之后的奖励领取使用领域写入接口，不能把 View 上显示的奖励当成已经进入长期背包。行动计划与版本校验见 [[operation-action-planning]]。
