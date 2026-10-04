# Receipt 0191-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；准备层契约与定向覆盖交付，Runtime 结算和实际 HP 变化记忆由 U2 接入。 |
| 实际修改 | `prototypes/gameplay-b/src/model.ts`：增加混合前排+最低后排目标、敌方 fixed-damage/no-op 意图、上一轮受伤输入与受伤反应字段；`prototypes/gameplay-b/src/battle/prepare.ts`：冻结混合目标、特殊意图和受伤反应，并校验固定伤害/受伤 ID；新增 `prototypes/gameplay-b/tests/enemy-intents.test.ts`；本 Unit spec 与 Receipt。 |
| 未完成内容 | U1 不结算 fixed-damage/no-op，不从 Runtime 生成上一轮 HP 下降 ID；由 U2 按最近一次结算 Delta 接入。 |
| 范围外变更 | Task 级规划维护：更新 0191 根 Task 的已核实交接门槛和 U1 紧凑接口预算；为 U2–U7 修正 0190 归档后的相对链接。未修改这些后续 Unit 的代码范围或内容规则。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npm test -- enemy-intents.test.ts battle-prepare.test.ts`（`prototypes/gameplay-b/`） | 通过：2 个文件、15 项测试 | 覆盖 Boss mixed target 前排/最低后排、HP 并列顺序、无存活行、固定伤害准备、reload/no-op 空目标、上一轮反应及基础序列不重置、无效受伤 ID/固定伤害输入。 |
| 类型检查 | `npm run typecheck`（`prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 文档与空白 | 根目录 `npm run check:docs`；PowerShell 行尾空白扫描 7 个本 Unit/Task 文件；0191 单元文档 0190 链接核对 | 通过：561 篇 Markdown、0 errors；尾随空白 0；旧 0190 路径 0 | 根文档检查通过。 |
| C2 净行数 | 按 U1 新增/扩展实现块核算 | 约 140 行 | U1 属于 model/prepare 契约切片；Task 根文档记载理由与 120–220 行预算，结算仍由 U2 负责。 |

## 遇到问题

- 初次类型检查因 `flatMap` 在不同意图分支推断出不兼容的窄数组类型失败；改为显式构造 `PreparedEnemyIntent[]` 后，定向测试与类型检查均通过。

## 需上游确认项

- 无；Runtime 只写上一轮受伤 ID 的工作按 U2 的既定白名单执行。

## 事实更新建议

- 只读 View 与 resolve 通过 `PreparedEnemyIntent.effect` 读取常规效果；为保证 U1 与 U2 顺序交接兼容，special intent 在准备结果中使用 `effect: null`，另以 `resolution` 表达 fixed-damage/no-op，目标列表已冻结。U2 按 `resolution` 结算，不需扩大 U1 白名单。
- `GameplayBBattleRuntime.click()` 暴露 `lastResolution.deltas`，每项包含 `hpBefore`/`hpAfter`；本 Unit 不将其误当成现存上一轮输入，实际差分集合由 U2 产生与消费。

