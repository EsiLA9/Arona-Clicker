# Receipt 0309-U11

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（当前 Area 改变时恢复入口来源路由） |
| 实际修改 | 用 UI 入口创建活动 Run、返回准备页，再通过 `travelToArea` 切换离开来源 Area；断言 controller 回到原 `game` route，MapEntry workspace 消失，active Run 快照逐字段保留。 |
| 未完成内容 | 无；来源 functionality 删除的回归由 U9 补齐，Map 内容与读档恢复边界由 U13 完成审查／浏览器验收，Schema 同步由 U12 完成。 |
| 范围外变更 | 无；仅修改本 Unit Allowed File 中的 UI 回归。 |
| GALHCG 影响闭环 | 测试文件为 `unreferenced_path`，只读 changed 复核；不刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 相关 UI 回归 | `npx vitest run tests/ui/gameplay-b-basic-map-p0-p3.test.ts` | 通过 | 8 项通过，包含本次 Area 来源失效回归。 |
| 项目类型检查 | `npx tsc --noEmit` | 通过 | 最终全量复验通过。 |
| 差异检查 | `git --no-pager diff --check`（U11 测试） | 通过 | |

## 遇到问题

- 当前桌面浏览器验收已覆盖有效固定队伍、缺员／Story 门控、受伤续行、重开与放弃管理、终局返回；读档仍由自动化覆盖，Map 内容不可用边缘组合待审查。
- 用户已授权受控生成 Schema；Schema 同步由 U12 完成。

## 需上游确认项

- 无；Schema 同步由 U12 完成。

## 事实更新建议

- 当入口 Spot 不再属于当前 Area 时，Controller 只恢复原日常路由，不 abandon 仍活动的 MapRun。
