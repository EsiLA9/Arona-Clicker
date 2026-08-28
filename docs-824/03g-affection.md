# docs-824 — 03g 好感数值系统（数据设计）==规划==

> 状态：**规划文档（未实现）**。玩法需求：蔚蓝档案经典风格好感度——每级好感要求一个隐藏好感小值；1-100 级小值为设定值阶梯，超过 100 级暂时等值；角色初始好感 1 级；培养 5 星前默认最高好感 20 级。
> 数据落点承接 [[docs-824/03c-character-entities]]（RosterEntry / CharacterVariantDef），写入口纪律见 [[docs-824/04a-state-mutation-pipeline]]。

## 玩法需求（验收口径）

1. 每一级好感要求一个**隐藏好感小值**（内部累积值，不作为可见货币，UI 呈现为等级+进度）。
2. 1-100 级的小值为**设定的值阶梯**；超过 100 级暂时**等值**（每级固定需求）。
3. 角色初始好感为 **1 级**。
4. 培养 **5 星前默认最高好感 20 级**（星级锁）。

## 数据结构

### RosterEntry 扩展（`src/engine/types/character.ts`）

```ts
export interface RosterEntry {
  // ...现有字段
  /** 好感等级（初始 1）。@label 好感等级 @int */
  affectionLevel?: number;   // 可选兼容旧档，运行时 ??= 1
  /** 当前级内积累的好感小值。@label 好感小值 */
  affectionExp?: number;     // ??= 0
}
```

- 好感值**内嵌 RosterEntry**，随 `characterPersistConfig.roster`（默认 global）归属层自动进出存档与 per-Init 快照（`characterSnapshotFields` 已含 roster）——**无需改 init-savepoint / snapshot / state-factory 任何一处**。
- RosterEntry 为运行时对象，不进 datapack schema（无需 gen:schema）。

### AffectionConfigDef（Datapack 顶层新表）

```ts
export interface AffectionConfigDef {
  /**
   * 阶梯区升级需求：expCurve[i] = 从第 (i+1) 级升到第 (i+2) 级所需小值。
   * 数组长度 = 阶梯覆盖等级数（默认 100）。@label 好感小值阶梯 @int
   */
  expCurve: number[];
  /** 等值区需求：超过 expCurve 覆盖等级后，每级升级所需小值（等值）。@label 顶级后等值需求 @int */
  expBeyond: number;
  /** 等级硬上限（含等值区）。@label 等级上限 @int */
  maxLevel: number;
  /**
   * 星级锁默认表（索引 = 星级，0..starMax）：defaultLevelCapByStar[s] = s 星时好感等级上限。
   * 默认 [20,20,20,20,20,100]（严格按需求：5 星前一律 20 级，5 星解锁至阶梯顶）。@label 星级默认上限 @int
   */
  defaultLevelCapByStar: number[];
}
```

- `Datapack` 加 `affectionConfig?: AffectionConfigDef`；`Registry` 解析并给**引擎默认**（阶梯内置默认值，数据包可整体覆盖）。
- 需求中「100 级」= `expCurve.length`（默认 100），非硬编码；「超过 100 级等值」即进入 `expBeyond` 等值区，直至 `maxLevel`。
- `maxLevel` 默认取 `expCurve.length`（如需开放等值区可配更大值，等值区生效）。

### 星级锁 per-variant 覆盖（CharacterVariantDef 扩展）

```ts
/** 好感等级上限按星级覆盖（索引 = 星级，覆盖 defaultLevelCapByStar；
 *  可做渐进式如 [1,5,10,15,20,100]）。@label 星级好感上限 @int */
affectionLevelCapByStar?: number[];
```

## 推进规则

```text
有效上限 cap = min(星级锁(stars), maxLevel)
addAffectionExp(variantId, delta):
 ├─ 未拥有 / delta <= 0 → 拒绝（no-entry / invalid-amount，与 addExp 一致）
 ├─ affectionExp += delta
 ├─ while affectionExp >= 升级需求(等级) && 等级 < cap:
 │    ├─ affectionExp -= 需求; 等级 += 1
 └─ 达 cap 后小值截断（不保留溢出，解锁上限后重新积累）
```

- 需求查询：等级 ∈ 阶梯区取 `expCurve[等级-1]`；等值区取 `expBeyond`。
- **星级突破后只升不降**：当前等级高于新 cap 时保持不变，仅阻止继续积累。
- 突破成功由现有 `cultivated(kind:'star')` 事件驱动 UI 刷新（onAny 兜底）；如后续需精确失效再补 `affectionLevelCapChanged` 事件。

## 引擎接线点（文件 : 职责）

| 文件 | 职责 |
| --- | --- |
| `src/engine/types/character.ts` | RosterEntry.affectionLevel/affectionExp；AffectionConfigDef；CharacterVariantDef.affectionLevelCapByStar |
| `src/engine/types/datapack.ts` | `Datapack.affectionConfig?` 表挂载 |
| `src/engine/registry/registry.ts` | 解析 affectionConfig + 引擎默认值 + scope 无关（配置型，恒 global 语义） |
| `src/engine/system/state-mutation-service.ts` | `addAffectionExp`（写入口）；`acquireCharacter` 首次建 entry 时 affectionLevel=1 / affectionExp=0 |
| `src/engine/system/roster-system.ts` | 只读 `affectionLevelOf / affectionExpOf / affectionLevelCapOf`（含星级锁计算） |
| `src/engine/types/expression.ts` | `ConditionTarget` 加 `affectionLevel`（key=VariantId，缺失→0）；`EffectOp` 加 `addAffectionExp`（target=VariantId，value=数值/ValueExpression） |
| `src/engine/system/effect-ops.ts` | `addAffectionExp` 分发到 mutations |
| `src/engine/system/condition-system.ts` | `affectionLevel` 求值分支 |
| `src/engine/types/events.ts` | `affectionChanged { variantId, delta, newLevel, newExp }` |

## 默认阶梯示例（引擎内置，数据包可覆盖）

```text
expCurve[i] = 20 + 10*i   （第 1 级→2 级需 20，第 100 级→101 级需 1010）
expBeyond  = 1010         （与阶梯尾值一致）
maxLevel   = 100          （默认封顶；开放等值区时配更大）
defaultLevelCapByStar = [20,20,20,20,20,100]
```

## 边界规则汇总

- 未拥有角色 / 未知差分：拒绝（no-entry / throw，与 addExp 同风格）
- `delta <= 0`：拒绝
- 旧档（无 affectionLevel/affectionExp）：`??=` 兜底为 1 / 0，**不写迁移代码**（架构纪律 #7）
- affectionConfig 缺省：用引擎默认配置，不报错

## 测试清单（`tests/engine/affection-system.test.ts`）

- 阶梯边界：整级 / 跨级 / 越级一次到位；cap 截断
- 星级锁：5 星前锁 20；突破解锁；超 cap 不降级
- `save → load` 往返保留 affectionLevel/affectionExp
- 剧情 choice `addAffectionExp` 生效；`acquireCharacter` 初始化
- `affectionLevel` 条件解锁（聊天/羁绊/主题条件达标前后变化）

---
上一篇：[[docs-824/03f-declarative-dsl]]
