# 三层架构：数据包 → 注册表 → 实例

这是游戏最核心的架构决策。三个概念必须严格分层：

```
┌─────────────────────────────────────────────────┐
│  ① Datapack Layer（数据包层）                     │
│  编辑者构建的原始定义文件（JSON/YAML）              │
│  可包含占位符、相对路径、未验证的引用               │
│  一个游戏可以加载多个 Datapack                     │
└──────────────┬──────────────────────────────────┘
               │ 加载 → 校验 → 编译 → 合并
               ▼
┌─────────────────────────────────────────────────┐
│  ② Registry Layer（注册表层）                     │
│  运行时不可变的内存数据库                          │
│  所有引用已解析为直接指针/Map查找                  │
│  跨所有存档实例共享（同一进程内）                   │
└──────────────┬──────────────────────────────────┘
               │ 查询定义（按ID、按条件等）
               ▼
┌─────────────────────────────────────────────────┐
│  ③ Instance Layer（实例层）                       │
│  单存档的玩家可变状态                             │
│  不存储任何定义数据，只存 ID + state              │
│  一个 Registry 可对应 N 个 Instance              │
└─────────────────────────────────────────────────┘
```

## 13.1 数据包层（Datapack Layer）

数据包是编辑者产出的原始文件集合。

```
DatapackSource:
  - id: string
  - name: string
  - version: string
  - description: string
  - dependencies?: string[]
  - priority: number
  - contents: {
      resources: RawResource[]
      inits: RawInit[]
      areas: RawArea[]
      spots: RawSpot[]
      enhancements: RawEnhancement[]
      effects: RawEffect[]
      stories: RawStory[]
      activeStoryEntries: RawActiveStoryEntry[]
      passiveStoryEntries: RawPassiveStoryEntry[]
      chat: RawChatConfig?
    }
```

**数据包层特点：**
- 元素在数据包内只写 `idName`，加载时由引擎自动补全为 `ModName/TypeName/idName`
- 跨数据包引用需写完整三级 Key
- 所有元素引用（如 Area → Spot）统一使用完整三级 Key
- 支持覆盖/补丁机制（高 priority 覆盖低 priority 的同ID条目）
- 不参与运行时逻辑，纯定义

## 13.2 注册表层（Registry Layer）

加载数据包后，经过校验和编译，生成注册表。

```
GameRegistry:
  # 主索引：FullKey → Definition（单层展平）
  - all: Map<string, Definition>

  # 辅助索引
  - byMod: Map<string, string[]>           # ModName → FullKey[]
  - byType: Map<string, string[]>          # TypeName → FullKey[]
  - byModAndType: Map<string, string[]>    # "ModName/TypeName" → FullKey[]

  # 业务索引
  - areasByInit: Map<string, string[]>
  - spotsByArea: Map<string, string[]>
  - storiesByArea: Map<string, { active: string[], passive: string[] }>
  - enhancementsByCategory: Map<string, string[]>
  - tagsByType: Map<string, Map<string, string[]>>   # → [Tag](../02-entity-definition/tag.md)

  # 元数据
  - loadedDatapacks: DatapackMeta[]
  - loadTimestamp: number
  - version: string
```

**加载流程（Datapack → Registry）：**

```
1. 收集所有 DatapackSource（按 priority 排序）
2. 校验阶段：
   - 检查所有 ID 唯一性（同 priority 段内不允许重复）
   - 检查 dependency 是否满足
3. 合并阶段：
   - 按 priority 顺序逐层合并（同ID则高priority覆盖低）
4. 引用解析阶段：
   - 解析所有跨表引用
   - 悬空引用 → 报错/警告
5. 编译阶段（可选）：
   - 预计算 Effect 链，构建依赖图
   - 为推荐算法预计算索引
6. 输出 GameRegistry（不可变，线程安全）
```

## 13.3 实例层（Instance Layer）

每个存档一个实例，是游戏运行时的可变状态。

```
GameInstance:
  - registry: GameRegistry          # 引用注册表（只读）
  - player: PlayerState             # → [Player](../02-entity-definition/player.md)
  - context: GameContext
  - runtime: RuntimeCache

GameContext:
  - currentInit: string             # Init FullKey
  - currentArea: string             # Area FullKey
  - tick: GameTick
  - clickCount: number

RuntimeCache:
  - spotProductionCache: SpotProductionCache  # 当前所有Spot的实时产出率
  - chatRewardCache: number                   # 当前聊天点击的实时收益
  - activeEffects: EffectInstance[]
  - passiveStoryEntryCache: {
      lastTriggeredIds: string[]
      lastTriggeredTimes: Map<string, GameTick>
    }
  - currentStoryContext?: StoryContext
```

**实例层特点：**
- 通过 `registry.all.get(key)` 等方式获取定义数据
- 从不直接修改定义数据
- 只存档 `PlayerState`（不含 Registry 和 RuntimeCache），后者可在加载后重建
- 存档时序列化 PlayerState，读档时反序列化并挂接到当前 Registry

## 13.4 查询路径示例

```
玩家点击聊天按钮：
  → Instance 层:
      context.tick++
      runtime.chatRewardCache 读取或重新计算
  → 计算收益:
      1. 查询 registry.xxx 获取 chatConfig
      2. 遍历 registry.xxx 中 target=chat_reward 的 Effect
      3. 叠加到 runtime.chatRewardCache
  → 抽取 PassiveStoryEntry:
      1. 查询 registry.storiesByArea[context.currentArea].passive
      2. 对每个候选 FullKey，读取 registry.xxx
      3. 检查 player.storyInstances[key] 的状态和冷却
      4. 运行推荐算法
  → StoryEngine.execute(storyId, storyInstance):
      1. registry.xxx[storyId].talklets → 依次演出
      2. 标号检查 → accumulation
  → 结果写入 player.resources + player.storyInstances

Spot 自动产出（每tick）：
  → 遍历 registry.spotsByArea 中当前 Init 的所有 Area
  → 对每个 Spot FullKey，读取 registry.xxx[key] 的定义
  → 读取 player.spots[key] 中对应 Spot 的 state
  → 计算产出（定义 × 等级 × Effect修正）
  → 写入 player.resources
```

注：registry.xxx 指 registry 中对应的类型化 Map（inits / areas / spots / stories 等）。

## 13.5 三层关系总结

| 维度 | Datapack | Registry | Instance |
|---|---|---|---|
| 生命周期 | 文件系统 | 进程级别 | 存档级别 |
| 可变性 | 可编辑（外部） | 不可变（运行时） | 频繁变更 |
| 存储内容 | 原始定义+公式 | 已编译定义+索引 | 玩家状态+运行时缓存 |
| 存储格式 | JSON/YAML | 内存 Map | 序列化字符串 |
| 数量关系 | M 个 Datapack → | 1 个 Registry → | N 个 Instance |
| 修改者 | 数据包编辑者 | 加载系统 | 玩家操作 |

## 参见

- [寻址系统](index.md) — 三级 Key 规范
- [Player](player.md) — 实例层核心

  - [Engine](engine.md) — GameInstance 的使用者