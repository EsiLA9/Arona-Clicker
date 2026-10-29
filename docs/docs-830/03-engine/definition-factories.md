# docs-830/03-engine/definition-factories — Engine 定义工厂

本文回答：Engine 的 DefFactory 如何为内容代码和测试构造形状一致的声明式定义。

## 工厂职责

`src/engine/def-factory/` 提供 Condition、Expression、Extra、AffectorPack、Trigger、Reveal 与 Resource 等构造函数。工厂集中定义字段形状、默认值和常用组合，返回普通数据对象，供 Datapack 内容和测试进一步组合。

```text
定义工厂 → typed definition object → Datapack / Registry
                                       → Engine 消费并求值
```

工厂属于声明构造层：它不加载 Registry，不求值条件或 Effect，也不持有运行状态。运行时定义校验由 Registry / 对应验证器负责，运行时行为由 Engine 系统执行。

Engine 工厂与产品内容 Builder 有不同边界：`src/engine/def-factory/` 构造通用 Engine 合同；`src/arona-clicker/content/def-factory/` 构造角色、世界与产品业务定义。

## 例子：构造 Trigger

基础内容通过以下 Builder 声明欢迎剧情完成后的奖励：

```ts
trigger('base:trigger:welcome_reward')
  .onStory('base:story:schale_welcome')
  .effects({ op: 'addItem', target: 'base:item:energy_drink', value: 1 })
  .build()
```

`build()` 返回定义对象，此时并不发放物品。定义随后随内容装载；Trigger 已挂载且收到匹配剧情完成事件时，才交由 Effect 执行。此 Builder 会显式输出 `once: true`；原始 `TriggerDef` 未必经过 Builder，不能把该默认行为推及所有入口。完整运行过程见 [[trigger-welcome-example]]。

## 使用边界

| 需要 | 应由谁负责 |
| --- | --- |
| 组合字段、填充工厂默认值 | 定义工厂 |
| 检查包内定义和引用 | Registry / 相应校验器 |
| 在运行时检查条件和执行效果 | Engine 与宿主服务 |

有些 Builder 会在构造时检查自身必要字段，例如 TriggerBuilder 缺少 `on` 时抛错；这不等于它已经完成跨定义引用校验。构造成功也不意味着规则已挂载或已执行。

源码入口：`src/engine/def-factory/index.ts`、`condition.ts`、`expr.ts`、`affector-pack.ts`、`trigger.ts`、`reveal.ts`、`resource.ts`。相关测试见 `tests/engine/def-factory/`。

定义装载与 Registry 校验见 [[datapack-and-registry]]；条件和数值求值见 [[conditions-and-visibility]]、[[expressions-and-production]]。
