# U22 Receipt：回合限时伤害减免 Status

状态：U22a–d 已实现并通过定向自动化、Schema、类型、架构、文档与差异检查。屏幕人工验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-screen-acceptance-report]]。

## 实现结果

- Map-local Status 定义新增 `kind: 'damageReduction'` 与正安全整数 `damageReductionPerStack`；要求 `category: 'beneficial'`，禁止与 burn/regen 的 `hpPerStack` 混用；此 Status 类型仅准入 AG-1。
- Planner 对存活目标的每个 AG-1 damage target/repeat hit 分别计算：raw damage → U17 outgoing CardRef delta → 按活动 Status 层数固定减免 → U18 Shield → HP。早先语句/来源的 Status 变化立即影响后序 hit；减免不消费 Status 层数。倒地目标不应用减免或消耗 Shield。
- damage Effect Trace 记录减免总量及 Status ID、来源、Action、层数、每层值和本次贡献。roundEnd trace 记录 `damageReduction` 的持续时间变化和 0 HP delta；状态只在既有成功 roundEnd 推进与到期。
- 含该定义的 Map 使用 Status Receipt v5；Restore 从 scheduler 起点重新规划，比较 Effect/Status/Shield Trace 与最终账本，并拒绝 Trace 篡改。Scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1、Status Receipt v1–v4 与 E1/legacy 保持兼容。
- 新增正式可进入 Map `gameplay-b:map:damage-reduction-example`，Map `resumeVersion: 1`；演示 3 点伤害先减 2，再由 1 点 Shield 吸收，随后减伤生效、到期及到期后恢复原伤害。ReadModel/Workspace 显示每层和合计减伤，Commit Flow 显示请求、Modifier、减免、Shield 与 HP 顺序。

## 验证

- U22 定向 11 个测试文件：462/462 通过，覆盖 Schema、语法/Registry、Planner、AG-1 Commit/Restore、Save/Resume、正式样例、Flow 与 Workspace。
- `npm run gen:schema`：通过，生成 Schema unchanged；Schema sync 15/15。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：扫描 1278 篇 Markdown，0 errors。
- `git --no-pager diff --check`：通过；Git 仅提示共享工作树既有 CRLF/LF 转换提示。
- 未执行浏览器人工验收；没有提交 Git commit。

## 边界

本 Receipt 不表示屏幕人工验收已通过。U22 不包含一次性受击保护消费、其他持续属性修正、damage/heal/到期 Trigger、反击/受治回馈或跨 Encounter Status；这些仍由 Task 0320 后续合同和 P7 范围裁定处理。
