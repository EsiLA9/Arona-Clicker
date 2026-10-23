# U20 Receipt：按 Status 类别全量净化

状态：U20a–e 已实现并通过定向自动化、Schema、类型、架构、文档与差异检查。屏幕人工验收未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U20-screen-acceptance-report]]。

## 实现结果

- `GameplayMapStatusDef.category` 增加可选闭合分类 `harmful` / `beneficial`；不从 `kind`、名称或显示样式推导。Schema 由 `npm run gen:schema` 生成并同步。
- AG-1 增加 `statusRemoveCategory`，只作用于已解析的一个单位和精确声明类别；未分类状态不匹配，倒地目标仍可清理，空匹配成功且记录 `removed: []`。完整删除证据按稳定 Status 顺序记录原数组索引和实例。
- Planner 依 Program 顺序更新 detached Status 列表。类别操作与 `statusApply`、U16 `statusRemove`、U19 `statusConsume` 可组合；错误或失败提交不安装部分账本结果。
- Map 含类别清除语义时使用独立 Status Receipt v4，显式写入 `statusRemoveTrace`、`statusConsumeTrace` 和 `statusCategoryRemoveTrace`；Restore 根据 Map 作者语义验证字段集合，并从 scheduler 起点重放、拒绝 Trace、状态、HP 或索引篡改。Status Receipt v1–v3、scheduler v5/v6、Program Receipt v1/v2 与 E1/legacy v1 保持独立兼容边界。
- 正式 Map `gameplay-b:map:status-example` 升为 `resumeVersion: 4`。新增类别演练：同一目标同时持有 `burn/harmful` 与 `regen/beneficial`，清除 harmful 后保留 regen；原按 ID 清除和部分层数消费示例保留。
- ReadModel/Flow 深拷贝并展示类别、目标、删除实例、层数和原位置；空匹配也可读。Workspace 复用既有 Flow 行渲染。

## 验证

- U20 定向 10 个测试文件：269/269 通过，覆盖语法、Registry、Planner、AG-1 Commit/Restore、Save/Resume、正式样例、ReadModel/Workspace 与 Schema sync。
- `npm run gen:schema`：通过；Schema sync 包含在定向测试中，15/15。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run check:architecture`：通过。
- `npm run check:docs`：扫描 1268 篇 Markdown，0 errors。
- `git --no-pager diff --check`：通过；仅有共享工作树既有 CRLF/LF 转换提示。
- 未执行浏览器人工验收；没有提交 Git commit。

## 边界

本 Receipt 不表示屏幕人工验收已通过。U20 不包含 Revive、Modifier、Trigger、跨 Encounter Status、类别部分消费或 E1/legacy 语义变更；这些仍由 Task 0320 后续合同或 P7 范围裁定处理。
