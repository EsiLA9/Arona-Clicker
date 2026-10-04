# 06-wiki/10-application-runtime/lifecycle — Lobby、Init 与会话生命周期

> 本文回答：Runtime 装载完成后怎样处于 Lobby、进入 Init 并运行会话。

## 生命周期阶段

1. `applyEnabledPacks()` 装载当前启用集。游戏 UI 入口将 `enterDefaultInit` 设为关闭，先留在 Lobby。
2. Lobby 的 `activeInit` 为空，可浏览全局服务并选择 Init，不启动 Tick。
3. 选择或恢复 Init 时，`InitService` 建立或恢复 per-Init 状态，并接通对应运行服务。
4. `SessionService` 调用 Runtime 的 Tick 回调并管理定时器和事件 flush。
5. 切换、重启、加载存档或重置通过 Runtime 生命周期方法停会话、保存/恢复状态并重建派生系统。

```text
loaded Runtime → Lobby → choose / resume Init → start Session → tick loop
       ↑                    ↓                         ↓
     reload ← reset / load / restart / travel ← save / state transitions
```

精确的清理与恢复细节分布在 `runtime-game-instance.ts`、`runtime-reset.ts`、`init-service.ts` 和 `runtime-save.ts`；本页只描述责任关系，不将所有重建路径简化成相同事务。

## 代码与测试

源码：`src/arona-clicker/runtime-game-instance.ts`、`src/arona-clicker/runtime-reset.ts`、`src/arona-clicker/services/init-service.ts`、`src/engine/runtime/session-service.ts`。测试见 `tests/engine/` 中的 Init、Session 和 save/load 测试。
