# Unit 0235-U11b：UI 路由、刷新与表现 Wiki

## Goal

解释界面如何在工作区间路由、选择刷新范围并解析主题/实体表现。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/50-ui/00-index.md`、`workspace-routing.md`、`refresh-update.md`、`presentation-theme.md` | 页面职责、路由和更新主题 |
| 源码 | `src/ui/workspace/` router/renderer、`src/ui/update/`、presentation/theme service | 核验状态 owner、更新区域和表现组合 |
| 测试 | `tests/ui/workspace-router.test.ts`、`tests/ui/controller-theme-cleanup.test.ts` | 主要路由/更新/清理验证 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 一个路由案例、一个刷新案例和一个表现案例 |

## Optional Read Set

- UI 项目覆盖协议，仅核实 refresh/focus 交互更新规则时阅读。

## Do Not Read by Default

- `docs/plan-work/archive/**`、所有 CSS 文件和图片资源。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| UI Wiki 把 Workspace、刷新更新和表现主题分为三个主题页。 | `06-wiki/50-ui/00-index.md` | 具体边界须读代码与测试。 |

## Constraints

- 区分路由状态、游戏状态、DOM 更新和表现解析。
- 交互刷新等级要与实际调用链一致，避免声称所有操作全量 render。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u11b-wiki-ui-navigation.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`

## Explicit Non-goals

- 不改变 UI 视觉、路由身份、DOM 调度或主题行为。
- 不制作重复组件目录导览。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；refresh 的调用区域或状态 owner 与现有文档冲突时，先记录调用链再修改。

## Completion Criteria

- [x] 每个功能页说明入口、拥有状态、下游消费和测试位置。
- [x] 读者能从一个常见操作追到影响区域和表现查询。
- [x] UI 总索引、模块卡、运行时页面互相链接。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| DOM/update 走读 | 按 Workspace route 和局部更新源码、测试核验 | 更新范围可解释 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U11b

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `docs/docs-829/06-wiki/50-ui/workspace-routing.md`、`refresh-update.md`、`presentation-theme.md`；本 Unit Receipt |
| 未完成内容 | 未运行真实浏览器视觉 / 交互验收；Unit 是已有 UI 路由、更新协议与表现数据流的文档审查，相关浏览器验收不是本 Unit Verification 必需项。未逐页检查所有视觉资产和 CSS。Operation workspace 组件 / 命令以及对应测试当时正在 [[docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers]] 并行修改；本 Unit 只审查当前 WorkspaceRoute / Renderer 投影入口，不把 Operation Surface 的展示与交互当作稳定结论，待相应交互复核。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 对 `50-ui/` 与本 Unit 路径执行 `review_changes`；刷新本 Unit 三页共 6 条直接 Wiki Evidence 和本 Unit 的 1 条 Evidence，两条 Wiki maps_to 边写后为 unchanged。共享 `concept:ui-workspace-renderer` 节点仍有两条对应页面 Evidence stale；其 node 更新 dry-run 因并行 Task 0236 的 `src/ui/components/operation-workspace.ts` stale token 被拒，留待该文件稳定后复核并一并更新节点 Evidence。未把当前 Operation UI 当作最终状态。 |

### 已审查证据

- 源码：`src/ui/workspace/workspace-router.ts`、`workspace-renderer.ts`、`src/ui/update/ui-surface.ts`、`ui-update-types.ts`、`ui-update-dispatcher.ts`、`ui-behaviors.ts`、`src/ui/controller.ts` 的 route / render / refresh 入口、`controller-events.ts`、`controller-theme.ts`、`presentation-service.ts`、`presentation-targets.ts`、`context.ts`、`src/arona-clicker/services/theme-content-editor-service.ts`。
- 测试：`tests/ui/workspace-router.test.ts` 覆盖路由进入 / 替换 / 返回与 Surface key；`ui-update-dispatcher.test.ts` 覆盖去重、过期 token 与优先级；`workspace-lifecycle.test.ts`、`workspace-frame.test.ts` 覆盖工作区生命周期；`presentation-service.test.ts`、`context.test.ts`、`controller-theme-cleanup.test.ts` 覆盖表现解析、回退与变量清理；`tests/engine/theme-content-editor-service.test.ts` 覆盖主题内容编辑的预览、写回和冲突拒绝。
- 规则：阅读 `docs/ai/frontend-design-project-overlay.md`，核实 scroll / hover / focus / 普通 click 的刷新等级约束。
- Wiki 修订：简化新人路由叙述，明确单层返回位置与 Surface token；把全页、面板、区域、元素、behavior 更新分别解释，并纠正“所有 controller 更新都经 dispatcher”的暗示；说明主题和实体表现的数据流及刷新选择，回链 UI 索引、模块与契约页。
- Review 结果：本 Unit 所审稳定实现与测试中未确认 P0–P3 运行时代码缺陷。局部面板刷新会按工作区类型尝试专用更新或 fallback；DOM 刷新级别依入口而异，没有把全量 render 归为普通输入的默认行为。Operation 路由仍可由当前 route / view 契约描述；该 Surface 的 UI 行为和相关回归测试待 Task 0236 完成后复核。

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 对照现有测试断言核实路径；本 Unit 只改文档。 |
| DOM / route 走读 | 对照 Router、Renderer、Surface、Dispatcher 和 Controller | 通过 | route 选组件；Surface generation 丢弃旧请求；局部更新与全量 render 按范围分支。 |
| 表现走读 | 对照 controller-theme、PresentationService、UIContext 与测试 | 通过 | Runtime theme / Registry / 资源 → 只读表现视图 → 宿主 / 组件查询 → DOM / CSS。 |
| 文档检查 | `npm run check:docs` | 通过 | 679 个 Markdown，errors: 0。 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 无 whitespace 错误；输出仅含并行修改的 TS 文件 CRLF 转换提示。 |

### 遇到问题 / 需上游确认项 / 事实更新建议

- 问题：无。
- 需上游确认项：无。
- 事实更新建议：后续如果 Surface key、Dispatcher 类型或 theme token 组装路径变化，同步复核此三页；本 Unit 未更改这些实现。
