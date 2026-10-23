# U19 Receipt：按精确 Status ID 消费部分层数

状态：U19a–e 已实现并通过定向自动化、Schema、类型、架构、文档与差异检查。屏幕人工验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U19-screen-acceptance-report]]。

## 实现结果

- 新增 AG-1 `statusConsume`：对一个合法 `source`/`primary` 单位与精确 Map-local Status ID 消费 1–99 层；仅接受正整数常量。target/Status Registry 与 Schema 同步，E1/legacy 路径不变。
- Planner 按最早到期实例优先；同到期时间使用既有稳定 Status 顺序。请求不足时尽量消费，无匹配为成功 no-op；Trace 保留请求量、消费量、缺额、原列表位置和每个 Status 实例完整变化。
- MapRun Owner 为含 `statusConsume` 的 Map 提供独立 Status Receipt v3；scheduler v5/v6、Status Receipt v1/v2/v3 与 Program Receipt v1/v2 分别校验。Restore 从 scheduler 起点重放并核对 Trace、最终 Status/HP 和活动 Encounter 状态。
- Status 示例 Map `gameplay-b:map:status-example` 的 `resumeVersion` 从2升至3；正式样例演示两层施加、下一轮消费一层、回合末保留一层，随后可全量清除。
- ReadModel 深拷贝 v3 Trace；Workspace Flow 展示请求/消费/缺额和实例层数变化，当前单位状态继续显示活动层数。

## 验证

- 定向 10 个测试文件：260/260 通过（语法、Registry、Planner、AG-1 Commit/Restore、Save/Resume、正式样例、ReadModel/Workspace、Schema sync）。
- Schema：执行 `npm run gen:schema`；Schema sync 15/15 通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：1267 篇 Markdown，0 errors。
- `git --no-pager diff --check`：通过；Git 仅提示共享工作树中已有 CRLF/LF 转换提示。
- 未提交 Git commit。

## 边界

本 Receipt 不表示 Status 消费的屏幕人工验收已通过，也不包含类别净化、Revive、Modifier 扩展、Trigger 或跨 Encounter/Node Status。E1 U18 仍排除在 Task 0320 外。
