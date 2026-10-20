# Unit 0288-U8：从普通 Spot 入口跑通 Map 端到端路径

## Goal
将真实样例 Map 绑定到普通 Datapack Spot，并从正常游戏 UI 验证进入 Map、移动 A→B、完成 Encounter、回到 B、移动到 C 的完整路径。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 原因 |
|---|---|---|
| 文档 | `docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md` | 端到端冻结验收 |
| 文档 | `docs/docs-829/04-mechanisms/data-services/pack-loading.md`、`docs/docs-829/05-conventions/testing.md` | 正常包入口与 UI 验收要求 |
| 源码 | `src/ui/components/production.ts`、`src/ui/components/operation-entry.ts` | Spot Functionality 的渲染入口 |
| 源码 | `src/ui/controller-actions-operation.ts` | 当前 Spot 功能的 delegated actions 模式 |
| 源码 | `src/ui/controller.ts` 的 `requestUIUpdate()` 与 Operation Workspace region refresh | Map 命令后做局部工作区刷新，不全量重绘应用 |
| 源码 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts` | 已启用包内 Map 与 mapEntry Spot 的真实内容 |
| 测试 | `tests/ui/gameplay-b-operation-entry-registry.test.ts` | 普通 Spot 到实际 Controller 的集成模式 |

## Context Budget
- 目标 15k–30k tokens；历史文档 0 篇。

## Confirmed Facts
| 事实 | 依据 |
|---|---|
| Spot Functionality 由普通生产 UI 渲染并通过 Controller 委托处理。 | `components/production.ts`、`controller-actions-operation.ts` |
| C1a 明确禁止直接构造目标 Runtime 对象冒充正常入口验收。 | Task 0287 C1a / Task 0288 验收 |
| UI `region` 更新只处理明确支持的 Workspace 区域；Map Workspace 需一个窄 Controller refresh handler。 | `src/ui/controller.ts` 的 `applyUIUpdate()` |

## Constraints
- U3 已将 Map 与 Spot Entry 加入正常启用的 gameplay-b bundle；本 Unit 不改 Pack 注册或 Registry。
- Spot 功能明确提供 mapEntry 的开始 / 继续入口，引用值来自 Datapack，不硬编码 Map ID。
- Encounter 的完成按钮和文案由 `completion: { kind: "manual", label }` 驱动；无该声明的 Encounter 不接受手动完成请求。
- Spot 进入和 Map Workspace 返回属于路由变化；移动与 Encounter 完成必须经 Controller 的 Map Workspace region handler 局部刷新，不能对普通操作调用 `controller.render()` 全量重绘。Map UI 可以保留单层返回位置，但不能用 `PanelState.workspace` 复制 MapRun 状态。
- 真实测试从正常 Runtime / 默认包加载与 Spot UI 进入；不得用手工 `init([...])` 注入 Map 包替代正式加载；至少做一次正常 UI 操作流程或仓库等价的实际 UI 集成回放。
- 遭遇完成后必须停留在 B；继续至 C 由用户再次点击相邻节点。
- 禁止把旧 `operationEntry`、Operation Event 或 Strategy Park static map 用作隐式桥接。

## Allowed Files
- New file: src/ui/components/map-entry.ts
- src/ui/components/production.ts
- src/ui/controller-actions-operation.ts
- src/ui/controller.ts
- New file: tests/ui/gameplay-b-map-vertical-slice.test.ts
- docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice.md (only append verification evidence and status)

强制流程记录：`docs/plan-work/archive/task-0288-gameplay-b-map-node-vertical-slice-units/receipts/receipt-U8-normal-entry-and-e2e-acceptance.md`；不计入上述实现文件预算。

## Explicit Non-goals
- C5 删除旧 Spot / Event / Map 内容，替换旧样例包，修改生成 Schema。
- C2–C4 行为、抽卡、战斗、奖励或商店。

## Stop Conditions
1. UI 入口依赖 PackManager / Registry / Controller 的其他白名单外注册代码，或局部刷新需要改造 Controller 通用更新架构而非添加窄 Map region handler。
2. 测试必须直接构造 MapRun 或硬编码 Map ID，才能走通真实入口。
3. 需要全量重写 `controller-actions-operation.ts`、修改生成 Schema 或删除旧入口。
4. 端到端验收不可执行、失败或结论无法解释。

## Completion Criteria
- [ ] 普通 Spot 上显示 Datapack 提供的 Map Entry，能开始并继续活动 MapRun。
- [ ] 通过正常 Registry / Resolver 解析样例，不使用 demo-only loader。
- [ ] 实际 UI 路径完整通过 A→B→Encounter→End→B→C，出口处 Run 成功结束。
- [ ] 移动与 Encounter 完成只刷新 Map Workspace 区域；进入和返回只做必要的 Workspace 路由切换。
- [ ] Map 上非相邻移动、Encounter 中移动与非法完成均被拒绝且状态不变。
- [ ] 证据写回 Task 与 Receipt，并由非施工者独立审查。

## Verification
| 项 | 命令 / 方式 | 期望 |
|---|---|---|
| 定向 UI 集成 | `npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档检查 | `npm run check:docs` | 通过 |
| 手工/浏览器 | 从正常游戏 Spot 入口操作完整链路 | 实际看到 A→B→Encounter→B→C |
