# Task-0150：AOCI 治理对齐与运行参数核验

状态：done — 治理对齐、运行版本核验与 8000-token Overview 交付检查完成（2026-09-25）

## Goal

处理 2026-09-25 AOCI 只读检查发现的索引治理漂移、Overview 分块参数和运行时版本核验问题；遵循当前 MCP 工具与实时 Guide，将 AOCI 收敛到可证明的 `aligned`，并记录实际核验结果。

## Confirmed Facts

- 项目使用 Cognition Volumes v1，Root 声明 Meta 与 Code Volume；当前没有 Database Volume。
- AOCI MCP 工具已连接，检查报告服务版本为 `0.1.0-rc12`；项目根目录没有 `.mcp.json`，AOCI Host 绑定由项目级 `.codex/config.toml` 提供。
- 只读 checkpoint（2026-09-25）报告 `semantic_change_count=26`、`semantic_change_threshold=30`、`semantic_stale=21`、`actionable_missing=5`、`unbaselined=5`、`orphan=0`、`governance_blocker_count=31`、`stable_checkpoint=false`、`governance_aligned=false`。
- Whole-Index 为 782 条、约 153,099 tokens；预算模式 `enforce`，状态 `healthy`，无预算违规。
- 项目刷新阈值为 30；`automation.mode=auto`、`hook_strict=false`、`ledger_enabled=true`、`ai.enabled=false`。
- 检查时 `overview_delivery.chunk_tokens=4000`，处于有效范围下限；官方 AOCI-CODE 文档列出范围 4000–24000、默认值 8000。此次 782 条索引以 4000 分块时需要 40 块。
- 官方仓库当前发布说明标示 `v0.1.0-rc14`；已确认其含空格路径修复与本仓路径相关，已完成 Basic 包校验并决定升级。

## Execution Record（2026-09-25）

- 当前 checkpoint 更新为 `semantic_change_count=27`、`actionable_missing=6`、`semantic_stale=21`、`unbaselined=6`、`governance_blocker_count=33`；`stable_checkpoint=false`，`refresh_deferred_until_stable`，尚不可安全进入索引写入阶段。
- 实时 Guide 返回 `stage=authoring_required`、`executable_targets=33`、当前 Code 作者化批次总目标 27（20 项 + 后续 7 项），`pending_transactions=0`、`recovery_pending=false`、`third_party_conflict=false`，Managed Scope 本身 aligned。Guide 的批次入口与 checkpoint 的“等待稳定”同时记录；执行前必须重新检查稳定性，并依工具实时状态/安全合同处理。
- `aoci doctor` 检查索引 782 条、0 解析警告，AOCI MCP/Codex 接入可用，离线确定性模式，没有源码外发；诊断完成且检查通过。
- 4 个当前 AOCI MCP 进程均使用 `C:\Users\15229\Tools\aoci-code\v0.1.0-rc12\aoci.exe --repo C:/Users/15229/Documents/Obsidian Vault/1-项目/ACProgram mcp`。命令行证实服务进程的绝对路径、版本目录和仓库绑定；`--version` 为 `0.1.0-rc12`、commit `e48115c2560ef3b8e99488c7ce147aa20afc8584`、构建时间 `2026-09-14T17:03:09Z`。二进制 SHA-256：`A84BC216C35C919C357B3D508B61A6DC9E5EC85D98B8D3C4465DBEBC2E2D2D15`。
- 当前仓库祖先路径含空格（`Obsidian Vault`）。官方 `v0.1.0-rc14` 发布说明明确包含对含空格目录/仓库根路径解析的修复，并要求涉及此类路径的所有主机都使用 rc14 或更新版本。因此将 rc12 视为写入前需解决的兼容风险；先按官方安装 / 升级流程验证新包，再切换并确认所有活跃宿主加载新版本。
- 机器未安装 `gh`、`cosign` 或 `sha256sum`；PowerShell `Get-FileHash` 可执行官方 Basic checksum 验证，但 Recommended publisher-signature 验证工具尚不可用。升级前选择并记录实际可完成的官方验证等级。
- 官方 Windows AMD64 rc14 包已下载到版本隔离目录并按官方 `SHA256SUMS` 完成 Basic checksum 验证；期望值与实测值均为 `2c40d1dfc76e50d27a1db9b70cbf0c1c5aa78f4a51a4983a9987e4228bb11025`。rc14 二进制报告 commit `92c78bc48a3e431ff8ae67fabb05270cc7129fe7`，版本为 `0.1.0-rc14`。
- rc14 在带空格的 disposable repository 中完成初始化、scan 与 doctor；rc14 对当前真实仓库执行 doctor 也通过，解析 782 条、0 警告。包校验达到官方 Basic 级；由于本机没有 Cosign，发布者签名与完整 Supply-chain 验证未完成。
- 项目级 `.codex/config.toml` 已找到实际 AOCI Host 绑定，当前 `command` 指向 rc12；该项列入本任务允许的机器绑定配置修改范围。所有已运行的 MCP 子进程仍持有 rc12，Host 配置修改后需刷新 / 重启宿主并核实 `serverInfo.version` 与进程路径。
- `.codex/config.toml` 的 AOCI 命令已更新为 `C:/Users/15229/Tools/aoci-code/v0.1.0-rc14/aoci.exe`。配置已经落盘；Codex 尚未重载项目 MCP 配置，当前服务仍报告 rc12，所以 `chunk_tokens=8000` 的实际分块、Overview 完整交付和后续治理流程尚待宿主重启并通过稳定检查点后继续。
- 用校验后的 rc14 CLI 对本仓再次读取实时 Guide，结果仍为 `authoring_required`、33 个目标、Code 作者化 27 项（20+7）；`pending_transactions=0`、`recovery_pending=false`、`third_party_conflict=false`、Managed Scope aligned。没有运行写入命令。最新宿主 MCP 与 4 个实际进程仍为 rc12；checkpoint 仍是 `refresh_deferred_until_stable`、`stable_checkpoint=false`。

## Scope

1. 在项目工作达到稳定检查点后，读取实时 Guide，按无参数 `aoci_maintain` 的结果处理完整候选批次、修复或停止状态；不得手工编辑 Baseline、缩小 Managed Scope 或跳过 CAS / Recovery 规则。
2. 每个完整 Code 候选批次按工具签发身份提交；若仍有剩余，基于新 preimage 继续领取和提交。
3. 通过 Verify、Check 与 Guide 证明 stale、missing、unbaselined、orphan、scope 债务和 Recovery 全部清零并达到 `aligned`。
4. 核实 MCP 进程的实际可执行路径、启动参数、服务身份与安装包校验依据；评估从 `rc12` 升级至官方受信任版本的必要性，并记录决定与证据。
5. 将 Overview 分块配置试调至官方默认值 8000，核验新分块数量、完整 cursor 链、交付确认和 Challenge Attestation；若宿主仍截断，按官方允许范围调整并重新核验。

## Parameter Trial

已获授权将 `.aoci/config.json` 的 `overview_delivery.chunk_tokens` 从 4000 调整为 8000。该调整只改变 Overview 交付分块大小，不改变索引内容、Managed Scope、刷新阈值或认知预算。完成本 Task 前需记录实际生效配置和完整交付表现；若配置不生效或宿主截断，按实时工具状态及官方 Guide 决定下一步。

## Read Set

- `AGENTS.md`
- `docs/docs-828/00-INDEX.md`
- `docs/docs-828/05-conventions/doc-maintenance.md`
- `.aoci/config.json`
- AOCI MCP 实时 `aoci_rules`、`aoci_overview(check_only=true)`、实时 Guide，以及本机 AOCI 安装 / Host 配置证据

## Allowed Files

- `docs/plan-work/task-0150-aoci-governance-and-runtime-alignment.md`
- `docs/plan-work/00-index.md`
- `.aoci/config.json`（仅 `overview_delivery.chunk_tokens`）
- `.codex/config.toml`（仅 AOCI `mcp_servers.aoci.command` 绝对路径）
- `C:\Users\15229\Tools\aoci-code\v0.1.0-rc14\`（仅用于与 rc12 并存的已验证二进制安装）
- 后续实时 Guide 明确要求的 AOCI 托管资产；按其安全边界执行

## Explicit Non-goals

- 不在工作区仍有未完成变更时运行 Maintain。
- 不重建索引、不改变 Root / Meta / Volume 布局、不修改 Managed Scope 或 Baseline。
- 不启用 Database Volume，不打开 Endpoint AI，不改变 `automation.mode`、审批策略或项目其他预算。
- 不仅凭 GitHub 最新版本号推断本机二进制来源，也不绕过官方包校验流程升级。

## Completion Criteria

- 当前 AOCI 治理检查达到 `aligned`；Verify、Check 与实时 Guide 的终态证据已记录。
- MCP 服务版本、二进制来源 / 路径、Host 启动绑定及版本决定已核实并记录。
- Overview 分块参数在 8000 或有证据支持的替代值生效；完整交付和认知校验结果已记录，不能把部分交付描述成通过。
- 本 Task 完成记录包含实际命令 / 工具、机器状态、剩余限制；随后归档并更新 `00-index.md`。

## References

- [AOCI-CODE 官方仓库与运行说明](https://github.com/aoci-spec/aoci-code)
- [AOCI-CODE 发布页](https://github.com/aoci-spec/aoci-code/releases)
- [官方安装与制品校验说明](https://github.com/aoci-spec/aoci-code/blob/v0.1.0-rc14/docs/install.md)
- [官方升级说明](https://github.com/aoci-spec/aoci-code/blob/v0.1.0-rc14/docs/upgrading.md)
- [[docs/plan-work/00-index]]
- [[docs/docs-828/05-conventions/doc-maintenance]]

## 最终核验（2026-09-25）

- 版本与绑定：Codex 重启后 MCP `serverInfo.version=0.1.0-rc14`；当前 MCP 回执、项目 `.codex/config.toml` 命令路径与已校验二进制目录一致。rc14 Basic SHA-256 校验通过；本机无 Cosign，发布者签名校验未完成。
- 分块参数：`.aoci/config.json` 的 `overview_delivery.chunk_tokens=8000` 生效；完整索引 782 Entries、约 153,099 tokens，由 20/20 个连续块交付，body 为 460,366 UTF-8 bytes、SHA-256 `7f88e5ef5f92b6c240a479d5494850b28c46ab6d44ceaf6f1e2310b1036482f7`，Host 完整交付确认成功。
- 认知挑战：本次 Challenge Attestation 返回 `fail`（0/10），状态为 `delivery_verified`、认知吸收 uncertain；未重试语义答案，不声称完整系统认知可靠。交付验证与认知挑战结果分开记录。
- AOCI 治理：两批完整 Code 作者化批次分别应用 20 项与 7 项；机器对 InitService R 超长给出修复 finding，按要求仅压缩该 R 后整批通过。最终 `verify --json` 与 `check --json` 均为 aligned、无 findings；实时 Guide 为 `stage=aligned`、`complete=true`、`next_action=none`。Entry 数 788；缺失、过期、未基线、孤儿均为 0，Recovery 与第三方冲突均为 false，Managed Scope aligned，预算 healthy。
- 限制：当前无 Database Volume；本任务没有配置数据库源，因此数据库认知为 not applicable。官方发布者签名验证仍未完成。

## 归档结果

- Task 已完成并移入 `archive/`；`00-index.md` 已同步。
- 归档与索引更新改变受管理对象后，已按新 preimage 再维护 `00-index.md` 与本 Task 的完整候选批次；随后再次执行 Verify、Aggregate Check 和 Guide，结果仍为 `aligned`、无 findings，Guide 为 `complete=true`、`next_action=none`。
