# Unit 0235-U10b：Engine 事件响应、可见性与 Tick Wiki

## Goal

说清事件驱动的系统、可见性/统计/Extra 与 Tick 如何响应运行状态。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/40-engine/00-index.md`、`effects-triggers-affectors.md`、`visibility-stats-extra.md`、`tick-session.md` | 本 Unit 流程页 |
| 源码 | `src/engine/effect/`、`visibility/`、`stats/`、`runtime/session-service.ts`、`arona-clicker/runtime-wiring.ts` | 事件订阅、Tick 组合和产品联动入口 |
| 测试 | `tests/engine/trigger-system.test.ts`、`visibility-hot-spot.test.ts`、`anonymous-affector-trigger.test.ts` | 核对响应边界与规则 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 每条路径只选一个事件和一个 Tick 案例验证 |

## Optional Read Set

- `docs/docs-829/04-mechanisms/engine/effect-trigger.md`，需要更深规则时链接到权威正文。

## Do Not Read by Default

- `docs/plan-work/archive/**`、所有独立 Affector 配置和整套数值表达式定义。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Engine Wiki 分开路由 Effect/Trigger/Affector、可见性/统计/Extra、Tick/会话。 | `06-wiki/40-engine/00-index.md` | 事件及时序仍待源码审查。 |

## Constraints

- 标明 mutation 先写状态还是 event request 再由 handler 写状态，以各流程为准。
- 图中不把 `EventBus.flush`、同步派发和 Trigger 匹配混称“事件解析”。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u10b-wiki-engine-reactive.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/40-engine/effects-triggers-affectors.md`
- `docs/docs-829/06-wiki/40-engine/visibility-stats-extra.md`
- `docs/docs-829/06-wiki/40-engine/tick-session.md`

## Explicit Non-goals

- 不改 Tick 调度、触发规则、可见性算法或统计行为。
- 不把所有 System/Engine 服务做成逐文件百科。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；不同事件类别具有不同时序时分别上报，不合并成假设统一处理。

## Completion Criteria

- [x] 至少一条状态 mutation 后反应流程和一条 Tick 生产流程有源/测试证据。
- [x] 页面能说明查询/写入边界、订阅者角色和项目装配来源。
- [x] 三页都回到 Engine 索引并指向所需机制权威页。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 事件核验 | 对照 EventBus、订阅者和 Trigger 测试 | 时序关系准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U10b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/40-engine/effects-triggers-affectors.md`、`visibility-stats-extra.md`、`tick-session.md`；本 Unit Receipt |
| 未完成内容 | 未逐个审阅所有 Effect 声明、Stats DSL 或 Visibility 条件目标；符合 Do Not Read by Default 与 Unit 上下文边界。未改产品代码。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 对 Engine Wiki 子目录与本 Unit 路径执行 `review_changes`；刷新三页共 6 条直接 Wiki Evidence 和本 Unit 的 1 条 Evidence。写后完整复核：所有直接映射 owner unchanged、stale 0。`00-index.md` 无既有直接 Evidence / maps_to，不新建泛化 Concept。 |

### 已审查证据与结果

- 源码：`src/engine/core/event-bus.ts`、`effect/event-driven-reactor.ts`、`effect/effect-engine.ts`、`effect/trigger-system.ts`、`effect/affector-engine.ts`、`visibility/visibility-engine.ts`、`expression/condition-deps.ts`、`stats/stats.ts`、`stats/tag-stats.ts`、`system/tick-system.ts`、`runtime/session-service.ts`、`contracts/mutation.ts`、`src/arona-clicker/state/state-mutation-service.ts` 与 `runtime-wiring.ts`。
- 测试：`tests/engine/event-bus.test.ts`（同步派发、flush 中嵌套事件排队）、`trigger-system.test.ts`、`anonymous-affector-trigger.test.ts`、`affector-engine.test.ts`、`affector-reconcile.test.ts`、`visibility-hot-spot.test.ts`、`stats.test.ts`、`tag-stats.test.ts`、`tick-system.test.ts`、`session-service.test.ts`。确认 Mutation 先写资源再发事件；Trigger 按类别筛选并求条件；Visibility 事件只标脏、查询时重算；Session 单独承担调度和离线补算。
- Wiki 修订：把 EventBus 投递、Trigger 匹配、Effect 写入和 Affector 生命周期分开说明；补 Visibility 按需重算、Stats / TagStat / Extra 的边界和 Tick/Session 的准确时序、代码与测试路由。
- **P2 — EventBus flush 在订阅者抛错后会永久停留在 flushing 状态。** 触发条件：`flush()` 正在派发队列事件时任一 handler 抛出异常。`src/engine/core/event-bus.ts` 在设置 `flushing = true` 后没有 `finally` 复位；异常会跳出方法，后续 `emit()` 只追加队列，而之后的 `flush()` 因 `flushing` 已为 true 直接返回，事件响应从此停摆。当前 batch 中尚未迭代的事件也已随 `splice(0)` 移出队列而丢失。`tests/engine/event-bus.test.ts` 覆盖正常嵌套排队，不覆盖 handler 抛错。建议单独建立修复 Task，明确异常后的 flag、剩余 batch 与队列处理策略，并增加回归测试。置信度：高；问题只在 handler 抛错时触发，但后续影响覆盖共享总线上的所有订阅者。
- **未分级的待裁定 concern — `totalFrames` 写入 owner。** `src/engine/system/tick-system.ts` 直接递增 `state.totalFrames`，而同一方法的资源写入走 `StateMutationPort.changeResource()`；基础 Mutation 契约没有帧数更新方法。虽然 `AGENTS.md` 有统一状态写入护栏，权威架构页 [[docs/docs-829/05-conventions/architecture-discipline]] 明确要求结合状态类型、Port 契约与测试裁定该路径，不能从一般规则推断其是违规或获批例外。因此本 Unit 不把此项计为 P0–P3 缺陷；建议由高层给出 owner 裁定后决定是否立 Task。`tests/engine/tick-system.test.ts` 覆盖可观察帧数和事件，但不裁定写入 owner。

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 本 Unit 通过源码和现有测试审阅取得证据；不新增 / 运行产品测试。 |
| 事件 / Tick 走读 | 对照实现与上述测试 | 通过 | 分别核对同步 emit、flush 排队、Trigger 条件执行、单帧产出和 Session 离线追赶。 |
| 文档检查 | `npm run check:docs` | 通过 | 679 个 Markdown，errors: 0。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无 whitespace 错误；输出仅含并行修改的 TS 文件 CRLF 转换提示。 |

### 遇到问题 / 需上游确认项 / 事实更新建议

- 问题：P2 EventBus.flush 发现需在总审查中处理；U06 Receipt 指出 U05 已记录同一问题，可能重复计数。本 Unit 不修改产品代码。
- 需上游确认项：请高层核对 EventBus P2 是否与 U05 重复并统一跟进；另裁定 `totalFrames` owner，但该 concern 不列为已确认缺陷。本 Unit 未创建后续 Task。
- 事实更新建议：EventBus 修复后更新本页投递说明；若项目裁定 `totalFrames` 写入路径，应同步更新此页与 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]] 权威机制页，后者不在本 Unit Allowed Files。
