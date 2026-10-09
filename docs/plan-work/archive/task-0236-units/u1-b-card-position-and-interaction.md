# Unit 0236-U1-B：人物锚点定位与牌面交互

## Goal
在 U1-A 的共享牌层结构上实现可持续更新的人物锚点几何、右侧替代牌开合、合法目标拖放和键盘等价操作，不通过全量 render 或拖动中写 Run 实现交互。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers.md` | 交互契约与验收边界 |
| 前置 Unit | `docs/plan-work/archive/task-0236-units/u1-attached-action-card-layer.md` 及其 Receipt | 共享 frame layer 的最终 DOM 约定 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/frontend-design-project-overlay.md`、`docs/ai/galhcg-project-map.md` | 白名单、交互连续性与地图维护 |
| 文档 | `docs/docs-829/06-wiki/50-ui/refresh-update.md` | behavior/region 刷新边界 |
| 源码 | `src/ui/controller-actions-operation.ts:pointer handlers / operation action event handlers` | 当前拖放、目标命中和 Operation 命令边界 |
| 源码 | `src/ui/controller-actions-operation.ts:observePreparedCardLayout / disposeOperationActions` | Operation observer 生命周期与重复开关清理 |
| 源码 | `src/ui/components/operation-workspace.ts:renderAction / renderActionTargetTray` | 当前行动目标沿用当前计划；替代牌与目标 tray 使用自身默认目标 |
| 源码 | `src/ui/controller.ts:UIController.destroy` | controller 销毁时释放 Operation listener、observer 与 pending frame |
| 源码 | `src/ui/development/gameplay-b-card-inspector.ts:overlay keydown / closeSession` | 检查器 Escape 关闭必须尊重 Operation 已消费的局部 Escape |
| 测试 | `tests/ui/gameplay-b-operation-controller.test.ts` | pointer / keyboard / cancel 流程 |
| 测试 | `tests/ui/operation-workspace-view.test.ts` | 确认替代牌默认目标摘要及 tray 选中目标来自该 option |
| 测试 | `tests/ui/gameplay-b-card-inspector.test.ts` | 验证已消费与未消费 Escape、显式退出按钮的集成行为 |
| 参考 | `prototypes/gameplay-b/src/view.ts:updatePreparedCardPositions`、`prototypes/gameplay-b/src/style.css:.prepared-card-layer/.prepared-action-card` | 真卡层的 owner 锚点重算及交互参考 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- 仅在定向测试不足时读取 UI callgraph；不得扩读无关 UI 区。

## Do Not Read by Default
- `docs/plan-work/archive/**`、独立 Datapack Editor 和未点名 UI 模块。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 Operation root 使用事件委托处理行动牌 pointer drag，drop 命中 `[data-operation-actor-target]` 并只对 legal target 落定。 | `src/ui/controller-actions-operation.ts:pointerdown/pointermove/pointerup` | 目标列表由 OperationView 的 legal IDs 注入牌面。 |
| Operation frame 更新通过区域 morph 保留身份与焦点；牌层作为 workspace-frame 直接子节点会参与相同 morph。 | `src/ui/controller.ts:refreshOperationWorkspaceRegion`、U1-A | 不增加单独的 Run 写入或外层 overlay 刷新路径。 |
| 游戏牌操作已有可取消 pointer capture / cancel / lost capture 路径。 | `tests/ui/gameplay-b-operation-controller.test.ts` | 在新 DOM 上保留取消行为并验证无 Run 写入。 |

## Constraints
- 依赖 U1-A，所有可交互节点和锚点属性应已由 U1-A 的模板提供；需要改变 markup / CSS 时停止并修改 Unit 白名单。
- owner 是学生人物身份卡；行动牌按 `data-actor-id` 关联 owner；位置使用 owner 与 `.operation-prepared-card-layer` 的 `getBoundingClientRect()` 几何转换。
- mount、滚动、窗口缩放与 owner / layer 尺寸变化后重算；不得因 scroll、hover、focus 或普通 click 触发 full render。
- 当前牌单击开/关右侧替代牌组；目标型替代牌鼠标 click 不选牌、不打开 target tray，只有拖到 OperationView 指定的合法 Actor 才选择；键盘 Enter 打开该替代牌自己的目标 tray 并可设置目标。禁用牌不可拖拽；无目标行动可键盘激活。
- target tray 的 `aria-pressed=true` 只表示当前计划的已选目标；替代牌默认目标用 `data-default-target` 标记，不伪装成已选项。键盘打开 tray 后先聚焦真实已选项，无已选项时聚焦该 option 的默认目标。
- 拖动过程不写 Run；只有合法 drop 后调用现有单名学生干预预览 / 命令。非法 drop、cancel、lost capture 不修改 Run 与干预槽。
- 目标线须高于所有合法目标高亮；identity < action < highlight < line 关系以 U1-A DOM/CSS 为底，必须 Edge 实测。

## Allowed Files
- `src/ui/controller-actions-operation.ts`
- `src/ui/components/operation-workspace.ts`
- `src/ui/controller.ts`
- `src/ui/development/gameplay-b-card-inspector.ts`
- `tests/ui/gameplay-b-operation-controller.test.ts`
- `tests/ui/operation-workspace-view.test.ts`
- `tests/ui/gameplay-b-card-inspector.test.ts`
- `docs/plan-work/archive/task-0236-units/u1-b-card-position-and-interaction.md`
- `docs/plan-work/archive/task-0236-units/receipts/receipt-u1-b-card-position-and-interaction.md`

## Explicit Non-goals
- 不改变 Operation Workspace 结构、WorkspaceFrame、CSS、Runtime、目标合同、Registry、Datapack 或存档；仅允许修正既有行动牌及 target tray 的目标摘要 / 默认选中目标投影。
- 不增加另一个调试入口或把本地拖拽状态写进 Run。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；交互所需 data attribute / CSS contract 缺失时停下并报告，不自行改白名单外文件。

## Completion Criteria
- [x] 每个学生牌面从对应 owner 的实际矩形计算位置；滚动、resize 与 owner/layer 尺寸变化后位置同步。
- [x] 单击当前牌开合右侧替代牌组；目标型替代牌鼠标 click 不选行动也不打开目标 tray，Pointer drag 只在合法目标释放时选择；键盘 Enter 可打开该牌自己的目标路径并设置目标。`aria-pressed` 只标记当前 action 的已选目标；替代牌 / tray 用 `data-default-target` 表示自身默认目标，键盘聚焦该默认项。替代牌摘要使用自身默认目标，当前牌沿用当前计划目标。
- [x] Pointer drag、合法 drop、非法 drop、cancel 与 lost capture 通过定向测试；非法路径不改干预槽 / Run。拖动使用统一 Pointer Events 路径；本轮未作触摸设备仿真。
- [x] Operation 已消费的 Escape 只关闭局部牌面交互、不退出检查器；未消费 Escape 和显式退出按钮仍能关闭检查器。
- [x] `UIController.destroy()` 幂等释放 Operation scroll listener、MutationObserver、ResizeObserver 与 pending rAF；已销毁 controller 不会再次安排牌层布局。
- [x] IAB 拖动实测目标线高于合法目标高亮；替代牌选择和操作不触发 full render，不破坏滚动、焦点与未变化人物卡身份。Edge stacking / clipping 实测仍在 Task 级待办。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts` | 通过 |
| 牌面投影测试 | `npx vitest run tests/ui/operation-workspace-view.test.ts` | 通过 |
| Inspector 集成测试 | `npx vitest run tests/ui/gameplay-b-card-inspector.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 浏览器 | 复用 U1-A 的 Edge inspector，在常规与窄视口拖拽并键盘操作 | 锚点、层序和连续性符合 Task |
| Receipt | 填写本 Unit Receipt | 记录实际修改 / 验证 |
