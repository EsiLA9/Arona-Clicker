# GameNum 树结构设计（未来版）

> 基于 `todoTask/taskGameNum/TASK.md` Phase 0 完成后的需求分析。
> 对应会话：用户对 Affector 未来需求的描述。

---

## 1. 核心原则

### 1.1 每资源一棵树

所有修饰都是「对某个 Resource」的，每类 Resource 有一棵独立的 `primitiveGain:<res>` 树。

### 1.2 四级层次

```
Global → Init → Area → Spot
```

上层聚合下层，每层三类操作（Affector 对满足条件的实体施加）：

| 操作 | 语义 | 在树中的位置 |
| --- | --- | --- |
| **加 base**（外源/内源增长） | 修改该层固有产出，**会被乘区缩放** | 进该层的 base 链 |
| **加 addition**（额外产出 `num/t`） | 纯加项，**不进乘区** | 该层的 flat 节点 |
| **乘区**（提升 `x%`） | 作用于**下一级 base 之和** | 该层的 zone·mul 节点 |

### 1.3 关键语义：乘区乘「base 和」，不是乘完整值

- Area 乘区乘「该 Area 下各 Spot 的 **base 和**」
- Init 乘区乘「各 Area 的 **base 和**」
- Global 乘区乘「Σ initFull」（完整值——全局通常是总倍率）

因此树必须把 **base 链** 与 **flat/flows 链** 分开：
- base 链进乘区，沿层级缩放
- flat/flows 不进乘区，直接 add 到总产出

### 1.4 Spot 是终端

Spot 持有以下终端产出：

| 字段 | 数据来源 | 树节点 |
| --- | --- | --- |
| `gainResource(id, primitiveValue)` | SpotDef 声明 | `baseYield`（expr 节点） |
| `gainResourceLeveled(id, primitiveValue)` | SpotDef 声明 | `levelLinear`（levelLinear 节点） |
| Affector 对 base 的加值 | Affector 引擎 | `baseAdd`（add 节点，子项为 expr/const） |
| Affector flows | Affector 引擎 | `spotFlows`（affectorFlows 节点） |
| Affector 额外产出 | Affector 引擎 | `spotFlat`（add 节点，子项为 flat 记录） |

---

## 2. 树结构（每资源一棵）

```
primitiveGain:<res> (add)                    ← 资源总产出
│
├── globalProduct (mul)                      ← = Σ initFull × globalMulZone
│   ├── initSum (add)                        ← Σ initFull
│   └── globalMulZone (zone·mul)             ← 全局乘区（childMulMap）
│
├── globalFlat (add)                         ← 全局额外产出
└── globalFlows (affectorFlows)              ← 全局 Affector flows


└── init:<initId> (add)                      ← initFull
    │
    ├── initProduct (mul)                    ← = initBase × initMulZone
    │   ├── initBase (add)                   ← Σ areaBase（共享 areaBase 节点）
    │   └── initMulZone (zone·mul)           ← Init 乘区（乘 Area base 和）
    │
    ├── initFlat (add)                       ← Init 额外产出
    └── initFlows (affectorFlows)            ← Init 级 Affector flows


    └── area:<areaId> (add)                  ← areaFull
        │
        ├── areaProduct (mul)                ← = areaBase × areaMulZone
        │   ├── areaBase (add)               ← Σ spotBase + areaOwn + enhGains
        │   │   │
        │   │   ├── spotBase (共享，DAG)     ← 各 Spot 的纯 base（见下）
        │   │   ├── areaOwn (add)            ← Area 自身 gainResource（甚少用）
        │   │   └── enhGains (add)           ← Enhancement 直接 gainResource
        │   │
        │   └── areaMulZone (zone·mul)       ← Area 乘区（乘 Spot base 和）
        │
        ├── areaFlat (add)                   ← Area 额外产出
        └── areaFlows (affectorFlows)        ← Area 级 Affector flows


        └── spot:<spotId> (add)              ← spotFull
            │
            ├── spotProduct (mul)            ← = spotBase × spotMulZone
            │   ├── spotBase (add)           ← baseYield + levelLinear + baseAdd
            │   │   ├── baseYield (expr)         ← Spot 声明 base（gainResource 的 primitiveValue）
            │   │   ├── levelLinear (levelLinear) ← 每级 base（gainResourceLeveled）
            │   │   └── baseAdd (add)            ← Affector 对 base 的加值（外源/内源）
            │   │       └── baseMod (expr/const)  ← 每条加值记录
            │   │
            │   └── spotMulZone (zone·mul)   ← Spot 乘区（childMulMap：defaultMul/custom/bound）
            │
            ├── spotFlat (add)               ← Spot 额外产出
            └── spotFlows (affectorFlows)    ← Spot 自身 Affector flows
```

### DAG 共享

- `spotBase` 节点同时被 `spotProduct`（spot 自己的乘区）和上级 `areaBase` 节点引用。
- GameNum 已是多父 DAG（`parents` 表支持），只需在 build 时把同一节点加入两个父节点的 children 列表。

### 数学形式

```
spotFull  = spotBase × spotMulZone + spotFlat + spotFlows
areaBase  = Σ spotBase + areaOwn + enhGains
areaFull  = areaBase × areaMulZone + areaFlat + areaFlows
initBase  = Σ areaBase
initFull  = initBase × initMulZone + initFlat + initFlows
total     = Σ initFull × globalMulZone + globalFlat + globalFlows
```

---

## 3. 操作落地映射

| 需求 | 操作 | 树落地 |
| --- | --- | --- |
| Spot 级 | 额外产出 `{num}/t` | `spotFlat` 加 flat 记录 |
| | 产出 `{Resource} {num}/t` | `baseYield` = num |
| | 提升基础产出 `{num}/t` | `baseAdd` 加值（进 base→被各层乘区缩放） |
| | 每级提升基础产出 `{num}/t` | `levelLinear`（gainResourceLeveled） |
| | 提升基础产出 `{a}%` | `spotMulZone` 加 mul 记录 |
| | 满足 `{tag/condition}` 的 Spot ... | 记录带 tag/条件，经 zoneIndex 路由 |
| Area 级 | 额外产出 `{num}/t` | `areaFlat` |
| | 提升 Spot 产出 `{a}%` | `areaMulZone` 加 mul |
| | 给 Area 自身加 base | `areaOwn` |
| Init 级 | 额外产出 `{num}/t` | `initFlat` |
| | 提升 Area 产出 `{a}%` | `initMulZone` 加 mul |
| Global | 全局乘区 | `globalMulZone` 加 mul |
| | 全局额外产出 | `globalFlat` |
| Enhancement | 直接 gainResource | `enhGains` 节点 |

---

## 4. Affector 引擎存储说明

### 现状

- `AffectorPackDef.entry.flows: {resource, value}[]` 是声明数据（定义在数据包中）
- Affector 实例携带：`instanceId + packId + mountEntityId + activeEntryIds`

### 延续设计

- **flows 仍然是声明数据，不进实例**：实例只携带 `mountEntityId` 决定挂载层级。
- **`mountEntityId` 决定 flows 进入哪个层级节点**：
  - 挂 Spot → `spotFlows`
  - 挂 Area → `areaFlows`
  - 挂 Init → `initFlows`
  - 挂 Global → `globalFlows`
- **`gainResource` / `gainResourceLeveled` 不属于 Affector**：它们是 `SpotDef` 的终端字段，进 `baseYield` / `levelLinear`。
- **Affector 对 base 的加值**：走 `baseAdd` 通道，每条加值一条记录，以 `source` 为键支持撤销。
- **若需反查「挂的 spot 属于哪个 area/init」**：由 Affector 引擎挂载时经 registry 解析一次，缓存在实例上或求值时现场反查。

---

## 5. 与当前树的差异

| 维度 | 当前树 | 新树 |
| --- | --- | --- |
| Area/Init | 隐式 hierarchy 组（塞在 spotMul 的 childMulMap 中） | 显式独立 `area:<areaId>` / `init:<initId>` 节点 |
| base 与 addition | 混在一起（`baseLine` = baseYield + levelLinear + flatZone） | 分离：`spotBase`（进乘区链）vs `spotFlat`（不进乘区） |
| base 加值 | 无独立通道 | 新增 `baseAdd` 节点 |
| Area 自身产出 | 无 | 新增 `areaOwn` 节点 |
| Enhancement 聚合 | 无 | 新增 `enhGains` 节点 |
| 乘区语义 | 同组 `1+Σ(f-1)`（加法）vs 兜底 `Πf`（连乘）冲突 | 沿用 zone·mul 的 childMulMap 机制，但需先定语义（Phase 1 决策点） |
| `getSpotMultiplier` | 不含 hierarchy（与注释不符） | 删除此 API，改用 `evaluate(spotProduct)` 或 `evaluate(areaMulZone)` 等精确节点 |

---

## 6. 待决策项（Phase 1 前置）

1. **同乘区组多条记录的合并语义**：`1+Σ(f-1)`（加法，当前 childMulMap 路径） vs `Πf`（连乘，当前 aggregateZone 路径）——选一个统一。
2. **`globalMul` 乘什么**：推荐乘 `Σ initFull`（完整值），但也可乘 `Σ initBase`（纯 base 链）。选一个。
3. **`getSpotMultiplier` 去向**：删，或改为 `evaluate(spotMulZone)` 的精确语义。