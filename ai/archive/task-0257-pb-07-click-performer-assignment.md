# Task 0257 / PB-07：补全纯点击式执行者分配

状态：completed — 实现与自动化验收完成（2026-10-08）；桌面 Edge 焦点与视口检查留待阶段集成验收。

> Owner 裁定以 draft-0256 为准：点击候选只来自 Runtime 投影的 eligibleActorIds；点击和拖放更新同一个 UI 本地草稿，不能直接写 Run。

## 目标与边界

为要求 selected-student Performer 的 Global SceneAction 和 PlayerSceneCard 增加无拖动的选择、改派与取消操作。保留现有拖放交互；资格、行动计划和最终合法性仍由 Runtime / View 决定。

## 实施结果

- 在未分配 performer 的全局场景行动和玩家场景牌上提供可聚焦的执行者候选选择器，候选严格取自当前 View 的 eligibleActorIds。
- 点击分配、改派、取消均复用现有本地 SceneDraft 更新路径；不改牌区、不扣费、不写 Run。
- 保留拖放挂靠路径。相关实现位于 src/ui/components/operation-workspace.ts、src/ui/controller-actions-operation.ts 和 src/ui/css/operation-workspace.css。

## 验收证据

- tests/ui/gameplay-b-operation-controller.test.ts 覆盖点击选择 performer、改派与取消，并验证 UI 候选选择不会直接写 Runtime。
- 同文件的既有拖放流程仍覆盖挂靠后的行动与目标；Runtime preview 保持最终资格校验。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。
- 未进行真实 Edge 键盘焦点恢复、取消后焦点位置和遮挡人工检查。

## 后续边界

本 Task 只补齐 performer 输入方式，不定义目标数量；目标规则由 PB-08 负责。
