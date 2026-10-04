# Task Receipt 0216：Gameplay B 核心可玩切片与只读 UI

## Outcome

已完成 U1–U6：以 `base:init:schale_office` 为试玩入口完成 OperationView 窄读投影、固定 Seed 17 的旋转木马事件、独立 Workspace route、聊天式 Operation Surface、Controller 命令与局部刷新、体验验收和机制文档维护。

## Delivered Behavior

- 夏莱办公室聊天流提供游乐园设施安全试玩入口。普通路径要求真实持有并解锁星野、芹香、白子；准入失败不补发角色。试玩结束入口显示“查看试玩结论”，Run 保留在当前 GameInstance 内存，不进入 SaveData。
- 玩家看到自动计划、行动费用、合法目标与阻塞理由，可在每 Beat 为一名学生修订 Action/Target、取消或提交。Runtime Resolution 驱动轨道、Actor 与日志；UI 在两 Beat 后本地判读成功/失败并禁用 Submit，不改 Runtime 正式 status / EventOutcome。
- OperationView 与 GameView 分离；读 facade 不泄露 EventRun / resolver / ActionDef。Controller 经私有 Runtime Entry 写 facade 发命令，并以一次 View 查询、一次 region update 局部收敛。
- DEV + 显式 `?devConsole=gameplay-b` 提供内存试玩控制台； allowlist 命令解析成功才通过 StateMutationService 写当前夏莱办公室内存。无任意代码执行、无自动 Run、无持久化。

## Browser Results

实际浏览器截图为 1412×811 px。中心行动列约占可用工作区 74%，超过 60% 验收线。手动固定 Seed 17 路线：无干预 `3→4→5` 失败；紧急停机 `3→1→2` 成功；再次紧急停机结果一致；游客疏导 `3→3→4` 失败。详细操作和 viewport 限制见 `0216-u06-ux-documentation-and-galhcg-receipt.md`。

## Receipts

- U1–U5 receipts 已随各 Patch Unit 完成。
- U6 receipt：`0216-u06-ux-documentation-and-galhcg-receipt.md`。

## Verification

| 验证 | 结果 |
| --- | --- |
| U1–U5 定向 Runtime / UI Vitest、类型检查、架构检查 | 各 Unit Receipt 记录通过 |
| U6 targeted Vitest | 6 files / 37 tests passed |
| `npx tsc --noEmit`、`npm run check:architecture` | passed |
| `npm run ui:callgraph` | passed；116 files、3544 reliable edges、268 DOM writes |
| `npm run check:docs`、`git diff --check` | passed；最终文档计数与 diff 结果见 U6 receipt |
| 浏览器走查 | 3 路线、2 种结论、同 seed 重复；通过，浏览器实际截图 1412×811 px |
| GALHCG | Operation Runtime、UI Workspace、Controller/Runtime、Test Harness 及游戏 UI 路径更新完成；所更新节点和关系 freshness 均完整 fresh |

## Scope Boundary

本 Task 不实现正式 Event Objective/Outcome、路线、保存/恢复、玩家卡组或 PlayerCost；后续由 0217/0218 及 0224/0225 承接。Task 0215 是否归档仍待 Task Owner 独立确认。
