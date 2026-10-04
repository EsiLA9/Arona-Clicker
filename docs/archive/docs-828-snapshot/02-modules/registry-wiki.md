# 02-modules/registry-wiki — Registry：Datapack 定义的装载、查询与热变更

> 本文回答：Registry 如何将多个 Datapack 整理成可查询的定义集合，哪些检查在何时运行，以及哪些内容可以在运行期受控变更。

## 概览

`Registry` 是引擎与数据服务共同使用的定义仓库。它按表保存 Init、Area、Spot、剧情、角色、物品、商店、色彩等定义，并维护常用关系索引。普通消费者通过 `ReadonlyMap` getter 和查询方法读取内容；受控的 Init、Area、Spot 热内容操作则通过专用 mutation API 写入，并同步关系索引。

Registry 的定义与 `PlayerState` 是不同的数据：玩家解锁、等级、资源和运行进度属于状态层；Registry 保存可供运行时解释的定义。定义在启动时从数据包装载，也可由运行时内容协调器对有限实体执行经过归属和引用检查的热 CRUD。

## 概念关系

```text
Datapack
  └─ Registry.load()
      ├─ validateDatapack()：数据包自身与已加载上下文的检查
      ├─ tableSteps：按表合并定义及索引
      └─ Runtime 完成全量加载后的跨表校验
          ├─ validateCharacterRefs()
          ├─ validateShopRefs()
          └─ validateTagRefs()

运行时内容编辑
  └─ Runtime Content Coordinator
      └─ Registry.apply*Mutation()
          ├─ 校验实体归属、候选定义和删除约束
          ├─ 更新主表与关系索引
          └─ 返回可回滚 receipt
```

`Registry.load()` 逐包处理。单包可引用当前包或此前已加载包中的部分定义；跨包前向引用能否成立取决于具体校验和完整加载后的校验阶段。不要把所有引用都假定为“在单包加载时完整验证”，具体覆盖差异见 [[docs/archive/docs-828-snapshot/03-data-structures/id-reference-semantics]]。

## 装载与合并

`Registry.load(datapack)` 先调用 `validateDatapack()`，设置当前包来源并检查 Tag ID 冲突，再记录已加载包并通过 `tableSteps` 逐表合并。`tableSteps` 同时驱动 `clear()`，让每张表的装载与清理动作保持在同一登记点。多数定义表按 ID 写入 `Map`，跨包同表同 ID 时后加载定义覆盖前值；Spot 覆盖还会先从关系索引移除旧定义再登记新定义。并非每张表都采用简单覆盖：例如 `extras` 深合并，部分配置有专门合并规则。

单包校验会检查重复 ID、实体 ID 形状、局部结构和部分引用。`RuntimeGameInstance.init()` 加载完所有包后，另外调用角色/色彩/培养引用、Spot/Shop 支付与功能引用、Tag parent/cycle 等跨表检查。Registry 的校验范围不等于所有业务引用都被覆盖，权威覆盖矩阵见 [[docs/archive/docs-828-snapshot/03-data-structures/id-reference-semantics]]。

包启用、来源获取和失败后的隔离/重载策略由 Runtime 与 Pack Manager 负责，不是 Registry 自己的回退机制。

## 查询表与关系索引

Registry 暴露按 ID 读取的 `ReadonlyMap`，并对关系查询维护索引：

| 查询 | 数据来源 | 用途 |
| --- | --- | --- |
| `areasOfInit(initId)` | `_areasByInit` | 取得 Init 下的 Area ID 顺序 |
| `spotsOfArea(areaId)` | `_spotsByArea` | 取得 Area 下的 Spot ID 顺序 |
| `spotsWithTag(tag, overrides?)` | `_spotsByTag` + 有效标签过滤 | 查询声明或状态覆盖后命中标签的 Spot |
| `effectiveSpotTags(spotId, overrides?)` | Spot 声明标签 + 可选覆盖 | 解析 Spot 当前有效标签 |
| `tagName(path)` / `tagDescription(path)` | TagDef 的最长前缀解析 | 为标签提供显示名和说明 |
| `initOwnerOf` / `areaOwnerOf` / `spotOwnerOf` | 来源 Mod 记录 | 热内容授权和来源展示 |

Spot 标签索引按层级前缀登记，因此父标签查询可命中子标签；`effectiveSpotTags` 会在查询时应用传入的运行时 override。Spot 状态变化如何写入 `PlayerState` 与发出事件，见 [[docs/archive/docs-828-snapshot/04-mechanisms/state-mutation]] 和 [[docs/archive/docs-828-snapshot/02-modules/state-mutation]]。

## 受控热 CRUD

`ReadonlyMap` getter 描述的是公开查询面，不代表 Registry 内部每一项永不变化。当前 `Registry` 为 Init、Area、Spot 提供局部 mutation 方法。入口由 `RuntimeContentCoordinator` 和 `RuntimeWorldContentCoordinator` 协调，不应由 UI 或任意业务逻辑直接改 Registry 私有表。

| 方法 | 支持操作 | 关键约束 |
| --- | --- | --- |
| `applySpotMutation()` | create / replace / delete / suspend / resume | 校验 ID 所属 Mod、定义与归属；同步 Area/Tag 索引；返回 revision 守护的回滚 receipt |
| `applyInitMutation()` | create / replace / delete | 校验 Init ID 与 Mod 归属；仍被 Area 引用时拒绝删除 |
| `applyAreaMutation()` | create / replace / delete | 校验归属；replace 不改变所属 Init；仍被 Spot、默认区域或邻接关系引用时拒绝删除 |

候选定义会在修改主表或关系索引前检查。Receipt 只允许在后续 Registry 状态仍匹配时回滚；Spot receipt 还检查 mutation revision，避免覆盖之后发生的变更。协调器负责将 Registry 变更与草稿/事务流程整合。机制边界以 `src/data-services/registry/registry.ts`、`registry-spot-mutation.ts`、`registry-world-mutation.ts` 及两个 coordinator 的当前实现为准。

这些 API 是有限的热内容管理能力，不是所有 Registry 表的通用编辑接口。角色、商店、卡池等其他定义没有因此获得同样的局部 CRUD 能力。

## 数据与责任边界

- Registry 保存定义与查询索引；玩家进度仍由 `PlayerState` 持有，状态变更遵守 `StateMutationService` 单一写入口。
- Registry getter 是只读类型接口；受支持的热写入经 Registry mutation API，不直接暴露私有 Map 写入口。
- 加载/引用失败由 `RegistryError` 表达；包隔离、重载、数据包启用策略由 Runtime / Pack Manager 负责。
- Registry 及基础数据服务不能反向依赖 UI 或产品内容层，架构边界见 [[docs/archive/docs-828-snapshot/05-conventions/architecture-discipline]]。
- Datapack 类型权威在 `src/data-services/contracts/` 与引擎类型；Schema 同步按 [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]] 执行。

## 代码与测试入口

| 路径                                                                | 阅读目的                              |
| ----------------------------------------------------------------- | --------------------------------- |
| `src/data-services/registry/registry.ts`                          | 表声明、加载/合并、关系索引、查询和 mutation 实现    |
| `src/data-services/registry/registry-validate.ts`                 | 单包与上下文校验规则                        |
| `src/data-services/registry/registry-spot-mutation.ts`            | Spot mutation 与 receipt 类型        |
| `src/data-services/registry/registry-world-mutation.ts`           | Init / Area mutation 与 receipt 类型 |
| `src/arona-clicker/runtime-game-instance.ts`                      | 加载全部数据包后的跨表校验调用                   |
| `src/arona-clicker/services/runtime-content-coordinator.ts`       | Spot 热内容协调                        |
| `src/arona-clicker/services/runtime-world-content-coordinator.ts` | Init / Area 热内容协调                 |
| `tests/engine/registry.test.ts`                                   | Registry 基础表、加载、查询与校验行为           |
| `tests/data/registry-spot-mutation.test.ts`                       | Spot mutation 与索引同步               |
| `tests/engine/runtime-world-hot-crud.test.ts`                     | Init / Area 热 CRUD 行为             |
| `tests/engine/runtime-content-coordinator.test.ts`                | 内容协调和事务边界                         |

## 相关路由

[[docs/archive/docs-828-snapshot/02-modules/registry]] · [[docs/archive/docs-828-snapshot/03-data-structures/registry]] · [[docs/archive/docs-828-snapshot/01-architecture/data-flow]] · [[docs/archive/docs-828-snapshot/03-data-structures/id-reference-semantics]] · [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]]
