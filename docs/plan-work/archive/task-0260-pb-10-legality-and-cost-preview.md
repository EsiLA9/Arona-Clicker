# Task 0260 / PB-10：统一合法性与费用预览

状态：completed — Runtime 纯预览接入与自动化验收完成（2026-10-08）。

> Owner 裁定以 draft-0256 为准：UI 不重复实现费用或资格算法；变更选择后调用与提交同源的 Runtime preview，提交时重新校验。

## 目标与边界

选择、改派、改目标或取消后，UI 应即时展示合法性、PlayerCost、Actor / Team 执行费用、合计及余额变化。Preview 不扣费、不移牌、不写 Run；最终提交仍由 Runtime 校验。

## 实施结果

- 替换 UI 按 DOM 上 playerCost 数字估算费用的逻辑，改为基于当前 runId / planVersion 与场景草稿构造命令并调用 previewSceneActionBatch。
- 展示玩家费用与 Actor / Team 资源费用、总额、余额前后及不可执行原因；preview 无效或资源不足时禁用场景提交。
- 正常确认前再做一次 Runtime preview 校验，并将同一批命令提交至 Runtime；战斗候选继续读取 OperationView 的 selectable、blockedReasonIds 与 canCommit。
- 主要实现位于 src/ui/controller-actions-operation.ts；纯预览合同在 src/arona-clicker/services/operation-runtime-service.ts。

## 验收证据

- tests/ui/gameplay-b-operation-controller.test.ts 覆盖费用预览变化、Actor / Team 支付显示、无 Runtime 写入和不可提交状态。
- tests/engine/operation-scene-actions.test.ts 覆盖纯 preview、不足费用和 PlayerCost + Action 资源成本的原子性。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。

## 后续边界

费用类别与提交一致性继续由 Runtime planner 保证；本 Task 不增加新费用种类或 UI 侧规则副本。
