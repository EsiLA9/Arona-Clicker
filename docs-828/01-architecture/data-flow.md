# 01-architecture/data-flow — 数据四层流动

> 本文回答：**一条数据从声明到 UI 呈现，经过哪些层、各层形态是什么。**
> 各层细节：Registry [[docs-828/03-data-structures/registry]]、PlayerState [[docs-828/03-data-structures/player-state]]、统计与视图 [[docs-828/03-data-structures/stats-views]]。

## 四层关系

```text
Datapack 声明（src/data/base/*.ts 或 JSON 导入）
    ↓ Registry 编译态（25+ 表 + 关系索引 + 引用校验，恒只读）
        ↓ PlayerState 运行时（三层：Global + per-Init 快照 + per-Init 当前）
            ↓ GameView 只读快照（UI 消费）
                                    ↑ StatsService 三层统计并行
```

## 层 1：Datapack 声明

- **默认加载的是 `src/data/base/`（TypeScript）**；`datapack/` 根目录是可选 JSON 导入（`src/data/zip-loader.ts` 解包）。
- `datapack.ts` 组合所有定义块导出默认数据包，注入 `GameInstance.init()`。
- 实体类型权威定义在 `src/engine/types/`；构建器在 `src/engine/def-factory/`。

## 层 2：Registry 编译态

- `Registry.build/merge`：**表驱动**（`tableSteps` 单一清单，T6）——新增一张表 = 私有字段 + getter + 1 条 step。
- 加载期引用校验（`registry-validate.ts` + `validateCharacterRefs`）：失败即抛错，保证运行时「拿到的引用必有效」（覆盖面见 [[docs-828/03-data-structures/id-reference-semantics]]）。
- **Registry 恒只读**：运行时变化全部落 `PlayerState`；Spot 标签运行时增减走 `state.spotTagOverrides` + `spotTagChanged` 事件（T6 迁移），查询用 `effectiveSpotTags(spotId, overrides)`。

## 层 3：PlayerState 运行时

- 三层结构见 [[docs-828/01-architecture/state-layers]]；唯一写入口 `StateMutationService`。
- 派生数据（产出树缓存 / 可见性快照 / tag 反向索引）不落 PlayerState，由各引擎持有并经事件定向失效。

## 层 4：GameView / UIContext

- `getView()` → `GameView`（资源快照 + spotLevels + unlockedInits + storyLog + visibility 等）。
- `createUIContext()` → `UIContext`（GameView + `UIFacingGame` 只读查询面 + nameOf/formatNumber 辅助）。
- UI 刷新：每帧 `refreshLight`（轻量数字）；揭示指纹变化 → `refreshRevealIfChanged` → 重建 DOM。

## 派生数据一览

| 派生物 | 持有者 | 失效方式 |
| --- | --- | --- |
| GameNum 产出树 | `GameNumSystem` | 事件定向失效（见 [[docs-828/04-algorithms/production]]） |
| 可见性快照 | `VisibilityEngine` | 事件驱动增量 + 读档 `refresh()` |
| tag 反向索引 | `TagStatService` | `tagCollectedChanged` / 读档重建 |
| Affector 实例 | `AffectorEngine`（不落存档） | `reconcileMounts()` 对账 + 事件驱动 |
| 运行时主题 | `RuntimeThemeManager`（不落状态） | 场景进出 / effect 请求事件 |
