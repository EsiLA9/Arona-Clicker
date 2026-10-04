# Task 0211 — 玩法 B 单行 Cost 消费槽预览

状态：done — 单条持有 Cost 槽和拟消费格动画已实现并通过验证

## 目标

将 Action Dock 左侧玩家 Cost Meter 从“持有槽 + Click 后余额槽”改为一条横向持有槽。选定本批行为/玩家卡后，对应数量的槽以经典游戏资源条的短促闪烁与降色效果标记拟消费 Cost；保留可读数字和剩余余额文字，Click 成功后只显示更新后的实际持有槽。

此 Task 是对 Task 0210 展示形式的直接修正，不改变其 Cost 预测口径、收费规则、地图去重或中心流逐步整理边界。

## 设计裁定

1. **仅一条 Cost 槽。** 删除独立的“Click 后”第二行/第二条槽；持有 Cost 用一排横向矩形格表现。
2. **槽内标记拟消费格。** 当前批次已有可负担的行为/卡牌选择时，从槽尾对应该预选费用数量的格子显示闪烁/降色；若必选项/目标尚未最终确认，行内必须标“预选/待确认”。所有格仍代表当前实际持有 Cost，不提前扣账。
3. **Click 后余额改为行内数字。** 主说明以短文显示 `持有 N · 本批消费 M → R`。只有确认本批所需选择/目标且费用可支付时，才显示确定余额 R。存在局部选择时只显示标明“预选”的费用提示；Cost 不足、等待出口或终态时不闪烁消费格，也不伪造可结算数值。
4. **结算后以 Runtime 状态为准。** 成功 Click 后扣费，已消费槽随当前持有量减少而消失；动画只表示尚未提交的费用预览，不代表状态已扣除。
5. **尊重减少动态偏好。** 若用户系统设置减少动态，则消费槽保持降色/静态强调，不运行闪烁动画。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Task 0210 的路线 Action Dock 当前左侧渲染两组独立 Cost 槽，分别显示当前持有与 Click 后余额。 | `prototypes/gameplay-b/src/view.ts`：`createPlayerCostMeterRow()`、`syncPlayerCostDock()`；`prototypes/gameplay-b/src/style.css`：`.player-cost-meter-row` | 本 Task 只改呈现结构和预览状态，不调整 Cost 算法。 |
| 本批行为、玩家卡及局部目标草稿费用可由 `sceneChoice.totalCost` 和 `cardTargetDrafts` 取得。 | `prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()`、`syncPlayerCostDock()` | 消费格数随当前编辑选择变化；未提交状态继续标作预览。 |
| Runtime 只有可支付且必选项完成时才结算，并在 Click 时扣除已选 Cost。 | `prototypes/gameplay-b/src/runtime.ts`：`click()`、`resolveSceneChoiceClick()` | 结算前槽仍显示当前真实持有数；结算后由新 View 更新槽数。 |

## 施工切片

### U1：单行消费槽

**Goal：**在 1280×720 桌面 Action Dock 中用单条 Cost 槽呈现持有和本批拟消费预览，去掉独立 Click 后槽。

**Read Set：**

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/00-INDEX.md`、`docs/docs-829/05-conventions/testing.md` | 项目事实路由与测试要求。 |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Unit 白名单和 DOM/Receipt 边界。 |
| 历史任务 | `docs/plan-work/archive/task-0210-gameplay-b-player-cost-action-dock-meter.md` | 保留已裁定的余额口径和路线资源去重。 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：`projectPlayerCostDock()`、`updatePlayerCostMeterRow()`、`syncPlayerCostDock()`、`syncSceneChoices()` | 更新单行投影、格子状态和无障碍摘要。 |
| 样式 | `prototypes/gameplay-b/src/style.css`：`.player-cost-meter`、`.player-cost-meter-slot`、`.action-dock` | 单行槽布局、消费闪烁/降色与减少动态支持。 |
| 测试 | `prototypes/gameplay-b/tests/route-ui.test.ts` | 覆盖拟消费格数与不可提交状态投影。 |

**Constraints：**纯 UI 投影，不改 Runtime 或 Cost 消费语义；仅验收 1280×720 固定桌面，不测试窄屏重排。页面结构只保留一个 Cost 槽行。

**Allowed Files：**

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-ui.test.ts`

**Explicit Non-goals：**

- 不更改 Task 0210 对下一场景入口奖励/携带上限的非预测边界。
- 不改 Cost/Click/路线规则，不改地图摘要去重。
- 不进行中心流聊天布局整体重构，不改 AC Runtime 或窄屏响应式布局。

**Completion Criteria：**

- [x] Action Dock 仅有一排玩家 Cost 矩形槽，不再并列/叠放显示两组独立余额槽。
- [x] 已选待付费用在当前持有槽内以可辨识的闪烁与降色状态预览；余额文字和持有总值准确，未 Click 前不误报已扣费。
- [x] 选择未完成或目标未确认时，不显示确定的 Click 后余额；若当前预选费用可支付，消费槽标作“预选/待确认”。Cost 不足、等待出点与终态下不闪烁消费格。
- [x] Click 结算后消费标记清除，槽位数量反映 Runtime 更新后的实际 Cost。`prefers-reduced-motion` 下维持静态降色提示。
- [x] 1280×720 下单行 Cost Meter、Click 说明与主按钮完整可读；原场景费用、路线和地图摘要保持既有边界。
- [x] 白名单变更、玩法 B 全量测试、类型检查、构建、文档检查通过。

## 当前核验（2026-10-04）

## Execution Receipt — U1

- Action Dock 收敛为单条玩家 Cost 槽；持有 Cost 的槽保持亮色，本批拟扣除的末端槽使用金灰闪烁与降色动画。明细文字行内显示 `−M → R`，未结算前不扣除持有槽。
- 场景选择尚未完成/目标未确认时，对费用可支付的部分显示“预选”并保留闪烁；Cost 不足、等待出口、路线终态下不标记消费格，也不显示确定余额。
- 点击确认后，Runtime 返回的新玩家 Cost 更新槽数并清除动画。系统启用 `prefers-reduced-motion` 时使用静态降色提示。
- 固定种子 `park-inspection-graph-demo` 浏览器实测 1280×720：持有2、拟消费1时仅一排2格、1格消费态闪烁；消费 Click 后为1格持有且0格闪烁。目标未确认时状态为“预选 −2 · 待确认”且 Click 禁用；费用不足1时消费动画关闭、Click 禁用。
- Dock 三列在该视口宽度约 151/286/126px；Console 0 error。
- 定向 `npm test -- route-ui` 7/7；全量原型 18 文件/159 项通过；`npm run typecheck`、`npm run build` 通过。`npm run check:docs` 扫描 579 篇 Markdown、0 errors。
- `git diff --check` 在 Task 归档与索引更新后通过；Git 仅提示若干既有 CRLF 文件的行尾规范化警告，无空白错误。

## 剩余工作

- 本 Task 范围内无剩余工作。
- 聊天式中心流占主要空间的整体改进仍是后续逐项收纳工作，不由本 Task 完成。

## 相关路由

- [[task-0210-gameplay-b-player-cost-action-dock-meter]]
- [[draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance]]
- [[docs/docs-829/05-conventions/testing]]
