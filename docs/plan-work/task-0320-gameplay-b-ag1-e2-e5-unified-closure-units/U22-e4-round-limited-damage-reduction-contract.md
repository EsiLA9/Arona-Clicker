# Task 0320-U22：E4 回合限时伤害减免状态

状态：U22a–d 已实现并通过定向验证。U22 是 E4 Modifier 的窄首片，只增加可由现有 Status 生命周期管理的固定 incoming damage reduction；不接入通用 Trigger/EventBus。回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U22-receipt]]，屏幕验收步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-screen-acceptance-report]]。

## 基线与目标

U18 已冻结 AG-1 damage → Shield → HP，并明确不含减伤。U17 的 CardRef Modifier 修改尚未执行来源的 outgoing damage/heal amount；它不是受击减免。U22 提供一种 Map-local、回合限时的防御 Status，并在每个合法 AG-1 damage hit 中应用。

## 冻结合同

### 作者字段

- `GameplayMapStatusDef.kind` 增加 `damageReduction`。此类型必须提供正安全整数 `damageReductionPerStack`，不得提供 `hpPerStack`；`burn`/`regen` 仍必须提供 `hpPerStack`，不得提供 `damageReductionPerStack`。已有 `id`、类别、层数上限和 1–99 轮 duration 规则不变。
- `damageReduction` Status 的 `category` 必须显式为 `beneficial`。状态仍只能通过现有 `statusApply` 施加到一个 Party Character 或 Enemy，不新增 holder、source 或外部资源路径。
- Map 含该 Status 定义时，其 `resumeVersion` 必须提升。其他 Map 不升级。

### 计算范围与顺序

- 每个 AG-1 `damage` 的每个目标、每次 repeat hit 各自计算一次。TargetSet 顺序、repeat 顺序及语句执行顺序沿用现状；较早来源或同一 Program 先前语句施加/清除/消费的 Status 立即反映到后续 hit。
- 对 HP 大于 0 的目标，按以下顺序计算：先求 raw damage Value；如 U17 outgoing CardRef Modifier 合法，则先应用该 delta 并 clamp 到非负；再将目标全部活动 `damageReduction` Status 的 `stacks × damageReductionPerStack` 求和，减免值最多为当前 damage request；最后将剩余 damage request 交给既有 Shield → HP。减免发生在 Shield 之前，因此会减少 Shield 消耗。`heal`、`hpChange`、`revive`、burn/regen tick 和 E1/legacy 均不使用此 Modifier。
- HP 为 0 的目标不遭受本 hit，不消费 Shield，也不应用/消费减免。damageReduction 是被动量，不因命中减少层数；多来源按现存 Status 稳定数组顺序记录，计算用精确整数，减免结果不会超过当前请求值。
- Status 在 `statusApply` 成功后立即影响本来源及后序来源；有效期与现有 `durationRounds`/成功 roundEnd 递减规则一致。新状态不在施加它的同轮 roundEnd tick；tick 时 HP 不变，仅推进剩余轮数并按到期删除。

### Trace、Receipt、Restore 与版本

- 每个受影响的 AG-1 damage statement trace 增加可选 `damageReduction` 证据：最终实际减免总量及有贡献的 Status ID/source/action、层数、每层值和该项实际减免量。无减免的旧 damage trace 形状保持不变。
- roundEnd Status Trace 可记录 `statusKind: damageReduction`、`hpDelta: 0` 和剩余轮数变化。包含该定义的 Map 使用独立 Status Receipt v5；v1–v4 精确历史校验保持。Scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1 均不升级；Restore 从 scheduler 起点重新计算并比较所有 Trace、Status、Shield 与 HP。
- Save/Resume 验证新的 Status kind 与作者定义；非法字段、类别、值、Trace、回放或安装输入均拒绝 detached 整轮。既有 Encounter-local Status/Shield 清理策略不变。

### 正式样例与展示

- 新增独立可进入 Map，演示单层减免 2 先于 1 Shield 再扣 HP；后续 Round 仍生效，到期后不再减免。不得修改已有 Status 或 Shield 示例的版本/语义。
- Workspace 状态区域显示防御状态名称、层数和剩余轮数；Commit Flow 显示 damage 原请求、减免来源/数值、Shield 吸收和 HP 结果。

## 施工切片

- **U22a 作者与 Schema**：状态定义 discriminated union、Registry/Context 校验、Schema 生成和同步测试。
- **U22b Planner 与 Trace**：Status 应用后续生效、逐 hit 修正及 trace；burn/regen、damage 0、倒地、TargetSet/repeat、Shield 顺序与溢出边界测试。
- **U22c Owner/Receipt/Restore**：Status Receipt v5 的 Map 语义选择、typed Receipt、Save/Resume、Restore 重放及篡改拒绝；保留 scheduler v5/v6、Program v1/v2 与 Status v1–v4 路径。
- **U22d 样例与展示**：独立 Map、作者说明、Flow/Workspace 展示和浏览器人工验收需求单。

## 明确排除

本首片不实现一次性受击保护消费、数轮持续通用属性链、damageApplied/healApplied/到期 Trigger、反击/受治回馈、跨 Encounter Status、减伤穿透/易伤、Shield 类型、HP 之外的防御值、E1/legacy 或 `hpChange` 修改。剩余 Modifier、Trigger 和 Status 寿命分别由后续 U/P7 合同裁定。
