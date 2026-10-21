# Receipt 0309-U6

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（准备页重开 / 放弃；Map route 旧放弃语义保留） |
| 实际修改 | Resume 页面新增折叠的“地图管理”区；现有重开 / 放弃确认可在 route `map-entry` 上运行，打开与确认时都重核 Run / Map / source / gate；重开成功后进入新 Run 的现场；准备页放弃成功后留在同图 fresh 准备页，不自动开局；地图现场放弃仍回原游戏位置；取消恢复对应管理按钮焦点。 |
| 未完成内容 | MapEntry 内资源 / 队伍 / 进度值的逐区刷新、来源失效的主动恢复提示，以及机制 / 风格文档仍待后续 Unit。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | `controller-actions-operation.ts`、`map-entry-workspace.ts` 与其 CSS 均经 `graph_health(check="changed")` 复核；前者 content_changed / stale evidence，后两条 unreferenced_path。只读；未刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 测试 | 未执行 | 未执行 | 本轮施工指令未要求运行测试；未修改测试文件。 |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，以本 Unit UI 文件为入口运行 `npx tsc --noEmit --project <temp-config>` | 通过 | 临时配置已清理。 |
| 差异检查 | `git --no-pager diff --check`（U6 文件） | 通过 | |
| GALHCG | 三路径 changed 只读复核 | 完成 | 无维护授权，未写图。 |

## 遇到问题

- 全项目类型检查仍受并行 Area Map 未完成测试阻断；U6 文件入口类型检查通过。
- Datapack Schema 同步的 `AGENTS.md` 禁改边界仍未解决。

## 需上游确认项

- 生成 Schema 是否可由受控生成命令更新，或将同步验收从本 Task 移出。

## 事实更新建议

- `getActiveMapRunForRoute` 现在仅在 `map-entry` 当前 mapId、活动 runId、有效 source 与前台 gate 同时匹配时允许管理操作；Owner 命令和 MapRun 数据形状未改变。
