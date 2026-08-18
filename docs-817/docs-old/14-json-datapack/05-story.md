# 05. StoryDef 简例（剧情）

> 对应 `src/engine/types.ts` 的 `ActiveStoryDef | PassiveStoryDef`、`StoryPage`、`StoryChoice`。

## 字段表（公共）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:story:schale_welcome"` |
| `name` | string | ✅ | 剧情标题 |
| `type` | string | ✅ | `"active"`（主线触发）\| `"passive"`（随机闲聊） |
| `triggerCondition` | ConditionGroup | ✅ | 触发条件（active 需为真才推进；passive 为可被抽取的候选） |
| `availableInits` | string[]（InitId） | ✅ | 可在哪些世界线出现 |
| `pages` | StoryPage[] | ✅ | 剧情页 |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见 [[01-init#RevealTrigger（揭示 Trigger 列表）]]） |
| `extra` | ExtraValue | — | 任意附加数据 |

## 字段表（passive 专属）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `repeatable` | boolean | ✅ | 是否可重复触发 |
| `cooldownFrames` | number | ✅ | 重复触发冷却（帧） |
| `weight` | number | ✅ | 随机抽取权重 |
| `completionReward` | object | — | `{ "first": Effect[], "repeat": Effect[] }`，first 仅首次完成奖励 |

## StoryPage（剧情页）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `speaker` | string | 说话人 |
| `text` | string | 文本 |
| `choices` | StoryChoice[] | 选项 |
| `effects` | Effect[] | 本页结束时执行的效果 |
| `sendText` | string | 按钮回复文案 |
| `clickWork` | number | 点击劳动量（未确认，谨慎使用） |

## StoryChoice（选项）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `text` | string | 选项文案 |
| `effects` | Effect[] | 选择后执行的效果 |
| `condition` | ConditionGroup | 可选显示条件 |

## active 简例（带选项）

```json
{
  "id": "base:story:schale_welcome",
  "name": "欢迎来到夏莱",
  "type": "active",
  "triggerCondition": { "type": "AND", "conditions": [] },
  "availableInits": ["base:init:schale_office"],
  "pages": [
    {
      "speaker": "阿罗娜",
      "text": "欢迎回来，老师。夏莱的设备已经准备好了。",
      "sendText": "设备准备完毕，可以开始调度。"
    },
    {
      "speaker": "老师",
      "text": "清单确认完毕，可以开始调度了。",
      "choices": [
        {
          "text": "从整理办公室开始",
          "effects": [{ "op": "setFlag", "target": "welcome_choice", "value": "office" }]
        },
        {
          "text": "先查看生产设备",
          "effects": [{ "op": "setFlag", "target": "welcome_choice", "value": "production" }]
        }
      ]
    },
    {
      "speaker": "阿罗娜",
      "text": "好的。设备会在每个 Tick 自动结算，资源足够后就能继续升级。",
      "effects": [
        { "op": "addResource", "target": "base:resource:credit", "value": 10 },
        { "op": "addItem", "target": "base:item:energy_drink", "value": 1 },
        { "op": "setSpotLevel", "target": "base:spot:tactical_desk", "value": "1" }
      ]
    }
  ]
}
```

## passive 简例（含 completionReward）

```json
{
  "id": "base:story:schale_briefing",
  "name": "设备简报",
  "type": "passive",
  "triggerCondition": { "type": "AND", "conditions": [] },
  "repeatable": true,
  "cooldownFrames": 5,
  "weight": 1,
  "availableInits": ["base:init:schale_office"],
  "pages": [
    {
      "speaker": "阿罗娜",
      "text": "设备状态稳定。今天也会按统一 Tick 继续工作。",
      "sendText": "了解，阿罗娜。",
      "effects": [{ "op": "addResource", "target": "base:resource:credit", "value": 2 }]
    }
  ],
  "completionReward": {
    "first": [{ "op": "addResource", "target": "base:resource:pyroxene", "value": 15 }],
    "repeat": [{ "op": "addResource", "target": "base:resource:pyroxene", "value": 5 }]
  }
}
```

## 校验要点

- `availableInits` 引用的 init 必须存在。
- `type` 必须为 `"active"` 或 `"passive"`；passive 必须带 `repeatable`/`cooldownFrames`/`weight`。
- `triggerCondition` 直接写原始 ConditionGroup（`and()` 空参数时序列化为 `{"type":"AND","conditions":[]}`）。
