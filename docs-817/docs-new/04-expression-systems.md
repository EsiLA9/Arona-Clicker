# 04 — 表达式与条件系统

## ValueSystem — 表达式求值

将 Expr JSON 结构求值为具体数值。

### 支持的表达式类型

```typescript
type Expr =
  | { type: 'const', value: number }                      // 常量
  | { type: 'var', key: string, field?: string }           // 变量
  | { type: 'add'|'sub'|'mul'|'div', args: Expr[] }       // 四则运算
  | { type: 'max'|'min', args: Expr[] }                    // 极值
```

### 变量来源 (field)

| field | 来源 | 示例 key |
|-------|------|---------|
| (默认) | 玩家资源 | `base:resource:credit` → `state.resources['base:resource:credit']` |
| `level` | Spot 等级 | `base:spot:schale_desk` → `state.spotLevels['base:spot:schale_desk']` |
| `flag` | 标记转换 | `mykey` → `Number(state.flags['mykey'])` |

### 核心方法

```typescript
class ValueSystem {
  evaluate(expr: Expr, state: PlayerState): number;
  evaluateOr(expr: Expr | undefined, state: PlayerState, fallback: number): number;
}
```

如果变量来源不存在（资源 ID 不存在、Spot 未解锁等），返回 0。

## ConditionSystem — 条件求值

将 ConditionGroup 求值为 boolean。条件支持多层嵌套的组合逻辑。

### 条件原子 (ConditionAtom)

```typescript
type ConditionAtom = {
  target: 'resource' | 'spotLevel' | 'flag' | 'stat' | 'item';
  key: string;           // 目标 ID
  comparator: '>=' | '>' | '<=' | '<' | '==' | '!=';
  value: number;         // 比较值
}
```

| target | key 含义 |
|--------|---------|
| `resource` | 资源 ID，查询 `state.resources[key]` |
| `spotLevel` | Spot ID，查询 `state.spotLevels[key]` |
| `flag` | 标记名，查询 `Number(state.flags[key])` |
| `stat` | StatDSL 字符串，查询 `StatsService.evaluate(key)` |
| `item` | 物品 ID，查询 `state.inventory[key]` |

### 组合逻辑

```typescript
type ConditionGroup = { type: 'and' | 'or', conditions: ConditionAtom[] };

// 便捷构造
and(...atoms)   // → { type: 'and', conditions: atoms }
or(...atoms)    // → { type: 'or', conditions: atoms }
```

`and` 所有条件满足为真；`or` 任一条件满足为真。

### 核心方法

```typescript
class ConditionSystem {
  evaluateGroup(group: ConditionGroup, state: PlayerState): boolean;
  evaluateAtom(atom: ConditionAtom, state: PlayerState): boolean;
}
```

## StatDSL — 统计查询语言

供 `ConditionAtom.target: 'stat'` 使用，以受限函数调用形式查询统计值。

### 语法

```
$FunctionName 参数1 参数2 ...
```

### 已注册函数

| 函数 | 作用域 | 参数 | 说明 |
|------|--------|------|------|
| `$GlobalProducedAmount` | global | resourceId | 全局产出量 |
| `$CurrentRunProducedAmount` | currentRun | resourceId | 本次游玩产出量 |
| `$InitProducedAmount` | init | initId resourceId | 某 Init 产出量 |
| `$GlobalConsumedAmount` | global | resourceId | 全局消耗量 |
| `$CurrentRunConsumedAmount` | currentRun | resourceId | 本次消耗量 |
| `$InitConsumedAmount` | init | initId resourceId | 某 Init 消耗量 |
| `$GlobalCollectedAmount` | global | itemId | 全局收集物品数 |
| `$CurrentRunCollectedAmount` | currentRun | itemId | 本次收集数 |
| `$InitCollectedAmount` | init | initId itemId | 某 Init 收集数 |
| `$GlobalUsedAmount` | global | itemId | 全局使用数 |
| `$GlobalUnlockedSpots` | global | — | 解锁 Spot 数 |
| `$CurrentRunUnlockedSpots` | currentRun | — | 本次解锁数 |
| `$GlobalUpgradedSpots` | global | — | 升级 Spot 数 |
| `$GlobalUnlockedEnhancements` | global | — | 解锁 Enhancement 数 |
| `$GlobalCompletedStories` | global | — | 完成故事数 |
| `$GlobalUnlockedInits` | global | — | 解锁 Init 数 |
| `$GlobalFramesActive` | global | — | 活跃帧数 |
| `$CurrentRunFramesActive` | currentRun | — | 本次活跃帧数 |
| `$InitFramesInInit` | init | initId | 在 Init 停留帧数 |

### 实现细节

- `parseStatCall(dsl)` 解析函数调用串 → `StatQuery { fn, def, initId?, key? }`
- `StatsService.evaluate(dsl)` 调用 `parseStatCall` → `selectCounters` → 取对应 metric
- 新增函数只需在 `STAT_FNS` 注册表添加条目，无需修改解析器

### FuncletDef — 函子定义

数据包层面的可复用逻辑片段。由 `funcletDefs` 定义，其他系统通过 ID 引用。

```typescript
interface FuncletDef {
  id: FuncletId;
  name: string;
  effects: GameEffect[];
  condition?: ConditionGroup;
}
```
