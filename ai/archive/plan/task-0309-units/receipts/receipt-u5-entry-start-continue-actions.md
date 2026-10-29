# Receipt 0309-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（入口 / 开始 / 继续 / 返回准备页）；重开、放弃及逐区刷新待后续 Unit |
| 实际修改 | `map-entry.ts` 的 Spot 按钮改为只打开准备页，并允许其他 MapRun 存在时查看 blocked 页面；Controller action 重验来源设施 / functionality / condition、route、Story 与 modal gate；`MapEntryView` 主按钮只在 fresh 显式 start、resume 只 replace 到相同 runId；增加同步提交锁；准备页本地禁用失效入口并显示原因；活动 Map Workspace 返回按钮改为“返回准备页”；准备页返回原游戏后恢复来源入口焦点。 |
| 未完成内容 | 重开 / 放弃确认需支持 MapEntry 路由来源；准备页的局部资源 / 队伍更新与页面内容来源失效刷新待后续 Unit。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 五条直接路径已经 `graph_health(check="changed")` 只读复核；新 MapEntry / Spot / Map Workspace components 为 unreferenced_path；app-shell / Controller actions 为 content_changed / stale evidence，owner 完整。未刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 测试 | 未执行 | 未执行 | 本轮施工指令未要求运行测试；未修改测试文件。 |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，本 Unit 源码为入口运行 `npx tsc --noEmit --project <temp-config>` | 通过 | 临时配置已清理。 |
| 差异检查 | `git --no-pager diff --check`（U5 文件） | 通过 | Git 对 `map-workspace.ts` 显示 CRLF 转 LF 提示，不是差异检查失败。 |
| 人工验收 | `graph_read` 复读入口、gate、开始 / 续行与返回处理 | 完成 | 只读模式下开始唯一调用 `startMap`；继续没有 Run 写命令。 |
| GALHCG | 上述五路径 changed 复核 | 完成 | 无维护授权，未写图。 |

## 遇到问题

- 全项目类型检查仍被既有未完成的 `tests/data/area-map-registry.test.ts` 阻断；U5 自身源码入口的类型检查通过。
- Schema 生成边界已由用户授权受控生成，并在 U12 完成。

## 需上游确认项

- 无；U12 已完成受控 Schema 同步与测试。

## 事实更新建议

- 设施 MapEntry 点击现在只进入 route-only 准备页；GameInstance 的 `startMap` 仅从 fresh 页的显式主操作调用，same-run resume 仅更换 route。
