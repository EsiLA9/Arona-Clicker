# Task：AI Read Set 按任务收敛

状态：closing — 路由已完成，待 AOCI 治理稳定后收尾

## 目标

让项目 AI 引导从固定领域包改为按具体子题选择最小 Read Set，避免简单任务自动读取无关机制文档。

## 设计边界

- 只修改项目内的 AI 路由、上下文包和导航卡，不改 AOCI 服务合同、托管区块或 Managed Scope。
- `AGENTS.md` 与 `docs/docs-828/00-INDEX.md` 继续作为入口；机制事实仍以源码、测试和对应 `docs/docs-828/` 正文为准。
- AOCI 若按当前服务合同要求完整 Overview，仍照合同执行；项目 Read Set 预算只约束后续可控的任务材料。

## 当前事实与代码落点

- `docs/ai/task-read-set-routing.md` 要求每项任务都读 `current-context-card`，并重复列出各领域上下文包。
- 生产、角色、UI、世界线四个上下文包分别把多个子题文档列为统一 Required Read Set。
- 当前 AOCI Overview 报告 782 条 Entry、约 153099 tokens、40 块；此成本不能靠项目路由文件消除。

## 施工切片

- [x] 将通用启动顺序改为入口路由 + 按需架构导航卡。
- [x] 将领域包改为按子题选择，并消除总路由与领域包的重复清单。
- [x] 明确任务预算与 AOCI 合同读取成本的边界。
- [x] 核验文档链接和本任务 diff。
- [ ] 待共享工作区进入稳定状态后完成 AOCI 对齐，再归档本 Task。

## 测试与验收

- `npm run check:docs`
- `git --no-pager diff --check`
- 人工核对四个领域包覆盖原有任务类型、必要规范及验证入口。

## 当前核验（2026-09-25）

- `npm run check:docs`：通过，271 篇 Markdown，0 错误。
- 本任务文件范围的 `git --no-pager diff --check`：通过。全仓检查仅命中现有 `tests/engine/trigger-system.test.ts` 末尾空行，与本任务无关。
- `task-read-set-routing.md` 从约 4751 字符收敛到约 2447 字符；四个领域包均保留目标源码、测试与验证入口。
- AOCI `check_only` 返回 `refresh_deferred_until_stable`：当前共享工作区有 8 个语义变化与 9 个治理阻断；按服务提示暂不维护索引。

## 剩余工作

待共享工作区稳定后按 AOCI Guide 完成治理对齐，再归档并更新 `docs/plan-work/00-index.md`。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/ai/task-read-set-routing]] · [[task-0092-agents-routing-slimdown]]
