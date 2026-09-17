# Task/Roadmap：AOCI 任务系统结构对齐

状态：done — ✅ 已完成

## 目标

将 ACProgram 的项目规则与任务文档结构明确对齐到 AOCI 的“认知资产 / 当前事实 / 任务记录 / 会话 Goal”分层，消除旧任务目录骨架带来的入口歧义。

## 边界

- 只调整 `AGENTS.md`、`docs/plan-work/00-index.md` 和空的旧任务目录。
- 不修改游戏业务源码、测试、数据包或当前机制事实。
- 不重新建立 AOCI 索引，不执行数据库索引；只维护本次受影响的 Code Entry。

## 施工切片

- [x] 在 `AGENTS.md` 增加 AOCI 与 Task / Goal 的职责边界和生命周期入口。
- [x] 在 `docs/plan-work/00-index.md` 明确根目录当前任务区、`archive/` 与 `mechanisms/` 冻结区。
- [x] 移除空的旧 `0x-plan&work/` 目录骨架；保留项目明确约定的空 `docs/newPlan/` 旧入口。
- [x] 完成本次 AOCI Entry 维护、Verify / Check / Guide 与本地 Git 提交。

## 验收

- `npm run check:docs` 通过。
- AOCI Code source / Entry 无漂移，治理状态回到 `aligned`。
- Git 变更只包含规则、任务入口、AOCI 托管资产和本 Task 文档。

## 当前事实

- 新任务统一从 `docs/plan-work/` 根目录进入，并同步 `00-index.md`。
- 完成后的 Task 移入 `docs/plan-work/archive/`；文档正文不再作为当前机制事实源。
- Codex Goal 只负责当前会话执行，长期状态必须留在 Task 文档。

## 剩余工作

无剩余施工项；本文已在最终核验后移入 `docs/plan-work/archive/`。

## 最终核验（2026-09-17）

- `npm run check:docs` 通过，扫描 220 篇 Markdown、0 errors。
- AOCI Code source / Entry 均为 701，Verify / Check / Guide 分别为 `aligned`、`ok=true`、`complete=true`。
- 本次没有修改业务源码；旧的空 `0x-plan&work/` 骨架已移除。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/plan-work/00-index]]
