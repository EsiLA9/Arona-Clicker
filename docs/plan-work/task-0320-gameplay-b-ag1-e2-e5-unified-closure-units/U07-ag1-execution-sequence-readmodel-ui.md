# Unit 0320-U07：AG-1 顺序 ReadModel 与界面呈现

## Goal

将 Owner 已生成的 AG-1 `executionSequence` detached 投影给 Map Workspace，并让 Commit Preview 与最近回执按该序列展示来源身份、目标、skip 与实际费用／资源／HP 结果。E1-COMPAT-1 继续使用现有分组摘要与 Feed 正文。

## DOM / 刷新草图

```text
Map Workspace（既有三列 Frame）
├─ 中栏 Talk Feed（既有 data-map-region-key="talk-feed" 滚动宿主）
│  └─ 最新 Commit Talklet（既有 requestId 条目键；仅 AG-1 用 executionSequence 生成有序行）
└─ 中栏 Commit Dock（既有 data-map-region-key="commit-dock"）
   └─ PlayerCost / 状态（既有节点）
      └─ AG-1 Preview sequence summary（仅 AG-1；Owner index 顺序、无新增 wrapper）
```

无新交互控件或 wrapper。Preview 序列更新只替换既有 Commit Dock 区域中的摘要内容；新回执仍通过既有 Talk Feed 条目键更新，保留 Frame、列、滚动宿主与有效按钮。视图刷新沿用 `UIController.refreshMapWorkspaceRegion()` / `patchMapDOM()`；不得调用全页 render。没有受影响的 popover 锚点。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 范围与停止条件 |
| UI | `docs/ai/frontend-design-project-overlay.md`、`ui-style/00-index.md`、`ui-style/patterns.md` | 复用 Map Workspace / Feed 视觉与刷新边界 |
| UI | `docs/docs-829/06-wiki/50-ui/read-model-context.md`、`refresh-update.md` | detached 只读视图及 DOM 更新范围 |
| Task / 前置 Unit | Task 0320 与 U05、U05b、U06 Receipt | Owner sequence 合同、完整来源／结果字段、Restore 最终形状 |
| 源码 | `src/arona-clicker/contracts/map/map-run.ts`：`MapRunEncounterExecutionSequenceEntry` | Owner 顺序行合同 |
| 源码 | `src/arona-clicker/runtime/runtime-game-instance.ts`：`getMapEncounterWorkspaceView` | Preview 与 latest receipt 的 detached ReadModel 投影 |
| 源码 | `src/ui/components/map/map-workspace.ts`、`src/ui/flow/map-flow-model.ts` | 现有 Commit Dock 摘要与 Feed 适配入口 |
| 测试 | `tests/engine/gameplay-b-map-runtime-integration.test.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/map-flow-adapter.test.ts` | 投影、呈现顺序及 E1 兼容证据 |

## Constraints

- AG-1 Preview 与 Recent Commit 只读 Owner `executionSequence`；严禁由 Party／Enemy／Ability／Item 分组重建或排序。
- UI 不排序、不推导 skip 或结果，也不写 MapRun；名称只从 ReadModel 名称／Action 查询取得。
- ReadModel 对 sequence、目标、CardRef、费用和结果做 detached 冻结投影，保存空数组，不泄漏 Owner 可变引用。
- E1 或字段缺省时保留原 Commit Preview Effect 摘要及原分组式 Feed 文案。
- 屏幕范围按项目约定限于宽屏桌面鼠标 UI；不扩展窄屏或键盘交互。
- 不改 `map-run-service.ts`、U06 文件、Task 0320 主文档或 `docs/plan-work/00-index.md`。

## Allowed Files

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/ui/components/map/map-workspace.ts`
- `src/ui/flow/map-flow-model.ts`
- `src/ui/css/map-workspace.css`（仅当现有摘要样式不足）
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/ui/map-flow-adapter.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-ag1-execution-sequence-readmodel-ui.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U07-receipt.md`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-screen-acceptance-report.md`
- `ui-style/patterns.md`

## Completion Criteria

- [x] Preview 与 Recent Commit ReadModel 暴露 Owner sequence 顺序及展示身份／Action 名；所有嵌套对象、数组 detached。
- [x] AG-1 Preview Dock 和 Recent Commit Feed 逐项按 sequence 顺序显示来源、目标、skip、PlayerCost／Item 消耗及实际 HP／资源变化。
- [x] 空 sequence 正常呈现；E1 Preview 与 Feed 保持原样；旧分组投影不作为 AG-1 顺序输入。
- [x] 定向 engine/UI 测试、`npx tsc --noEmit`、`git --no-pager diff --check` 通过。
- [x] 更新受影响的 `ui-style/patterns.md` 条目，准确描述实现与边界。
- [x] 自动化不替代浏览器屏幕验收；已向 Task 负责人报告该剩余验收需求。

## Screen Acceptance Report

人工宽屏桌面验收项目与通过条件见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U07-screen-acceptance-report]]。按用户指示跳过屏幕验收；需求单已交付，未声称人工验收通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime ReadModel | `npx vitest run tests/engine/gameplay-b-map-runtime-integration.test.ts` | AG-1 Preview/Receipt 序列 detached 完整；E1 兼容 |
| Workspace / Feed | `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-flow-adapter.test.ts` | 顺序、身份、目标、skip 与结果显示正确；E1 原文不变 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Implementation

- Runtime Preview 与 Recent Commit 对 Owner 序列做逐行深 detached 投影，保留 Owner 顺序和完整 CardRef scope；添加展示用 sourceId 与 Action 名称。
- AG-1 Preview Dock 与 Recent Commit Flow 均按序列显示来源、目标、skip、费用／Item 消耗和实际账本变化；CardRef 仅按 run/map/node/activity/round/id 全身份匹配当前 View 卡牌，历史不可解析时显示“卡牌目标”。
- PlayerCommand 使用无 source CardRef 标记并显示“指令”；敌方 Actor 资源从 enemyId 读取名称。AG-1 序列缺失或为空时均不从旧分组推导执行顺序；E1 路径保持旧文案。
- 未新增 wrapper 或交互控件。Dock 与 Talk Feed 使用原有 `commit-dock`、`talk-feed` 宿主及 `patchMapDOM()` 更新范围。

