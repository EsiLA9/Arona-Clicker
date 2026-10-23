# U20-E4：按 Status 类别全量净化

> **状态：U20a–e 已实现并通过定向验证。** 本 Unit 增加明确的 Map-local Status 分类和一次清除目标单位指定类别的闭合原语；不扩展部分层数消费、Revive 或触发器。Receipt 与屏幕验收记录见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U20-receipt]] 和 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U20-screen-acceptance-report]]。

## 目标与当前基线

Task 0318 已交付 Encounter-local `burn` / `regen` 与 roundEnd。Task 0320 U16 完成按 Map-local Status ID 全量清除；U19 完成按精确 ID 消费部分层数。两项均只作用于已解析的一个单位，并通过独立 Status Receipt 与 AG-1 Restore 重放。

Draft 0312 §3 包含“清除一类指定状态”和“清除全部 harmful 类状态”样例。U20 将类别作为静态作者元数据，并新增按类别全量移除。它不从 `burn` / `regen` 行为类型、显示名称或颜色推导类别。

## 冻结合同

### Status 分类元数据

- `GameplayMapStatusDef.category` 是可选闭合字段，枚举仅为 `harmful` 或 `beneficial`。缺省表示该 Status 未分类；它仍可 `statusApply`、按 ID `statusRemove` / `statusConsume`，但不会被类别净化匹配。
- 类别只供 Map-local 分类选择，不改变 burn/regen 等 `kind` 的时机、HP 计算、层数上限、持续时间或 Owner。作者不得以 Status `kind` 或 UI 样式隐式决定类别。
- 只有 Map 中至少声明一个具备所选类别的 Status 时，Registry 才接受引用该类别的 `statusRemoveCategory`；这样能拦截明显拼错/无效类别，但活动状态列表为空时仍可 no-op。

### `statusRemoveCategory` 语义

- 新增闭合 AG-1 Effect Program 语句 `{ op: 'statusRemoveCategory', target, category }`；`category` 为 `harmful` / `beneficial` 字面量。
- `target` 仅为 `source` 或单位 `primary`。`source` 仅在 source identity 是 Party Character / Enemy Actor 时有效；Ability / Item 必须选择合法单位 `primary`。Team、CardRef、additionalTarget、TargetSet 与 `loopTarget` 不是 Status holder。
- 执行时先解析一个完整 holder identity，然后只匹配该单位、其 Status 定义 `category` 等于所请求类别的所有活动实例。未分类或另一类别的实例保持不变。目标 HP 为0不阻止清除。
- 命中实例按已有稳定 Status 顺序排列（Status ID、stable source key、Action ID）。每条清除证据含原活动数组索引与被移除完整实例；无匹配成功 no-op，记录 `removed: []`。
- `statusApply`、`statusRemove`、U19 `statusConsume` 和 `statusRemoveCategory` 按同一 Program 的语句顺序生效。类别清除移除完整实例，不按层数分配、不改变未匹配实例持续时间，也不触发到期事件。
- 此语句只允许 AG-1 Program，计入既有访问预算；E1/legacy Validator 与执行路径不变。

### Status Receipt、Restore 与版本

- Status Receipt 使用独立 `statusReceiptVersion: 4` 表示 Map 含 `statusRemoveCategory`。该 Map 每次 AG-1 Commit 均含 `plannedStatuses`、`statusTrace`、`statusRemoveTrace`、`statusConsumeTrace` 与 `statusCategoryRemoveTrace`；未用操作的 Trace 是显式空数组。每条类别移除 Trace 记录来源、Action、statement path、holder identity、category 和按稳定顺序列出的完整 removed 实例/原索引。
- 既有作者语义保持版本：只含 `statusApply` 的 AG-1 Map 为 v1，只含 U16 `statusRemove` 为 v2，含 U19 `statusConsume` 但无类别清除为 v3，含 `statusRemoveCategory` 为 v4（可与 ID remove / consume 同时出现）。Restore 按 Map Action Programs 反推应有版本和字段集合。E1/legacy 只接受既有 Status Receipt v1。
- Program Receipt v1/v2 与 scheduler v5/v6 均独立；U20 不提升 scheduler，不把类别 Trace 放入 Program/Shield Receipt。AG-1 Restore 从 scheduler start snapshot 重放类别过滤、逐条 Status 更新和 roundEnd，逐字段核对 Trace、Status、HP；缺失/伪造/改序/篡改均拒绝。
- 只有实际增添 `statusRemoveCategory` 作者语义的既有 Map 才升级其 `resumeVersion`。U20 正式样例 `gameplay-b:map:status-example` 从 U19 的 version 3 升至 4；不写存档迁移器。

### 原子性与排除范围

- Preview 只在 detached 列表上运行；失败、预算超限、stale draft、Restore 证据不符或任一 Owner 安装失败时，不安装 HP、Status、Shield、资源、费用、Facts、库存或 Receipt 的部分结果。
- 本 Unit 不实现按类别部分消费、跨单位/区域净化、未声明类别默认分类、Status 转移/扩散、Revive、damage/heal Trigger、onExpire Trigger、减伤 Modifier 或跨 Encounter Status。

## 施工切片

### U20a：作者 Schema 与上下文

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（只运行生成器）

### U20b：纯 Planner / trace

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`

### U20c：AG-1 Owner / Receipt / Restore

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`（仅 U20a 导出的类别功能识别 helper）
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`

### U20d：ReadModel / Workspace

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/ui/flow/map-flow-model.ts`
- `src/ui/components/map/map-workspace.ts`
- `tests/ui/map-flow-adapter.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`

### U20e：正式样例与作者说明

- `src/arona-clicker/content/gameplay-b/gameplay-b-status-example.ts`
- `tests/engine/gameplay-b-effect-example.test.ts`
- `docs/examples/gameplay-b-statuses.md`

## 完成证据

- Registry/Schema 验证 category enum、已声明匹配类别、目标 Actor 上下文与 AG-1-only 门控；缺省 category 不被净化匹配。
- Planner 覆盖同类多实例全清、另一类别与未分类保留、目标倒地、匹配为空、同一 Program 前后语句顺序与 detached 原子性。
- Restore 拒绝 v4 Trace/实例/分类篡改，同时保持 E1/v1、AG-1/v1–v3、scheduler v5/v6 和 Program v1/v2 回放。
- 正式样例演示目标同时持有 `burn/harmful` 与 `regen/beneficial`，按 `harmful` 清除后保留 `regen`；Workspace Flow 可解释类别、目标与移除实例。
