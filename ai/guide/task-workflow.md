# Task 工作流

Task 是 Agent 恢复工作所需的入口：说明目标、完成条件、当前进展和下一步。只为需要跨会话跟踪、协作或交接的工作建 Task；普通小需求直接处理。默认模板见 [[ai/guide/templates/execution-task]]。

## 创建与协作

```powershell
npm run task -- newTask <slug> <标题>
npm run task -- newSubtask <task-id> <范围> <负责人>
npm run task -- archive <task-id>
```

`newTask` 创建基础模板并登记 `ai/plan/00-index.md`；编号扫描活动 Task 与 `ai/archive/history.zip`，递增且不复用。`newSubtask` 只在确有独立分工时使用：它在父 Task 的 `SubTasks` 表追加 ID、范围、负责人和状态，不会自动派发 Agent。执行者更新该表的状态；完成后才在 `SubOutcomes` 添加实际结果、证据和问题。没有分工时不创建这两个章节。

按任务需要添加文件清单、事实与决定、验证细节或 FinalOutline。不要为预想中的可能性预建空章节，也不要在多个位置重复负责人、状态、结果或证据：Task 维护整体状态和下一步，SubTasks 维护分工状态，SubOutcome 维护子任务交付，FinalOutline 仅负责需要整合时的最终结论。

## 执行与记录

- 按 [[ai/guide/task-read-set-routing]] 选择必要资料；已知领域直接走 [[AGENTS]] 对应入口，不通读无关文档。
- 在 Task 的“当前进展”中只维护已完成事项、正在进行事项和下一步。执行范围、验证和结论按实际需要补充；未运行的检查明确写未运行。
- 只在决定影响后续工作时记录事实与决定。来源冲突或未裁定问题以证据和待决项记录，不把猜测写成事实。
- SubTask 应有独立交付边界。主 Agent 回收实际 SubOutcome，检查相互影响；需要综合判断时再写 FinalOutline，不复制各 SubOutcome。

## 完成与归档

更新 Task 头部状态及当前进展。Task 和 SubTasks 均结束后运行 `npm run task -- archive task-编号`；命令归档 Task 并从活动索引移除。配套资料另用 `npm run archive:docs -- add <路径>`。归档后检查旧引用；操作细节见 [[ai/archive/README]]。

## 相关入口

- [[AGENTS]]：项目任务入口与稳定约束。
- [[ai/guide/templates/execution-task]]：最小 Task 模板。
- [[ai/guide/task-read-set-routing]]：按需选择资料和验证入口。
- [[ai/guide/conventions/testing]]：测试分级。
