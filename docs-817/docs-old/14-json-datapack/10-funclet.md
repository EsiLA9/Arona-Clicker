# 10. FuncletDef 简例（数值函数）

> 对应 `src/engine/types.ts` 的 `FuncletDef`。base 包中为 `[]`（未使用），但类型已定义。

## 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一 |
| `description` | string | ✅ | 说明 |
| `params` | object[] | ✅ | 参数定义：`{ "name": string, "type": string }` |
| `calc` | ValueExpression | ✅ | 计算表达式（body） |
| `extra` | ExtraValue | — | 任意附加数据 |

## 最小 JSON 简例（示意）

```json
{
  "id": "base:funclet:power_curve",
  "description": "指数成长曲线：base × growth^level",
  "params": [
    { "name": "base", "type": "number" },
    { "name": "growth", "type": "number" },
    { "name": "level", "type": "number" }
  ],
  "calc": {
    "type": "value",
    "value": { "type": "value", "source": "funclet", "params": { "funcletId": "base:funclet:power_curve" } }
  }
}
```

> 说明：base 数据包未定义 funclet，实际 `calc` 表达式形态需以 `ValueSource.funclet` 在引擎侧的求值为准。若未使用可保持 `"funcletDefs": []`。

## 校验要点

- 顶层 `funcletDefs` 为必填键（可为空数组 `[]`）。
- `calc` 为 ValueExpression（见 README §5.1）。
