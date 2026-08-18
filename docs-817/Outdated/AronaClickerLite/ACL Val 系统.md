# 游戏数值系统设计

## 数值元 (GameNum)

数值元是游戏中最基础的数值单元，所有资源、产出、加成均以数值元表示。

### 结构

| 字段              | 类型                                 | 说明           |
| --------------- | ---------------------------------- | ------------ |
| `id`            | string                             | 唯一标识         |
| `displayName`   | string                             | 展示名称         |
| `tagSet`        | Set\<string\>                      | 标签集合，用于聚合查询  |
| `base`          | number                             | 基础值（整数）      |
| `additiveMods`  | Map\<string, Modifier\>            | 加区加成项        |
| `multiGroups`   | Map\<string, Set\<Modifier\>\>     | 乘区加成组        |
| `extraValue`    | number                             | 额外固定值        |
| `floor`         | number \| null                     | 下限           |
| `ceil`          | number \| null                     | 上限           |
| `cached`        | number                             | 缓存结果         |
| `dirty`         | boolean                            | 脏标记          |
| `dependencies`  | Set\<GameNum\>                     | 依赖的其他数值元     |
| `dependents`    | Set\<GameNum\>                     | 被哪些数值元依赖     |
### 求值公式

```
result = clamp(
  (base + Σ addMods)
  × Π(1 + Σ modsInGroup)    // 每组独立：组内累加，组间累乘
  + extraValue,
  floor, ceil
)
```

### 更新策略

- Modifier 或 base 变化 → 立即重算自身 → 标记所有 dependents 为脏
- 读取时若 dirty 为 true → 重算并更新 cached
- 未被读取的脏值不触发重算

### 循环依赖

LiteVersion 在添加依赖时进行检测，禁止形成循环引用。

---

## 加成项 (Modifier)

### 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识 |
| `name` | string | 展示名，如"咖啡厅等级加成" |
| `source` | string | 来源描述，如"Spot:咖啡厅 Lv.5" |
| `value` | number | 加成数值 |

### 示例

```
信用点产出:
  base: 100
  additiveMods:
    "基础加成" → { value: 20, source: "Spot:咖啡厅" }
  multiGroups:
    "角色光环":
      { value: 0.3, source: "Chara:A 角色" }
      { value: 0.2, source: "Chara:B 角色" }
    "道具加成":
      { value: 0.4, source: "Item:咖啡券" }

结果 = (100 + 20) × (1 + 0.3 + 0.2) × (1 + 0.4) = 252
```

---

## 数值分类

| 类型 | 说明 | 示例 |
|------|------|------|
| 资源值 | 可消耗、可累积，拥有增长值 | 信用点、钻石 |
| 增长值 | 为资源值提供每秒产出 | 咖啡厅的信用点产出 |
| 关系计算值 | 由其他数值元组合得出 | 总产出 = A产出 + B产出 |
| Flag 值 | 0 或 1，表示某条件是否达成 | 是否拥有某角色 |

---

## 标签聚合

通过 `tagSet` 实现跨数值元的惰性聚合查询：

```
getByTag("建筑类")   → [咖啡厅产出, 教室产出, ...]
getSumByTag("建筑类") → 咖啡厅产出 + 教室产出 + ...
```

---

## 依赖图透明

每个数值元可查询完整的计算分解：

```
getBreakdown() →
  base: 100
  additiveMods: [{ name: "基础加成", value: 20, source: "Spot:咖啡厅" }]
  multiGroups: {
    "角色光环": [{ name: "A 角色", value: 0.3 }, { name: "B 角色", value: 0.2 }],
    "道具加成": [{ name: "咖啡券", value: 0.4 }]
  }
  formula: "(100 + 20) × (1 + 0.3 + 0.2) × (1 + 0.4) = 252"
  result: 252
```
```