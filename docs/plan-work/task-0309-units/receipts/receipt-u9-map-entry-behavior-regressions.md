# Receipt 0309-U9

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（入口、只读投影、连续性与管理操作回归） |
| 实际修改 | 现有 UI 用例改为设施入口打开准备页、fresh 显式开始及 resume 显式继续；增加 Story 忙碌入口阻断、准备页无 Run、来源返回 / 同 runId 与快照保持、受伤后续行读取当前 HP/cap、来源 Area / functionality 失效安全返回、重开／放弃确认取消与成功回归；MapRun Runtime 集成增加 fresh / resume / other Run blocked / missing Map 只读投影断言。旧 Map 地点流操作改用当前选择卡与确认按钮。另将既有 Map Workspace 目标角色断言改为遵循只读关系投影：默认已选目标显示“接收”，其余合法目标显示“候选”。 |
| 未完成内容 | 无；后续 U13 完成刷新读档浏览器验收，Map 内容卸载／变更边界经 U13 源码审查。 |
| 范围外变更 | 无；既有 Map Workspace 用例已先加入 Unit 的窄 Allowed File 范围，未改生产逻辑或 Area Map 测试。 |
| GALHCG 影响闭环 | 测试文件无直接 Evidence / maps_to 关联；不刷新、改图或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 / 领域回归 | `npx vitest run`：`gameplay-b-map-vertical-slice.test.ts`、`gameplay-b-map-workspace.test.ts`、`gameplay-b-basic-map-p0-p3.test.ts`、`workspace-router.test.ts`、`workspace-lifecycle.test.ts`、`gameplay-b-map-runtime-integration.test.ts`、`gameplay-b-map-run.test.ts` | 通过 | 7 文件，118 tests passed。 |
| 全项目类型检查 | `npx tsc --noEmit` | 通过 | |
| 架构边界检查 | `npm run check:architecture` | 通过 | |
| 文档检查 | `npm run check:docs` | 失败 | 当前 8 项均为旧 Operation 文档的失效源码路径；并行 Task 0310 重名已清理。0309 Unit / Receipt 重名已改用 `receipt-` 前缀消除。 |
| 差异检查 | `git --no-pager diff --check`（U9 Allowed Files） | 通过 | |

## 遇到问题

- 用户已授权 Schema 受控生成；同步与 Editor Schema 测试由 U12 完成。
- `npm run check:docs` 因既有 Operation 文档中的失效源码路径失败；并行 Task 0310 重名已清理，未修改这些范围外文档。

## 需上游确认项

- 无；Schema 同步由 U12 完成。

## 事实更新建议

- MapEntry 的领域查询本身可证明不写 MapRun / GameState；地图初始化只有准备页显式主操作可创建 Run。

## 桌面浏览器补充验收（U13）

- 使用本地 Vite 与临时 in-memory Runtime，加载 base 和正式 Gameplay B Map Datapack；Shiroko / Serika 与地图终端只在内存中为验收准备，没有写入存档。
- 实际点击有效队伍 fresh 页“开始地图”，进入遭遇后提交一轮使 Shiroko HP 10→8；“返回准备页”仍显示 8/10 和第 2 轮进度，再“继续地图”后现场仍是第 2 轮且 HP 为 8/10。
- 在续行页取消重开后进度未变；确认重开回起点、HP 回定义初值；完成战斗后终局页显示出口结果，返回日常 Game。
- U13 随后补充缺员、Story 门控、放弃取消／确认与刷新读档浏览器验收；同一活动 Run 在刷新后从设施重入仍恢复 HP、轮次、资源并继续原遭遇。Map 缺失／版本不符的拒绝路径经源码审查；临时浏览器资源已清理。
