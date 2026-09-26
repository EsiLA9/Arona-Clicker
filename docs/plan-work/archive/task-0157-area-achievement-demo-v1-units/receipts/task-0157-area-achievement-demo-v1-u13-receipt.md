# Execution Receipt：Task 0157 U13

日期：2026-09-26

## 结果

- Domain 导出只读 `firstUnsupportedMilestoneLeaf`，逐叶复用原有 `sourceOf` capability 判定，返回首个不支持叶的 target、key、comparator；没有新增第二份支持条件清单。
- Adapter 只检查当前 Init 中已到访 Area、未完成且有关联 Listener 的目标。记录 source=`milestone`、level=`error` 的诊断，包含 Milestone、Listener、Area ID 和首个不支持叶。
- 按 Milestone ID 与 Listener/Area/完整 Condition 的定义描述去重：重复对账不重复记录；定义改变后生成新诊断。支持目标继续建立 Watch 并能完成；旧无 Listener、未到访、异 Init 和已完成目标不产生诊断。
- 诊断测试用独立、无剧情锁的 Init/Area 数据包构造状态，通过 `startNewGame`、`travelToArea` 和 `StateMutationService` 公开入口建立访问与完成事实；没有直接写入该用例的 `game.state`。测试覆盖未访问、已完成、重复对账、定义更新、首个不支持叶、旧目标及支持目标。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/milestone-adapter.test.ts` | 通过；1 个文件、10 项测试通过（完成测试夹具修正后重跑） |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 332 |

## 范围

- 仅修改 Domain、Adapter、定向测试并新增本 Receipt；未扩展支持的 Condition、Registry、Effect、UI 或示范包。复核后将诊断测试的状态构造改为正式旅行与 mutation 入口，未绕过剧情锁或改生产代码。
