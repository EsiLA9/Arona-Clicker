# Task：Gameplay B 基础地图玩法 P0—P3 实施与验收

**状态：completed（2026-10-18）— P0 → P1 → P2 → P3 已按阶段施工并通过定向验收；未做浏览器人工验收，未运行全量测试**

**任务性质：** 基于现有 Map-only Gameplay B / MapRun 增量扩展玩法内容、数据表达与 Runtime 行为，并完成真实 Datapack、UI 和自动化测试验收。

**核心目标：** 用四组最小关卡证明 Gameplay B 能支持单向线性战斗、单 Node 顺序多活动、单向分叉地图以及连续遭遇和条件路径，而不重新引入旧 Operation / Location / Scene 的复杂编排结构。

## 任务登记与实施准入（2026-10-18）

- **编号：** Task 0295。
- **来源：** 负责人本轮提供的《Gameplay B 基础地图玩法 P0—P3 实施与验收》需求；下文保留完整目标和验收条款。
- **登记轮授权：** 建立 Task 文档与索引；当时状态为 proposed。同一 2026-10-18 会话随后授权按本文范围施工，实际结果见下方“阶段完成记录”。
- **阶段顺序：** P0 → P1 → P2 → P3；上一阶段有实际完成记录后，才进入下一阶段施工。具体字段与数值在各阶段定向调查后收口，需求中的“例如 / 推荐 / 可以”不自动升级为冻结实现合同。

### 当前事实与代码落点

以下是建立 Task 时的源码基线；施工前按阶段复核，不以旧 Task 状态代替当前实现。

| 已核实事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 默认 Runtime 装载 Map-only Gameplay B，正式入口为 Spot.mapEntry | `src/arona-clicker/runtime.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts` | 各阶段样例沿现有包与入口加载，不新增 Demo Loader |
| 当前 Node 只有可选的单个 encounter；Edge 只有起点与终点；尚无有序活动列表、Rest 轮数、Shop Offer 或 Edge Condition 作者字段 | `src/data-services/contracts/gameplay-map.ts` | P1 / P3 是待设计的窄扩展；P2 有向邻接可优先复用，不预设必须改 Runtime |
| 唯一 MapRunService 已包含 HP、Enemy、Hand、Swap / PlayerCommand、Ability / Item 与整轮结算 | `src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/contracts/map-run.ts` | P0 核验已有能力，P1—P3 继续扩展同一 Owner |
| 默认包已有现场调查路线与极简战斗演练；后者为两名队员、一个敌人、一个普通攻击 Action | `src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts` | 极简战斗可作 P0 起点，但单一候选无法证明 Swap / Hand 外 PlayerCommand，不能据此宣告 P0 完成 |
| 上轮极简战斗已通过正常启动、还击、胜利回图与出口的 UI 测试 | `tests/ui/gameplay-b-map-vertical-slice.test.ts` | 这是既有局部证据，本次文档登记未重跑游戏测试；完整 P0 仍须覆盖失败、干预、幂等和存档 |

### 与既有 Task 的责任边界

- [[docs/plan-work/task-0287-gameplay-b-semantic-convergence-and-minimal-loop]] 保留原总控与未完成目标；本 Task 提供基础地图玩法 P0—P3 的独立验收边界，不将原总控自动标记完成。
- [[docs/plan-work/task-0291-gameplay-b-hp-enemy-ability-item]] 是战斗 HP、Enemy、Ability / Item、事务和失败合同来源。P0 复用并核验该实现，缺口以实际证据记录，不重复重建战斗系统。
- [[docs/plan-work/task-0292-gameplay-b-c5-authoring-and-retirement]] 已包含 Rest / Shop / Branch、独立 Editor 和旧内容退役。0295 的 P1—P3 与其中玩法部分重叠：施工批准时须明确共享实现和验收收据归属，不维护两套字段或行为合同。独立 Editor 全量作者支持、旧 Operation 专属源文件与测试退役仍归 0292，本 Task 不默认为其授权。
- [[docs/plan-work/task-0294-gameplay-b-three-column-button-ui]] 提供现有三栏与按钮交互基线。沿用现有 UI；如需设计或重塑布局，使用 frontend-design skill 并读取 UI 领域约定。

### 分阶段调查与施工边界

| 阶段 | 优先 Read Set | 获准施工后的修改边界 | 准入时必须明确 |
| --- | --- | --- | --- |
| P0 | MapRun / Hand / Preview、战斗事务与保存、正式包与正常入口测试 | 默认地图内容、定向回归；仅实际缺陷所需的直接 Runtime / UI 调用方 | 可演示手牌内 Swap 与手牌外 PlayerCommand 的合法候选、费用与战斗数值；继承现有全队败北合同 |
| P1 | Map / Run 合同、Registry / Resolver、Commit / Receipt / Restore、Workspace / Controller | 固定顺序活动的最小合同与状态、Rest / Shop、正式样例及定向测试 | 单 encounter 与列表的互斥 / 校验；稳定活动身份；两轮 Rest 结束规则；HP / PlayerCost 恢复效果；Shop 支付、发货与离开事务 |
| P2 | 有向移动、节点完成与资源继承、地图 View、P1 样例 | 分叉正式内容、地图可达性投影与必要修复、定向测试 | 两条路线的具体代价与收益；汇合点可观察结果，不要求新分支系统 |
| P3 | MapRun-local 效果 / 状态、移动权威校验、Save / Resume、已验收 P1 / P2 | 有限条件 Edge、临时通行状态、连续与条件样例、定向测试 | 通行状态唯一表示、授予与保存规则、条件读取范围；优先只读且不消耗的 Gate；保留默认通路 |

每阶段实际施工前再按 [[docs/ai/PROJECT-CONSTITUTION]] 制定有界 Patch Unit / Read Set / Write Set；本表不授权直接跨层修改。修改状态写入口或归属时读 [[docs/docs-829/05-conventions/architecture-discipline]]；Schema 变化读 [[docs/docs-829/05-conventions/schema-sync]]。

**生成文件边界：** 下文“同步生成 Schema”表示必须解决作者字段与校验一致性，不授权修改根 AGENTS.md 禁改的生成文件。优先采用 Task 0292 所述维护中的 Editor Schema 源与覆盖 / roundtrip 校验；若无法满足，应明确记录冲突并取得裁定，不手改或提交禁改生成结果。

### 阶段完成记录

| 阶段 | 当前状态 | 完成证据 |
| --- | --- | --- |
| P0 | completed | 原实现核验通过，未做无关重构；新增三节点线性战斗正式 Map `gameplay-b:map:linear-battle`。14 项引擎用例覆盖移动锁定、胜利 / 失败分离、Swap、PlayerCommand、过期草稿 / 提交、`requestId` 幂等、存档恢复 |
| P1 | completed | 新增 `activities` 有序活动、活动身份、Rest `rounds` 与 Shop 报价合同；正式 Map `gameplay-b:map:activity-hall` 按 Battle → Rest → Shop 自动推进；Shop 购买 / 离开原子结算并可中途存档恢复 |
| P2 | completed | 正式 Map `gameplay-b:map:forked-route`：A→B / A→C 单向分叉、B / C 汇合到 D、D→E；两条独立 Run 均完成，逆向与跨边移动被拒绝，路线资源差异在 D 可观察 |
| P3 | completed | 正式 Map `gameplay-b:map:continuous-conditional`：B 战斗 → C 休整 → D 商店跨 Node 连续内容，C→F 读取 MapRun-local `pass`；Gate 拒绝 / 放行、Read-only 不消耗、存档保留、默认通路 D→E 均验证 |

#### P0 实际修改与核验

- **未改动 Runtime 合同**：P0 只新增正式内容 `src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts` 中的 `gameplayBLinearBattleDefinition` 与 Spot `mapEntry`，沿用 `MapContentResolver` → `MapRunService` → `MapWorkspaceView` 既有链路。
- **核验不变量**（`tests/engine/gameplay-b-basic-map-p0-p3.test.ts`）：
  1. 只能沿声明 Edge 移动；Encounter 进行中移动被拒绝。
  2. 胜利只清除 `activeEncounter`，`status` 仍为 `inProgress` 且位置保持 B；到达出口 C 才 `success`。
  3. 队伍全灭触发 `failure`，`failedNodeId` 为失败 Node，不自动前进、不产生成功结果。
  4. Swap 只能选当前 Hand 内 Action 且不花 PlayerCost；PlayerCommand 选择手牌外候选并恰好扣除 1 PlayerCost；`clearActionOverride` 恢复自然准备。
  5. 过期 draft、过期 `commitVersion` 被拒绝；相同 `requestId` 重试返回同一结算且不重复扣费。
  6. `createSaveSnapshot` / `restoreSaveSnapshot` 恢复后 Hand、RNG 游标、HP、PlayerCost 与存档前一致，不免费重抽。
- **未做**：未为“新架构”重构现有 Runtime；未新增 Demo Loader。

#### P1 实际修改

- 合同（`src/data-services/contracts/gameplay-map.ts`）：新增 `GameplayMapNodeDef.activities`、`GameplayMapActivityDef`（`encounter` / `shop` 二选一）、`GameplayShopDef` / `GameplayShopOfferDef` / `Cost` / `Effect` / `Heal`、`GameplayEncounterDef.rounds`。`encounter` 单遭遇 Node 保持不变，简单内容不必包装活动列表。
- Run 状态（`src/arona-clicker/contracts/map-run.ts`）：`MapRun.activeActivity`、`MapRun.completedActivityIds`、`MapRunEncounterSnapshot.activityId`、`MapRunEncounterDraftToken.activityId`、回执 `activityId`、`MapRunActiveActivity`、`MapRunShopDraftToken`、`MapRunShopPurchaseReceipt`。
- Owner（`src/arona-clicker/services/map-run-service.ts`）：`openNodeContent` 打开首个未完成活动；`advanceCompletedActivity` 只推进一次并隔离活动身份；Rest 以 `rounds` 结束而不是“无敌人胜利”；`purchaseShopOffer` / `leaveShop` 原子结算并支持 `requestId` 幂等与草稿版本保护；移动在多活动进行中一律拒绝；`restoreRunState` 校验活动索引、完成集合、Shop 收据与活动身份。
- Registry（`src/data-services/registry/registry-validate.ts`）：把 Encounter 校验提取为局部函数，Node 单遭遇与每个活动 Encounter 共用；新增活动唯一身份、`encounter` / `shop` 互斥、`rounds` 与 Battle / completion 互斥、Shop 报价资源与 Team 余额校验、Edge Condition 结构与资源校验。
- Preview（`src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`）：按 `activityId` 解析活动 Encounter，不再只认 `node.encounter`。
- 正式内容：`gameplay-b:map:activity-hall`（Battle → 两轮 Rest → Shop）及 Spot `mapEntry`。

#### P2 实际修改

- 无需新增 Runtime 分支系统：`move` 的 Edge 校验、`currentNodeId`、`visitedNodeIds` 与 MapRun-local 资源已足够表达分叉与汇合。
- 正式内容：`gameplay-b:map:forked-route`，B 为战斗（每次普通射击同时记 1 条 `clues`、并可能损失 HP），C 为补给 Shop（消耗 `credits` 换 `supplies` 或治疗），D 为汇合点、E 为出口。
- 验收：两条独立 Run 均完成；D 保留各自路径的 `clues` / `credits` / `supplies` / `partyHp`；`move('d')`、`move('e')`、`move('a')`、`move('c')` 等非法方向被拒绝；D 只有一个 MapRun 状态，不因双入边重复初始化。

#### P3 实际修改

- 合同：`GameplayMapEdgeDef.condition` + `GameplayMapEdgeConditionDef`（唯一形态 `teamResourceAtLeast`，只读不消耗）。
- Runtime：`move` 在权威侧评估条件并拒绝未满足 Edge；`getMapWorkspaceView` 把 `satisfied` 投影到 Edge 视图，UI 与 Runtime 判断同源。
- 正式内容：`gameplay-b:map:continuous-conditional`。B 战斗的 `search-terminal` 是 actorless Ability（1 PlayerCost），成功后授予 MapRun-local Team 资源 `pass`；C 的休整结束后 `C→F` 需要 `pass ≥ 1`，默认通路 `C→D→E` 始终可走。
- 验收：持有 `pass` 时 `C→F` 可通行并完成，未持有时 Runtime 拒绝且 UI 按钮禁用；多次查询路线不消耗 `pass`；`pass` 只存在于 MapRun Team 资源，不写入长期 `PlayerState` 背包；存档恢复保留 `pass`、位置、HP 与完成 Node。

#### 补充：Spot 地图入口文案（2026-10-18 反馈修复）

负责人反馈“点击到了旧版本入口”，因此为所有 Spot 的 `mapEntry` 按钮补充可手动编写的入口文案：

- 合同：`SpotFunctionalityDef.mapEntryLabel?: string`（`src/data-services/contracts/world.ts`）；`SpotFunctionalityView.mapEntryLabel?: string`（`src/engine/contracts/spot-functionality-query.ts`）。只影响按钮文字，不改变入口校验、状态或 `data-map-entry-*` 行为。
- 作者写法：`spot(...).mapEntry(id, mapId, '进入 XXX')`（`src/arona-clicker/content/def-factory/spot.ts`），也可直接在 Datapack 的功能对象上写 `mapEntryLabel`。
- 渲染：`src/ui/components/map-entry.ts` 在入口可用时优先使用作者文案；缺省时保留“开始地图 / 继续地图”，被其他 Run 阻塞时保留提示文案。
- 校验：`Registry.validateSpotMapEntryRefs` 拒绝空串、纯空白与非字符串文案。
- 内容：默认 Gameplay B 包 6 个入口全部改为可辨识文案（现场调查路线 / 极简战斗演练 / 废弃走廊战斗 / 废弃活动室 / 分叉调查路线 / 连续调查与员工通道）；旧 Operation 示例包中的同名入口也同步。
- 测试：`tests/data/spot-map-entry-label.test.ts`（6 项：默认包文案、Registry 保留文案、空串 / 空白 / 非字符串拒绝、缺省回退）；`tests/ui/gameplay-b-basic-map-p0-p3.test.ts` 新增“所有入口渲染作者文案”用例。

#### 源码与 Schema 记录

- 新增/修改的可写源文件：`src/data-services/contracts/gameplay-map.ts`、`src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/contracts/runtime.ts`、`src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`、`src/data-services/registry/registry-validate.ts`、`src/arona-clicker/runtime-game-instance.ts`、`src/arona-clicker/runtime-commands.ts`、`src/ui/components/map-workspace.ts`、`src/ui/controller-actions-operation.ts`、`src/ui/css/map-workspace.css`、`src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts`；入口文案补充另改 `src/data-services/contracts/world.ts`、`src/engine/contracts/spot-functionality-query.ts`、`src/data-services/registry/registry.ts`、`src/arona-clicker/content/def-factory/spot.ts`、`src/ui/components/map-entry.ts`、`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`。
- **生成 Schema 未修改**：`tools/datapack-editor/schema/engine-defs.gen.json` 不包含 `maps` 表（`TABLE_META` 无 `maps`，生成文件亦无 `GameplayMapDef`），Gameplay Map 作者字段不在独立 Editor 生成范围内；本轮新增字段仅由 Registry 校验与 Runtime 消费，因此未触碰禁改生成文件。
- 复用未改动：`MapRunService` 唯一 Owner、Character Hand / Tendency 抽取、Swap / PlayerCommand、`draftVersion` / `commitVersion` / `requestId`、Preview / Commit / Receipt、`MapRunSaveSnapshot`、`GameplayBActionPreview` 结算计划。

#### 验收命令与结果（可复现）

```text
npx tsc --noEmit
→ 通过

npx vitest run tests/engine/gameplay-b-basic-map-p0-p3.test.ts tests/data/gameplay-b-map-registry.test.ts
→ 2 文件 / 119 用例通过

npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/data/gameplay-b-map-registry.test.ts
→ 5 文件 / 153 用例通过（既有 P0 回归）

npx vitest run tests/ui/gameplay-b-basic-map-p0-p3.test.ts
→ 4 用例通过（入口作者文案、P0 点击闭环、P1 活动顺序与商店、P3 Gate 禁用 / 放行）

npx vitest run tests/data/spot-map-entry-label.test.ts
→ 6 用例通过（默认包文案、Registry 保留、空串 / 空白 / 非字符串拒绝、缺省回退）

npx vitest run tests/ui/gameplay-b-map-workspace.test.ts
→ 15 用例通过

npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts tests/ui/map-dom-updates.test.ts
→ 通过

npm run check:architecture
→ Architecture boundary check passed

npm run check:docs
→ check:docs passed（883 篇 Markdown，0 errors）
```

- **失败项**：`tests/ui/gameplay-b-strategy-park-map.test.ts` 有 3 项既有失败（Toast / popup `hidden` 为 null、Scene 卡 `aria-pressed`）。用 `git checkout HEAD -- src/ui/controller-actions-operation.ts` 复跑后仍是同样 3 项失败，确认与本 Task 改动无关；该文件属于旧 Operation 呈现路径，未在本 Task 范围内修复。
- **未运行**：全量 `npm test`；浏览器人工验收（桌面 / 窄屏）；`npm run dev:game` 手动点击回放。

#### 有意不属于 P0—P3 的能力

- 活动自由选择菜单、活动条件跳转 / 循环 / 动态插入、通用活动树或脚本 DSL。
- 多活动并行、多个并行 Encounter、复杂 Scene / Phase 调度。
- 商店库存刷新、随机商品、动态定价、商店等级与完整经济。
- 通用 Condition 表达式 DSL、Objective / Outcome 任务树、动态地图生成。
- 开放世界地图、自由坐标布局、自动寻路。
- Party 招募 / 解散 / 替换、卡组构筑、弃牌堆与物理角色卡实例。
- 独立 Datapack Editor 的 Map / 活动 / 商店作者表单（仍归 Task 0292 范围）。

#### 独立验收结论

四阶段均为“脚本化行为验收”：正式 Datapack → Registry → Resolver → MapRunService → WorkspaceView → UIController 全链路通过，未发现需要新增顶层架构的缺陷。P0 未做无关重构；P1—P3 的扩展都收敛在既有 Map / Node / Action / Effect / Condition 语义内。**未进行浏览器人工验收，也未运行全量测试**，因此本 Task 仅标记为自动化验收完成。

### 文档核验与地图边界

- **登记轮（2026-10-18，施工前）**：仅登记需求、核对上述基线并建立索引；登记核验 `npm run check:docs` 已通过（883 篇 Markdown，0 errors），当时未实施 P0—P3。
- **施工轮（2026-10-18）**：按 P0 → P1 → P2 → P3 实施并更新“阶段完成记录”；本轮复核 `npm run check:docs` 结果见完成记录。项目地图沿用本会话已核对的 `acprogram` 项目身份；施工后仅对直接路径做只读复核，未刷新或改图。

---

## 一、当前基线与任务目标

当前新版本 Gameplay B 以以下关系运行：

```text
GameplayMapDef
    ↓
Datapack / Registry
    ↓
MapContentResolver
    ↓
MapRunService
    ├─ MapRun
    │   ├─ 当前 Node
    │   ├─ 地图进度
    │   ├─ Party / HP / Resources
    │   └─ activeEncounter
    │        ├─ Character Hands
    │        ├─ Overrides
    │        ├─ Target Selections
    │        ├─ Ability / Item Draft
    │        └─ Round / Random State
    ↓
Action Preview / Commit / Receipt
    ↓
MapRunWorkspaceView
    ↓
玩家 UI
```

当前结构已经具有单一 MapRun Owner、Character Hand、Swap、PlayerCommand、原子提交、确定性随机及只读 View 等机制。

**本 Task 不重做这些能力，而是核验其正确性，再扩展它们能够表达的玩法。**

最终要求：

1. 简单战斗仍可由一个 Node 内的一个 Encounter 表达。
2. 一个 Node 可以固定顺序地执行多个活动。
3. Map 可以通过有向 Edge 提供玩家可选择的路线。
4. 不同 Node 之间能保留资源、状态和活动结果。
5. 活动结果能够改变后续 Edge 是否可通行。
6. 玩家可以继续使用 Character Hand、换牌和 PlayerCost 指令。
7. 所有新增玩法由正式 Datapack 定义驱动，不依赖特殊演示代码。
8. 普通内容作者不需要理解旧 Operation 体系才能创建这些关卡。

## 二、全局约束

### 2.1 不重新设计 MapRun

除非经源码调查证明现有能力存在阻断性缺陷，否则保留：

- `GameplayMapDef` 作为静态地图内容入口。
- `MapRunService` 作为当前 Gameplay B 的唯一可写 Run Owner。
- `MapRunEncounterSnapshot` 表达当前活动的局内状态。
- Character Hand 与 Tendency 加权抽取。
- Swap / PlayerCommand 两种不同干预。
- `draftVersion` / `commitVersion` / `requestId` 的状态保护。
- Preview / Commit / Receipt 的原子结算与回执。
- Registry / Resolver / WorkspaceView / Save-Resume 的既有正确性保障。

不因新增玩法而恢复旧 `OperationEvent → Location → Scene → SceneAction`。

### 2.2 维护三个状态范围

```text
Persistent PlayerState
    长期角色、资源、成长等

MapRun-local
    当前节点
    节点 / 活动完成进度
    Party HP
    PlayerCost
    临时资源与地图进度

Encounter-local
    当前活动身份
    Round
    Character Hands
    Overrides / Targets
    Ability / Item Draft
    Enemy / 局内状态
```

这些是数据生命周期，不要求建立三个独立的持久 Runtime Owner。

跨 Node 或跨活动的状态必须有唯一权威来源，Encounter 结束时不能错误清除 MapRun 的有效资源，也不能把临时状态自动写回长期 PlayerState。

### 2.3 保留角色行为与换牌

核心行为必须继续遵循：

```text
Character Tendency
        ↓
抽取有限张合法行为卡
        ↓
Character Hand
        ↓
hands[0] = 自然准备行为
        ↓
玩家选择
  ├─ 接受自然行为
  ├─ Swap：切换手牌内行为
  └─ PlayerCommand：按规则付费指定行为
        ↓
提交整轮
        ↓
Effect / State / Receipt
```

Swap 不得被实现为 PlayerCommand 的别名；也不得把全部合法 Action 变成免费的玩家行动菜单。

### 2.4 严格限制活动编排复杂度

本 Task 只允许：

- 一个 Node 内的零个、一个或多个**固定顺序活动**。
- 每次仅运行一个活动。
- 当前活动完成后，直接进入下一活动。
- 全部活动完成后，返回当前 Node 的地图状态。

本 Task 不引入：

- 活动自由选择菜单。
- 活动顺序由玩家决定。
- 活动之间的条件跳转、循环或动态插入。
- 任意活动树、通用工作流或脚本 DSL。
- 多个并行 Encounter。
- 复杂 Scene / Phase 编排与调度系统。

**固定顺序的活动列表不等于通用任务系统。**

### 2.5 以真实内容验收

每阶段都必须通过实际的：

`Datapack → Registry → Resolver → MapRunService → WorkspaceView → UI`

验证关卡内容。

允许编写单元测试使用直接构造对象，但最终端到端验收不能只依赖 Fixture、模拟 View 或特殊 Demo Loader。

---

# 三、P0：单向线性战斗与核心不变量核验

**依赖：当前 Map-only Gameplay B 已有基础实现**

**任务类型：调查、验证及必要的定向修复**

## P0.1 目标关卡

```text
A：入口
    ↓
B：废弃走廊
    └─ Battle Encounter
       ├─ 友方 Character
       ├─ Enemy
       ├─ Tendency / Character Hand
       ├─ Swap
       ├─ PlayerCommand
       └─ Action / Effect
    ↓
C：出口
```

玩家进入 A，主动移动到 B。B 开始战斗，敌人被击败后，玩家返回 Map B，再主动前往 C 完成地图。

## P0.2 核验地图与遭遇生命周期

必须确认：

1. 地图只能沿合法 Edge 移动。
2. 进入含 Encounter 的 Node 后正确触发遭遇。
3. Encounter 活动期间不能非法移动。
4. Encounter 胜利与整个 MapRun 成功是两个不同结果。
5. B 的战斗结束时，`activeEncounter` 清除，MapRun 仍为 active，位置仍为 B。
6. 只有玩家移动至 C 并满足地图完成规则后，MapRun 才进入 success。
7. 已完成的一次性遭遇不会因重新访问而自动重置。
8. 战斗失败按现有或本阶段明确的失败合同处理，不发生错误的胜利或自动前进。

## P0.3 核验 Character Hand 与换牌

必须验证：

- 合法 Action 过滤和 Tendency 权重正确。
- 当前手牌及自然准备行为稳定。
- Swap 仅选择允许的手牌候选。
- PlayerCommand 按规则允许合法的额外指令，并实际扣除 PlayerCost。
- 撤销 Swap、恢复自然准备行为时，Overrides 正确更新。
- View 重新查询、UI 重开、Preview 重算不触发免费重抽。
- 更改目标不错误改变当前手牌。
- 结算使用玩家最终选择的 Action，不被重新生成的自然行为覆盖。
- 下一轮按规则重新抽取手牌。

## P0.4 核验草稿与提交

检查：

- `draftVersion` 对过期草稿的拦截。
- `commitVersion` 对过期提交的拦截。
- 提交所引用草稿与当前轮次、节点、Run 的一致性。
- `requestId` 的幂等重试。
- Cost、Actor/Team 资源与目标合法性。
- 同轮多角色行动与 Player Ability / Item 的费用冲突。
- Preview 与 Commit 使用一致的合法性及结算规则。
- 无效行为不发生部分扣费或部分 Effect。
- Receipt 与实际结算结果一致。

## P0.5 核验状态与 Save/Resume

至少验证：

- 跨遭遇 HP、PlayerCost 和 MapRun 资源不被错误清理。
- Encounter-local 草稿、手牌、敌人状态在遭遇结束时清理。
- 保存恢复后当前手牌和随机状态不发生免费刷新。
- 过期内容版本的 Run 不被静默错误恢复。
- MapRun 临时资源不误写入长期 PlayerState。

## P0 交付与验收

- 一份 MapRun 核心不变量核验记录。
- 必要的最小修复及回归测试。
- 一份三节点线性 Battle 正式 Datapack 样例。
- Battle 成功、失败、换牌、PlayerCommand、重复提交、存档恢复的测试结果。

**P0 完成标准：** A → B(战斗) → C 完整闭环可运行，现有行为和状态一致；若没有实际缺陷，不允许为追求新架构而进行无关重构。

---

# 四、P1：单 Node 固定顺序多活动

**依赖：P0 通过**

**任务类型：最小内容能力扩展**

## P1.1 目标关卡

```text
A：入口
    ↓
B：废弃活动室
    │
    ├─ Activity 1：Battle
    │      清除巡逻机器人
    │           ↓
    ├─ Activity 2：Rest
    │      两轮休整行为
    │           ↓
    └─ Activity 3：Shop
           玩家购买或选择离开
                 ↓
        Node B 全部活动完成
                 ↓
             返回 Map B
                 ↓
C：出口
```

**玩家不能在 B 自由选择活动顺序。**

进入 B 后自动执行 Activity 1；Activity 1 完成后自动进入 Activity 2，以此类推。

活动内部允许正常玩家交互。例如 Shop 可选择购买或离开，但不能跳过前面的 Battle、直接进入 Shop。

## P1.2 最小内容表达

允许 Node 配置有序活动内容，例如语义上：

```text
Node B
└─ activities
   ├─ battle
   ├─ rest
   └─ shop
```

这仅表示固定顺序和活动内容。

具体 Schema 由施工前的定向调查确定，不要求建立独立顶层 `ActivityDef`、Activity Engine 或通用 Phase 系统。

**兼容性要求：**

- 没有 Encounter 的 Node 继续可用。
- 只有一个 Encounter 的 Node 继续使用简单定义。
- 多活动 Node 才使用有序活动表达。
- 不得要求所有旧的简单内容都额外包装一层活动列表。

## P1.3 活动进度与生命周期

MapRun 需要能够知道：

- 当前 Node。
- 当前执行的是该 Node 的第几个活动。
- 哪些活动已经完成。
- 当前活动的 Encounter 状态。
- 整个 Node 的活动序列是否完成。

实现上优先使用**当前活动位置与必要完成信息**，不要求为每项活动建立一个独立 Runtime Owner。

还必须确保：

- 同一时间仅有一个活动正在执行。
- 当前活动未结束时不能移动或执行后续活动。
- 活动完成后自动推进，不要求手动选择下一个活动。
- 最后一项完成后才回到 Map B。
- 已完成 Node 重访时默认不重新执行全部活动。
- 失败不得自动跳过当前活动。
- 自动推进不能重复扣费、发奖或结算上一活动。

活动具有稳定身份，避免同一 Node 中多项活动共享 `nodeId` 时混淆提交、回执、完成进度或存档。

若现有 Draft Token / Commit Command 不能区分同一 Node 内的不同活动，需以最小方式补齐有效活动身份或等价校验；**不得依靠相同的 `nodeId + round` 误判当前活动**。

## P1.4 Battle 活动

直接复用 P0 的 Character Hand、Swap、PlayerCommand、Action/Effect 与战斗结束机制。

Battle 胜利后进入下一活动，而不是直接触发 MapRun Success。

P1 不要求新增战斗系统。

## P1.5 Rest 活动

目标示例：

- 参与角色按照 Tendency 抽取休息或交流行为。
- 玩家可以按照已支持的手牌规则换牌。
- 行为产生恢复 HP、PlayerCost 或其他已支持的资源效果。
- 完成规定的两轮后，Rest 活动结束。

Rest 没有敌人，但不能因为敌人集合为空就立即被判定为 Battle Victory。

只需建立有限轮次或明确完成条件，不要求疲劳、时间流逝、角色社交关系等完整系统。

## P1.6 Shop 活动

目标示例：

- 玩家查看少量可购买或交换内容。
- 玩家选择一个合法交换行为。
- Runtime 检查资源并原子提交交易效果。
- 玩家可以继续执行允许的交换，或选择离开 Shop。
- 离开 Shop 后自动进入本 Node 的下一活动；若 Shop 是最后活动，则返回 Map。

Shop 不要求 Character Hand，也不需要模拟战斗轮次。

第一阶段不要求库存刷新、随机商品、动态定价、商店等级或完整经济系统。

## P1.7 状态衔接

必须保证：

- Battle 造成的 HP 损失进入 Rest 时仍然有效。
- Rest 恢复后的 HP、Cost 能被后续 Shop 或下一 Node 使用。
- Shop 的购买结果按明确状态范围保存。
- 新活动重新建立自己的手牌、目标、草稿及局部状态。
- 前一活动的 `requestId`、过期 Token 或重复提交不能再次作用于下一活动。
- Save/Resume 可以恢复至当前活动，而不是始终重启该 Node 的第一项。

## P1 交付与验收

提交一份正式加载的：

**A → B(Battle → Rest → Shop) → C**

Datapack 样例，附带 Engine、UI 和 Save/Resume 测试。

必须通过：

- 固定顺序执行。
- 三类活动均可实际结算。
- 活动间状态正确继承与清理。
- 中途不可移动或跳活动。
- 最后活动完成后回图。
- 单活动 Node 不受回归影响。
- 不发生无敌人自动胜利、重复奖励或活动身份混淆。

**P1 完成标准：** 单 Node 可以运行一段固定的异质活动序列；没有活动选择菜单、条件调度器或新的 Operation 式编排层级。

---

# 五、P2：单向分叉地图与路线选择

**依赖：P1 通过**

**任务类型：地图结构扩展与地图层决策验证**

## P2.1 目标关卡

```text
                  ┌─ B：战斗路线 ─┐
                  │              │
A：入口 ───────────┤              ├─ D：汇合点 ─ E：出口
                  │              │
                  └─ C：补给路线 ─┘
```

Edge：

```text
A → B
A → C
B → D
C → D
D → E
```

不提供反向 Edge。

玩家在 A 自主选择 B 或 C。不同路径提供不同的实际游戏结果，并在 D 汇合。

## P2.2 路线差异

至少存在两种可观察的路线代价。

推荐：

**B：战斗路线**
- 进行一次 Battle。
- 消耗可能的 HP / PlayerCost。
- 根据 Action/Effect 获得已支持的临时资源或地图进度。

**C：补给路线**
- 进行简单的 Shop 或交换活动。
- 不发生战斗 HP 消耗。
- 支付另一类资源或取得不同收益。

两条路线最终都能抵达 D。

D 应读取同一个 MapRun 的有效跨 Node 状态，使玩家此前的路线选择有真实后果。

不要求为路径结果额外建立分支剧情或 Objective 系统。

## P2.3 地图规则

必须确认：

- 有向 Edge 只允许按声明方向通行。
- A 可以选择 B 或 C。
- B 和 C 均可进入 D。
- 没有 Edge 时不能反向或跨节点移动。
- 活动中的 Node 不能非法移动。
- Node 活动完成后由玩家决定什么时候继续沿 Edge 前进。
- D 不应因为有两个入边而初始化两份独立 MapRun 状态。
- UI 展示的可通行方向与 Runtime 校验结果一致。

**地图路线由 Edge 决定，不由 Encounter 自动提交 Route。**

## P2.4 分支进度

不要求 P2 新建通用任务分支系统。

最小只需能够正确表达：

- 当前 Node。
- 已访问 Node。
- 已完成 Node / Activity。
- 既有 MapRun 资源与状态。
- 需要时用于展示或验收的实际移动记录。

不要求为没有进入的路线生成完成状态，也不要求两条路线都必须执行。

## P2.5 UI 行为

在 A 显示两个可选目的地。

玩家选择其中一条后，地图正确更新当前位置。

到达 D 时，无论来自 B 还是 C，都应进入同一个汇合地点，并沿 D → E 继续。

不要求 P2 完成复杂地图拖动、自由坐标布局或自动寻路；最小可用的图形或节点列表均可验收。

## P2 交付与验收

提交一份正式 Datapack 单向分叉关卡及自动化测试。

至少运行两次独立 MapRun：

- A → B → D → E。
- A → C → D → E。

验证：

- 两条路线均能完成。
- 非法逆向移动、跨 Edge 移动被拒绝。
- 不同路径产生不同的资源/状态结果。
- D 正确保留先前路径的资源状态。
- 无隐藏的 Location Objective / Operation Route 前置要求。
- P0 与 P1 样例不受影响。

**P2 完成标准：** 地图已经能够提供真实的路线选择与汇合，而不是一个被动展示任务推进顺序的界面。

---

# 六、P3：连续遭遇、跨 Node 资源与条件路径

**依赖：P2 通过**

**任务类型：多地点玩法组合与有限条件扩展**

## P3.1 连续遭遇基准

首先验证纯线性连续内容：

```text
A：入口
    ↓
B：Battle
    ↓
C：Rest
    ↓
D：Shop
    ↓
E：出口
```

各 Node 分别包含自己独立的活动。

与 P1 的区别：

- P1：多个活动发生在**同一个 Node 内**，活动完成后自动进入下一项。
- P3：多个活动分布于**不同 Node**，每项结束后返回地图，由玩家决定何时移动。

不得混淆这两种生命周期。

## P3.2 跨 Node 状态

在 B 的战斗中消耗 HP、PlayerCost，之后前往 C 休息，再在 D 使用或交换资源。

必须验证 MapRun-local 状态的延续：

- Party HP。
- PlayerCost。
- 已支持的 Actor / Team 资源。
- 临时持有物或地图进度标记。
- 当前节点访问和完成状态。

同时保证 Encounter-local 的 Hand、Override、Target、Enemy、Round 不会错误带入下一 Node。

不能通过重新开始 Encounter 意外重置整个 MapRun 的 HP 或 Cost。

## P3.3 条件路径

在上述连续内容基础上增加一个非常简单的 Edge Condition 变体。

例如：

```text
A：入口
    ↓
B：调查 / 战斗
    ↓
C：休整
    │
    ├─ [拥有临时通行证]
    │        ↓
    │    F：员工通道 ─┐
    │                │
    └─ [默认可通行]   │
             ↓       │
         D：普通通道  │
             │       │
             └───┬───┘
                 ↓
              E：出口
```

在 B 的合法活动中，玩家可以获得一项 MapRun-local 的通行状态。

该状态可以是一个简单 Fact 或已有能力支持的临时 Item；不要求为此建立完整物品系统。

C → F 的 Edge 检查这项状态。

玩家满足条件时可以主动选择员工通道，否则仍能沿默认路径继续。

## P3.4 Condition / Effect 最小范围

本阶段只需要证明：

```text
Action
  ↓
Effect
  ↓
MapRun Fact / Temporary Item
  ↓
Edge Condition
  ↓
改变可通行路线
```

禁止为这一场景建立：

- 通用复杂表达式 DSL。
- Objective / Outcome 多级任务树。
- 动态地图生成。
- 条件活动调度器。
- 跨世界线剧情工作流。

可以复用现有 Condition/Effect 能力或以最小方式补充有限条件。

Condition 必须由 Runtime 执行权威校验，不能只依赖 UI 显示锁定状态。

## P3.5 条件路径与资源的边界

必须确保：

1. 不满足条件的 Edge 不能被移动命令绕过。
2. 条件满足后，Edge 可通行性正确更新。
3. 玩家仍然主动决定是否走该 Edge。
4. 临时通行证不会自动进入长期 PlayerState 背包。
5. Save/Resume 保留该条件状态。
6. 在本次 MapRun 内，多次查询路线不会错误消耗通行证。
7. 若移动本身需要消耗物品，必须具有明确、原子的支付规则；本阶段可以只使用不消耗型 Gate。
8. 关卡至少保留一条正常可通行的完成路径，避免因未取得通行证而形成无出口状态。

## P3.6 完整链路组合验收

P3 完成时至少有一个正式内容样例，能够同时证明：

- 地图存在多个 Node。
- Node 有自己的活动。
- 活动影响 MapRun 的跨 Node 资源。
- 地图通过 Edge Condition 读取资源或进度。
- 玩家自行选择实际可通行路线。
- Encounter 与地图有独立的完成时机。
- 最终到达出口后 MapRun 正确完成。
- 存档恢复后地图、资源和当前活动保持一致。

## P3 交付与验收

提交：

- 连续 Battle → Rest → Shop 关卡。
- 至少一份简单条件路径样例。
- 跨 Node 状态、条件移动与 Save/Resume 测试。
- 失败移动、资源不足及重复提交的边界测试。
- P0—P3 全部正式 Datapack 样例的回归结果。

**P3 完成标准：** 不依赖 Operation 任务编排，已经能够用 Map、Node、活动、Action、Effect、Condition 实现一段具有跨地点资源取舍和路线条件的小游戏。

---

# 七、调查、施工与验收执行要求

## 7.1 每阶段先做定向调查

主 AI 应先根据当前源码确认每阶段已有能力与真实缺口，再制定施工 Read Set / Write Set。

重点路径包括：

- `src/data-services/contracts/gameplay-map.ts`
- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/services/gameplay-b-hand-resolver.ts`
- `src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`
- `src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts`
- Map Resolver、Registry、Runtime 入口与 Save/Resume。
- `src/ui/components/map-workspace.ts` 及对应 Controller。
- 相关 Engine / UI / Datapack 测试。

路径是调查线索；若源码已经移动或改名，以当前实际文件为准。

P0 优先使用只读调查与定向测试，发现缺陷后才施工。

P1—P3 需要扩展时，应先调查能否复用当前的 Action/Effect、Snapshot、Map 状态和 View，不得默认先创建新系统。

## 7.2 分派规则

允许主 AI 根据执行环境把各阶段拆成调查、施工与验收子任务。

要求：

1. P0、P1、P2、P3 必须有各自的完成记录。
2. 每阶段明确修改内容、受影响调用方及测试。
3. 阶段间依赖不得跳过。
4. 施工完成后必须由独立验收步骤核查关键行为。
5. 遇到目标合同冲突时先报告，不擅自引入大范围架构。
6. 不把正在执行的中间状态提前标记为全部完成。
7. 若使用子 Agent，调查、施工和最终验收应尽可能职责分离；不能执行子 Agent 时由主 AI 按独立阶段完成。

## 7.3 Schema 与内容约束

- 每次 Schema 变化同步 Datapack 校验、Resolver、生成 Schema、真实样例和对应测试。
- 新语义必须通过正式内容加载路径运行。
- 不得为演示单独增加一个与 Registry 并行的内容加载器。
- 简单 Node 不能被迫配置多活动结构。
- P1 的有序活动不应演化成通用活动编排 DSL。
- P2/P3 的地图分支只能依赖明确的 Edge 与有限 Condition。
- 不为了兼容旧 Operation 测试夹具而重新建立旧运行时的产品依赖。
- 不删除其他玩法共享资源和长期 PlayerState。
- 若内容合同变更影响在途 Run，应按明确版本策略处理 Save/Resume。

## 7.4 复杂度约束

任何新增字段、抽象或服务，都必须至少满足一项：

- 直接承载 P0—P3 的玩家可见行为。
- 解决真实的数据所有权或生命周期问题。
- 保障状态、费用、目标、随机数、存档或事务正确性。

不得仅以“未来可能支持更复杂的地图/活动”作为新增依据。

不要求减少所有 Runtime 类的数量，但要求**普通作者最少只需理解地图、节点、路径、活动、角色行为、资源和效果**。

---

# 八、总体验收矩阵

| 能力 | P0 | P1 | P2 | P3 |
|---|:---:|:---:|:---:|:---:|
| 单向线性移动 | ✓ | 回归 | 回归 | 回归 |
| 单 Encounter 战斗 | ✓ | 回归 | 回归 | 回归 |
| Character Hand / Tendency | ✓ | ✓ | 回归 | 回归 |
| Swap / PlayerCommand | ✓ | 回归 | 回归 | 回归 |
| Preview / Commit / Receipt | ✓ | ✓ | 回归 | 回归 |
| 固定顺序多活动 | — | ✓ | 回归 | 回归 |
| Rest / Shop 非战斗行为 | — | ✓ | 复用 | ✓ |
| 单向分叉与汇合 | — | — | ✓ | 回归 |
| 跨 Node 资源验证 | 基础 | 活动间 | 路线间 | ✓ |
| Edge Condition | — | — | — | ✓ |
| Save/Resume | ✓ | ✓ | 回归 | ✓ |
| 正式 Datapack 完整加载 | ✓ | ✓ | ✓ | ✓ |

`✓` 表示该阶段必须具有直接测试；“回归”表示不得破坏此前已经验收的能力。

---

# 九、最终交付物

本 Task 最终完成时应具有：

1. **P0 核验报告：** 线性战斗、换牌、资源、并发与存档的不变量及测试结果。
2. **P1 顺序活动样例：** 同一个 Node 内 Battle → Rest → Shop，并能完整运行。
3. **P2 分叉地图样例：** 两条可选择的单向路线、不同结果及正确汇合。
4. **P3 连续与条件样例：** 跨 Node 资源保留、条件 Edge 与地图完成。
5. **正式 Datapack 内容：** 所有样例均可通过现有 Registry / Resolver 启动。
6. **源码及 Schema 修改记录：** 说明实际增加、复用或修改了什么。
7. **测试与验收记录：** Engine、UI、内容校验、Save/Resume 及相关回归。
8. **剩余高级能力清单：** 哪些功能有意不属于 P0—P3，而不是遗漏实现。

必须提供可复现的测试命令、运行结果及失败项说明；未运行的测试不得标为通过。

---

# 十、明确非目标

本 Task 不要求：

- 重新实现或重命名整个 MapRun 架构。
- 恢复 OperationEvent / Location / Scene / SceneAction 编排。
- 实现节点内的活动自由选择或条件跳转。
- 实现重复执行的活动循环或活动调度器。
- 开放世界地图、动态路径规划、程序生成地图。
- 多个并行 Encounter。
- 复杂战术 AI、角色卡组构筑、弃牌堆与物理角色卡实例。
- 完整商店库存、动态经济和交易市场。
- 通用任务系统、全局 Objective Graph。
- Party 招募/解散/替换、Combination 和复杂技能树。
- 为地图玩法重新构造独立的通用脚本语言。
- 重建已退役的旧 Gameplay B 专属 Operation 示例作为产品入口。

## 最终完成标准

玩家可以从真实 Gameplay B Datapack 启动关卡，先后完成：

**线性战斗 → 同节点顺序多活动 → 地图路线选择 → 连续活动与条件路径。**

整个过程中：

- 角色自主抽卡与玩家换牌仍是核心交互。
- Map 移动、Node 活动进度及 Encounter 生命周期互不混淆。
- HP、PlayerCost、临时资源、活动完成状态和存档保持一致。
- 简单玩法不需要复杂内容编排。
- Runtime 的安全性不因扩展而下降。

**四阶段全部通过独立验收、正式内容加载及必要回归测试后，才可以将本 Task 标为 `completed`。**
