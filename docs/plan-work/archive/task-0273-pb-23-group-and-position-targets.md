# Task 0273 / PB-23：Scene Action 的站位筛选与群体目标

状态：completed — Actor Target 已支持当前站位过滤和显式 `select` / `all-eligible`，真实 Scene 样例、Runtime / View / UI 和 Registry 入口均已完成验收。
> Goal Owner 统一裁定（2026-10-08）：PB-23 的施工默认规则见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；其中规则覆盖本 Task 在该裁定前写成“待定 / 待确认”的历史措辞。当前完成状态见下方记录。

## 完成记录（2026-10-08）

本 Task 已按 Owner 裁定完成。下文“当前事实与代码落点”“施工前未解决裁定”与“当前核验”保留作施工前追溯基线；以本记录、当前源码 / 测试及 `docs/docs-829/` 为实施事实。

### 实现内容

- 扩展唯一的 `OperationActionTargetDef`：Actor Target 可声明 `selectionMode: 'select' | 'all-eligible'` 和 `allowedPositionIds`；省略 `selectionMode` 为 `select`。`relation`、Actor ID、Actor type、当前站位和存活状态共同过滤，声明的约束取交集。
- Runtime / View 读取 Run 的当前 HP 与位置。手选 `select` 目标在预览和提交时再次验证；目标死亡、换位或失效时拒绝整批，不静默替换。`all-eligible` 由 Scene Action 显式声明，Runtime 在结算时解析全部当前合法目标；空组不可提交，空 `targetActorIds` 本身不表示全选。
- Combat Intervention 保留既有单目标合同；`all-eligible` Combat Action 显式不可用，不会挑首个候选冒充群体执行。
- Scene UI 将当前站位写入敌人卡片，并在 `all-eligible` 摘要列出当前候选及站位；群体行动不开放手动目标拖放。切换到未分配执行者的另一项全队 SceneAction 时，Controller 先选中对应 Option，再打开该 Option 自己的执行者选择器，避免错误地保留默认行动。
- `atomic-scene-demo` 为独立 Registry Event：Scene A 调查后仍在同一 Location 进入 Scene B；B 含两名前排敌人与一名后排敌人、全前排群体 Action、明确移动单体和手选警报单体。敌人名不再编码初始位置，卡片始终显示最新 Position。
- 注册内容解析器现在纳入 `Location.scenes[].sceneActions` 引用，防止新样例嵌套 Action 被准入内容解析漏掉。

### 验收记录

- Engine 定向回归：6 个文件、95 tests 通过（Target Selection 16、Participant Admission 20、复合 Location 1、Scene Actions 16、View Projector 2、Runtime Service 40）。
- UI 定向回归：`gameplay-b-operation-entry-registry` 1 test 与 `gameplay-b-operation-controller` 28 tests 通过；Registry UI flow 验证嵌套 SceneAction 可经通用事件入口启动。
- `npx tsc --noEmit`、`npm run gen:schema`、Schema Sync 8 tests、`npm run check:docs`（759 篇 Markdown，0 errors）和 `git diff --check` 通过。`tools/datapack-editor/schema/engine-defs.gen.json` 由源契约生成。
- 人工浏览器验收：本地 In-app Browser（1280×720）。从夏莱办公室通用入口启动样例；提交调查后地点仍进行中、第二 Scene 进入 active；首轮群体预览并命中敌人甲 / 乙；拖动移动行动指定敌人甲并提交后，其卡片更新为后排；第二轮群体预览和 Resolution 只列前排敌人乙；最后明确指定敌人乙解除警报，现场状态归零，Location 完成并通过唯一出口自动转场。Engine 集成另断言来源 Location success、两个 completed Scene ID 和 Route history。

### GALHCG 闭环

- `project_id=acprogram`。实施路径在 GALHCG 中完成直接关联 / Evidence 更新；写后 `review_changes` 覆盖 30 个直接变更路径，30/30 路径状态为 `unchanged`，返回的 Evidence 没有 stale 记录；其中部分路径的 owner 列表分页未完整展示，因此另对本次内容变化关联的 65 个唯一 node / edge owner 执行 `verify_freshness`，65/65 均为 `fresh` 且检查完整。此次实现触及 Action Planning、Operation Sample Content、Operation Runtime、Operation View、Operation UI Workspace、Controller→Runtime Commands、Operation Content Validation、独立 Editor Schema 与相关 tests / docs。本记录不声称对这些 Concept 的所有历史邻接做了全图审计。

## 目标

在 PB-22 的警报处置 Scene 中，让一个 Action 作用于敌方前排群体，另一个 Action 由玩家指定一个合法单体；合法候选按 Performer relation 与目标位置 / 类型 / ID 共同过滤。Actor 改变站位后，下一次 View / Preview 立即使用新站位，不向 UI 或 Run 注入陈旧目标。

## Responsibility、依赖与边界

- 唯一责任：既有 Action target / Scene Offer 规划统一计算候选集合及目标基数；View 将合法 ID / 显示位置投影给 UI；Operation Runtime 继续校验目标并原子应用现有 Action Effect。
- 依赖：G03 Task 0265–0267 的 Offer / Plan / Preview / Resolution 边界；PB-22 0272 的 alarm Scene；G01 PB-05 的站位展示和 PB-08 的显式目标数量基线。
- 包含：新 Scene 用例需要的 front / back（或经裁定的其他 position IDs）过滤、群体匹配 / 展示 / 费用与效果 fan-out、与现有关系约束的交集验证。
- 非目标：重复实现 targetActorIds 数组、ActionEffect target 解析、Actor.positionId / actorPosition effect、SceneCard / Action / Performer / Team 系统；不建 `FrontRowScene` / `BackRowScene` 实体；不扩大到 Location / 任意世界对象目标。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| Action target 定义为 `none` 或 `{ kind:'actor', relation, allowedActorIds?, allowedActorTypes? }`，未声明目标数量或 target position 过滤。 | `src/data-services/contracts/operation.ts: OperationActionTargetDef` | 目标合同可约束关系 / 固定 ID / Actor type，不代表已支持 front / back 或全组语义。 |
| `OperationActorDef.positionId`、`OperationViewActor.positionId`、Action `actorPosition` effect 已存在；Strategy Park `OperationCardConditionDef.positionIds` 用于“当前执行者的候选 Action 池”过滤。 | `operation.ts`、`operation-view.ts`、`gameplay-b-strategy-park.ts` 的 `stepForward` / `frontGuard` / pools | 复用位置状态 / effect；候选池位置条件不能误称为目标位置筛选。 |
| Battle Intervention 目标是单个 `targetActorId`；`selectOperationTarget()` 从合法候选中按优先级选一个，未按目标位置过滤。 | `src/arona-clicker/contracts/operation-beat.ts`、`operation-target-selection.ts`、`operation-intervention-preview.ts` | 单体战斗路径已有单目标契约；本 Task 不将每回合战斗目标语义改成自动 AoE。 |
| SceneAction / SceneCard selections 保存 `targetActorIds[]`；Planner 对 Individual 要求恰好 1，对 Global 要求至少 1 并拒绝重复 ID，检查 relation / allowed IDs / types，效果按各目标分别规划。 | `src/arona-clicker/contracts/operation-scene-action.ts`、`operation-resolution-planner.ts` 的 `planSceneBatch`；`tests/engine/operation-scene-actions.test.ts` | Scene 多目标承载 / fan-out 已存在。PB-23 加的是可表达的位置组规则与明确的群体含义，不再造目标数组或重写 effect 系统。 |
| 0247 已完成的语义审计明确逐目标应用整份 Action effects，Carousel “全队急救”已有 global target 列表示例。 | `docs/plan-work/archive/task-0247-gameplay-b-card-drag-target-and-semantic-audit.md` 与当前 Planner / 测试 | 历史成果供定位；基数和行为仍以当前代码和测试为准。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/data-services/contracts/operation.ts` 的 Actor / ActionTarget / Effect / CardCondition；`src/arona-clicker/contracts/operation-beat.ts`、`operation-scene-action.ts`、`operation-view.ts`。
- `src/arona-clicker/services/operation-target-selection.ts`、`operation-intervention-preview.ts`、`operation-resolution-planner.ts`、`operation-view-projector.ts`；`src/ui/controller-actions-operation.ts`、`operation-workspace.ts` 的当前目标投影 / 拖放路径。
- `tests/engine/operation-target-selection.test.ts`、`operation-intervention-preview.test.ts`、`operation-scene-actions.test.ts`、`operation-resolution-planner.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`。
- 若变更 Operation source contract，再按 [[docs/ai/context-packs/datapack-schema]] / [[docs/docs-829/05-conventions/schema-sync]] 读相应 Registry、生成 Schema 与定向同步测试；不手改 generated file。

## 施工切片

### P0：裁定并建位置过滤 / 群体目标规则

- 在 Scene Action / Offer 的合法候选上，将执行者 relation 与 position filter 求交集；保留 `allowedActorIds` / `allowedActorTypes`、存活、Team / actorless source 约束。
- 对单体目标，选一个且仅一个当前合法目标；对群体目标，按裁定动态解析成员，并对每名成员按现有 per-target Effect fan-out 规划。
- Actor 的 `positionId` 变化或 HP 失效后重新投影 / preview；旧目标不再合法时整批拒绝或要求重选，不得静默换成全体。
- UI 读取 OperationView 候选和 Actor 当前站位；选择 / 预览只写可撤销 draft，最终仍由 Runtime 作可信验证。

### P1：在警报 Scene 里可玩

- 用至少两名敌方和前 / 后排学生组成一个 Scene 样例；打一张“敌方前排群体” Action 与一张“选择单个敌人”的 Action。
- 在同一场景中移动目标或改变当前 Actor position，再次读取 View / preview，确认群体 / 单体合法集合随状态更新。

## 回归证据与 Operation 工作区验收

- 现有证据：`operation-target-selection.test.ts` 覆盖 self / sameTeam / otherTeam / any 和 ID / type 过滤；`operation-intervention-preview.test.ts` 覆盖战斗单目标改选；`operation-scene-actions.test.ts` 覆盖 SceneAction 目标数组和非法关系拒绝；`operation-resolution-planner.test.ts` 覆盖 per-target Effect / actorPosition；UI Controller 测试覆盖目标拖放与撤销。
- [ ] 点击 Operation feed → Park 新支路 → 新 Location → 警报 Scene；群体牌影响且只影响当时符合 relation + `front` 的对手，单体牌只影响玩家显式选的一人。
- [ ] 移动一名敌人到 back / 一名学生到 front 后刷新候选；目标摘要 / 连线 / submit 合法性与实际目标集一致。
- [ ] 加定向行为回归：relation ∩ position ∩ type / ID 的交集、零目标 / 目标死亡 / 位置变化 / stale plan / Group fan-out；非法目标或部分效果失败不能留下部分 HP / resource / cost 变化。
- [ ] 在 Operation Workspace 实际检查多目标的选择、取消、预览、提交和目标结果；UI / DOM 测试不代替点击验收。

## 施工前未解决裁定

- 位置过滤字段归属待人类决定：扩大全局 `OperationActionTargetDef` 会影响该 Action 的战斗 / 场景所有来源；只放 Scene Offer target policy 则不能复用全局候选。需选择能保持 ActionDef 效果唯一且 UI-safe 的最小契约。
- “群体目标”是自动纳入当前全部合格 Actor，还是允许玩家从筛选出的群体再选子集？空组是合法空效果、offer 不可用还是禁止提交？中途目标死亡 / 转换 position 的处理语义需要固定。
- Group 只作用敌方前排且单体允许挑其他组目标的样例是否使用同一 target spec / selection rule，及 relation / position / ID / type 的交集优先级需定义。不要默认 `targetActorIds=[]` 表示全选，遵守 PB-08 的显式选择边界。

## 当前核验（2026-10-08）

- 只读核对 Action target / Actor position / position effect / CardPool position / Battle draft / Scene target array / multi-target planner 与定向 tests；未运行测试，未改源码或测试。

## GALHCG 影响闭环

- 只读发现：`project_id=acprogram`；source 搜索 `targetActorIds`、`positionId`、`OperationActionTargetDef` 结果范围较广或截断；以本地精确路径搜索和直接读合同、target selector、Planner 与 tests 补全语义。`Operation Action Planning` lookup 命中 `concept:operation-action-planning`，只作导航。
- 变更审查：本规划 Task 未改变合同 / 服务 / 测试；实施后按确切字段和调用路径 review。
- 地图写入待主代理汇总。

## 剩余工作

- PB-23 不负责 Scene 多 Scene owner 本身；仍依赖 0272。M/N 与临时商店的选择计数 / purchase effect 归 PB-24。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/05-conventions/schema-sync]] · [[task-0258-pb-08-target-selection-and-count-validation]] · [[archive/task-0272-pb-22-multiple-scenes-per-location]]
