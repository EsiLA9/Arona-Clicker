# 01-architecture/design-constraints — 仍生效的设计约束

> 本文回答：当前系统里有哪些**已被代码实现、不可违反**的设计约束；每条由哪份 ADR 裁定、在源码哪里落地。
> 原 ADR 与其他计划文档已整体冻结至 `docs/plan-work/archive/`；本文是它们中**仍对当前代码有约束力**的那部分视图。未实现的部分不在本文，见 [[docs/plan-work/00-index]] 的「未决方向」。

## 命名与包（原 [[adr-0004-datapack-management]]）

| 约束 | 源码落点 |
| --- | --- |
| 实体 id 统一 `modName:typeName:idName`，中段必须属于已注册类型枚举 | `src/engine/core/entity-id.ts`、`src/data-services/registry/registry-validate.ts` |
| 包内 id 的 `modName` 必须等于所在包 `manifest.modName`；非三段或未注册 `typeName` 报错 | `src/data-services/datapack/manifest.ts`、`pack-parser.ts` |
| 启用集内 `modName` 唯一，冲突即整套拒绝加载（all-or-nothing） | `src/data-services/datapack/pack-manager.ts`（`validateEnabledSet` / `applyEnabledSet`） |
| 内置 base 包恒启用，不可停用或删除 | `pack-manager.ts` |
| 启用集变更必须先全量干跑校验，通过后才 `reload` | `pack-manager.ts`（`PackApplyTarget`） |

## UI 背景层叠（原 [[adr-0006-ui-background-layering]]）

| 约束 | 源码落点 |
| --- | --- |
| 背景配置只走 `ThemeDef.background`，不新增独立背景注册表；图片走 Pic 链 | `src/engine/types/theme.ts`、`src/ui/background-service.ts` |
| 层序沿用 `player → init → area → student → user / preview / ephemeral`，低优先后绘 | `src/engine/core/theme-runtime.ts`、`src/ui/controller-theme.ts` |
| 有 id 的层按 id 覆盖，无 id 的层按声明序追加 | `background-service.ts`、`src/ui/layer-css-safety.ts` |
| 背景不进入 `PlayerState`，UI 只见只读 `BackgroundView` | `src/ui/context.ts` |
| 最外层背景挂在 `body` 直系 `.console-background#ui-background-layer`，不接收指针事件 | `src/ui/index.html`、`src/ui/outer-background.ts` |
| 背景图只用已解析 Pic URL；CSS 值走白名单与安全过滤，失效层跳过并回退 | `background-service.ts`、`layer-css-safety.ts` |
| 临时主题背景（`setTheme`）随剧情临时层一并清理 | `controller-theme.ts`、`color-system` ephemeral 层 |

## Shop 交易边界（原 [[adr-0007-shop-transaction-boundaries]]）

| 约束 | 源码落点 |
| --- | --- |
| Shop 是 Spot Function，入口必经 `functionalitiesOf()`；`ShopSession` 不进存档 | `src/data-services/contracts/world.ts`、`src/arona-clicker/services/shop-service.ts` |
| PurchaseScope 正交 `lifetime(global\|init)` × `owner(shop\|spot)`；`owner=shop` 时 key 不带 Spot 身份 | `shop-service.ts`、`src/data-services/contracts/shop.ts` |
| PurchaseRecord 只持久化 `purchasedQuantity`，剩余库存由 policy 派生 | `shop-service.ts`、`src/arona-clicker/types/state.ts` |
| checkout 在同一同步栈内完成 plan → commit，不允许 async gap | `shop-service.ts` |
| 预备阶段不得即时写状态、更新统计或 emit；失败时 `PlayerState`、Stats、EventBus 均不变 | `src/arona-clicker/state/state-mutation-service.ts`（`commitShopTransaction`） |
| 成功提交先产出 CommitReceipt，再按 **line** 级释放 `shopPurchased`（不按数量展开） | `shop-service.ts`、`src/arona-clicker/contracts/event-catalog.ts` |

## 角色成长边界（原 [[adr-0008-character-progression-boundaries]]，A 段）

| 约束 | 源码落点 |
| --- | --- |
| 好感属 Variant；Proto 总好感 = Σ Variant | `src/arona-clicker/types/character.ts`、`affection-system.ts` |
| 本轮不设计 Chara-Spot；`spotManagers` 只做门控，不承载生产加成 | 状态字段存在，**无加成消费者**（刻意保留） |
| 归属翻转冻结，`roster` 维持 global | `src/arona-clicker/state/per-init-fields.ts` |
| 废弃 `levelCapPerStar`；有效等级上限 = `min(curve.maxLevel, accountLevelCap, 特殊上限)` | `src/arona-clicker/services/cultivate-system.ts`（`resolveVariantLevelCap`） |
| 装备 tier 按 Variant 隔离；槽类型由数据包声明 | `src/data-services/contracts/character-progression-def.ts` |
| 伞事件 `characterProgressChanged` 取代 `cultivated` / `affectionChanged` | `src/engine/types/events.ts`、`event-catalog.ts`、`trigger-system.ts` |
| `CharacterMemory` 永远 global，不登记进 `PER_INIT_FIELD_SPECS` | `src/arona-clicker/types/state.ts`、`per-init-fields.ts` |
| `equipmentsOwned` 纳入 per-Init 快照（`equips` scope） | `per-init-fields.ts`、`init-savepoint.ts` |

## Init 生命周期（原 [[adr-0009-init-lifecycle-boundaries]]）

| 约束 | 源码落点 |
| --- | --- |
| Init 转换只能由 `InitService` 统一编排 | `src/arona-clicker/services/init-service.ts` |
| 不活跃 Init 冻结，不获 Tick 或离线收益 | `init-service.ts` |
| 每次 switch / restart 递增 `runtimeGeneration`，旧异步回调必须失效 | `init-service.ts`（`invalidateRuntimeGeneration` / `isRuntimeGenerationCurrent`） |
| 目标实体默认只能写当前 Init，不引入 foreign-Init mutation 语法 | `per-init-fields.ts`、`initSnapshots` |
| Story cursor 纳入 Init 恢复边界 | `per-init-fields.ts`、`src/arona-clicker/runtime-save.ts` |
| 不编写任何存档迁移 | 全仓无迁移层（架构纪律 8） |

## Definition 来源解析（原 [[adr-0010-definition-repository-editor-resolution]] / [[adr-0011-definition-resolution-withdrawal]]）

| 约束 | 源码落点 |
| --- | --- |
| Registry 只做运行时物化；编辑器草稿不得直接 mutation Registry | `src/arona-clicker/services/runtime-content-coordinator.ts` |
| `DefinitionKey` 只描述逻辑身份，来源层不进 key | `src/data-services/definition/definition-types.ts` |
| 三态 `resolved / suspended / missing` 语义严格，不混用 | `definition-types.ts`、`definition-resolution.ts` |
| 首阶段 Draft-only Tombstone，必须有明确 owner；resume 只撤自身 owner | `definition-resolution.ts`（`suspendDefinition` / `resumeDefinition` / `assertDraftLayer`） |
| `remove-override` / `delete-local` / `suspend` / `resume` 作用对象与回退规则各异 | `definition-resolution.ts` |
| `DefinitionDelta` 只表达内容事实，Runtime 侧解释 | `definition-types.ts` |
| Tombstone 不进正式 Datapack 格式；不改 Registry 生命周期 API | 与代码一致（仅纯类型） |
| Shop UI 用独立 `ShopQueryPort`，checkout 只在命令侧 | `src/arona-clicker/contracts/shop-query.ts` |

## Runtime 热内容 CRUD（原 [[adr-0012-runtime-hot-content-crud]]）

| 约束 | 源码落点 |
| --- | --- |
| 首阶段只做单临时 Mod 的 Spot 热 CRUD | `src/arona-clicker/contracts/runtime-content.ts`、`runtime-content-coordinator.ts` |
| 提交单位固定为一个 `RuntimeSpotMutation`，带 `expectedRevision` 拒绝过期提交 | `runtime-content-coordinator.ts` |
| Runtime 使用 Overlay Map，不重建 Datapack | `runtime-content-coordinator.ts` |
| Registry 提供受控局部 mutation，不暴露可写 Map | `src/data-services/registry/registry.ts`（`applySpotMutation`） |
| 成功变更发 `spotDefinitionChanged`；热 CRUD 不得触发 `reloadPreservingState` / `buildAll` / `rebuild` | `runtime.ts`、`visibility-engine.ts`、`game-num-build.ts` |
| `PlayerState` 与 Definition 生命周期分离（`delete` 默认 Retain，`purge` 显式清理） | `runtime-content.ts`、`runtime-content-coordinator.ts` |
| 首阶段不开放 functionalities / gachaPools / Trigger / Story / Shop 等等价字段 | `runtime-content-coordinator.ts`（`RUNTIME_SPOT_FIELDS` 白名单） |

## 尚未落地的纸面约束

以下条目在 ADR 中被写成约束，但**源码中找不到落点**；它们不是当前事实，不得据此判断系统行为。仍被视作未决方向，索引见 [[docs/plan-work/00-index]]：

- 惰性存档的**全量**语义：除 Tag 外的 roster / 背包 / `storyReadLogs` / flags / 好感等均未做存在性过滤，残留检查与清除界面不存在（现仅 `src/arona-clicker/state/tag-residue.ts` 覆盖 Tag）。
- Source 三形态中的 `file` / `folder` 适配器未实现（仅 `ZipPackSource`）。
- 分片解析器未做按扩展名注册（仅 JSON）。
- `affectionConfig` 未改特化表，`affectionConfigId` 全仓 0 匹配（仍是单值 `registry.affectionConfig`）。
- character / variant id 三段化（S1c）未实现，`registry-validate.ts` 对两者仅做格式校验。
- 角色成长 B 段：`ProgressionEffectResolver`、跨世界线 catch-up、Chara-Spot 消费者均未实现。
- `DefinitionRepository` 的最小只读接口形状已被 ADR-0011 取代，代码中无该形状。
- `RuntimeInvalidationPlanner` / `RuntimeRebuildCoordinator` 仅存在于文档。
- 编辑器专用背景可视化预览（多份 roadmap 的共同待补项）无实现。

## 相关文档

[[docs/docs-828/01-architecture/overview]] · [[docs/docs-828/01-architecture/state-layers]] · [[docs/docs-828/03-data-structures/player-state]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/plan-work/00-index]]
