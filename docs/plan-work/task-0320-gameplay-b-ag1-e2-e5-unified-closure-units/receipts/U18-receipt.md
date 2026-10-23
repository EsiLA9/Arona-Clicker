# U18 Receipt：Shield 与 damage pipeline

状态：U18a1–e 已实现；自动化和静态检查通过。屏幕人工验收未执行，需求步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U18-screen-acceptance-report]]。

## 实现结果

- 新增 AG-1 `shieldAdd` 闭合语句及 source/primary Actor 目标上下文；Shield Map 按归一化 Action Program 递归识别，E1/legacy 路径不变。
- 纯 Planner 维护 Encounter-local 聚合 Shield ledger；damage 按 modifier 后的请求量逐目标、逐 hit 结算 Shield→HP。0 HP 不消耗 Shield、不获新 Shield；溢出拒绝整份 detached plan。
- Shield 输入位于 `schedulerStartSnapshot.encounter.shields`。含 Shield 作者语义的 Map 使用 scheduler v6 与独立 Shield Receipt v1；无 Shield Map 与历史 scheduler v5 路径保持原样。活动 Encounter Save/Resume 验证 Shield ledger，Restore 重放并核对 Trace 与最终状态。
- 新增可进入 Map `gameplay-b:map:shield-example`：支付 1 点 Focus 给芹香 3 Shield；第一轮吸收 2 并保留 1，第二轮吸收 1、将剩余 1 伤害计入 HP。Commit Receipt、Save/Restore 与下一轮 ledger 均由集成测试核对。
- Encounter ReadModel 只读投影每名单位的独立 Shield 值；Workspace 独立显示正 Shield，Commit Flow 按执行顺序呈现 Shield 增加与每次伤害的吸收/剩余量。

## 验证

- U18 定向 9 个测试文件：237/237 通过（Effect syntax、Registry、Planner、AG-1 Commit/Restore、Save/Resume、正式示例、Workspace、Flow adapter）。
- Schema sync：15/15 通过；Schema 由生成器同步。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：1265 篇 Markdown，0 errors。
- `git --no-pager diff --check`：通过；Git 仅提示共享工作树中已有 CRLF/LF 转换提示。
- 未提交 Git commit。

## 边界

本 Receipt 不表示 Shield 的屏幕人工验收已通过，也不表示 E4 的部分/类别净化、Revive、Modifier、Trigger 或跨 Encounter Status 已完成。E1 U18 仍排除在 Task 0320 外。
