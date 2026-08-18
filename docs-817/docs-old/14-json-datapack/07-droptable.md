# 07. DropTableDef 简例（掉落表）

> 对应 `src/engine/types.ts` 的 `DropTableDef`、`DropTableEntry`。

## 字段表（DropTableDef）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:drop:basic_field_reward"` |
| `maxRolls` | number | ✅ | 最大随机掉落次数 |
| `guaranteed` | object[] | — | 保底掉落：`{ "itemId": string, "count": number }` |
| `entries` | DropTableEntry[] | ✅ | 随机掉落条目 |
| `condition` | ConditionGroup | — | 可选整体条件 |
| `extra` | ExtraValue | — | 任意附加数据 |

## DropTableEntry（随机条目）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `itemId` | string | 物品 id |
| `min` | number | 最小掉落数量 |
| `max` | number | 最大掉落数量 |
| `weight` | number | 权重 |
| `condition` | ConditionGroup | 可选条件 |

> 注意：`guaranteed` 使用 `count` 键，`entries` 使用 `min/max/weight` 键，二者不同。

## 最小 JSON 简例

```json
{
  "id": "base:drop:basic_field_reward",
  "maxRolls": 1,
  "guaranteed": [{ "itemId": "base:item:field_note", "count": 1 }],
  "entries": [
    { "itemId": "base:item:energy_drink", "min": 1, "max": 1, "weight": 1 }
  ]
}
```

## 多条目简例

```json
{
  "id": "base:drop:trinity_daily",
  "maxRolls": 2,
  "guaranteed": [{ "itemId": "base:item:field_note", "count": 1 }],
  "entries": [
    { "itemId": "base:item:mystery_fragment", "min": 1, "max": 2, "weight": 2 },
    { "itemId": "base:item:momo_friends_cookie", "min": 1, "max": 2, "weight": 3 },
    { "itemId": "base:item:peroro_doll", "min": 1, "max": 1, "weight": 1 }
  ]
}
```

## 校验要点

- `entries[].itemId` / `guaranteed[].itemId` 引用的 item 必须存在于 `items`。
- `guaranteed` 条目用 `count`；`entries` 条目用 `min/max/weight`，勿混用。
