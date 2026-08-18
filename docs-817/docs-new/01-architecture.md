# 01 — 模块架构

## 项目概览

AronaClicker 是一款 Blue Archive 同人放置经营 + 故事探索游戏。玩家在不同的"世界线"（Init）中建设设施（Spot），产出资资源（信用点），解锁剧情（Story）和增强（Enhancement），逐步推进进度。

## 分层结构

```
┌─────────────────────────────────────────────────┐
│  UI Layer (src/ui/)                             │
│  controller.ts · GameView · components/         │
├─────────────────────────────────────────────────┤
│  Engine Layer (src/engine/)                      │
│  GameInstance · Registry · EventBus              │
│  TickSystem · ValueSystem · ConditionSystem      │
│  VisibilityEngine · TriggerSystem · LootSystem   │
│  StatsService · CharacterSystem · AffectorEngine │
├─────────────────────────────────────────────────┤
│  Data Layer (src/data/)                          │
│  base/*.ts — inits, areas, spots, items, etc.   │
├─────────────────────────────────────────────────┤
│  Persistence (src/save/)                         │
│  storage.ts — localStorage save/load            │
└─────────────────────────────────────────────────┘
```

## 启动流程

1. `src/main.ts` 创建 `GameInstance`，调用 `game.init()` 加载数据包
2. `src/ui/main.ts` 创建 `UIController`，挂载到 DOM
3. `UIController.mount()` 检查存档：无存档展示 Init 选择器，有存档直接加载并调用 `game.start()`
4. `game.start()` 启动 TickSystem 定时器（默认 1 秒一帧）
5. UIController 启动 1 秒刷新定时器，周期性更新界面数值

## GameInstance 构造

```typescript
class GameInstance {
  registry: Registry;                    // 数据包注册表（只读）
  state: PlayerState;                    // 运行时可变状态
  eventBus: EventBus;                    // 事件总线
  stats: StatsService;                   // 三层统计
  valueSystem: ValueSystem;             // 表达式求值
  conditionSystem: ConditionSystem;     // 条件求值
  effectEngine: EffectEngine;           // 效果执行
  mutation: StateMutationService;       // 状态原子写入
  gameNum: GameNumSystem;               // 数值计算
  tickSystem: TickSystem;               // 帧推进
  affector: AffectorEngine;             // 持续效果
  visibility: VisibilityEngine;         // 可见性
  loot: LootSystem;                     // 掉落
  triggers: TriggerSystem;              // 触发器
  characters: CharacterSystem;          // 角色
  spotFunc: SpotFunctionalitySystem;    // Spot 功能
}
```

## 模块依赖图

```
                      GameInstance
                           │
            ┌──────────────┼──────────────┐
            │              │              │
         Registry      PlayerState     EventBus
            │              │              │
            │         ┌────┴────┐    ┌───┴────┐
            │    ConditionSystem  │  TriggerSystem
            │         │           │
            │    VisibilityEngine │
            │         │           │
            └──── ValueSystem    EffectEngine
                      │              │
                 GameNumSystem  StateMutationService
                      │              │
                 AffectorEngine    StatsService
                      │
               LootSystem
```

## 数据包加载

数据包为 TypeScript 常量文件（`src/data/base/*.ts`），通过 `datapack.ts` 聚合为 `Datapack` 对象。加载时：

1. `Registry.load(datapack)` 先执行校验（ID 唯一性 + 引用完整性），再合并到内存 Map
2. 所有引擎系统通过 `Registry` 的只读访问器读取数据包内容

## 关键技术决策

- **无框架**: UI 层全部使用原生 DOM 操作 + innerHTML 渲染，无 React/Vue
- **无数据库**: 全部数据在内存中，持久化到 localStorage
- **时钟驱动**: 1 秒 = 1 帧，所有生产、冷却、计时都以帧为单位
- **表达式内联**: 计算公式以 JSON 结构内联在数据定义中，运行时由 ValueSystem 求值
