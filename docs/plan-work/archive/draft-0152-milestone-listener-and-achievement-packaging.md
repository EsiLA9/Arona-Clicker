# Draft：Milestone Listener 与 Achievement 包装层

状态：proposed — v1 玩法语义与能力事实审计已完成，待另立施工 Task

## 背景与目标

项目已有 EB-T Registration/Withdrawal，以及 Milestone P0。Milestone P0 将 Condition 首次成立固化为 Save 级、单调的 completed 事实。

本方向在其上增加 **Milestone Listener**，作为 EB-T 的领域用户包装；**Achievement** 读取 Listener 对应的完成事实，并为玩家提供标题、描述与展示。Listener 用引入条件渐进披露内容，避免无关 Init 的目标长期占用监听资源；“引入”是运行准入，不要求是玩家可见的接取动作。

## v1 核心定义与模型

> **Milestone Listener 面向条件监听与一次性完成。** 引入后等待目标 Condition 首次成立，并将这一事实提交为 Save 级、不可逆的 completed。
>
> **Achievement 是完成事实的展示包装。** 它读取 completed fact，不拥有目标监听、完成生命周期或奖励结算。

作者模型：

```yaml
Listener:
  when:   什么时候获得引入资格
  target: 等待哪个当前状态 Condition 成立
  then:   可选的一次性完成效果
  next:   哪些后续 Listener 获得引入资格

scope: global | init-bound
```

运行关系：

```text
PlayerData / 当前 Init
        ↓ 确定 Listener 是否可引入、是否应监听
引入 → EB-T 注册 → 立即完整求值 target
                     ├─ false → 等待相关事件并重验
                     └─ true  → 幂等提交 Save completed
                                  → optional then
                                  → next 获得引入资格
                                  → 撤出当前监听
                                             ↓
                                       Achievement 展示
```

## v1 已裁定语义

### 引入、监听与追赶

- Listener 只使用当前可读取的状态事实；不要求玩家在引入后重新表演已经完成的行为。
- 引入顺序固定为 **注册 → 立即完整求值**，避免检查与注册之间漏掉状态变化。
- 若引入时 `target` 已成立，立即完成；读档、投影重建、Init 返回及连续后续引入都允许追赶已成立目标。
- `not-introduced → listening → completed` 是概念生命周期。可从既有事实推导的状态不要求额外持久化；Registration 是可重建投影。

### 分区载入：存档恢复与游玩中动态准入

- 不使用“进入 N 次”或进入次数阈值。分区准入只根据持久到访事实与进入行为判断。
- **读取存档 / 投影重建**：从 PlayerData 的已访问事实推导哪些 Init/Area 分区已具备引入资格；将符合条件的 Listener 载入，注册后立即求值。历史上的 `firstEntered` 不需要重放。
- **游玩中动态载入**：`entered` 用于进入对应 Init/Area 时重新计算分区准入；`firstEntered` 可用于只在首次到访时引入的分区。两种信号可各自作为准入来源，也可共同决定准入；通过后按同一注册与立即求值规则处理。
- 持久到访事实负责跨读档恢复，进入行为负责本次游玩中的及时更新；二者互补。已完成 Listener 仍由 Save-level completed fact 决定，无论分区卸载或再次进入都不重置。
- 当前代码已有 Init/Area 到访集合与 `initEntered` / `areaEntered` 事件，但事件不带 `firstEntered` 标记；首次进入目前由 InitService 内部判定。v1 的玩法语义不要求改变，具体如何把首次信号交给准入逻辑留在能力审计中确认。

### 监听范围与完成历史

两条轴分开定义，但 v1 的完成历史固定为现有 Milestone 语义：

| 监听范围 | 监听行为 | 完成事实 |
|---|---|---|
| `global` | 全程保持监听 | Save-level monotonic completed |
| `init-bound` | 仅对应 Init 活跃时监听；离开时撤出，返回时重建 | Save-level monotonic completed |

Init-bound 只控制 Registration 生命周期，不清除或分割完成事实。按 Init 分别完成、按进入周期重置、重复完成及轮次 identity 均不属于 v1。

### 完成结果与后续资格

- `then` 可省略。若存在，只有首次成功将未完成事实提交为 completed 的路径有资格执行一次性效果；completed 提交是幂等门。
- 完成顺序为：**target 成立 → 幂等提交 completed → optional effect → 后续 Listener 获得引入资格 → 撤出当前监听**。这是玩法语义；具体事务与运行时挂接由后续工程核验决定。
- `next` 表示后续 Listener 获得引入资格，不代表强制立即激活，也不是 EB-T 事件链。后续 Listener 仍需满足自己的 `when`。
- 一个 Listener 可以提供多个 `next`；它们只是多个候选目标获得引入资格，不额外形成线性/支线执行器。

### Achievement

- v1 Achievement 观察一个 completed fact，提供标题、描述及玩家可见展示。
- Achievement 不拥有独立完成状态、奖励、领取、监听或重置语义。

## 示例

```yaml
Listener A:
  when: 已取得 Abydos Init（仅当该事实可可靠读取时）
  target: 满足当前支持的 Condition
  next: [B]

Listener B:
  scope: init-bound(Abydos)
  when: A completed
  target: 某 Spot 达到 Lv.2
  then: 可选的完成效果
  next: [C]

Achievement:
  observes: B completed
  title: 重建的第一步
  description: 将某 Spot 提升至 Lv.2
```

若 B 获得引入资格时 Spot 已达 Lv.3，B 立即完成。若设计要求“引入之后再升级一次”，则需要行为历史或基线，不属于 v1。

## 进入能力审计前仍需确认的事实

这不是开放玩法语义，而是决定 v1 authoring capability boundary 的项目事实：

1. 哪些 PlayerData 到访事实可在读档/重建时恢复分区准入，`entered` / `firstEntered` 如何在游玩中可靠触发重算？不得从未持久化的过去事件推断历史；无需设计进入次数统计。
2. 哪些 `target` Condition 已有可靠的 dependency→activation event→filter→registration 覆盖？当前 Milestone P0 能力有限：候选包括 per-Init `resource`、`spotLevel` 与两种 story completion；`alwaysTrue` 可在引入时求值；`stat` 与 global resource 不属于已证明的 reactive 范围。最终以源码、测试及覆盖审计为准。

审计若发现覆盖不足，应收窄首期可编写的 Condition 子集，不因 Listener 扩大 EB-T 事件面。

## v1 明确暂缓

按 Init/per-entry 完成、周期重置、重复完成、轮次 identity、行为基线、每日任务、进度计数 UI、Achievement 奖励/领取、复杂成就聚合、任意 Condition 覆盖及通用 Condition→Event 框架。

本稿记录已收敛的玩法语义与待核验事实，不代表批准施工。

## 相关路由

- [[draft-0144-eventbus-trigger-millstone]]
- [[draft-0142-trigger-gameplay-packaging]]
- [[task-0145-reveal-condition-event-coverage-audit]]
- [[task-0151-milestone-persistent-arrival-facts-p0]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
