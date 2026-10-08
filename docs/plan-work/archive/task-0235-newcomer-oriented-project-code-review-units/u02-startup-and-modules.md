# Unit 0235-U02：启动、装载与模块入口

## Goal

把应用启动、包应用和模块分工串成新人可追踪的代码路径。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `01-architecture/run-logic.md`、`data-flow.md`、`02-modules/00-index.md`、`02-modules/app-runtime.md`、`data-services.md` | 现有启动路由与模块卡 |
| 源码 | `src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts`、`runtime-wiring.ts`、`src/data-services/datapack/pack-manager.ts` | 启动、组合、包应用及接线 |
| 测试 | `tests/engine/arona-runtime-pack.test.ts`、`tests/data/pack-manager.test.ts` | 核实装载及应用验证点 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–30k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按启动、包装载、模块边界拆开阅读，不预读所有 Runtime 服务 |

## Optional Read Set

- `src/arona-clicker/runtime-game-instance.ts`，仅当组合根和 GameInstance 边界仍有疑义时。

## Do Not Read by Default

- `docs/plan-work/archive/**`、完整 Editor 表单实现、与启动无关的玩家功能服务。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前有独立模块总索引和 App Runtime、Data Services 两张模块卡。 | `02-modules/00-index.md` | 卡片信息需要与源码复核。 |

## Constraints

- 说明谁创建谁、谁调用谁；不要把创建顺序误写成每帧执行顺序。
- 名词采用简明解释并链接到权威细节，遵守 Task 的 Code Review 发现格式。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u02-startup-and-modules.md`（填写本 Unit Receipt）
- `docs/docs-829/01-architecture/run-logic.md`
- `docs/docs-829/01-architecture/data-flow.md`
- `docs/docs-829/02-modules/00-index.md`
- `docs/docs-829/02-modules/app-runtime.md`
- `docs/docs-829/02-modules/data-services.md`

## Explicit Non-goals

- 不更改 Runtime 装配逻辑、PackManager、包默认启用规则或状态生命周期。
- 不在模块卡复制 Registry 或 PlayerState 算法。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；出现源/测试/文档冲突时在 Receipt 留路径和符号后停止该项。

## Completion Criteria

- [x] 从浏览器入口到包应用、Registry 和 GameInstance 的运行顺序有源码证据。
- [x] 模块卡区分组合根、数据服务和 Runtime 领域职责，并指向下一层阅读。
- [x] 页面更新均有相邻模块和下游索引互链。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 代码证据 | 核对指定源码和测试入口 | 主要步骤逐项能定位 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 本次审查结果

- **范围**：启动文件、App Runtime 工厂、PackManager/Runtime 应用回调、GameInstance 初始化和 wiring；按指定测试核对启用、默认 Lobby 与快照恢复。
- **Wiki 修改**：更新 `run-logic.md` 明确构造与执行顺序、静态依赖/运行时调用/数据流/事件的区别；在 `data-flow.md` 说明图的关系类型；更新模块索引及 App Runtime、Data Services 卡片，解释组合根、共享基础服务和跨页阅读路线。
- **源码证据**：`src/ui/main.ts:boot()` 恢复包库、发现开发包、调用 `loadDefaultDatapack()` 后挂载 Controller；`src/app/runtime-bootstrap.ts:createAppRuntime()` 创建 Runtime，`loadDefaultDatapack()` 调 `applyEnabledPacks()`；`src/arona-clicker/runtime.ts:constructor()` 调用 `super()` 后创建 PackManager，`applyEnabledPacks()` 传入 Runtime target；`runtime-game-instance.ts:init()` 逐包 `Registry.load()`，全部加载后进行引用检查并重建派生系统；`runtime-wiring.ts:wireGameInstance()` 创建 Registry、EventBus、写入服务并把 SessionService 的 `doTick` 接到 `g.tick()`。
- **测试证据**：`tests/engine/arona-runtime-pack.test.ts` 覆盖默认启用包进入 Registry、初次包应用留在 Lobby（`activeInit === ''`、`running === false`）、失效可选包停用及异步快照恢复；`tests/data/pack-manager.test.ts` 覆盖初次 bundle 默认启用、保留保存的停用选择、开发来源唯一性和快照恢复。测试文件已阅读，本 Unit 未执行 Vitest。
- **代码 Review 发现**：未确认 P0–P3 缺陷。
- **未覆盖项**：未逐行检查全部启动相关服务；Init 切换、每帧逻辑、全部 Registry 校验和游戏 UI 冷启动集成测试不属于指定源码/测试 Read Set 的完整覆盖范围。

## Receipt 0235-U02

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/01-architecture/run-logic.md`、`data-flow.md`、`02-modules/00-index.md`、`app-runtime.md`、`data-services.md`；本 Unit 文件内补充审查记录与 Receipt。 |
| 未完成内容 | 无；未覆盖边界见上。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 绑定 `acprogram`；5 个 Wiki 路径均已 `review_changes` 完整复核。`app-runtime`、`data-services` 模块节点和 `run-logic` / `data-flow` / `data-services` 直接关系已更新 Evidence；本批次 23 个相关 node/edge freshness 核验均 fresh。`02-modules/00-index.md` 是路由页，无直接语义 owner，本次未新建宽泛概念。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 代码/测试核对 | 阅读指定源码与测试 | 通过 | 测试未执行。 |
| 文档链接 | `npm run check:docs` | 通过 | 扫描 679 篇 Markdown，0 错误。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无空白错误；Git 仅提示工作区其他 TS/CSS 文件的 CRLF 转 LF 警告。 |
| GALHCG | `review_changes` 核对 5 个 Wiki 路径；更新 `module:app-runtime`、`module:data-services`、`concept:ui-command-to-runtime`、`concept:content-authoring-policy` 及相关边的 Evidence；`verify_freshness` | 通过 | `review_changes` 完整且无 stale owner；本次写入对应节点/边 freshness 为 fresh。 |

### 遇到问题

- 无阻断问题；源码中的创建顺序不能用来推断每帧执行顺序，已在 Wiki 明确区分。

### 需上游确认项

- 无。

### 事实更新建议

- 新人读启动流程时应以 `src/ui/main.ts:boot()` 的异步步骤为主干，并区分 `PackManager` 选择计划和 Runtime 实际应用；已写入当前 Wiki。
