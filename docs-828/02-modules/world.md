# 02-modules/world — 世界结构门面（Init / Area / Spot / 会话 / 存档）

> 一句话：`src/engine/game/` 门面层编排世界线生命周期、Spot/物品/强化操作、会话循环与存档编解码；装配逻辑在 `wiring.ts`（T1 外移）。

## 职责边界

- **管**：世界线进出/快照、区域移动、Spot 升级/购买/功能项、物品/强化操作、会话循环、存档与重置。
- **不管**：剧情演出（[[docs-828/02-modules/story]]）、数值结算（GameNum）。

## 关键文件（`src/engine/game/`，按域分组）

### 装配与状态

| 文件 | 职责 |
| --- | --- |
| `wiring.ts` | `wireGameInstance(g, hooks, options)`：全部子系统装配 + 事件接线（构造器只剩 new + wire，T1） |
| `state-factory.ts` | `createDefaultState()`（per-Init 部分引 SPECS） |
| `per-init-fields.ts` | `PER_INIT_FIELD_SPECS`：per-Init 字段单一事实源 + 编译期键守卫（T3） |
| `view-builder.ts` | `getView` / `createUIContext` 视图组装 |

### 世界线生命周期

| 文件 | 职责 |
| --- | --- |
| `init-service.ts` | Init 进入/退出/快照保存恢复、`travelToArea` 可达性、`purchaseInit` |
| `init-mount.ts` | `mountInitTriggers`：世界线专属 Trigger 挂载 |
| `init-savepoint.ts` / `snapshot.ts` | Init 断点 save/clear/restore（遍历 SPECS）/ Spot 条目切分辅助 |

### 操作门面

| 文件 | 职责 |
| --- | --- |
| `spot-service.ts` | Spot 升级/购买/标签增减（幂等判定 + `spotTagChanged` 链）/ 功能项面板 |
| `item-service.ts` | 物品使用/发放（`pickupEffects`） |
| `enhancement-service.ts` | 强化解锁/移除 |

### 会话与存档

| 文件 | 职责 |
| --- | --- |
| `session-service.ts` | 1 tick/秒循环、running/runId、Session 上下文 |
| `save-codec.ts` | 存档序列化/反序列化（`normalizePlayerState` 兜底、version 校验） |
| `runtime-reset.ts` | 运行时重置 / reload |

### 其他（`src/engine/system/`）

| 文件 | 职责 |
| --- | --- |
| `system/spot-functionality.ts` | Spot 功能项（`linearYield` / `restartInit` / `hardResetInit` / `gacha`）注册与查询 |
| `system/loot-system.ts` | 掉落池结算（`loot` effect → giveItem） |

## 核心概念

- **世界结构三层**：`InitDef`（世界线）→ `AreaDef`（区域，相邻移动）→ `SpotDef`（设施）。
- **门槛链**：业务操作 = 门面只读判定（canXxx / reveal 阶段）+ mutations 写入，见 [[docs-828/01-architecture/run-logic]] 四。
- 重置路径三条 + 彻底重置，见 [[docs-828/01-architecture/run-logic]] 五。

## 测试入口

`tests/engine/game-instance.test.ts`、`spot-functionality.test.ts`、`per-init-fields.test.ts`、`enhancement-scope.test.ts`

## 相关文档

[[docs-828/01-architecture/run-logic]] · [[docs-828/06-adr/0001-architecture-consolidation]]（T1/T3/T6 执行记录）
