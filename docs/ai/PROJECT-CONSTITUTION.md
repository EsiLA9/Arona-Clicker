# docs/ai/PROJECT-CONSTITUTION — AI 施工纪律（从属索引）

> 本文是 Luna 施工时携带的最小纪律清单，**从属于 [AGENTS.md]**，不是第二事实源。
> 架构硬约束（8 条纪律）、开发命令、禁改清单与 Schema 同步协议一律以 `AGENTS.md` 与 [[docs/docs-828/05-conventions/architecture-discipline]] 为权威，本文**不复述**；需要时按路径读取原文。
> 本文只补充 `AGENTS.md` 未覆盖的**施工纪律**。两者冲突时，以 `AGENTS.md` 为准。

## 适用与权威

| 信息 | 权威来源 | 施工中的用法 |
| --- | --- | --- |
| 架构 / 机制 / 命令 / 禁改清单 | `AGENTS.md`、`docs/docs-828/` | 直接读原文；Unit 只给链接，不复制正文 |
| 当前代码事实 | 源码与测试 | 写入 `Confirmed Facts` 时必须带路径与符号 |
| 已裁定的未来设计 | `docs/plan-work/active/adr-*` 或对应 Task | 仅在需要时进入 `Constraints`，附链接 |
| 本次实际进展 | Patch、测试结果、Receipt | 仅对当前 Unit 有效，不自动升级为项目规则 |

摘要（含本文、Architecture Card、Unit 的 `Confirmed Facts`）与源码冲突时，以源码与测试为准并停止施工上报，不得自行推导替代设计。

## 施工纪律

- **C1 产物位置**：协议与模板位于 `docs/ai/`；Patch Unit 与 Execution Receipt 默认内联在所属 Task 文档（`docs/plan-work/active/task-*.md`）的对应小节，不另建与 `docs/plan-work/` 平行的计划目录。仅当单个 Task 的 Unit 超过 3 个时，才拆出 `docs/plan-work/active/<task-id>-units/<unit-id>.md` 与同目录 `receipts/`，Task 文档只保留链接。（依据：Task-0000 §2.1）
- **C2 Unit 预算**：一个 Unit 限制在 3–5 个文件、约 300–500 行净改动，可独立验证。超出预算时先拆分或交回高层 AI，不得靠追加上下文硬塞。（依据：Task-0000 §2.4）
- **C3 Allowed Files 白名单**：Unit 列出的 `Allowed Files` 是修改白名单。需要改白名单外文件时，Luna 必须停止并上交，不得“顺手”修改。（依据：Task-0000 §2.4）
- **C4 Completion Criteria 是最大边界**：它是当前 Unit 允许的最大施工范围，不是最低完成要求。未列入的工作不得顺手完成；确有必要时停止并申请扩大范围。（依据：Task-0000 §2.4）
- **C5 Read Set 最小化**：只读 Unit 指定的 `Read Set`。不要因“不确定”而全仓库漫游；确实需要 Read Set 之外的信息时按 §停止条件 处理。（依据：Task-0000 §2.4）
- **C6 Confirmed Facts 只写已核实事实**：来自源码、测试或权威文档，并标注路径与符号。推测、待验证结论与个人判断必须写成问题，不得伪装成事实。（依据：Task-0000 §1.3、§2.4）
- **C7 Receipt 纪律**：每个完成或中断的 Unit 都写 Execution Receipt，只记录实际修改、未完成内容、测试结果、问题与需上游确认项。Receipt 不是完成声明，不能替代真实测试结果。（依据：Task-0000 §2.5、§7）
- **C8 不预设知识库与自动化**：只有当某个失败模式在多次 Unit 中重复出现时，才新增 Architecture Card、辅助脚本或 Constitution 条目；不为“可能发生”的问题预建百科，也不引入隐式全仓库扫描。（依据：Task-0000 §5 P2/P3、§6）
- **C9 协议可发现**：新会话应能仅凭 `AGENTS.md` 路由到达 `docs/ai/`；修改协议位置时同步更新 `AGENTS.md` 路由表与 [[docs/docs-828/05-conventions/doc-maintenance]] 分区表。（依据：Task-0000 §5 P0、§6）

## 角色与入口

- **Luna**：执行单个 Patch Unit 的本地施工代理，只读 Unit 指定的 `Read Set`。
- **高层 AI**：负责跨模块调查、裁定、拆分 Unit、指定 `Read Set` 与 `Allowed Files`，并审查 Patch 与 Receipt。
- **人类**：决定优先级、批准架构级裁定，处理产品选择与超出范围的问题。
- 以上只是本文档内的角色标签；Unit 是唯一施工入口，没有 Unit 不得开工，Unit 未写明的阈值使用本文默认值。

## 停止条件（必须停止并上交）

出现下列任一条，Luna 停止当前 Unit，输出已确认事实、当前位置与需上游答复的问题，等待新 Unit 或明确答复。阈值由 Unit 写入；Unit 未写明时使用默认值：

1. 需要修改 `Allowed Files` 之外的文件；
2. 需要新增文件，或预计净改动超出 Unit 预算（默认 3–5 个文件 / 300–500 行）；
3. 为定位修改点需要读取 Read Set 之外的文件，且超出默认 2 个（Read Set 内文件的重读不计）；
4. 源码 / 测试事实与 Unit 的 `Confirmed Facts`、Task 文档或摘要冲突；
5. 实现需要新增机制、改变架构边界、在未裁定方案中选型，或扩大 `Completion Criteria`；
6. 必需验证无法执行、失败，或结果无法解释。

停止不是失败。正确停止优于带着假设继续施工；补足事实、缩小或拆分 Unit、建立 ADR 属于高层 AI 的职责，不由 Luna 自行定案。

## 使用方式

1. 先读本文与 Unit 指定的 `Read Set`，不要先读全仓库。
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

[[AGENTS.md]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/plan-work/active/task-0000-ai-context-infrastructure]] · [[docs/plan-work/00-index]]
