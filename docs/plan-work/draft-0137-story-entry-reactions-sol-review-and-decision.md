# Draft：StoryEntry Reaction 方案参考与裁定

状态：active — 🟡 第一阶段已实现，priority / catch-up / 跨 Init 持久化 / Definition Patch 仍暂缓

## 文档目的

本文总结 Sol 对 StoryEntry、Trigger、Area / Spot 行为优先级的建议，并结合当前源码给出采纳、修正与暂缓结论。第一阶段实现状态以源码与测试为准；未实现部分仍是设计参考。

## 当前背景

当前系统分为三层：

- `StoryDef`：剧情正文与 Talklet；
- `StoryEntryDef`：主动 / 被动剧情入口与投放规则；
- `TriggerDef`：事件监听、条件与效果。

`base:trigger:hoshino_rooftop_story` 目前声明在 `base:init:schale_office.triggers`，但语义实际上是：完成星野的天台邀约，等待进入夏莱天台，再触发天台相遇剧情。因此规则运行主体是 Init，内容语义主体却是 PassiveStoryEntry。

当前相关代码：

- `src/data-services/contracts/story-entry.ts`
- `src/engine/types/trigger.ts`
- `src/engine/effect/trigger-system.ts`
- `src/arona-clicker/services/init-mount.ts`
- `src/arona-clicker/content/inits.ts`
- `src/arona-clicker/content/story-conversation-walls.ts`

## Sol 方案摘要

### StoryEntry Reaction

不要把问题定义成“StoryEntry 是否内嵌 Trigger”，而应定义成：

```text
StoryEntry 是否能声明属于自己的事件反应规则
```

推荐分层：

```text
StoryDef
  剧情正文
StoryEntryDef
  剧情投放与入口生命周期行为
TriggerDef
  没有天然 StoryEntry 所属关系的独立世界规则
DerivedReaction / MountedTrigger
  引擎派生与运行时挂载结构
```

建议将字段命名为 `reactions` 或 `eventReactions`，而不是 `triggerEffects`，因为它表达的是“事件 + 条件 → 效果”。

### 放在 `StoryEntryBase`

Active / Passive 表示入口方式；完成后产生的延迟行为是正交能力，因此建议共享：

```ts
interface StoryEntryReaction {
  id: string;
  activation?: ReactionActivation;
  on: TriggerEventDef;
  condition?: Condition | ConditionGroup;
  effects: Effect[];
  once?: boolean;
  lifetime?: ReactionLifetime;
  catchUp?: ReactionCatchUpPolicy;
  priority?: number;
}
```

### 生命周期显式化

Reaction 应区分：

- `activation`：何时开始监听；
- `lifetime`：规则持续到什么时候；
- `catchUp`：挂载时是否检查当前状态。

候选 activation：`while-entry-available`、`on-entry-start`、`after-completion`。

候选 lifetime：`current-init`、`until-consumed`、`persistent`。

默认不伪造历史 `areaEntered`：事件是边沿，`currentAreaId` 是状态，两者不能隐式合并。

### 稳定身份

不能用 `reactions[0]` 作为永久身份。作者应提供局部 ID，例如：

```text
reactions.rooftop-meet
```

运行时身份可派生为：

```text
base:passivestory:hoshino_conv_2#reaction/rooftop-meet
```

该身份用于 once、读档重建、Codex 路径和局部刷新。

### 独立 TriggerDef 与 addTrigger

继续保留独立 `TriggerDef`：

- StoryEntry Reaction：自然语言是“这个 StoryEntry 发生之后……”；
- TriggerDef：自然语言是“世界中存在这样一条规则……”。

不建议提供通用 `addTrigger` Effect，因为它会破坏静态来源、存档恢复、数据包卸载、Runtime Editor 展示和超级图鉴反查。未来如需动态控制，应优先操作已经声明的 Reaction；`triggerStory` 仍可作为普通 Effect，因为它只执行既有剧情。

### 多数据包追加

外部包不应整体替换基础 StoryEntry，而应通过未来的 Definition Patch / Overlay 追加 Reaction collection：

```text
target: base:passivestory:hoshino_conv_2
reactions.append: addon-rooftop-notice
```

同一 Reaction ID 不应静默 last-write-wins；应使用显式 replace 或冲突诊断。DSL 与 JSON 必须归一到同一个 Canonical Definition。

### Area / Spot 优先级

不建议定义“Area priority = 100”。真正有优先级的是具体候选行为和行为通道：

```text
storyTrigger
passiveStorySelection
spotInteraction
areaArrival
```

不同通道不共享优先级数值空间，且 `priority` 不等于 `weight`。可以有薄的 `BehaviorArbiter`，但不要先做吞并所有行为的万能 Manager。

## 与当前源码的差异

Sol 示例中的 `on: { kind: 'areaEntered' }` 不符合当前数据 DSL。当前声明使用：

```ts
on: { kind: 'area', areaId: '...' }
```

再由 `ON_KIND_TO_EVENT` 映射到内部 `areaEntered`。后续设计必须遵循声明层 DSL，不把 EventBus 内部名称泄漏到 JSON / DSL。

当前尚不存在：

- `reactions` / `eventReactions` 字段；
- activation / lifetime / catch-up 契约；
- Reaction 派生与 armed 生命周期服务；
- StoryEntry collection 的跨包增量 Patch；
- 通道级行为仲裁器。

## 判断与采纳结论

### 采纳

1. StoryDef 不持有外部事件监听规则。
2. StoryEntry 可以声明自己的延迟事件反应。
3. Reaction 放在 `StoryEntryBase`，Active / Passive 共享。
4. 每条 Reaction 使用稳定局部 ID。
5. 引擎派生内部 Binding / RuntimeTrigger；Binding 不进入 JSON、存档或 Registry 实体表。
6. Activation、Lifetime、Catch-up 与 Condition 分开表达。
7. 默认不将当前状态伪装成历史事件，不自动补发 `areaEntered`。
8. once 使用 Entry + Reaction 稳定身份，MountedTrigger 只作为运行时缓存。
9. 保留独立 TriggerDef，区分 Entry 所属 Reaction 与独立世界规则。
10. 暂不增加通用 `addTrigger` Effect。
11. 优先级按行为通道处理，不把 Area / Spot 本体当作统一优先级对象。

### 修正后采纳

建议最终字段名采用 `reactions`。第一阶段每条 Reaction 只要求：

```text
id / activation / on / condition? / effects / once? / lifetime?
```

`priority`、`catchUp` 暂不实现为第一阶段功能，避免实际竞争案例出现前建立过大的调度系统。

### 暂缓

- `armReaction` / `disarmReaction` / `consumeReaction` Effect；
- persistent 跨 Init Reaction 的完整生命周期；
- 通用 BehaviorPriorityService；
- 动态优先级 Modifier；
- 完整 Definition Patch / Overlay 的 StoryEntry 增量写入；
- 自动 catch-up 状态复检。

## 推荐最终关系

```text
StoryDef
  └─ 剧情正文
StoryEntryDef
  ├─ storyId → StoryDef
  ├─ completionReward → 完成立即效果
  └─ reactions[] → Entry 所属延迟事件反应
独立 TriggerDef
  └─ 无天然 Entry 所属的世界规则
StoryEntryReaction / TriggerDef
  ↓ 编译
RuntimeTrigger
  ↓ 挂载
TriggerSystem 事件桶
```

天台案例：

```text
base:passivestory:hoshino_conv_2
  └─ reactions.rooftop-meet
       activation: after-completion
       on: area / base:area:schale_rooftop
       lifetime: until-consumed
       once: true
       effect: triggerStory(base:activestory:hoshino_rooftop_meet)
```

## 性能与 DOM 约束

- 未激活 Reaction 不进入 TriggerSystem 事件桶；
- 已派生 Reaction 按事件类型分桶，不扫描全部规则；
- Reaction 索引按来源 Entry 和稳定局部 ID 构建，不扫描 Talklet；
- Codex 默认按来源 Entry 聚合，不平铺所有路径；
- 修改一条 Reaction 时，只重算该 Entry 的派生 Reaction、受影响关系索引和对应挂载组；
- 不重建整个 Runtime Editor、Codex Shell、顶部标题或无关页签；
- 反向引用超出预算时只显示来源聚合和数量，细节局部展开。

## 推荐实施顺序

### P0：字段与生命周期裁定

- 确定 `StoryEntryBase.reactions`；
- 确定 activation / lifetime 第一阶段枚举；
- 确定完成状态与 Reaction 派生状态的读取方式；
- 明确当前 Init 生命周期与 `until-consumed` 的边界。

### P1：规范化与派生

- 增加 JSON / DSL Canonical Reaction 结构；
- 生成稳定 Reaction 身份；
- 增加 Reaction 编译器和来源路径；
- 复用现有 TriggerSystem 事件桶和 once 机制。

### P2：天台案例迁移

- 从 `base:init:schale_office.triggers` 移出天台后续规则；
- 将规则迁移到 `base:passivestory:hoshino_conv_2.reactions`；
- 默认不自动 catch-up 已发生的 `areaEntered`；
- 验证完成邀约后下一次进入天台触发、未完成时不触发、once 和读档重建。

### P3：超级图鉴与跨包追加

- 展示 Entry → Reaction → 条件 / 效果目标；
- 支持稳定路径和来源包；
- 再设计 Definition Patch 的 collection append / replace / conflict；
- 暂不开放任意 `addTrigger` 和动态优先级编辑。

## 当前判断

Sol 的核心方向值得采纳，并且比“独立 Binding 数据表”更符合多数据包与 JSON / DSL 目标：

## 第一阶段实现核验

已落地：

- `StoryEntryBase.reactions` 与 Builder `.reactions(...)`，保留统一 JSON / DSL 数据形态。
- `StoryEntryReactionMount`：完成后才按当前 Init 派生 Runtime Trigger，稳定 ID 为 `EntryId#reaction:ReactionId`。
- 反应复用 `TriggerSystem` 的事件分桶、条件求值和 once 完成记录；未激活反应不会进入事件桶。
- Init 切换、重置和世界定义重挂载时卸载反应组；不扫描 Talklet，不建立持久 Binding 表。
- 天台案例已从 `Init.triggers` 迁移到 `base:passivestory:hoshino_conv_2.reactions`。
- 已补 Builder 与天台完整流程回归测试。

当前边界：

- `lifetime` 当前只表达数据契约，第一阶段统一受当前 Init 挂载边界约束；真正跨 Init `persistent` 暂不支持。
- 不做已发生事件的 catch-up；完成邀约后必须等待下一次进入目标 Area。
- 不做 Reaction priority、动态启停、Definition Patch / Overlay 的 collection append。

```text
作者数据：StoryEntry.reactions
引擎派生：DerivedReaction / RuntimeTrigger
运行时：TriggerSystem 事件桶
```

但不应一次性实现所有扩展。第一阶段只落地 StoryEntry Reaction 的静态声明、稳定身份、完成后激活、作用域挂载和天台案例迁移；优先级仲裁、动态 Modifier、持久跨 Init、自动 catch-up 和 Definition Patch 另行裁定。

## 当前核验（2026-09-21）

- 已读取并整理 Sol 的方案意见；
- 已对照当前 `StoryEntryDef`、`TriggerDef`、`TriggerSystem` 和天台数据；
- 已确认当前事件 DSL 使用 `kind: 'area'`，由引擎映射到 `areaEntered`；
- 尚未修改运行时代码；
- 尚未执行 Reaction 方案实现测试。

## 相关路由

- [[draft-0136-story-trigger-catalog-and-scoped-mounting]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/03-data-structures/declarative-dsl]]
- [[docs/docs-828/05-conventions/schema-sync]]
