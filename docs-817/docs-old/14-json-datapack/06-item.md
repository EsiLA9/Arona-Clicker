# 06. ItemDef 简例（物品）

> 对应 `src/engine/types.ts` 的 `ItemDef`、`ResourceAmount`。

## 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:item:energy_drink"` |
| `name` | string | ✅ | 物品名称 |
| `description` | string | ✅ | 描述 |
| `icon` | string | — | 图标 |
| `maxStack` | number | ✅ | 堆叠上限 |
| `rarity` | string | ✅ | `"common"` \| `"rare"` \| `"epic"` |
| `type` | string | ✅ | `"consumable"`（消耗品）\| `"material"`（素材）\| `"key"`（关键物品） |
| `useCondition` | ConditionGroup | — | 使用条件 |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见 [[01-init#RevealTrigger（揭示 Trigger 列表）]]）；`existence` 目标即"可见条件" |
| `useEffects` | Effect[] | — | 使用时的效果 |
| `pickupEffects` | Effect[] | — | 拾取时效果 |
| `sellPrice` | ResourceAmount[] | — | 出售价格 |
| `affectorPackIds` | string[] | — | 关联持续效果包 |
| `extra` | ExtraValue | — | 任意附加数据 |

## ResourceAmount（资源数量）

```json
{ "resourceId": "base:resource:credit", "amount": 25 }
```

## 消耗品简例

```json
{
  "id": "base:item:energy_drink",
  "name": "战术能量饮料",
  "description": "恢复少量信用点，适合测试背包使用流程。",
  "maxStack": 5,
  "rarity": "common",
  "type": "consumable",
  "useEffects": [{ "op": "addResource", "target": "base:resource:credit", "value": 25 }]
}
```

## 素材 / 关键物品简例

```json
{
  "id": "base:item:field_note",
  "name": "野外调查记录",
  "description": "记录一次调查结果的普通素材。",
  "maxStack": 99,
  "rarity": "common",
  "type": "material"
}
```

```json
{
  "id": "base:item:schale_pass",
  "name": "夏莱通行证",
  "description": "联邦搜查部「夏莱」的官方通行证。持有者可在各学院间自由通行。",
  "maxStack": 1,
  "rarity": "epic",
  "type": "key"
}
```

## 校验要点

- `rarity` / `type` 为字符串枚举，必须使用上述合法值。
- `useEffects[].value` 可为数字字面量（如 `25`）或 ValueExpression；base 中数字字面量用法与 TS 构造器 `Expr.const(25)` 序列化后等价（注意：TS 中数字常量直接写时 Effect 的 value 类型是 `number | ValueExpression`，JSON 中数字字面量即可）。
