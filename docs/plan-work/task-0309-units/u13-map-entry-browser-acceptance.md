# Unit 0309-U13：MapEntry 桌面浏览器主流程验收

## Goal

用桌面浏览器检查正式 Gameplay B 内容在 MapEntry 中的 fresh、受伤续行、管理操作和终局主路径；记录视觉结果与仍缺的组合。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` 的浏览器验收项 | 明确主路径与缺项 |
| 风格 | `ui-style/patterns.md` 的 MapEntry 行 | 让视觉验收状态准确 |
| 组件 | `src/ui/components/map/map-entry-workspace.ts` | 核对页面语义、HP、资源与按钮 |
| UI 回归 | `tests/ui/gameplay-b-basic-map-p0-p3.test.ts` | 对照领域行为与浏览器路径 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 首次主路径在当前源码和正式内容上使用内存验收场景；读档验收在专用 `127.0.0.1:5174` Origin 使用真实存档管理界面保存／刷新／恢复 | `src/ui/components/map/map-entry-workspace.ts`、`src/ui/controller/controller-actions-operation.ts`；本次浏览器现场 | 原有游戏 Origin 不变；验收 MapRun 存档已重置，空白 Lobby 存档仅属于隔离 Origin |
| fresh 页显示作者简介／提示、初始队伍 HP/cap 与局内资源；重返页显示当前地点、当前 HP/cap 与资源 | 本次桌面浏览器页面 | 固定队伍为 Shiroko / Serika |
| 真实遭遇战一轮使 Shiroko 从 10/10 变为 8/10；返回准备页后仍为 8/10，继续返回相同 Map / Encounter 第 2 轮 | 本次桌面浏览器页面 | 未出现 HP 恢复 |
| 取消重开保持准备页进度；确认重开回起点；战斗完成后到达出口终局页并返回日常 Game | 本次桌面浏览器页面 | 浏览器主路径已验收 |
| 缺员时主按钮禁用并显示准入问题；Story 活跃时设施入口禁用；放弃确认取消后仍显示同一 resume Run，确认后回 fresh | 本次桌面浏览器页面 | 三项门控／管理分支已补验 |
| 刷新恢复后从地图终端重入，准备页与继续后的现场保留同一进度 | 本次隔离 Origin 浏览器页面 | 第 2 轮、Shiroko 8/10、Serika 10/10、focus 及 clues 均恢复，敌人剩余 HP 8/12 |

## Constraints

- 使用临时 Vite 页面和隔离 Origin；允许在该 Origin 写入本 Unit 的读档验收存档，不触及用户原游戏 Origin。
- 交互通过实际渲染的 MapEntry / Map Workspace 控件完成；初始数据准备不替代交互验收。
- 不把自动化结果描述为已在浏览器逐项验证。

## Allowed Files

- `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md`
- `ui-style/patterns.md`
- `docs/plan-work/task-0309-units/receipts/receipt-u9-map-entry-behavior-regressions.md`

## Explicit Non-goals

- 不改产品源码、测试或 Schema。

## Completion Criteria

- [x] 完成有效固定队伍 fresh 页面与显式开始的浏览器验收。
- [x] 完成实际受伤后返回准备页、显示当前 HP/cap 并继续同一局的浏览器验收。
- [x] 完成重开取消／确认、战斗终局和返回日常 Game 的浏览器验收。
- [x] 完成缺员／Story 忙碌门控及放弃取消／确认浏览器验收。
- [x] 完成保存、刷新、从设施重入及继续原局的浏览器读档验收。
- [x] 审查 Map 缺失、内容变更／版本不符与活动 Run 绑定定义的恢复边界。
- [x] 更新风格／Task / Receipt 记录，不夸大未验收的浏览器组合。

## Verification

| 项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 桌面浏览器 | 本地 Vite + 临时 in-memory Runtime；按实际 Workspace 控件交互 | 通过，结果记录于 Receipt |
| 临时文件清理 | 移除临时 QA HTML 与 TypeScript 启动脚本，关闭临时 IAB tabs | 通过 |
