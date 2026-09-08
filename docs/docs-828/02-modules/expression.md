# 02-modules/expression — 数值与条件（ValueSystem / ConditionSystem）

> 一句话：`src/engine/expression/` 承担声明式数据包的**求值**——数值表达式、条件、Funclet、统计 DSL（产出树 GameNum 单列 [[docs/docs-828/02-modules/game-num]]）。

## 职责边界

- **管**：`ValueExpression` 递归求值、`Condition/ConditionGroup` 判定、Funclet 调用、`stat:` 统计取值、条件依赖静态收集。
- **不管**：状态写入（经 mutations）、产出结算（经 GameNum）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `value-system.ts` | `ValueSystem`：解析/求值 `ValueExpression`；7 个 `ValueSource` → `SOURCE_EVALUATORS` 注册表、二元/一元算子 → `BINARY_OPS`/`UNARY_OPS` 表（T5）；未知 source 回落 0 |
| `condition-system.ts` | `ConditionSystem`：16 种 `ConditionTarget` → `TARGET_EVALUATORS` 注册表、6 比较符 → `COMPARATORS` 表（T5）；注入读取器（tag 索引 / tag 收集数 / 剧情完成 / 跳转链 / 好感等级） |
| `funclet-executor.ts` | Funclet 执行（复用数值片段的运行时求值）。⚠️ 已知缺陷：`calc` 运行时恒返回 0（`value-system.ts` 强转 bug，独立任务待修） |
| `condition-deps.ts` | 条件依赖收集（静态扫描，供增量失效） |
| `stat-dsl.ts` | 统计 DSL：`parseStatCall('$GlobalProducedAmount base:resource:credit')` → `{ fn, key, initId }`，映射三层统计桶 |

## 核心概念

- **扩展点 = 类型联合 + 1 处注册**（T5 纪律）：新增 `ConditionTarget` / `ValueSource` 只需在类型联合 + 对应 `Record` 注册表加一项，缺注册即编译错误。
- `ValueExpression` 是**数据包声明语言**（含 div/min/max/pow/clamp/floor/ceil/round）；GameNum 运行时结算树不做通用算术，一律经 `expr` 节点下沉到 `ValueExpression`。
- 全枚举目录见 [[docs/docs-828/03-data-structures/declarative-dsl]]。

## 测试入口

`tests/engine/condition-system.test.ts`、`tests/engine/game-num.test.ts` 系列

## 相关文档

[[docs/docs-828/02-modules/game-num]] · [[docs/docs-828/03-data-structures/declarative-dsl]]
