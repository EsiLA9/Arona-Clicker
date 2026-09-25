# Runtime Editor 语义摘要可读化投影

状态：active — 2026-09-20 开始执行

## 当前进展

- 已将语义类型从内部英文标识转换为中文标签：条件、效果、数值、支付、揭示。
- 已将 Reveal 目标转换为“揭示名称 / 揭示用途 / 解锁 / 可购买”等可读文本。
- 已让语义摘要使用 Runtime Editor 的名称解析与数字格式化能力，资源 / 实体不再优先显示裸 ID。
- 已将字段路径降为辅助信息，主行优先显示可读结果。
- 已补充紧凑的语义摘要布局与换行规则，详情刷新边界未改变。
- TypeScript、Inspector、Codex Shell 与 Codex 集成测试通过。

## 目标

检查超级图鉴当前可能生成的语义摘要，把“字段路径 + 类型 + 原始紧凑文本”转换为可直接阅读的结果，同时保留 Agent 可定位的路径信息。

本 Task 只处理只读展示，不改变 Datapack、Registry、Runtime Query 或游戏机制。

## 当前实现审计

当前 [`semantic.ts`](../../src/ui/runtime-editor/codex-details/semantic.ts) 递归扫描原始 Def，识别以下 5 类节点：

| 类型 | 当前来源 | 当前摘要内容 | 可读化方向 |
| --- | --- | --- | --- |
| `condition` | 原子条件 / AND / OR 条件组 | `资源 ≥ 数值`、条件之间“且 / 或” | 标记为“条件”，使用可读目标名和中文比较符 |
| `effect` | `Effect` | `获得资源 +N`、`解锁世界线`、`触发剧情` | 按操作分组，使用行为动词和目标名 |
| `value` | `ValueExpression` | `等级×倍率`、`min(...)`、`clamp(...)` | 将表达式转换为短句或保留结构化表达式 |
| `payment` | `costs + condition` | `资源 × 数量；条件：...` | 分离支付资产、数量和附加条件 |
| `reveal` | `reveal + condition` | `name；条件：...` | 将目标转换为“揭示名称 / 解锁 / 可购买”等中文语义 |

当前识别器还有以下重要行为：

- 命中一个语义节点后停止继续扫描其子节点；因此支付项或 Reveal 内部的条件不会再次产生独立重复摘要。
- 摘要最多收集 64 项。
- 名称解析依赖 `nameOf`；解析失败时会退回 ID。
- Effect 文案复用 [`affector-text.ts`](../../src/engine/effect/affector-text.ts) 的统一描述器。
- 条件文案复用 [`condition-presentation.ts`](../../src/ui/condition-presentation.ts)。
- 未识别节点不会丢失，仍可在原始数据页签查看。

## 可能出现的语义内容

### 条件

可能出现在：

- `revealTriggers[].condition`
- `purchaseOptions[].condition`
- `levelUpgrades[].paymentOptions[].condition`
- Affector / Funclet entry 的条件
- Story、Shop、Item、Enhancement 的可用性条件

应转换为：

```text
条件：青辉石 ≥ 1
条件：已完成「观测站启动」
条件：满足以下全部条件：……
```

### 效果

可能出现在：

- Story reward
- Trigger effects
- Affector entries
- Enhancement effects
- Item use / pickup effects
- Shop purchase effects

应转换为：

```text
获得信用点 +3
解锁世界线「扩展测试观测线」
提升「跨包数据扫描仪」等级 +1
触发剧情「观测站启动」
设置标记「xxx」
```

### 数值表达式

可能出现在：

- 生产数量
- 升级支付数量
- Affector Flow
- Effect value
- 统计 / 资源 / Spot 等动态值

应避免只显示 DSL 名称，优先转换为：

```text
扫描仪等级 × 1
当前值限制在 0 到 100
全局累计产出「信用点」
```

无法自然翻译的复杂表达式保留紧凑表达式，并附带字段路径，不编造机制含义。

### 支付方案

当前支付摘要容易把资产、数量和条件压成一行。建议转换为结构化短行：

```text
支付方案：升级 Lv.2
资源：信用点 × 1
条件：扫描仪等级 ≥ 1
```

多个成本项使用同一支付摘要内的短列表，不拆成大量独立语义摘要。

### Reveal

`reveal` 当前直接输出枚举值，例如 `name`、`utility`。应建立统一标签：

| 原值 | 显示 |
| --- | --- |
| `existence` | 出现 |
| `name` | 名称 |
| `condition` | 条件 |
| `utility` | 用途 |
| `unlock` | 解锁 |
| `purchaseable` | 可购买 |
| `owned` | 已拥有 |

结果示例：

```text
揭示名称；条件：青辉石 ≥ 1
揭示用途；条件：已完成「观测站启动」
解锁；无条件
```

## 可读化投影方案

### 1. 摘要项由“原始行”改为“语义卡片行”

每项保留三个层次：

```text
行为标签       可读结果
条件           青辉石 ≥ 1
字段路径       $.revealTriggers[0].condition
```

路径默认使用弱化的小字显示，避免把机器路径和人类文本混在同一行。

### 2. 同一路径只保留一个主摘要

禁止因条件、支付项、Reveal 或 Effect 的嵌套扫描产生重复行。复杂节点由自身摘要涵盖子结构；只有无法被父节点解释的独立语义节点才单独输出。

### 3. 使用统一文本转换器

新增或扩展纯函数转换器，不在 HTML 渲染器中拼接业务语义：

```ts
describeSemanticSummary(value, options)
describeRevealTarget(target)
describePaymentOption(option, options)
describeCondition(condition, options)
describeEffect(effect, options)
```

现有 `describeEffect`、`describeValueExpression`、条件描述器应继续作为底层能力，避免出现两套文案规则。

### 4. 信息不足时保守降级

- 名称解析失败：显示完整 ID。
- Effect 操作未知：显示操作名和目标，不猜测行为。
- 条件结构不完整：显示“条件结构不完整”，保留路径。
- 数值表达式过长：折叠或截断可读文本，原始数据页签保留完整结构。
- 超过摘要上限：显示“还有 N 项未展开”，不把所有内容一次塞入详情。

## UI 密度与刷新边界

- 语义摘要只刷新当前详情主体，不重建 Mod 列或条目列表。
- 同一 Def 的概览、关系、原始数据页签复用同一份只读语义快照。
- 摘要项使用紧凑行或轻量折叠，不增加大型卡片、关系图或统计面板。
- 不加入描述型长段落；每项以行为标签、可读结果、路径为主。
- 路径、状态和原始值必须可供 Agent 检查，但默认不抢占主要阅读空间。

## 验收样本

至少覆盖：

- `addition-test:init:observatory`：Reveal、资源条件、默认 Area、起始剧情。
- `addition-test:spot:scanner`：支付、升级、Flow、资源产出。
- 一个包含多个 Effect 的 Story / Trigger。
- 一个包含 AND / OR 嵌套条件的 Def。
- 一个包含动态 ValueExpression 的 Affector / Spot。
- 一个未知或不完整结构，验证保守降级。

## 验收标准

- 语义摘要不再主要显示 `name`、`payment`、`reveal` 等内部类型词。
- `reveal`、`condition`、`effect`、`payment`、`value` 都能得到短而可读的中文结果。
- 同一复杂节点不会因递归扫描产生重复摘要。
- 所有摘要仍能通过路径回到原始字段。
- 不识别或无法翻译的内容不会被误解释。
- 统一使用现有名称解析、条件描述和 Effect 描述逻辑。
- 详情交互只刷新详情区域，符合既有 DOM 刷新边界。
- 不增加运行时每帧工作、不引入统计服务、不新增巨大前端元素。
