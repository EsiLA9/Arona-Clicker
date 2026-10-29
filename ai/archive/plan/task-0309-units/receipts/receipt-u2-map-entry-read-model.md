# Receipt 0309-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（Runtime 只读投影；行为测试待补） |
| 实际修改 | 新增 `contracts/map-entry.ts`；`MapRunQuery` 新增 `getEntryView(mapId)`；GameInstance 抽取共用队伍准入投影，并提供 fresh/resume/blocked/unavailable 结果；MapRun Owner 新增按绑定定义生成的 detached entry snapshot 与逐员 HP cap。 |
| 未完成内容 | 尚未给正式内容包添加 `entryInfo` 示例或 Schema 校验；准备页、入口、门控、点击开始/继续与返回流程未施工。行为回归测试未补。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 已逐路径运行 `graph_health(check="changed")`。`contracts/runtime.ts` 与 `runtime-game-instance.ts` 返回 content_changed / stale evidence；Owner 分页已读至 `owner_complete=true`。新 `contracts/map-entry.ts`、`contracts/map-run.ts` 与 `services/map-run-service.ts` 返回 unreferenced_path。均只读；未刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 本轮执行约束未要求运行测试；未新增测试文件。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | |
| 差异检查 | `git --no-pager diff --check`（U2 源码文件） | 通过 | |
| 人工验收 | `graph_read` 复读直接修改路径 | 完成 | Owner 使用创建 Run 时绑定的定义计算 cap，UI 不获得写入对象。 |
| GALHCG | 定向 changed 复核及 Owner 分页 | 完成 | 不含语义图维护。 |

## 遇到问题

- Schema 同步边界已由用户授权受控生成，并在 U12 完成；本 Unit 当时尚未触及该路径。
- Task 要求的准入 / 快照行为回归测试暂未添加。

## 需上游确认项

- 无；后续 U12 已完成受控 Schema 同步。

## 事实更新建议

- `MapRunService.getEntrySnapshot` 仅用 Owner slot 内绑定定义提供地图名、位置、活动摘要与每名冻结队员的 HP cap；其他地点同样可正确显示 cap。
