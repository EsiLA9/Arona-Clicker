# 09. TriggerDef 简例（触发器）

> 对应 `src/engine/types.ts` 的 `TriggerDef`、`TriggerEventDef`。

## 字段表（TriggerDef）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:trigger:first_credit_milestone"` |
| `on` | TriggerEventDef | ✅ | 侦测事件 |
| `condition` | ConditionGroup | — | 附加条件 |
| `effects` | Effect[] | ✅ | 触发时执行的效果 |
| `once` | boolean | — | 仅触发一次 |
| `extra` | ExtraValue | — | 任意附加数据 |

## TriggerEventDef（侦测事件）

| `kind` | 附加字段 | 说明 |
|---|---|---|
| `"tick"` | — | 每帧检查（配合 condition 懒求值） |
| `"resource"` | `resource`（资源 id） | 资源变化时 |
| `"spotLevel"` | `spotId`（可选） | 设施等级变化时 |
| `"item"` | `itemId`（可选） | 物品变化时 |
| `"story"` | `storyId`（可选） | 剧情推进时 |
| `"init"` | `initId`（可选） | 进入世界线时 |
| `"area"` | `areaId`（可选） | 进入区域时 |

## 最小 JSON 简例

```json
{
  "id": "base:trigger:first_credit_milestone",
  "on": { "kind": "tick" },
  "condition": {
    "type": "AND",
    "conditions": [
      { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">=", "value": 100 }
    ]
  },
  "effects": [{ "op": "addResource", "target": "base:resource:credit", "value": 25 }],
  "once": true
}
```

## 剧情完成触发简例

```json
{
  "id": "base:trigger:welcome_reward",
  "on": { "kind": "story", "storyId": "base:story:schale_welcome" },
  "effects": [{ "op": "addItem", "target": "base:item:energy_drink", "value": 1 }],
  "once": true
}
```

## 统计 DSL key 速查（condition 中使用）

| key | 含义 |
|---|---|
| `$GlobalProducedAmount base:resource:credit` | 全局累计产出信用点 |
| `$InitProducedAmount base:init:abydos base:resource:credit` | 某世界线累计产出信用点 |
| `$GlobalUnlockedInits` | 已解锁世界线数量 |

## 校验要点

- 可在 `InitDef.triggers` 内联，也可置于 Datapack 顶层 `triggerDefs`。
- `on.kind` 必须为上述 7 种之一。
