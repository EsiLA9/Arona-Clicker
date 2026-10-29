# Trigger：在事件发生时检查并执行规则

> **试写样例 · 机制详解**：说明普通 `TriggerDef` 的组成、匹配和生命周期。与 EventBus、Effect 的整体关系见 [[ai/plan/wiki-trigger-samples/00-event-overview]]；阅读具体定义见 [[ai/plan/wiki-trigger-samples/02-trigger-example]]。

## Trigger 是什么

Trigger 是一条“**某类事件发生时，检查条件，满足后执行效果**”的声明。它本身不是定时器，也不是持续轮询状态的规则：只有匹配的事件到达时，TriggerSystem 才会检查它。即使条件已经满足，如果监听的事件没有发生，这条规则也不会因为条件变化而自动执行。

以“完成欢迎剧情后发放物品”为例：`on` 指定要监听的剧情完成事件；没有额外 `condition`；`effects` 指定发放的物品。

## 一条定义包含什么

| 字段 | 作用 | 使用时注意 |
| --- | --- | --- |
| `id` | 标识规则，并用于一次性完成记录 | 可省略；挂载时匿名定义按分组和结构派生身份。长期需要稳定完成身份时，显式 ID 更便于追踪。 |
| `on` | 指定什么事件触发检查，以及可选过滤字段 | 必填。`on` 决定“何时检查”，不等同于附加条件。 |
| `condition` | 事件到达后再检查的单个或组合条件 | 可省略；省略时不增加这一道条件判断。 |
| `effects` | 命中后执行的效果列表 | 必填；状态写入和产品请求由各自处理方执行。 |
| `once` | 是否记录完成，并阻止同一 ID 的后续触发 | 使用 Builder 时默认写入 `true`；直接挂载原始对象时应显式填写，见下方说明。 |
| `extra` | 内容声明附带的结构化元数据 | 可省略；它不是触发事件或执行效果的替代品。 |

### 注意：`once` 的默认值依入口而异

`TriggerDef` 类型注释将缺省值描述为 `true`；`TriggerBuilder.build()` 也确实默认输出 `once: true`。但当前 `TriggerSystem` 对传入的定义直接检查 `trigger.once` 的真值，并未在 `mount()` / `register()` 中将缺失字段归一化为 `true`。因此，**直接构造并挂载原始对象时，省略 `once` 会按可重复路径处理**；建议明确写 `once: true` 或 `once: false`。若经过其他入口，还需核对该入口是否先做了归一化。

这是本次对类型注释、Builder 和执行器的对照结果，不应将注释中的默认值直接推广到所有入口。

## 事件类型与过滤

下表的过滤字段可省略；省略时不按该字段缩小范围。具体事件载荷以类型定义和发布方为准。

| `on.kind` | 对应事件 | 可选过滤 |
| --- | --- | --- |
| `tick` | `tick` | `every`：仅在帧号能被该值整除时匹配；省略则每个 tick 都匹配。 |
| `resource` | `resourceChanged` | `resource` |
| `spotLevel` | `spotLevelChanged` | `spotId` |
| `item` | `itemCollected` | `itemId` |
| `story` | `storyCompleted` | `storyId` |
| `init` | `initEntered` | `initId` |
| `area` | `areaEntered` | `areaId` |
| `shop` | `shopPurchased` | `shopId`、`entryId` |
| `character` | `characterAcquired` | `variantId` |
| `cultivated` | `characterProgressChanged` | `variantId`、`cultivation`；只匹配等级或星级领域。 |

例如监听 `tick` 的规则不会因为一次 `resourceChanged` 而执行，即使条件正好读取该资源；测试 `P0-1` 覆盖了这一区别。

## 从注册到触发

1. 内容通过 `load()` / `mount()` 或运行时注册接口进入 TriggerSystem；系统按 `on.kind` 对应的事件类型建立索引。
2. 对应事件到达时，系统取得该类型的候选注册，并确认候选在本次派发中仍有效。
3. 系统检查 `on` 中的过滤字段；若一次性 ID 已完成则跳过；再检查可选的 `condition`。
4. 普通 Trigger 命中后，若 `once` 为真则先记录完成，接着执行 `effects`。

事件过滤与条件解决不同问题：过滤确认“是不是我要监听的这次事件”；条件判断“此刻的游戏状态是否允许执行”。

## 生命周期与完成记录

- **挂载 / 撤回**决定规则当前能否接收事件。`unmount()` 撤回一个 ID 的旧式挂载，`unmountGroup()` 可撤回一组。
- **完成记录**决定 `once` 规则是否已经执行。撤回不会清除该记录；重新挂载同一个已完成 ID 也不会重新执行。
- **匿名身份**由分组与结构派生：内容结构改变可能导致身份变化，因此不能把匿名规则的身份当作永远不变。
- **存档与恢复**会保留一次性完成记录；相应测试覆盖记录写入和恢复后的状态。

## 源码与测试

- 声明类型：`src/engine/types/trigger.ts` 的 `TriggerEventDef`、`TriggerDef`。
- Builder：`src/engine/def-factory/trigger.ts` 的 `TriggerBuilder`。
- 匹配、注册、执行：`src/engine/effect/trigger-system.ts` 的 `ON_KIND_TO_EVENT`、`processType()`、`matchesEvent()`、`fire()`。
- 行为测试：`tests/engine/trigger-system.test.ts`、`tests/engine/trigger-kind.test.ts`。

继续阅读：[[ai/plan/wiki-trigger-samples/02-trigger-example]]；现有正式上下文见 [[event-effects-triggers]]。
