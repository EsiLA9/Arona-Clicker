# Receipt 0309-U7

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（准备页局部刷新与来源失效恢复） |
| 实际修改 | 为准备页内容区、资源项、队员、主操作和滚动区增加 `patchMapDOM` 可识别的稳定 key；Controller 增加专属 `workspace.map-entry` region 更新，沿用当前 MapEntryView 重绘数据并保留滚动、有效焦点和展开的管理区；聊天门控及 Map 状态刷新改为定向 region 更新；全量渲染和局部刷新都会重验来源设施、当前 Area、utility reveal、functionality 与 condition，失效时回到原游戏位置且不改 Run。 |
| 未完成内容 | 本 Unit 完成时，行为测试／浏览器验收及机制与视觉文档由后续 Unit 承接；Schema 同步由 U12 完成。 |
| 范围外变更 | 无；未修改通用 `patchMapDOM`、MapRun、Schema 或测试。 |
| GALHCG 影响闭环 | `controller.ts` 为 content_changed / stale evidence；新页面组件与 CSS 为 unreferenced_path。只读 changed 复核，未刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 测试 | 未执行 | 未执行 | 本轮未要求测试；未改测试文件。 |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，以 `src/ui/controller.ts` 为入口运行 `npx tsc --noEmit --project <temp-config>` | 通过 | 临时配置已清理。 |
| 差异检查 | `git --no-pager diff --check`（U7 两个源文件） | 通过 | |
| GALHCG | 三路径 changed 只读复核 | 完成 | 未写图。 |

## 遇到问题

- 全项目类型检查仍受并行 Area Map 未完成测试阻断；本 Unit 源码入口类型检查通过。
- Schema 生成边界已由用户授权受控生成，并在 U12 完成。

## 需上游确认项

- 无；U12 已完成受控 Schema 同步。

## 事实更新建议

- MapEntry route 内的状态更新由 `workspace.map-entry` region host 局部协调；入口来源变为不可验证时，Controller 只恢复原日常路由，不清理仍有效的领域 Run。
