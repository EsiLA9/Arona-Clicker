# 08. AffectorPackDef 简例（持续效果包）

> 对应 `src/engine/types.ts` 的 `AffectorPackDef`、`AffectorEffect`。

## 字段表（AffectorPackDef）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:pack:energy_drink"` |
| `persistent` | boolean | — | 是否持续生效（如 EnergyDrink 每次点击 +1） |
| `entries` | AffectorEffect[] | ✅ | 效果条目 |
| `extra` | ExtraValue | — | 任意附加数据 |

## AffectorEffect

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `id` | string | 效果条目 id |
| `condition` | ConditionGroup | 可选条件 |
| `effects` | Effect[] | 每 Tick / 每次点击执行的持续效果 |

## 最小 JSON 简例

```json
{
  "id": "base:pack:energy_drink",
  "entries": [
    {
      "id": "base:aff:energy_drink",
      "effects": [{ "op": "addResource", "target": "base:resource:credit", "value": 1 }]
    }
  ],
  "extra": {
    "t": "dict",
    "v": {
      "desc": { "t": "str", "v": "能量饮料：每次点击 +1 信用点" },
      "tier": { "t": "int", "v": 1 }
    }
  }
}
```

## 校验要点

- 通常经 `EnhancementDef.affectorPackIds` 挂载到强化上。
- `effects[].value` 为数字字面量即可（TS 中 `Expr.const(1)` 序列化后等价）。
- `extra` 使用 ExtraValue 语法（见 [12-extra.md](12-extra.md)）。
