# 示例：完成欢迎剧情后获得物品

> 用项目已有的 Trigger 展示声明、运行过程和验证入口。系统分工见 [[event-effects-triggers]]；字段与生命周期见 [[trigger-mechanism]]。

## 目标与前提

项目的基础内容中有一条规则：完成欢迎剧情后发放一份能量饮料。本例使用已有内容，并假设该 Trigger 已被装载和挂载，剧情完成流程能够正常发出对应事件。

## 已有定义

以下定义来自 `src/arona-clicker/content/triggers.ts`，为便于阅读换行：

```ts
trigger('base:trigger:welcome_reward')
  .onStory('base:story:schale_welcome')
  .effects({ op: 'addItem', target: 'base:item:energy_drink', value: 1 })
  .build()
```

逐段阅读：

| 声明 | 含义 |
| --- | --- |
| `base:trigger:welcome_reward` | 这条 Trigger 的 ID，也是一次性完成记录的身份。 |
| `.onStory(...)` | 只匹配该 ID 的剧情完成事件。 |
| `addItem` | 请求把指定物品增加 1。 |
| `.build()` | 生成 `TriggerDef`；当前 Builder 默认输出 `once: true`。 |

本例没有 `.when(...)`，因此事件与一次性状态检查通过后，不再增加附加条件判断。

## 运行过程

1. 欢迎剧情完成，游戏发布 `storyCompleted` 事件，事件携带剧情 ID。
2. TriggerSystem 从剧情完成事件的候选中找到该规则，并比较 `storyId`。
3. 若 ID 匹配、该 Trigger 尚未记录完成，规则命中。Builder 输出了 `once: true`，所以系统先登记完成。
4. 系统把 `addItem` Effect 交给 EffectEngine，再由状态写入流程增加背包中的能量饮料。
5. 之后即使再次收到匹配事件，同一已完成 Trigger ID 不会再次执行；撤回并重新挂载也不会清除完成记录。

注意区分“剧情曾完成”和“此 Trigger 已完成”：前者是剧情领域事实，后者是规则执行的一次性记录。不要因为其中一个概念而假定另一个总是存在。

## 如果没有获得物品

按顺序缩小问题范围：

1. **事件有没有发生？** 核对剧情是否真正完成，以及发布的 `storyCompleted` 是否使用了 `base:story:schale_welcome`。
2. **规则是否已挂载？** 未挂载的 Trigger 不会接收事件；确认当前应用的内容及挂载生命周期。
3. **是否已完成？** 核对 `triggersCompleted` 中是否已有该 Trigger ID。一次性记录存在时，重新挂载不会重放。
4. **效果是否执行？** 核对 `addItem` 的目标 ID、Effect 执行及物品状态写入；确认观察的是实际背包状态。

这些是排查方向；具体修改前仍需查看当前状态、事件发布点和相关测试。

## 如何验证

`tests/engine/core/trigger-system.test.ts` 的 `registers base trigger defs and fires on story completion` 使用 `finishWelcome()` 完成剧情，并检查背包能量饮料从 0 增加到至少 1。该测试验证了这条真实内容链路，但并不单独证明每一种存档、重复事件或异常场景。

在项目根目录运行定向测试：

```text
npm test -- tests/engine/core/trigger-system.test.ts
```

测试输出按项目规则写入 `.test-artifacts/latest.log`。实际变更时，应在工作结果中单独报告是否运行以及测试结果。

## 继续阅读

- [[trigger-mechanism]]：字段、事件过滤和一次性生命周期。
- [[story-and-effects]]：剧情与效果的领域流程。
- [[state-and-events]]：状态写入与事件。
