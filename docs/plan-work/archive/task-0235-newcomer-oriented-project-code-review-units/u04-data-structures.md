# Unit 0235-U04：数据结构与状态归属

## Goal

把 Datapack、Registry、PlayerState、GameView 等核心对象解释为新人能区分的数据层。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `03-data-structures/00-index.md`、`datapack-contracts.md`、`registry.md`、`player-state.md`、`game-view.md` | 当前数据结构入口和权威页面 |
| 源码 | `src/data-services/contracts/datapack.ts`、`registry/registry.ts`、`src/arona-clicker/types/state.ts`、`read-model/game-view-builder.ts` | 核对定义、运行状态和投影 |
| 测试 | `tests/engine/registry.test.ts`、相关状态/读模型测试 | 核对合并、归属和投影证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按实体/状态/只读视图分开，不展开所有 Datapack 字段 |

## Optional Read Set

- `operation-view.md`，该结构由 U05 专门处理；仅查它与 GameView 的边界时阅读。

## Do Not Read by Default

- `docs/plan-work/archive/**`、生成的 Schema JSON、与类型主题无关的 UI 表现文件。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前有独立数据结构索引，列出 Datapack、Registry、PlayerState 和 GameView 等主题。 | `03-data-structures/00-index.md` | 现有描述不自动证明当前源码行为。 |
| Datapack 是内容定义聚合契约；必需/可选字段与运行时校验是不同问题。 | `src/data-services/contracts/datapack.ts`：`Datapack`；`src/data-services/registry/registry.ts`：`Registry.load()` | 定义只声明形状，不自动保证引用目标存在或被消费者使用。 |
| Registry 先按当前已加载定义校验，再按统一表步骤合并；后载同 ID 定义覆盖已存在值。 | `src/data-services/registry/registry.ts`：`Registry.load()`、`merge()`、`tableSteps`；`tests/engine/registry.test.ts` | `Area.defaultSpots` 有同包限定，不能把所有引用泛化成跨包。 |
| PlayerState 承载玩家状态；InitSnapshot 仅是登记的世界线局部字段，字段登记表执行捕获、清除和恢复。 | `src/arona-clicker/types/state.ts`：`PlayerState`、`InitSnapshot`；`state/per-init-fields.ts`：`PER_INIT_FIELD_SPECS`；`state/init-savepoint.ts` | 派生系统、游标和专门读模型要按各自生命周期判断。 |
| `buildGameView()` 将部分状态/派生输入整理为 UI 查询结果，复制若干集合，但不是完整深拷贝。 | `src/arona-clicker/read-model/game-view-builder.ts`：`ViewBuildContext`、`buildGameView()` | 搜索测试中未发现直接调用该 builder 的单元测试；按代码核对其复制边界。 |

## Constraints

- 分清声明内容、存档/运行状态、派生值和只读投影。
- 字段表和 schema 仍以源码契约为准，不复制整份类型定义。
- 写清生命周期 owner 和下一层机制链接。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u04-data-structures.md`（填写本 Unit Receipt）
- `docs/docs-829/03-data-structures/00-index.md`
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/docs-829/03-data-structures/registry.md`
- `docs/docs-829/03-data-structures/player-state.md`
- `docs/docs-829/03-data-structures/game-view.md`

## Explicit Non-goals

- 不改字段、枚举、Schema 或存档版本。
- 不将派生系统的缓存内容误写为权威持久状态。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 与 [[AGENTS.md]] 的 Schema 护栏；文档字段和类型不一致时先上报，不修 schema。

## Completion Criteria

- [x] 读者能解释定义、持久状态、派生状态、UI 投影的区别。
- [x] PlayerState 生命周期归属、Registry 责任和 GameView 输入均有源码与测试链接。
- [x] 结构页与 06-Wiki 对应入口双向可达。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 源码核对 | 比对契约、owner 和投影构造入口 | 当前类型和生命周期一致 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U04

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 本 Unit 白名单内更新 `03-data-structures/00-index.md`、`datapack-contracts.md`、`registry.md`、`player-state.md`、`game-view.md`；补充新人阅读路线、权威边界、源码符号和对应测试证据。本 Unit 文档增加 Confirmed Facts 与 Receipt。 |
| 未完成内容 | 未改字段、Schema、存档版本或产品代码；未列举 Datapack 每个字段；GameView builder 缺少直接单元测试，页面已注明。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | `review_changes(directory="docs/docs-829/03-data-structures")` 与本 Unit Unit-file 路径查询均 complete=true；刷新 5 条现存映射/关系 Evidence，为 `player-state-read-model-boundary` → `game-view.md` 增加 documentation 映射，并刷新 U04 Unit 文件的 `goal-workflow` 映射；本 Unit 7 条文档映射/关系均 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 源码与 `tests/engine/registry.test.ts`、`tests/engine/per-init-fields.test.ts`、`tests/engine/character-persist.test.ts`、`tests/engine/init-global-lifecycle.test.ts`、`tests/engine/state-mutation-service.test.ts` 对照 | 未执行 | 仅用于审查证据，没有运行 Vitest。 |
| 文档链接 | `npm run check:docs` | 通过 | 最终复跑：681 Markdown，0 errors。Task 0238 的临时错误已由任务负责人修复。 |
| 差异检查 | `git diff --check`（跟踪中的 Wiki 页）+ `rg -n "[\t ]+$"`（3 个 Unit 文档） | 通过 | Wiki 无差异空白错误；Unit 文档无行尾空格命中。 |
| GALHCG | 3 个受影响文档目录与本 Unit 文件的 `review_changes`、`plan_map_updates`、`update_map`、`verify_freshness` | 通过 | 目录检查 complete=true；计划有效；本 Unit 的 Wiki 与 Unit 关系 Evidence 均 fresh。 |

### 遇到问题

- P0–P2：无。初审曾将 `buildGameView()` 缺少单独直接调用测试列作 P3 建议；总 Review 复核发现多处 `GameInstance.getView()` 集成断言覆盖面向调用方的可观察投影，因此将其调整为未分级的测试覆盖观察，不作为已确认产品缺陷，也不另立修复 Task。数据结构 Wiki 已如实区分 builder 与调用方集成测试。
- Task 0238 的临时链接检查错误由任务负责人修复；最终全局文档检查通过。

### 需上游确认项

- 无。

### 事实更新建议

- 无；Data Structures 当前权威页面已补足本 Unit 核实的定义/状态/投影边界。
