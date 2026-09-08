# 07-audit/enum-taxonomy — 枚举面与分类学超配

> 本文回答：**哪些枚举 / 阶梯 / 错误码的分类学超出了实际消费方，怎么收敛。**
> 判据：一档分类需要跨文档写「勿混淆」警告，或大多数枚举值无消费方。多 Datapack 前提下分类学即是第三方作者的**学习负担**，收敛的收益更大。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | RevealStage 7 级 + AccessStage 5 阶段，引擎只消费 `existence` 一档 | 见下 | 高 |
| 2 | 操作返回码 ~39 种 + canXxx 前置判定双保险 | 见下 | 中 |
| 3 | EffectOp 25 种混三类执行语义（落数据 / 转发 / 声明不执行） | 见下 | 中 |
| 4 | 统计 DSL 30+ 函数 | 见下 | 低 |
| 5 | hasTag / countTags / tagCount 三胞胎走两条链路 | 见下 | 低 |

### 1. 可见性 12 级阶梯

- **位置**：`02-modules/visibility.md:21-24`（两套阶梯「勿混淆」；5 种 RevealTarget 中仅 `existence` 被引擎直接消费）；`03-data-structures/declarative-dsl.md:135-141`；`03-data-structures/stats-views.md:37`（第二处「勿混淆」）。
- **原因**：7+5=12 级分类学中引擎真正消费的只有 `existence` 一档；其余是 UI 遮挡的信息分层——分类复杂到需要两处防呆警告。
- **方案组**：
  - **A（推荐）**：收敛为单阶梯 4 档（hidden → obfuscated → known → interactive），未消费档位删除；纯 Def 侧变更，无存档影响。
  - B：保留两套阶梯，合并为一张对照表放 declarative-dsl（消掉「勿混淆」警告）。

### 2. 返回码全家桶 + 前置判定双保险

- **位置**：`03-data-structures/declarative-dsl.md:184-191`（6 个判别联合合计约 39 码，其中 StoryError 14 种）；`02-modules/story.md:38`；`02-modules/world.md:55`（业务操作 = canXxx 只读判定 + mutations 写入）。
- **原因**：门面 canXxx 预检已挡住非法操作，细码多数区分 UI 可自行推导的情形（NotFound / NotVisible / NotOwned…），同一非法操作被「预检 + 细码」判两遍。
- **方案组**：
  - **A（推荐，低成本）**：引擎保留细码，UI 映射层归并为 3 类展示（不可见 / 不可用 / 被阻断）+ tooltip 诊断。
  - B（破坏性变更时顺带）：折叠为 `Invalid` / `Unavailable` / `Blocked` 三码 + `detail?: string` 诊断字段。

### 3. EffectOp 三类执行语义混一

- **位置**：`03-data-structures/declarative-dsl.md:70-92`（25 种 = 状态层 14 + 转发类 9 + 声明类 2）；`02-modules/effect-trigger.md:22`（声明类「登记在分发但不执行」）。
- **原因**：同一 op 联合混三种行为模型；数据作者写一个 `setSpotMaxLevel` 进 effects 数组会被静默跳过——「声明了却不生效」的隐坑。
- **方案组**：
  - **A（推荐）**：把声明类 2 op 移出 EffectOp（SpotDef 专字段或独立声明表），op 25 → 23，执行语义统一为「落数据或转发」。
  - B：保留，但 schema `@label` 显著标注「声明类，不经执行」。

### 4. 统计 DSL 函数面

- **位置**：`02-modules/stats.md:21`、`03-data-structures/stats-views.md:16-20`（30+ 个 `$` 函数映射三层桶）。
- **原因**：函数 × 三层桶的组合笛卡尔积供条件系统引用，实际消费可数；每加指标同步扩表。
- **方案组**：**A（推荐）冻结增长**，新需求走参数化（如 `$Stat <layer>:<metric> key`）。B 保留（纯映射表，维护成本可接受）。

### 5. 标签条件三胞胎

- **位置**：`03-data-structures/declarative-dsl.md:55-57`（hasTag / countTags / tagCount）；`02-modules/stats.md:23`（语义区分仅一段文字）。
- **原因**：「有多少个带 X 的」三种问法分别走 `spotsByTag` 与 TagStatService 两条链路；语义差异靠文档维护。
- **方案组**：**A（推荐）**合并 countTags / tagCount（key 前缀 `<kind>:<tag>` 区分域），hasTag 保留。B 保留三胞胎。
