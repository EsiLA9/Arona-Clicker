# 05-conventions/doc-maintenance — 文档维护规范

> 本文定义 docs-828 文档库自身的写作与维护规则，保证人与 AI 都能快速索引、且不漂移。

## 结构约定

| 分区 | 职责 | 粒度 |
| --- | --- | --- |
| `00-INDEX.md` | **唯一入口**：只路由不写正文（「我想理解…/我想改…」双路由表） | 1 个文件 |
| `01-architecture/` | 跨模块的运行逻辑、状态分层、数据流动 | 每主题 1 篇 |
| `02-modules/` | 模块卡片：与 `src/` 子系统镜像对齐（一句话/职责边界/关键文件/核心概念/测试入口） | 每模块 1 张（100-200 行内） |
| `03-data-structures/` | 数据结构定义（类型权威仍在 `src/engine/types/`，文档只讲布局与语义） | 按主题 |
| `04-mechanisms/` | 核心算法流程（结算/失效/派生） | 按主题 |
| `05-conventions/` | 规范（纪律/重构/协议/测试/本文） | 每规范 1 篇 |
| `0x-plan&work/` | 架构决策、Roadmap、方案草稿、Code Review 与完成记录的统一工作区 | 按 `00-index` 路由 |
| `07-audit/` | 设计审查：繁简/兜底问题清单（位置/原因/方案组）；GameNum/Affector 多包基础设施豁免；整改完成后归档 | 每组 1 篇 + 总览 |
| `08-roadmap/` | 已迁移至 `0x-plan&work/active/` 或 `completed/`；旧目录不再承载计划正文 | 由 `0x-plan&work/00-index.md` 统一索引 |

## 写作规则

- **单一事实源**：代码是真相，文档只做索引与语义解释；同内容只写一处，其余用 `[[docs-828/...]]` 链接；
- **引用代码用路径**（可带行号快照），不复制代码块超过必要示意；
- 中文正文 + 术语保留英文；表格优先，避免长段落；
- 卡片首行格式固定：`# 分区/文件名 — 标题`，引言行固定回答「本文回答什么」。

## 维护触发器（何时更新文档）

| 代码变动 | 必须同步 |
| --- | --- |
| 新增/删除 `src/engine/` 文件 | 对应 `02-modules/` 卡片关键文件表 |
| 改实体字段/枚举 | `03-data-structures/declarative-dsl` + [[docs-828/05-conventions/schema-sync]] 流程 |
| 新增/删除事件 | `04-mechanisms/trigger-effect` 速览表（权威仍为 `EVENT_CATALOG`） |
| 新增 PlayerState 字段 | `03-data-structures/player-state` + `01-architecture/state-layers`（三层归属） |
| 架构级变动（新系统/改纪律） | `0x-plan&work/` 新增 ADR + `00-index` 路由 |
| roadmap 切片状态变化（开工/完成/废弃） | `0x-plan&work/active/` 或 `completed/` 对应目标篇 + `00-index` 状态表 |

## 归档规则

- 大规模变动后整体重建新库（如 docs-824 → docs-828）：核对实况迁移内容，旧库 `00-README` 加归档标注指向新库，**不改写旧库正文**（保留历史快照价值）；
- 单篇过期：在文首加「已被 `[[新文]]` 取代」标注，下轮重建时移除。

## 相关文档

[[docs-828/00-INDEX]] · [[0x-plan&work/completed/adr-0003-docs-restructure]]
