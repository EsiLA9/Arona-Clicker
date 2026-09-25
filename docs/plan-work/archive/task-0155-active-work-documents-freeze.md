# Task：当前工作文档盘点与冻结归档

状态：done — 31 份工作文档已按原状态冻结归档

## 目标

盘点 `docs/plan-work/` 根目录现存的 Task / Draft，概述各自最后已知进展与未完成边界，按用户要求统一移入 `archive/`，让根目录回到清爽的讨论起点。

## 设计边界

- 只处理本 Task 建立前已在根目录的 31 份工作文档（8 Draft、23 Task）；`00-index.md` 留作稳定入口，`goalsets/` 使用说明保留。
- 归档表示冻结当前工作，不表示已完成；保留文首状态原值，不把 active / draft / proposed / closing 改成 done。
- 不修改游戏源码、测试、机制正文或旧归档正文；未完成事项由冻结清单和原文保留，恢复时另立 Task / ADR。
- 已有与其他工作交叉的未提交修改保持原样，不为清爽索引删除内容。

## 当前事实与代码落点

- 根目录现有 31 份工作文档：状态分别为 accepted 1、active 18、closing 4、draft 5、in-progress 1、proposed 2。
- `docs/plan-work/00-index.md` 当前仍列出这些活跃与待裁定文件；`archive/` 是冻结层，裸名 WikiLink 可在移动后继续解析。
- `docs/docs-828/05-conventions/doc-maintenance.md` 规定历史层不依据归档位置推定已完成。

## 施工切片

### P0：冻结清单

- 建立逐文档摘要，区分已完成范围、仍待验收或裁定的内容。

### P1：归档与入口清理

- 将 31 份文件移入 `archive/`；更新 `00-index.md` 的活跃列表与本轮归档路由。
- 检查文件名冲突、WikiLink 与剩余根目录文件。

## 测试与验收

- [x] 31 份目标文件均在 `archive/`，原根目录不再有这些 Task / Draft。
- [x] 冻结清单完整列出 31 份，且保留未完成状态。
- [x] `npm run check:docs` 与 `git --no-pager diff --check` 通过。

## 当前核验（2026-09-25）

- 已核对根目录文件清单、文首状态、目标与剩余工作；归档前确认目标文件名无冲突。
- 31 份文件移入 `archive/`，没有将未完成项改为 `done`；[[active-work-freeze-2026-09-25]] 逐项记录进展与待续边界。
- 冻结清单有 31 个唯一 Task / Draft 引用，目标文件全部存在；根目录只剩 `00-index.md` 与本执行 Task。
- `npm run check:docs`：299 篇 Markdown，0 错误；`git --no-pager diff --check` 通过。
- AOCI checkpoint 返回 `refresh_deferred_until_stable`（共享工作区仍有其他未稳定变更）；按实时合同暂不运行 Maintain。冻结文档的认知索引更新须在工作区稳定后统一完成。

## 剩余工作

- 文档归档本身已完成。AOCI 认知索引对齐待共享工作区稳定；冻结文档中的未完成方向由各原文和冻结清单保留，重新推进时另立文档。

## 相关路由

- [[docs/plan-work/00-index]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
