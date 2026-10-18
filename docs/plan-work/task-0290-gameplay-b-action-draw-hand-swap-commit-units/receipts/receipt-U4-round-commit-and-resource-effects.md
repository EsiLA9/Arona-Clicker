# Receipt 0290-U4：整轮 Commit 与 Actor / Team resource 效果

**结果：实现完成；修复 checkpoint 边界后独立只读复核通过。**

## 修改内容

- `MapRunService` 现在提供唯一的整队 Encounter Commit。命令绑定 `runId`、`requestId`、MapRun `commitVersion` 和 U3 `{nodeId, round, draftVersion}` 草稿 token；自然行动、Swap 与 PlayerCommand 都经同一管线结算。
- Commit 按固定队伍顺序校验全员 Prepared Action 与目标。全队 PlayerCost、Actor / Team costs 先按 Commit 开始余额联合核验并支付，随后再按固定队伍顺序应用 Actor / Team Effects；本轮效果不能替本轮任一成本出资。
- 任何失效 Action、未选目标、过期版本、成本不足、余额负值 / 溢出、非法资源引用或下一轮抽牌错误，均在 Owner 安装前失败，不改变 PlayerCost、Actor / Team resource、Commit version、receipt、round、Hand 或 RNG。
- 成功后一次安装新余额、`commitVersion + 1`、Encounter round、下一 Hand / RNG continuation 和 `lastCommit`。全 Wait 可提交为无效果回合。
- `requestId` 重试在 Save / Load 后读取已有 receipt 并返回当前快照，不重复扣费、应用效果或抽牌。Encounter 内只留最近一次 `lastCommit` 并在遭遇结束时清理；单调 `commitVersion` 和 MapRun-local 资源跨 Encounter 保留。
- `GameCommands` 通过 Runtime GameInstance 的窄转发调用私有 MapRun Owner；`MapRunQuery` 仍是只读接口。
- Restore 对 `lastCommit` 重新校验全队成员、行动、目标和资源变化；拒绝多个 Override 或超过 1 点 PlayerCost 的伪造 receipt，不安装不合法 Run。

## 验证

- 定向 Vitest：MapRun、Save / Resume、Runtime Integration 三组合计 **38/38** 通过。
- `npx tsc --noEmit` 通过。
- 授权文件 `git diff --check` 通过；新增源码 / 测试文件单独空白核验无诊断。
- 独立只读复核通过；复核者未改文件、未运行测试。复核指出的伪造 receipt 阻塞和 Action Draw 后失效的测试缺口已修复，并再次复核通过。

## 行为证据

- 真实 MapRun 测试证明所选目标 Action 产生 team resource 增加和目标 Actor resource 改变，并在回执里记录具体行动、目标、费用与效果。
- 共享 Team costs 合计超过 Commit 开始余额时整轮拒绝，即使后续 Action 有资源补充效果也不能支付本轮成本。
- Swap 不花 PlayerCost，PlayerCommand 只花 1；无目标、余额不足、正向溢出和负向欠额均无部分写入。
- 同请求经 checkpoint 恢复后重试不重复结算；完成 Encounter 后清掉 Encounter-local receipt，同时保留 MapRun 余额和提交版本。

## 边界

- U4 不实现 HP、Enemy、Ability、Item 或败北；C4 将扩展同一 Commit 管线。
- U4 不接 Workspace 行为 UI；U5 负责正式 Preview、命令与界面接线。
