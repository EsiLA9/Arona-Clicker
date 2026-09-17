# AGENTS.md — AI 协作指南

> 本文只做**路由与速查**，不承载机制细节。所有机制/结构/算法内容以 `docs/docs-828/` 为单一事实源（取代已归档的 `docs-824/`）。
> 接到任何任务，先读 [[docs/docs-828/00-INDEX]] 定位；改机制前按路由表读对应文档。

## 快速上手

### “编辑器”术语约定

- 当前项目语义中，未特别说明的“编辑器”默认指 **游戏内 UI 编辑器**，即 `src/ui/` 中随游戏页面运行的编辑能力。
- `tools/datapack-editor/` 是暂时弃用的独立数据包编辑器，仅作为历史工具、Schema 同步产物和后续恢复时的参考；除非任务明确点名，否则不要把它作为当前 UI 问题的默认调查或修改目标。
- 当问题描述“游戏内编辑器”“UI 编辑器”“主题 UI 控件”时，优先检查 `src/ui/`、游戏内路由和当前 Edge 中的游戏页面。
- 只有明确提到“独立数据包编辑器”“tools/datapack-editor”或 Schema 编辑器时，才切换到 `tools/datapack-editor/` 路由。

| 场景 | 路由 |
| --- | --- |
| 第一次接触项目 / 任务定位 | [[docs/docs-828/00-INDEX]]（唯一入口，双路由表） |
| 改引擎机制 / 新增子系统 | [[docs/docs-828/00-INDEX]] 模块卡片索引 → 对应卡片 + [[docs/docs-828/05-conventions/architecture-discipline]] |
| 改实体字段 / 枚举（`src/engine/types/`） | 必读 [[docs/docs-828/05-conventions/schema-sync]]（含 `gen:schema` 协议） |
| 改数据结构 / 状态分层 | [[docs/docs-828/03-data-structures/player-state]] + [[docs/docs-828/01-architecture/state-layers]] |
| 改核心算法（生产/抽卡/培养/色彩/事件联动） | [[docs/docs-828/04-mechanisms/state-mutation]] 起（分区表见 00-INDEX） |
| 文件拆分 / 重构 | [[docs/docs-828/05-conventions/refactoring]] |
| 写测试 | [[docs/docs-828/05-conventions/testing]] |
| 维护文档本身 | [[docs/docs-828/05-conventions/doc-maintenance]]；文档准出四项条件、蒸馏分类与归档模板见 [[task-0064-project-documentation-exit-governance]] |
| Luna 施工上下文 / Patch Unit / 施工纪律 | [[docs/ai/PROJECT-CONSTITUTION]]（从属索引，不复述架构纪律；Unit 与 Receipt 模板见 `docs/ai/templates/`） |
| Luna 任务 Read Set / 上下文预算 | [[docs/ai/task-read-set-routing]] → [[docs/docs-828/01-architecture/current-context-card]] |
| 好感系统（数值 / 台阶推送 / 羁绊尾巴 / 输入中提示）机制 | [[affection-planning]]（机制单一事实源；聊天消息成分已移除） |
| Datapack 读取 / 多包管理 / mod 冲突与命名空间 | [[adr-0004-datapack-management]]（规划中，裁定记录见文内） |
| Datapack 汇总契约 / Registry 组合边界 | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/`；基础引擎只消费注入后的数据 |
| 仍生效的设计约束（已被代码实现的裁定） | [[docs/docs-828/01-architecture/design-constraints]] |
| 历史计划 / 过程文档 / 未决方向（**非当前事实源**） | [[docs/plan-work/00-index]]（冻结考古层入口） |

### 计划与过程文档（冻结考古层）

`docs/plan-work/` 保存全部历史 ADR / Roadmap / Task / 设计草案 / 审查记录，**整体处于冻结状态**：

| 路径 | 内容 | 维护方式 |
| --- | --- | --- |
| `archive/` | 全部冻结的过程文档 | 不再准出、不再维护状态；只允许追加「更正（日期）」标注 |
| `mechanisms/` | 按机制的反向索引（当前机制 → 设计理由 → 历史来源） | 只在需要定位设计理由时更新 |
| `00-index.md` | 入口，含**未决方向**清单 | 新方向出现时追加 |
| 根目录 `*.md` | 新的、确实要推进的计划文档 | 只在开工时创建，完成后移入 `archive/` |

规则：

- **不要从 `archive/` 判断系统现状**；ADR 里写了「应如此」但源码未实现的地方，以 [[docs/docs-828/01-architecture/design-constraints]] 末节的「尚未落地的纸面约束」为准；
- 恢复某个未决方向时，从原文**重新激活**（另立 ADR / Task），不要就地续写历史文档；
- 新计划文档一律按**裸文件名**互相引用（形如 `[[task-0070-xxx]]`，不带目录路径），移动目录不会产生连锁改名；
- 策划意见不能直接写入机制正文；只有裁定并实现后的稳定机制，才沉淀到 `docs/docs-828/`；
- `docs/ai/` 只放 AI 施工协议与模板（非计划正文），入口见上方路由表；
- `docs/newPlan/` 是旧位置，仅保留历史文件，**禁止写入**。

文档完整性（链接目标、文件名唯一、源码路径有效性）由 `npm run check:docs` 检查。

### 文档范围与拆分纪律

- 当新需求、评审意见或施工范围的标题或主体已经超出当前 Draft / Task 的目标、边界或验收口径时，必须优先创建新的 ADR、Draft 或 Task 文档，不得反复借调旧文档承载新增主题。
- 旧文档只继续维护其原定范围、状态和历史结论；新文档应通过“前置 / 关联 / 后续入口”链接旧文档，不能用追加章节的方式掩盖任务范围扩张。
- 只有同一目标下的澄清、验收记录或非扩展性修订才留在原文档；若出现新的独立标题、实现阶段、责任边界或延期事项，应拆为新文档并同步 docs/plan-work/00-index.md。

## AOCI 与任务系统协作

- `AGENTS.md` 只承载稳定的项目规则与路由；`aoci.txt`、`aoci.meta.txt`、`aoci.code.txt` 和可选的 `aoci.database.txt` 承载仓库认知，不在此复制认知正文或 FRAS 机制。
- `docs/plan-work/00-index.md` 是任务与历史入口；`docs/plan-work/` 根目录只放当前确实推进的 Task / ADR / Draft，`archive/` 与 `mechanisms/` 是冻结考古层。
- Codex Goal 只负责当前会话的持续执行，不是项目事实源；长期状态、边界、决策、验收和剩余工作必须写入对应 Task 文档。
- 新任务开始时先建立或更新根目录 Task，并同步 `00-index.md`；范围扩展必须拆新文档，不把旧 Task 变成多主题容器。
- 代码或文档达到最终稳定状态后，按当前 AOCI Guide 处理受影响 Entry，依次完成 Verify、Check、Guide；不得手工编辑 AOCI Volume。
- Task 完成后先写入最终核验，再将文档移入 `docs/plan-work/archive/`、更新 `00-index.md`，最后重新维护受影响 Entry 并再次完成终态核验。
- `.codex/config.toml` 等机器绑定宿主配置保持 Git 忽略；认知资产、必要的 `.aoci/` 治理状态和 Task 文档应在审阅后纳入本地 Git 提交。

## 命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | vitest 全量测试（一次性运行） |
| `npx tsc --noEmit` | 类型检查 |
| `npm run dev:game` / `npm run dev` | UI / 引擎开发服务器 |
| `npm run build` | 构建 |
| `npm run gen:schema` | `src/engine/types/**` → `tools/datapack-editor/schema/engine-defs.gen.json` |
| `npm run ui:callgraph` | UI 调用链 / 反向链静态分析（定位 DOM 过度刷新的入口；`--chains` / `--dom` / `--reverse` / `--forward` / `--hot`） |
| `npm run check:architecture` | 数据服务单向依赖边界静态检查 |
| `npm run check:docs` | 文档库结构检查（链接目标、裸名引用、文件名唯一、状态词表、归档结果） |
| `npm run report:doc-context` | 文档分区规模与粗略上下文预算报告 |

## 架构纪律（不可破坏，详见 [[docs/docs-828/05-conventions/architecture-discipline]]）

1. **单一写入口**：所有状态变更走 `StateMutationService`，禁止直接改 PlayerState
2. **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体；新事件登记进 `EVENT_CATALOG`
3. **数据包声明式**：新机制优先设计成 Datapack 字段（Schema 协议同步），而非硬编码
4. **只读 UI**：UI 只消费 `getView()` / `createUIContext()`（`UIFacingGame` 只读面），不持有写引用
5. **三层状态**：新增"跨世界线保留"数据时想清楚放 global / per-Init 快照 / per-Init 当前哪一层；per-Init 字段必须在 `PER_INIT_FIELD_SPECS` 登记
6. **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成）
7. **数据服务单向依赖**：`src/data-services/` 不得依赖 `src/arona-clicker/`、`src/ui/`、`src/data/` 或 `src/save/`；由 `npm run check:architecture` 强制检查
8. **不做存档迁移**：项目处于长期开发阶段，PlayerState / Datapack 结构可随时破坏性变更，**禁止编写任何存档迁移/版本兼容代码**；旧存档失效直接清档重来。改状态结构时同步更新相关测试与文档即可

## 实体类型 → 数据包编辑器 同步协议（防漂移）

- 改 `src/engine/types/` 的实体字段/枚举后，**必须** `npm run gen:schema`（重新生成 `engine-defs.gen.json`）。
- 简单字段（string/int/float/enum/ref/array）自动进编辑器；想带中文标签/枚举含义，在字段 TSDoc 写 `@label` / `@enum 值=中文` / `@ref <表>` / `@int`。
- 复杂/仅编辑需要的字段（条件/效果/表达式 tagged 联动、optionsFrom、collapsible 等）在 `tools/datapack-editor/schema/editor-extras.ts` 的 `TABLE_META.overrides` 兜底。
- `tools/datapack-editor/schema/engine-schema.sync.test.ts` 做三向一致检查：引擎字段↔协议↔editor 表，新增未同步即 error。
- 完整流程见 [[docs/docs-828/05-conventions/schema-sync]]。

## 禁止修改

- `dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/`
- `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后跑 `npm run gen:schema`）
- `docs-824/`（已归档，正文不改写；只读历史快照）

## 代码风格

- 默认不写注释；只在 WHY 非显而易见时写
- 引用文件用路径而非复制代码，让 AI 用 Read 定向读
- 建议拆解较大的代码文件：引擎/关键数据结构本体与关键循环、集成完毕的服务放单文件，较大的底层服务与枚举功能各自拆出为多个文件到对应文件夹内（规范见 [[docs/docs-828/05-conventions/refactoring]]）

## 默认数据与 Spot 招募

- **正式应用默认内容从 `src/arona-clicker/content/default-datapack.ts` 进入**；`src/data/test-datapack.ts` 与其底层兼容出口用于测试/示例 Datapack，不是基础引擎内置内容。`datapack/` 是可选数据包导入，默认内容变更应修改 AronaClicker 内容层。
- **Spot 招募（gacha）**：招募入口在 Spot 的 `gacha` 功能项（不在通讯录）。机制细节见 [[docs/docs-828/04-mechanisms/gacha]] 与 [[docs/docs-828/04-mechanisms/roster]]；UI 落点见 [[docs/docs-828/02-modules/ui]]。
- 新增/修改 Spot 字段或 `SpotFunctionalityDef.kind` 后，必须 `npm run gen:schema` 并在 `editor-extras.ts` 兜底同步（见上文协议）。

<!-- aoci:begin -->
## AOCI 仓库认知

AOCI 为本仓库维护一个稳定、可版本化、可增量更新的仓库级认知层，供模型跨任务复用对系统的理解。

`aoci.txt` 是面向模型的结构化认知索引。它以每个受管理文件、数据库表或其他受管理对象一条独立 Entry 的方式，用符号标签与 F/R/A/S 语义表达对象的核心职责、重要关系、对外契约，以及理解或修改系统时必须知道的非显然约束和设计决策。

Header、目录段和全部 Entry 共同组成完整仓库索引，可以覆盖前端、后端、配置、数据库结构及其他受管理内容。受管理内容发生变化时，通常只需维护受影响的认知条目，不需要重新生成整个索引。

AOCI 提供系统架构、对象职责、重要关系、对外契约和关键约束的高密度视图。

### 工作原理

AOCI 采用“模型生成、模型读取”的认知闭环。

Header、Entry 和 Curation 语义的创作只按当前机器签发的 Plan 与实时 Guide 执行；由 Host 模型基于当前绑定证据独立完成。

Entry 的语义必须来自模型对真实证据的理解。不得仅依据路径、文件名、扩展名、AST、符号列表、依赖扫描、正则、固定模板或规则引擎推导、预填、拼接或改写索引语义。

对 Fresh Bootstrap，只按当前机器签发的 Plan 和实时 Guide 执行。当它们要求创作时，Host 模型创作 Root、Meta、Tag 和 F/R/A/S，提供 authoring-run 声明，并把它绑定到 Plan、Evidence 与完整 Candidate。不得要求 AOCI 填写 `origin=host_model`、制造 Receipt 或把程序生成的 Framework 当作语义。本文件不自行重建 Onboarding 流程。内部批次不是用户决策；只有遇到既有批准边界或真实的安全、漂移、CAS、Recovery 条件才停止。

### 最小使用入口

- `aoci_rules`：取得当前AOCI版本的会话运行合同。
- `aoci_overview`：建立或恢复本仓库的完整认知。
- `aoci_maintain`：受管理对象达到最终稳定状态后检查认知是否需要维护。
- `aoci_update_entry`：提交与当前证据和源码摘要绑定的完整语义更新批次。
- `aoci_report`：仅当当前布局和工具状态支持时，在证据不足、无法可靠生成语义时登记待办，不猜写。

其他MCP工具、CLI命令、参数和专项流程，以当前工具说明、Guide和 `--help` 返回内容为准，不在本文件中重复完整手册。

本区块只规定仓库接入、认知使用和收尾原则。`aoci_rules` 承载当前会话合同，Guide实时输出承载当前Plan的执行顺序与停点，工具Schema、Spec和Validator承载机器结构与判据；Prompt、Description、README和静态文档不能覆盖这些机器事实。

### 建立、生成和恢复认知

1. 每个新的 Agent Run 开始时，应先判断：

   - 本仓库是否已经存在可用的完整AOCI索引；
   - 当前上下文中是否已有与本仓库根、当前索引版本和当前AOCI服务相匹配，并且模型仍可可靠使用的完整仓库认知。

2. 仓库已经存在可用的完整索引，但当前Run没有可靠完整认知时，先调用 `aoci_rules`，再调用 `aoci_overview`。

   完整认知仍可靠时直接复用。局部不确定本身不要求机械重读系统全貌。

   本Run从已知Host上下文压缩恢复时（包括宿主注入的压缩摘要），必须把此前模型认知视为不可靠。压缩handoff不得保留或摘要正式Whole-Index，也不得保留或摘要任何Overview Header、Entry、Chunk、Challenge或Attestation正文；只能保留安全续接所需的receipt身份、未完成write或Recovery状态，以及立即重载指令。复制进handoff的Whole-Index语义或receipt不能证明恢复后模型的当前认知可靠。若当前上下文已无法可靠保留运行合同，先调用 `aoci_rules`。继续业务任务前，使用 `refresh_reasons=["context_compaction"]` 和新的 `refresh_event_id` 调用普通完整Whole-Index `aoci_overview`（不设置 `check_only` 或设为false）；不得使用 `check_only` 或认知probe。原样跟随每个 `next_cursor` 直到 `completed=true`，确认交付，并且只基于新交付正文提交一次Attestation。完成这次新的完整传输后，即使Attestation为partial或fail也消费该generation，并按既有合同继续source-bound任务，不再自动调用第二次Overview。

   AOCI可以针对 `context_compaction`、项目 `cognition_refresh_threshold` 下的机器 `semantic_threshold` 或主要 `phase_transition` 提供checkpoint与认知状态事实。只需要这些紧凑事实时使用 `check_only=true`；这些事实只向Agent提供建议，不替模型决定是否需要系统全貌。

   Agent显式调用普通 `aoci_overview`（未设置 `check_only` 或为false）时，只要能形成一致的CognitionSet，AOCI必须完整交付请求scope。不得因为已有receipt、阈值未达到或没有待处理刷新原因而抑制正文。正式认知Dirty或Stale时仍交付正文，但必须标记不可靠。存在未决恢复或无法形成一致snapshot时失败关闭，不返回混合正文。

   普通Overview返回 `continuation_required=true` 时，必须原样提交 `next_cursor` 并自动继续到 `completed=true`。不得询问用户、开始业务任务或给出阶段性系统结论。Host截断、缺块、重复、乱序、cursor失败、Index变化或`chunk_tokens`变化时停止本次认知链。Attestation完成前不得用Memory、源码、Spec、`aoci.txt`、历史会话、scope、search或Entry读取修补或补充Whole-Index认知。Challenge ordinal是正式Entry序列中的1-based位置；Header内容、注释、空行、Section/Overview/Chunk Marker、Receipt与Metadata均不计数，Chunk Receipt ordinal使用同一序列。Attestation必须原样回绑本次Challenge发布的当前`index_sha256`、`entry_sequence_sha256`与`entry_count`；旧Index、旧Entry序列、旧数量或旧Attestation均无效。完整链结束后只正式提交一次既有模型认知Attestation；同一响应只允许一次不改变语义答案的JSON Schema或字段格式修正。对象、Tag或F不匹配即失败且认知吸收不确定，不得语义重试或旁路补答。首次认知失败时还不得执行Root/Meta、Migration、全局布局或其他未重新绑定的系统级决策。上下文压缩刷新若传输完整、认知身份不变、治理对齐且没有Recovery或第三方冲突，即使Attestation为partial或fail也消耗该refresh generation，并继续原任务，不再自动重读Overview。`system_mastery_percent`只自评系统框架——架构、职责、强关系、稳定外部契约以及高熵安全和维护约束——不表示完整实现或运行实况知识；机器索引覆盖率必须分开。默认只向用户输出由本次真实覆盖率、Challenge、块数、Token和掌握度生成的规定成功或失败一句话。Host截断时提示用户把 `overview_delivery.chunk_tokens` 设置为更小的合法值后重新开始，不得自动修改。

   加法认知等级必须与严格证明字段分开解释。`delivery_verified`表示已加载Index且Host交付已确认，但完整认知验证仍未完成；应表达为“已加载且交付已验证”，不得描述为“没有认知”或“没有理解系统”。`cognition_verified`要求Attestation通过（Challenge至少80%的ordinal完全正确且对象身份至多失手一处），`cognition_governed`还要求治理对齐。通用完整读取失败句只用于真实交付故障。

   当Overview响应包含可选`cognition-state/v2`投影时，必须分别解释各维度。其Level止于`model_cognition_usable`；`strict_attestation_verified`、`governance_aligned`与`current_system_cognition_reliable`都是独立状态，绝不参与该Level。ordinal、对象身份、Tag或核心F不匹配可以导致严格Attestation失败，而模型认知仍然可用；不得仅凭这种不匹配就宣称模型没有理解系统。只有`current_system_cognition_reliable=true`允许无保留地声称当前完整系统认知可靠。投影缺失时继续使用上述Legacy解释。

   普通的只读审计、分析、检查、不修改代码或不提交、不push，不自动等于严格零写入，也不改变上述认知有效性判断。Codex Memory和历史Skill只能辅助恢复经验、用户偏好与调查方向，不能替代与当前仓库根、索引摘要、AOCI服务身份和认知范围匹配的当前认知收据；项目AGENTS和当前AOCI身份在AOCI状态上优先于历史Memory。

   只有用户明确禁止Ledger、元数据、`.aoci`运行资产及任何文件写入时，才按严格零写入处理。若必要的认知建立与该边界冲突，必须报告冲突并请求用户裁决或建议使用隔离副本，不得静默以Memory替代当前仓库认知。

3. 仓库没有可用的完整索引，或当前只有最小骨架、Header不完整、Entries未完成、必要Curation尚未裁决时，如果需要建立正式完整AOCI索引，先取得 `aoci_rules`，然后进入当前AOCI Guide。由Guide依据仓库真实状态决定下一阶段并完成必要安全步骤。

   `aoci_maintain` 不替代索引建立流程。

   不在本文件中自行重建或硬编码完整索引生成状态机。

4. 在长程任务中，模型负责保留当前认知收据并正确使用刷新门禁：

   - Host报告上下文压缩或模型已知系统全貌丢失时，执行上述强制 `context_compaction` 重载规则；AOCI不能自行推断Host事件；
   - 进入真正的主要阶段时声明 `phase_transition`，不得把函数、测试运行或小步骤当作阶段；
   - 在有用的稳定检查点通过 `check_only=true` 取得机器语义计数；
   - 除已知压缩的强制重载外，由Agent判断当前任务是否需要再次显式获取指定scope或完整Overview；
   - 在维护和对齐完成前，保留AOCI报告的Dirty或Stale可靠性状态。

### 任务收尾与认知维护

5. 纯只读问答、分析、版本核验，或没有产生受AOCI管理对象变化的任务，不需要调用维护工具。当前AOCI版本是任意`aoci_overview` check_only或`aoci_maintain`响应里的`cognition_receipt.mcp_service_version`；二进制路径是项目`.mcp.json`里的`command`，CLI不必在PATH上。

6. 发生受AOCI管理对象变化时，待其达到本次任务的最终稳定状态后，只调用一次 `aoci_maintain`。不要在每次中间修改后逐文件维护。

7. 若维护结果返回真实语义候选，Host 模型必须基于每个候选绑定的对象和必要证据，独立创作完整标签与F/R/A/S更新。通过 `aoci_update_entry` 一次提交当前机器签发批次的完整候选集合，同时原样保留每项 `source_sha256`、`candidate_id` 与对应domain批次身份。`max_entries`只限制单次请求和原子事务，不限制logical plan、Whole-Index或Managed Scope。`remaining`非零时，在当前批次成功Apply后重新调用Maintain并从新preimage继续；绝不能为满足transport上限缩减Index覆盖或自行截取返回批次。

   没有足够证据且当前布局支持 `aoci_report` 时，使用它而不猜测、套用模板或为消除待办而生成缺乏证据的认知。

8. 必须遵守工具返回的结构化状态和安全边界：

   - `repair_required`：只修复明确命中的候选，再重新提交当前机器签发的完整批次；
   - `stopped`：结束当前写入尝试并检查 `failed_step`、错误、正式写入证据与Recovery。auto模式下，已证明零写入则记录closure并重新Plan；完整Intent和可证明postimage则Resume；策略要求Rollback且preimage可证明则精确恢复后重新Plan。只有证据不足、第三方正式字节冲突、需要审批或外部动作，或命中其他真实安全边界时，才停止整个用户任务；
   - 冲突、审批、人工裁决、权限和安全信号不得忽略；
   - 已经对齐后不得重复维护或重复写入；`refresh_ready_for_overview` 是checkpoint事实，由Agent决定是否为下一阶段请求普通完整Overview。

   维护完成后如果又修改了任何受管理对象，之前的维护结果失效，应在新的最终稳定状态重新完成收尾。

9. 用户只限制业务文件范围，但没有明确禁止仓库托管资产时，AOCI托管资产可以在收尾阶段为保持认知一致而更新，并应在审计和提交中与业务文件区分。

   用户明确禁止修改 `aoci.txt`、`.aoci`、元数据或任何额外文件时，以用户限制为准，不得写入，并如实报告剩余不一致。

### 专项流程

初始化、完整索引生成、Header生成、Entries生成、数据库结构索引、Curation、人工评审和故障恢复，只按当前AOCI Guide或工具在对应阶段返回的指令、命令和安全停点执行。

不预加载、不猜测，也不自行重建这些专项流程。平台调用方式、请求格式、批次上限、审批规则、索引格式细节和恢复步骤由对应Guide、工具说明、模型Prompt和CLI帮助按需提供。
<!-- aoci:end -->
