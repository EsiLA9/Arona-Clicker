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
 ├─ 2. affectorEngine.applyActiveEffects()  持续效果：先重估轮询实例，再按当前挂载实例逐条 apply
 │       ├─ 直接效果（改动可见类）→ applyEffects
 │       └─ zoneModifiers（区效果）→ syncAffectorZoneEffects 并入数值树
 ├─ 3. storyService.tick()         剧情被动推进（activeStory 条件不满足时结算 + 收尾）
 ├─ 4. 阻断复检 recheckStudentBlocks()
 ├─ 5. statsService.tick()         帧统计累计（FramesActive 等）
 └─ 6. game:ticked 事件            通知 UI（controller 的 refreshLight）
```

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
