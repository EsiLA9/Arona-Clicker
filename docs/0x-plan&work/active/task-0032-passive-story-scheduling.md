# 任务 0032：PassiveStory 启动一致性、生命周期与 Pool 分层权重

状态：🟡 已裁定，待施工

关联方案：[[docs/0x-plan&work/docs/newPlan/08-passive-story-sol-review]]

本文回答：在暂不引入 StoryChain、DeliveryIntent 和正式 StoryRunId 的前提下，如何完成 PassiveStory 的 P0/P1 修正，并把 Pool 抽取改为真正的分层权重模型。

## 目标

完成以下三组工作：

1. 执行 PassiveStory 评审中的 P0：统一启动资格管线、修正 cooldown/Pool ancestry、明确 ready 启动语义并增加结构化诊断；
2. 执行 P1：增加轻量业务身份 `completionKey`、修正被动状态的 per-Init 生命周期、保证完成结算幂等；
3. 将 Pool 抽取从“所有叶子展平后按路径权重连乘”改为“每层在当前可用子节点中分层抽取”，避免某个 tag/主题因为包含大量简单内容而累计获得异常高的总概率。

本任务不要求引入完整 StoryChain；`StoryDef`、`PassiveStoryEntry`、`PassivePool` 和现有 Story cursor 继续作为主要运行时模型。

## 已裁定的设计边界

### 本次包含

- 所有正常 Story 启动路径统一经过 `requestStoryStart` 语义的资格与占用管线；
- `EligibilityResult` 结构化返回拒绝原因和可选的有效权重；
- Entry、Pool、Pool child 分支的 cooldown 检查与完成记账；
- 抽取结果携带真实 Pool ancestry；
- Pool 分层权重与 gate/owner/cooldown 后的同层重新归一化；
- `completionKey` 作为 `StoryDef.id` 之外的轻量业务进度身份；
- `passiveCooldowns`、`studentBlocks` 归入 per-Init 快照；
- 完成记录、奖励和被动收尾逻辑的幂等保护；
- P0/P1 以及本文件的 Pool 分层权重测试。

### 本次不包含

- `StoryChainDef`、`StoryChainNode` 或 `Entry → Chain → Node → StoryDef` 引用图；
- `DeliveryIntent` 持久化队列；
- 独立的持久化 `StoryRunId`；
- `delivered` 作为新的持久化状态或 cooldown 默认消费阶段；
- 任何旧存档迁移或兼容层；
- 将所有 cooldown scope 扩展为 `student`、`chain`、`custom` 等通用锁系统；
- 其他原 P2 调度模型重构。

## 当前事实与代码落点

| 领域 | 当前代码 | 施工关注 |
| --- | --- | --- |
| Story Entry 契约 | `src/data-services/contracts/story-entry.ts` | 增加可选 `completionKey`，保持现有 Entry/StoryDef 关系 |
| Pool 契约 | `src/data-services/contracts/passive-pool.ts` | 增加明确的 selection policy；使 child cooldown 有可执行语义 |
| Pool 抽取 | `src/arona-clicker/services/passive-pool-system.ts` | 从叶子展平改为分层抽取，返回 ancestry |
| Story 启动 | `src/arona-clicker/services/story-flow.ts`、`story-service.ts` | 统一 request、资格、占用和 unchecked/restore 边界 |
| 完成与冷却 | `src/arona-clicker/services/story-jump.ts`、`story-rewards.ts` | 以同一 canonical key 检查和写入；按真实 ancestry 记账 |
| 状态写入 | `src/arona-clicker/state/state-mutation-service.ts` | 所有 cooldown、block、完成和奖励状态继续走单一写入口 |
| per-Init 分层 | `src/arona-clicker/types/state.ts`、`state/per-init-fields.ts`、`state/init-savepoint.ts` | 将被动剧情状态纳入 InitSnapshot |
| Story cursor 存档 | `src/arona-clicker/services/story-cursor-state.ts`、`src/engine/contracts/story-cursor.ts`、`runtime-save*` | 如 ancestry 需要跨中断/存档保留，只增加最小字段，不建立 StoryRun 实体 |
| 现有测试 | `tests/engine/passive-pool.test.ts` 及 Story 相关测试 | 覆盖分层概率、gate、owner、cooldown、恢复和幂等 |

当前已知事实：`PassivePoolSystem.pick()` 会把 `PoolChild.weight` 沿路径相乘，再乘 `PassiveStoryEntry.weight` 后展平；`PassivePoolChild.cooldownFrames` 当前声明存在但没有完整消费路径；`recordPassiveCooldown()` 对 entry cooldown 的早退会使 pool-only cooldown 无法记录。`passiveCooldowns` 和 `studentBlocks` 当前位于 `PlayerState` 顶层，而 `storyLog` 已属于 InitSnapshot。

## 目标模型

### 1. 启动管线

正式业务入口统一为以下语义：

~~~~text
StartRequest
  → resolve Entry / StoryDef
  → EligibilityEvaluator
  → Reservation / claim
  → beginStory / cursor
  → StoryService 演出
~~~~

`EligibilityEvaluator` 必须是只读评估；Reservation、完成、奖励、cooldown 和 block 变更必须通过 `StateMutationService`。

启动来源至少区分：

- `active`：普通主动剧情；
- `passive-random`：Pool 随机闲聊；
- `ready`：好感台阶或尾巴就绪项；
- `trigger`：事件触发剧情；
- `replay`：重读；
- `restore` / `debug`：显式低级入口。

普通业务代码不得通过一个含糊的 `force` 或 `skipConditions` 绕过全部资格检查。确实需要绕过时，调用点必须使用语义明确的 unchecked/restore API，并在测试中锁定其范围。

`EligibilityResult` 至少表达：

~~~~ts
{
  eligible: boolean,
  reasons: EligibilityReason[],
  effectiveWeight?: number,
}
~~~~

Reveal、Eligibility、Scheduling、Cooldown、Block/Concurrency 继续是不同维度；`reveal = false` 不自动等于 `eligible = false`。

### 2. Pool 分层权重

正式 Pool 默认使用 `hierarchical` 语义；可以保留显式 `flatWeighted` 作为回归对照或临时兼容策略，但新内容不使用它。

分层抽取规则：

1. 先递归计算每个直接 child 是否存在可到达的 eligible leaf；没有可用后代的子池不参加本层竞争；
2. 在当前 Pool 的可用直接 children 中，按 child weight 抽取一个分支；
3. 选中子池则递归进入子池；选中 Entry 则返回该 Entry；
4. 每一层只在剩余可用兄弟节点中重新归一化；
5. 不再把子树中的 leaf 数量或后代 Entry weight 乘到父级分支概率上；
6. 抽取结果必须带有从 synthetic root/真实 root 到叶子的完整 ancestry。

权重字段语义：

- `PassivePoolChild.weight`：当前 Pool 中该直接分支的权重；
- 子池 child：只使用该分支权重决定进入子池的概率；
- 直接 Entry child：显式填写 child weight 时，以 child weight 为准；未填写时回退到 Entry weight，最终默认 1；
- 未被任何 Pool 引用的 orphan Entry：继续作为 synthetic root 的直接候选，使用 Entry weight；
- 多个 root Pool：由 synthetic root 以默认权重 1 竞争；owner、gate、cooldown 会先剪枝，剩余 root 再归一化。

> 例：

~~~~text
Root
├─ tag-A weight 1 ── 10 条简单闲聊
└─ tag-B weight 1 ── 1 条闲聊
~~~~

只要两侧均有可用内容，`tag-A` 与 `tag-B` 的分支概率应接近 50%/50%；A 内部的 10 条内容再按 A 的子节点权重竞争。A 增加第 11 条内容，不应自动把 A 的总分支概率推高。

分层策略会改变当前扁平算法的内容概率，因此必须：

- 为策略增加明确的数据契约或运行时策略名；
- 更新默认 Datapack 和测试包的预期；
- 不用随机统计测试锁定精确比例，优先使用可注入 RNG 或边界区间测试；
- 补充“gate 关闭后重新归一化”“分支内容数量不影响父级概率”“child weight 覆盖 Entry weight”的确定性测试。

### 3. Cooldown 与 ancestry

本任务先固定三类可执行 key：

~~~~text
entry key       = entryId
pool key        = poolId
child key       = parentPoolId + childId
~~~~

`child key` 使用父 Pool 与 child 目标的组合，避免同一目标被多个 Pool 引用时互相污染。

抽取结果携带的 ancestry 至少包含：

~~~~ts
{
  poolId: string,
  childId: string,
  cooldownFrames?: number,
}
~~~~

完成当前被动剧情时，只对本次实际命中的：

- Entry；
- 每个实际经过的 Pool；
- 每条实际经过且声明 cooldown 的 child 分支；

写入 cooldown。随机抽取本身不提前消费 cooldown；本任务继续沿用当前“剧情正常完成时记录”的结算时机，不提前引入 delivered 消费语义。

检查与写入必须共享同一 canonical key 生成函数。Pool-only cooldown、Child cooldown 和 Entry cooldown 都必须有正向、冷却中、过期后三组测试。

### 4. 业务身份与完成记录

在 `StoryEntryBase` 增加可选：

~~~~ts
completionKey?: string
~~~~

语义：

- 未填写时，保持当前行为，以 Entry 的 `storyId` 作为默认完成身份；
- 填写后，完成检查、首次/重复奖励和 non-repeatable 判断使用 `completionKey`；
- `storyReadLogs` 仍记录实际展示的 StoryDef，不与业务完成身份混为一谈；
- 现有 `pushAfterStory`、`branchGuards` 等引用本任务保持当前 StoryId 形式；判断目标完成状态时，经统一身份解析器转换为目标的 canonical key；
- 不引入 StoryChain 图，不要求一个 StoryDef 只能属于一个 completionKey。

所有 `hasCompletedStory`、完成奖励首次判断、ready 去重和相关测试都必须通过同一个身份解析函数，不再各自直接比较 `StoryDef.id`。

### 5. per-Init 状态

将以下字段从 `PlayerState` 顶层移入 `InitSnapshot`：

- `passiveCooldowns`；
- `studentBlocks`。

同步更新：

- `src/arona-clicker/types/state.ts`；
- `src/arona-clicker/state/per-init-fields.ts`；
- `InitSavepoint` clear/capture/restore；
- 状态工厂、运行时重置、相关 read/write 代码；
- 跨 Init 切换和存档恢复测试。

本任务不新建 Global Story Progress。未来确需跨 Init 的业务身份，再单独增加明确的 global 字段。

### 6. Ready 与生命周期

本任务不把 ready 队列升级为 `DeliveryIntent`。继续使用当前派生 `readyStepIds`，但统一以下语义：

- ready：当前满足推送条件的候选集合；
- claim/start：创建 cursor 后，该候选进入当前运行中状态；
- interrupted：按现有可打断规则清理 cursor，不重复创建第二个运行实例；
- completed：完成记录、奖励、cooldown、block 在同一收尾边界内幂等提交。

如果为了保存 Pool ancestry 需要修改 cursor snapshot，只增加最小的选择上下文字段；不新增独立 StoryRunId，不引入 DeliveryIntent 状态表。

## 施工切片

### P0：启动、资格与 Pool/冷却一致性

1. 盘点并收敛 `startStory`、`triggerPassiveStory`、`triggerAffectionPush`、`triggerTailPush`、Trigger/Effect 启动和卡片入口；
2. 建立统一 StartRequest/EligibilityEvaluator 语义，保留明确的 restore/unchecked 边界；
3. 增加结构化资格失败原因，并让 Pool 调试可显示 effective weight；
4. 将 Pool 抽取改为 hierarchical，返回 Entry + ancestry；
5. 明确并实现 Entry/Pool/Child cooldown key；
6. 修复 pool-only cooldown 早退和 child cooldown 未消费问题；
7. 让完成收尾按实际 ancestry 写入 cooldown，并确保随机抽取不提前消费；
8. 明确 ready 的 claim/interrupted 行为，不引入 DeliveryIntent；
9. 为每个启动来源、资格拒绝、Pool 分层和 cooldown 边界补 Vitest。

### P1：业务身份、Init 生命周期与完成幂等

1. 增加可选 `completionKey`；
2. 统一完成、重复、奖励首次判断、ready 去重使用 canonical completion key；
3. 将 `passiveCooldowns`、`studentBlocks` 纳入 InitSnapshot 和 `PER_INIT_FIELD_SPECS`；
4. 确保完成记录、奖励 ledger/效果、cooldown、block 和完成事件不会因重复完成回调而重复执行；
5. 补充 interrupted、cursor save/restore、跨 Init 切换、同一 Entry 多次引用和 completionKey 重构场景测试；
6. 若新增/修改 Datapack 字段进入编辑器 Schema，按 [[docs/docs-828/05-conventions/schema-sync]] 完成生成与同步检查。

### P2：明确延期

以下内容本次不施工，保留在后续评估清单：

- `delivered` 持久化状态及其默认 cooldown 消费点；
- `DeliveryIntent`；
- 独立 `StoryRunId`；
- `StoryChainDef` / `StoryChainNode`；
- owner/chain/custom 等更多 cooldown scope；
- 事件意图在条件失效后是否仍必须送达的完整模型。

## 验收标准

### 启动与资格

- 所有正式启动来源都通过统一资格与 claim 管线；
- unchecked/restore 入口调用点可搜索、可识别，且不被普通业务入口复用；
- 资格失败可以返回稳定的 reason type；
- reveal 不会隐式改变 eligibility。

### Pool 分层权重

- `Root(A=1, B=1)` 中，A 有 10 条内容、B 有 1 条内容时，A/B 的父级分支概率不因叶子数量变成 10:1；
- 子池内部仍按其直接 children 的权重抽取；
- gate、owner、cooldown 剪枝后只对剩余同层节点重新归一化；
- orphan Entry、多个 root、环引用和空子池都有确定行为；
- 抽取结果带完整 ancestry，不能只返回 entryId 后再猜测归属；
- child weight 显式值优先于 Entry weight，未填写时有明确回退规则。

### Cooldown、完成与状态

- Entry、Pool-only、Child cooldown 均能阻止重复抽取，并在过期后恢复；
- 只记录本次实际命中的 Pool/Child ancestry；
- cooldown 检查和消费使用同一个 key 解析函数；
- completionKey 能让多个投放入口共享完成身份，但不影响 StoryDef 阅读日志；
- 切换 Init 后 cooldown/block 不会污染另一 Init；
- 重复执行完成回调不会重复奖励、完成记录、cooldown、block 或完成事件；
- 恢复进行中的 cursor 不会重新抽权重、重新 enqueue 或重新执行资格消费。

### 工程约束

- 状态写入继续全部经过 `StateMutationService`；
- 机制改动带 Vitest 测试；
- `npm run check:architecture` 通过；
- `npx tsc --noEmit` 通过；
- `npm test` 通过；
- 若涉及 Schema，同步运行 `npm run gen:schema` 并通过 Schema 一致性测试。

## 当前核验（2026-09-07）

- 已核对 `docs/docs-828/00-INDEX`、架构纪律、测试规范和文档维护规范；
- 已核对当前 Pool 契约、抽取实现、Story 启动流程、完成/冷却流程和 per-Init 字段登记；
- 已确认现有实现仍是叶子展平 + 路径权重连乘，Pool child cooldown 尚未完整消费，passive cooldown/block 仍在 PlayerState 顶层；
- 尚未开始代码施工，以下命令待施工完成后执行：`npm test`、`npx tsc --noEmit`、`npm run check:architecture`，以及相关专项 Vitest。

## 剩余工作

1. 先完成 P0 的 StartRequest/Eligibility 与 hierarchical Pool 设计实现；
2. 再完成 P0 cooldown ancestry 修正和 ready claim 语义；
3. 完成 P1 的 completionKey、per-Init 状态和幂等收尾；
4. 执行全量测试与存档/跨 Init 专项测试；
5. 施工完成后，将本文迁入 `completed/` 或更新为已实施记录；
6. 只有后续真实内容出现跨多个 StoryDef/Entry 的链级业务进度时，才重新立项 StoryChain。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/story]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/0x-plan&work/docs/newPlan/08-passive-story-sol-review]]
