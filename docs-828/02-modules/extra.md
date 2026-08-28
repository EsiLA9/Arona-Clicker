# 02-modules/extra — Extra 三层附加数据树

> 一句话：Extra 是类 NBT 的自由结构数据树，三层合并（全局 → per-Init → 数据包常量），供声明式读写（`setExtra` / `data` source / `extra` 条件）。

## 职责边界

- **管**：Extra 树结构定义、路径访问、三层合并视图、写入校验。
- **不管**：谁读谁写的业务语义（消费方是 ValueSystem / ConditionSystem / mutations）。

## 关键文件（`src/engine/extra/`）

| 文件 | 职责 |
| --- | --- |
| `extra-core.ts` | 类型核心：`ExtraValue`（6 种 `t`：int/float/str/bool/list/dict）、`ExtraCompound`、`ExtraPath` |
| `extra-construct.ts` | 树构造 |
| `extra-merge.ts` | **三层合并视图**（全局 / per-Init / 数据包常量），实现见源文件 |
| `extra-read.ts` | 读取器（`toNumber` 数值语义：缺失 → 0） |
| `extra-path.ts` | `/` 分隔路径解析（`meta/rank`、`inv/0/name`；段不得为空、dict key 禁含 `/`） |
| `extra-validate.ts` | 校验 |

## 核心概念

- **统一读取入口**：`setExtraReader` 把合并视图注入 valueSystem / conditionSystem / mutations——任何 `extra` 条件、`data` ValueSource、`setExtra/addExtra/removeExtra` op 都看同一合并结果。
- 状态落点：`PlayerState.extra`（per-Init 当前）+ 快照层；全局层在 `globalExtra`。
- DSL 枚举见 [[docs-828/03-data-structures/declarative-dsl]] §6。

## 测试入口

`tests/engine/extra.test.ts`、`tools/datapack-editor/validate/extra.test.ts`

## 相关文档

[[docs-828/02-modules/expression]] · [[docs-828/01-architecture/state-layers]]
