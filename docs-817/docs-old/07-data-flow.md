# 数据流转

## 配置数据流

### 总览

```
[数据包 TS 模块] → [Registry] → [各系统按 ID 查询定义]
                        │
                   编译索引
                  byType / byMod
                  / areasByInit
                  / spotsByArea 等
```

### 数据包加载流程

```
datapack.ts（汇总所有实体数组）
       │
       ▼
GameRegistry.build(datapacks)
       │
       ├── 1. 按 priority 排序
       ├── 2. 合并内容（高优先级覆盖低优先级冲突字段）
       ├── 3. 构建索引（byType, byMod, queries 等）
       └── 4. 冻结就绪
              │
              ▼
       查询 API: getDef(type, id)
                  queryByType(type)
                  querySpotsByArea(areaId)
                  queryPassiveStoriesByArea(areaId)
                  ...
```

### 配置表清单

所有数据以 TypeScript 模块定义，编译后为 JS 对象，无独立配置文件。

| 配置来源 | 内容 | 加载时机 |
|----------|------|----------|
| `data/base/resources.ts` | 资源定义 | 游戏初始化 |
| `data/base/inits.ts` | Init 定义 | 游戏初始化 |
| `data/base/areas.ts` | Area 定义 | 游戏初始化 |
| `data/base/spots.ts` | Spot 定义 | 游戏初始化 |
| `data/base/enhancements.ts` | Enhancement 定义 | 游戏初始化 |
| `data/base/characters.ts` | 角色定义 | 游戏初始化 |
| `data/base/stories.ts` | Story + Talklet 定义 | 游戏初始化 |
| `data/base/items.ts` | Item 定义 | 游戏初始化 |
| `data/base/drop-tables.ts` | DropTable 定义 | 游戏初始化 |
| `data/base/affectors.ts` | AffectorPack/Entry 定义 | 游戏初始化 |

## 运行时数据流

### Tick 循环

```
外部定时器（~1000ms）
       │
       ▼
GameInstance.tick()
       │
       ├── 1. 查询所有持有的 Spot（from PlayerState.spotLevels）
       ├── 2. 对每个 Spot:
       │      ├── 查询定义（from Registry）
       │      ├── 计算基础产出 = initial + (level-1) × increment
       │      ├── 查询效果修饰符（from EffectEngine cache）
       │      ├── 应用修饰符得到最终产出
       │      └── 累加到 PlayerState.resources
       ├── 3. 应用资源上限（from EffectEngine）
       ├── 4. 更新 PlayerState.tickCount
       └── 5. 发布 EventBus.TickPassed [数据反射]
              │
              ├──→ AffectorEngine 检查限时效果到期
              └──→ （UI 不订阅；由 UI 定时轮询 getView() 刷新数字）
```

### 玩家操作数据流

```
玩家点击 UI 按钮
       │
       ▼
UILayer 调用 GameInstance API（如 purchaseSpot）
       │
       ▼
GameInstance.purchaseSpot(spotId):
       ├── 1. 查询 Spot 定义（from Registry）          [直接调用]
       ├── 2. 检查 Condition（from ConditionSystem）   [直接调用]
       ├── 3. 检查资源是否足够
       ├── 4. 扣除资源（FuncletExecutor.AddResource）  [直接调用]
       ├── 5. 更新 PlayerState.spotLevels[spotId] = 1
       ├── 6. 发布 EventBus.SpotPurchased             [数据反射]
       └── 7. 返回操作结果
              │
              ▼
        EventBus.SpotPurchased
              │
              ├──→ AffectorEngine 挂载包装并重检
              ├──→ EffectEngine 重新编译缓存
              ├──→ VisibilityEngine re-check（如有内容依赖此 Spot）
              └──→ （UI 不订阅）
              │
              ▼
        UILayer 收到返回结果 → 调 getView() 取快照刷新 Spot 列表  [UI 拉取]
```

### 剧情数据流

```
玩家点击剧情入口（ActiveStory 或 聊天 PassiveStory）
       │
       ▼
GameInstance.startActiveStory(entryId)
  或 GameInstance.triggerPassiveStory(areaId)
       │
       │  1. 查询 Story 定义（from Registry）
       │  2. 将 storyId + talkletIndex 写入当前上下文
       └──3. 返回第一个 Talklet 给 UI（不发布 UI 事件）
              │
              ▼
        UI 演出 Talklet（对话/旁白/选项）
              │
           玩家操作（点击继续/选择选项）
              │
              ▼
        GameInstance.advanceStory(choice?)
              │
              ├── 1. 查下一个 Talklet
              ├── 2. 检查 Condition（分支判断）
              ├── 3. 执行当前 Talklet 的 Action（Funclet）
              ├── 4. 更新 talkletIndex
              ├── 5. 如果是最后一个 Talklet:
              │      ├── 发放 completeReward
              │      ├── 执行 completeActions
              │      ├── 标记 Story 为已完成
              │      └── 发布 EventBus.StoryCompleted [数据反射，供 AffectorEngine 挂载 on_complete 包装]
              └── 6. 返回下一个 Talklet 给 UI（UI 直接渲染）
```

## 存档数据流

### 保存流程

```
触发保存时机:
  - 手动保存（玩家点击保存按钮）
  - 自动保存（每 30 秒 / 每次关键操作后）
  - 关闭页面前（beforeunload 事件）
       │
       ▼
SaveSystem.serialize(state, meta)
       │
       ├── 1. 收集 PlayerState 所有字段
       ├── 2. 写入 schema 版本号 + 时间戳
       ├── 3. JSON.stringify
       └── 4. 返回 JSON 字符串
              │
              ▼
SaveSystem.saveToSlot(slotName)
       │
       └── StorageBackend.setItem(`save_${slotName}`, json)
              │
              └── localStorage.setItem(...)
```

### 加载流程

```
启动游戏（或手动读档）
       │
       ▼
SaveSystem.loadFromSlot(slotName)
       │
       ├── 1. StorageBackend.getItem(`save_${slotName}`)
       ├── 2. JSON.parse
       ├── 3. 检查 schema 版本号
       ├── 4. 运行版本迁移（如有必要）
       └── 5. 返回 SaveData
              │
              ▼
GameInstance.loadFromSave(saveData)
       │
       ├── 1. 恢复 PlayerState
       ├── 2. 重建 runtime cache（Spot 产出、效果缓存）
       ├── 3. 进入存档中的 Init
       ├── 4. 发布 EventBus.SaveLoaded
       └── 5. 恢复完成
```

### 物品使用数据流

```
玩家在背包中选择物品 → 点击"使用"
       │
       ▼
GameInstance.useItem(itemId)
       │
       ├── 1. 查询 ItemDefinition（from Registry）
       ├── 2. 检查 category ≠ consumable → 返回 NotUsable
       ├── 3. 检查 useCondition（from ConditionSystem）
       ├── 4. 检查 state.inventory[itemId] >= 1 → 不足返回 NotOwned
       ├── 5. 执行 RemoveItem（扣除一个）
       ├── 6. 执行 useEffect（Funclet 列表，可能包含 RollDropTable）
       ├── 7. 发布 EventBus.ItemUsed
       └── 8. 返回 UseItemResult
```

### 掉落表数据流

```
触发位置（剧情奖励 / Funclet.RollDropTable / 条件触发）
       │
       ▼
FuncletExecutor 执行 RollDropTable
       │
       ▼
LootSystem.roll(tableId, state, registry)
       │
       ├── 1. 查询 DropTable 定义
       ├── 2. 检查 guaranteed 条目
       ├── 3. 按权重抽选 maxRolls 次
       ├── 4. 返回 LootResult
       │
       ▼
FuncletExecutor 对每个掉落物品执行 GiveItem
       │
       ├── 检查 maxStack → clamp
       ├── 更新 state.inventory
       ├── 检查 pickupEffect → 如有则执行
       └── 发布 ItemGiven（每个物品一次）[数据反射，供 AffectorEngine 挂载 on_acquire 包装]
              │
              ▼
        （UI 不订阅；掉落结果由 useItem/rollDropTable 返回值驱动背包界面刷新）
```

### 效果体数据流

```
实体生命周期事件（获得/升级/出售/剧情完成/Init 切换）
       │
       ▼
EventBus 发布（SpotPurchased / EnhancementUpgraded / ItemUsed / StoryCompleted / InitChanged ...）
       │
       ▼
AffectorEngine 收到事件
       │
       ├── mount()    : 创建 AffectorInstance（on_acquire 类型包装）
       ├── recheck()  : 重求值条目 condition，更新 Latent/Active
       └── unmount()  : 实体被移除/出售 → 移入 Removed，撤销影响
              │
              ▼
        派生输出（仅 Active 条目）
              │
              ├── effects 汇总 ──► EffectEngine ──► 数值聚合（资源/产出/上限）
              ├── rights 汇总 ──► OperationGate ──► GameInstance 操作前校验
              ├── visibility ──► VisibilityEngine ──► 可见度重检
              └── flowControls ──► FlowControlGate ──► 剧情/聊天/移动判定
```

### 存档内容

(参考 [[03-data-structures#存档数据]])

### 仅存档以下内容

- 当前 Init ID
- 当前 Area ID
- 所有资源持有量 + 历史累计量
- Spot 等级（仅已拥有的）
- Enhancement 等级（仅已拥有的）
- 已解锁角色
- 背包物品（inventory: Map<itemId, count>）
- 已解锁 Area 列表
- 玩家标记
- 已完成 Story 列表
- Tag 统计数据
- 总 tick 数
- 限时效果剩余时间
- 持久化 Affector 实例（仅 `persistent: true` 包装的 state 与 activatedAtTick）

### 不存档（运行时重建）

- 注册表索引（每次加载时从 TS 模块重建）
- Effect 编译缓存（加载存档后重建）
- Affector 实例派生缓存（加载后由 `AffectorEngine.recheckAll()` 重建；非 persistent 包装从实体状态反推挂载）
- UI 状态（由前端管理，不在引擎存档中）
