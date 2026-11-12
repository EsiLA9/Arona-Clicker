# docs-830/02-data-and-state/authoring-policy-and-builders — 作者策略与定义构建

本文回答：运行时编辑器如何限制可编辑字段，并把作者输入转换成引擎定义。

## ContentAuthoringPolicy

每张 `ContentAuthoringPolicy` 描述一个可编辑内容表的字段白名单、作者输入类型、必填规则、扩展字段、验证器、字段所在编辑区，以及输入到最终 Def 的物化映射。字段类型同时决定校验和编码，例如实体局部名在物化时组合为完整实体 ID，数值表达式字段编码为引擎表达式，引用字段要求完整且类型匹配的实体引用。

字段物化表还登记 Registry、索引、GameNum、Visibility、Affector、SpotService、Init scope 或 UI 等消费者，以及相应失效方式。字段若需要重建 Runtime，策略中会登记触发它的既有 reload 路径。编辑器因此不能仅凭 UI 表单自行推断某个字段写入后需要刷新哪些机制。

## 校验与构建

```text
作者输入 → policy 白名单 / 类型 / 引用校验
         → buildAuthoringDef() 生成带命名空间的 Def
         → RuntimeContentCoordinator 校验并提交
         → 局部 Registry mutation 或保留状态的 Runtime reload
```

`validateAuthoringInput()` 先拒绝未授权字段，再按策略校验字段与扩展；资源、物品、商店和卡池引用可使用当前 Registry 提供的验证上下文。`buildAuthoringDef()` 生成 ID、写入策略默认值、编码已设置字段，并处理扩展字段；可选数值空输入视为缺省，字符串空值则按字段类型规则处理。

内容表可指定局部 mutation；若策略没有安全的局部 mutation，编辑操作通过 Runtime 候选 Datapack 重载来物化。提交收据支持回滚 Registry mutation。并非所有 Datapack 表都可编辑，未登记的表/字段会被策略拒绝。

## 例子：Spot 可选字段

Spot 的 `maxLevel` 是可选整数。作者输入空字符串时，校验把它视为未设置；构建结果省略该键。输入 `5` 时，构建结果包含 `maxLevel: 5`；负数不能通过校验。相反，必填数值字段的空输入仍会报缺少字段。这个区别由字段策略和 `isAbsentAuthoringValue()` 决定，而非表单统一把所有空值写成零。

测试 `tests/data/runtime-content/content-policy.test.ts` 的“int 与可选数值语义”和“未设置的可选字段整键省略”分别覆盖校验与输出。要新增编辑字段，除了允许输入，还应确认物化结果、消费者和失效路径；否则表单看似保存成功，其他系统可能仍使用旧定义。

## 代码中的 Def Builder

`src/arona-clicker/content/def-factory/` 下的 `SpotBuilder`、`InitBuilder`、`CharacterBuilder` 等是代码侧的类型化构造器，供默认内容和测试组装符合合同的定义。它们与 `ContentAuthoringPolicy` 分工不同：前者帮助 TypeScript 内容作者构造 Def；后者描述 Runtime 编辑器允许收集、验证和提交哪些输入。

源码入口：`src/data-services/authoring/content-policy-types.ts`、`content-policies.ts`、`content-policy.ts`、`content-policy-dsl.ts`、`src/arona-clicker/services/runtime/runtime-content-coordinator.ts`、`src/arona-clicker/content/def-factory/`。测试见 `tests/data/runtime-content/content-policy.test.ts`、`content-policy-world-module.test.ts`、`tests/engine/runtime-content/runtime-spot-field-authoring.test.ts`、`tests/engine/def-factory/spot.test.ts`。

继续阅读：[[package-io-and-source-layers]]、[[session-and-tick]]。
