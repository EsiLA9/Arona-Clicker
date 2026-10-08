# Unit 0235-U03：Engine、领域、UI 与编辑器模块卡

## Goal

对剩余模块卡进行源码对照审查，让新人知道每层负责什么、从哪进入及去哪里继续阅读。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `02-modules/00-index.md`、`engine.md`、`arona-clicker.md`、`ui.md`、`datapack-editor.md` | 模块边界及当前专题入口 |
| 源码 | `src/engine/index.ts`、`src/arona-clicker/runtime-game-instance.ts`、`src/ui/main.ts`、`src/ui/controller.ts`、`tools/datapack-editor/` 的启动与 Schema 入口 | 对照模块边界和主要外部入口 |
| 测试 | `tests/engine/trigger-system.test.ts`、`tests/ui/controller-events.test.ts`、`tests/ui/runtime-editor-launcher.test.ts` | 核验模块职责的可观察路径 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只追逐模块公开入口；具体机制留给 03/04 和 Wiki Units |

## Optional Read Set

- 模块卡引用的领域服务，仅在卡片的关键职责无法从入口符号核实时打开。

## Do Not Read by Default

- `docs/plan-work/archive/**`、编辑器每个表单和 Engine 的全部内部实现。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 模块索引分列 Engine、AronaClicker Domain、UI、独立 Datapack Editor。 | `02-modules/00-index.md` | 卡片职责需源码复核。 |

## Constraints

- 清楚解释通用 Engine 和产品领域之间的组合边界。
- 明确游戏内 Runtime Editor 与独立 Datapack Editor 不同。
- 保持卡片短；专题细节使用 06-Wiki、03/04 的链接。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u03-module-cards.md`（填写本 Unit Receipt）
- `docs/docs-829/02-modules/engine.md`
- `docs/docs-829/02-modules/arona-clicker.md`
- `docs/docs-829/02-modules/ui.md`
- `docs/docs-829/02-modules/datapack-editor.md`

## Explicit Non-goals

- 不改 Engine API、UI 交互、Editor Schema 或编辑器功能。
- 不把每个源码子目录都另立为独立模块。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；静态架构关系与运行时关系无法从 Read Set 区分时，暂停对应图示并上报证据。

## Completion Criteria

- [ ] 四张卡都有职责边界、主要入口、匹配测试位置和深入链接。
- [ ] Engine/Domain/UI/两种 Editor 的职责不互相混淆。
- [ ] 代码 Review 发现与文档可读性问题分开记录。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 模块读路 | 从模块索引分别跟进四张卡 | 每张卡能定位入口和下一页 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt

- **结果：** 已审查四张模块卡及职责边界；补足 Engine、AronaClicker Domain、独立 Datapack Editor 和本地 Gameplay B 命令台的测试入口与继续阅读路径。
- **源码/测试核对：** `src/engine/index.ts` 是 Engine 汇总入口；`src/arona-clicker/runtime-game-instance.ts` 装配产品服务、PlayerState 和私有 Operation Runtime owner；独立编辑器由 `tools/datapack-editor/ui/main.ts` 启动并消费生成 Schema；当前 UI Operation Workspace 通过只读 OperationView 和窄命令 facade 协作。本地试玩台白名单命令的解析与 Mutation 路径见 `src/ui/development/gameplay-b-quick-test-console.ts`。检查了 `tests/engine/engine-contracts.test.ts`、`event-bus.test.ts`、`trigger-system.test.ts`、`arona-runtime-pack.test.ts`、`state-mutation-service.test.ts`、`operation-runtime-service.test.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts` 与 Schema 同步测试。
- **Wiki 修改：** 为 Engine、AronaClicker Domain、独立 Datapack Editor 模块卡增加定向测试路径；在已有 UI 卡增加 Gameplay B 本地命令台源码与测试入口，未重写 Task 0236 的 Operation UI 说明。
- **Review 发现：** 未确认这三张模块卡所覆盖路径中存在 P0–P3 产品代码缺陷。
- **并行边界：** `docs/docs-829/02-modules/ui.md` 中 Gameplay B Operation Surface 内容来自并行 Task 0236。本 Unit 只核对它的模块职责、Read/View 边界与现存操作入口，并新增无冲突的本地命令台测试索引；Operation Workspace 的最新视觉/交互验收留在 Task 0236，本 Unit 不对其 Edge 浏览器完成度作结论。
- **验证：** 模块卡的源码、测试入口和交叉链接已人工核对；`tests/ui/gameplay-b-quick-test-console.test.ts` 已由源代码和断言检查，未运行 Vitest。最终 `npm run check:docs` 通过（681 Markdown，0 errors），`git --no-pager diff --check` 通过。
