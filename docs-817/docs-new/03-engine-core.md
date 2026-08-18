# 03 — 核心引擎

## GameInstance

整个游戏的顶层编排器。负责创建所有子系统、初始化数据、启动/停止游戏循环。

### 生命周期

```
new GameInstance()
  → game.init(datapack)
    → Registry.load(dp)          // 校验+合并数据包
    → CharacterSystem.load()     // 加载角色
    → 初始化 PlayerState (空白)
    → EventBus 连接各系统
  → game.start()
    → TickSystem.start()         // 启动计时器
  → game.pause() / game.resume() // 暂停/恢复
  → game.load(saveData)          // 读档
  → game.save()                  // 存档
```

### 关键方法

| 方法 | 说明 |
|------|------|
| `init(datapack)` | 初始化数据包，重置所有状态 |
| `start()` | 启动游戏循环（TickSystem） |
| `pause()` / `resume()` | 暂停/恢复计时 |
| `save()` | 序列化完整游戏状态到 localStorage |
| `load(data)` | 从存档恢复游戏状态 |
| `startNewGame(initId)` | 以指定世界线开始新游戏 |
| `switchInit(initId)` | 切换世界线（软重启） |
| `getStateSnapshot()` | 获取当前状态的深拷贝 |

### 子系统创建顺序

1. `Registry` — 数据包存储（最基础）
2. `EventBus` — 事件系统
3. `StatsService` — 统计服务
4. `ValueSystem` — 表达式求值
5. `ConditionSystem` — 条件求值
6. `StateMutationService` — 状态原子写入
7. `EffectEngine` — 效果执行
8. `TickSystem` — 帧循环
9. `GameNumSystem` — 数值计算
10. `AffectorEngine` — 持续效果
11. `VisibilityEngine` — 可见性
12. `LootSystem` — 掉落
13. `TriggerSystem` — 触发器
14. `CharacterSystem` — 角色系统
15. `SpotFunctionalitySystem` — Spot 功能

## Registry

数据包的编译、校验与合并中心。所有游戏实体定义存储在此，提供只读访问和关系查询。

### 存储结构

```typescript
class Registry {
  private _inits: Map<string, InitDef>;
  private _areas: Map<string, AreaDef>;
  private _spots: Map<string, SpotDef>;
  private _enhancements: Map<string, EnhancementDef>;
  private _stories: Map<string, StoryDef>;
  private _items: Map<string, ItemDef>;
  private _dropTables: Map<string, DropTableDef>;
  private _funcletDefs: Map<string, FuncletDef>;
  private _characters: Map<Character, CharacterData>;
  private _characterBonuses: CharacterBonusTable[];

  // 关系索引
  private _areasByInit: Map<string, string[]>;     // Init → Area 列表
  private _spotsByArea: Map<string, string[]>;     // Area → Spot 列表
  private _spotsByTag: Map<string, Set<string>>;   // Tag 路径 → Spot 集合
}
```

### 查询方法

| 方法 | 说明 |
|------|------|
| `areasOfInit(initId)` | 获取 Init 下所有 Area ID |
| `spotsOfArea(areaId)` | 获取 Area 下所有 Spot ID |
| `spotsOfInit(initId)` | 获取 Init 下所有 Spot ID（递归） |
| `spotsWithTag(tag)` | 按标签（含前缀匹配）查询 Spot |

### 运行时标签操作

```typescript
addSpotTag(spotId, tag)    // 动态给 Spot 添加标签（更新索引）
removeSpotTag(spotId, tag) // 动态移除标签（更新索引）
```

### 校验规则

`load()` 时执行：
1. **ID 唯一性**: 同类型实体 ID 不可重复
2. **引用完整性**: Area 的 initId 必须在 inits 中存在；Spot 的 areaId 必须在 areas 中存在；Init 的 defaultAreas 和 Area 的 defaultSpots 必须存在

## EventBus

全局事件总线，基于观察者模式。所有引擎系统通过它解耦通信。

### 事件类型

| 事件 | 触发时机 | 携带数据 |
|------|---------|---------|
| `tick` | 每帧 | `frame` — 当前帧号 |
| `resourceChanged` | 资源变化 | `resource`, `delta`, `before`, `after` |
| `spotLevelChanged` | Spot 等级变化 | `spotId`, `from`, `to` |
| `spotProduced` | Spot 产出 | `spotId`, `resource`, `amount` |
| `itemCollected` | 获得物品 | `itemId`, `count` |
| `storyCompleted` | 完成剧情 | `storyId` |
| `initEntered` | 进入世界线 | `initId` |
| `areaEntered` | 进入区域 | `areaId` |

### 关键机制

- **排队分发**: 在事件处理器中 `emit()` 新事件不会立即派发，而是加入队列，等当前处理完成后再 `flush()`
- **通配注册**: `onAny(handler)` 监听所有事件类型
- **取消订阅**: `on()` 和 `onAny()` 都返回取消函数

## StateMutationService

游戏中**唯一的状态写入入口**。所有对 `PlayerState` 的修改都必须通过此服务，确保：
1. 写入原子性
2. 统计同步
3. 事件广播

### 方法

| 方法 | 行为 | 统计同步 | 事件 |
|------|------|---------|------|
| `addResource(id, delta)` | 增减资源（≥0 增加，<0 减少） | recordResourceChange | resourceChanged |
| `setSpotLevel(spotId, level)` | 设置 Spot 等级 | recordSpotLevel(解锁/升级) | spotLevelChanged |
| `addItem(itemId, count, playerState)` | 添加物品到背包 | recordItemChange(收集) | itemCollected |
| `removeItem(itemId, count, playerState)` | 从背包移除 | recordItemChange(使用) | itemCollected |
| `setManager(spotId, character)` | 分配/移除 Spot 管理员 | — | — |
| `unlockEnhancement(enhId, playerState)` | 解锁 Enhancement | recordEnhancementUnlocked | — |
| `completeStory(storyId, playerState)` | 标记故事完成 | recordStoryCompleted | storyCompleted |
| `unlockInit(initId, playerState)` | 解锁新世界线 | recordInitUnlocked | initEntered |
| `enterArea(areaId)` | 进入区域 | recordAreaEntered | areaEntered |
| `setFlag(key, value)` | 设置标记 | — | — |

### 资源增减的边界保护

`addResource` 不会让资源低于 0。
