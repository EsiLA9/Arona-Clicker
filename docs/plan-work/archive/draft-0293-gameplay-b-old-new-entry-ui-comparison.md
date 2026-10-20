# Draft 0293：Gameplay B 旧 / 新移植入口与 UI 对照

**状态：draft — 交接调查；源码核对截至 2026-10-18。**

> 2026-10-18 后续方向更正：负责人已确定新 UI 采用左我方／中 Talk 式信息流／右敌方与背景，暂时只用按钮、不移植卡牌，并统一参考外部三栏顶部分割。本页的旧布局复用建议以 [[docs/plan-work/archive/draft-0294-gameplay-b-three-column-ui-first-step]] 为准；以下入口、默认包与新旧语义事实仍作调查参考。

## 结论

Gameplay B 有两套不同入口：旧移植用 Spot `operationEntry → OperationEvent → Location / Scene → Operation Workspace` 启动整段关卡；新移植用 Spot `mapEntry → Map → Node / Edge / Encounter → MapRun / Map Workspace` 进入地图并沿相邻边移动。

当前应用默认只加载 Map-only `gameplay-b@1.0.0` 包。旧 Operation 内容不在默认运行包，只留在旧混合 Datapack / 定向测试夹具中。旧版可作为 UI 信息布局参考；玩法、路线和状态所有权继续遵从新 Map 合同。

## 两种入口

| | 旧 Operation 移植 | 新 Map 移植 |
| --- | --- | --- |
| Spot 功能 | `kind: operationEntry`，通过 `operationEventId` 指向旧 Operation Event。 | `kind: mapEntry`，通过 `mapId` 指向新 Map。 |
| 点击后 | 查询 Event 准入与阵容，启动 OperationRun，进入 `kind: operation` Workspace。 | 验证 Map，调用 `startMap`，进入或继续 `kind: map` Workspace。 |
| 数据组织 | Event 覆盖整段关卡；Event 引用地点与起点，Location 带行动 / Route / 结果，Location 可包含有序 Scene。 | Map 内嵌 Nodes、Edges 和 Actions；Node 可带 Encounter；Encounter 参与者引用 Action 并配置 Tendency 权重。 |
| 当前默认状态 | **不加载。**`gameplay-b-datapack.ts` 自注释为旧 Operation / Map 混合测试夹具，应用 bundle 不加载它。 | **当前默认入口。**`runtime.ts` 默认加载 `gameplay-b-map-datapack.ts`，其中 Spot 只声明 Map Entry。 |

入口类型与引用校验：`src/data-services/contracts/world.ts:117-129`、`src/data-services/registry/registry.ts:1281-1295`。默认包：`src/arona-clicker/runtime.ts:55-63,934-950`。旧夹具：`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts:79-116`。Map-only 包：`src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts:6-20,56-118`。

### 具体内容入口

旧 Operation 移植里有两个独立的关卡 Spot：

| Spot / 数据包 | 入口内容 | 当前状态 |
| --- | --- | --- |
| `gameplay-b:spot:operation_terminal` / `gameplay-b-datapack.ts` | Carousel 安全行动，以及 Atomic Scene、Purchase、Rest 三个演示 Event；旧夹具还混放了 Map。Carousel Event ID 是 `gameplay-b:operation-event:carousel-scene-action-slice`。 | 只作为旧混合测试夹具；默认运行包不加载。 |
| `gameplay-b-strategy-park:spot:park_terminal` / `gameplay-b-strategy-park.ts` | `strategy-park` Operation Entry 指向 `gameplay-b-strategy-park:operation-event:park-inspection`，内容有 13 个 Location。 | 独立旧 bundle 已从默认装载与旧包库恢复路径退役。 |

新 Map 移植复用第一个旧 Spot 的身份 `gameplay-b:spot:operation_terminal`，但在 `gameplay-b-map-datapack.ts` 中只挂 `mapEntry → gameplay-b:map:field-investigation`。这是同一设施位置承载的新入口，不表示旧 Operation Event 仍在默认包中；新的关卡位置和运行状态完全由 Map / Node / Encounter 定义。

两个 Workspace Route 仍是不同类型，渲染器分别读取 OperationView 与 MapRun Workspace view：`src/ui/workspace/workspace-router.ts:3-11`、`src/ui/workspace/workspace-renderer.ts:52-62`。Spot 的开始 / 继续按钮也由两个入口组件分别生成：`src/ui/components/operation-entry.ts:5-35`、`src/ui/components/map-entry.ts:5-34`。

### 旧旋转木马样例

“旋转木马安全行动”是旧 OperationEvent，不是新 Map。其 Location 依次为平台战斗、通道个人场景、出口全队场景；完成地点后才出现通往下一 Location 的 Route，通道有员工 / 游客两条路线。旧数据包含三名学生、两名对手和旋转木马环境 Actor。来源：`carousel-scene-action-slice.ts:49-125`、`carousel-safety-slice.ts:46-92,228-251`。

```text
OperationEvent
├─ Location：旋转木马平台（Combat）
│  └─ 完成后 Route → 游乐园通道
├─ Location：游乐园通道（Scene）
│  └─ Route → 出口集合点（员工通道 / 游客通道）
└─ Location：出口集合点（Scene）
```

旧 Location 是关卡阶段，不等于新 Node；旧 Route 是地点完成后的提交转场，不等于新地图上的相邻 Edge。旧合同见 `src/data-services/contracts/operation.ts:215-265,328-355`。

## UI 结构对照

旧 Operation Workspace 使用“我方 / 信息 / 对手”三栏，另有行动卡、关系线和地图弹层 overlay。左栏放队员卡、状态与准备行动；中栏放简报、地点进度、行动时间线、场景操作、路线、结果与 Cost / Commit dock；右栏放对手、环境、事实与持有物。见 `src/ui/components/operation-workspace.ts:589-620,644-714,1138-1235`。三栏角色由测试核实：`tests/ui/operation-workspace-view.test.ts:81-139`。

新 Map Workspace 沿用同一个三栏外壳，但栏位改为新玩法职责：

- **左：**所有 Node 的访问 / 完成状态、当前位置、起点与出口（`src/ui/components/map-workspace.ts:15-37`）。
- **中：**当前 Node 说明、相邻移动按钮；Encounter 活动时锁定移动（`src/ui/components/map-workspace.ts:52-95`）。
- **右：**Encounter 状态；战斗时显示 HP / 资源、每名角色的 Prepared / Target / 完整 Hand / PlayerCommand、Ability / Item、共享 Override、最近结算与 Commit（`src/ui/components/map-workspace.ts:129-187,217-385,388-429`）。

地图命令可局部刷新 Encounter 并保留焦点与滚动位置，见 `src/ui/controller.ts:1743-1834`。当前默认地图仍是“入口 → 现场 → 出口”的手动完成调查骨架，没有 Enemy roster（`src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts:56-91`）；Battle / Ability / Item 的 UI 覆盖来自合成测试 fixture，不代表默认内容已有完整战斗（`tests/ui/gameplay-b-map-workspace.test.ts:71-163,495-580`）。

## 复用建议

**推荐借用旧 UI 的结构与反馈：**

- 三栏 Workspace 外壳、标题 / 当前地点信息、角色卡片层级，以及对目标、费用、不可用原因和提交状态的明确展示。
- 每名角色的 Prepared Action、Target、完整 Hand 与可选操作放在同一角色组里；清楚标出自然准备、Swap、PlayerCommand 和 Wait。
- 将共享 Override、费用预览、Commit 状态和最近结算回执集中呈现；局部更新后保留地图位置、焦点和滚动。
- 当前 Map Workspace 已有这些基本分区，优先从现有结构补充 UI，不另建一套关卡界面。

**不要继承旧 Operation 的语义：**

- 不搬回“完成 Location 才可选 Route”；新地图位置以 MapRun 当前 Node 为准，玩家沿邻接 Edge 移动，遭遇结束后回同一 Node。
- 不要求新地图作者填写 Scene、SceneAction、Profile、CardPool、StrategyProfile、Objective / Outcome 等旧关卡包装。新内容合同以 Map / Node / Encounter / Participant Tendency / Action 为主。
- 新 Character Hand 是 Encounter-local 的 Action ID 候选，不是玩家物理卡组。免费 Swap 仅切换本轮候选；PlayerCommand 才花 PlayerCost 执行手牌外行动。不要把拖牌到角色作为唯一输入方式。见 `docs/plan-work/archive/task-0290-gameplay-b-action-draw-hand-swap-commit.md`。
- 不复制旧 `operation-workspace.ts` 按 Event ID 导入 Carousel / Strategy Park 文案和静态地图的分支（`operation-workspace.ts:1-5,94-115,173-186,937-1031`）；新 UI 从 MapRun Workspace view 投影读取内容。
- 保持 Map 的路线、当前位置、Encounter 三个新语义区域；不要机械地把栏位恢复成“角色 / 聊天 / 对手”。

```text
Spot.mapEntry → Map Workspace
  左：Map 节点进度
  中：当前位置与相邻移动
  右：Encounter（队员 Hand / Prepared / Target / 行动来源 / Override / Commit）
Encounter 成功 → 清理局部行为状态 → 回到原 Node
```

## 交接提醒

1. 旧 Operation 现在只是旧混合 Datapack / 定向测试夹具；测试能启动 Carousel 不代表默认应用仍有旧入口。
2. 新 Map UI 能力比默认 Map 样例丰富：默认内容目前是手动完成调查；完整 Battle 的 UI 测试用合成内容。
3. 一些 Map UI 测试仍从 `gameplayBCarouselDatapack` 获取 Map fixture（`tests/ui/gameplay-b-map-workspace.test.ts:5,22-29,183-193`），这不改变默认 bundle 只加载 Map-only 包的事实。Task 0292 已列出后续迁移干净 fixture 的工作（`docs/plan-work/archive/task-0292-gameplay-b-c5-authoring-and-retirement.md:44,54`）。
4. 本 Draft 只作入口 / UI 对照，不授权删除通用 Operation API，也不改 Task 0287 / 0290 已冻结的新玩法语义。

**主要 Read Set：**`src/ui/components/operation-workspace.ts`、`src/ui/components/map-workspace.ts`、`src/ui/controller-actions-operation.ts`、`src/data-services/contracts/world.ts`、`src/data-services/contracts/gameplay-map.ts`、Task 0288、Task 0290、Task 0292。

**Draft 0293 完。**旧实现提供结构与反馈参考；新玩法的数据和状态语义以 Map / Node / Encounter 为准。
