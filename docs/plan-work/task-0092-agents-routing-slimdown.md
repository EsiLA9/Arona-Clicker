# Task：AGENTS 入口与护栏精简

状态：active — 🟡 进行中

## 目标

在不改变项目规则和 AOCI 托管区块的前提下，将根目录 `AGENTS.md` 收敛为可快速扫描的路由、稳定护栏与命令速查；机制正文继续由 `docs/docs-828/` 和实时 AOCI Guide 承载。

## 设计边界

- 只调整 `AGENTS.md` 的非托管部分、任务入口索引和本 Task 文档。
- `<!-- aoci:begin -->` 至 `<!-- aoci:end -->` 区块不手工改写；其运行合同以 `aoci_rules` 和当前 Guide 为准。
- 不改变业务源码、AOCI Managed Scope、Entry 语义或数据库配置。
- 任何超出入口精简的机制规则重写，另立文档或 Task。

## 施工切片

- [x] P0：确认当前 `AGENTS.md` 的长度、重复来源和不可移动边界。
- [x] P1：合并路由、任务系统、稳定护栏和命令速查，删除非托管重复正文。
- [x] P2：检查文档链接、规则覆盖和 AOCI 托管对象漂移。
- [ ] P3：写入最终核验，归档本 Task 并完成最终 AOCI 对齐。

## 验收

- `AGENTS.md` 非托管部分只保留路由、稳定规则和命令入口。
- `docs/docs-828/00-INDEX` 仍是机制与结构事实入口。
- `docs/plan-work/` 根目录仍是活跃任务入口，完成任务进入 `archive/`。
- `npm run check:docs`、AOCI Verify、Check、Guide 均通过。
- AOCI Code Entry 与源码对象一一对齐。

## 当前核验（2026-09-17）

- 当前 `AGENTS.md` 为 224 行，其中 AOCI 托管区块为 102 行；本 Task 首先处理其余项目说明。
- 本步将整体文件压缩到 182 行，AOCI 托管区块保持原样，非托管部分由 122 行收敛到约 79 行。
- `npm run check:docs` 通过；AOCI Verify / Check / Guide 均通过，Code Entry 为 `703/703` 对齐。

## 剩余工作

- AOCI 审计提示 `AGENTS.md` 的 Entry 规模标签仍为 `M`，按当前文件长度应为 `S`；这是非阻断的认知优化项，需在后续明确的 Cognition Optimization 步骤中处理，不在本步绕过批次合同直接写入。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[task-0091-aoci-task-system-structure-alignment]]
