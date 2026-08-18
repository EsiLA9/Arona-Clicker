# 12. ExtraValue 语法与 Datapack.extras 常量表

> 对应 `src/engine/types.ts` 的 `ExtraValue` / `ExtraCompound`。

## 语法（NBT 风格）

| JSON 键 | 类型 | 值形式 |
|---|---|---|
| `t` | string | `"int"` \| `"float"` \| `"str"` \| `"bool"` \| `"list"` \| `"dict"` |
| `v` | 任意 | 随 `t` 变化 |

| t | v 形式 | TS 构造器 | JSON 示例 |
|---|---|---|---|
| `"int"` | number | `extra.int(5)` | `{"t":"int","v":5}` |
| `"float"` | number | — | `{"t":"float","v":1.5}` |
| `"str"` | string | `extra.str("x")` | `{"t":"str","v":"x"}` |
| `"bool"` | boolean | `extra.bool(true)` | `{"t":"bool","v":true}` |
| `"list"` | ExtraValue[] | — | `{"t":"list","v":[...]}` |
| `"dict"` | Record<string, ExtraValue> | `extra.dict({...})` | `{"t":"dict","v":{...}}` |

## 使用位置

1. **Def 级 extra 字段**：任一 Def（init/area/spot/enhancement/story/item/dropTable/affectorPack/trigger/funclet/character）均可带 `extra`。
2. **Datapack.extras 常量表**：扁平键 `Record<string, ExtraValue>`，加载时 `expandFlatKeys` 展开为树。

## 最小简例（Def 级 dict extra）

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

## Datapack.extras 常量表简例（扁平键）

```json
"extras": {
  "meta/author": { "t": "str", "v": "AronaClicker Team" },
  "meta/version": { "t": "str", "v": "1.0.0" },
  "balance/start-credit": { "t": "int", "v": 0 }
}
```

加载后等价于嵌套树：

```json
{
  "meta": {
    "author": { "t": "str", "v": "AronaClicker Team" },
    "version": { "t": "str", "v": "1.0.0" }
  },
  "balance": {
    "start-credit": { "t": "int", "v": 0 }
  }
}
```

## 校验要点

- `assertValidExtra` 校验所有 Def 的 `extra` 字段及数据包 extras 表：必须是合法 `{t,v}` 结构。
- Condition 的 `target: "extra"` 与 Effect 的 `setExtra`/`addExtra`/`removeExtra` 均读取合并后的 extra 视图（全局层 → Init 层 → Registry 常量表）。
