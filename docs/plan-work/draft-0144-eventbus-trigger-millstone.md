# Draft：EventBus Trigger Milestone — Persistent Arrival Facts

状态：draft — 主体设计已裁定；施工计划见 [[task-0151-milestone-persistent-arrival-facts-p0]]

## 目标

Milestone 是一个 EB-T 领域消费者：将“Condition satisfaction was observed”固化为单调持久事实。Condition 表达“现在成立吗？”，本身可以从 false 变为 true、再变回 false；Milestone 表达“这个 Condition 曾经成立过吗？”，其 completed 事实只能从 incomplete 变为 completed。“Arrival”是概念名称，不表示检测数值阈值穿越；任意 Condition 在某一时刻成立一次即可。EB-T 负责唤醒，Condition 负责判断，Milestone 负责记录历史事实。本文记录已裁定方向与下一步核验任务，不代替施工 Task。

## 概念边界

```text
Game State / Facts ─events→ EB-T ─wake→ MilestoneDomain / Adapter
                                             │ re-read + evaluate
                                             ▼
                                    StateMutationService
                                             │
                                             ▼
                                  MilestoneProgress
```

- **Milestone** 只表达“某个 Condition 曾经成立”的历史事实，例如 `credit.balance >= 1,000,000` 曾在余额达到 110 万时成立，即使之后余额降至 20 万，completed 仍为 true；某 Spot 曾达到 5 级、某剧情曾完成也同理。
- **Milestone 不拥有普通计数器**。累计产出、持有量、收集数等数值仍由 Game State / Statistics 提供；Milestone 可读取它们生成只读进度投影，最终只提交完成事实。
- **Achievement、Quest、教程、挑战、收集目标与展示**是可能消费 Milestone 的上层产品，不属于 Milestone 内核。标题、描述、图标、分类、隐藏状态、阶段 UI 与提示先不进入 v1。
- **奖励 / 领取**是独立能力。v1 不让 Milestone 直接执行任意 `Effect[]`，避免退化成另一种 `event + condition + once + effect` Trigger。
- 多阈值系列先表示为多个独立 Milestone（如 `credit_10`、`credit_100`、`credit_1000`）；系列编排留给 Achievement 等消费层。组合语义继续复用 Condition 的 AND / OR，不再创建 Milestone 自有布尔 DSL。

## 与现有机制的关系

- TriggerSystem 已支持 Runtime Registration、撤出、事件分桶和受限 runtime action；普通 Trigger 的 once 事实写入 `triggersCompleted`。见 `src/engine/effect/trigger-system.ts` 与 [[docs/docs-828/04-mechanisms/trigger-effect]]。
- Information Reveal 已采用“领域派生 desired Watch → Adapter 物化事件监听 → 事件后重验完整条件 → StateMutationService 提交进度”的结构。Milestone 可复用 EB-T Registration / Withdrawal 与此适配模式，但其状态流更简单：`incomplete → completed`，完成后撤出监听。
- 已完成的 Reveal Condition / Event coverage 审计为 Milestone P0 边界提供依据；首期只承诺具备可靠激活事件覆盖的 Condition。覆盖不足的条件留在边界外，不以 tick 全扫兜底。
- 是否抽取共享的“Condition → reactive event coverage”能力尚未裁定。先核验 Reveal 审计结果与当前 `ConditionDepIndex` / 事件订阅能力，不为复用而预设要新增公共层。

## v1 最小模型（主体设计已裁定；字段落点待核验）

### 定义与事实

```ts
MilestoneDef {
  id: string;
  condition: Condition | ConditionGroup;
}

MilestoneProgress = { completed: string[] };
```

`incomplete` 由 `id ∉ completed` 推导，不持久化两态状态。类型仅为讨论示意，最终字段、容器和命名应在施工 Task 中按实际代码落点核验。v1 的权威完成事实属于 Save；本草案不预设 Def 是否需要冗余的 `scope: 'save'` 字段。Init、Run、赛季与可重置目标不纳入 Milestone v1。`completedAt` 不作为 P0 前提。

### 运行时路径

1. 从当前 Datapack 与 Save Progress 推导尚未完成的 desired watch。
2. 对可响应目标注册 EB-T runtime Registration；每次实际 projection 建立时先挂监听，再评估当前 Condition，避免漏掉已满足目标。哪些生命周期会重建 projection，由施工前核验的运行时架构决定，不作为 Milestone 领域契约。
3. 相关事件唤醒后重新读取当前事实并完整求值，不信任旧候选或事件载荷作为完成证明。
4. Condition 首次为真时经 `StateMutationService` 幂等提交 completed 事实，并撤出该目标 Registration。
5. Registration 是可重建派生物；Save Progress 是权威事实。已完成目标在重建后不重新监听或重复完成。

### P0 验收

1. **Admission correctness**：当前 Condition 已成立时，projection 建立即完成。
2. **Reactive correctness**：Condition 从 false 变为 true 时，对应事件唤醒后重新读取事实、重新求值并完成。
3. **Monotonic persistence**：Condition 从 true 变回 false 后，completed 仍成立。
4. **Reconstruction correctness**：runtime projection 重建后，已完成目标不重新监听，也不重复提交。

P0 可选用 milestone completed 事件作为其他系统消费入口，但是否新增事件及其目录契约仍需在施工 Task 中依据 `EVENT_CATALOG` 核验。P0 不含成就 UI、奖励、领奖、多阶段系列、隐藏目标或重置机制。

## 明确暂缓范围

Achievement / Quest / Tutorial / Challenge 产品模型；持续进度所有权与计数器；标题、描述、图标、分类、隐藏与阶段展示；奖励、自动发放、领取及其 UI；可重复或周期重置；多阶段系列编排；未被可靠事件覆盖的实时目标；通用 Trigger 或 Condition DSL 重做。

## 可能架构落点（不构成决定）

领域服务与 Adapter 预计位于 `src/arona-clicker/services/`，Def 契约位于 `src/data-services/contracts/`，状态写入经 `StateMutationService`。具体位置应在裁定并进入实现任务后按依赖边界确认。新增字段或枚举时按 `AGENTS.md` 执行 Schema 生成与同步。

## SolChat 建议与项目裁定

- SolChat 建议将拼写从 `Millstone` 修正为 `Milestone`，并建议把核心定义收敛为持久抵达事实。
- **裁定修正：** Condition / target 本身不要求单调；Milestone 的 completed fact 才是单调事实。设计定义为“将 Condition 首次成立固化为单调持久事实的机制”。
- **已裁定：** Milestone 是通用 Persistent Arrival Fact，而非 Achievement Service。v1 仅保存 Save-scope、不可逆的 completed 事实；不拥有统计计数、不负责奖励/领取、不负责展示、不具有前置/系列/重置语义。
- **已裁定：** Runtime Registration 是可重建投影，MilestoneProgress 是权威 Save 事实。P0 采用上方 Admission、Reactive、Monotonic persistence、Reconstruction 四项验收。
- **字段保持开放：** v1 的事实归属为 Save，但暂不决定 `MilestoneDef` 是否声明 `scope: 'save'`；没有额外信息价值时不预设冗余字段。
- **尚待事实核验：** 整理已完成的 Condition coverage audit 结果以确定 P0 支持边界；实现前核验真实生命周期及代码落点。两个真实消费者形成前不抽取通用 reactive-condition 框架。

## 当前核验（2026-09-25）

- 已核对 docs-828 的 Effect/Trigger、EventBus、状态分层及架构纪律说明。
- 已核对 Information Reveal Adapter / Domain、StateMutationService 入口与相关生命周期测试；本文只记录可见架构事实，不推定 Milestone 已有实现。
- 未运行测试；本次仅修订策划草案与索引。

## 后续任务（由 P0 Task 承接）

- [[task-0151-milestone-persistent-arrival-facts-p0]] 承接 Coverage Audit 结果映射、Runtime integration 核验及 P0 实现；本 Draft 不再扩展概念设计。

## 相关路由

- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[draft-0142-trigger-gameplay-packaging]]
- [[draft-0143-trigger-runtime-registration-withdrawal]]
