# 02-modules/world — 世界结构门面（Init / Area / Spot / 会话 / 存档）

> 一句话：`src/arona-clicker/` Runtime 与领域服务编排世界线生命周期、Spot/物品/强化操作、会话循环与存档；基础引擎只提供机制与状态写入管道。

## 职责边界

- **管**：世界线进出/快照、区域移动、Spot 升级/购买/功能项、物品/强化操作、会话循环、存档与重置。
- **不管**：剧情演出（[[docs/docs-828/02-modules/story]]）、数值结算（GameNum）。

基础引擎的通用部分位于 `src/engine/`；PlayerState、Init 快照与产品视图不再归入引擎目录。

## 关键文件（`src/arona-clicker/`，按域分组）

### 装配与状态

| 文件 | 职责 |
| --- | --- |
| `runtime-wiring.ts` | `wireGameInstance(g, hooks, options)`：产品 Runtime 装配与事件接线 |
| `state/state-factory.ts` | `createDefaultState()` |
| `state/per-init-fields.ts` | `PER_INIT_FIELD_SPECS`：per-Init 字段单一事实源 + 编译期键守卫（T3） |
| `read-model/game-view-builder.ts` | `getView` / `createUIContext` 视图组装 |

### 世界线生命周期

| 文件 | 职责 |
| --- | --- |
| `services/init-service.ts` | Init 进入/退出/快照保存恢复、`travelToArea` 可达性、`purchaseInit` |
| `services/init-mount.ts` | `mountInitTriggers`：世界线专属 Trigger 挂载 |
| `state/init-savepoint.ts` / `state/snapshot.ts` | Init 断点 save/clear/restore（遍历 SPECS）/ Spot 条目切分辅助 |

### 操作门面

| 文件 | 职责 |
| --- | --- |
| `services/spot-service.ts` | Spot 升级/购买/标签增减（幂等判定 + `spotTagChanged` 链）/ 功能项面板 |
| `services/item-service.ts` | 物品使用/发放（`pickupEffects`） |
| `services/enhancement-service.ts` | 强化解锁/移除 |

### 会话与存档

| 文件 | 职责 |
| --- | --- |
| `src/engine/runtime/session-service.ts` | 1 tick/秒循环、running/runId、Session 上下文 |
| `runtime-save-codec.ts` | 存档序列化/反序列化（`normalizePlayerState` 兜底、version 校验） |
| `runtime-reset.ts` | 运行时重置 / reload |

### 其他领域服务（`src/arona-clicker/services/`）

| 文件 | 职责 |
| --- | --- |
| `spot-functionality.ts` | Spot 功能项（`linearYield` / `restartInit` / `hardResetInit` / `gacha`）注册与查询 |
| `loot-system.ts` | 掉落池纯计算（`rollTable` 返回物品数量）；实际发放由 `item-service.ts` 的 `rollDropTable` 调用 `giveItem` 完成，`loot` EffectOp 当前仍未接线 |

## 核心概念

- **世界结构三层**：`InitDef`（世界线）→ `AreaDef`（区域，相邻移动）→ `SpotDef`（设施）。
- **门槛链**：业务操作 = 门面只读判定（canXxx / reveal 阶段）+ mutations 写入，见 [[docs/docs-828/01-architecture/run-logic]] 四。
- 重置路径三条 + 彻底重置，见 [[docs/docs-828/01-architecture/run-logic]] 五。

## 测试入口

`tests/engine/game-instance.test.ts`、`tests/engine/spot-functionality.test.ts`、`tests/engine/per-init-fields.test.ts`、`tests/engine/enhancement-scope.test.ts`

## 相关文档

[[docs/docs-828/01-architecture/run-logic]] · [[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]]（T1/T3/T6 执行记录）
