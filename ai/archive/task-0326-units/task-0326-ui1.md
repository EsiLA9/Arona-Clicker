# Patch Unit 0326-UI1：Spot 直入真实 Map Workspace

> Parent Task: [[ai/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[ai/archive/task-0326-units/task-0326-ui1]] · Receipt: [[ai/archive/task-0326-units/receipts/task-0326-ui1-receipt]]

### Goal

夏莱演练场入口点击一次后调用主 Agent 提供的 `ctrl.commands.enterVariantTraining(spotId, functionalityId)`，成功直接进入现有 `map {runId}` Workspace；失败在 Spot 原位提示。已有活动演练点击后直接续行。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | [[ai/archive/task-0326-variant-translation-real-card-workspace]]“范围与推荐合同”“P2”“完成定义” | 固定用户流程和 UI 边界 |
| 文档 | `ai/guide/context-packs/world-lifecycle.md` | 核对 Spot / Init 入口语境 |
| 文档 | `ai/guide/context-packs/ui-presentation.md` | 核对游戏 UI 施工与验证入口 |
| 文档 | `ai/guide/frontend-design-project-overlay.md` | 刷新、DOM 连续性与浮层边界 |
| 文档 | `ui-style/00-index.md`、`ui-style/patterns.md` | 复用 Spot 按钮与 Map 三栏工作区 |
| 文档 | `ai/archive/docs-829/06-wiki/50-ui/refresh-update.md` | Map 的局部刷新与 MapEntry 现有回路 |
| 文档 | `ai/guide/conventions/testing.md`、`ai/guide/PROJECT-CONSTITUTION.md` | 行为回归、白名单与 Receipt 纪律 |
| 源码 | `src/ui/controller/controller-actions-variant-training.ts`：`bindVariantTrainingActions`、`validateEntry` | 入口事件与快速 Spot 校验 |
| 源码 | `src/ui/controller/controller-actions-operation.ts`：MapEntry start / resume / return handlers | 复用 Map 路由和返回路径 |
| 源码 | `src/ui/components/map/map-workspace.ts`：`renderActiveCenter`、`renderActionDock` | 标题、内容和真实卡牌区域展示 |
| 测试 | `tests/ui/variant-training-spot-entry.test.ts` | 替换旧 Modal 流程为直入回归 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 约 20k tokens；不扩大到 Runtime 实现审查 |
| 文档 Read Set | 8 篇加本文；仅限 UI / Spot 入口所需内容 |
| 历史文档 | 0 篇 |
| 超预算处理 | 触及领域合同或额外实现文件时停止并上报 |

### Optional Read Set

- `src/arona-clicker/contracts/runtime/runtime.ts`：仅核对 Map Workspace 已投影字段；新命令实现由主 Agent 负责。
- `tests/ui/gameplay-b-map-workspace.test.ts`：仅在需要确认已有 Map 标题 / 操作 DOM 结构时读取。

### Do Not Read by Default

- `ai/archive/**` 与 Task0324/0325 归档实现记录。
- `src/arona-clicker/**` 领域实现目录、`src/ui/workspace/map-dom-updates.ts` 与无关 Workspace。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前正式入口打开训练 Modal，并经 `VariantTrainingPort` 调用预览、开局和回合提交 | `src/ui/controller/controller-actions-variant-training.ts`：`bindVariantTrainingActions`、`guardedPort` | 本 Unit 移除正式入口对这条流程的依赖 |
| 入口快速校验已核对 Spot、当前 Area、utility reveal、功能和条件 | 同文件：`validateEntry` | 继续保留为 UI 反馈；领域命令仍负责授权 |
| Map Center 已展示当前 Node 的 `title` 和 `description` | `src/ui/components/map/map-workspace.ts`：`renderActiveCenter` | 新战次内容由主 Agent 写入定义，不在 UI 复制 |
| Controller 已提供 `enterWorkspaceRoute` 和 `returnFromMapWorkspace` | `src/ui/controller/controller.ts` | 成功后进入 `map` 路由并保留 Spot 返回位置 |
| 普通 MapEntry 的返回与 Map Workspace 行为在 `controller-actions-operation.ts` 分支处理 | 同文件：`data-map-back-to-entry`、`data-map-back` | 演练入口不插入 MapEntry |

### Constraints

- UI 只做快速入口提示、调用主 Agent 提供的命令和投影 Map Workspace；领域命令内部复验 Spot / Area / utility / functionality / condition / active Init。
- 保留现有 Map Frame、真实 Prepared / Hand / target / commit 操作；入口点击不重建其他 UI Shell。
- 入口路由使用 `{ kind: 'map', runId }` 并保留原 Spot 返回位置；活动 Run 再次点击应直接续行。
- 遵守 [[ai/guide/PROJECT-CONSTITUTION]] 的 Unit 白名单及停止条件。

### Allowed Files

- `ai/archive/task-0326-variant-translation-real-card-workspace.md`（仅单位索引）
- `ai/archive/task-0326-units/task-0326-ui1.md`
- `ai/archive/task-0326-units/receipts/task-0326-ui1-receipt.md`
- `src/ui/controller/controller-actions-variant-training.ts`
- `src/ui/controller/controller-actions-operation.ts`
- `src/ui/components/map/map-workspace.ts`
- `tests/ui/variant-training-spot-entry.test.ts`

### Explicit Non-goals

- 不修改 Runtime / commands 合同与领域实现，不创建 MapRun 或训练 owner。
- 不改 Map 内容、MapEntry Workspace 或 `src/ui/workspace/map-dom-updates.ts`。
- 不添加来源选择、Modal、转译预览或 UI 自有战次标题 / 内容。
- 不修改 `ui-style/`；现有 Spot pattern 条目需由任务负责人评估是否随正式入口变更更新。

### Stop Conditions

应用 [[ai/guide/PROJECT-CONSTITUTION]] §停止条件的六项：遇到白名单外改动需求、新文件或超预算、Read Set 外读取超限、源码与 Task 冲突、需要新增机制或改变架构边界、必需验证无法执行 / 失败且无法解释时，停止并上报。

### Completion Criteria

- [ ] Spot 点击先执行 `validateEntry` 快速提示，再调用 `enterVariantTraining(spotId, functionalityId)`；命令错误原位 toast，不改变路由。
- [ ] 成功一次进入带真实 `data-workspace-frame="map"` 的 `{ kind: 'map', runId }`；没有训练 Modal、来源选择或 MapEntry 中转。
- [ ] Map Workspace 复用主 Agent 定义的战次标题与描述，并保留真实卡牌操作区。
- [ ] 活动 Map 头部返回在无 `mapEntrySource` 的演练路径直接回 Spot；普通 MapEntry 来源仍沿原准备页路径返回。
- [ ] 成功 / 失败结果页现有 `data-map-back` 直接回 Spot；重新游戏后仍是同一冻结演练的第一战。
- [ ] 从 Map 返回后再次点击直接续同一活动演练 Run。
- [ ] 普通 MapEntry 行为不回归；已知 `schedulerTerminal` 预览字段仅在其正确只读投影提供后用于显示条件终结提示。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Red / Green 行为测试 | `npx vitest run tests/ui/variant-training-spot-entry.test.ts` | 新用例先因 Modal / Map route 不符失败；接线完成后通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增 UI 类型错误；Runtime 投影变更由主 Agent 合并验证 |
| DOM / 返回路径 | 同一定向 UI 测试 | 无 Modal 与 MapEntry 中转，返回 Spot 后同 Run 可续行 |
