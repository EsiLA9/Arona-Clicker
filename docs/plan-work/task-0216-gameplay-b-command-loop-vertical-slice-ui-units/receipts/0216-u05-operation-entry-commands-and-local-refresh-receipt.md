# Receipt 0216-U5：Operation 入口、命令与局部刷新

## Outcome

已在夏莱办公室聊天流加入游乐园试玩入口。无进行中的 Run 时入口创建样例；离开 Operation 后入口显示继续/查看结论，不重复准入或覆盖当前 Run。样例仍要求真实持有并解锁星野、芹香、白子；准入失败作为聊天系统消息呈现，不修改玩家角色状态。

## Commands and Continuity

- Operation action、target、clear 和 commit 按钮携带 `runId` / `planVersion`；Controller 只通过 `operationEntry` 窄 facade 调用。
- 每个已挂载 Operation 命令只读取一次新 `OperationView`，发出一次 `workspace.operation` region update；启动/继续和返回属于 route 结构更新。
- keyed DOM morph 保留 Workspace frame、主日志流、学生卡、行动按钮与 Commit dock。滚动记录贴底状态；仅在原先贴底时跟随新增 resolution。焦点返回触发按钮，按钮消失时落到同学生可用行动或状态摘要。
- Commit 展示 Runtime Resolution。达到两回合后 UI 停止继续提交并以设施危险阈值给出“安全处置 / 处置失败”；样例 Runtime 的正式 `status` 仍为 `inProgress`。
- admission / stale plan / 资源与目标错误转成玩家可读提示，不泄露内部诊断 ID。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/workspace-router.test.ts tests/ui/operation-workspace-view.test.ts --silent` | 通过，17 tests |
| `npx tsc --noEmit` | 通过 |
| `npm run ui:callgraph` | 通过；115 files、3533 reliable edges、257 DOM writes |
| `npm run check:architecture` | 通过 |
| `npm run check:docs` | 通过；640 Markdown、0 errors |
| `git diff --check` | 通过；有工作树既有 CRLF 转换提示 |

## Follow-up

- U6 负责 1280×720 浏览器检查、最终 UX 文档和 GALHCG 映射维护。
- 本地试玩结果只存在 UI 判读；本 Unit 未新增 formal Outcome、存档状态或 PlayerState 字段。
