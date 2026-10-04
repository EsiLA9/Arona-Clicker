# 06-wiki/00-index — 项目 Wiki 入口

> 本文回答：按哪些概念层阅读 ACProgram 的代码结构，以及从 Wiki 页面继续进入哪些权威机制、数据结构或规范正文。

## 阅读顺序

先读 [[docs/archive/docs-828-snapshot/01-architecture/AC-outline-wiki]] 建立概念图，再按主题选择下表。Wiki 描述职责和协作关系；实现事实以源码、测试和对应的 `docs/docs-828/` 专业正文为准。

| Wiki 页面 | 主题 | 代码入口 |
| --- | --- | --- |
| [[docs/archive/docs-828-snapshot/06-wiki/10-application-runtime]] | 应用启动、PackManager、组合根与 Runtime 生命周期 | `src/app/`、`src/arona-clicker/runtime*.ts` |
| [[docs/archive/docs-828-snapshot/06-wiki/20-data-services]] | Datapack、Registry、持久化、资产与作者工具服务 | `src/data-services/` |
| [[docs/archive/docs-828-snapshot/06-wiki/30-arona-clicker-domain]] | 产品领域服务、PlayerState、写入口与读模型 | `src/arona-clicker/` |
| [[docs/archive/docs-828-snapshot/06-wiki/40-engine]] | 通用机制、契约与引擎子系统 | `src/engine/` |
| [[docs/archive/docs-828-snapshot/06-wiki/50-ui]] | Controller、Commands、只读视图与组件 | `src/ui/` |
| [[docs/archive/docs-828-snapshot/06-wiki/60-engineering-support]] | 测试、Schema、架构边界与维护脚本 | `tests/`、`tools/`、`scripts/` |

## 按常见问题继续阅读

| 我想理解…… | 进入 |
| --- | --- |
| 启动、装配、Lobby、Init 与 Tick 的完整先后顺序 | [[docs/archive/docs-828-snapshot/01-architecture/run-logic]] |
| Datapack 定义如何进入 Registry 和 UI 查询视图 | [[docs/archive/docs-828-snapshot/01-architecture/data-flow]]、[[docs/archive/docs-828-snapshot/02-modules/registry-wiki]] |
| PlayerState 各字段应归属哪一层 | [[docs/archive/docs-828-snapshot/01-architecture/state-layers]]、[[docs/archive/docs-828-snapshot/03-data-structures/player-state]] |
| 状态写入后如何触发引擎联动 | [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]]、[[docs/archive/docs-828-snapshot/04-mechanisms/trigger-effect]] |
| 某一机制的详细算法、某个实体字段或编辑约定 | [[docs/archive/docs-828-snapshot/00-INDEX]] 的机制、数据结构和规范路由表 |

## 相关入口

[[docs/archive/docs-828-snapshot/01-architecture/AC-outline-wiki]] · [[docs/archive/docs-828-snapshot/00-INDEX]] · [[docs/archive/docs-828-snapshot/05-conventions/doc-maintenance]]
