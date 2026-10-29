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

状态写入入口见 [[state-and-events]]。

## 定义、持有与结果分别在哪里

| 内容 | 负责什么 | 不能推断什么 |
| --- | --- | --- |
| Registry 的卡池与 Variant 定义 | 描述候选、费用、稀有度、权重和保底 | 定义存在不等于玩家已经拥有角色。 |
| 卡池计数 `gachaState[poolId]` | 保存该池 `pity` 和 `pulls` | 不与其他卡池自动合并。 |
| Roster / 角色进度 | 记录已获得 Variant 及其进度 | 同一角色原型的其他 Variant 不因此自动获得。 |
| `RollSummary` | 返回本次结果和可能的中止原因 | 它是一次调用的结果，不是长期持有状态。 |

## 逐抽执行与保底

`roll(poolId, count)` 首先检查卡池、模式、概率表、成员以及当前可抽集合。随后对每一抽分别检查余额；余额足够时扣单抽费用、按模式抽取 Variant、更新保底、调用角色获得写入口、增加 pulls，再把结果放入摘要。已有结果或因余额不足而停止时，服务发出 `gachaResolved`，事件中的 count 是实际完成抽数。

当前 `ba-classic` 模式先判断保底：配置有 `pity` 且 `pity + 1` 达到 `guaranteedAt`、同时有 featured 成员时，选择第一个 featured。否则先按 rarity 权重选择稀有度，再从可抽成员中选 Variant；同稀有度存在 featured 时有专门的 featured 选择分支，缺少该稀有度候选时回退到可抽成员。不同模式不应默认共用这些规则。

### 可核对的例子：十连只完成两抽

`tests/engine/gacha-service.test.ts` 的测试池单抽花费 120，余额为 300 时请求 10 抽：前两抽完成，第三抽前余额不足，结果保留两条并标记 `stopped: insufficient-currency`。已完成抽取不会因后续余额不足而撤销。另一个测试令 `guaranteedAt = 10`、当前 pity 为 9，下一抽命中 featured 并把 pity 归零。

未知卡池、未注册模式、配置不完整或没有可抽成员会抛错；与余额不足的正常中止不是同一种结果。扣费在实际抽取之前，因此不能把所有意外异常都描述成整次调用原子回滚；具体异常的副作用要结合调用路径核实。

源码与测试：`src/arona-clicker/services/economy/gacha-service.ts` 的 `roll()`、`baClassic`，`tests/engine/gacha-service.test.ts` 的 G-01、G-03、G-09。培养和好感如何消费持有状态见 [[character-growth]]。
