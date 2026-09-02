# AGENTS.md — AI 协作指南

> 本文只做**路由与速查**，不承载机制细节。所有机制/结构/算法内容以 `docs-828/` 为单一事实源（取代已归档的 `docs-824/`）。
> 接到任何任务，先读 [[docs-828/00-INDEX]] 定位；改机制前按路由表读对应文档。

## 快速上手

| 场景 | 路由 |
| --- | --- |
| 第一次接触项目 / 任务定位 | [[docs-828/00-INDEX]]（唯一入口，双路由表） |
| 改引擎机制 / 新增子系统 | [[docs-828/00-INDEX]] 模块卡片索引 → 对应卡片 + [[docs-828/05-conventions/architecture-discipline]] |
| 改实体字段 / 枚举（`src/engine/types/`） | 必读 [[docs-828/05-conventions/schema-sync]]（含 `gen:schema` 协议） |
| 改数据结构 / 状态分层 | [[docs-828/03-data-structures/player-state]] + [[docs-828/01-architecture/state-layers]] |
| 改核心算法（生产/抽卡/培养/色彩/事件联动） | [[docs-828/04-algorithms/state-mutation]] 起（分区表见 00-INDEX） |
| 文件拆分 / 重构 | [[docs-828/05-conventions/refactoring]] |
| 写测试 | [[docs-828/05-conventions/testing]] |
| 维护文档本身 | [[docs-828/05-conventions/doc-maintenance]] |
| 好感系统（数值 / 台阶推送 / 羁绊尾巴 / 输入中提示）机制 | [[0x-plan&work/completed/affection-planning]]（机制单一事实源；聊天消息成分已移除） |
| Datapack 读取 / 多包管理 / mod 冲突与命名空间 | [[0x-plan&work/active/adr-0004-datapack-management]]（规划中，裁定记录见文内） |
| Datapack 汇总契约 / Registry 组合边界 | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/`；基础引擎只消费注入后的数据 |
| 长期目标 / roadmap / 里程碑进度 / ADR / 工作计划 | [[0x-plan&work/00-index]]（设计决策、工作状态与历史记录统一入口） |

## 命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | vitest 全量测试（一次性运行） |
| `npx tsc --noEmit` | 类型检查 |
| `npm run dev:game` / `npm run dev` | UI / 引擎开发服务器 |
| `npm run build` | 构建 |
| `npm run gen:schema` | `src/engine/types/**` → `tools/datapack-editor/schema/engine-defs.gen.json` |

## 架构纪律（不可破坏，详见 [[docs-828/05-conventions/architecture-discipline]]）

1. **单一写入口**：所有状态变更走 `StateMutationService`，禁止直接改 PlayerState
2. **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体；新事件登记进 `EVENT_CATALOG`
3. **数据包声明式**：新机制优先设计成 Datapack 字段（Schema 协议同步），而非硬编码
4. **只读 UI**：UI 只消费 `getView()` / `createUIContext()`（`UIFacingGame` 只读面），不持有写引用
5. **三层状态**：新增"跨世界线保留"数据时想清楚放 global / per-Init 快照 / per-Init 当前哪一层；per-Init 字段必须在 `PER_INIT_FIELD_SPECS` 登记
6. **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成）
7. **数据服务单向依赖**：`src/data-services/` 不得依赖 `src/arona-clicker/`、`src/ui/`、`src/data/` 或 `src/save/`；由 `npm run check:architecture` 强制检查
8. **不做存档迁移**：项目处于长期开发阶段，PlayerState / Datapack 结构可随时破坏性变更，**禁止编写任何存档迁移/版本兼容代码**；旧存档失效直接清档重来。改状态结构时同步更新相关测试与文档即可

## 实体类型 → 数据包编辑器 同步协议（防漂移）

- 改 `src/engine/types/` 的实体字段/枚举后，**必须** `npm run gen:schema`（重新生成 `engine-defs.gen.json`）。
- 简单字段（string/int/float/enum/ref/array）自动进编辑器；想带中文标签/枚举含义，在字段 TSDoc 写 `@label` / `@enum 值=中文` / `@ref <表>` / `@int`。
- 复杂/仅编辑需要的字段（条件/效果/表达式 tagged 联动、optionsFrom、collapsible 等）在 `tools/datapack-editor/schema/editor-extras.ts` 的 `TABLE_META.overrides` 兜底。
- `tools/datapack-editor/schema/engine-schema.sync.test.ts` 做三向一致检查：引擎字段↔协议↔editor 表，新增未同步即 error。
- 完整流程见 [[docs-828/05-conventions/schema-sync]]。

## 禁止修改

- `dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/`
- `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后跑 `npm run gen:schema`）
- `docs-824/`（已归档，正文不改写；只读历史快照）

## 代码风格

- 默认不写注释；只在 WHY 非显而易见时写
- 引用文件用路径而非复制代码，让 AI 用 Read 定向读
- 建议拆解较大的代码文件：引擎/关键数据结构本体与关键循环、集成完毕的服务放单文件，较大的底层服务与枚举功能各自拆出为多个文件到对应文件夹内（规范见 [[docs-828/05-conventions/refactoring]]）

## 默认数据与 Spot 招募

- **正式应用默认内容从 `src/arona-clicker/content/default-datapack.ts` 进入**；`src/data/test-datapack.ts` 与其底层兼容出口用于测试/示例 Datapack，不是基础引擎内置内容。`datapack/` 是可选数据包导入，默认内容变更应修改 AronaClicker 内容层。
- **Spot 招募（gacha）**：招募入口在 Spot 的 `gacha` 功能项（不在通讯录）。机制细节见 [[docs-828/04-algorithms/gacha]] 与 [[docs-828/04-algorithms/roster]]；UI 落点见 [[docs-828/02-modules/ui]]。
- 新增/修改 Spot 字段或 `SpotFunctionalityDef.kind` 后，必须 `npm run gen:schema` 并在 `editor-extras.ts` 兜底同步（见上文协议）。
