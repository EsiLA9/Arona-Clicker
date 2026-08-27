# docs-824 — 02d 业务门面操作与 UI 只读消费

> 原文出处：`02-run-logic.md` 五、八章。业务操作统一走 StateMutationService（单一写入口），UI 只消费 `getView()`。

## 业务门面操作门槛链

| 操作 | 入口 | 前置门槛 | 写状态 |
| --- | --- | --- | --- |
| 升级 Spot | `upgradeSpot` | `canUpgradeSpot`（花费足够 + 等级 < 上限 + 有条件未满足则拒绝） | mutations.setSpotLevel + 扣费 |
| 购买 Spot | `purchaseSpot` | `canPurchaseSpot`（reveal 到 `purchaseable`） | 解锁 + 扣费 |
| 招募 | `gachaService.roll` | 卡池 drawable + 货币足够 | 变体/碎片/货币 |
| 培养 | `cultivateSystem.applyExp` | 曲线 + 突破判定 | exp/star/attachments |
| 剧情 | `storyService.*` | reveal 门槛 + triggerCondition | storyLog + 奖励 |

## 为什么必须是「门面 + mutations」

- 门面做**只读判定**（canXxx）与**顺序编排**；真正改状态只经 `StateMutationService` 一个对象。
- 每个写方法内：**改 state → 扣费 → 发对应事件**（事件驱动 UI 与联动）。

## UI 只读消费

- UI（`src/ui/controller.ts`）只调用 `game.getView()` / `createUIContext()`；
- `getView()` 返回 `GameView`（资源快照 + spotLevels + unlockedInits + storyLog + visibility 等）；
- UI 不持有写引用，刷新走 `refreshLight`（轻量数字）或 `render`（全量重建）。

## 通信录 / 图鉴（原八章）

- `rosterSystem`：已收集差分图鉴 + 未收集占位；
- 招募入口在 Spot 的 `gacha` 功能项（见 AGENTS.md「Spot 招募」）；
- 悬停详情：`tooltip.ts` 的 `render*Detail` 走信息揭示阶梯（见 [[docs-824/04f-trigger-effect]] 中 reveal 部分）。

---

上一篇：[[docs-824/02c-tick-loop]] · 下一篇：[[docs-824/02e-save-load-restart]]
