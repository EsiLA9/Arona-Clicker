# 02. AreaDef 简例（区域）

> 对应 `src/engine/types.ts` 的 `AreaDef`。

## 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:area:schale_main"` |
| `initId` | string（InitId） | ✅ | 所属世界线；必须存在于 `inits` |
| `name` | string | ✅ | 区域名称 |
| `description` | string | ✅ | 描述文本 |
| `defaultSpots` | string[]（SpotId） | ✅ | 默认 Spot；必须存在于 `spots` 且其 `areaId` 为本区域 |
| `adjacentAreaIds` | string[]（AreaId） | — | 相邻区域（用于 travelToArea） |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见 [[01-init#RevealTrigger（揭示 Trigger 列表）]]）；`existence` 目标即"可见条件" |
| `extra` | ExtraValue | — | 任意附加数据 |

## 最小 JSON 简例

```json
{
  "id": "base:area:schale_main",
  "initId": "base:init:schale_office",
  "name": "夏莱主厅",
  "description": "夏莱的主办公区域，略显凌乱但充满生活气息。",
  "defaultSpots": ["base:spot:credit_printer", "base:spot:comms_terminal", "base:spot:data_wiper"],
  "adjacentAreaIds": ["base:area:schale_library"]
}
```

## 带 revealTriggers 的简例

```json
{
  "id": "base:area:schale_hangar",
  "initId": "base:init:schale_office",
  "name": "夏莱机库",
  "description": "停放着夏莱专用车的机库。出勤的起点，也常被当作临时午休地。",
  "defaultSpots": [],
  "adjacentAreaIds": ["base:area:schale_library"],
  "revealTriggers": [
    {
      "reveal": "name",
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">=", "value": 80 }
        ]
      }
    }
  ]
}
```

## 校验要点

- `initId` 引用的 init 必须存在。
- `defaultSpots` 引用的 spot 必须存在，且该 spot 的 `areaId` 等于本区域 `id`。
- `adjacentAreaIds` 引用的 area 必须存在。
