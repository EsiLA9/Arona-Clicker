# Receipt 0191-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；fixed-damage/no-op 结算、实际 HP 下降记忆与下一轮输入已交接给 U3。 |
| 实际修改 | `prototypes/gameplay-b/src/battle/resolve.ts`：结算 U1 的 fixed-damage/no-op 意图并记录事件；`prototypes/gameplay-b/src/runtime.ts`：从最近一次 Delta 的 `hpBefore`/`hpAfter` 得出受伤敌人，只传给下一轮，终态不继续准备且新 Runtime 清空输入；扩展 `prototypes/gameplay-b/tests/enemy-intents.test.ts`；本 Unit spec 与 Receipt。 |
| 未完成内容 | 无；敌方模板/轮序内容由 U3 配置。 |
| 范围外变更 | 无。未改 model/prepare、敌人内容、其他测试文件、Route/UI 或 AC。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npm test -- enemy-intents.test.ts battle-resolve.test.ts runtime.test.ts`（`prototypes/gameplay-b/`） | 通过：4 个文件、47 项测试 | Vitest 的 `runtime.test.ts` filter 同时匹配 `route-runtime.test.ts`。覆盖固定伤害逐目标结算、reload/no-op 日志与零 HP 变化、净 HP 变化触发优先动作、敌方护盾完全吸收时不触发、连续实际受伤重新触发、基础循环恢复、终态与新战斗不带入记忆，以及原有结算/Route Runtime 回归。 |
| 类型检查 | `npm run typecheck`（`prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 文档与空白 | 根目录 `npm run check:docs`；U2 变更文件行尾空白扫描 | 通过 | 561 篇 Markdown、0 errors；尾随空白 0。 |
| C2 净行数 | 按 U2 新增/扩展实现块核算 | 约 190 行 | 结算/Runtime 接线维持在 U1 定义的接口内；总计 5 个白名单文件。 |

## 遇到问题

- 首轮预检确认现有 `BattleResolutionDelta.damage` 是护盾抵消前的累计伤害，不能直接代表 HP 实际下降；Runtime 改用 `hpAfter < hpBefore`。敌方护盾吸收用例验证了该差异。

## 需上游确认项

- 无。

## 事实更新建议

- `PreparedEnemyIntent.effect` 对特殊意图为 `null`，`resolution` 保存 fixed-damage/no-op 语义；resolve 只按已冻结 `targetIds` 生成固定伤害来源，no-op 只记录意图事件，不进入普通攻击公式。
- Runtime 每轮覆盖而不累积 `previousRoundDamagedEnemyIds`；集合基于敌方 Delta 的净 HP 下降，回合连续受伤时仅传最近一次集合，战斗结束不准备新轮。

