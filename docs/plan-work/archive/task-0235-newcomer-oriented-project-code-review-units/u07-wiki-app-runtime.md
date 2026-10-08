# Unit 0235-U07：App Runtime 功能 Wiki

## Goal

核实并改写应用启动、启用包应用和 GameInstance 生命周期的新人向关系页。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/10-application-runtime/00-index.md`、`startup-and-composition.md`、`pack-application.md`、`lifecycle.md` | 本 Unit 白名单内完整页面 |
| 源码 | `src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`runtime.ts`、`runtime-game-instance.ts`、`runtime-wiring.ts` | 启动与生命周期实际 owner |
| 测试 | `tests/engine/arona-runtime-pack.test.ts`、`tests/data/pack-manager.test.ts` | 验证应用与恢复/重建入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–30k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按入口、包应用、生命周期拆开，不读所有领域服务 |

## Optional Read Set

- U02 的架构流程页，仅当术语和执行顺序需要一致化时引用。

## Do Not Read by Default

- `docs/plan-work/archive/**`、每个 GameInstance 下游系统的全部实现。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| App Runtime Wiki 当前有启动/装配、包应用和生命周期三个主题页。 | `06-wiki/10-application-runtime/00-index.md` | 页面内容需按当前版本再核对。 |

## Constraints

- 用一条用户可观察路径解释启动与进入游戏，不把构造顺序误写为 Tick 顺序。
- 对“新建、恢复、切 Init、重置”的区别给明确链接。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u07-wiki-app-runtime.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/10-application-runtime/00-index.md`
- `docs/docs-829/06-wiki/10-application-runtime/startup-and-composition.md`
- `docs/docs-829/06-wiki/10-application-runtime/pack-application.md`
- `docs/docs-829/06-wiki/10-application-runtime/lifecycle.md`

## Explicit Non-goals

- 不改 Runtime 创建顺序、PackManager 策略或 SaveData 行为。
- 不复制全部 `runtime-wiring.ts` 接线清单。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；生命周期语义冲突时将每个入口分开记录并暂停相关页面。

## Completion Criteria

- [x] 每页简单说明读者问题、入口、参与模块和可继续阅读位置。
- [x] 新人可从包应用进入 Init/会话生命周期并追到源码与测试。
- [x] 分区索引和 01 架构页链接互相连通。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 运行流走读 | 按入口/包应用/恢复三条路径校验 | 流程和 owner 可定位 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 本次审查结果

- **范围**：浏览器 boot、App 工厂、Runtime 与 GameInstance 创建/接线、包应用 target、初次 Lobby、Controller 新建/恢复 Init 的调用入口、会话门面及保存/重置入口。
- **Wiki 修改**：重写本分区索引、`startup-and-composition.md`、`pack-application.md`、`lifecycle.md`。页面按“回答的问题→运行顺序→模块责任→源码/测试”组织，区分静态 import、运行时调用、数据传递和 EventBus 事件；交叉链接回架构图、模块卡和状态结构。
- **源码证据**：`src/ui/main.ts:boot()` 先恢复包快照、对账开发包、应用默认包，再创建并挂载 UI；`runtime-bootstrap.ts` 提供工厂与默认包应用入口；`runtime.ts:createPackApplyTarget()` 首次检查当前 active Init 并以 `enterDefaultInit:false` 应用包；`runtime-game-instance.ts:init()` 根据选项决定是否进入可见默认 Init，`start()`/`stop()` 委托 SessionService，`load()`/`reset()` 交给恢复和重置流程；`runtime-wiring.ts` 将 `SessionService.doTick` 接到 `GameInstance.tick()`。为核实新建/恢复入口，额外定向查阅 `src/ui/controller.ts:startNewGame()/resumeInit()` 及 `src/arona-clicker/services/init-service.ts:enterInit()`。
- **测试证据**：`tests/engine/arona-runtime-pack.test.ts` 验证包应用后停留 Lobby、包库快照恢复、坏包停用及再次启动加载；`tests/data/pack-manager.test.ts` 验证初始启用和保存的停用选择。两文件已阅读，本 Unit 未执行 Vitest。
- **代码 Review 发现**：未确认 P0–P3 缺陷。
- **未覆盖项**：未逐项执行 Init 进入、恢复、软重启、全量存档和 Tick 定时器测试；指定 Read Set 的测试主要证明包应用与包库策略。

## Receipt 0235-U07

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/10-application-runtime/00-index.md`、`startup-and-composition.md`、`pack-application.md`、`lifecycle.md`；本 Unit 文件内补充审查记录与 Receipt。 |
| 未完成内容 | 无；未覆盖边界见上。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 绑定 `acprogram`；本分区 4 个 Wiki 路径均已完整 `review_changes` 复核。更新应用组合、包应用、Init/Session 生命周期及索引页的 `maps_to` Evidence/文档角色；相关 node/edge freshness 均 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 代码/测试核对 | 阅读指定源码及定向 Controller/Init 源码 | 通过 | 测试源已阅读，未执行。 |
| 文档链接 | `npm run check:docs` | 通过 | 扫描 679 篇 Markdown，0 错误。 |
| 运行流走读 | 从 `main.ts:boot()` 到包应用、Lobby、新建/恢复 Init、`start()` | 通过 | 静态调用顺序已按源码标出。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无空白错误；仅有其他工作区源码行尾提示。 |
| GALHCG | `review_changes` 核对 4 个 Wiki 路径；更新 `game-instance-runtime-composition`、`init-service`、`session-service`、`enabled-pack-application-and-reload` 与应用索引的文档映射；`verify_freshness` | 通过 | `review_changes` 完整且无 stale owner；本次写入的所有 node/edge freshness 均为 fresh。 |

### 遇到问题

- 无阻断问题。先前 Wiki 将启动、Init 选择与开始会话合写成一个阶段，现拆开说明。

### 需上游确认项

- 无。

### 事实更新建议

- 初次 UI 启动显式留在 Lobby；新建/恢复 Init 成功后 Controller 才开始 Runtime 会话。该路线已写入功能 Wiki。
