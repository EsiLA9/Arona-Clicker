# Task/Roadmap：AOCI-CODE 接入 Codex 与仓库认知索引

状态：done — ✅ 已完成；严格认知挑战未通过，保留受源码证据约束的工程模式

## 目标

完成 AOCI-CODE 在 ACProgram 项目中的 Codex 接入收尾：让当前 Codex 会话使用项目级 AOCI MCP，建立完整仓库认知索引，验证认知资产与受管理源码回到 `aligned`，并取得可访问的 AOCI 面板链接。

## 设计边界

- 本任务只负责 AOCI-CODE、Codex MCP、仓库认知资产和本任务文档。
- 不修改现有业务源码、测试或既有未提交改动；不借此任务推进游戏机制或 UI 需求。
- 不建立数据库认知索引；当前任务没有数据库范围授权。
- AOCI 的索引阶段、批次边界、候选结构、恢复与审批规则以当前 MCP `aoci_rules`、实时 Guide 和工具 Schema 为准，不在本任务中重建状态机。
- AOCI 托管资产可以随收尾更新；完成后 Task 文档按文档维护规范归档。

## 当前事实与代码落点

- AOCI-CODE release：`v0.1.0-rc12`，Windows AMD64；稳定二进制位于 `C:\Users\15229\Tools\aoci-code\v0.1.0-rc12\aoci.exe`。
- release 压缩包 SHA-256 已与官方 `SHA256SUMS` 核对一致；二进制报告 commit `e48115c2560ef3b8e99488c7ce147aa20afc8584`。
- 项目初始化参数为 `--locale zh-CN --agent codex`；项目级配置位于 `.codex/config.toml`，使用上述绝对二进制路径和当前仓库根目录。
- AOCI 初始化生成或更新：`aoci.txt`、`aoci.meta.txt`、`aoci.code.txt`、`.aoci/`、`.gitattributes`，并在根 `AGENTS.md` 中追加受管理的 `aoci` 区块。
- `scan` 已建立 879 个文件的 Managed Baseline；最终 Code Volume 已完成 701 条 Entry。
- Codex 重启后已加载 AOCI MCP 工具；本 Run 已读取当前 `aoci_rules`，并完整接收 18 个 Overview chunk（701 个 Entry、约 138230 tokens、结束标记已确认）。
- 最终 Code Volume 为 701 个对象 / 701 个 Entry；`missing`、`orphan`、`stale`、`unbaselined`、`observed_new`、`observed_changed`、`observed_removed` 均为空，治理状态为 `aligned`。
- 归档前最近一次完整 Whole-Index 身份：`index_sha256=738e62ca7fb50a295a2eb6ca1145b4e75d019b7cbf873e8edec57650013b372a`；正文 `body_sha256=c00862e585dce4ee4eb1d1605613dcaddbbfb0885854f86f31ce77c629fe8a5f`，`body_utf8_bytes=415759`。
- 归档后最终 Verify 身份：Code Volume `sha256=82f09846bb6e6039caf4fdd899399a8d036f7ee868ed03a0e9844bb95eb98836`，`composite_identity=8c5659f7542b052b06a66be7ee8727bb4609a75091fee204870173a47259865a`，Whole-Index 预算约 138289 tokens。
- Host 交付确认已通过，`cognition_level=delivery_verified`；本次严格 Challenge Attestation 未通过（`challenge_passed=0/10`），因此后续仍遵守 source-bound 工程约束，不无保留声称当前完整系统认知可靠。
- 既有业务工作区存在用户未提交改动；本任务不得清理、回退或覆盖这些改动。

## 施工切片

### P0：准备与初始化（已完成）

- [x] 准备稳定的 AOCI-CODE Windows AMD64 二进制并完成基础校验。
- [x] 初始化项目级 Codex MCP 配置、AOCI Volume 骨架、AGENTS 规则区块与 Managed Baseline。
- [x] 扫描项目并确认认知资产未被错误加入 Git ignore。

### P1：宿主重载与运行合同（已完成）

- [x] 重启 Codex，使项目级 `.codex/config.toml` 生效。
- [x] 读取当前会话 `aoci_rules`。
- [x] 完整读取当前 Whole-Index；分 18 个 chunk 原样跟随 cursor 至 `completed=true`，并完成 Host delivery confirmation。

### P2：首轮完整认知索引（已完成）

- [x] 按当前 Guide 进入 Fresh Bootstrap / Cognition Onboarding 流程。
- [x] 逐批读取 Guide 指定的源码与必要证据，生成完整 Code 认知候选；未执行数据库索引。
- [x] 对每个机器签发的完整候选批次调用 `aoci_update_entry`，直至 `remaining=0`。
- [x] 按工具返回处理 parser/tag 修复与认知优化候选；未绕过安全信号。

### P3：对齐与交付（已完成）

- [x] 运行 AOCI Verify、Check 和 Guide；三者均通过，未发现 Missing / Stale / Unbaselined / Orphan / Scope / Recovery 阻断，治理状态为 `aligned`。
- [x] 启动 AOCI 只读面板并取得链接：<http://127.0.0.1:55883/>。
- [x] 更新本 Task 的当前核验、Receipt 和剩余工作；随后将文档移入 `docs/plan-work/archive/` 并标记 `done`。

## 测试与验收

- 接入验收：`aoci --version`、官方 release SHA-256 校验、`aoci doctor`、`codex mcp list`。
- 基线验收：`aoci scan` 成功建立 879 文件 Baseline。
- 索引验收：AOCI MCP 批次全部成功处理；归档前 `aoci_overview` 已交付完整索引（701/701 Entry，18 个 chunk，结束标记确认），归档后 Code Volume 仍为 701/701；未以空骨架或局部 Entry 代替完整索引。
- 对齐验收：`aoci verify` 与 `aoci check` 通过，Guide 不再要求继续作者化或恢复；治理状态为 `aligned`。
- 面板验收：面板命令返回 `http://127.0.0.1:55883/`，页面对应本项目根目录与当前 AOCI 服务身份。
- 文档验收：`npm run check:docs` 与 `git --no-pager diff --check` 通过。

## 当前核验（2026-09-17，最终）

- 已执行：AOCI release 基础 SHA-256 校验，结果为 `verified`。
- 已执行：`aoci --version`，确认 `0.1.0-rc12` 与 release commit。
- 已执行：`aoci init --repo <project> --locale zh-CN --agent codex`，成功。
- 已执行：`aoci scan`，结果为“基线已建立：879 个文件”。
- 已执行：`aoci doctor`，仓库、AGENTS 区块和 Codex MCP 配置均通过。
- 已执行：`aoci verify`，Volumes v1 候选结构有效。
- 已执行：重启后的 `aoci_rules` 与完整 `aoci_overview`；MCP 服务版本为 `0.1.0-rc12`，Whole-Index 交付已验证。
- 已执行：`codex mcp list`，项目级 `aoci` server 显示为 enabled。
- 已执行：按正式 Scope Change 流程将四个压缩包与 `src/data/ba_triangles.png` 设为 `exclude`，将 `src/data/Hoshino.png` 设为 `observe`；Apply 已获批准并生效。
- 已执行：完成 701 个 Code Entry 的全量作者化与正式写入，包含工具要求的 parser/tag 修复和认知优化批次；最终 `remaining=0`、`pending_transactions=0`、`recovery_pending=false`。
- 已执行：最终 Verify / Check / Guide 结果分别为 `aligned`、`ok=true`、`complete=true`；数据库卷保持未配置且未执行索引，网络访问为 false。
- 已执行：Host delivery confirmation 通过；严格 Challenge Attestation 未通过（`model_attestation=fail`），保留“delivery verified / source-bound continuation”状态。
- 已执行：AOCI 面板已启动并返回 `http://127.0.0.1:55883/`。
- 已执行：`npm run check:docs`（220 篇 Markdown，0 errors）、`git diff --check`、`npm run check:architecture`、`npx tsc --noEmit` 均通过。
- 已执行：`npm test` 全量通过（168 个测试文件、1560 个测试）。

## 已获裁决与 Scope 变更

- AOCI 官方 Managed Scope 规则将生成物、测试样本或低价值对象的降级处理定义为 `observe` / `exclude` 的普通 Scope Change，并要求一次审批；该审批属于索引覆盖范围裁决，不是技术性自动修复。
- 用户已确认：四个压缩包与 `src/data/ba_triangles.png` 设为 `exclude`，`src/data/Hoshino.png` 设为 `observe`；文件继续保留在工作区。
- 6 条 Scope 规则已按结构化决策理由写入并通过正式 Preview / 真实 TTY Approval / Apply 流程生效；6 个对象的源文件均保留，Scope 变更通过 interactive digest confirmation 完成并写入审计 Ledger。
- Scope Apply 已返回 `status=applied`，随后按新的治理 preimage 完成 Code Entry 批次；最终 Verify / Check / Guide 已证明 `aligned`，并已启动面板。

## 剩余工作

本任务没有剩余的工程施工项。AOCI 认知层已对齐，Code Volume 已完成，数据库索引未执行且不在授权范围内。严格 Challenge Attestation 未通过是本次模型证明状态，不构成对索引资产的修改请求；后续涉及本仓库的任务仍需遵守 AOCI 的 source-bound 读取和维护合同。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[task-0064-project-documentation-exit-governance]]
- AOCI-CODE 官方仓库：https://github.com/aoci-spec/aoci-code
