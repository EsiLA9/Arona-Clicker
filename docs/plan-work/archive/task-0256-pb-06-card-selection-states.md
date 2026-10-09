# Task 0256 / PB-06：统一卡牌浏览与选中状态

状态：completed — 实现与自动化验收完成（2026-10-08）；桌面 Edge / 窄视口人工检查留待阶段集成验收。

> Owner 裁定以 draft-0256 为准：browsing / focus、selected、unavailable 与 fixed 是不同状态；required 表示玩家可选，fixed 表示已纳入且不可取消。

## 目标与边界

统一 Operation 工作区的学生战斗行动、Location SceneAction 和 PlayerSceneCard 状态表达，避免默认展示、hover 或键盘焦点被误认为已选。Runtime / OperationView 继续负责战斗计划合法性；未提交场景选择仍属于 UI 本地 SceneDraft。

## 实施结果

- Actor 手牌投影现在显式提供 browsing、selected、unavailable、fixed 状态和不可用原因；required / fixed 含义保持不变。
- 战斗与场景卡片输出可访问的状态属性；固定项有固定状态提示，不再与不可用共用 locked 语义。
- SceneAction 与玩家卡的已选状态仍以有效 Runtime 计划 / 本地草稿为准，单纯浏览不写入计划。
- 主要实现位于 src/ui/components/operation-workspace.ts 与 src/ui/css/operation-workspace.css。

## 验收证据

- tests/ui/operation-workspace-view.test.ts 覆盖状态投影、不可用原因、浏览态场景牌与 fixed 状态。
- tests/ui/gameplay-b-operation-controller.test.ts 覆盖选择变化与本地 SceneDraft 交互。
- 2026-10-08 定向验证：六个 UI / Runtime 测试文件共 84 项通过；npx tsc --noEmit、npm run check:docs、git diff --check 通过。
- 未进行真实 Edge 键盘焦点、窄视口和遮挡人工检查；该视觉验收应与阶段集成 UI 一起完成。

## 后续边界

本 Task 完成 G02 的卡牌状态语义；后续 Scene 原语与内容迁移仍按 draft-0256 中 G03+ Task 处理。
