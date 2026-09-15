# Task-0000：最小 AI 施工上下文协议

> 状态：proposed — P0 已完成（`docs/ai/` 协议、模板与路由入口已建立）；P1 待人工授权试点。
>
> 目标：建立一套轻量施工纪律，使 Luna 在有限上下文中能正确完成一个明确 Unit；上下文、事实或范围不足时能停止并上交，而不是自行扩张搜索、修改范围或架构设计。
>
> 本文只定义 AI 协作基础设施，不替代 `docs/docs-828/` 的当前机制事实源，也不修改任何游戏机制或 UI 行为。
>
> 文档形态：本文按“协议文档”书写（角色表 + 产物定义 + 停止条件 + 施工切片），不逐字套用 [[docs/docs-828/05-conventions/doc-maintenance]] 的计划文档最小模板；字段对应关系见 §8。

## 0. 任务卡

| 项目 | 内容 |
| --- | --- |
| 任务类型 | 协作基础设施 / 文档模板 |
| 要解决的问题 | Luna 的上下文不足、遗忘既有裁定、施工范围失控。 |
| 最小交付 | `PROJECT-CONSTITUTION.md`（从属索引）、Patch Unit 模板、Execution Receipt 模板；Architecture Card 仅按真实需要增加。 |
| 核心流程 | 高层 AI → Patch Unit → Luna → Patch + Tests + Receipt → 高层 AI Review。 |
| 不在范围 | 全项目知识库、默认 Fact/Decision 文件、完整 Context Compiler、Symbol Map，或任何业务功能施工。 |

## 1. 明确边界

### 1.1 与 Task-0049 / Task-0050 的隔离

- 本任务**不读取、评审、拆分、修订或实施** Task-0049、Task-0050 的任何问题；不得将它们作为试点或示例任务。
- 不修改其任务文档、代码、测试、状态或索引描述；相关工作树变更一律视为用户已有工作并保持原样。
- 后续是否把本协议用于 0049/0050，须由独立任务或明确指令决定；本 Task 不提供此授权。

### 1.2 角色

本协议用两个角色标签描述协作：**高层 AI**（调查、裁定与拆分）与 **Luna**（单个 Unit 的施工）。这两个名字只是本文档内的角色标签，仓库其他文档不使用该命名，等价说法为“上游 / 高层 AI”与“本地施工代理”。

| 角色 | 负责 | 不负责 |
| --- | --- | --- |
| 高层 AI | 跨模块调查、确认事实、架构判断、拆分 Unit、指定 Read Set 与 Allowed Files、审查 diff 与 Receipt、维护权威文档。 | 把“该用什么方案”的判断交给 Luna；让 Luna 在无边界条件下自行选择跨系统设计。 |
| Luna | 读取 Unit 指定的 Read Set，在一个 Unit 内完成 Patch、执行必需验证、写 Receipt。 | 彻查整个架构、扩张 Allowed Files、把未裁定问题做成新机制、以“顺手完成”扩大 Completion Criteria。 |
| 人类 | 决定优先级、批准架构级裁定、处理产品选择或超范围问题。 | 为每次施工重复整理全仓库上下文。 |

### 1.3 权威关系

| 信息 | 权威来源 | Patch Unit 的用法 |
| --- | --- | --- |
| 当前代码事实 | 源码与测试 | 只写入已核实、且本 Unit 必需的事实，并标注路径/符号。 |
| 长期架构与协作约束 | `AGENTS.md` 与 `docs/docs-828/` | 只链接权威正文，不复述、不形成平行清单。 |
| 已裁定的未来设计 | 对应 ADR / 当前 Task | 仅在需要时放入 Unit 的 `Constraints` 或 `Confirmed Facts`，附权威链接。 |
| 本次实际进展 | Patch、测试结果与 Receipt | 只对当前 Unit 有效，不自动升级为项目规则。 |

任务摘要与源码冲突时，Luna 不得自行推导替代设计：停止施工，指出冲突并请求高层 AI 核实。

## 2. 最小协议

### 2.1 产物位置与命名

只有协议与模板进入 `docs/ai/`；Unit 与 Receipt 不另建并行计划目录，随所属 Task 就地存放。

```text
docs/ai/
├── PROJECT-CONSTITUTION.md        # 从属索引，见 2.2
├── cards/<subsystem>.md           # 按需，见 2.3
└── templates/
    ├── patch-unit.md
    └── execution-receipt.md
```

- Unit 与 Receipt 默认**内联在所属 Task 文档**（如 [[task-0032-passive-story-scheduling]]）的对应小节，随 Task 生命周期一起归档，避免在 `docs/plan-work/` 之外再造一套计划目录。
- 仅当单个 Task 的 Unit 超过 3 个、或 Task 文档因 Unit 堆积难以阅读时，才拆出 `docs/plan-work/archive/<task-id>-units/<unit-id>.md` 与同目录 `receipts/`；拆分后 Task 文档只保留链接。
- Unit 命名：`<task-id>-U<n>`（如 `task-0032-U2`）；Receipt 与对应 Unit 同名。
- 不使用 `.codebuddy/`：该目录已被 `.gitignore` 忽略，不能承载需要版本控制的协议。

若 P0 发现该位置与既有文档习惯冲突，可在**不新增第二套同义目录**的前提下微调。

### 2.2 `PROJECT-CONSTITUTION.md`

建立于 `docs/ai/PROJECT-CONSTITUTION.md`，控制在约 70–150 行，且**明确从属于 `AGENTS.md`**。

- `AGENTS.md` 已有的 8 条架构纪律、命令表、禁止修改清单，一律只给链接（[[AGENTS.md]]、[[docs/docs-828/05-conventions/architecture-discipline]]），**禁止在 Constitution 中复述**，避免出现第三份并列清单。
- Constitution 只收录 `AGENTS.md` 尚未覆盖的**施工纪律**：Patch Unit 预算、Allowed Files 白名单、Completion Criteria 语义、停止条件与 Receipt 措辞。
- 与 `AGENTS.md` 冲突时以 `AGENTS.md` 为准；仅当对应权威规范变化时才更新。
- 不记录具体业务 Task 的临时设计、文件列表或未裁定方案，也不能代替 ADR 或 Task。

### 2.3 Architecture Card（按需）

只有某个子系统在真实施工中被频繁涉及、且 Luna 反复需要同一段导览时，才在 `docs/ai/cards/` 增加短卡。卡片回答“该读什么、边界是什么、不要碰什么”，不预先为全仓库建立百科，也不复制源码。

### 2.4 Patch Unit（Luna 的主要入口）

一个 Unit 是可独立审查的最小施工切片。默认应限制在 3–5 个文件、约 300–500 行净改动内，并可独立验证；若超出，先拆分或交回高层 AI。

模板位于 `docs/ai/templates/patch-unit.md`，每个 Unit 必须直接包含：

```markdown
## Goal
## Must Read / Read Set
## Confirmed Facts
## Constraints
## Allowed Files
## Explicit Non-goals
## Stop Conditions
## Completion Criteria
## Verification
```

其中：

- `Read Set` 只列完成本 Unit 必需的文档、文件和符号；不要让 Luna 因“不确定”而全仓库漫游。
- `Confirmed Facts` 只写已从源码、测试或权威文档核实的事实；推测必须列为问题，不能伪装成事实。
- `Allowed Files` 是修改白名单。需要改白名单外文件时，Luna 必须停止并上交。
- `Completion Criteria` 是当前 Unit 的**最大施工边界**，不是最低完成要求；未列出的相关工作不得“顺手完成”。
- `Stop Conditions` 至少写入 §3 的可度量条件；可在 Unit 内收紧，不得放宽到不可判定。
- `Verification` 必须写明本 Unit 所需的定向测试、类型检查、浏览器验收或其他证据。

### 2.5 Execution Receipt

模板位于 `docs/ai/templates/execution-receipt.md`。每个完成或中断的 Unit 都写 Receipt，仅记录：实际修改、未完成内容、测试结果、遇到的问题与需上游确认项。Receipt 供下一 Unit 或高层 AI Review 使用，不是自行宣告任务完成。

## 3. 停止条件（协议核心）—— 可度量

Luna 遇到下列任何一条必须停止当前 Unit，输出已确认事实、当前位置和需要上游答复的问题，等待新 Unit 或明确答复。阈值由高层 AI 写入 Unit；Unit 未写明时使用本表默认值：

1. 需要修改 `Allowed Files` 之外的文件；
2. 需要新增文件，或预计净改动超出 Unit 预算（默认 3–5 个文件 / 300–500 行）；
3. 为定位修改点需要读取 Read Set 之外的文件，且超出默认 2 个（Read Set 内文件的重读不计）；
4. 源码 / 测试事实与 Unit 的 `Confirmed Facts`、Task 文档或摘要冲突；
5. 实现需要新增机制、改变架构边界、在未裁定方案中选型，或扩大 `Completion Criteria`；
6. 必需验证无法执行、失败，或结果无法解释。

停止不是失败。正确停止优于带着假设继续施工；高层 AI 应根据问题补足事实、缩小/拆分 Unit，或建立 ADR，而不是要求 Luna 自行补做设计。

## 4. 风险与防护

| 风险 | 防护 |
| --- | --- |
| 摘要逐渐替代源码，形成第二事实源 | Constitution / Card 只链接权威正文、不复述既有纪律；Unit 事实必须带路径与符号 |
| 协议自身膨胀成维护负担 | 每个新增产物必须对应至少一个已观察到的失败模式（P2/P3 门槛） |
| Unit 仍过大，Luna 带假设施工 | 可度量停止条件 + Allowed Files 白名单 + Completion Criteria 作为最大边界 |

## 5. 施工阶段

### P0：建立最小模板

- [x] 核查既有协作规范、文档链接习惯与 `.gitignore`，确认 `docs/ai/` 的最终位置（默认见 §2.1；`.codebuddy/` 已忽略，不采用）。
- [x] 建立 `PROJECT-CONSTITUTION.md` 初稿：只写 `AGENTS.md` 未覆盖的施工纪律，架构硬约束一律链接、不复述。
- [x] 建立 Patch Unit 与 Execution Receipt 的最小 Markdown 模板（`docs/ai/templates/`）。
- [x] 将 §3 的可度量停止条件和“Completion Criteria 是最大边界”写入 Unit 模板。
- [x] 在 `AGENTS.md` 路由表与 [[docs/docs-828/05-conventions/doc-maintenance]] 分区表各补一行指向 `docs/ai/`，使协议可被路由到。

验收：模板可独立使用；Constitution 每条规则可追溯且无 8 条纪律的复述；新会话仅凭 `AGENTS.md` 即可找到 `docs/ai/`；P0 不改 `src/`、业务测试或已有业务 Task。

P0 施工结果（2026-09-13）：已交付 `docs/ai/PROJECT-CONSTITUTION.md`（C1–C9 + 停止条件）、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`，并完成两处路由登记；详见 §8。

### P1：人工 Patch Unit 试点

- [ ] 选择一个小型、低风险、**不在 Task-0049/0050 范围内**的未来任务；试点授权由人类明确给出后才开展。
- [ ] 由高层 AI 手工编写一个 Patch Unit；仅放入必需的 Read Set、已确认事实和约束。
- [ ] Luna 先按 Unit 复述 Goal、Allowed Files、Non-goals 和 Stop Conditions，再开始施工。
- [ ] 产出 Patch、所需验证和 Receipt；高层 AI 以 Unit、diff 与 Receipt 复核是否存在误读或范围外变更。

验收：Luna 在信息充分时能完成 Unit；信息不足时能明确停止；没有未经许可的范围扩张。

### P2：按失败模式补充

- [ ] 仅在试点表明某子系统导览被反复需要时，新增对应 Architecture Card。
- [ ] 仅在手工整理 Read Set 或 Receipt 确实成为重复负担时，增加简单、可审查的辅助脚本。
- [ ] 将试点中发现的问题归类为 Unit 缺项、事实错误、约束不清或切片过大，并修订对应模板/卡片。

验收：每个新增产物都对应至少一个已观察到的失败模式；不为可能发生的问题预建知识库。

### P3：审慎自动化

只有人工整理上下文明显成为稳定负担、且 P2 不能解决时，才评估 Symbol Map 或 Context Compiler。自动化必须服务于既有 Patch Unit 协议，不能隐式扫描全仓库、替代高层判断或把生成摘要视为事实源。

## 6. 成功标准

- 上下文充分时，Luna 能正确完成当前 Unit；
- 上下文不足时，Luna 能正确停止并说明缺什么；
- 任务范围之外时，Luna 不自行扩张；
- 摘要与源码冲突时，Luna 不自行重新设计；
- 协议可被发现：新会话仅凭 `AGENTS.md` 路由即可找到本协议，无需人工告知；
- 只有在多次 Unit 中重复出现的信息，才被上升为 Constitution、Architecture Card 或自动化能力。

## 7. 测试与验收

- P0 以模板完整性、权威链接、`docs/ai/` 可路由性和 `git diff --check` 为主要证据；不因只改文档而要求运行游戏全量测试。
- P1 以试点 Pre-flight/Receipt 与 Unit 内定向验证结果为主要证据。
- 若 P2/P3 增加脚本，必须补充该脚本的定向测试，并按脚本技术栈执行相应类型检查。
- 经授权的业务试点仍须遵守项目既有测试规范；Receipt 不能替代真实测试结果。

## 8. 当前核验（2026-09-13）

已核实事实（本轮实际读过）：

- `AGENTS.md` 已含 8 条架构纪律（权威正文为 [[docs/docs-828/05-conventions/architecture-discipline]]）、命令表与禁止修改清单，故 Constitution 不得复述这些内容。
- [[docs/docs-828/05-conventions/doc-maintenance]] 的文档分区表目前没有 `docs/ai/` 这一层；`AGENTS.md` 路由表中也没有入口。
- 仓库当前不存在 `docs/ai/` 目录；`.gitignore` 已忽略 `/.codebuddy/`、`/.qoder/`、`/.zcode/`，未忽略 `docs/`。
- `Luna` / `Patch Unit` 等术语在其他文档中零命中，属于本协议新引入的角色标签，故 §1.2 就地定义。

本轮修订：

- 将任务收缩为最小协议：Constitution、按需 Card、Patch Unit、Receipt。
- 独立 Fact Cache、Decision Ledger、Implementation Contract、完整状态机、Symbol relation graph、自动 Diff Summary 与 Context Compiler 均明确延后，除非实际试点证明需要。
- 补入：Constitution 与 `AGENTS.md` 的从属关系（不复述 8 条纪律）、协议入口登记（P0）、角色表、可度量停止条件、产物位置与命名、精简风险表；并修正 P0/P1 验收口径。
- 与 doc-maintenance 计划模板的字段对应：目标/设计边界 = §0–§1，当前事实与代码落点 = §8 首段，施工切片 = §5，测试与验收 = §7，当前核验 = §8，剩余工作 = §5 未勾选项，相关路由 = §9。
- 本轮只修订 Task-0000；未读取、修改或实施 Task-0049/Task-0050，未修改游戏代码或测试。

P0 施工记录（2026-09-13）：

- 新建 `docs/ai/PROJECT-CONSTITUTION.md`：C1–C9 施工纪律与可度量停止条件；架构硬约束、命令、禁改清单只给链接，未复述。
- 新建 `docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`：模板内嵌 Unit 预算、Allowed Files 白名单、Completion Criteria 最大边界、默认停止条件与 Pre-flight 复述要求。
- 路由入口：`AGENTS.md` 路由表新增一行指向 [[docs/ai/PROJECT-CONSTITUTION]]，并在归档段说明 `docs/ai/` 非计划正文；[[docs/docs-828/05-conventions/doc-maintenance]] 分区表新增 `docs/ai/` 一层。
- 未改动 `src/`、`tests/`、`tools/` 或任何业务 Task 文档；未涉及 Task-0049/Task-0050。
- 验证：`git --no-pager diff --check` 通过；本轮无脚本新增，故无新增测试需求。
- 口径说明：§2.2 的行数区间由 100–200 行修订为 70–150 行——不复述 8 条架构纪律后 Constitution 正文自然短于原估计（实际 75 行），上限 150 行仍用于防膨胀。

## 9. 相关路由

- [[docs/plan-work/00-index]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
