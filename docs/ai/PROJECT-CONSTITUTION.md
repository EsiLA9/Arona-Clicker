# docs/ai/PROJECT-CONSTITUTION — AI 施工纪律

> 本文定义受范围约束的施工 Unit 如何工作，**从属于 [[AGENTS.md]]**，不是第二事实源。
> 架构硬约束、开发命令、禁改清单与 Schema 同步协议一律以 `AGENTS.md`、[[docs/docs-829/05-conventions/architecture-discipline]] 和 [[docs/docs-829/05-conventions/schema-sync]] 为权威，本文**不复述**；需要时按路径读取原文。docs-828 保留为历史快照，不作为当前规则来源。
> 本文只补充 `AGENTS.md` 未覆盖的**Unit 施工纪律**。两者冲突时，以 `AGENTS.md` 为准；GALHCG 的项目发现与地图维护按 [[docs/ai/galhcg-project-map]]。

## 适用与权威

| 信息 | 权威来源 | 施工中的用法 |
| --- | --- | --- |
| 架构 / 机制 / 命令 / 禁改清单 | `AGENTS.md`、[[docs/docs-829/00-INDEX]] 及其路由到的当前页面 | 直接读原文；Unit 只给链接，不复制正文 |
| 当前代码事实 | 源码与测试 | 写入 `Confirmed Facts` 时必须带路径与符号 |
| 已裁定的未来设计 | 当前 Draft / ADR / Task 的明确裁定 | 仅在需要时进入 `Constraints`，附链接；归档状态不表示实现 |
| 本次实际进展 | Patch、测试结果、Receipt | 仅对当前 Unit 有效，不自动升级为项目规则 |

摘要（含本文、Architecture Card、Unit 的 `Confirmed Facts`）与源码冲突时，以源码与测试为准并停止施工上报，不得自行推导替代设计。

## 施工纪律

- **C1 产物位置**：协议、提示词和模板位于 `docs/ai/`；Goal Set 位于 `docs/plan-work/goalsets/`，活动 Draft / Task 位于 `docs/plan-work/` 根目录。Patch Unit 与 Receipt 默认内联于所属活动 Task；单个 Task 超过 3 个 Unit 时才拆出 `docs/plan-work/<task-id>-units/<unit-id>.md` 与同目录 `receipts/`。Task 完成或冻结后，连同拆出的文件一起移入 `archive/`。（详见 [[docs/ai/goal-workflow]]）
- **C2 Unit 预算**：一个 Unit 通常限制在 3–5 个文件、约 300–500 行净改动，并可独立验证。超出时先拆分或交回上游，不以扩大上下文代替拆分。
- **C3 Allowed Files 白名单**：Unit 列出的 `Allowed Files` 是修改白名单。需要修改白名单外文件时，施工代理停止并上报；需要新增路径时先由上游更新 Unit。
- **C4 Completion Criteria 是最大边界**：未列入的工作不顺手完成；确有必要时先调整 Task / Unit 范围。
- **C5 Read Set 最小化且主动发现**：从 Read Set 开始核对。按 [[docs/ai/galhcg-project-map]] 主动搜索未知领域、新增内容与直接受影响关系；GALHCG 导航不等于默认读取整个源码目录。需要扩大文件阅读范围时按 §停止条件 处理。
- **C6 Confirmed Facts 只写已核实事实**：来自实际源码、测试或当前权威文档，并标注路径与符号。地图命中与规划建议是线索，不单独构成事实。
- **C7 Receipt 纪律**：每个完成或中断的 Unit 都写 Receipt，记录实际修改、未完成内容、验证结果、问题与需上游确认项；Receipt 不是完成声明。
- **C8 控制辅助设施**：只在真实 Unit 证明有重复需求时增加脚本或复杂自动化；不预建百科、不做无边界全仓扫描。此限制不取消 GALHCG 协议要求的定向主动发现与变更维护。
- **C9 协议可发现**：新会话应能从 `AGENTS.md` 到达本目录；协议增删或改位时同步更新 [[docs/ai/00-index]] 与入口路由。

## 角色与入口

- **施工代理**：在一个 Patch Unit 内实施、运行要求的验证并填写 Receipt；按 Unit 的 Read Set 和 Allowed Files 工作。
- **高层 AI**：负责跨模块调查、裁定、拆分 Unit、指定 `Read Set` 与 `Allowed Files`，并审查 Patch 与 Receipt。
- **人类**：决定优先级、批准架构级裁定，处理产品选择与超出范围的问题。
- **SolChat**：提供完整终点、阶段建议与待核对问题；建议须在 Draft 中经过本项目裁定，不直接成为源码事实或施工授权。
- 施工 Unit 适用于需要明确修改白名单与验收边界的施工任务。小型只读审查或窄范围文档修订可按 `AGENTS.md` 直接执行；不应为遵守流程而制造 Task/Unit。

## 停止条件（必须停止并上交）

出现下列任一条，施工代理停止当前 Unit，输出已确认事实、当前位置与需上游答复的问题，等待范围调整或明确答复。阈值由 Unit 写入；Unit 未写明时使用默认值：

1. 需要修改 `Allowed Files` 之外的文件；
2. 需要新增文件，或预计净改动超出 Unit 预算（默认 3–5 个文件 / 300–500 行）；
3. 为定位修改点需要读取 Read Set 之外的文件，且超出默认 2 个（Read Set 内文件的重读不计）；
4. 源码 / 测试事实与 Unit 的 `Confirmed Facts`、Task 文档或摘要冲突；
5. 实现需要新增机制、改变架构边界、在未裁定方案中选型，或扩大 `Completion Criteria`；
6. 必需验证无法执行、失败，或结果无法解释。

停止不是失败。正确停止优于带着假设继续施工；补足事实、缩小或拆分 Unit、建立 ADR 属于任务负责人和高层 AI 的职责，不由施工代理自行定案。

## 使用方式

1. 先读本文与 Unit 指定的 `Read Set`；按 GALHCG 协议主动发现未知/新内容和受影响关系，不先读无关目录。
2. 开工前复述 Unit 的 Goal、Allowed Files、Explicit Non-goals 与 Stop Conditions。
3. 模板见 `docs/ai/templates/patch-unit.md` 与 `docs/ai/templates/execution-receipt.md`。

## 验证口径

| Unit 类型 | 最小证据 |
| --- | --- |
| 纯文档（`docs/`、`AGENTS.md`） | 链接可达、`git --no-pager diff --check` 通过；不要求运行游戏全量测试 |
| 代码 | Unit 指定的定向测试 + `npx tsc --noEmit`；机制改动按 `AGENTS.md` 架构纪律执行 |
| 含脚本 | 该脚本的定向测试 + 对应技术栈类型检查 |

- Receipt 必须记录实际执行的命令与结果；未执行写“未执行”并说明原因。
- 验证无法执行时按停止条件第 6 条上报，不得省略或以“应该通过”替代。

## 变更规则

- 仅当 `AGENTS.md` 或对应权威规范变化时才同步本文；不得用本文代替 ADR 或 Task。
- 新增本文件条目须对应至少一个在真实 Unit 中已观察到的失败模式（见 C8）。
- 本文不记录具体业务 Task 的临时设计、文件列表或未裁定方案。

## 相关

[[AGENTS.md]] · [[docs/ai/00-index]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/plan-work/00-index]]
