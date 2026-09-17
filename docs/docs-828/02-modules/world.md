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
- **Area 连通性**：静态连接来自 `AreaDef.adjacentAreaIds`；Active Affector 可通过 entry 的 `areaConnections` 临时追加单向/双向连接。动态连接不写回 AreaDef，失活或卸载后消失；普通移动仍受当前 Init 与 Area 可见性门槛约束。
- **门槛链**：业务操作 = 门面只读判定（canXxx / reveal 阶段）+ mutations 写入，见 [[docs/docs-828/01-architecture/run-logic]] 四。
- **Spot 支付**：解锁必须声明 `purchaseOptions`，升级必须在目标 `levelUpgrades[].paymentOptions` 中声明；每个价格组可由多个 `Resource` / `Item` 费用项组成，费用项为 AND，价格组为 OR。这里的价格组是 Spot 自身的默认价格层；未来外部 Affector 追加的价格组属于独立运行时层，不写回 SpotDef 或 RuntimeEditor 草稿。显式免费使用 `[{ id: 'free', costs: [] }]`；顶层 `purchaseOptions: []` 表示当前没有购买途径，不等同于免费。缺失价格组不会回退为默认支付；升级条目仍必须至少有一个价格组。单方案可直接执行，多方案必须由命令携带 `paymentOptionId`，UI 负责弹窗选择。
- **Def 审计时间**：可扩展 Def 可携带 `metadata.createdAt` / `metadata.updatedAt`（Unix milliseconds）。历史内容缺失时间时，Registry 查询结果使用 `Number.MIN_SAFE_INTEGER` 参与排序与筛选，但不回写原始 Def；同时保留 known 标记供 UI 显示“时间未知”。
- 重置路径三条 + 彻底重置，见 [[docs/docs-828/01-architecture/run-logic]] 五。

## 测试入口

`tests/engine/game-instance.test.ts`、`tests/engine/spot-functionality.test.ts`、`tests/engine/per-init-fields.test.ts`、`tests/engine/enhancement-scope.test.ts`

## 相关文档

[[docs/docs-828/01-architecture/run-logic]] · [[adr-0001-architecture-consolidation]]（T1/T3/T6 执行记录）
