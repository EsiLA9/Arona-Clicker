# Extra 额外数据体系（类 NBT 树形数据）

> **状态说明**：本文件为 Extra 系统的**原始策划源文档**，是后续代码实施的蓝图。覆盖三层（数据包常量表 / Def 附加字段 / 运行时持久化）与 DSL 联动（Value / Condition / Effect）。本文档描述**目标设计**，尚未全部落地为代码；落地进度见文末「实施状态」。

## 1. 设计动机

游戏内的实体定义（Def）、运行时状态与数据包本身，都有「存一些额外数据」的需求：

| 场景                 | 举例                                              | 现状                             |
| ------------------ | ----------------------------------------------- | ------------------------------ |
| Spot 想挂自定义进度元数据    | `boss-spot` 记录 `curPhase`、`phaseStartedAt`      | 只能塞进 `flags`（扁平 string）        |
| Item 想带结构化属性       | 武器 item 带 `{ dmg: int, elems: ['fire','ice'] }` | 无位置可放                          |
| 数据包作者想写跨 Def 共享的常量 | `globals: { softCap: 1000 }` 供多个 Value 引用       | 无数据包级配置表                       |
| 剧情分支想读运行时的用户选择     | `extra('story/choice/3')` 判断选项                  | `flags` 无法表达嵌套，DSL 读不到         |
| 跨语言存档 / 数据包校验      | 未来导出 JSON、写校验器                                  | `Record<string,string>` 丢失类型信息 |

NBT 的核心价值是：**命名树形标量** —— 一种类型严格、可嵌套、可路径寻址、可校验的通用数据格式。本项目需要同一能力，但 NBT 原生名词 **Tag** 已被 `tag.ts` 的 TagPath（层级标签系统）占用，故整套体系采用 **Extra 家族** 命名。

## 2. 命名决策

### 2.1 命名红线（不可用词汇）

| 词汇             | 占用者                         | 说明                                            |
| -------------- | --------------------------- | --------------------------------------------- |
| `tag`          | `src/engine/tag.ts`         | TagPath 三段式层级标签，语义已定                          |
| `value`        | `Value` / `ValueExpression` | 动态数值表达式系统                                     |
| `component`    | UI `components` 目录          | 目录名冲突                                         |
| `attachment`   | `enhancementAttachments`    | 增强挂载语义已定                                      |
| `nbt` / `data` | —                           | `data` 太宽泛，且 `source: 'data'` 在 DSL 内层用；对外名不用 |

### 2.2 最终命名

| 命名 | 位置 | 说明 |
|------|------|------|
| `ExtraValue` | 类型 | 树形节点的顶层联合类型（6 种变体） |
| `ExtraCompound` | 类型 | `{ t: 'dict'; v: Record<string, ExtraValue> }` 别名，语义 = NBT Compound |
| `extra` | Def 字段 | 单个 Def 的附加数据（`InitDef.extra`、`SpotDef.extra` …） |
| `extras` | 运行时 / 数据包 | `PlayerState.extras`（全局层）、`InitSnapshot.extras`（per-Init 层）、`Datapack.extras`（常量表） |
| `ExtraPath` | 类型 | 路径字符串，`a/b/c` 风格（见 §4） |
| `extra()` / `getExtra()` | 运行时 API | 读路径；`setExtra()` 写路径 |

> 命名基调：**「附加数据」**。Def 时是「可选的附加字段」，运行时是「持久化的附加数据」，数据包是「附加的常量表」。

## 3. 数据格式定义（NBT 严格型）

### 3.1 类型（贴合项目 discriminated union 风格）

```ts
/** 树形节点。六种变体，t 为判别字段。 */
export type ExtraValue =
  | { t: 'int'; v: number }        // 整数（NBT Int）
  | { t: 'float'; v: number }      // 浮点（NBT Float）
  | { t: 'str'; v: string }        // 字符串（NBT String）
  | { t: 'bool'; v: boolean }      // 布尔
  | { t: 'list'; v: ExtraValue[] } // 列表（NBT List，同构，元素可为任意变体）
  | { t: 'dict'; v: Record<string, ExtraValue> }; // 复合（NBT Compound）

/** Compound 便捷别名（dict 变体）。Def 的 extra 字段建议用此类型。 */
export type ExtraCompound = { t: 'dict'; v: Record<string, ExtraValue> };

/** 路径：/ 分隔的字符串，如 'meta/rank'、'inv/0/name'。 */
export type ExtraPath = string;
```

### 3.2 便捷构造器（供数据包 TS 写起来不啰嗦）

数据包是 TS 文件而非 JSON，构造器可显著降低书写成本：

```ts
export const extra = {
  int: (v: number): ExtraValue => ({ t: 'int', v }),
  float: (v: number): ExtraValue => ({ t: 'float', v }),
  str: (v: string): ExtraValue => ({ t: 'str', v }),
  bool: (v: boolean): ExtraValue => ({ t: 'bool', v }),
  list: (...items: ExtraValue[]): ExtraValue => ({ t: 'list', v: items }),
  dict: (v: Record<string, ExtraValue>): ExtraCompound => ({ t: 'dict', v }),
  /** 从纯 TS 字面量（string/number/boolean/数组/对象）宽松转换。 */
  fromJson: (raw: unknown): ExtraValue => { /* 递归转换，见 §5.3 */ },
};
```

数据包示例：

```ts
export const myDatapack: Datapack = {
  id: 'mod:main',
  extras: {
    'globals/softCap': extra.int(1000),           // 顶层即路径，扁平的树
    'globals/balance': extra.dict({
      base: extra.float(1.2),
      cap: extra.int(50),
    }),
    'item/weapon/elems': extra.list(extra.str('fire'), extra.str('ice')),
  },
  // ... Defs
  items: [
    {
      id: 'mod:item:ember_blade',
      // ...
      extra: extra.dict({
        dmg: extra.int(12),
        element: extra.str('fire'),
        tags: extra.list(extra.str('blade'), extra.str('craftable')),
      }),
    },
  ],
};
```

### 3.3 边界规则（严格型的关键约束）

| 规则              | 说明                                                                              |
| --------------- | ------------------------------------------------------------------------------- |
| int 取整          | `fromJson` / 构造器接受 number；显式 `extra.int(3.7)` 允许（向下取整或抛错由「严格模式开关」决定，见 §5.3）     |
| dict key 禁含 `/` | 避免与路径语法歧义（§4），校验器拒绝                                                             |
| list 允许混合类型     | NBT List 严格同构，本设计放宽为异构，换取 JSON 直转能力；校验器提供 `strictList` 可选开关                     |
| 空 dict / 空 list | 合法                                                                              |
| 深度限制            | 递归解析/求值时限制深度（默认 32），防畸形数据打爆栈                                                    |
| 缺失即默认           | 读路径遇 `undefined` 返回类型默认值（int/float → 0，str → ''，bool → false，list/dict → 空），不抛错 |

## 4. 路径约定

- 语法：`/` 分隔的 UTF-8 字符串段。
- 示例：`meta/rank`、`stats/dmg/base`、`inv/0/name`、`choice/3`。
- **list 索引用数字段**：`inv/0` 读第 0 项。
- **顶层扁平键 = 单段路径**：`globals/softCap` 实际是 dict 树 `{ globals: { softCap: int } }`。数据包 extras 的「扁平写法」在加载时按 `/` 展开成树（§5.1）。
- 与现有系统的关系：
  - `TagPath`（tag.ts）用数组 + 三段式 `base:tag:parent/child`，是**标签语义**，与 Extra 路径互不替代；
  - `Value.params` 用扁平字符串键，Extra 路径是其超集（可嵌套）。
- **空段 / 首尾 `/` / `//` 视为非法**，校验器拒绝。

## 5. 三层落位

### 5.1 数据包层：`Datapack.extras`（常量表）

```ts
interface Datapack {
  id: string;
  // ...
  /** 数据包级额外数据常量表：扁平键 + 树形值，加载时展开。 */
  extras?: Record<string, ExtraValue>;
}
```

- 语义：**跨 Def 共享的全局配置常量**。加载进 `Registry._extras: Map<string, ExtraValue>`。
- 合并策略：与数据包其余内容一致 —— **后加载覆盖前**（`Map.set` 语义），同 key 整体替换（不做深合并）。
- 只读暴露：`registry.extras`（getter，返回只读视图）。
- 顶层扁平键在 `merge` 时展开：`'a/b' -> { a: { b: ... } }`；同名冲突时后加载包的键覆盖先加载包（即使先加载者是 `a/b` 展开，后加载者是完整 dict `a`，也整体覆盖）。

### 5.2 Def 层：`Def.extra`（附加字段）

「大部分 Def」统一增加可选字段。按优先级列举本次覆盖范围：

| Def                  | 接口                                           | 优先级 |
| -------------------- | -------------------------------------------- | --- |
| InitDef              | `InitDef.extra?: ExtraCompound`              | 必须  |
| SpotDef              | `SpotDef.extra?: ExtraCompound`              | 必须  |
| ItemDef              | `ItemDef.extra?: ExtraCompound`              | 必须  |
| BaseStoryDef         | `BaseStoryDef.extra?: ExtraCompound`         | 必须  |
| EnhancementDef       | `EnhancementDef.extra?: ExtraCompound`       | 必须  |
| AreaDef              | `AreaDef.extra?: ExtraCompound`              | 必须  |
| FuncletDef           | `FuncletDef.extra?: ExtraCompound`           | 建议  |
| CharacterData        | `CharacterData.extra?: ExtraCompound`        | 建议  |
| SpotFunctionalityDef | `SpotFunctionalityDef.extra?: ExtraCompound` | 建议  |
| DropTableDef         | `DropTableDef.extra?: ExtraCompound`         | 建议  |
| AffectorPackDef      | `AffectorPackDef.extra?: ExtraCompound`      | 建议  |
| TriggerDef           | `TriggerDef.extra?: ExtraCompound`           | 建议  |

- 语义：实体/内容的**默认元数据**。Def 时数据是静态的，不随存档。
- 消费方式：
  1. 新游戏/新实体初始化时，Def.extra 作为默认值注入对应运行时位置（§5.3）；
  2. 纯展示层（nameOf / tooltip / 结算）可直接读 Def.extra。

### 5.3 运行时层：`PlayerState.extras` 与 `InitSnapshot.extras`

```ts
interface PlayerState {
  // ... 现有字段
  /** 全局层额外数据（跨 Init 保留，入存档）。 */
  extras?: Record<string, ExtraValue>;
  // ...
}

interface InitSnapshot {
  // ... 现有字段
  /** per-Init 层额外数据（随快照，软重启/恢复时同步）。 */
  extras?: Record<string, ExtraValue>;
}
```

- **分层与可见性**（对齐现有 resources / globalResources 双层模式）：

| 层               | 存储                    | 生命周期       | 覆盖优先级     |
| --------------- | --------------------- | ---------- | --------- |
| 数据包常量表          | `Registry._extras`    | 静态，随数据包    | 最低（默认值底座） |
| per-Init extras | `InitSnapshot.extras` | 随 Init 快照  | 中间        |
| 全局 extras       | `PlayerState.extras`  | 跨 Init，入存档 | 最高        |

- **读取语义**：`getExtra(path)` 按 **全局 → per-Init → 数据包常量表** 的优先级查（全局命中即返回，不向下查）。这复刻了 `getResourceAmount` 的「局部优先覆盖同名」模式。
- **写入语义**：`setExtra(path, value)` 只写**全局 extras**（运行时动态数据天然是全局的）；若想写 per-Init 层，走显式 `setPerInitExtra()`（低频）。
- **初始化注入**：`startNewGame(initId)` 时：
  1. 从数据包 `registry.extras` 克隆一份到全局 extras 作为底座（仅首次进入某 Init 时；软重启恢复快照时不重建）；
  2. 当前 Init 的 `InitDef.extra` 展开合并到 per-Init extras。
- **入快照 / 恢复 / 软重启 / 硬重启**：`savePerInitSnapshot` 保存 `extras`，`restorePerInitFromSnapshot` 恢复；软重启清 per-Init 字段但保留全局 extras；硬重启（hardRestartInit）删除该 Init 快照并**重建** extras（数据包底座 + Def.extra 重新注入）。
- **`fromJson` 转换规则**：

| JSON 值 | ExtraValue |
|---------|------------|
| number（整数） | `{ t: 'int' }` |
| number（带小数） | `{ t: 'float' }` |
| string | `{ t: 'str' }` |
| boolean | `{ t: 'bool' }` |
| 数组 | `{ t: 'list' }` |
| 纯对象 | `{ t: 'dict' }` |

## 6. DSL 联动

### 6.1 Value：新增 `source: 'data'`

```ts
type ValueSource =
  | 'const' | 'res' | 'spotLevel' | 'spotCount' | 'managerCount' | 'funclet'
  | 'data';  // 新增：从额外数据取数值

// 用法：ValueExpression 增加
{ source: 'data', params: { path: 'meta/rank', def?: 'myInit' | 'mySpot' } }
```

- 求值：`evaluateValue()` 新增 `case 'data'`。
  - 默认读运行时 `state.extras`（经三层合并视图，§5.3）；
  - `params.def` 可选：显式指定从某个 Def 的 `extra` 读（如 `spotLevel` 需要实体级数据时，`def` 指明 Spot 的 ID 或来源类型）。第一版**只实现运行时路径**，`params.def` 留作扩展位。
  - int / float → number；bool → 0/1；str / list / dict / 缺失 → 0。
- 示例：`{ source: 'data', params: { path: 'globals/softCap' } }`。

### 6.2 Condition：新增 target `'extra'`

```ts
type ConditionTarget =
  | 'resource' | 'spotLevel' | 'manager' | 'flag' | 'hasEnh' | 'hasTag'
  | 'countTags' | 'stat' | 'hasReadStory' | 'hasReadStoryInRun'
  | 'extra';  // 新增

// 用法
{ target: 'extra', key: 'story/choice/3', value: 1 }
```

- 求值：`getActualValue()` 新增 `case 'extra'`。
- 语义（对齐 `flag` target 的「值比较」风格）：

| `cond.key` 指向的节点 | 返回的比较值 |
|----------------------|--------------|
| int / float | 数值本身 |
| bool | 1 / 0 |
| str | 缺失或任意非数字 → 0（与 flag 语义一致：str 不参与数值比较） |
| list / dict / 缺失 | 0 |

- 示例：`{ target: 'extra', key: 'meta/rank', value: 3 }`、`{ target: 'extra', key: 'globals/hardMode', value: 1 }`。

### 6.3 Effect：新增 op（写入通道，使数据包作者可写逻辑）

```ts
// EffectOp 扩展（第一版建议实现，写操作有明确 scope 边界）
{ op: 'setExtra', path: 'story/choice/3', value: ExtraValue | 数值/字符串/布尔字面量 }
{ op: 'addExtra', path: 'meta/kills', amount: 1 }  // 仅对 int/float 有效，缺失按 0
```

- 执行位置：EffectEngine / FuncletExecutor 统一入口。
- **scope 边界**：`setExtra` / `addExtra` 只写全局 extras；不允许写数据包常量表与 Def.extra（只读底座）。这样保证「数据包 = 声明，运行时 = 状态」的分层不破。

### 6.4 Funclet 参数透传

- funclet 内部目前用 flags 传参（`params` 字符串化）。extras 第一版**不接入 funclet 参数**，保持 funclet 轻量；需要时后续以 `extra/…` 前缀参数约定扩展。

## 7. 数据流总览

```
┌─────────────────────┐   merge() 时展开扁平键
│  Datapack.extras    │──────────▶ Registry._extras (Map<string, ExtraValue>)
│  （常量表，静态）       │            只读 getter: registry.extras
└─────────────────────┘
            │  startNewGame / hardRestartInit 时作为底座克隆
            ▼
┌─────────────────────────────────────────────┐
│  InitDef.extra  ──►  per-Init extras        │
│                     (InitSnapshot.extras)    │
│  PlayerState.extras（全局，运行时写入）          │
│                      ▲                        │
└──────────────────────┼──────────────────────┘
                       │ 读取三层合并视图
        ┌──────────────┴───────────────┐
        ▼                              ▼
  ValueSystem 'data'            ConditionSystem 'extra'
  (source:'data')               (target:'extra')
        │                              │
        └──────────┬───────────────────┘
                   ▼
         EffectEngine: setExtra / addExtra（写全局层）
```

## 8. 校验规则（Registry.validate）

| 校验项 | 规则 | 违反时 |
|--------|------|--------|
| 顶层 key 非空 | 数据包 extras 与 Def.extra 的 dict key 不得为空串 | 收集错误 |
| key 禁含 `/` | dict key 不得含路径分隔符（歧义防护） | 收集错误 |
| 树形递归校验 | 6 种变体字段齐全、`list` 的 v 是数组、`dict` 的 v 是对象 | 收集错误 |
| 深度限制 | 嵌套深度 ≤ 32 | 收集错误 |
| int 合法性 | `int` 变体的 v 必须是整数（构造器保证，校验器兜底） | 收集错误 |
| 数据包展开冲突 | 扁平键展开时不得与同包既有树冲突（`a/b` 与 `a` 并存） | 数据包级错误 |

- `merge()` / `clear()` 同步维护 `_extras` 与校验缓存。
- 旧档 load 时对 `state.extras` 做**宽松容忍**（缺失字段补默认，不拒绝加载），保证旧档兼容。

## 9. 兼容性与迁移

- `PlayerState.extras`、`InitSnapshot.extras`、各 Def 的 `extra`、`Datapack.extras` **全部可选**，旧数据包 / 旧档零改动可加载。
- `load()` 中新增：`this._state.extras ??= {}`；对 per-Init 快照的 extras 缺失同样补空。
- 存储序列化：extras 是纯 JSON 结构（无 Date / Map / 循环引用），可直接 `JSON.stringify`，入存档无成本。
- 深度克隆：`JSON.parse(JSON.stringify(...))` 即可安全复制（与现有 `_state` 克隆方式一致）。

## 10. 接入点清单（实施蓝图）

| 文件 | 改动 |
|------|------|
| `src/engine/types.ts` | 新增 `ExtraValue` / `ExtraCompound` / `ExtraPath`；`ValueSource` 加 `'data'`；`ConditionTarget` 加 `'extra'`；`PlayerState.extras`、`InitSnapshot.extras`；各 Def 加 `extra?`；`Datapack.extras`；EffectOp 扩展 |
| `src/engine/extra.ts`（新文件） | 构造器 `extra`、`fromJson`、路径解析 `parsePath` / `getAtPath` / `setAtPath` / `mergeExtra`、深度限制常量、校验函数 |
| `src/engine/registry.ts` | `_extras: Map<string, ExtraValue>`、只读 getter、merge 时展开 + 校验、validate() 新增 extras 校验 |
| `src/engine/value-system.ts` | `evaluateValue` 新增 `case 'data'` |
| `src/engine/condition-system.ts` | `getActualValue` 新增 `case 'extra'` |
| `src/engine/effect-engine.ts` / `funclet-executor.ts` | 新增 `setExtra` / `addExtra` op 执行 |
| `src/engine/game-instance.ts` | `startNewGame` 注入底座 + Def.extra；`savePerInitSnapshot` / `restorePerInitFromSnapshot` / 软重启 / `hardRestartInit` 同步 extras；`getExtra` / `setExtra` / `mergeExtra` 公开 API；`load()` 旧档迁移 |
| 测试 | 新增 `extra.test.ts`（格式/路径/合并/校验）+ `value-system.test.ts` / `condition-system.test.ts` / `game-instance.test.ts` / `registry.test.ts` 补充用例 |

## 11. 测试计划

| 测试                | 覆盖点                                            |
| ----------------- | ---------------------------------------------- |
| extra 格式          | 6 变体构造、fromJson 全映射、深度限制                       |
| 路径                | 解析合法/非法、getAtPath 各层、setAtPath 建中间节点、list 索引读写 |
| 合并                | 数据包展开扁平键、后加载覆盖、三层合并视图优先级                       |
| 校验                | key 非法 / 深度超限 / int 非法 / 展开冲突                  |
| Value 'data'      | 数值/缺失/bool/str 求值、三层优先级                        |
| Condition 'extra' | 与 flag 语义对齐（存在性 + 数值比较）                        |
| Effect op         | setExtra / addExtra 写全局层、scope 防护（不能写常量表）      |
| 存档                | 快照往返、软/硬重启、旧档缺字段补默认                            |

基线要求：现有 22 文件 / 203 测试全绿，`npx tsc --noEmit` 0 错误。

## 12. 里程碑拆分

- **M1（格式底座）**：`extra.ts` + `types.ts` 类型 + 构造器 + 路径工具 + 单测。
- **M2（静态层）**：数据包 extras 常量表 + registry 校验 + Def.extra 字段 + 数据包示例。
- **M3（运行时层）**：`state.extras` / per-Init extras + game-instance 生命周期（初始化/快照/重启）+ 存档兼容。
- **M4（DSL 联动）**：Value `'data'` + Condition `'extra'` + Effect `setExtra`/`addExtra` + 全部测试。

## 13. 开放问题（实施时拍板）

1. `params.def`（Value 从指定 Def.extra 取值）是否在 M4 一并实现，还是仅留类型扩展位？
2. 数据包扁平键展开 vs 直接写嵌套 dict：是否支持两种混用（建议支持，校验器保证不冲突）。
3. per-Init 层写入 API `setPerInitExtra()` 是否第一版就暴露，还是仅引擎内部使用？
4. `strictList`（list 同构校验开关）默认开还是关？
