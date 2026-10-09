# Task 0259 / PB-09：统一可撤销的本地行动计划

状态：completed — 本地草稿生命周期与自动化验收完成（2026-10-08）。

> Owner 裁定以 draft-0256 为准：继续复用 UI 本地 SceneDraft，不新增草稿服务或持久状态；Runtime staged batch 与 UI 草稿保持分层。

## 目标与边界

行动牌、执行者和目标的编辑必须可撤销，并绑定当前 Run、planVersion 与 Location。上下文变化后不能重用旧草稿；预览和编辑不得写入 Runtime。

## 实施结果

- 继续使用现有 UI 内存 SceneDraft 保存待提交的场景选择，保留取消、换牌、改派与改目标操作。
- 新增按 Run 清理本地场景草稿的路径；成功提交、显式跳过及上下文离开时清理旧草稿，Runtime 失败时保留草稿供用户修正。
- 版本不匹配仍由 Runtime 拒绝，Controller 刷新当前 View 并给出可读提示；没有增加 EventRun 或 SaveData 字段。
- 主要实现位于 src/ui/controller-actions-operation.ts 与 src/ui/components/operation-workspace.ts。

## 验收证据

- tests/ui/gameplay-b-operation-controller.test.ts 覆盖编辑草稿、区域重建恢复选择、过期 planVersion 拒绝、预览不写 Run，以及成功提交后清除旧 SceneDraft。
- tests/ui/operation-workspace-view.test.ts 覆盖 UI 草稿按 Run / 版本读取与失效边界。
- tests/engine/operation-runtime-service.test.ts 保持 Runtime 版本检查与原子写入边界。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。
- 未进行真实 Edge 下焦点、滚动与提示节点连续性的人工复核。

## 后续边界

草稿目前使用 Location 作为上下文；若后续 PB-13 引入同一 Location 内多个 Scene，应按新 Scene 身份重新评估草稿绑定键。
