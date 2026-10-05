# Unit 0236-U1-A：OperationFrame 共享真牌层与人物状态牌

## Goal
将独立行动牌层作为 `workspace-frame` 的直接子节点，令当前 Operation 区域 morph 能原子更新人物、行动牌、目标高亮及目标线；提供人物锚点与牌面所需 DOM/CSS 语义，并在人身份牌呈现 HP 与个人资源余额。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/task-0236-gameplay-b-typed-action-cards-and-target-layers.md` | 玩法、视觉契约与验收 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/frontend-design-project-overlay.md`、`docs/ai/galhcg-project-map.md` | Unit 白名单、DOM / 刷新预算与地图维护 |
| 文档 | `docs/docs-829/06-wiki/50-ui/refresh-update.md` | Operation UI 刷新连续性 |
| 验收入口 | `src/ui/main.ts:?gameplayBCardInspector=1`、`src/ui/development/gameplay-b-card-inspector.ts`、`tests/ui/gameplay-b-card-inspector.test.ts` | 复用隔离临时 Runtime 启动正式旋转木马 Operation，不新增入口 |
| 源码 | `src/ui/components/operation-workspace.ts:renderStudent/renderAction/renderOpponents`、`src/ui/components/workspace-frame.ts:WorkspaceFrameSpec/renderWorkspaceFrame`、`src/ui/css/operation-workspace.css` | 三栏共享 frame、牌面与层级实现 |
| 刷新边界 | `src/ui/controller.ts:refreshOperationWorkspaceRegion` | 当前只 morph `[data-workspace-frame="operation"]`；frame 兄弟 overlay 不会随状态刷新 |
| 测试 | `tests/ui/operation-workspace-view.test.ts` | 当前 Operation DOM 与牌层输出 |
| 参考 | `prototypes/gameplay-b/src/view.ts:showPreparedBatch/updatePreparedCardPositions`、`prototypes/gameplay-b/src/style.css:.prepared-card-layer/.prepared-action-card` | 原 Demo 的独立牌层与人物锚定结构 |
| 参考 | `prototypes/gameplay-b/src/view.ts:createCharacterCard/updateCharacterCard`、`prototypes/gameplay-b/src/style.css:.character-stats` | HP / sCost 人物信息层级 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–30k tokens |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- 仅测试事实不足时读取 UI callgraph / 浏览器入口，不扩读无关 UI 区。

## Do Not Read by Default
- `docs/plan-work/archive/**`、独立 Datapack Editor、未点名 UI 模块。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前行动牌节点嵌在人物计划 DOM 中，通过 disclosure 展开隐藏替代牌；牌上有“当前行动”标签。 | `src/ui/components/operation-workspace.ts:renderAction/renderStudent` | 改为人物锚定的共享行动卡牌层。 |
| Operation 区域刷新仅 morph 当前 `[data-workspace-frame="operation"]` 节点。 | `src/ui/controller.ts:refreshOperationWorkspaceRegion` | 共享牌层与 SVG 必须作为 frame 后代一起刷新，避免 Commit 后牌面过期；禁止放成外层兄弟。 |
| 当前 CSS 的行动关系线 z-index 为 90、actor highlight 为 30/60；嵌套 stacking context 可压过数值。 | `src/ui/css/operation-workspace.css` | 按真实浏览器 stacking context 验收语义顺序。 |
| OperationView Actor 提供 `hp/maxHp/resources`；行动 option 另有支付 `cost`。 | `src/arona-clicker/contracts/operation-view.ts` | 个人资源余额与行动支付额分别显示。 |

## Constraints
- 目标视觉结构须模仿原 Demo 的“独立卡面节点 + 共享牌层 + 人物锚点 / 定位更新”：学生卡只作为 owner 锚点；独立行动牌面须是共享 `.operation-prepared-card-layer` 的直接子节点，以 Actor ID 与对应身份卡关联。整个牌层须是 `workspace-frame` 直接子节点，以便 `refreshOperationWorkspaceRegion()` 在 Beat / plan 更新时一并 morph；不得将它放为 frame 兄弟或人物卡后代。
- 本 Unit 只负责 DOM、Workspace frame 承载与 CSS 表现；实际 owner/layer 几何计算、滚动 / 缩放重定位、开合和拖拽由 U1-B 实现。
- z 轴严格为身份卡 < 行动卡 < 所有合法目标高亮 < 目标线；frame 内 fixed overlay 必须通过 Edge 实证能穿出滚动列和 frame clipping。必须排查祖先 overflow / isolation / transform / stacking context。
- HP / maxHP、健康条与 actor-local 资源余额从 OperationView 只读。个人行动资源余额可使用 Gameplay B 的 sCost 信息位置；不得将 Action cost、Team Coordination 或 PlayerCost 伪装成个人余额。无个人行动资源显示 `—`。
- 当前行动牌面不出现“当前行动”微型文字标签；用牌位与选中态表达。

## Allowed Files
- `src/ui/components/operation-workspace.ts`
- `src/ui/components/workspace-frame.ts`
- `src/ui/css/operation-workspace.css`
- `tests/ui/operation-workspace-view.test.ts`
- `docs/plan-work/task-0236-units/u1-attached-action-card-layer.md`
- `docs/plan-work/task-0236-units/receipts/receipt-u1-attached-action-card-layer.md`

## Explicit Non-goals
- 不修改 Operation Runtime、目标合同、Registry、Datapack、玩家 SceneCard 与 `controller.ts` 的区域刷新算法。
- 不新增 theme / font system，不复制 Demo 底部替代牌按钮条。
- 不将本地 UI 草稿当作 Run 权威状态。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；共享牌层必须依托 `WorkspaceFrameSpec` 在 frame root 输出，如需修改白名单外宿主或刷新算法，先上报。

## Completion Criteria
- [ ] Operation `workspace-frame` 输出一个 `.operation-prepared-card-layer`，它是 frame 的直接子节点；每张独立行动牌是该共享层的直接子节点，以 Actor ID 保持与学生 owner 锚点的映射。
- [ ] `refreshOperationWorkspaceRegion()` morph frame 时能同时更新共享牌层、牌面状态、目标高亮、目标线；中心日志 / Dock / scroll 锚点仍可保留。
- [ ] 牌层 CSS 可承载人物右侧替代牌、disable reason、target highlight 和最高层连线；Edge 实测固定 overlay 跨列并穿出 frame / scroll clip，不只依赖 z-index 数字。
- [ ] 学生身份牌显示 HP/maxHP、健康条与适用 actor-local 资源余额；不能混淆 Action cost / Team / PlayerCost；mini 卡面不出现“当前行动”文字。
- [ ] mini 卡面无“当前行动”文本；学生身份卡显示 HP/maxHP、健康条与适用的 actor-local 资源余额，不混淆 Action cost / Team / PlayerCost。
- [ ] 浏览器实测身份卡 < 行动卡 < 全部目标高亮 < 目标线，含常规及窄视口；scroll / hover / focus / click 不破坏位置、焦点和滚动。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/operation-workspace-view.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 浏览器 | `npm run dev:game -- --host 127.0.0.1`；Edge 打开 `/?gameplayBCardInspector=1`，点击“启动隔离的 Gameplay B 检查”；常规与窄视口检查 frame fixed overlay | 不被列容器 / frame 裁切 |
| Receipt | 填写本 Unit Receipt | 记录自动与浏览器验证 |
