# docs-830/05-domains/character-and-gacha — 角色与抽卡

本文回答：抽卡结果如何成为角色状态，并由角色服务供其他玩法查询。

## 抽卡流程

```text
Controller 命令 → GachaService.roll()
  → 检查卡池与可抽成员 → 扣除资源并抽取角色差分
  → 更新抽卡计数与角色持有状态 → 返回本次结果
```

`GachaService` 从 Registry 读取卡池定义，按卡池模式执行抽取。每次成功抽取会更新保底/抽取计数，并通过状态写入服务登记角色获得；重复角色的碎片或奖励也由该写入流程结算。抽卡服务返回结果摘要，供界面呈现。

一次调用可以连续抽多次；每抽开始前重新检查货币余额，余额不足时以 `stopped: insufficient-currency` 结束并保留已完成结果。每次有效结果都会扣除单抽成本、调用卡池模式抽出 Variant、更新该池的 pity/pull 计数，并经 `acquireCharacter()` 处理首次获得或重复奖励。抽取结束后发出 `gachaResolved`，由界面消费 `RollSummary` 显示结果。

角色定义、Roster 持有状态和培养进度由不同服务负责。其他玩法通过角色查询服务读取可用角色信息，不应把卡池定义当作角色状态。

卡池成员指向角色差分（Variant），Roster 也以 Variant ID 记录持有与培养状态；角色原型 ID 用于聚合同一角色的身份和基础资料。同一原型的多个差分可以有独立的获取、等级、碎片和培养进度。

源码入口：`src/arona-clicker/services/economy/gacha-service.ts`、`services/character/character-system.ts`、`services/character/roster-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`。相关测试见 `tests/engine/gacha-service.test.ts`、`tests/engine/state-mutation-service.test.ts`。

状态写入入口见 [[docs/docs-830/02-data-and-state/state-and-events]]。
