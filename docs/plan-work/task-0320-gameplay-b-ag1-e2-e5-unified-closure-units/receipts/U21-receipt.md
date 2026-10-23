# U21 Receipt：复苏倒地友方

状态：U21a–e 已实现并通过定向自动化、Schema、类型、架构、文档与差异检查。屏幕人工验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U21-screen-acceptance-report]]。

## 实现结果

- AG-1 新增专用 `revive` 原语；目标限 Party `primary`，金额为正安全整数常量，Planner 将恢复 HP 截到目标 `maxHp`，活目标记录 `alreadyAlive` no-op。普通 `heal` / `hpChange`、E1/legacy 与 Enemy Action 不变。
- `partyCharacter.includeDefeated` 仅对含 `revive` 的 AG-1 目标开放。Schema、Context、Registry、Preview、Commit 和 Workspace 共同验证倒地目标身份；Workspace 明确显示倒地标记。
- Revive Trace 进入现有 Program Receipt statement 序列，记录目标、请求/恢复/前后 HP 与结果；不升 scheduler、Program Receipt 或 Status Receipt 版本。Restore 从提交起点重放，并拒绝伪造 Trace/HP。
- 同轮先被击倒、后由 Ability 复苏的 Party 来源仍在原统一队列位置重新检查资格并执行；已 skip 的来源不回插或重复运行。Shield、Status、资源和费用不被复苏顺带改变。
- 注册正式演练 Map `gameplay-b:map:revive-example`，并补充作者说明、Flow 与 Workspace 展示和人工屏幕验收步骤。

## 验证

- U21 定向 11 个测试文件：455/455 通过，覆盖 Effect 语法/Registry、Planner、AG-1 Commit/Restore、Save/Resume、正式样例、Flow、Workspace 与 Schema sync。
- `npm run gen:schema`：通过；Schema sync 15/15。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：扫描 1274 篇 Markdown，0 errors。
- `git --no-pager diff --check`：通过；Git 仅提示共享工作树既有 CRLF/LF 转换提示。
- 未执行浏览器人工验收；没有提交 Git commit。

## 边界

本 Receipt 不表示屏幕人工验收已通过。U21 不包含 Status 生命周期、Modifier、Trigger 或跨 Encounter Status；这些及 E5/P6 剩余范围继续由 Task 0320 跟踪和裁定。
