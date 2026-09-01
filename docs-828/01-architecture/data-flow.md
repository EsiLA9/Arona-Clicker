# 01-architecture/data-flow — 数据四层流动

> 本文回答：**一条数据从声明到 UI 呈现，经过哪些层、各层形态是什么。**
> 各层细节：Registry [[docs-828/03-data-structures/registry]]、PlayerState [[docs-828/03-data-structures/player-state]]、统计与视图 [[docs-828/03-data-structures/stats-views]]。

## 四层关系

```text
Datapack 声明（测试/示例包或 JSON/文件夹/ZIP 导入）
    ↓ Registry 编译态（25+ 表 + 关系索引 + 引用校验，恒只读）
        ↓ PlayerState 运行时（三层：Global + per-Init 快照 + per-Init 当前）
            ↓ GameView 只读快照（UI 消费）
                                    ↑ StatsService 三层统计并行
```

## 层 1：Datapack 声明

- `src/data/base/` 是测试/示例 Datapack；应用入口或测试夹具显式选择并注入 Datapack。
- `datapack/` 可通过基础数据服务从 JSON、文件夹或 ZIP 导入，不由基础引擎主动加载。
- Datapack 由数据服务解析、合并并校验后注入 Runtime；引擎只消费已注入的数据包。
- 引擎机制契约与 AronaClicker 实体类型逐步分层；构建器按契约归属拆分。

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
