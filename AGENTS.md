# AGENTS.md — 项目入口与协作规则

> 本文件只保留全项目入口、稳定护栏和工具路由。当前实现事实以源码、测试与 `docs/docs-829/` 为准。

## 开始任务

1. 先读 [[docs/docs-829/00-INDEX]]，按任务路由读取当前机制、结构或约定文档。
2. 按 [[docs/ai/task-read-set-routing]] 选择最小 Read Set；涉及未知领域、新内容或文件改动时，按 [[docs/ai/galhcg-project-map]] 主动发现和维护 GALHCG 证据。
3. 玩法策划与施工按 [[docs/ai/goal-workflow]]；Patch Unit、验证和 Receipt 按 [[docs/ai/PROJECT-CONSTITUTION]]。

## 常见路由

| 任务 | 路由 |
| --- | --- |
| 引擎/领域机制与模块 | [[docs/docs-829/00-INDEX]]、[[docs/docs-829/02-modules/00-index]]、[[docs/docs-829/04-mechanisms/00-index]] |
| 状态归属、写入口与事件联动 | [[docs/docs-829/03-data-structures/player-state]]、[[docs/docs-829/04-mechanisms/state-mutation]]、[[docs/docs-829/04-mechanisms/effect-trigger]] |
| 实体字段、枚举、Datapack / Schema | [[docs/docs-829/05-conventions/schema-sync]]、[[docs/ai/context-packs/datapack-schema]] |
| 生产、抽卡、培养、角色和好感 | [[docs/ai/context-packs/production]]、[[docs/ai/context-packs/character]] |
| 默认 Datapack 与内容导入边界 | [[docs/ai/context-packs/datapack-schema]]；正式默认内容从 `src/arona-clicker/content/default-datapack.ts` 进入，`src/data/test-datapack.ts` 是测试/示例内容 |
| 世界线、Init、Spot、Lobby 与存档 | [[docs/ai/context-packs/world-lifecycle]] |
| 游戏内 UI、主题与表现 | [[docs/docs-829/06-wiki/50-ui/00-index]]、[[docs/ai/context-packs/ui-presentation]]；使用通用 `frontend-design` skill 时叠加 [[docs/ai/frontend-design-project-overlay]] |
| 文档结构、链接、归档 | [[docs/docs-829/05-conventions/doc-maintenance]] |
| 当前计划与历史状态 | [[docs/plan-work/00-index]]；计划归档不是当前实现事实 |

未特别说明的“编辑器”指游戏内 UI（`src/ui/`）；只有明确点名独立 Datapack Editor 或 Schema Editor 时才进入 `tools/datapack-editor/`。
Spot 招募入口是 Spot 的 `gacha` 功能项，不在通讯录；机制和领域路由见 [[docs/ai/context-packs/character]]。

## 文档与施工边界

- `docs/docs-829/` 是唯一持续维护的当前机制文档系统；`docs/docs-828/` 仅保留兼容重定向，旧正文在 `docs/archive/docs-828-snapshot/` 只读保存。
- `docs/plan-work/` 根目录放当前 Task / ADR / Draft；完成或冻结后移入 `archive/`。`goalsets/` 是可整组删除的目标讨论地图；`archive/` 与 `mechanisms/` 不代表当前机制状态。
- 新 Task 先写入根目录并登记 `docs/plan-work/00-index.md`。正式 Task/Draft 互相引用用裸文件名，不链接具体 Goal Set 文件。策划意见只有裁定且实现稳定后才进入 `docs/docs-829/`。
- `docs/ai/` 只承载协作协议、GALHCG 操作说明、上下文路由、提示词和模板；具体规则各有单一权威页，入口见 [[docs/ai/00-index]]。
- `npm run check:docs` 检查文档链接与结构，但不能判断语义是否过时；改文档仍须核对当前源文件和测试。

## 稳定工程护栏

- 状态变更经 `StateMutationService`；新增联动优先使用 Trigger / Affector，新事件登记 `EVENT_CATALOG`。
- 新机制优先声明为 Datapack 内容；UI 消费 `getView()` / `createUIContext()` 的只读面，不持有写引用。
- 新增跨世界线数据前确定 global、per-Init snapshot 或 per-Init current 归属；per-Init 字段登记 `PER_INIT_FIELD_SPECS`。
- 机制变更配套 Vitest 测试。`src/data-services/` 不反向依赖 UI、产品内容、测试数据或存档层，边界由 `npm run check:architecture` 验证。
- 不编写存档迁移或版本兼容层；破坏性状态变更同步更新测试和文档，按项目策略清档。
- Schema 字段或枚举以 `src/engine/types/` 等源契约为准；更新后运行 `npm run gen:schema`，禁止手改生成的 `tools/datapack-editor/schema/engine-defs.gen.json`。复杂表元数据同步维护 `editor-extras.ts`。详见 [[docs/docs-829/05-conventions/schema-sync]]。
- UI 视觉优先复用 CSS、主题 token、表现宿主或稳定语义节点。新增 wrapper 必须承担布局、语义、交互或可访问性职责；scroll、hover、focus 和普通 click 默认不触发全量 `render()`。详见 UI 项目覆盖协议。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | Vitest 全量测试 |
| `npx tsc --noEmit` | 类型检查 |
| `npm run build` | 构建 |
| `npm run check:architecture` | 数据服务依赖边界检查 |
| `npm run check:docs` | 文档链接与结构检查 |
| `npm run gen:schema` | 从引擎契约生成编辑器 Schema |
| `npm run ui:callgraph` | UI 调用链与 DOM 刷新定位 |
| `npm run report:doc-context` | 文档分区规模与上下文预算报告 |

## 禁止修改

- 构建产物和依赖：`dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/`。
- 生成文件：`tools/datapack-editor/schema/engine-defs.gen.json`；修改源类型后运行生成命令。
- 只读历史快照 `docs/archive/docs-828-snapshot/`；兼容重定向 `docs/docs-828/` 不恢复机制正文，重定向目标失效时按文档维护规则修复。

## 专项协议

- GALHCG 项目解析、未知/新内容查询、变更审查和映射维护：[[docs/ai/galhcg-project-map]]。
- AI 协作文档目录与唯一权威边界：[[docs/ai/00-index]]。
- UI 交互连续性和刷新等级：[[docs/ai/frontend-design-project-overlay]]。
