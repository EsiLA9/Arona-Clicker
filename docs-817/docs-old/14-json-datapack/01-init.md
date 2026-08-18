# 01. InitDef 简例（世界线）

> 对应 `src/engine/types.ts` 的 `InitDef`。JSON 键与 TS 字段一一对应，所有 TS 构造器产物均为纯 JSON。

## 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:init:schale_office"` |
| `name` | string | ✅ | 世界线名称 |
| `description` | string | ✅ | 描述文本 |
| `enterEffects` | EntryEffectDef[] | — | 进入条目列表（见下）：进入世界线时按声明顺序评估执行 |
| `defaultAreas` | string[]（AreaId） | ✅ | 该世界线默认区域；必须存在于 `areas` |
| `startStoryId` | string（StoryId） | — | 进入后自动触发的剧情 id |
| `triggers` | TriggerDef[] | — | 内联触发器 |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见下）；`reveal: 'existence'` 目标即"可见条件"（原 `visibilityCondition`） |
| `purchaseCost` | ResourceAmount[] | — | 购买价格，如 `[{ "resourceId": "base:resource:pyroxene", "amount": 20 }]` |
| `extra` | ExtraValue | — | 任意附加数据 |

## RevealTrigger（揭示 Trigger 列表）

Def 原型携带 `revealTriggers`：可变列表，每个 Trigger 负责**单纯揭示一个信息块**（条件满足即揭示），不再使用固定四段阶梯。

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `reveal` | string | ✅ | 揭示目标：`"existence"` / `"name"` / `"condition"` / `"utility"` |
| `condition` | ConditionGroup | — | 触发条件：满足即揭示；缺省 = 恒真 |

```jsonc
"revealTriggers": [
  { "reveal": "name",      "condition": { "type": "AND", "conditions": [ /* ... */ ] } },
  { "reveal": "utility",   "condition": { "type": "AND", "conditions": [ /* ... */ ] } }
]
```

语义：同一信息块可有多个 Trigger，**任一满足即揭示**；没有某目标的 Trigger 视为无揭示门槛（该信息块始终可见）。`existence` 目标作为"存在门槛"：存在该 Trigger 且全部未满足时整条 invisible。

## 最小 JSON 简例

```json
{
  "id": "base:init:schale_office",
  "name": "夏莱办公室",
  "description": "一切故事的起点。作为 Schale 的老师，从这间办公室开始，与学生们一起书写日常。",
  "defaultAreas": ["base:area:schale_main"],
  "startStoryId": "base:story:schale_welcome",
  "triggers": [
    {
      "id": "base:trigger:schale_entered",
      "on": { "kind": "init", "initId": "base:init:schale_office" },
      "effects": [{ "op": "setFlag", "target": "schale_entered", "value": "1" }],
      "once": true
    }
  ]
}
```

## 付费世界线（含 revealTriggers + purchaseCost）

```json
{
  "id": "base:init:millennium",
  "name": "千禧年学院",
  "description": "科技与逻辑的学府。以高效率生产闻名。",
  "defaultAreas": ["base:area:millennium_lab"],
  "purchaseCost": [{ "resourceId": "base:resource:pyroxene", "amount": 20 }],
  "revealTriggers": [
    {
      "reveal": "name",
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">=", "value": 50 }
        ]
      }
    },
    {
      "reveal": "condition",
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">=", "value": 300 }
        ]
      }
    },
    {
      "reveal": "utility",
      "condition": {
        "type": "AND",
      "conditions": [
        { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">=", "value": 300 }
      ]
    }
  }
}
```

## 校验要点

- `id` 全局唯一（与 areas/spots/stories/enhancements/items 等不冲突）。
- `defaultAreas` 引用的 area 必须存在，且该 area 的 `initId` 等于本 init 的 `id`。
- `startStoryId` 引用的 story 必须存在。
- 首个无 existence 门槛（`revealTriggers` 中无 `reveal: 'existence'`）的 init 是 `GameInstance.init()` 自动进入的默认世界线（base 中为 `base:init:schale_office`）。
