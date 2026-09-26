# Execution Receipt：Task 0157 U08

日期：2026-09-26

## 结果

- `GameReadModel` 增加只读 `getAchievementView()`，返回 U07 的 `AchievementViewItem` 列表类型；接口只通过 `import type` 依赖投影。
- `GameInstance.getAchievementView()` 每次调用都从当前 Registry、私有 PlayerState 与 `StatsService.getSnapshot()` 构建新投影，不缓存列表，也不暴露写引用。
- 定向运行时测试通过 `GameReadModel` 类型调用该方法，验证当前到访目标展示、资源条件完成后更新完成状态、统计快照改变后进度更新，以及连续调用返回新的结果对象。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/achievement-view.test.ts` | 通过；1 个文件、3 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:architecture` | 通过；Engine 与 Data Services 无违规外向依赖 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 321 |

## 限制

- 本 Unit 仅暴露只读 Runtime 查询方法；不接入 UI 组件或刷新事件。
