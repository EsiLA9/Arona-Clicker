# AronaClickerPM — 抽象逻辑设计文档

## 六层架构

```
依赖方向：上层依赖下层（编号小为底层）
                    ┌─────────────────────────────────────────────┐
 层 06-persistence  │  持久化与应用层                              │
                    │  Save/Load, Init切换/继承, 休眠机制, UI绑定   │
                    ├─────────────────────────────────────────────┤
 层 05-gameplay     │  游戏行为层                                  │
                    │  StoryEngine语境管理, ContextBehavior评估器,   │
                    │  聊天状态机/推荐算法, Spot购买/Area旅行/Init进出 │
                    ├─────────────────────────────────────────────┤
 层 04-engine-core  │  引擎核心层                                  │
                    │  EventBus, Tick循环, 效果引擎, 可见性引擎,     │
                    │  产出计算器                                   │
                    ├─────────────────────────────────────────────┤
 层 03-registry     │  注册与管理层                                │
                    │  Datapack格式/加载/校验/合并/编译/索引,        │
                    │  GameRegistry, 三层架构                       │
                    ├─────────────────────────────────────────────┤
 层 02-definition   │  实体定义层                                  │
                    │  所有Definition + State + PlayerState,        │
                    │  嵌入层01的Condition/Value作为字段              │
                    ├─────────────────────────────────────────────┤
 层 01-foundation   │  基础表达式层                                │
                    │  Branded IDs, Enums, Value树+求值器,         │
                    │  Condition树+求值器, EvaluationContext,       │
                    │  Funclet/FuncList                            │
                    └─────────────────────────────────────────────┘
```

## 文档结构

```
docs/
  index.md                                          ← 目录 + 寻址系统
  01-foundation/
    value-condition.md                              Value & Condition（统一数值与条件系统）
  02-entity-definition/
    init.md                                         Init（世界线/起始点）
    area.md                                         Area（区域）
    spot.md                                         Spot（产出设备/地标）
    enhancement.md                                  Enhancement（升级/强化）
    effect.md                                       Effect（效果系统）
    visibility.md                                   Visibility（统一可见性系统）
    resource.md                                     ResourceSystem（资源系统）
    story.md                                        Story（故事载体）
    story-entry.md                                  ActiveStoryEntry & PassiveStoryEntry（故事入口）
    chat.md                                         ChatSystem（聊天系统）
    player.md                                       PlayerState（玩家状态）
    tag.md                                          Tag 标签系统
  03-registry/
    three-layer.md                                  三层架构：数据包 → 注册表 → 实例
    data-flow.md                                    数据流全景
  04-engine-core/
    engine.md                                       GameEngine（游戏引擎核心）
    event-bus.md                                    EventBus 事件系统
  05-gameplay/                                      （待补充：语境生命周期、推荐算法、聊天状态机等行为规范）
  06-persistence/
    save-construction.md                            Save Construction（存档构建机制）
```

## 寻址系统：三级 Key

游戏中所有可寻址元素使用 **ModName / TypeName / idName** 三级 Key 标识。

格式:  `ModName/TypeName/idName`
示例:  `arona/area/forest`  `extraContent/enhancement/big_click`

### TypeName 固定枚举

| TypeName | 说明 |
|---|---|
| `init` | 世界线/起始点 |
| `area` | 区域 |
| `resource` | 资源类型 |
| `spot` | 产出设备/地标 |
| `enhancement` | 升级/强化 |
| `effect` | 效果 |
| `story` | 纯故事演出序列 |
| `activeStoryEntry` | 手动进入的主线/支线故事入口 |
| `passiveStoryEntry` | 随机抽取触发的故事入口 |

### Registry 索引结构

```
主索引:  Map<FullKey, Definition>              # 单层展平
辅助索引:
  byMod:  Map<ModName, FullKey[]>              # 按数据包分组
  byType: Map<TypeName, FullKey[]>             # 按类型分组
  byModAndType: Map<ModName+TypeName, FullKey[]>
```
