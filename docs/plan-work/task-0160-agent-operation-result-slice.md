# Task：为 Spot 升级提供有界操作结果切片

状态：proposed — G01 准入范围已收敛，待按 Patch Unit 施工

## 目标

让 Agent 或调试消费者在一条受支持的 Spot 升级命令完成后，读取同一次命令的结构化结果、目标状态前后切片及调用期间记录的 DevLog。首期证明一次真实操作“发生了什么、状态实际变成什么、证据覆盖到哪里”，不依赖浏览器、DOM、GameNum 重算或整状态倾倒。

本 Task 覆盖 Agent 观测工程的 G01 首期操作结果能力。后续仍需扩展更多操作、解释逻辑、隔离场景和 DOM/theme 最终渲染切片；这些不属于本 Task。

## 设计边界

- 本 Task 包含：对经 `GameCommands.upgradeSpot()` 发起的单个 Spot 升级，生成并保存有界观察记录；支持成功和结构化拒绝结果；经 `GameReadModel` 的窄只读查询面读取最近记录或按 capture ID 读取一条记录。
- 观察范围只含目标 Spot 等级、Runtime state 中的资源/物品数值切片、操作返回值、frame，以及同步调用期间新增的 DevLog 记录。日志关联语义是 `captured-during-command`，不声称每条日志都由升级直接触发。
- capture ID 由 Runtime 实例内递增序号产生，不消费随机数，也不依赖时间戳生成。DevLog 按单调 log ID 的前后窗口归组，不按时间接近推断因果。
- 观察记录只驻留内存，不进入 PlayerState、存档或 Datapack；最多保留最近 20 条，单条最终 JSON UTF-8 不超过 8 KiB。超限时保留有效 JSON 并显式返回截断与省略信息。
- 首版 envelope 形状固定如下；字段名是 Task 契约，DTO 类型以代码定义为准。未能可靠读取代码/内容修订身份时写 `unknown` 并给原因；资源保持 global/currentInit 分层：

```json
{
  "schemaVersion": 1,
  "captureId": "runtime-local-sequence",
  "operation": { "kind": "spot-upgrade", "spotId": "base:spot:credit_printer" },
  "result": { "success": true, "spotId": "base:spot:credit_printer", "newLevel": 2 },
  "identity": { "activeInit": "base:init:schale_office", "contentRevision": "unknown" },
  "frame": { "before": 12, "after": 12 },
  "before": { "spotLevel": 1, "resources": { "global": {}, "currentInit": {} }, "inventory": {} },
  "after": { "spotLevel": 2, "resources": { "global": {}, "currentInit": {} }, "inventory": {} },
  "changes": { "spotLevel": { "from": 1, "to": 2 }, "resources": [], "inventory": [] },
  "logs": { "association": "captured-during-command", "entries": [], "omitted": 0 },
  "completeness": { "status": "complete", "truncated": false, "omitted": 0 }
}
```

- `paymentOptionId` 若调用者提供则按白名单复制；不存在时省略。单条记录超预算先截断日志文本/条目和状态 Map 项目，保留 operation/result/spot level 与完整性标记；仍超限则以明确的最小 envelope 返回，不能序列化任意对象。
- 捕获发生在 `upgradeSpot` 完整返回之后，包含其同步效果、可见性刷新和 Affector 复检之后的状态。
- 该命令包装仅覆盖 `commands.upgradeSpot` 入口；直接调用 `game.spot.upgradeSpot`、其他服务写操作和后台 Tick 不声明为已捕获。
- 采集与读取不额外调用 GameNum / ValueSystem 求值，不重放命令，不改变 PlayerState、事件、统计、缓存或 UI render。原业务升级仍按既有路径执行。
- 明确非目标：DOM/theme/CSS/截图、浏览器或 Desktop 连接、Workspace/Host 切片、通用任意操作追踪、因果 Trace、GameNum breakdown/recompute、CLI/MCP 传输、自动修复和存档迁移。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| UI Spot 操作通过 `GameCommands` 调用；命令工厂把 `upgradeSpot` 转发到 Runtime SpotService。 | `src/ui/controller.ts` 的命令构造；`src/arona-clicker/runtime-commands.ts` 的 `createGameCommands()`；`src/ui/controller-actions-inventory.ts` 的升级动作 | 可将首期观测边界限定在命令包装；不能声称覆盖绕过命令层的直接服务调用。 |
| `upgradeSpot()` 返回结构化成功/拒绝结果，成功时原子提交资源/物品/等级，然后执行效果、刷新可见性和复检。 | `src/arona-clicker/services/spot-service.ts` 的 `upgradeSpot()`；`src/arona-clicker/contracts/results.ts` 的 `SpotUpgradeResult`；`src/arona-clicker/state/state-mutation-service.ts` 的 `commitSpotTransaction()` | 操作后采集必须位于整个服务调用返回之后；拒绝结果也需留切片。 |
| GameReadModel 提供 `getView()` 与 `getDevLogs()`；GameView 复制 resources、spotLevels 和 inventory，但含有其它嵌套引用例外。 | `src/arona-clicker/contracts/runtime.ts`；`src/arona-clicker/runtime-game-instance.ts` 的 `getView()`；`src/arona-clicker/read-model/game-view-builder.ts` | 新接口只输出固定字段投影，不返回完整 GameView、PlayerState 或 Runtime 对象。 |
| DevLog 条目有递增 ID、source/message/details 和可选 frame，但没有通用 operation ID；Spot 升级成功会写日志，部分拒绝路径不写日志。 | `src/engine/core/dev-log.ts`；`src/arona-clicker/services/spot-service.ts`；`tests/engine/dev-log.test.ts` | 日志是有界附属证据；无记录不代表操作未发生。仅把命令同步调用窗口内观察到的新增条目附到 envelope。 |
| GameNum 评估可能更新内部 `cached/dirty`；`evaluateWithBreakdown()` 走正常 evaluate 路径。 | `src/engine/expression/game-num-eval.ts` 的 `evaluateGameNum()`；`src/engine/expression/game-num.ts` 的 `evaluateWithBreakdown()` | 本 Task 不为了补全切片额外求值；未记录的收益/贡献标为 unavailable。 |
| 现有 field-tree helper 可安全跳过 getter并限制深度/节点，但没有敏感字段 allowlist、字符串及最终 JSON 字节预算，且不能安全展开任意实例。 | `src/ui/runtime-editor/codex-details/field-tree.ts`；`tests/ui/runtime-editor-codex-details.test.ts` | 只可借鉴边界测试思路；本 Task 使用专用固定字段投影，不复用为通用 Runtime 序列化器。 |

## 施工切片

### P0：观察 DTO 与有界内存存储

- 定义固定 schema 的 Spot 升级观察 DTO、capture ID、状态差异和 completeness/truncation 字段。
- 建立 Runtime 生命周期内的有界 ring store；实现追加、按 ID 读取、最近 N 条读取、清理和 defensive-copy 读取。
- 捕获内容限制为固定字段与 plain scalar records；不保留 PlayerState、GameView、服务对象或内部 Map/Set 引用。
- 为访问器、循环/实例输入（若 helper 接收未知输入）、长字符串、条目上限、单条 UTF-8 字节预算和截断后 JSON 有效性添加定向测试。

### P1：接入 Spot 升级命令并暴露窄查询面

- 在 `createGameCommands()` 的 `upgradeSpot` 同步调用边界记录前后切片、结构化返回值、frame 与调用窗口内新增日志。
- 通过 `GameReadModel` 暴露只读 `getOperationObservations({ limit })` 与 `getOperationObservation(captureId)`（或语义等价的窄接口）；不把读取方法塞入 `GameCommands`。
- 对成功、资源不足拒绝及未知 Spot 拒绝断言 result、切片、日志可用状态和无额外业务副作用；拒绝路径验证没有部分扣费、等级变化或事件。
- 新增生命周期语义：Runtime `init/reset/load` 清除观察 ring，capture 序号在该 Runtime 实例内不复用；观察记录不写入 SaveData。

## 测试与验收

- [ ] `upgradeSpot` 成功结果包包含稳定 capture ID、目标、实际 `SpotUpgradeResult`、前后 Spot 等级、资源/物品差异、frame 与来源标记；after 在效果和复检完成后采集。
- [ ] 资源不足拒绝仍生成结果包；状态前后相等，且没有资源/物品部分扣除、等级变更或提交事件。
- [ ] 两次连续操作产生不同 ID；日志只包括调用窗口内新增的 log ID，并标为窗口观察，不宣称逐条因果。
- [ ] 超过 20 条时丢弃旧记录并报告丢弃数；超 8 KiB 时结果仍为有效 JSON，明确 `truncated/omitted`，不能把未返回字段说成不存在。
- [ ] 查询返回 defensive copy；修改调用方取得的 DTO 不会改变 Runtime 保存的观察记录。
- [ ] 观测开启与关闭对照下，Spot 操作的业务返回、PlayerState、Stats、事件顺序和 GameNum 缓存状态一致；查询观察不调用 evaluate/breakdown、不触发 render 或随机数消费。
- [ ] `init/reset/load` 后此前 ring 记录不可作为当前运行结果读取；记录不会出现在 SaveData。
- [ ] 未捕获的直接 `game.spot.upgradeSpot()` 不会被误报告为已捕获命令；其结果保持 `not-captured` / 无记录。
- [ ] 定向测试与类型检查通过；`npm run check:architecture` 无新增边界违规。

## Patch Unit

### Unit task-0160-U1：观察 DTO 与 bounded store

## Goal
建立固定 Spot 操作观察 DTO 和有界内存存储，为命令层提供可复制、可查询且能显式报告截断的结果记录。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/01-architecture/data-flow.md` | 固定 DTO 所在层及不得暴露权威状态的边界 |
| 文档 | `docs/docs-828/05-conventions/testing.md` | 机制/数据测试与定向验证要求 |
| 源码 | `src/arona-clicker/contracts/results.ts:SpotUpgradeResult` | 记录的结构化操作返回类型 |
| 源码 | `src/engine/core/dev-log.ts:DevLogEntry` | 附属日志投影字段 |
| 测试 | `tests/engine/dev-log.test.ts` | 日志有界行为的测试风格 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–15k tokens |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆 Unit 或升级调查范围 |

## Optional Read Set
- `docs/ai/task-read-set-routing.md`：需要确认 Read Set 路由时。

## Do Not Read by Default
- `docs/plan-work/archive/**`
- UI、浏览器和 theme 代码；该 Unit 只做 DTO 与存储。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `SpotUpgradeResult` 是成功/失败判别联合。 | `src/arona-clicker/contracts/results.ts:SpotUpgradeResult` | DTO 不得替换或弱化原始业务结果。 |
| DevLog 使用递增 id 并返回 entry snapshot。 | `src/engine/core/dev-log.ts:DevLog.getEntries()` | 单条详情字符串仍需限制。 |

## Constraints
- 遵守 `AGENTS.md` 架构护栏与 [[docs/ai/PROJECT-CONSTITUTION]]。
- Unit 范围限制为 DTO/store/helper 与其定向测试；不接运行时命令。

## Allowed Files
- 新增文件：src/arona-clicker/contracts/operation-observation.ts
- 新增文件：src/arona-clicker/operation-observation.ts
- 新增文件：tests/engine/operation-observation.test.ts

## Explicit Non-goals
- 任何运行时命令接线、GameReadModel 变更、通用对象序列化、DOM/theme/browser、MCP/CLI、GameNum 重算。

## Stop Conditions
使用 [[docs/ai/PROJECT-CONSTITUTION]]「停止条件」中的 6 条。另：若实现需要访问 PlayerState 写引用或引入未裁定的全局序列化契约，停止并上交。

## Completion Criteria
- [ ] 固定 schema 仅含允许字段，ring 上限为 20 条，单条最终 JSON UTF-8 不超过 8 KiB。
- [ ] 截断后保持有效 JSON 并明确列出 omitted/truncated；查询结果是 defensive copy。
- [ ] getter 不执行；长字符串、超量列表和超预算 envelope 有覆盖测试。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-observation.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

### Unit task-0160-U2：Spot 升级捕获接线与查询

## Goal
仅对经 `commands.upgradeSpot()` 发起的调用绑定同一 capture ID、前后状态、结构化结果和同步窗口日志，并经 GameReadModel 提供只读查询。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/01-architecture/data-flow.md` | Runtime/read-only/UI边界 |
| 文档 | `docs/docs-828/01-architecture/state-layers.md` | 状态字段归属和生命周期 |
| 文档 | `docs/docs-828/04-mechanisms/state-mutation.md` | 升级事务的写入与事件顺序 |
| 文档 | `docs/docs-828/05-conventions/testing.md` | 正向/拒绝测试要求 |
| 源码 | `src/arona-clicker/runtime-commands.ts:createGameCommands` | Spot 升级公开命令包装点 |
| 源码 | `src/arona-clicker/services/spot-service.ts:upgradeSpot` | 操作实际完成边界及拒绝路径 |
| 源码 | `src/arona-clicker/state/state-mutation-service.ts:commitSpotTransaction` | 原子状态/事件写入边界 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts:getView/getDevLogs` | Runtime 观察读口与生命周期 |
| 源码 | `src/arona-clicker/contracts/runtime.ts:GameReadModel/GameCommands` | 窄查询契约 |
| 测试 | `tests/engine/spot-payment.test.ts` | Spot 成功与支付拒绝基线 |
| 测试 | `tests/engine/runtime-spot-field-authoring.test.ts` | Runtime Spot 操作测试基线 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆 Unit 或升级调查范围 |

## Optional Read Set
- `src/arona-clicker/read-model/game-view-builder.ts`：核对固定状态投影的复制边界。
- `src/arona-clicker/contracts/view.ts`：如投影类型需要复用字段类型。
- `src/engine/expression/game-num-eval.ts`：仅当施工意外引入求值调用时，用于判断副作用并停止。

## Do Not Read by Default
- `docs/plan-work/archive/**`
- `src/ui/**` 中的 DOM/theme 实现；本 Unit 不施工 UI/浏览器。
- `tools/datapack-editor/**` 与全量机制目录。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| UI Spot 升级按钮经 `controller.commands.upgradeSpot` 转发。 | `src/ui/controller-actions-inventory.ts`；`src/ui/controller.ts` 的 `createGameCommands` 初始化 | 本 Unit 仅覆盖此调用入口。 |
| `upgradeSpot()` 同步返回结构化结果；成功路径在返回前完成事务、效果、可见性刷新与 Affector 复检。 | `src/arona-clicker/services/spot-service.ts:upgradeSpot` | 捕获 after 必须在调用完全返回后。 |
| DevLog 无 operation ID，但具有递增 log ID。 | `src/engine/core/dev-log.ts` | 只附同步窗口内新增项，不断言直接因果。 |

## Constraints
- 不改 `SpotService` 的业务语义、StateMutationService 顺序或 DevLog schema。
- before/after 只读取并复制该观察 DTO 固定投影所需的原始字段，不调用 GameNum、ValueSystem 查询或 `evaluateWithBreakdown()`。
- 查询方法位于 GameReadModel 只读面；不把 PlayerState 写引用或服务对象交给调用方。
- 观察数据为 Runtime 临时态，不进入存档；init/reset/load 清空 ring。
- 遵守 `AGENTS.md` 架构护栏与 [[docs/ai/PROJECT-CONSTITUTION]]。

## Allowed Files
- `src/arona-clicker/runtime-commands.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- 新增文件：tests/engine/runtime-operation-observation.test.ts
- `tests/engine/spot-payment.test.ts`

## Explicit Non-goals
- 捕获直接 `game.spot.upgradeSpot()`、Shop/Item/Story/Theme 等操作或后台 Tick。
- 增加业务事件、DevLog operation ID、全局 trace、MCP/CLI/浏览器 endpoint。
- 调整 Spot 支付、GameNum、UI refresh、theme/DOM 或写存档迁移。

## Stop Conditions
使用 [[docs/ai/PROJECT-CONSTITUTION]]「停止条件」中的 6 条。另：若必须改 Unit Allowed Files 以外文件、必须改变业务提交次序，或当前 GameReadModel 查询对象并非预期 Runtime 实例，停止并交回上游。

## Completion Criteria
- [ ] 成功升级产生 capture；资源不足与 NotFound 返回结构化拒绝 capture。
- [ ] capture 的状态投影和原始结果只含固定字段、无内部对象引用；查询结果可被调用者修改而不反写 Runtime store。
- [ ] 观察记录的 source scope、截断/省略与生命周期状态可见；日志只按调用窗口归入。
- [ ] 观测读写不新增 GameNum/ValueSystem evaluate、mutation、事件、Stats、render 或随机消费。
- [ ] 测试验证拒绝零部分提交、ring 淘汰、JSON预算及 init/reset/load 清理。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-observation.test.ts tests/engine/runtime-operation-observation.test.ts tests/engine/spot-payment.test.ts tests/engine/runtime-spot-field-authoring.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 通过 |
| 全量测试 | `npm test` | 通过后 Task 才可完成；若失败按既有测试核验上报，不改无关测试 |

## 当前核验（2026-09-27）

- 已核对 Spot upgrade、StateMutationService、GameReadModel、DevLog 与相邻测试源码；未修改业务实现。
- Luna 子 Agent 只读报告复核了操作捕获边界、DTO 限额与 GameNum 副作用。
- 已运行 `npm run check:docs`（通过）；本 Task 的代码测试、类型检查和架构检查未执行，因为尚未施工。

## 剩余工作

- 本 Task 完成后，G01 仍需扩展至其它代表性操作或静态定义切片；G04/G03/G05 与 G02 的延期验收仍未完成。
- 本 Task 不提供 CLI/MCP 等外部传输层；后续只有在 Agent 实际无法消费 GameReadModel 查询时，再另行裁定适配入口。

## 相关路由

- [[draft-0159-agent-observability-query-contract]]
- [[docs/docs-828/01-architecture/data-flow]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/02-modules/game-num]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/task-read-set-routing]]
