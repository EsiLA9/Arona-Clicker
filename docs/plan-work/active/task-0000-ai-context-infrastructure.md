# Task-0000：AI 施工上下文基础设施

> 状态：🔵 计划已建立，尚未施工。
>
> 目标：把高层设计判断编译为本地施工代理可在有限上下文中可靠执行的最小上下文包，减少跨文件漫游、遗忘既有裁定、重复实现和错误扩大任务边界的情况。
>
> 本文只定义 AI 协作基础设施的建设路线，不替代 `docs/docs-828/` 的当前机制事实源，也不修改任何游戏机制或 UI 行为。

## 0. 任务卡

| 项目 | 内容 |
| --- | --- |
| 任务类型 | 协作基础设施 / 文档与开发工具 |
| 问题 | 高层模型可以完成跨系统调查和设计判断；本地 Luna 在接收过大的自然语言任务、过多文件或历史资料时，容易丢失约束、重做既有能力或误入无关系统。 |
| 交付目标 | 可审查的稳定约束、架构卡、事实/决策记录、施工胶囊、Patch Unit、施工回执，以及按需生成的最小上下文包。 |
| 核心原则 | 高层 AI 交付“编译后的施工上下文”，而不是要求本地 AI 自行理解整个仓库。 |
| 默认读者 | Sol（调查、设计、复核）与 Luna（单个施工切片执行）。 |
| 不在范围 | 变更游戏功能、引擎机制、PlayerState、Datapack Schema、现有 UI 架构，或为任一业务 Task 实施功能。 |

## 1. 明确边界

### 1.1 与 Task-0049 / Task-0050 的隔离

- 本任务**不读取、评审、拆分、修订或实施** Task-0049、Task-0050 的任何问题；不得把它们作为首个试点或示例任务。
- 不修改其任务文档、代码、测试、状态或索引描述；其修复过程产生的工作树变更视为用户已有工作，必须保持原样。
- AI 基础设施完成后，只能由后续独立决策决定是否应用到这些任务；本 Task 不隐含该授权。

### 1.2 权威与非权威内容

| 内容 | 权威来源 | AI 基础设施中的处理 |
| --- | --- | --- |
| 当前代码事实 | 源码与测试 | Fact 必须给出文件、符号和核查日期；代码变化后失效。 |
| 机制、架构和协作纪律 | `docs/docs-828/` | Constitution/Card 只摘录执行所需约束，并链接原文；不得复制成第二份机制正文。 |
| 已裁定的未来方向 | `docs/plan-work/active/adr-*` | Decision Ledger 只保留短结论和 ADR 链接。 |
| 某次施工的范围与状态 | 对应 Task / Patch Unit / Receipt | 只对该切片有效，不能升级为项目规则。 |

任何摘要若与源码或当前事实源冲突，以下游施工前核查到的源码和 `docs/docs-828/` 为准；摘要须更新或标记失效。

## 2. 目标工作流

```text
源码 + docs/docs-828 + ADR / Task
        ↓  高层 AI：调查、裁定、拆分
Constitution / Card / Fact / Decision
        ↓  Context Compiler（先可人工拼装）
Patch Unit 的最小施工上下文
        ↓  Luna：只实施一个 Unit
Patch + Tests + Execution Receipt
        ↓  Sol：审查 diff、更新事实或裁定
```

职责边界：

| 角色 | 负责 | 不负责 |
| --- | --- | --- |
| Sol | 跨模块调查、确认事实、架构判断、拆分 Unit、指定 Read Set、审查 diff、维护 Facts/Decisions。 | 让 Luna 在没有边界的情况下自行选择跨系统方案。 |
| Luna | 读取已给 Capsule 和指定片段，完成一个 Patch Unit、做要求的验证、写 Receipt。 | “彻查整个架构”、自行扩张范围、把未裁定问题做成新机制。 |
| 人类 | 决定优先级、批准架构级裁定、处理需产品选择或超范围的问题。 | 为每次施工重复整理全仓库上下文。 |

## 3. 目标产物与目录

以下是目标目录，实际创建顺序由施工切片决定。长期知识和可审查任务材料应纳入版本控制；临时生成上下文可忽略，但生成规则和输入清单必须可审查。

```text
docs/ai/
├── PROJECT-CONSTITUTION.md
├── cards/
│   ├── ui-rendering.md
│   ├── mutation.md
│   └── ...
├── facts/
│   └── <domain>.md
├── DECISIONS.md
└── templates/
    ├── patch-unit.md
    ├── task-capsule.md
    └── execution-receipt.md

.ai/
├── tasks/<task-id>/
│   ├── capsule.md
│   ├── units/<unit-id>.md
│   └── receipts/<unit-id>.md
├── generated/                 # 可再生成，不作为事实源
└── symbol-map.json            # P3 决定其生成与跟踪方式
```

目录或文件名可在 P0 根据现有 `.gitignore`、文档链接习惯和实际调用方式微调；不得同时留下两套同义目录。

### 3.1 Constitution

`PROJECT-CONSTITUTION.md` 是每次施工自动携带的短约束清单，目标 100–200 行。它只记录长期、跨任务且可验证的硬边界，例如单一状态写入口、UI 只读、Schema 同步、测试要求和文档事实源规则。

- 每条规则必须链接到 `docs/docs-828/` 或源码依据；
- 不能收录临时实现细节、某个页面的文件名单或未裁定设计；
- 改变一条架构规则时，先完成相应 ADR 或当前规范更新，再同步 Constitution。

### 3.2 Architecture Card

每张卡描述一个稳定子系统，目标 50–150 行：入口、数据流、关键符号、相邻边界、禁止事项、测试入口和权威阅读链接。卡片是“该读什么”的导览，不是源码副本。

卡片只在真实需求出现时创建；第一批应由一次无业务改动的事实核查选定，避免预先为整个仓库造百科。

### 3.3 Fact Cache 与 Decision Ledger

Fact 按“已验证的源码事实”记录，最少包含：`id`、简短 statement、`source file`、`symbol`、核查日期和失效条件。Decision Ledger 按“已经做出的设计选择”记录，最少包含：`id`、结论、权威 ADR/Task 链接、影响范围和状态。

三类信息必须分开书写：

| 类型 | 示例 | 允许用于 |
| --- | --- | --- |
| Fact | 某 API 为单槽或某数据字段位于何处 | 解释当前行为与选定 Read Set。 |
| Constraint | UI 不直接修改 PlayerState | 限制施工方案。 |
| Decision | 已裁定采用何种目标模型 | 避免重新设计已解决问题。 |

不能将猜测、待验证结论或 Luna 的自述写成 Fact；它们应进入 `open_questions` 或 Receipt 的风险项。

### 3.4 Task Capsule、Patch Unit 与 Receipt

Capsule 是给 Luna 的任务入口，必须明确：当前目的、允许改动范围、禁止范围、Read Set、已确认 Facts、Constraints、Decisions、完成条件、验证命令和上下文预算。

Patch Unit 是可独立检查的最小实现切片。默认约束为：修改不超过 3–5 个文件、净改动尽量不超过 300–500 行、可独立验证、可单独提交。超出预算时先拆分或补充上游调查，而非继续塞更多上下文。

每个 Unit 开工前，Luna 先输出并获得记录的 Pre-flight：目标、将改/不会改的文件、所依据的事实、不变量和风险。完成后必须产出 Receipt：实际改动、未完成内容、不变量核查、执行命令及其结果、需上游确认的问题。Receipt 是下一 Unit 的历史输入，不是“已完成”的自我声明。

## 4. 施工切片

### P0：事实基线、命名与存储裁定

目标：只调查和建立协议，不创建业务功能。

- [ ] 核查现有协作规范、文档目录、`.gitignore` 与开发命令；确定上述目录的最终位置、版本控制策略和链接写法。
- [ ] 选取 5–10 条已在 `docs/docs-828/` 明确的长期硬约束，建立 Constitution 初稿及其权威链接。
- [ ] 选择一个**不在 Task-0049/0050 范围内**、尚未开工且足够小的未来工作作为试点候选；只记录选择理由，不开始业务实施。
- [ ] 定义 Fact、Decision、Capsule、Unit、Receipt 的最小 Markdown 模板和状态词汇。

验收：不存在平行事实源；每一条 Constitution 规则可追溯；P0 不改 `src/`、现有业务任务或业务测试。

### P1：最小人工上下文包闭环

目标：先验证流程，不依赖脚本生成器。

- [ ] 为试点候选创建不超过 3 张必要的 Architecture Cards。
- [ ] 创建仅含已验证信息的 Facts 与 Decisions；每条具有来源与日期。
- [ ] 从模板生成一个 Capsule 和一个最多 3–5 文件的 Patch Unit；显式写出 mandatory/reference/forbidden-unless-needed Read Set。
- [ ] 用一次只读演练验证：另一位执行者能否仅凭 Capsule、指定文件和权威链接完成 Pre-flight，而不阅读整个仓库。
- [ ] 记录演练反馈，修正模板和卡片，不实施试点业务代码。

验收：上下文包可在不依赖长任务正文的情况下被独立理解；误读、缺失事实和无关读取均有可追踪反馈。

### P2：受控试点与回执复核

目标：在明确授权的、与 0049/0050 无关的未来小 Unit 上使用流程一次。

- [ ] 由人类或上游 Task 明确授权试点 Unit 后，执行 Pre-flight → Patch → Tests → Receipt。
- [ ] Sol 只用 Capsule、Receipt、diff 和必要源码复核范围、约束及测试，而非重新读取全部历史。
- [ ] 将复核发现分类为：Capsule 缺项、Card 过期、Fact 错误、Decision 不清或 Unit 过大，并更新相应材料。
- [ ] 为试点建立完成/回滚/中断的记录格式；不把未完成 Receipt 误标为完成。

验收：试点能明确回答“为什么改、改了什么、没有改什么、依据是什么、如何验证”；没有在 Receipt 后才发现范围外的架构改动。

### P3：Symbol Map 与 Context Compiler（仅在 P1/P2 证明有需要后）

目标：将已稳定的人工流程半自动化，而非替代设计判断。

- [ ] 评估简单符号扫描是否足以提供 `class`、`interface`、`type`、函数和导出的文件定位；不要求一开始构建完整 TypeScript 语义索引。
- [ ] 定义生成输入：Constitution、指定 Cards/Facts/Decisions、Unit、上一个 Receipt 与显式符号片段；禁止隐式扫描整个仓库。
- [ ] 支持输出可复现的 `generated/context-<task>-<unit>.md`，记录输入清单、文件版本或生成时间、总 token/字符预算。
- [ ] 代码片段默认按符号与必要邻域提取，避免整份超长文件；提取失败必须显式报告，不能静默用旧片段。
- [ ] 为脚本添加最小单测或 fixture 测试，并定义其生成产物是否入库。

验收：同一输入得到可解释的上下文包；生成器不会把生成物伪装成源码事实；人工 Capsule 仍可在脚本不可用时执行。

## 5. Context Budget 与 Read Set 协议

每个 Unit 都必须写预算。初始建议为文档 4k、代码 10k、上一个 Receipt 1.5k，总目标不超过约 16k tokens；它是拆分信号而不是可绕过的配额。超限处理顺序：删除无关阅读 → 引用权威链接 → 提取指定符号 → 拆 Unit → 交回 Sol 调查。

Read Set 采用三层：

| 层级 | 含义 |
| --- | --- |
| `mandatory` | 未阅读不得施工的卡、事实、决定、文件和符号。 |
| `reference` | 遇到列明情形才读取的相邻实现。 |
| `forbidden-unless-needed` | 默认不读；确有需要时必须在 Pre-flight/Receipt 中说明原因。 |

任何“允许改动文件”外的修改，必须停止当前 Unit，在 Receipt 中说明新依赖，并请求新的 Unit 或上游确认。

## 6. 模板的最低字段

### Capsule

```markdown
## Purpose
## Allowed / forbidden scope
## Read Set
## Facts / Constraints / Decisions
## Completion criteria and verification
## Context budget
```

### Pre-flight

```markdown
## Goal understood
## Files/symbols to change
## Explicit non-goals
## Facts and invariants
## Risks / questions requiring escalation
```

### Execution Receipt

```markdown
## Changed files and actual behavior
## Not completed / deviations
## Invariant checklist
## Verification executed and results
## Facts or decisions to update
## Escalations for the next Unit
```

## 7. 风险与防护

| 风险 | 防护 |
| --- | --- |
| 摘要逐渐替代源码，形成第二事实源 | Fact 强制来源与日期；所有 Card/Constitution 链接权威正文；代码改动时复核相邻摘要。 |
| AI 基础设施自身膨胀成维护负担 | P0/P1 先人工流程；每种产物必须解决已观察到的失败模式后才新增。 |
| 高层 Task 仍过大 | Unit 预算、允许文件清单与 Pre-flight 为必填；超限即拆分。 |
| Luna 根据不确定推理自行定案 | Facts/Constraints/Decisions 分层；不确定内容进入 open question 并上交。 |
| 自动切片遗漏关键依赖 | 编译器只辅助选择；Sol 保留 Read Set 的判断责任；P2 diff review 验证遗漏。 |
| 将正在进行的修复卷入试点 | 0049/0050 明确排除；选择试点前核对任务范围与工作树。 |

## 8. 测试与验收

- P0/P1 的验收以文档链接、模板完整性、只读演练记录和 `git diff --check` 为主；无需运行游戏全量测试，因为不改业务代码。
- P3 如新增脚本，必须为解析、路径处理、预算和片段失效行为增加定向测试，并执行 `npx tsc --noEmit`（若脚本进入 TypeScript 构建范围）及相关测试。
- 任何获授权的业务试点仍遵守项目既有测试规范：运行该 Unit 的定向测试、类型检查和上游 Task 要求的验证；AI Receipt 不能替代测试结果。

## 9. 当前核验（2026-09-13）

- 已阅读 `docs/docs-828/00-INDEX`、`docs/docs-828/05-conventions/doc-maintenance`、`docs/docs-828/05-conventions/testing` 与 `docs/plan-work/00-index`，确认本主题应以 `docs/plan-work/active/` 的 Task 管理，当前机制事实仍归 `docs/docs-828/`。
- 已确认仓库尚无 `docs/ai/` 或 `.ai/` 目录；本 Task 仅提出目标目录，不在本轮创建。
- 本轮只新增本任务文档及其索引入口；未运行或修改 Task-0049/Task-0050、游戏代码和测试。

## 10. 相关路由

- [[docs/plan-work/00-index]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
