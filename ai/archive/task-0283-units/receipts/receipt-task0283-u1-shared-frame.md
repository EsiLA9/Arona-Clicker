# Receipt task0283-U1：共享内容布局

实现：从WorkspaceFrame抽出renderWorkspaceLayout纯布局输出，原游戏Frame继续通过既有Presentation列组合。内容工具renderContentWorkspace真实复用几何并提供导航／条目／详情／可选操作插槽；pane-switch只选栏，不套游戏纵向折叠。工具没有新增游戏主题host。

验证：`npx vitest run --silent tests/ui/workspace-frame.test.ts` 13/13通过，覆盖原Frame组合及工具插槽、无多余footer/host。

限制：Editor迁入与草稿状态不在B范围；本次实际使用方为图鉴。最终CSS窄适配由U2验证，最终静态／浏览器结果见父Task。
