# 基础表达式层：Value & Condition & Funclet

## 概念

Value（数值表达式）、Condition（条件表达式）和 Funclet（状态修改指令）是游戏引擎中最底层的求值单元。所有上层系统——Prerequisite、解锁条件、行为规则、故事分支——统一使用这同一套表达系统。

```
三层依赖关系：
  上层模块（Entity Definition / Gameplay）
       ┊ 使用
       ▼
  基础表达式层：Value 树 → Condition 树 → EvaluationContext → Funclet 执行
       ┊ 依赖
       ▼
  PlayerState + RuntimeCache（只读引用，不由本层定义）
```

---

## 一、Value — 统一数值系统

Value 是任何可求值为 `number` 的表达式树，支持递归嵌套。

### 1.1 类型定义

```
Value:
  # ── 字面量 ──
  | type: "const"
    value: number

  # ── 游戏状态引用 ──
  | type: "resource"                 # 资源当前持有量
    target: ResourceId

  | type: "resource_gained_total"    # 全存档累计获得量（跨 Init）
    target: ResourceId

  | type: "resource_gained_init"     # 当前 Init 内累计获得量
    target: ResourceId

  | type: "flag"                     # PlayerState.flags 中的数值
    key: string

  | type: "context_flag"             # StoryContext.accumulatedFlags 中的值
    key: string                      # 未激活/不存在 → 0
                                     # boolean → 0/1

  | type: "spot_level"               # SpotState.level（0 = 未拥有）
    target: SpotId

  | type: "enhancement_level"        # 0=未拥有，1=已拥有（Enhancement 无等级）
    target: EnhancementId

  | type: "tick"                     # 当前游戏刻 GameTick

  | type: "stat"                     # 玩家统计
    stat: "total_clicks" | "total_story_seen"

  | type: "tag_stat"                 # Tag 统计
    tag: string
    dimension: "collected" | "triggered"

  # ── 算术运算（不限嵌套深度）──
  | type: "op"
    op: ArithmeticOp
    args: Value[]

ArithmeticOp: "add" | "sub" | "mul" | "div" | "min" | "max"
```

### 1.2 求值伪码

```
function evaluateValue(v: Value, ctx: EvaluationContext): number {
  switch (v.type) {
    case "const":
      return v.value

    case "resource":
      return ctx.player.resources[v.target] ?? 0

    case "resource_gained_total":
      return ctx.player.resourceLog[v.target]?.totalGained ?? 0

    case "resource_gained_init":
      rl = ctx.player.resourceLog[v.target]
      return rl?.perInit[ctx.player.currentInit]?.gained ?? 0

    case "flag":
      val = ctx.player.flags[v.key]
      return typeof val === "number" ? val : 0

    case "context_flag":
      if ctx.contextFlags == null return 0         // 语境外求值
      val = ctx.contextFlags.get(v.key)
      if val == null return 0
      if typeof val === "boolean" return val ? 1 : 0
      if typeof val === "number"  return val
      return 0                                      // string → 0

    case "spot_level":
      return ctx.player.spots[v.target]?.level ?? 0

    case "enhancement_level":
      state = ctx.player.enhancements[v.target]
      return state?.unlocked ? 1 : 0

    case "tick":
      return ctx.runtime.currentTick

    case "stat":
      return evaluateStat(v.stat, ctx.player)

    case "tag_stat":
      return evaluateTagStat(v.tag, v.dimension, ctx.player)

    case "op":
      args = v.args.map(a => evaluateValue(a, ctx))
      return applyArithmeticOp(v.op, args)
  }
}

function evaluateStat(stat, player): number {
  switch (stat) {
    case "total_clicks":     return player.totalClicks
    case "total_story_seen": return player.totalStorySeen
  }
}

function evaluateTagStat(tag, dimension, player): number {
  ts = player.tagStats[tag]
  if (ts == null) return 0
  switch (dimension) {
    case "collected":  return ts.totalCollected
    case "triggered":  return ts.totalTriggered
  }
}

function applyArithmeticOp(op, args: number[]): number {
  switch (op) {
    case "add": return args.reduce((a, b) => a + b, 0)
    case "sub": return args.reduce((a, b) => a - b)    // args.length ≥ 2
    case "mul": return args.reduce((a, b) => a * b, 1)
    case "div": return args.reduce((a, b) => a / b)    // args.length ≥ 2
    case "min": return Math.min(...args)
    case "max": return Math.max(...args)
  }
}
```

### 1.3 边界规则

| Value 类型 | 引用不存在时 | 类型不匹配时 |
|---|---|---|
| `resource` | 返回 0 | — |
| `resource_gained_*` | 返回 0 | — |
| `flag` | 返回 0 | 非 number 返回 0 |
| `context_flag` | 返回 0 | boolean→0/1, string→0 |
| `spot_level` | 返回 0 | — |
| `enhancement_level` | 返回 0 | — |
| `op` | — | 除零返回 0（引擎不抛错） |
| `stat` / `tag_stat` | 返回 0 | — |

---

## 二、Condition — 统一条件系统

Condition 是任何可求值为 `boolean` 的表达式树。

### 2.1 类型定义

```
Condition:
  # ── 字面 ──
  | type: "always"
  | type: "never"

  # ── 逻辑组合 ──
  | type: "and"
    conditions: Condition[]

  | type: "or"
    conditions: Condition[]

  | type: "not"
    condition: Condition

  # ── 数值比较（核心：通过 Value 树完成所有数值判断）──
  | type: "cmp"
    op: CompareOp
    left: Value
    right: Value

  # ── 状态查询（原子条件）──
  | type: "has_enhancement"
    target: EnhancementId

  | type: "has_spot"
    target: SpotId
    minLevel?: Value               # 缺省 = 1（只要拥有就算）

  | type: "has_label"
    label: number                  # 仅在语境内有意义

  | type: "area_explored"
    target: AreaId

CompareOp: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
```

> **废弃条件（已从 foundation 层移除）：** `talk_collected`、`story_completed`
> 这些条件带有业务语义，不再由基础表达式层定义。若上层需要此类判断，应通过 `cmp + flag` 或自定义 Condition 扩展实现。

### 2.2 求值伪码

```
function evaluateCondition(c: Condition, ctx: EvaluationContext): boolean {
  switch (c.type) {
    case "always":
      return true

    case "never":
      return false

    case "and":
      return c.conditions.every(sub => evaluateCondition(sub, ctx))

    case "or":
      return c.conditions.some(sub => evaluateCondition(sub, ctx))

    case "not":
      return !evaluateCondition(c.condition, ctx)

    case "cmp":
      left = evaluateValue(c.left, ctx)
      right = evaluateValue(c.right, ctx)
      return compare(c.op, left, right)

    case "has_enhancement":
      return ctx.player.enhancements[c.target]?.unlocked === true

    case "has_spot":
      minLvl = c.minLevel ? evaluateValue(c.minLevel, ctx) : 1
      return (ctx.player.spots[c.target]?.level ?? 0) >= minLvl

    case "has_label":
      return ctx.labels?.has(c.label) === true    // 语境外 → false

    case "area_explored":
      return ctx.player.areaStates[c.target]?.explorationProgress > 0
  }
}

function compare(op: CompareOp, left: number, right: number): boolean {
  switch (op) {
    case "eq":  return left === right
    case "ne":  return left !== right
    case "gt":  return left > right
    case "gte": return left >= right
    case "lt":  return left < right
    case "lte": return left <= right
  }
}
```

### 2.3 短路规则

```
and:    conditions 从左到右求值，遇到 false 立即返回 false（不继续求右侧）
or:     conditions 从左到右求值，遇到 true  立即返回 true（不继续求右侧）
cmp:    总是两侧都求值（Value 树无副作用，短路无意义）
```

### 2.4 语境依赖条件

| Condition | 依赖 ctx.contextFlags | 依赖 ctx.labels | 语境外求值 |
|---|---|---|---|
| `has_label` | 否 | 是 | 返回 `false` |
| `cmp`（内含 `context_flag` Value） | 取决于 Value 类型 | 否 | `context_flag` 返回 0 |
| 其他所有类型 | 否 | 否 | 正常求值 |

---

## 三、EvaluationContext — 求值上下文

Value 和 Condition 求值时所需的全部上下文数据，由引擎在调用点组装传入。

### 3.1 接口定义

```
EvaluationContext:
  player: PlayerState              # 只读
  runtime: RuntimeCache            # 只读
  contextFlags?: Map<string, any>  # 当前语境的 ContextFlag（语境外为 undefined）
  labels?: Set<number>             # 当前语境的累积标号（语境外为 undefined）
```

> **注意：** `contextFlags` 和 `labels` 同时存在或同时 undefined。
> 不应该出现一个有值另一个无值的情况（由 Story 引擎保证）。

### 3.2 使用示例

```
// 在语境结束时（ContextBehavior.onContextEnd）：
ctx = {
  player: playerState,
  runtime: runtimeCache,
  contextFlags: storyContext.accumulatedFlags,
  labels: new Set(storyContext.accumulatedLabels),
}
conditionMet = evaluateCondition(someBranch.condition, ctx)

// 在 Init 入口检查（entryRequirements）：
ctx = {
  player: playerState,
  runtime: runtimeCache,
  // contextFlags 和 labels 不传
}
canEnter = evaluateCondition(initDef.entryRequirements, ctx)
```

---

## 四、Funclet / FuncList — 统一状态修改

FuncList 是多个 Funclet 的数组，顺序执行，用于直接修改 PlayerState。

### 4.1 Funclet 扩展契约

Funclet 系统的设计原则：

```
原则 1：Funclet 是枚举的（非开放协议）
         所有 Funclet 类型在编译时确定，不支持运行时注入新类型。
         扩展方式：在枚举中新增 type → 在 executeFunclet 中新增 case。

原则 2：每个 Funclet 只做一件事
         一个 Funclet 修改一个状态维度。需要多个修改时使用 FuncList。

原则 3：Funclet 不返回结果
         成功静默完成，失败静默跳过（不抛错、不阻断后续 Funclet 执行）。
```

### 4.2 内置 Funclet 类型

```
Funclet:
  # ── 资源操作 ──
  | type: "add_resource"
    target: ResourceId         # 资源的 FullKey
    value: Value               # 可正可负

  # ── 玩家 Flag ──
  | type: "set_player_flag"
    key: string
    value: Value               # 求值后写入 player.flags[key]

  # ── 实体给予 ──
  | type: "give_spot"
    target: SpotId
    level?: Value              # 缺省 = 1（给予即拥有）

  | type: "give_enhancement"
    target: EnhancementId
    level?: Value              # Enhancement 无等级，缺省 = 1（已解锁）

  # ── 语境操作 ──
  | type: "set_context_flag"   # 仅在语境激活时有意义
    key: string
    value: number | string | boolean   # 注意：不是 Value 树，是字面量

  # ── 旅行 ──
  | type: "travel_to_area"
    target: AreaId

  # ── 故事 ──
  | type: "play_story"
    storyId: string
    label?: number

  # ── 扩展点 ──
  | type: "custom"
    data: any

FuncList: Funclet[]
```

### 4.3 执行伪码

```
function executeFuncList(funcs: FuncList, ctx: ExecutionContext): void {
  for (const f of funcs) {
    executeFunclet(f, ctx)
  }
}

function executeFunclet(f: Funclet, ctx: ExecutionContext): void {
  switch (f.type) {
    case "add_resource":
      amount = evaluateValue(f.value, ctx.evalCtx)
      ctx.player.resources[f.target] =
        (ctx.player.resources[f.target] ?? 0) + amount
      // 不在这里发布事件（事件由引擎在 FuncList 执行完毕后统一触发）
      return

    case "set_player_flag":
      ctx.player.flags[f.key] = evaluateValue(f.value, ctx.evalCtx)
      return

    case "give_spot":
      lvl = f.level ? evaluateValue(f.level, ctx.evalCtx) : 1
      spotState = ctx.player.spots[f.target]
      if (spotState) {
        spotState.level = Math.max(spotState.level, lvl)
      } else {
        ctx.player.spots[f.target] = { level: lvl, lastProductionTick: ctx.runtime.currentTick }
      }
      return

    case "give_enhancement":
      state = ctx.player.enhancements[f.target]
      if (state) {
        state.unlocked = true
      } else {
        ctx.player.enhancements[f.target] = { unlocked: true, active: true }
      }
      return

    case "set_context_flag":
      if (ctx.storyContext == null) return    // 语境外静默跳过
      ctx.storyContext.accumulatedFlags.set(f.key, f.value)
      return

    case "travel_to_area":
      ctx.player.currentArea = f.target
      // 路径合法性由调用方（Area 引擎）校验，Funclet 不负责
      return

    case "play_story":
      // 由调用方在 FuncList 执行完毕后启动故事引擎
      // Funclet 本身只记录"需要播放什么故事"
      ctx.pendingStory = f.storyId
      return

    case "custom":
      // 由注册的自定义处理器处理
      // 若无注册处理器 → 静默跳过
      return
  }
}
```

### 4.4 ExecutionContext（Funclet 执行上下文）

Funclet 执行时不仅有 EvaluationContext，还需要额外的运行时访问权限：

```
ExecutionContext:
  evalCtx: EvaluationContext      # 传给 Value 求值的上下文
  player: PlayerState             # 可变引用
  runtime: RuntimeCache           # 可变引用（供 give_spot 更新 lastProductionTick）
  storyContext?: StoryContext     # 当前故事语境（play_story 时设置 pendingStory）
  pendingStory?: string           # play_story 的输出：待播放的故事 ID
```

> **设计说明：** `ExecutionKeyContext` 与 `EvaluationContext` 分离，
> 因为求值（只读）和执行（写状态）的安全边界不同。
> Funclet 执行时先使用 `evalCtx` 求值 Value 参数，再写入 `player` / `runtime`。

### 4.5 扩展方式

数据包作者如需自定义 Funclet，步骤如下：

```
1. 在 Funclet 联合类型中新增一个 type（如 "unlock_recipe"）
2. 在 executeFunclet 中新增对应的 case 分支
3. 若需要触发事件，在引擎层的 FuncList 执行后处理（Funclet 自身不发布事件）
```

---

## 五、求值策略集成

不同调用方对求值时机有不同的需求，统一在基础层约定契约：

| 调用方 | 调用时机 | EvaluationContext 可用字段 |
|---|---|---|
| Prerequisite / 购买校验 | UI 显示时被动检测，操作前二次验证 | player + runtime |
| 可见性 Condition-Trigger | 事件触发时即时求值 | player + runtime |
| ContextBehavior.onContextEnd | 语境结束时一次性求值 | player + runtime + contextFlags + labels |
| Story logic_judgment/choice | Talklet 演出时即时求值 | player + runtime + contextFlags + labels |
| Init entryRequirements | 选择 Init 时 | player + runtime |

---

## 对应关系：文档 → 代码

| 本文档章节 | 对应类型文件 |
|---|---|
| §1 Value | `Value` 类型 + `evaluateValue()` |
| §2 Condition | `Condition` 类型 + `evaluateCondition()` |
| §3 EvaluationContext | `EvaluationContext` 接口 |
| §4 Funclet | `Funclet` / `FuncList` 类型 + `executeFunclet()` |
| §4.4 ExecutionContext | `ExecutionContext` 接口 |

> 详见 `src/01-foundation/types.ts`
