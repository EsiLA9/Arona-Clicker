# StoryFollowUp v1 施工任务清单

状态：active — v1 semantics frozen；P0/P1/P2 业务实现与验证完成，AOCI 终态维护待既有治理漂移处理

来源：[[draft-0139-story-follow-up-packaging]]

## 当前进展

- P0 源码事实核验第一轮完成：完成记录提交顺序、当前 StoryEntry 启动路径、Init Reaction 重建边界和 Trigger pre-consume once 均已定位。
- `tests/engine/passive-pool.test.ts` 当前 31 项通过；连同 StoryEntry / Trigger / Builder 回归测试，本轮相关测试共 62 项通过。
- P2 已接入最小运行时适配层：FollowUp 使用独立投影监听，目标 Entry 通过正式 `StoryService.startStory` 启动，成功后才提交 fulfilled；保留 `force` 仅作为当前系统剧情的抢占兼容策略。
- P1 已完成最小声明契约、Builder 接口和 Registry 实体 / Area 引用校验；尚未接入 Runtime lowering，也未改变星野现有 Reaction。
- P1.3 已落为独立 execution / commit adapter，不把 FollowUp 强行 lowering 为普通 `TriggerDef`。
- 业务验收已通过；最终 AOCI maintain 因仓库既有 missing / stale / unbaselined 认知条目阻断，未产生 AOCI 写入，待独立治理任务处理。

## 目标

将 StoryEntry 后续剧情从底层 Trigger 语义收敛为一个受限的作者语义：

```text
所属 StoryEntry 正式完成提交
  → 当前 Init 内等待未来第一个匹配 areaEntered
  → 请求启动一个目标 StoryEntry
```

首个验收样例为星野天台邀约：完成 `base:passivestory:hoshino_conv_2` 后，未来进入 `base:area:schale_rooftop` 时请求启动 `base:activestory:hoshino_rooftop_meet`。

## 非目标

- 不向普通作者开放 TriggerDef、EventBus 事件名、事件桶或任意 Effect DSL。
- 不实现通用 `addTrigger`、任意条件、任意等待事件或任意结果 Effect。
- 不实现 `enter-spot`、`leave-area`、自动 catch-up、跨 Init persistent。
- 不实现 Definition Patch / Overlay append。
- 不新增独立持久化 FollowUp 状态机或 Runtime Binding Registry。
- 不制作玩家“待兑现剧情”列表；第一阶段只提供开发诊断投影。

## 必须先裁定的语义门槛

以下事项未裁定前，不得进入 P2 运行时施工：

1. `StoryFollowUp` 是否正式作为未来作者语义；`StoryEntryReaction` 只作为当前 lowering target，不能被写成长期作者层。
2. `start-story-entry` 是否调用正式 `requestStartStoryEntry` 入口，而不是复用当前 `triggerStory → force: true` 的强制路径。
3. 启动请求失败时是否不记为兑现。已由 FollowUp adapter 保证不继承普通 Trigger 的 pre-consume once。
4. `StoryEntryId` 与 `StoryDefId` 的最小区分方式；至少需要校验目标属于 StoryEntry namespace。

### v1 已裁定的生命周期语义

在不新增 FollowUp 持久化状态的前提下，`current-init` 采用“作用域内运行时监听”语义：

```text
来源 Entry 已完成
AND 当前 Init 有效
AND FollowUp 尚未兑现
→ 建立等待监听
```

离开有效 Init 只卸载监听，不记录永久失效；重新进入有效 Init 时，只要来源 Entry 仍已完成且 FollowUp 尚未兑现，就恢复等待。永久失效、过期和 abandoned 不属于 v1。

## P0：实现事实核验

### P0.1 完成提交点

- [x] 核验 `resolveStoryEnd` 的完成路径。
- [x] 核验 `completeStory` 写入 `storyLog` 与发出 `storyCompleted` 的顺序。
- [x] 核验 StoryEntry 的 `storyId` 与完成日志中的 `storyId` 是否始终是同一命名空间。
- [x] 写出 FollowUp 激活契约：只有权威完成记录已经提交后才 eligible；不绑定 Talklet 播完、UI 关闭、奖励动画结束或区域切换。
- [x] 将 `storyCompleted` 定义为触发 reconciliation 的通知，而不是替代已提交 PlayerState 的事实源。

核验记录：`resolveStoryEnd` 先调用 `applyCompletionReward`，再调用 `StateMutationService.completeStory`；后者先写入 `storyLog`，再发出 `storyCompleted`。因此 `storyCompleted` 可以触发 reconciliation，但 eligibility 的事实源是已提交 PlayerState。

验收：形成不可变不变量——只有 StoryEntry completion 已正式写入权威完成记录后，FollowUp 才能被判定为 eligible；并能用一条事件时序说明何时开始监听、区域切换发生在何处不会丢失。

### P0.2 正式启动入口

- [x] 追踪 `storyEffectRequested → RuntimeEffectReactor → storyService.startStory`。
- [x] 记录当前 `force: true` 对“已完成剧情”和“正在播放被动剧情”的实际影响。
- [x] 设计并裁定 `requestStartStoryEntry` 的最小返回合同：使用同步 `StoryStartResult.success`，反映目标 StoryEntry 是否已经正式建立当前执行实例 / 游标，而不只是请求已接受或 Effect 已派发；不重构完整 Story command result framework。
- [x] 明确 v1 FollowUp 保留当前系统剧情的抢占 / 重放兼容策略，由内部启动适配器使用 `force: true`，但作者语义不暴露该字段。

核验记录：`RuntimeEffectReactor` 当前调用 `storyService.startStory(..., { force: true })` 且忽略返回值。`startStory` 同步完成游标初始化并返回 `success`，但 `force` 允许已完成非 repeatable Entry 重放，也允许打断被动剧情。

验收：文档中明确作者语义与当前强制 Trigger 路径的差异，并给出唯一正式启动入口及其“启动提交成功”判据。

### P0.3 Init 与 once 行为

- [x] 核验 `initEntered → mountInitTriggers → StoryEntryReactionMount.mountForInit` 的顺序。
- [x] 核验离开 Init 时 Reaction 组是否完整卸载。
- [x] 核验回到同一 Init 时，`triggersCompleted` 是否阻止一次性 Reaction 再次执行。
- [x] 核验完成后仍在目标 Area 时不会自动 catch-up。

核验记录：`mountForInit` 会先卸载旧组，再依据当前 Init、`storyLog` 和 `triggersCompleted` 重建可用 Reaction；Init 切换路径调用 `unmountAll`。当前没有单独的 Binding 存档实体，Runtime 恢复依赖重新进入 Init 时重建。

验收：给出 Init 切换、完成后进入目标 Area、离开后再返回、保存 / 读档恢复四组时序测试表。

### P0.4 失败消费行为

- [x] 用源码事实确认启动请求失败时当前 Trigger 仍可能先写入 `triggersCompleted`。
- [x] 裁定 FollowUp 的“兑现”必须以目标 Entry 成功进入游标为准。
- [x] 由正式启动入口返回 `success` 后再通过 `TriggerSystem.commitOnce` 记录 fulfilled，不使用普通 Trigger 的 pre-consume 记账。

核验记录：`TriggerSystem.fire` 在 `effectEngine.applyEffects` 前写入 `triggersCompleted`；当前 `storyEffectRequested` 处理也不读取 `startStory` 返回值。因此普通 Trigger lowering 不能直接满足 post-success fulfilled commit。

验收：已实现为“成功启动才 fulfilled”；失败启动不 fulfilled，后续匹配事件仍可再次尝试。FollowUp 不继承普通 `once` 的 pre-consume 语义。

## P1：作者契约与校验设计

### P1.1 最小语义模型

- [x] 定义 `StoryFollowUp` 的最小字段：`id`、`waitFor.next-enter-area.areaId`、`outcome.start-story-entry.storyEntryId`。
- [x] 不暴露 `activation`、`lifetime`、`consume`、`catchUp` 等第一阶段可推导字段。
- [x] 规定 FollowUp 必须挂靠在一个 StoryEntry 下，不能独立注册为 Trigger。
- [x] 规定第一阶段一次只允许成功启动一个目标 StoryEntry。
- [x] 将 `StoryEntryId` 先作为 TypeScript 语义别名即可，不推进 branded ID 的全工程迁移。
- [x] 由 Registry 真实解析 active / passive StoryEntry，校验目标实体类型，不以 ID 字符串格式代替验证。

建议形状：

```ts
interface StoryFollowUp {
  id: string;
  waitFor: { kind: 'next-enter-area'; areaId: AreaId };
  outcome: { kind: 'start-story-entry'; storyEntryId: StoryEntryId };
}
```

### P1.2 Definition / Builder 接口

- [x] 在不破坏当前 `StoryEntryReaction` 的前提下设计 Builder 表达。
- [x] 明确未来 Builder 直接产出可验证的 FollowUp 定义，当前不删除 Reaction 字段。
- [x] 将当前星野 Reaction 迁移为 FollowUp 数据源，保留行为测试基线；旧 Reaction 不再承担该用例。
- [x] 为错误目标、重复 ID、非法 Area、非法 StoryEntry 目标定义校验错误。
- [x] 明确可重试失败只针对运行时暂时性拒绝；缺失目标、错误实体类型、非法 Area 或无效 Definition 等结构性错误必须在 Definition / Registry validation 阶段拒绝。

验收：作者只需表达“完成后进入指定 Area 启动目标 Entry”，不接触 Trigger 字段。

## v1 核心不变量

- StoryFollowUp 是 StoryEntry 的声明能力，不是 Trigger。
- 来源 Entry 的 completion commit 是 FollowUp eligibility 的唯一权威来源。
- `current-init` 表示运行时监听作用域，不是一次进入 Init 的生命周期。
- 离开 Init 只卸载监听；重新进入时，若 `source completed && !fulfilled`，恢复监听。
- `areaEntered` 只消费第一个未来匹配目标 Area 的事件。
- `start-story-entry` 必须调用正式 StoryEntry 启动路径。
- `fulfilled` 只有在目标 Entry 正式启动成功后才能提交。
- Runtime listener / Binding 始终是可重建派生物，不进入持久化定义或 PlayerState。

### P1.3 lowering 契约

- [x] 定义 FollowUp 使用独立运行时投影，不强行 lowering 到当前 `StoryEntryReaction`。
- [x] 派生 ID 稳定、可诊断，并包含所属 Entry 与 FollowUp ID（`<entry>#follow-up:<id>`）。
- [x] 保留未来可替换内部表示的边界，不把 lowering target 变成公共契约。
- [x] 明确非目标 Area 不消费，当前已在目标 Area 不补算。
- [x] 复用 EventBus / TriggerSystem 的事件与 fulfilled 记录能力，但不继承普通 Trigger 的 pre-consume once 行为。
- [x] 使用 FollowUp 专用的最小 execution / commit adapter，不重写整个 TriggerSystem。

验收：同一输入定义始终产生同一内部绑定；不新增持久化 Runtime Trigger 实体。

## P2：运行时施工

只有 P0 与 P1 通过后执行。

### P2.1 FollowUp reconciliation 与挂载

- [x] 建立唯一的 StoryFollowUp reconciliation 边界，根据已提交 PlayerState 投影当前应存在的监听器；由独立 `StoryFollowUpMount` 承载，不固定为全局函数。
- [x] 将 StoryEntry 完成通知、Init entered 和 Runtime 恢复都接入同一 reconciliation 边界。
- [x] 按 `source completed && current Init valid && !fulfilled` 派生并挂载当前 Init 的 FollowUp 执行节点。
- [x] 复用现有事件总线与 TriggerSystem 的 fulfilled 记录能力，不增加通用事件系统。
- [x] Init 切换时卸载旧作用域节点；重新进入有效 Init 时恢复等待，不留下跨 Init 绑定。

### P2.2 区域事件兑现

- [x] 只响应未来第一个匹配 `areaEntered`。
- [x] 非目标 Area 不消费、不改变等待状态。
- [x] 目标 Area 命中后调用正式启动入口。
- [x] 在正式启动返回成功后写入 fulfilled 记录。
- [x] 启动失败时保持未 fulfilled，后续匹配事件可以再次尝试；不新增存档状态。

### P2.3 星野迁移

- [x] 将星野天台邀约改写为 FollowUp 数据源。
- [x] 保留并更新现有行为测试作为回归基线。
- [x] 确认目标是 StoryEntry ID，不是 StoryDef 正文 ID。
- [x] 确认正在播放被动剧情时的抢占行为符合新的正式启动契约与兼容策略。

## P3：测试与诊断

### P3.1 必测时序

- [x] 未完成来源 Entry，进入目标 Area：不触发。
- [x] 完成来源 Entry，随后进入非目标 Area，再进入目标 Area：只在目标 Area 触发。
- [x] 完成来源 Entry 后已经位于目标 Area：不 catch-up。
- [x] 完成来源 Entry，离开当前 Init，再进入目标 Area：不触发旧 Init FollowUp。
- [x] 完成来源 Entry，离开有效 Init，再返回有效 Init：FollowUp 恢复等待；随后进入目标 Area 时兑现。
- [x] 完成来源 Entry，尚未进入目标 Area，保存 / 读档且当前 Init 仍有效：FollowUp 恢复等待，随后进入目标 Area 时兑现。
- [x] 目标 Entry 启动成功：只兑现一次。
- [x] 目标 Entry 启动失败：不 fulfilled，验证后续匹配事件仍可再次尝试。
- [x] 当前已有被动剧情：验证按当前系统剧情兼容策略允许打断。

### P3.2 只读诊断投影

- [x] 显示所属 StoryEntry、FollowUp ID、等待 Area、目标 StoryEntry。
- [x] 显示 `inactive`、`waiting`、`fulfilled`；启动失败不形成长期 `scope ended` / `expired` 状态。
- [x] 固定诊断优先级：`fulfilled` 优先；否则 `source completed && current Init valid` 为 `waiting`；否则为 `inactive`。
- [x] 将运行时失败区分为可重试的 transient rejection（busy / blocked / channel occupied）与应在 Registry validation 阶段拦截的 structural failure（target missing / wrong entity kind / invalid definition）。
- [x] 可展开查看派生内部 ID，但默认不把 Trigger 当作作者编辑对象。
- [x] 诊断投影只读，不新增玩家状态字段，不提供任意 Trigger 编辑。

## P4：验收与文档收尾

- [x] 运行 FollowUp / StoryEntry / Trigger 相关 Vitest 测试。
- [x] 运行 `npx tsc --noEmit`。
- [x] 如修改引擎类型，运行 `npm run gen:schema` 并完成相关 Schema 生成。
- [x] 运行 `npm run check:architecture`。
- [x] 运行 `npm run check:docs`。
- [x] 更新本 Task 的“当前进展”和“已知限制”。
- [x] 实现稳定后将机制结论沉淀到 `docs/docs-828/`；策划意见未直接写入机制正文。
- [ ] 完成后维护 `00-index.md`，再按 AOCI 流程完成最终认知维护；本轮已尝试 maintain，但被既有仓库认知漂移阻断，未修改 AOCI 资产。

## P2 开工门

只有以下三项全部形成源码事实记录或测试后，P2 才能开始：

1. **completion commit**：确定 FollowUp eligibility 所依据的权威完成事实及其提交顺序。
2. **story-entry start commit**：存在唯一正式入口，并能可靠返回目标 StoryEntry 是否已正式启动。
3. **fulfilled commit**：能够在启动成功后提交 fulfilled，而不是在执行前 pre-consume。

如果现有 `TriggerSystem` 无法满足第 3 项，任务不应被判定为阻塞；应继续复用事件匹配与分桶，并增加最小的 FollowUp execution / commit adapter，而不是为了全部 lowering 成 `TriggerDef` 修改普通 Trigger 的既有语义。

## 完成标准

本 Task 只有同时满足以下条件才可标记完成：

1. 作者侧没有新增独立 Trigger 编辑入口。
2. StoryFollowUp 只支持 `next-enter-area → start-story-entry`。
3. 完成提交、当前 Init、未来匹配 Area、启动成功和 once 记账的时序均有测试覆盖。
4. 目标 Entry 与 StoryDef 的命名空间校验明确且测试通过。
5. 失败启动不会被静默显示为成功兑现；可重试拒绝允许后续匹配事件再次尝试，结构性错误已在 Registry validation 阶段拦截。
6. 未引入 Overlay、跨 Init persistent、自动 catch-up 或独立持久化 Runtime Binding。
7. 文档、类型、测试和 Schema（如受影响）完成同步。

## 暂停条件

遇到以下情况应停止 P2 施工并回到上层模型裁定：

- 无法区分 StoryEntry ID 与 StoryDef ID；
- 正式启动入口必须绕过 Entry 生命周期规则；
- Trigger 的先记账行为无法满足失败不兑现要求；
- Init 切换后的生命周期与“当前 Init 有效时恢复等待，fulfilled 后停止”假设不一致；
- 出现第二个用例要求 Overlay、跨 Init 或新的等待模式。
