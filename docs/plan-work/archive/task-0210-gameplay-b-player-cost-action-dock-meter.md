# Task 0210 — 玩法 B 玩家 Cost 横向槽与 Click 后余额

状态：done — Action Dock Cost 槽、费用去重、桌面浏览器和全套原型验证已完成

## 目标

将玩法 B 的玩家 Cost 从路线摘要中收纳到唯一 Action Dock 左侧，以蔚蓝档案经典横向矩形槽表现当前持有量及本次 Click 后余额，减少事件、地图等信息对后续聊天式中心流的空间竞争。

本 Task 是渐进式内容收纳的第一步。它只调整 Cost 资源读数，不重排聊天/事件中心流，也不预测未选择的下一场景 Cost。

## 设计裁定

1. **当前持有量常驻。** Action Dock 左侧显示当前实际持有玩家 Cost。
2. **Click 后显示本批结算余额。** 当场景批次准备完整、费用可支付且没有未确认卡牌目标时，显示 `playerCost - 本批行为与玩家卡总费`。
3. **不推演路线入口奖励。** 用户选择只显示本次 Click 后余额，不预测携带上限或未来出口/场景的入场 Cost。运行时仍按离场携带上限和目标场景入场奖励结算。
4. **不可确定时不伪造数字。** 当前场景必选项尚未完成、目标草稿未确认、费用不足、已经完成待选出口或路线终态时，次行显示对应等待/不足/终态提示，不显示假余额。
5. **保持单一主操作。** Cost 槽位置于现有 Action Dock 左侧；Click 说明和主按钮仍在同一 Dock 中。风格使用短标签、数字与多枚横向矩形槽，不改变战斗/场景结算行为。
6. **避免重复资源摘要。** 从路线资源摘要和本批状态行移除当前 Cost/余额重复读数；地图继续显示持有物与手牌/牌堆数量，选择区保留本批费用，Dock 是持有量与 Click 后余额的唯一状态读数。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Route View 提供当前 `playerCost`；当前节点本批应付 Cost 由 `sceneChoice.totalCost` 汇总。 | `prototypes/gameplay-b/src/model.ts`：`GameplayBRouteView`；`prototypes/gameplay-b/src/runtime.ts`：`getSceneChoiceView()` | 余额只做 UI 投影，不新增或持久化 Runtime 状态。 |
| 场景批次结算前先扣除所选行为与卡牌费用；未完成或费用不足时 Runtime 不接受 Click。 | `prototypes/gameplay-b/src/runtime.ts`：`resolveSceneChoiceClick()`、`click()` | 预测值只在可提交且已确认当前目标时显示。 |
| 目标卡的未确认草稿费用由 UI 单独叠加显示，并阻止 Click。 | `prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()`、`cardTargetDrafts`、`updateAdvanceAvailability()` | Cost Meter 必须包含草稿费用，且不把目标草稿误报为可结算余额。 |
| 玩家 Cost 离开场景时按来源节点携带上限收敛，进入目标场景再增加该节点的 Cost。 | `prototypes/gameplay-b/src/runtime.ts`：`chooseExit()`、`enterNode()` | 本 Task 不推演未来路线值；明确标注 Click 后余额仅对应当前批次。 |
| Route Action Dock 当前为 Click 说明+主按钮的两列结构；独立 battle mount 也有同名 Dock，但该用户需求针对玩法 B 路线界面。 | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`mountBattleView()`；`prototypes/gameplay-b/src/style.css`：`.action-dock` | 修改范围限路线界面 Dock，避免影响独立战斗预览。 |
| 路线资源摘要和场景批次状态目前也重复显示当前 Cost 与余额。 | `prototypes/gameplay-b/src/view.ts`：`syncMapAndResources()`、`syncSceneChoices()`、`update()` | 把持有量和 Click 后余额集中到 Dock；地图只保留物品/牌组概况，场景选择区只保留本批费用及必选状态。 |

## 施工切片

### U1：Action Dock Cost 槽

**Goal：**在路线界面 Action Dock 左侧提供稳定、可读的当前玩家 Cost 与本次 Click 后余额投影。

**Read Set：**

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/00-INDEX.md`、`docs/docs-829/05-conventions/testing.md` | 当前事实路由和验证要求。 |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Unit 白名单、DOM 范围和 Receipt 要求。 |
| 历史裁定 | `docs/plan-work/archive/task-0208-gameplay-b-low-cognitive-load-ui-and-core-play.md` | 保持 Dock、桌面画布与 DOM 连续性既有边界。 |
| 源码 | `prototypes/gameplay-b/src/model.ts`：`GameplayBRouteView` | 读取 view 数据边界。 |
| 源码 | `prototypes/gameplay-b/src/runtime.ts`：`getSceneChoiceView()`、`resolveSceneChoiceClick()`、`chooseExit()` | 确认当前余额、批次费用和不预测未来路线值。 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`syncSceneChoices()`、`updateAdvanceAvailability()`、`update()` | 建立 Cost 投影及 DOM 刷新入口。 |
| 样式 | `prototypes/gameplay-b/src/style.css`：`.action-dock` | 调整 Dock 三列布局和横向槽样式。 |
| 测试 | `prototypes/gameplay-b/tests/route-ui.test.ts` | 覆盖纯 Cost Dock 投影状态。 |

**Constraints：**纯 UI 投影；不改 `GameplayBRouteRuntime`、Cost 公式、路线数据或节点内容。只读屏幕宽度固定为 1280×720 的桌面验收，不测试窄屏重排。

**Allowed Files：**

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-ui.test.ts`

**Explicit Non-goals：**

- 不改 AC Runtime、角色 sCost、战斗手牌 Cost 或其他场景/地图/聊天布局。
- 不显示下一个路线节点或多出口的成本预测。
- 不改变 Cost 上限、扣费、入场奖励、出口消费或 Click 规则。
- 不实施未来聊天式中心流大改；该方向保留为后续逐项收纳工作。

**Completion Criteria：**

- [x] 路线界面 Action Dock 左侧显示当前持有 Cost 和本批 Click 后余额，矩形槽与数字同步。
- [x] 余额计算包含待提交行为、已选玩家卡及正在编辑的目标卡费用；费用不足或选项/目标未确认时显示明确状态，不显示错误的可支付余额。
- [x] 非场景选择 Click 不改变 Cost 时，展示值准确；待选择出口/终态不会伪造 Click 后数值。
- [x] 当前持有量与 Click 后余额不再在地图资源摘要和批次状态行重复显示；本批费用仍与选择区对应。
- [x] 1280×720 下 Dock 三列不挤压主按钮；Cost 槽有清晰文本/无障碍名称，不影响既有 Click 文案、事件滚动或焦点行为。
- [x] 只修改白名单文件，玩法 B 全量测试、类型检查与构建通过；文档检查通过。

## 当前核验（2026-10-04）

- 用户确认 Cost Meter 不预测下一场景，只显示本次 Click 后余额。
- 源码核对确认 Route Runtime 在当前场景批次提交时扣费，在离开场景/进入新节点时再进行携带上限和入场 Cost 结算。
- U1 只修改白名单中的 `prototypes/gameplay-b/src/view.ts`、`src/style.css` 与 `tests/route-ui.test.ts`；未改 Runtime、规则或 AC。

## Execution Receipt — U1

- Action Dock 新增两行横向矩形 Cost 槽，读取现持余额；第二行只投影本批明确已选的行为/卡牌费用，跨场景携带上限和入口奖励不纳入。
- 缺少必选行为、目标草稿未确认、费用不足、等待选择出口和路线终态都有独立状态；不足时 Click 保持禁用。
- 从路线地图资源摘要移除了重复的当前 Cost；批次标题只保留本批费用，持有量和 Click 后余额集中在 Dock。
- 固定 Seed `park-inspection-graph-demo` 浏览器实测：入口持有 2 Cost；领取免费行为后仍显示 Click 后 2；选 1 Cost 玩家卡后显示 1；再选 1 Cost 检查行为后显示“不足 1”且 Click 禁用；目标卡显示“待确认”并锁住提交；将行为切回 0 Cost 后 Click 后余额为 0；场景完成、等待出点时显示“先选出口”而不预测未来值。
- 视口 1280×720；Action Dock 网格三列实测宽度约 151/286/126px，Cost 槽、说明和按钮未横向挤压。浏览器控制台 0 error。
- 定向测试 `npm test -- route-ui`：7/7；玩法 B 原型全测：18 文件 / 159 项通过；`npm run typecheck`、`npm run build` 通过。
- 文档检查 `npm run check:docs`：578 篇 Markdown，0 errors；`git diff --check` 通过（Git 只提示工作区既有换行格式）。不在本 Unit 内运行窄屏验收。

## 剩余工作

- 本 Task 范围内无剩余工作。
- 长期方向仍是让聊天式中心流占主要空间；这次只完成 Cost 摘要收纳，中心流的逐步整理需在后续 Task 继续。

## 相关路由

- [[draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance]]
- [[task-0208-gameplay-b-low-cognitive-load-ui-and-core-play]]
- [[docs/docs-829/05-conventions/testing]]
