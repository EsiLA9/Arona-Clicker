# Gameplay B MapRun Fact 门控候选池

以下片段展示 MapRun Counter / Flag 如何启用静态 Map-local 候选池。它们只控制候选来源是否展开；不创建 Action、不修改静态 Tag，也不改变 0317 定义的顺序、权重合并、资格过滤或 Hand RNG。

## 声明 Facts 与静态 Pool

```json
{
  "executionContractId": "AG-1",
  "mapRunFacts": {
    "counters": [
      { "id": "cluesFound", "initial": 0, "min": 0, "max": 3 }
    ],
    "flags": [
      { "id": "alarmRaised", "initial": false }
    ]
  },
  "candidatePools": [
    {
      "id": "alarmResponse",
      "gate": { "kind": "flag", "flagId": "alarmRaised", "value": true },
      "entries": [
        { "kind": "action", "actionId": "suppressAlarm", "weight": 2 },
        { "kind": "pool", "poolId": "informedResponse", "weight": 1 }
      ]
    },
    {
      "id": "informedResponse",
      "gate": { "kind": "counter", "counterId": "cluesFound", "comparison": "gte", "value": 2 },
      "entries": [
        { "kind": "action", "actionId": "useEvidence", "weight": 3 }
      ]
    }
  ]
}
```

`alarmResponse` 关闭时不贡献任何候选，也不会展开其子 Pool。Flag 为 true 时，根 Pool 展开；此时 `informedResponse` 仍独立检查 Counter：`cluesFound < 2` 时只提供 `suppressAlarm`，达到 2 后再提供 `useEvidence`。Counter gate 的 `comparison` 只接受 `eq`、`lt`、`lte`、`gt`、`gte`，`value` 必须是安全整数；Flag 的 `value` 必须是布尔值。

## Encounter 候选引用

Character / Enemy 保持原有直接候选和池引用写法：

```json
{
  "characterId": "shiroko",
  "actions": [
    { "actionId": "inspect", "tendencyWeight": 1 }
  ],
  "candidatePoolIds": ["alarmResponse"]
}
```

直接来源、开启的 Pool 与嵌套 Pool 按既有稳定顺序合并。同一 Action 的权重先累加，之后再做候选资格、费用、目标过滤、Tendency 调整和 Hand 抽取。关闭的 gate 不贡献权重。

## 事实快照时点

- 新 Encounter 入场时，以当前 MapRun 根 Facts 冻结候选解析输入。
- 同一 Encounter 的下一轮 Hand 重抽、Preview、候选资格复验与回执恢复都使用这一输入；Encounter 内稍后写入 `alarmRaised` 或 `cluesFound` 不会改变该 Encounter 的候选池。
- 进入新的 Encounter 后，才以已成功安装的 MapRun Facts 创建新候选输入。
- Map Registry 与静态作者上下文检查会考虑所有可由 gate 开启的候选来源，避免初始 gate 关闭时漏检 Action 定义。

## 当前 Fact 门控路线 Edge

MapRun Counter / Flag 也可以作为单条路线边的只读门槛。Edge 与候选池的读取时点不同：候选池在 Encounter 入场时冻结快照；Edge 在每次移动时读取当前已安装的 MapRun Facts。

```json
{
  "edges": [
    {
      "fromNodeId": "survey",
      "toNodeId": "advance",
      "condition": {
        "kind": "counter",
        "counterId": "cluesFound",
        "comparison": "gte",
        "value": 2
      }
    },
    {
      "fromNodeId": "advance",
      "toNodeId": "exit",
      "condition": { "kind": "flag", "flagId": "alarmRaised", "value": false }
    }
  ]
}
```

Counter 条件沿用 `eq`、`lt`、`lte`、`gt`、`gte` 比较符；Flag 条件做布尔等值比较。Edge Fact gate 只允许用于 AG-1 Map，并且引用本 Map 声明的 Counter / Flag。关卡移动与 Workspace 路线卡共享相同判定，未满足时按钮不可选，Runtime 也拒绝移动。该判定不消费或修改事实。

## Registry 拒绝条件

- Counter / Flag ID 未在本 Map `mapRunFacts` 中声明，或 gate 引用的 Fact 类型不匹配。
- Counter 比较符无效、比较常量不是安全整数，或 Flag 比较值不是布尔值。
- gate 带有未知字段、额外表达式字段或不支持的 `kind`。
- Pool gate Map 未声明 MapRun Facts，或未选择 `executionContractId: "AG-1"`；Edge Fact gate 也要求显式 AG-1。
- Pool 自引用、未知 Pool / Action、非法权重及累计权重溢出。

更多作者规则见 [[docs/docs-829/03-data-structures/datapack-contracts#Gameplay B 静态 Action Tag 与候选池（E3）]]。
