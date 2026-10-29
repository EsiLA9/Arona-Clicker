# Gameplay B：Prepared Tag 连携示例

本示例使用 Map Action 的静态 `tags` 和 Effect Program 条件 `preparedTagCount`。它只读取本轮开始时已经选定的 Party 行动，不从候选池权重、卡牌 UI、Enemy Intent 或未选 PlayerCommand 推断“准备了几张卡”。

## 作者表达

两名角色分别准备带有 `gameplay-b:action/explosive` Tag 的 Action。`combo-shot` 先对主目标造成 2 点伤害，再检查 Party Prepared Tag 数量；达到 2 时，在同一来源程序中顺序追加 1 点伤害。

```json
{
  "tags": ["gameplay-b:action/explosive"],
  "effectProgram": {
    "resolve": [
      { "op": "damage", "target": "primary", "amount": 2 },
      {
        "op": "when",
        "condition": {
          "kind": "preparedTagCount",
          "side": "party",
          "tag": "gameplay-b:action/explosive",
          "comparison": "gte",
          "value": 2
        },
        "then": [{ "op": "damage", "target": "primary", "amount": 1 }]
      }
    ]
  }
}
```

## 计数规则

- 快照在本轮任何来源结算前生成，之后不因 HP、效果分支或 Enemy 意图变化而更新。
- 每名 Party Character 的有效 `preparedActionId` 最多算一张；已选 PlayerCommand 也算。Wait、未选命令候选、Ability、Item 和 Enemy Actions 不算。
- 当前准备行动即使之后因没有合法目标而跳过，也仍属于本轮实际准备集合。
- 一张 Action 有多个匹配 Tag 仍只计一次。Tag 查询按完整 TagRef 的同 namespace 层级前缀匹配；更细标签可以匹配 `gameplay-b:action/explosive`。
- Receipt 通过 Party settlement 中记录的 Action ID 和 Map Action Tag 独立重算条件。追加伤害只是有限顺序程序的一条普通语句，不会启动递归触发链。

正式可进入 Map：`gameplay-b:map:prepared-tag-combo`（“爆破连携演练”）。
