# Receipt 0309-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（路由与 UI 会话；全项目类型检查受并行改动阻断） |
| 实际修改 | `workspace-router.ts` 新增 `map-entry` 路由和 route-only 保留；`app-shell.ts` 新增 UI-only 来源绑定；`controller.ts` 新增进入准备页、返回准备页及返回原游戏位置操作，现场返回时清理 MapFlow 并保留单层 returnTo。 |
| 未完成内容 | 渲染组件、设施入口与点击动作在后续 Unit；焦点恢复尚待页面接线。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 三个修改路径均经 `graph_health(check="changed")` 复核，owner 均完整读取；均为 content_changed / stale evidence。只读；未刷新或改图。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 未执行 | 未执行 | 本轮执行约束未要求运行测试；未修改测试文件。 |
| 全项目类型检查 | `npx tsc --noEmit` | 失败 | 路由自身错误已修复；余下 10 条错误仅在未修改的 `tests/data/area-map-registry.test.ts`，依赖尚不存在的 `Registry.validateAreaMapRefs` / `Registry.areaMaps`。 |
| 本 Unit 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，只以 `src/ui/controller/controller.ts`、`src/ui/workspace/workspace-router.ts` 为入口运行 `npx tsc --noEmit --project <temp-config>` | 通过 | 临时配置已清理；不包含测试文件。 |
| 差异检查 | `git --no-pager diff --check`（本 Unit 源码） | 通过 | |
| GALHCG | 上述三路径 changed 复核 | 完成 | 无维护授权，未写图。 |

## 遇到问题

- 全仓类型检查被并行 Area Map 变更留下的未完成测试阻断；未改动该工作。

## 需上游确认项

- 无；可在目标源码范围内完成独立类型检查后继续施工。

## 事实更新建议

- `WorkspaceNavigationState.current` 已可保存 route-only `map-entry`；MapRun↔entry 采用 replace，MapFlow 清理由 Controller 明确执行。
