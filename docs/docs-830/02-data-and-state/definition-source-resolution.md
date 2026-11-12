# 定义来源层：覆盖、暂停与恢复

本文说明多个来源包含同一个定义时，如何计算编辑态的有效结果。包读取和 Registry 的整体关系见 [[package-io-and-source-layers]]、[[datapack-and-registry]]。

## 为什么需要来源层

来源层 API 可以表达同一个 Spot 由基础包提供、被其他包覆盖，并在编辑草稿中暂时隐藏的情况。只保存一个最终值会丢失“来自哪里”和“取消修改后应该显示什么”；来源层保留各层记录，再通过解析得到结果。以下三层是 API 和测试示例，不表示当前 Runtime 的包加载已经通过这一三层调用实现。

```text
draft（工作区编辑） → pack（内容包） → base（基础内容）
                         ↓
              按调用方传入的顺序解析
```

这只是一个假设的顺序示例，不是 `resolveDefinition()` 自动施加的固定优先级。调用方传入什么顺序，就按什么顺序检查。当前游戏内编辑器的 `resolveRuntimeEditorSpot()` 调用只传入草稿层；实际应用范围以调用方为准。

## 一个定义如何定位

`DefinitionKey` 使用 `table` 和 `id` 组成 key。例如 `{ table: 'spots', id: 'spot-a' }` 指向 spots 表中的一条定义，不会与其他表里的同名 ID 混为一条。每个来源层维护记录和 tombstone（暂停标记）；记录带来源、`owned` / `override` 类型和值。

## 解析顺序与结果

`resolveDefinition(layers, key)` 逐层执行以下检查：

1. 当前层存在该 key 的暂停标记时，查找传入层中的第一条同 key 记录；找到则返回 `suspended` 和被遮蔽记录，否则返回 `missing`。
2. 没有暂停标记且当前层存在记录时，立即返回 `resolved` 和该记录。
3. 当前层都没有命中时继续下一层；所有层没有命中则返回 `missing`。

暂停标记优先于同一层记录；被遮蔽记录可以来自暂停标记所在层，并非一定在更低层。返回的状态表达的是解析结果，不代表来源文件已经被删除。

## 例子：暂停并恢复包里的 Spot

假设 `[draft, pack, base]` 中，pack 和 base 都有 `spot-a`：

| 操作 | 解析结果 | 原因 |
| --- | --- | --- |
| 无 draft 记录或标记 | `resolved`，值来自 pack | pack 是第一个含记录的层。 |
| 在 draft 暂停 | `suspended`，被遮蔽记录来自 pack | 暂停标记截住解析，但未删除 pack 的记录。 |
| 在同一 draft 恢复 | `resolved`，值再次来自 pack | 移除该草稿拥有的标记后继续解析。 |
| 仅有 draft 标记、没有任何记录 | `missing` | 没有可被遮蔽的定义。 |

上述行为由 `tests/data/runtime-content/definition-resolution.test.ts` 的 suspend / resume 测试覆盖。

## 删除、移除覆盖与暂停的区别

| 操作 | 修改什么 | 之后可能发生什么 |
| --- | --- | --- |
| `deleteLocalDefinition()` | 删除该层同 key 的 `owned` 记录 | 解析可继续回退到其他层；不会删除 `override`。 |
| `removeOverride()` | 删除该层同 key 的 `override` 记录 | 解析可回退到其他层；不会删除 `owned`。 |
| `suspendDefinition()` | 给 draft 增加暂停标记 | 若有记录则返回 `suspended`，记录本身保留。 |
| `resumeDefinition()` | 移除该 draft 拥有的暂停标记 | 可重新解析被遮蔽记录；不能移除其他 owner 的标记。 |

这些函数返回新的层对象；真正何时提交编辑、刷新 Registry 和影响运行时，由内容协调流程负责。解析变化可由 `createDefinitionDelta()` 比较前后结果，为消费者提供 added、changed、removed 和状态变化。

## 源码与测试

- 结构：`src/data-services/definition/definition-types.ts`。
- 操作与解析：`src/data-services/definition/definition-resolution.ts`。
- 可复现例子和状态变化：`tests/data/runtime-content/definition-resolution.test.ts`。
- 编辑提交与 Runtime 关系：[[runtime-content-coordination]]。
