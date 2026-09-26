# Execution Receipt：Task 0157 U03

日期：2026-09-26

## 结果

- `deriveDesiredMilestoneWatches` 现在读取 Listener、Area、`activeInit` 与 `visitedAreas`。关联 Listener 的 Milestone 只有在当前 Init 等于 Area 归属 Init 且 Area 已到访时才派生 Watch；缺少 Listener 的旧 Milestone 保持原派生路径。
- 未到访时，即使资源条件已满足，也不建立 Registration、不完成 Milestone。到访事实写入后显式调用 `reconcileCurrent()` 会准入 Watch，并按完整当前条件追赶完成。
- 测试覆盖未到访、不同 Init、到访后追赶，以及未关联旧 Milestone 的派生回归。Adapter 提交与撤出逻辑未改。

## 生命周期缺口

- Area 到访后即时调用 Milestone reconcile 仍未接入 InitService。本 Unit 只保证后续 reconcile 使用到访事实正确准入；下一 Unit 需要在 Area 到访事实写入之后接入一次 reconcile，覆盖默认 Area 与旅行进入 Area 的路径。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/milestone-adapter.test.ts --silent` | 通过；1 个文件、5 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 311 |

首次测试运行时，新增测试 Listener 缺少 U02 校验要求的 `then: []`，补齐测试夹具后重跑通过。
