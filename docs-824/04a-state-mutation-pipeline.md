# docs-824 — 04a 状态写入 4 步管道

> 原文出处：`04-core-algorithms.md` 一章。所有状态变更的必经之路（AGENTS.md 纪律 1）。

## 4 步管道

```text
1. 业务门面（service/GameInstance）做只读校验（canXxx）
2. StateMutationService 写方法：
     ① 改 PlayerState 字段
     ② 同步统计（statsService.record）
     ③ 发对应事件（eventBus.emit）
3. 事件监听器响应（Trigger / Affector / UI 订阅）
4. 可选：重建派生数据（visibility / tag 索引 / GameNum 失效）
```

## 单一写入口 StateMutationService

| 方法 | 效果 | 发事件 |
| --- | --- | --- |
| `setResource`/`changeResource` | 设置/增减资源（Global 资源走 globalResources） | `resourceChanged` |
| `setSpotLevel`/`addSpotLevel` | 设施等级 | `spotLevelChanged` |
| `setManager` | 指派 Manager | `managerChanged` |
| `unlockInit`/`addItem`/`addEnhancement` | 解锁世界线/物品/强化 | `initUnlocked`/`itemCollected`/`enhancementAdded` ==new==（原 `itemAdded` 为笔误，实际事件名 `itemCollected`） |
| `setFlag`/`setExtra`/`addExtra`/`removeExtra` | 标记/扩展数据 | `flagChanged`/`extraChanged` |
| `applyExp`/`breakthroughStar` | 培养推进 | `cultivated`（`kind: 'exp'` / `'star'`）==new==（原 `expApplied`/`starUpgraded` 不存在，统一为 `cultivated`） |

## Effect 执行（effect-ops）

- `applyEffects(effects)` 逐条 `applyEffect(effect)`：按 `op` 分发到对应写方法；
- 支持 op：`setResource/addResource/setSpotLevel/addSpotLevel/setManager/addEnhancement/addItem/unlockInit/setFlag/setExtra/addExtra/removeExtra`；
- `loot`/`triggerStory`/`setTheme` 在状态层不落数据（由上层系统转发）。
- 完整 `EffectOp`（23 种）+ `target`/`value` 语义 + `ValueExpression`/`Condition`/`Funclet` 等声明式 DSL 枚举目录见 [[docs-824/03f-declarative-dsl]]。==new==

## 为什么不可绕过

- 校验只发生在门面层，但**写状态必须经管道**，保证：统计不错记、事件不漏发、UI 只读一致性。

---

上一篇：[[docs-824/04-core-algorithms]] · 下一篇：[[docs-824/04b-production]]