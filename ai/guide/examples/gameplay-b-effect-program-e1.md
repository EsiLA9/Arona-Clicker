# Gameplay B Map Action E1/E2 效果程序作者示例

本文对应当前可加载例图 [TypeScript 数据包示例](../../src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts)。例图注册在可选 `gameplay-b@1.0.0` 包中，可从地图终端打开“效果程序作者示例”；[Registry / Owner 测试](../../tests/data/gameplay-b/gameplay-b-effect-example.test.ts)覆盖真实包加载和当前 Hand CardRef。示例 Map 的 `resumeVersion` 为 4，复制后若修改会影响活动 Run 的动作、目标、费用或效果，应继续提高版本。

## 当前 Action 合同

Map Action 的作者效果只写在 `effectProgram` 中。`prepare` 表示准备阶段效果，`resolve` 按数组顺序逐项执行；此例使用的 `when` 读取 HP 等条件。此示例地图未声明 `executionContractId`，使用 E1 兼容合同，其费用先核算，不能用本轮稍后产生的资源奖励支付。`AG-1` 的执行与费用顺序不同，不能把此例的规则直接推广。

新例可用 `{ op: 'damage' | 'heal', target: 'primary', amount: 正安全整数 }`；E2 也可把 `target` 写成确定性集合并用受限 Value 表达动态量。伤害降低 HP，治疗提高 HP但不复活；Owner 按 HP 上下限结算，Preview / Receipt 会说明集合成员、请求量与实际变化。E1 AST 仍保留带符号的 `hpChange` 程序节点；它不是旧 Action 数组。Map Action 的旧 `effects` / `hpEffects` / `cardEffects` 则已由 Task 0315 移除，Registry 会拒绝包含这些字段的 Action。`ShopOffer.effects` 是独立商店合同，仍然有效。

## E2：确定性集合、Value 与 repeat

下面是另一个扩展能力示意，不在上面的 E1 示例地图中；使用新 E2 Effect AST 的地图须显式声明 `executionContractId: 'AG-1'` 并通过对应内容校验。

集合在执行到这条指令时解析一次，按 Party roster 或 Enemy 定义顺序建立候选；默认只保留存活单位。HP 比例排序使用精确整数比较，同值保持原顺序；`limit` 在筛选和排序后截取最多 32 名。省略 `limit` 时，如果集合超过 32 名会拒绝，不会静默漏人。成员固定后，每个目标连续完成自己的 repeat 命中。

```ts
{
  op: 'damage',
  target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 3 } },
  amount: {
    kind: 'min',
    left: { kind: 'missingHp', unit: 'target' },
    right: { kind: 'literal', value: 4 },
  },
  repeat: 2,
}
```

此例选择 HP 比例最低的三名存活敌人；对每名目标连续命中两次，每次到达该目标时重新读取 missingHP 并将其与 4 取较小值。空集合合法，记录 0 名目标。`filter: 'all'` 可显式包含倒地单位，但普通 damage/heal 仍不会复活。

上述例子使用的 Value 接受安全整数和白名单运算，包括 literal、source/primary/target HP、HP cap、missingHP、已声明 Counter、Round、targetCount、add/sub/mul/divFloor/min/max/clamp/abs；没有任意属性路径或脚本求值。除法向负无穷取整，例如 -3/2 得 -2。Value 运算中间值也要保持安全整数；除零、越界、负伤害／治疗量以及 repeat 不在 0–8 范围内都会拒绝。

当前 `AG-1` 还支持随机 TargetSet、受限 `forTargets`、`resourceBalance` Value 和 `resourceAtLeast` 条件；这些扩展不意味着 E1 兼容地图可以使用它们。随机集合需要有效 `limit` 和效果随机状态，使用与手牌抽取分开的效果随机流；`forTargets` 的循环体受语法与上下文约束，例如不能在其中使用 `revive`，并非任意语句都可包裹。实际可用性以 `src/data-services/validation/gameplay-map-effect-syntax.ts` 和 `gameplay-map-effect-context.ts` 的校验为准。

## 伤害与费用

```ts
{
  id: 'precision-shot',
  name: '定点射击',
  description: '费用 1 点 sCost，对主目标造成 3 点伤害。',
  eligibleCharacterIds: ['serika'],
  target: { kind: 'enemy' },
  costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
  effectProgram: {
    resolve: [{ op: 'damage', target: 'primary', amount: 3 }],
  },
}
```

`costs` 与效果程序分别表达费用和效果。掩护射击会先按轮初弹药余额验证费用，再依次对主目标造成 2 点伤害、为执行者增加 1 发弹药；本轮奖励不能补足本轮费用。

## 条件治疗

例图中的治疗 Action 以 `target: { kind: 'self' }` 选择自己，因此 `primary` 是该行动者。治疗前 HP 不高于 4 时，团队先获得一个急救包，再治疗 3 点：

```ts
effectProgram: {
  resolve: [
    {
      op: 'when',
      condition: { kind: 'hpAtMost', target: 'source', value: 4 },
      then: [
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'field-medkits', delta: 1 },
      ],
    },
    { op: 'heal', target: 'primary', amount: 3 },
  ],
}
```

如果把 `when` 放在 `heal` 后面，条件读取的就是治疗后的 HP。HP 仍由 Owner 截到 0 与声明上限；HP 为 0 的目标不会被普通治疗复活。

## CardRef 准备折扣

```ts
{
  id: 'prepare-shot',
  name: '临时强化',
  eligibleCharacterIds: ['shiroko'],
  target: { kind: 'card', side: 'ally' },
  effectProgram: {
    prepare: [{ op: 'discountSCost', amount: 1 }],
  },
}
```

`ally` 指当前 Encounter 中队友（含自己）的合法真实 Hand 卡。折扣绑定该 CardRef，只减少受用卡 Actor 的 `sCost`；多个折扣相加后最低截为 0，不减少 `PlayerCost`。Hand 或 Encounter 变化后，旧 CardRef 不再是合法目标。

## Encounter 进度

`counterAdd` 与 `flagSet` 可和资源变化按顺序放入 `resolve`。Counter 必须声明 `initial`、`min`、`max`；安全整数加法后饱和到范围。Flag 只接受布尔值。Counter / Flag 在同一 Encounter 内跨轮保留，切换 Encounter 时重新初始化。例图中的 `trust` 从 0 增长到 3，`briefed` 是独立布尔记录；活动条件在完整合法轮次后检查。

Actorless Ability / Item 不伪造 `sourceActor` 或 `self`；其目标与费用资格仍由各自合同限制。资源账本使用 `sourceActor`、`primaryActor` 或 `sourceTeam` 等程序账户，不与 `PlayerCost` 或 AC 全局资源混用。

逐 Action 的旧内容迁移和有意语义变化记录在 Task 0315（原归档已删除）；当前作者与 Registry 入口见 [[datapack-and-registry]]。
