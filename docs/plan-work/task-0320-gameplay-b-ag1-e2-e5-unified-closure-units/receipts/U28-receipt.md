# Task 0320-U28 实施回执

状态：实现与自动化验证完成；屏幕验收需求单已交付，未记录人工通过。

## 实施结果

- `GameplayMapEdgeConditionDef` 保留原 `teamResourceAtLeast`，新增与 Candidate Pool gate 同形的 Counter 比较及 Flag 等值条件。Registry 校验 AG-1 合同、Fact ID、类型、比较符、值域和精确字段集合。
- 新增纯只读 Edge 判定服务。`MapRunService.move` 和 `GameInstance` 的 Map Workspace Edge 投影共用该服务，始终读取当前已安装 MapRun Facts；未满足时 UI 不可选，Owner 拒绝移动。
- Flow 复用已有地点卡状态与不可用原因字段，不新增 DOM 节点；文案明确显示地图计数／标记 ID 及当前满足状态。既有 Team 资源门槛文案保持原样。
- 正式 `gameplay-b:map:fact-gated-pool-example` 同时展示候选池入场快照和路线当前值判定；因新增路线规则，`resumeVersion` 从 6 提升至 7。Edge gate 不新增 Receipt、Save 或 MapRun 状态字段。
- 同步作者数据契约、U15 候选池示例说明、Draft 0312 路由、Task 0320 和计划索引。

## 验证

| 检查 | 结果 |
| --- | --- |
| Registry、Fact-gated MapRun、Flow Adapter、Schema sync | 4 个测试文件，241/241 通过 |
| Schema 生成 | `npm run gen:schema` 完成 |
| TypeScript | `npx tsc --noEmit --pretty false` 通过 |
| 架构边界 | `npm run check:architecture` 通过 |
| 文档 | `npm run check:docs` 扫描 1303 篇，0 errors |
| 差异 | `git diff --check` 无空白错误；环境仅报告工作树已有 CRLF/LF 规范化提示 |

## 项目地图只读核对

已按项目身份入口核对 `acprogram`。本单涉及的 Edge 判定服务与 MapRun Service 在 GALHCG changed-scope 查询中均返回 `unreferenced_path: no direct Evidence/maps_to`；此结果仅表示没有直接证据映射，不等价于实现缺陷。按项目边界未编辑图、未刷新或写 freshness。

## 屏幕验收

未进行人工屏幕验收；操作与预期结果见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U28-screen-acceptance-report]]。该记录单不表示人工通过。
