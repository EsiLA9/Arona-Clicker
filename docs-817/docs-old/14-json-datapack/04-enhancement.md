# 04. EnhancementDef 简例（强化）

> 对应 `src/engine/types.ts` 的 `EnhancementDef`。

## 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:enh:credit_system"` |
| `name` | string | ✅ | 名称 |
| `description` | string | ✅ | 描述 |
| `effects` | Effect[] | ✅ | 获得时执行的效果（可为空数组） |
| `autoApply` | boolean | ✅ | 满足条件自动应用 |
| `maxStacks` | number | — | 可叠加层数 |
| `price` | ResourceAmount[] | — | 购买价格 |
| `productionMultiplier` | number | — | 全局/标签产出倍率 |
| `productionTags` | string[][] | — | 限定标签（`productionMultiplier` 仅对含这些标签的 Spot 生效） |
| `attachment` | object | — | `{ "kind": "area", "areaId": "..." }` 或 `{ "kind": "init", "initId": "..." }` 或 `{ "kind": "spot", "spotId": "..." }`，决定 UI 展示位置 |
| `addsFunctionalities` | SpotFunctionalityDef[] | — | 获得后注入的功能 |
| `affectorPackIds` | string[] | — | 关联的 AffectorPack（持续生效） |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见 [[01-init#RevealTrigger（揭示 Trigger 列表）]]）；`existence` 目标即"可见条件"，`unlock` 目标即"解锁条件" |
| `extra` | ExtraValue | — | 任意附加数据 |

## 最小 JSON 简例

```json
{
  "id": "base:enh:credit_system",
  "name": "信用点流通优化",
  "description": "优化夏莱内部信用点的流通效率。全部 Spot 的信用点产出 +50%。",
  "revealTriggers": [
    { "reveal": "unlock", "condition": {
      "type": "AND",
      "conditions": [
        { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 50 }
      ]
    }}
  ],
  "effects": [],
  "autoApply": true,
  "productionMultiplier": 1.5,
  "price": [{ "resourceId": "base:resource:credit", "amount": 100 }],
  "attachment": { "kind": "area", "areaId": "base:area:schale_main" }
}
```

## 标签限定 + 注入功能 + Affector 简例

```json
{
  "id": "base:enh:energy_supply",
  "name": "能量饮料后勤",
  "description": "建立战术能量饮料的稳定供应渠道，每 tick 自动恢复 1 信用点。",
  "revealTriggers": [
    { "reveal": "unlock", "condition": {
      "type": "AND",
      "conditions": [
        { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 50 }
      ]
    }}
  ],
  "effects": [],
  "autoApply": true,
  "affectorPackIds": ["base:pack:energy_drink"],
  "price": [{ "resourceId": "base:resource:credit", "amount": 50 }],
  "attachment": { "kind": "area", "areaId": "base:area:schale_main" }
}
```

## 条件组合示例（AND 内嵌 OR）

```json
{
  "id": "base:enh:test_and_nested_or",
  "name": "【测试·与或】配置达标线",
  "description": "信用点 ≥200 且 (战术指挥台 ≥2级 或 已拥有信用点流通优化)。",
  "revealTriggers": [
    { "reveal": "unlock", "condition": {
      "type": "AND",
      "conditions": [
        { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 200 },
        {
          "type": "OR",
          "conditions": [
            { "target": "spotLevel", "key": "base:spot:tactical_desk", "comparator": ">=", "value": 2 },
            { "target": "hasEnh", "key": "base:enh:credit_system", "comparator": "==", "value": 1 }
          ]
        }
      ]
    }}
  ],
  "effects": [],
  "autoApply": true,
  "productionMultiplier": 1.3,
  "price": [{ "resourceId": "base:resource:credit", "amount": 100 }],
  "attachment": { "kind": "area", "areaId": "base:area:schale_main" }
}
```

## 校验要点

- 解锁条件通过 `revealTriggers` 中 `reveal: "unlock"` 的 Trigger 表达；缺省（无 `unlock` Trigger）= 无条件即可购买/获得。
- `attachment` 引用的 area/init/spot 必须存在（Registry 校验引用完整性）。
- `productionTags` 元素为 TagPath（字符串数组），如 `[["field"],["combat"]]`。
