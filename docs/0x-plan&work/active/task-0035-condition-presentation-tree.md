# Task 0035：Condition Presentation Tree 条件展示树

状态：🟡 方案核验完成，待施工

本文回答：如何在不改变 Condition 求值和 Reveal 语义的前提下，把当前条件字符串展示升级为可读、可测试、可扩展的树形 UI。

## 目标

建立 `Condition / ConditionGroup → PresentationTree → renderer` 的 UI 层管线：复杂条件按逻辑层级展示，简单条件保持紧凑，组和叶节点可显示达成状态，并保留纯文本兼容出口。

## 当前事实与代码落点

| 事实         | 当前落点                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 原始条件是树     | `src/engine/types/expression.ts` 的 `ConditionGroup`；当前只有 AND/OR                                     |
| 原子文本描述     | `src/ui/components/tooltip-enhancement.ts` 的 `describeConditionItem()`                              |
| 组文本描述      | 同文件 `describeCondition()`，递归后用 `且/或` 拼接                                                             |
| Reveal 求值  | `src/ui/components/tooltip-reveal.ts` 的 `conditionMet()` / `conditionKnown`                         |
| HTML 详情落点  | `tooltip-reveal.ts`、`tooltip-detail-*.ts`、`enhancements.ts`、`production.ts`、`rail.ts`、`contacts.ts` |
| tooltip 注入 | `src/ui/popovers.ts` 使用 `innerHTML` 写入浮层                                                            |
| 现有测试       | `tests/ui/components/tooltip.test.ts`、`tests/ui/components/contacts.test.ts`                        |

## 执行切片

### 任务 1：定义展示中间结构

#### 背景

当前原子文本和组合逻辑在同一个字符串函数中完成，渲染器无法知道节点层级、组类型或达成状态。

#### 问题

直接在 `describeCondition()` 中加入换行、HTML 或 CSS 类会污染纯文本调用方，并使 Reveal、Affector 文本和 tooltip 互相耦合。

#### 处理方案

新增 UI 层类型，例如 `ConditionViewNode`：leaf 保存安全前的语义文本和可选 met，group 保存 `mode`、children、可选 required/count 信息和 met。`buildConditionView()` 只读取 Condition、name resolver 与 evaluate callback，不修改引擎类型。

#### 最终预期

同一棵条件树可被 HTML renderer、plain-text renderer、未来折叠 renderer 复用；`describeCondition()` 继续作为纯文本兼容函数。

### 任务 2：集中原子条件文案与 comparator 显示

#### 背景

`describeConditionItem()` 已覆盖常见 target，但 comparator 仍输出 ASCII，数字也没有统一 UI 格式；Contacts 还有一套独立的 leaf 描述。

#### 问题

同一条件在不同 UI 中可能出现不同文案；直接替换公共函数又会改变 Affector/日志文本。

#### 处理方案

把原子文案提取为 presentation 层纯函数，支持 `≥/≤/＝/≠` 和 `ctx.formatNumber` 等 UI 格式；保留 `describeConditionItem()` 或新增纯文本选项以维持旧接口。统一 Contacts、tooltip、Reveal 相关调用，保留 engine `affector-text.ts` 的注入式纯文本契约。

#### 最终预期

玩家界面统一显示自然语言和本地化数字；日志、debug、Affector sentence 不被 UI glyph 改写。

### 任务 3：实现 AND/OR 树构造与 normalize

#### 背景

ConditionGroup 的嵌套结构与玩家理解的“全部满足/满足任一”天然对应，但同类嵌套会产生没有语义价值的多层缩进。

#### 问题

机械映射 AST 会把 `AND( A, AND(B,C) )` 展示成三层；机械 flatten 又可能误处理不同类型组或未来阈值组。

#### 处理方案

构造阶段只 flatten 直接同类子组：AND 展平直接 AND，OR 展平直接 OR；AND 内 OR、OR 内 AND 保留边界。空组语义以现有 ConditionSystem 测试为准；未知组和未来 COUNT 不做猜测式 flatten。原始数据树不原地修改。

#### 最终预期

复杂逻辑保留真实分支，冗余同类层级消失；UI 结构变简单但求值结果、条件顺序和数据包内容不变。

### 任务 4：实现 HTML tree renderer 与 CSS

#### 背景

当前条件被放入普通 span 或 small，无法通过 CSS 表达组标题、层级缩进和叶节点状态。

#### 问题

用空格、换行或 `<pre>` 只能模拟层级，窄屏换行、主题继承、文本选择和无障碍表现都会变差。

#### 处理方案

新增 `.condition-tree`、`.condition-group`、`.condition-group-head`、`.condition-group-body`、`.condition-leaf` 等 DOM 结构；body 使用 margin/padding/border-left 表示层级。组标题使用 `role="group"` 或语义 section；renderer 对所有文案调用 escapeHtml。避免每层过强红绿配色，使用 accent/dim 和轻量状态标记。

#### 最终预期

Tooltip、详情卡和阻塞提示能够稳定展示可读层级；主题变化、窄屏换行、文本选择和 HTML 安全边界保持正常。

### 任务 5：接入 met 状态并尊重 Reveal

#### 背景

当前已有 `conditionSystem.evaluateExpr()` 和 `conditionMet()`，但展示只输出整段文本，没有叶/组达成状态。

#### 问题

只显示总结果无法告诉玩家缺哪一项；但对 obfuscated/presence 阶段显示具体叶文本又会违反揭示策略。

#### 处理方案

`buildConditionView()` 接收可选 evaluator：leaf 用原子 `evaluate()`，group 用 `evaluateExpr()`；组 met 表示该组整体结果。renderer 接收 `known` 或 `allowDetail`，未知时隐藏叶文本、只显示 `???` 或保留允许展示的组标题。已拥有或 allKnown 时展示完整状态。未满足使用灰色空心圆/`aria-label`，避免错误警报式红叉。

#### 最终预期

玩家能看到“已满足/待满足”的具体路径，同时不会从未揭示实体的条件树推断隐藏信息；求值仍复用 ConditionSystem，避免出现第二套逻辑。

### 任务 6：保持简单条件紧凑

#### 背景

单原子条件目前以一行文本展示，体验是合理的；所有条件统一树化会造成不必要的标题和缩进。

#### 问题

如果 `AND` 只有一个 child 也显示“满足全部条件”，会让简单内容显得笨重。

#### 处理方案

renderer 采用展示规则：原子 leaf inline；只有一个 child 的 AND/OR group 默认 unwrap；有多个逻辑分支才显示 group header。该规则只影响视图，不改变 met 计算和原始节点。

#### 最终预期

单条件继续保持紧凑，复杂条件才获得树形信息架构；显示规则可通过快照测试固定。

### 任务 7：统一所有 UI 调用方与纯文本 fallback

#### 背景

当前 Enhancement/Reveal/Spot 等使用公共 `describeCondition()`，Contacts 还维护重复实现；Affector 文本则通过注入条件描述生成句子。

#### 问题

只改一个 tooltip 文件会导致 UI 风格不一致；把 HTML 塞入公共字符串函数会污染 engine 和 debug 使用方。

#### 处理方案

将 `condition-presentation.ts` 作为 UI 共用模块，统一详情、tooltip、卡片和 Contacts 的树形调用。`describeCondition()` 留在兼容层，必要时从新模块提供 plain-text renderer，但不让 engine 依赖 UI。每个调用方按 Reveal 状态传入 evaluator/known 参数。

#### 最终预期

所有玩家可见的复杂条件采用同一展示规则；Affector 文本、日志和 debug 继续得到纯文本，不发生跨层依赖。

### 任务 8：COUNT/AT_LEAST 单独立项，不混入本次 UI 施工

#### 背景

建议中的“满足以下任意 N 个条件”是有价值的展示方向，但当前类型只有 AND/OR。

#### 问题

若只在 UI 类型中添加 count，底层 ConditionSystem、ConditionDepIndex、Schema 和数据包读取都会不一致；`required` 进度也无法从现有语义可靠计算。

#### 处理方案

本任务只为未来 group mode 保留扩展位，不实现 COUNT。另立机制/Schema 任务，先裁定字段形状、空组语义、短路/计数求值、依赖收窄、编辑器配置和保存结构，再接入 renderer 的 `required` 与 `metCount`。

#### 最终预期

本次树形 UI 不引入半成品 COUNT 语义；未来扩展可复用 renderer，而不需要再次推翻 AND/OR 展示结构。

## 测试与验收

### 必须覆盖

- 原子条件、AND、OR、嵌套异类组、同类组 flatten；
- 空组、单子组 unwrap 和未知 target；
- leaf/group met 状态与 evaluator 调用；
- Reveal 未知阶段不泄露 leaf 文案，allKnown 时显示完整树；
- HTML escape、名称中含 `<>&` 的安全性；
- comparator glyph、数字格式和纯文本 fallback；
- Enhancement、Reveal、Spot、Area、Story、Contacts 的接入一致性。

### 当前核验（2026-09-09）

- 已通过源码检索确认字符串化路径、重复 Contacts 描述和 `innerHTML` tooltip 写入边界。
- 已确认 `ConditionSystem.evaluateExpr()` 可作为现有组求值入口。
- 已确认 COUNT 当前不在 `ConditionGroup` 类型中，不能作为纯 UI 改动实现。
- 尚未修改代码，尚未运行新增专项测试。

### 完成条件

`npm test`、`npx tsc --noEmit`、`npm run check:architecture` 通过；新增 UI 组件测试与至少一组 Reveal 遮挡测试；浏览器验收 tooltip 窄屏换行、深浅主题、长条件树和未揭示状态。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/07-audit/condition-presentation]]
- [[docs/docs-828/02-modules/expression]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/0x-plan&work/mechanisms/review-documentation]]
