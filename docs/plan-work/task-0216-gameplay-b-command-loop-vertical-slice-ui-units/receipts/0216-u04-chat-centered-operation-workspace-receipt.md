# Receipt 0216-U4：聊天中心 Operation 工作区

## Outcome

已加入 AC 聊天风格的 Operation 工作区。中心列承载场景叙述、学生计划、对手/设施 Intent、结算记录与提交区；地点和设施风险放在较窄的左侧栏。新增只读 `OperationViewQuery` 到 `GameReadModel`，UI 只按 route 的 `runId` 请求脱离 Runtime owner 的 OperationView。

## Interaction and Layout

- `center-right` 工作区按 `.78fr / 2.22fr` 分配两列；中心聊天列约占可用工作区宽度 74%。
- 复用 AC 的头像、聊天名称、气泡、浅蓝面板与主题 token；不引入暗色 dashboard 或全局 token。
- 主日志流使用独立稳定滚动节点，Commit dock 留在滚动流外；地点侧栏包含轨道值、试玩阈值、回合与干预余量。
- 计划卡明确区分自动计划与当前修订；候选按钮输出稳定 actor/action/target data 属性，命令事件绑定留给 U5。
- null/stale Run 显示明确的不可用状态，说明需回夏莱办公室重新开始并持有、解锁星野、芹香、白子。
- 文案只来自 U2 carousel presentation catalog 与有限的 Runtime reason 文案表；不读取 EventRun、Resolver、registry 定义或随机测量。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/operation-workspace-view.test.ts --silent` | 通过，4 tests |
| `npx tsc --noEmit` | 通过 |
| `npm run check:architecture` | 通过 |
| `npm run check:docs` | 通过，639 Markdown、0 errors |
| `git diff --check` | 通过；提示来自工作树其他文件的 CRLF 转换 |

## Follow-up

- 本 Unit 只实现视图结构与候选呈现。Operation 入口、无效 admission 的即时反馈、点击选择、Commit、结果后的流内刷新与 scroll/focus 连续性由 U5 接线。
- 1280×720 的真实桌面浏览器检查由 U6 完成；此处按 CSS 网格比例验算中心列宽度。
