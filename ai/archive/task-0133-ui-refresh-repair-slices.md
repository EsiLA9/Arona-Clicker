# Task 0133 — UI 刷新与交互连续性修复切片

## 状态

已完成。本文依据 `task-0132-ui-refresh-and-structural-density-audit`，按多 agent 审计结果拆分并串行完成 UI 刷新与交互连续性修复；不包含其他 build 类型任务。

## 协作与验收协议

- 每个切片只负责一个明确刷新入口或交互连续性问题。
- 刷新层级按 `behavior → element → region → workspace → app` 判断，优先保持 Host、焦点、滚动和 Popover 连续性。
- 每个切片补充回归测试，并通过 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`。
- 多 agent 只读调查可并行；代码修改按切片串行，保留其他 build 任务和既有未提交改动。

## 完成切片

| 切片 | 结果 | 主要证据 |
| --- | --- | --- |
| A-01 / A-03 Workspace | Inventory、Character、Contacts、Story、Settings、Datapack、Saves、Records 的单 Host 与多 Host 刷新改为 region 替换；保留根节点、焦点和滚动 | Workspace / Contacts / Story 回归通过 |
| A-02 RuntimeEditorBatch | World Draft 批次内抑制 Area 事件逐项刷新，成功/失败路径保留单次显式刷新 | `controller-events` 7/7 |
| A-04 RuntimeSpotIntent | Spot 批量 Apply 改为明确刷新 intent，只更新当前 Game 的可见 Spot 区域 | Runtime Editor / Workspace 回归通过 |
| A-03 Notification | 待落账奖励/移动通知从 app full render 收敛到聊天范围刷新 | Shop / chat 回归通过 |
| B-01～B-05 | Modal Escape、焦点恢复、Workspace 滚动、Surface generation、Popover 键盘生命周期 | 对应 UI 回归通过 |
| C-002 | 移除 Groups / Equipment 子渲染器重复 Codex eyebrow，保留独立统计信息 | Collection 结构测试通过 |
| C-003 | 通用 Tabs 与 Collection 补齐 `tablist`、`tab`、`aria-selected`、`aria-controls`、`tabpanel` | 语义结构测试通过 |
| C-004 | Story gate 补齐 dialog、ARIA 标题关联和初始焦点 | Story gate 回归通过 |

## 明确保留的 full fallback

- Workspace 路由在 Game / Service / 临时 Workspace 之间切换时，因 header、footer、返回上下文或根结构变化允许 full render。
- Runtime Editor 面板打开/关闭、编辑器上下文迁移和 Host 缺失时允许 full render；无法证明局部结构契约时不强行替换。
- 多 Host region 刷新要求请求集合和模板 Host 全部存在，否则回退原有 Workspace render。
- P3 的 Story overlay typography wrapper 和空态文案层级未纳入本轮 P1/P2 修复；C-005 仍为待验证假设。

## 最终核验

- `npm test`：188 个测试文件、1729 个测试通过。
- `npm run ui:callgraph -- --hot`：刷新调用链与 DOM 写入诊断完成。
- `npx tsc --noEmit`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：通过，257 份文档、0 错误。
- `git diff --check`：通过；既有 CRLF 警告不构成 diff 错误。

## 关联

- `task-0132-ui-refresh-and-structural-density-audit.md`
- `13-unified-workspace-refresh-boundaries.md`
