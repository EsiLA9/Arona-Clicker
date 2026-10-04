# Unit 0216-U4：聊天中心 Operation 工作区

## Goal

将 OperationView 呈现为 AC 聊天风格的主要中心内容；提供简洁目标/轨道侧栏、学生计划、敌方 Intent、干预选择和 Commit 控件。

## Must Read / Read Set

- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/ai/frontend-design-project-overlay.md`
- `docs/docs-829/06-wiki/50-ui/read-model-context.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `src/ui/workspace/workspace-renderer.ts`
- `src/ui/components/center-panel.ts`
- `src/ui/components/workspace-frame.ts`
- 当前 AC CSS theme tokens：`src/ui/css/variables.css`、`chat.css`、`layout.css`
- `src/arona-clicker/contracts/operation-view.ts`（U1）

## Confirmed Facts

- 现有 Workspace Frame 支持 center/right 双栏宿主；AC 主界面主题以蓝/青 token、浅色面板和既有字体为主。
- UI 组件使用只读 context，不持有 Operation owner；behavior / region / structure 刷新等级按 Overlay 协议。
- Operation Surface 由 U3 提供，静态样例展示文案由 U2 的样例定义提供。

## DOM Budget 与连续性

- 新增 wrapper：仅 Operation 主体语义容器与目标侧栏（复用宿主已有结构）；不得按每条消息新增纯装饰容器。
- 稳定节点：Workspace shell、主滚动流、目标侧栏、Action rows、Commit dock。
- behavior：选中候选、显示可改/阻塞理由、计数与危险提示色阶。
- region：Commit 结果日志或随 Beat 变化的行动/Intent 内容组。
- structure：仅 route 进入/退出或主列/侧栏语义发生变化。
- scroll：提交新消息前记录主日志 `scrollTop`，若原先在底部则跟随底部，否则保持锚点阅读位置。
- focus：命令完成后回到触发控件或明确的新状态摘要；route 返回由 U3 的导航状态处理。
- hover：CSS-only 提示；region 替换前清理该 region 内 detached tooltip。
- full render：仅 Operation Surface 首次挂载/卸载；干预、hover、普通 scroll 均不触发。

## Allowed Files

- `src/ui/workspace/workspace-renderer.ts`
- src/ui/components/operation-workspace.ts (new file)
- src/ui/css/operation-workspace.css (new file)
- `src/ui/main.ts`
- tests/ui/operation-workspace-view.test.ts (new file)
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u04-chat-centered-operation-workspace-receipt.md`

## Constraints

- 1280×720 时中心聊天列不少于可用宽度 60%；聊天日志和行动决策占视觉主轴，目标/风险侧栏收窄。
- 延续 AC 主题 token 与既有 Chat flow；设施风险/制动可作为主题签名，不引入泛暗色 dashboard。
- 不读取 raw definitions/rules；所有候选由 OperationView 提供，文本仅来自样例静态展示 catalog。
- 首屏须说明三名学生需要真实解锁/拥有；admission 失败如实展示。

## Explicit Non-goals

- 不提供命令执行/Controller 接线、事件入口及浏览器验收。
- 不制作全局 UI 改版或全局导航。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。视觉需要依赖新全局 wrapper/theme token 时先缩小方案或调整 Unit。

## Completion Criteria

- [ ] 同屏可读当前地点、track、学生准备行动、对手/环境 Intent、干预余量、Commit 状态。
- [ ] 当前计划与修订计划的差异、不能改的理由、危险轨道影响清楚。
- [ ] 日志与主要决策位于中心对话流；侧栏不能挤占其 60% 最小宽度。
- [ ] 组件测试验证安全文本、缺失 admission、等待/已结算状态以及无 raw rule leak。

## Verification

- `npx vitest run tests/ui/operation-workspace-view.test.ts`
- `npx tsc --noEmit`
- 1280×720 桌面浏览器检查由 U6 完成。
