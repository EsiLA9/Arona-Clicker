# Task：Goal Set 讨论到施工的文档协作体系

状态：done — 协议、模板、提示词、路由与可删除边界检查已完成

## 目标

建立可删除的最终目标集、稳定的阶段目标、滚动 Draft 与冻结施工 Task 之间的清晰关系，让 SolChat 同时保留长期终点和最近可执行阶段，本地 AI 负责源码事实核对与 Task 准入。

## 设计边界

- 保留 `docs/docs-828/` 作为当前机制事实源；Goal Set、Goal Card 和 Draft 均不声明已实现事实。
- Goal Set 可整组移除；正式 Draft、Task 和机制文档不能依赖它才能独立理解。
- 默认每个 Goal 对应一份滚动 Draft 和一个最终施工 Task；只有独立可验收、可复用的事实审计或责任边界变化才另立 Task。
- Patch Unit 和 Execution Receipt 继续使用既有施工协议；Codex Goal 只承载会话执行，不作为长期任务台账。
- 不迁移或批量改写已有计划文档，不触及游戏机制和代码。

## 当前事实与代码落点

- `docs/plan-work/00-index.md` 同时路由活跃 Task、待裁定 Draft 和冻结历史。
- `docs/docs-828/05-conventions/doc-maintenance.md` 规定新计划文档模板、独立验收的拆 Task 判据和裸名引用。
- `docs/ai/PROJECT-CONSTITUTION.md` 已规定施工 Unit 的 Read Set、白名单、预算与 Receipt。
- `scripts/check-docs.mjs` 检查 WikiLink、计划文件名唯一性、源码路径和 YAML 路由元信息。

## 施工切片

### P0：建立协作协议与模板

- 定义五层对象、状态流转、讨论/事实/施工准入与删除 Goal Set 的规则。
- 提供 Goal Set、Goal Card、Draft、Task 模板和 SolChat / 本地 AI 提示词。

### P1：接入现有路由与检查

- 更新 AGENTS、计划索引、文档维护、Read Set 路由与施工协议中的入口说明。
- 让文档检查器识别持久文档指向可删除 Goal Set 的违规链接。

## 测试与验收

- 新会话可从 `AGENTS.md` 找到完整工作流、模板与提示词。
- Goal Set 整组删除后，持久 Draft / Task / 机制文档不会留下对它的依赖。
- `npm run check:docs` 与 `git --no-pager diff --check` 通过。

## 当前核验（2026-09-25）

- 已核对现有文档纪律、Task/Draft 样本与文档检查器；未修改游戏源码。
- `npm run check:docs`：297 篇 Markdown，0 错误，通过。
- `node --check scripts/check-docs.mjs`、`node --check scripts/report-doc-context.mjs`：通过。
- 临时建立持久文档指向 Goal Set 文件的 WikiLink：`check:docs` 按 R6 拒绝；临时文件已移除。
- `git --no-pager diff --check`：通过；本次只改协作文档、入口和文档检查脚本。
- AOCI checkpoint 返回 `refresh_deferred_until_stable`，仓库仍有其他任务的未稳定改动；本轮不对混合工作区运行 Maintain，待工作区稳定后统一维护受影响 Entry。

## 剩余工作

- 本 Task 无剩余施工。具体玩法 Goal Set 在提出新需求时建立；旧 Draft / Task 不批量迁移。

## 相关路由

- [[docs/plan-work/00-index]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/task-read-set-routing]]
