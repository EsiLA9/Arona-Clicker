# Gameplay B AG-1 复苏示例

`gameplay-b:map:revive-example` 是可进入的 AG-1 Map，演示选择倒地 Party Character、提交复苏，以及 Restore 重放 HP 与来源资格。Action 不能靠普通 `heal` 或 `hpChange` 复活单位。

## 作者形状

复苏 Action 需要明确开放倒地队友作为 `primary`：

```ts
{
  id: 'revive-serika',
  eligibleCharacterIds: [],
  target: { kind: 'partyCharacter', includeDefeated: true },
  effectProgram: {
    resolve: [{ op: 'revive', target: 'primary', amount: 3 }],
  },
}
```

`includeDefeated` 仅用于 AG-1 `partyCharacter` 目标；Registry 要求该 Action 确实含有 `revive`。复苏语句只接受 Party `primary` 与正安全整数常量 `amount`，不接收 source、Enemy、CardRef、TargetSet、additionalTarget 或 `forTargets`。

## 结算语义

- 倒地目标从 0 HP 设为 `min(amount, maxHp)`，Trace 记录请求 HP、实际恢复量、前后 HP 和 `revived`。
- 目标已存活时复苏成功但不改 HP，Trace 标记 `alreadyAlive` 与实际恢复 0。
- 复苏不改 Shield、Status、资源或费用；同一 Program 先复苏后治疗时，普通治疗可继续生效；治疗先遇到 0 HP 时仍为 0。
- AG-1 队列按来源实际执行位置检查来源 HP。若早期来源复苏了一个仍有后序 Prepared 来源的队员，后序来源按既有队列执行；已 skip 的来源不回插或重跑。
- Program Trace 进入现有 AG-1 Receipt，scheduler 和 Program Receipt 版本不变。Restore 从起点重放并验证 Trace、队列资格与 HP；篡改结果会拒绝。

## 正式演练

“复苏原语演练”中，敌人先攻击当前 HP 最低的芹香，白子选择 Ability 复苏她；后续来源让芹香继续行动。先后顺序与 Restore 断言由 `tests/engine/gameplay-b-effect-example.test.ts` 覆盖。屏幕验收步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U21-screen-acceptance-report]]。
