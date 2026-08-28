# docs-824 — 02c 运行循环：start / tick / 阻断复检

> 原文出处：`02-run-logic.md` 四章。单次 `tick()` = 一帧；`start()` 用 `setInterval(1s)` 驱动。

## start()：进入运行态

```text
start() → this.running = true → this.runId = crypto.randomUUID()
        → startSession()（首帧逻辑）
        → setInterval(() => { if (running) tick(); }, 1000)
        → game:started 事件
```

- `startSession()`：入会话池、发 `session:started` 事件、`studentBlocks` 重置。
- `stop()`：清 interval、发 `game:stopped`。

## tick()：一帧的主干

```text
tick()
 ├─ 1. tickSystem.run()            生产结算（GameNumSystem 产出，见 04b）
 ├─ 2. affectorEngine.applyActiveEffects()  持续效果：先重估轮询实例（stat 宽依赖），再执行 Active 实例的 perTickEffects
 │       ├─ effects（激活沿一次性）→ 在 recheck 的 Latent→Active 翻转时执行，不在每帧路径 ==new==
 │       └─ zoneModifiers（区效果）→ 事件驱动 syncAffectorZoneEffects（mount/unmount/recheck 翻转时），不再每帧全量重建 ==new==
 ├─ 3. storyService.tick()         剧情被动推进（activeStory 条件不满足时结算 + 收尾）
 ├─ 4. 阻断复检 recheckStudentBlocks()
 ├─ 5. statsService.tick()         帧统计累计（FramesActive 等）
 └─ 6. game:ticked 事件            通知 UI（controller 的 refreshLight）
```

### 生产结算（tickSystem.run）

- 单一路径（taskProduction Phase 2 起）：只走 **GameNumSystem 的 primitiveGain 树**，逐 Resource 求一次 `evaluateResourceGain` 后 `changeResource` 入账。
- **不再有逐 Spot 的旧结算路径**，也不再有 `baseCapacity` 夹取：产出为 **resource 级聚合**（跨所有 spot），Spot 自身容量不再截断 gain。需要「容量上限」语义应在数据包/数值层显式建模，而非在结算路径截断。
- `spotProduced` 事件按 resource 发出（`spotId` 留空，因产出已是跨 spot 聚合值）；`productions` 同样以 resource 为粒度。
- **失效策略（Phase 5 事件驱动）**：tick 不再每帧 `invalidateProduction()`——状态变更经 `StateMutationService` 发事件定向失效（`resourceChanged` 三路定向），未受影响的 gain 子树跨帧保持缓存；绕过 mutation 直接写 state 的调用方将得到陈旧读数。失效契约详见 [[docs-824/04b-production]] ==new==

## 优先级与时机（原注释「谁先谁后」）

| 时机 | 谁 | 说明 |
| --- | --- | --- |
| 帧首 | `tickSystem` | 先产出，后算持续效果（Affector 影响的是「下一帧可观察结果」） |
| 产出后 | `affectorEngine` | 区效果（mul/flat）→ GameNumSystem 区表；改动可见类 → 状态 |
| 剧情 | `storyService.tick` | 被动闲聊按池触发，需要当前帧快照 |
| 帧尾 | 阻断复检 + 统计 | 学生阻断只读不改状态；统计累计帧数 |

## 阻断复检 recheckStudentBlocks()

- 每个有学生被阻断的 spot 查学生可用性；条件不满足的持续存在，满足的解除（解锁时发给对应学生的聊天提醒）。
- 纯只读判定 + 条件满足时发事件，**不改状态**，故无副作用风险。

---

上一篇：[[docs-824/02b-init-sequence]] · 下一篇：[[docs-824/02d-biz-operations]]
