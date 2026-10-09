# Task 0269 / PB-19：Carousel 正式样例迁入 Scene 合同

状态：completed — 正式 Carousel 的现有三地点内容在 G03 合同下以隐式 `main` Scene 等价运行；本 Task 按现有内容与定向回归收窄关闭，没有为字段形式重写内容。
> Goal Owner 统一裁定（2026-10-08）：只迁移正式 `gameplay-b@1.0.0` Carousel；独立 `carousel-route-slice` 保留为测试样例。未声明 `Location.scenes` 时由 Runtime 呈现隐式 `main`。此合同覆盖下文裁定前的待确认措辞。

## 目标

让当前正式 Carousel Operation bundle 复用 G03 的 Scene 身份、计划与结算投影，从 Operation 工作区完整游玩安全战斗、通道行动、出口行动、玩家 SceneCard 与路线。该 Task 覆盖原 Roadmap 的 PB-19 迁移结果；既有安全 / 路线 / 场景行动切片已经存在，不能重新造一份效果或牌系统。

## Responsibility、依赖与边界

- 唯一责任：Scene / Operation Runtime 提供当前 Scene 状态与通用操作体验；Carousel Datapack 保持角色、Action、费用、结局与路线规则；UI 只读 View，不按 Carousel Location ID 推断玩法阶段。
- 依赖：G03 Task 0263–0268；G01 PB-01 / PB-02 完成相关的战斗阶段和旧文案处理后复核；复用 0245–0248 已完成的 performer、target、Cost、SceneCard、可跳过批次和目标拖放能力。
- 包含：将正式 `gameplayBCarouselDatapack` 的三地点行为映射到新 Scene 合同；只清理在 G01 / G03 完成后仍由 Carousel 专用 ID 驱动的残余 UI / Presentation 判断。
- 非目标：重做 `carousel-safety-slice`、Route、Action、玩家牌、Actor / Performer / Target / Cost 机制；把另一个 `carousel-route-slice` 样例默认为正式内容；复写 G01 PB-01 / PB-02 已处理的 UI 判断；编辑独立 Datapack Editor。
- 依赖顺序：先于 PB-20 / PB-21 迁移，作为内容迁移切片回归；后续 Strategy Park 不应复制 Carousel 内容规则。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对 Task 的影响 |
| --- | --- | --- |
| 当前正式包从 `carouselSceneActionSliceContent` 组装，slice 内含平台战斗、通道 Individual SceneAction、出口 Global SceneAction 与有限玩家牌。 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`；`carousel-scene-action-slice.ts` | 这条三 Location 正式流程是主迁移 / 验收对象，不是另写一个新 Carousel。 |
| `carousel-safety-slice.ts` 是底层战斗安全样例；`carousel-route-slice.ts` 另建 route-slice Event / resolver，拥有平台、通道、维修隧道、出口四地点。 | 对应内容文件；`tests/engine/gameplay-b-route-sample.test.ts` | 安全与路线切片可复用既有行为 / 回归；route slice 是否继续作为独立演示或合并进正式包须裁定，不因“旧旋转木马”一词混为同一个事件。 |
| 正式 Carousel 仍有 Location ID UI 分支，例如 `projectOperationActorHand()`、`renderMain()`、`renderOperationWorkspace()` 对 platform / concourse 作判断。 | `src/ui/components/operation-workspace.ts`；`src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts` | G01 / G03 会先改变阶段和表现路径；本 Task 只移除核实后仍剩余的 Carousel 特判，避免重复改动。 |
| Carousel 已从 Operation feed 启动，且已有 UI 操作测试覆盖进入工作区和旧内容路线。 | `src/ui/components/center-panel.ts`；`tests/ui/gameplay-b-operation-controller.test.ts`；`tests/engine/gameplay-b-scene-action-sample.test.ts` | 保留现有 feed 入口供真实 Operation workspace 点击验收。 |

## 最小 Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、`docs/docs-829/03-data-structures/operation-view.md`、`docs/docs-829/05-conventions/testing.md`。
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`carousel-scene-action-slice.ts`、`carousel-safety-slice.ts`、`carousel-route-slice.ts`、`gameplay-b-presentation.ts`。
- `src/ui/components/operation-workspace.ts`、`src/ui/components/center-panel.ts` 与其直接控制器 / View 测试。
- `tests/engine/gameplay-b-scene-action-sample.test.ts`、`tests/engine/gameplay-b-operation-sample.test.ts`、`tests/engine/gameplay-b-route-sample.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`。

## 施工切片

### P0：按 G03 结果对照当前正式样例

- 在移任何内容前，列出现有正式包对应 Scene 身份、Scene 完成 / Location 完成、Actor / Action / Cost / PlayerSceneCard / route 的映射。
- 先确认 G01 / G03 是否已移除阶段与文案分支；只迁移尚未进入新 Scene Contract 的差异。
- 如果正式 Carousel 内容在新合同下已等价且无残余 ID 特判，提交可点击端到端回归并向上游提出关闭 / 收窄 PB-19 的裁定，不做为迁移而迁移的重写。

### P1：保留现有行为并点击验收

- 从 Operation feed 启动正式 Carousel 事件；完成平台 1 Beat 战斗、通道 Individual 操作、员工路线 / 游客路线之一、出口 Global 行动与玩家牌，并验证 Route / 结案流程。
- 对照同一条旧行为路径确认危险轨、事实 / 员工证、Cost、行动费、目标和奖励没有变化；不同路线不因 Scene 完成被自动移动。

## 回归证据与 Operation 工作区验收

- 现有证据：`tests/engine/gameplay-b-scene-action-sample.test.ts` 覆盖正式 Carousel 场景行动；`tests/engine/gameplay-b-operation-sample.test.ts` 覆盖内容与运行行为；`tests/engine/gameplay-b-route-sample.test.ts` 覆盖独立 route slice；`tests/ui/gameplay-b-operation-controller.test.ts` 和 `tests/ui/operation-workspace-view.test.ts` 覆盖工作区交互。Route-slice 测试不能代替正式包回归。
- [x] `tests/ui/gameplay-b-operation-controller.test.ts` 与 `tests/ui/gameplay-b-strategy-park-map.test.ts` 覆盖 Operation 入口 / workspace 点击；`tests/engine/gameplay-b-scene-action-sample.test.ts` 覆盖正式 Carousel 的战斗、通道行动、路线、出口行动、牌与结案路径。
- [x] 费用、效果、事实、员工证 Gate、路线、结局与奖励仍由现有内容 / Runtime 路径结算；本轮回归补断言三个 Location 的 Resolution 都带各自 `locationId` 和隐式 `sceneId: 'main'`。
- [x] 保留 Save/Resume 证据：`tests/engine/gameplay-b-save-resume.test.ts` 对正式 Carousel 的 staged batch、Resolution 历史、路线状态与恢复快照作等值检查。

## PB-19 证据化关闭（2026-10-08）

- `carouselSceneActionSliceContent` 的正式三地点均未声明 `scenes`；`gameplay-b-datapack.ts` 仍从该 SceneAction slice 组装正式 Carousel bundle。Runtime View 将当前 Location 显示为 `main`，战斗 / SceneAction Resolution 保存 `{ eventId, locationId, sceneId: 'main' }`，因此同一 Event 的 platform、concourse、exit 是三个不同的完整 Scene identity。
- 定向回归在 `tests/engine/gameplay-b-scene-action-sample.test.ts` 验证 View、三条 Resolution、存档中的 Resolution 历史、员工 Gate 路线与终局状态。`tests/engine/gameplay-b-save-resume.test.ts` 已验证存档恢复保留对应 Run / Resolution / View。
- `tests/engine/gameplay-b-route-sample.test.ts` 仍使用独立 `carouselRouteSliceResolver`；它不是正式 bundle，也没有被并入或删除。
- 结果：无需把三处都改写成显式 `scenes: [{ id: 'main' }]`，PB-19 的迁移目标已由隐式 Scene 合同满足。

## 裁定前记录（已由 Owner 统一裁定覆盖）

- G03 最终 Scene ID / Instance / 完成状态和 checkpoint 语义是当前建议实现的前置；不能把旧 Location 或 `interactionSceneId` 直接升格为新 Scene ID。
- 是否把独立 `carousel-route-slice` 保留为单独 resolver 测试 / 样例、纳入正式 Carousel 还是冻结；默认以正式 `gameplayBCarouselDatapack` 为 PB-19 范围，额外切片先不迁移。
- G01 PB-01 / PB-02 与 PB-14 之后，具体还剩哪些 Carousel-specific UI 判断；实施前重查，避免重复移除 / 产生无差异重构。

## 本轮核验（2026-10-08）

- 定向 Engine 测试 4 个文件 / 14 项通过；Operation UI 入口、Controller 与 Park 地图测试 3 个文件 / 43 项通过；`npx tsc --noEmit` 通过。
- `git diff --check` 对本轮变更路径通过。未改正式 Carousel 内容或 UI 代码，只补正式样例的 implicit Scene identity / Resolution / Route / Save 证据。

## GALHCG 影响闭环

- 直接路径 `review_changes` 覆盖本轮两个回归测试及 PB-19～21 Task、G04 Draft / GoalSet；preview token 用于当前 Evidence。
- `concept:operation-sample-content` 新增 Carousel 场景样例测试映射并刷新 Park 虚拟路线测试 Evidence；`concept:operation-scene-deck` 对应测试 Evidence 同步更新；`concept:goal-workflow` 映射 G04 阶段 Draft、GoalSet card 与三个归档 Task。
- 9 条 `maps_to` 更新经 plan 与 `update_map(dry_run=true)` 完整预检 `valid=true` 后提交；写后 `review_changes` 显示直接路径无 stale Evidence。

## 后续边界

- Strategy Park 三战斗和十个非战斗地点分别由 PB-20 / PB-21 记录；PB-22～24 的多 Scene、目标位置群体与 M/N / 临时购买仍属后续范围。

## 相关路由

[[draft-0254-gameplay-b-atomic-scenes-phase-iv-migration]] · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[archive/task-0263-pb-13-scene-identity-lifecycle]] · [[archive/task-0264-pb-14-scene-content-presentation]] · [[archive/task-0267-pb-17-scene-atomic-resolution]] · [[archive/task-0268-pb-18-scene-completion-location-exit]]
