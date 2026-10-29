# 世界信息揭示、Milestone 与 Achievement

本文解释条件如何成为信息揭示或里程碑完成事实，以及成就界面如何读取这些事实。Init 和 Area 的进入流程见 [[world-and-spots]]；条件与 Trigger 基础见 [[conditions-and-visibility]]、[[trigger-mechanism]]。

## 数据、监听与事实

```text
当前 Registry + PlayerState + 当前 Init
  → Domain 推导待观察的条件及唤醒来源
  → Adapter 注册事件监听，注册后检查当前条件
  → 事件命中时重新核对当前条件 → StateMutation 写入进度事实
  → 撤销已完成的监听；查询再从状态投影显示结果
```

Domain 计算需要观察什么，不直接写进度或注册事件。Adapter 负责将希望观察的条件接入 TriggerSystem，并在运行状态或内容变化时对账。Watch 是可重建的运行时监听，PlayerState 中的揭示和完成记录才是可保存的事实；界面查询不会因为读取就完成里程碑。

## 信息揭示：目标和当前状态

一个信息目标由实体种类、完整实体 ID 和目标名共同标识。支持的实体包括 Init、Area、Spot、Enhancement、Item 和主动/被动 Story Entry；适用范围依当前 Init 与定义确定。`existence` 和 `unlock` 不属于该信息进度记录，不能混同为名称等信息已揭示。

`queryInformationReveal()` 给出下列状态：

| 状态 | 含义 |
| --- | --- |
| `unresolved` | 定义缺失、超出当前范围或目标不属于可识别的信息目标。 |
| `prerequisite-unmet` | 前置目标尚未满足，或存在缺失、循环等问题。 |
| `known-no-gate` | 当前目标没有信息门禁；不需要等待一条揭示事实。 |
| `known-progress` | 该目标的揭示事实已记录。 |
| `pending-gate` | 有门禁但尚未记录事实；有条件门禁可产生 Watch，无条件门禁需在准入对账时处理。 |

同一目标的多条条件按 OR 组合。只有前置要求成立后才派生对应 Watch；条件达到后，Adapter 会复查目标、当前 Init、Watch 描述和完整条件，再由 `StateMutationService.revealInformationTarget()` 写入。成功后撤销该监听并重新推导，可能使依赖它的后续目标开始观察。

### 事件覆盖不是全部条件都自动监听

信息揭示目前可将资源变化、Spot 等级变化、剧情完成映射成相应唤醒来源，并在 Init 准入后检查当前条件。条件同时包含可映射和不可映射的叶子时，唤醒覆盖可能只是部分；没有任何受支持事件来源时是 `admission-only`，只在显式对账时检查，不会因为任意状态变化自动触发。剧情历史与本次 Run 的剧情事实也有不同的失效覆盖。排查时先看完整条件和 `wakePlan`，不要从存在 Watch 推断每种输入变化都会触发重算。

例如 `tests/engine/information-reveal-adapter.test.ts` 的 `AdmissionOnly` 案例在显式 `reconcile` 时检查当前条件，却不创建响应事件的注册。另一个案例先注册精确来源，再检查当前状态；条件满足后写入并撤销监听，避免错过注册前已满足的情况。

## Milestone：可完成的条件与效果

`MilestoneDef` 包含完成条件；可选 Listener 关联 Area 和完成后的 `then`。对带 Listener 的里程碑，仅当关联 Area 属于当前 Init 且已经访问时，才派生该条件的 Watch。未关联 Listener 的里程碑也可按其条件派生；不要把 Area 访问要求套到所有定义上。

Milestone 使用自己的条件叶子到事件来源映射：非全局资源、Spot 等级、剧情完成可以提供唤醒来源；`alwaysTrue` 是静态条件，不提供事件。关联 Area 的当前 Init 上，特定形式的 `$InitProducedAmount` 和 `$InitCollectedAmount` 统计条件也能映射到相应资源或物品事件，且只支持实现允许的比较形式。若条件组含无法映射的叶子，当前实现不为该组建立可靠 Watch；关联 Listener 已准入时可在开发日志中报告首个不支持的叶子。它与信息揭示的部分覆盖策略不同。

Adapter 注册来源后也会立即求值，之后每次唤醒都重查当前 Watch 与完整条件。满足时先写入完成事实、撤销监听，然后执行 Listener 的 `then` 效果。**完成记录和后续效果不是一个回滚事务**：效果抛错会记录日志，完成事实保留，也不会因为恢复或重挂而自动重试。无 Listener 的旧式 Milestone 不会产生 Listener 效果。

例如 `tests/engine/milestone-runtime.test.ts` 覆盖先访问 Area 后再准入监听、存档恢复时重建未完成监听，以及 Listener 效果抛错后完成记录仍保留。排查时应分别确认是否进入/访问了关联 Area、条件叶子是否支持、完成事实是否已经存在，以及后续效果是否报错。

## Achievement View 与恢复

`buildAchievementView()` 从 Achievement、Listener、Milestone 和 Area 的有效引用组合视图；缺少任一引用或关联 Area 未访问时不显示该项。当前 Init 使用当前 `visitedAreas`，其他 Init 使用对应快照的访问记录；完成状态来自 Milestone 完成事实。排序先显示当前 Area，再显示当前 Init 的其他 Area，最后显示历史 Init 的发现。

仅部分单叶统计条件可投影数值进度：当前实现识别对应 Init 的 `$InitProducedAmount`、`$InitCollectedAmount` 和受支持的比较形式。组合条件或不支持的统计形式仍可能显示成就，但没有该数值进度。`rewardDescription` 是展示文字，实际后续效果由 Listener 的 `then` 执行。

离开 Init、重置或重建运行时会撤销旧监听；进入 Init、成功应用相关内容或恢复存档后根据当前定义和保存事实重新推导。已经保存的完成/揭示事实与监听分离；定义暂时不存在时，历史事实并不因此自动删除。恢复时不应把旧的 Trigger 注册当成持久化对象直接复用。

源码：`src/arona-clicker/services/world/information-reveal-domain.ts`、`information-reveal-adapter.ts`、`milestone-domain.ts`、`milestone-adapter.ts`、`src/arona-clicker/read-model/achievement-view.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`。测试：`tests/engine/information-reveal-domain.test.ts`、`information-reveal-adapter.test.ts`、`information-reveal-save-rebuild.test.ts`、`milestone-adapter.test.ts`、`milestone-runtime.test.ts`、`achievement-view.test.ts`。
