# 06-adr/0003 — 文档体系重构（docs-824 → docs/docs-828）

- **状态**：已完成（2026-08-28）
- **决策者**：项目维护者 + AI 协作
- **来源**：项目经历大规模变动（T1-T7 架构整理、生产树重构、多轮机制迭代）后，docs-824 与代码出现系统性漂移

## 背景

- **代码大变动**：`game-instance.ts` 889→398 行、UI 只读面重建、三层状态单一事实源化、事件目录/注册表化、生产结算树重写——docs-824 的大量章节描述的是变动前的结构。
- **文档漂移被核实**：逐篇核对发现多处臆测/过期内容，例如：
  - `04g-roster` 整篇基于不存在的方法（`getCollection`/`rosterGroups`，全库 grep 0 命中）；
  - `GachaPoolDef` 字段表与实际类型不符（实际为 `mode/currency/costPerPull/rates/featured/pity`）；
  - PlayerState 字段名漂移（`items`→`inventory`、`activeAreaId`→`currentAreaId`、`characters`→`roster`+`fragments`）；
  - `TriggerEventDef` 7 种→实际 9 种；`GameEvent` 联合 44 成员且新增 4 个请求事件；`conditionGroupMet` 已删除。
- **结构问题**：旧库扁平编号（00-08 + 字母后缀），跨模块概念无归口、检索靠通读；08/04h 等任务记录与机制文档混编。

## 决策

### 分层索引体系（新库 `docs/docs-828/`）

| 分区 | 职责 | 约束 |
| --- | --- | --- |
| `00-INDEX.md` | 唯一入口，双路由表（按角色/按主题） | 只路由不承载内容 |
| `01-architecture/` | 跨模块全局视角（overview / run-logic / state-layers / data-flow） | 不重复模块细节 |
| `02-modules/` | 16 张模块卡片（职责/关键文件/对外契约/常见改动入口） | 一模块一卡，互相引用不复制 |
| `03-data-structures/` | 实体/状态/DSL/ID 语义 | 以 `types/**` 实况为准 |
| `04-mechanisms/` | 核心流程（状态管道/生产/招募/养成/色彩/触发效果/通讯录） | 每篇声明权威代码源 |
| `05-conventions/` | 架构纪律 / 重构 / Schema 同步 / 测试 / 文档维护 | 规则性内容唯一出处 |
| `06-adr/` | 决策记录（0001 架构整理 / 0002 生产树 / 0003 本文 / planning 未实现规划） | 只追加不改写 |

### 核对式迁移（写作方法）

1. **逐篇先核对后迁移**：每迁移一篇先 grep/Read 对应源码，以 2026-08-28 实况为准重写，不照搬旧文；发现臆测直接纠正并在文中反映实况。
2. **单一事实源策略**：易漂移的枚举清单（44 事件、17 项 per-init 字段、25+ Registry 表）文档只做速览，声明权威源在代码（`EVENT_CATALOG` / `PER_INIT_FIELD_SPECS` / `tableSteps`）。
3. **内容安置映射**：02a-e→`01-architecture/run-logic`；03a-f→`03-data-structures/*`；04a-g→`04-mechanisms/*`；04h→`06-adr/0002`；06→`05-conventions/refactoring`；08→`06-adr/0001`；03g/04i/04j→`06-adr/planning`；07 已消化进 `02-modules/pics.md`。
4. **旧库处置**：`docs-824/00-README.md` 加归档标注指向新库，旧库正文不改写（保留历史快照）。

### 写作规则（沉淀为 [[docs/docs-828/05-conventions/doc-maintenance]]）

中文正文 + 术语英文；表格优先；引用代码用路径不复制代码；跨文档引用用 `[[docs/docs-828/...]]`；单一事实源原则。

## 后果

- **收益**：新人/AI 从 `00-INDEX` 一跳定位；模块卡片让「改哪个功能读哪篇」可回答；文档与代码一致性在本次迁移中逐篇重建。
- **代价**：迁移工作量约 38 篇；`[[docs/docs-828/...]]` 链接依赖 Obsidian 生态。
- **后续义务**：机制改动按 [[docs/docs-828/05-conventions/doc-maintenance]] 的维护触发器同步对应分区；下次大变动时评估整体重构而非补丁。

## 相关文档

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/05-conventions/doc-maintenance]]
