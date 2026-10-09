# Unit 0235-U11a：UI 命令与只读查询 Wiki

## Goal

把用户操作如何进入 Runtime、UI 怎样消费只读查询数据讲清楚。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/50-ui/00-index.md`、`controller-commands.md`、`read-model-context.md`、`02-modules/ui.md` | UI 命令与查询入口 |
| 源码 | `src/ui/main.ts`、`src/ui/controller.ts`、`src/ui/context.ts`、`src/arona-clicker/contracts/runtime.ts`、GameReadModel 入口 | 核对写命令与只读数据边界 |
| 测试 | `tests/ui/controller-events.test.ts`、`controller-init-select.test.ts` | 输入调用链证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 选一个典型用户输入和一类 view，避免展开所有 Controller action |

## Optional Read Set

- `docs/docs-829/03-data-structures/game-view.md`，检查数据契约时读。

## Do Not Read by Default

- `docs/plan-work/archive/**`、与命令/查询无关的全部组件样式。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| UI Wiki 当前分别有 Controller 命令和 ReadModel/UIContext 主题。 | `06-wiki/50-ui/00-index.md` | 按实现判断哪些操作走 Runtime command。 |

## Constraints

- 明确 UI 输入的实际写 facade 与查询数据的只读方向。
- 只在代码确实存在时称为 command、event 或 projection。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u11a-wiki-ui-input-read.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/50-ui/00-index.md`
- `docs/docs-829/06-wiki/50-ui/controller-commands.md`
- `docs/docs-829/06-wiki/50-ui/read-model-context.md`

## Explicit Non-goals

- 不改 UI 命令 API、组件组织或 Runtime 接口。
- 不复制完整 View DTO 定义。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；发现 UI 直接写状态或通过特殊 facade 时按实际代码记录，暂停概括规则。

## Completion Criteria

- [x] 操作链和读链各有源码、测试与继续阅读链接。
- [x] UI 读到的 View 与服务写入口没有混为“UI 管理状态”。
- [x] 本页可被新人导读页引用且返回 UI 分区索引。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 输入/读链检查 | 对照一条 Controller 调用与一条查询 | 方向准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U11a

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/50-ui/00-index.md`、`controller-commands.md`、`read-model-context.md`；本 Unit Receipt |
| 未完成内容 | 未审阅所有 Controller Action / 所有 View DTO 字段，符合 Unit Do Not Read by Default / Explicit Non-goals。GameReadModel 当前含 `operationEntry` 只读查询契约；对应 Operation UI 组件 / 命令与回归测试当时正由 [[docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers]] 并行修改，不把其未提交状态作为稳定基线；只确认本页所述查询契约形状，具体 Operation UI 行为待后续复核。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 对 `50-ui/` 与本 Unit 路径执行 `review_changes`；刷新本 Unit 两页共 3 条直接 Wiki Evidence 和本 Unit 的 1 条 Evidence。写后复核：这些直接映射 owner unchanged、stale 0。`00-index.md` 无既有直接 Evidence / maps_to，不新建泛化 Concept。 |

### 已审查证据

- 源码：`src/ui/main.ts` 的 `boot()`、`src/ui/controller.ts` 的构造与 `mount()`、`src/ui/controller-actions-inventory.ts` 的 Spot 支付输入、`src/ui/controller-events.ts`、`src/ui/context.ts` 的 `createUIContext()`、`src/arona-clicker/contracts/runtime.ts` 的 `GameReadModel` / `GameCommands`、`src/arona-clicker/runtime-commands.ts` 的 `createGameCommands()`、`runtime-game-instance.ts` 的 `getView()`。
- 测试：`tests/ui/controller-events.test.ts` 验证事件到 UI 局部响应；`controller-init-select.test.ts` 验证选择 Init 后视图状态；`context.test.ts` 验证上下文对宿主表现的读取与回退。每个测试只支持其断言的行为范围。
- Wiki 修订：UI 总索引新增逐步阅读和输入 / 查询两条路线；命令页解释一次 Spot 升级调用及 Controller / Runtime / Mutation 职责；只读页说明 GameView、GameReadModel、UIContext 的关系，并保留专用投影查询及不深度冻结的边界。
- Review 结果：本 Unit 所审稳定调用链中未确认 P0–P3 运行时代码缺陷。查询状态与写入能力清晰分属只读 GameReadModel / UIContext 和 Controller 的 GameCommands 门面。Operation `operationEntry` 路由行为未作稳定性结论；须在 Task 0236 完成后复核该 UI 区域及回归测试。
- 完整例子：一次 Spot 升级可从 `controller-actions-inventory.ts:executeSpotPayment()` → `GameCommands.upgradeSpot()` → `SpotService.upgradeSpot()` → `StateMutationService.commitSpotTransaction()` 追到。状态与统计先提交，随后按变化发事件；Controller 再独立刷新右面板，UIContext 从 GameReadModel / GameView 读取。已将调用、事件通知与只读数据流分别写入命令 Wiki，并核对 `tests/engine/game-instance.test.ts`、`tests/ui/spot-payment-modal.test.ts`、`tests/ui/controller-events.test.ts` 的各自断言范围。没有单一端到端测试覆盖这条完整链路，未将分立测试描述成端到端证明。

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 检查已有测试源码作为行为证据；本 Unit 只改文档。 |
| 输入 / 查询走读 | 对照上述实现与测试 | 通过 | `executeSpotPayment` → `GameCommands` → Runtime Spot 服务 / Mutation；组件通过 GameReadModel、GameView 与 UIContext 查询。 |
| 文档检查 | `npm run check:docs` | 通过 | 681 个 Markdown，errors: 0；任务最终复验通过。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无 whitespace 错误；输出仅含并行修改的 TS 文件 CRLF 转换提示。 |

### 遇到问题 / 需上游确认项 / 事实更新建议

- 问题：无。
- 需上游确认项：无。
- 事实更新建议：无；本 Unit 已在限定页面记录核实结果。
