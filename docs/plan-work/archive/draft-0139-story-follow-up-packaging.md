# Draft：StoryFollowUp 包装方案——以星野天台邀约为例

状态：draft — 已完成事实核查，交由上层模型继续裁定

## 文档目的

核对 Sol 对“将 Trigger 退回引擎内部、由 StoryEntry 持有受限剧情后续”的意见，并把可行部分收敛为一个更小的候选方案。

本文不修改运行时代码，不把未来设计写成当前事实。

## 一、已核实的当前事实

### 1. 当前已经存在 StoryEntry Reaction 第一阶段实现

当前源码已经有：

- `StoryEntryBase.reactions`；
- `StoryEntryReaction` 契约；
- Builder 的 `.reactions(...)`；
- `StoryEntryReactionMount`；
- Reaction 派生的稳定运行时 ID；
- 复用 `TriggerSystem` 的事件分桶、条件求值和 `once` 记录。

来源：

- `src/data-services/contracts/story-entry.ts`
- `src/arona-clicker/content/def-factory/story-entry.ts`
- `src/arona-clicker/services/story-entry-reaction-mount.ts`

因此，Sol 所说的方向正确，但不应描述为从零开始新增 Reaction 系统。第一阶段只允许把 StoryFollowUp lowering 到当前 Reaction；这不是对 Reaction 的长期架构承诺。更稳定的分层应写成：

```text
StoryFollowUp（作者语义）
  ↓ lowering / compile（第一阶段可落到现有结构）
StoryEntryReaction / 未来等价的内部执行表示
  ↓ mount
Runtime Trigger（或未来等价执行节点）
```

### 2. 星野天台案例已经迁移到 StoryEntry Reaction

当前数据位于 `src/arona-clicker/content/story-conversation-walls.ts`：

```text
base:passivestory:hoshino_conv_2
  └─ reaction: rooftop-meet
       activation: after-completion
       on: area / base:area:schale_rooftop
       effects: triggerStory(base:activestory:hoshino_rooftop_meet)
       once: true
```

测试已经验证：未完成邀约时进入天台不会触发；完成邀约后进入天台会触发相遇剧情；正在播放其他被动剧情时，天台剧情可以抢占启动；派生 ID 会写入 `triggersCompleted`。

更精确地说，当前完成提交点在 `resolveStoryEnd` 中：先结算完成奖励，再由 `StateMutationService.completeStory` 写入 `storyLog`，随后发出 `storyCompleted`；ReactionMount 再响应这个事件。因此未来 FollowUp 的正式语义应绑定“所属 StoryEntry 的完成提交”，不能绑定 Talklet 播放结束、UI 关闭或区域切换。

相关测试：`tests/engine/passive-pool.test.ts`。

### 3. 当前没有独立的 FollowUp Runtime State

Sol 建议的 `inactive / waiting / consumed / expired` 不是当前实际状态模型。当前实现主要使用：

- `storyLog` 判断所属 StoryEntry 是否完成；
- 当前 Init 是否挂载 Reaction；
- `triggersCompleted` 判断一次性 Reaction 是否已经消费。

因此，“waiting”目前是运行时推导概念，不是独立的 PlayerState 字段；“expired”也没有独立实现。诊断上应把“未激活 / 等待中 / 已兑现”与“scope ended”区分开：离开 Init 不是“已消费”，也不应在第一阶段伪造一个持久化 expired 状态。

### 4. `lifetime` 当前只是数据契约，不是完整运行时语义

当前 `StoryEntryReaction` 声明了：

```ts
lifetime?: 'current-init' | 'until-consumed';
```

但 `StoryEntryReactionMount` 派生 Trigger 时没有根据 `lifetime` 分支处理。实际边界是：Reaction 只在当前 Init 挂载组中存在；离开 Init 时整组卸载；`once` 由 TriggerSystem 记录消费；没有跨 Init persistent 行为。

因此，Sol 建议第一阶段固定为当前 Init，是对当前实现的正确收敛；但不能把 `lifetime` 描述成已经完整生效的能力。

### 5. 当前入口目标是可启动的 StoryEntry，但现有 Trigger 路径偏强

星野 Reaction 的效果目标是 `base:activestory:hoshino_rooftop_meet`，目标剧情正文另有 `base:story:hoshino_rooftop_meet`。未来高层包装应表达为 `start-story-entry`，不要把 StoryDef 正文 ID 与可启动入口混为一谈。

底层现有 `triggerStory` 仍是字符串目标，不宜据此断言类型层已经区分了 `StoryEntryId` 与 `StoryId`；这应作为后续 Schema/类型裁定项。其实际路径是 `storyEffectRequested → RuntimeEffectReactor → storyService.startStory(..., { force: true })`：入口仍检查 Init/条件，但 `force` 会允许重放已完成的非 repeatable Entry，并允许打断被动剧情。因此它目前不是理想的“正式请求启动”语义。未来 `start-story-entry` 应表达 `requestStartStoryEntry`，不能把当前 `force: true` 直接提升为作者可见契约；是否保留打断、如何处理已完成目标，应由独立的启动入口语义裁定。

### 6. 当前没有 Overlay 追加实现

外部数据包对已有 StoryEntry 追加 FollowUp 的 Definition Patch / Overlay 当前不存在。它涉及归属、冲突、卸载、激活实例和版本更新，继续留在后续议题是合理的。

### 7. 当前 `once` 的记账早于效果执行

`TriggerSystem` 在执行效果前就把一次性 Trigger 写入 `triggersCompleted`，这是为了避免级联事件重复触发。因此“成功启动目标 Entry 后才算兑现”是 FollowUp 的目标语义，而不是当前底层 Trigger 已经保证的事实：若启动请求失败，现状仍可能先留下消费记录。施工任务必须决定是让正式启动入口返回可判定结果并延后记账，还是接受并显式记录这种失败语义。

## 二、对 Sol 方案的可行性判断

### 可采纳

1. Trigger 应继续作为引擎执行语言，不作为普通剧情作者语言。
2. StoryEntry 完成后的延迟剧情，应归属于 StoryEntry，而不是 Init 或独立全局 Trigger。
3. 领域模型可命名为 `StoryFollowUp`；“剧情后续”作为编辑器文案，“约定 / 待办 / 未完成剧情”由具体内容决定。
4. 第一阶段只处理“完成后等待明确剧情时机，再启动另一 StoryEntry”。
5. 第一阶段只支持 `next-enter-area` 这一种等待模式是可行的。
6. 第一阶段只支持 `start-story-entry` 这一种结果是可行的。
7. 不开放任意条件表达式、任意 Effect、任意事件或通用 `addTrigger`。
8. 不做自动 catch-up；进入 Area 是未来事件边沿，不应伪造历史事件。
9. 不做跨 Init persistent，不做 Overlay append，不做优先级仲裁。

### 需要修正

#### 1. 不应把 StoryFollowUp 说成当前 Canonical

当前 Canonical 仍然是 `StoryEntryReaction`，它包含 `on`、`condition`、`effects` 和 `once`。合理的迁移方向是：

```text
StoryFollowUp（未来作者语义）
  ↓ compile
StoryEntryReaction（当前过渡 / 内部规范）
  ↓ mount
Derived Runtime Trigger
```

在没有完成迁移前，不应删除或改写现有 Reaction 契约。

#### 2. 第一版不必公开 `activation`

当前唯一支持的激活时机就是“所属 StoryEntry 完成后”。第一版可以让 `StoryFollowUp` 类型天然表达这一点，不重复暴露 `activation = after-completion`。

#### 3. 第一版不必公开 `lifetime` 与 `consume`

星野案例的第一版语义可以固定为：当前 Init 有效；未来第一次进入目标 Area 时兑现；兑现后完成；离开 Init 自动失效。这等价于当前 Init 挂载边界 + `once: true`。

#### 4. `catch-up` 不应作为 Boolean

推荐默认语义是：`next-enter-area` 只响应 FollowUp 激活之后的下一次 `areaEntered`。如果未来需要“当前就在目标 Area 时立即兑现”，应新增 `if-current-area` 或 `while-in-area` 等明确模式，而不是用 Boolean 混合两种玩法。

## 三、建议的最小 StoryFollowUp 模型

第一阶段可以只定义：

```ts
interface StoryFollowUp {
  id: string;
  waitFor: {
    kind: 'next-enter-area';
    areaId: AreaId;
  };
  outcome: {
    kind: 'start-story-entry';
    storyEntryId: string;
  };
}
```

示意 Builder：

```ts
passiveStory(
  'base:passivestory:hoshino_conv_2',
  'base:story:hoshino_rooftop_hint',
)
  .owner('Hoshino')
  .inits('base:init:schale_office')
  .repeatable(false)
  .followUp('rooftop-meet', followUp => followUp
    .onNextEnterArea('base:area:schale_rooftop')
    .startStoryEntry('base:activestory:hoshino_rooftop_meet')
  )
  .build();
```

这是候选的未来 DSL，不是当前已实现 API。

## 四、运行时落地方式

第一阶段不需要新的通用事件系统：

```text
所属 StoryEntry 正式完成提交
  ↓
确认 FollowUp 在当前 Init 作用域内有效
  ↓
lowering 为内部 Reaction / Runtime Trigger（第一阶段实现选择）
  ↓
监听未来的 areaEntered
  ↓
第一个匹配目标 Area 的进入事件
  ↓
请求正式启动目标 StoryEntry
  ↓
启动成功后视为兑现，由 once 完成记录消费
```

这里的 `next-enter-area` 不是“下一次任意 `areaEntered`”：非目标 Area 不消费 FollowUp；当前已经位于目标 Area 也不补算为满足；只有 FollowUp 激活之后第一个匹配目标的未来进入事件才满足。

## 五、第一阶段不变量

1. FollowUp 必须属于一个 StoryEntry。
2. FollowUp 只能在所属 Entry 正式完成提交后激活。
3. FollowUp 不可独立注册为作者可见 Trigger。
4. FollowUp 只能等待未来发生的匹配 `areaEntered`。
5. 当前已位于目标 Area 不视为满足。
6. 非目标 Area 事件不会消费 FollowUp。
7. 第一阶段一次只允许成功启动一个目标 StoryEntry。
8. FollowUp 只在当前 Init 作用域内有效。
9. 设计目标是成功启动目标 Entry 后才视为兑现；当前 TriggerSystem 的先记账行为不满足这一点，必须在施工时处理。
10. Registry 不新增持久化 Runtime Trigger / Binding 实体。

未激活的 FollowUp 不进入 TriggerSystem 事件桶；这保持当前事件分桶和局部挂载的性能边界。

## 六、编辑器与诊断建议

普通作者界面展示领域模型：

```text
来源：星野的天台邀约
后续：进入夏莱天台后播放「天台的相遇」
范围：当前世界线
状态：等待中 / 已兑现 / 当前未激活
```

不展示或不允许编辑：TriggerDef、EventBus 事件名、事件桶、内部派生 ID、任意 Condition / Effect DSL。

开发诊断可以提供单独的“FollowUp Runtime”视图，显示来源、等待条件、目标入口和派生绑定；必要时再在折叠项中显示编译后的 Runtime Trigger。

第一阶段不要求把“等待中”新增为 PlayerState 字段，可先由完成记录、当前 Init 和 `triggersCompleted` 推导；只有出现跨 Init、暂停、过期或多阶段兑现需求时，再另立状态模型任务。

## 七、明确暂缓范围

- 通用 `addTrigger` Effect；
- 任意条件表达式；
- 任意 Effect 列表作为 FollowUp outcome；
- `enter-spot`、`leave-area`、`story-entry-completed` 等更多等待模式；
- `if-current-area` / 自动 catch-up；
- 跨 Init persistent；
- FollowUp 独立存档状态机；
- Definition Patch / Overlay 的 collection append；
- FollowUp priority 与跨行为通道仲裁；
- 普通用户直接编辑 Trigger。

`requestStartStoryEntry` 与当前 `triggerStory + force:true` 的差异，必须在施工前单独裁定；第一阶段不得默认为“强制播放”。

## 八、下一阶段只核验的实现事实

1. 所属 StoryEntry 的完成提交点，以及 `storyLog` / `storyCompleted` 对 Entry ID 与 StoryDef ID 的映射。
2. `start-story-entry` 应调用的正式入口，以及是否允许打断、重复完成 Entry。
3. Init 切换时 Reaction 的 mount/unmount 顺序，以及 `once` 记录在切换前后是否按预期保留。

## 九、交给上层模型的问题

1. 是否正式采用 `StoryFollowUp` 作为未来作者语义，而把 `StoryEntryReaction` 明确视为当前 lowering target，而非长期作者/架构层？
2. 是否将第一阶段能力严格收敛为 `next-enter-area → start-story-entry`？
3. 是否接受当前 Init + once 的隐含生命周期，不在第一版暴露 `lifetime` / `consume`？
4. `storyEntryId` 是否应进一步建立独立类型，区分 StoryEntry 与 StoryDef 的 ID？
5. 是否需要先补 FollowUp Runtime 的只读诊断投影，再考虑玩家可见的“待兑现剧情”列表？
6. 第二个真实用例出现前，是否明确禁止 Overlay 追加与跨 Init 持久化？

## 十、结论

Sol 的核心方向可行，但应从“新增一套完整 StoryFollowUp 运行时系统”收窄为：

> 将受限的 `StoryFollowUp` 作者语义 lowering 到当前已经存在的 `StoryEntryReaction`（未来可替换为其他内部执行表示）；第一阶段只描述“所属 Entry 正式完成提交后，未来第一个进入指定 Area 的匹配事件中，请求启动另一 StoryEntry”，内部继续复用现有 Reaction Mount、TriggerSystem、once 完成记录和 Init 生命周期。

星野天台邀约适合作为唯一第一阶段样例，但它也暴露出一个必须修正的事实：当前底层 Trigger 效果会以 `force: true` 调用启动服务。施工任务应先把作者语义与这一实现细节分开，不能把“可打断/可重放”默认为 FollowUp 的规则。

星野天台邀约适合作为唯一第一阶段样例。等第二个、第三个真实剧情后续用例出现后，再从需求中归纳新的等待模式，而不是预先开放通用 Trigger 能力。
