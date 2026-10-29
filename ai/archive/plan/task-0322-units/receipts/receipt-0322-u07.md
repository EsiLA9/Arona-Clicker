# Unit 0322-U7 Receipt：新节点播放器边界回归

状态：complete

## 交付

- 新增 `tests/engine/story-node-player.boundaries.test.ts`，以有状态的本地Host验证多正文input阶段、预检拒绝保留原票据、32/33次转移、256/257自动节点、insert尾部completion身份、输入文档与返回视图隔离，以及start/ack自动执行Operation时同步cancel的false `Cancelled` 回执。
- 新增本Unit边界、白名单、非目标与停止条件；仅改上述测试和两份U7规划/Receipt文档，没有改生产源码或Task §13。

## 验证

- `npx vitest run tests/engine/story-node-player.boundaries.test.ts`：通过，1个文件、8/8用例。
- `npx tsc --noEmit`：通过。
- `git diff --check`：针对U7测试、Task与Receipt三文件通过；主Agent仍需执行工作区最终联合diff检查。

## 边界

这些Player测试Host用累加器确实记录并应用状态动作，但不是GameInstance领域集成测试；真实服务的纵向接线由U6验证。此Unit不证明UI、旧StoryService、奖励、日志或存档接线。
