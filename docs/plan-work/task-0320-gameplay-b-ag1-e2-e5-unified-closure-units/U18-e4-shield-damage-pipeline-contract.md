# U18-E4：Shield 与 damage pipeline 合同

> **状态：合同已冻结；U18a1–e 已完成并通过专项自动化、Schema、类型、架构、文档与差异检查。** 浏览器人工验收尚未执行，步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U18-screen-acceptance-report]]，实现回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U18-receipt]]。本文只冻结 Draft 0312 中“友方获得 3 护盾，支付能量 1”样例的窄首片；不代表 E4 其余能力已完成。

本文回答：如何在当前 Encounter Owner 中增加独立 Shield 账本，并让 AG-1 Effect Program damage 逐次结算 Shield 后再结算 HP，同时保留历史 scheduler v5、Program Receipt v1/v2 与 Status Receipt v2 的独立兼容路径。

## 目标与已核实基线

### 可见样例

一名 Party 角色对一名友方角色施加 3 点 Shield，支付 1 点 Actor 能量。后续 damage 先消耗目标当前 Shield，未被吸收的部分再减少 HP。Shield 不增加 HP cap，不会复活倒地角色。

### 当前实现基线

| 已核实事实 | 源码依据 | 对冻结合同的影响 |
| --- | --- | --- |
| `damage` / `heal` 对 HP 账本分别减／加值；damage 截到 0，heal 截到 HP cap，0 HP 目标不被普通 heal 复活。 | `src/arona-clicker/services/map/map-effect-planner.ts`，Effect Program damage/heal 分支 | Shield 进入 AG-1 Program damage 路径，不以负 heal 或额外 HP 表示。 |
| TargetSet 在 damage 指令开始时解析为固定列表；按领域顺序逐目标、逐 repeat hit 结算，后续 hit 读取已更新状态。 | 同上，`resolveSet` 与 damage/heal hit 循环 | 每个 hit 独立执行 Shield→HP；不可在 TargetSet 结束后一次性扣总量。 |
| U12/Task 0318 Status 是带来源、Action、层数、剩余轮数的 Encounter-local 实例；burn/regen 在 roundEnd 结算。 | `src/arona-clicker/contracts/map/map-effects.ts`；`src/arona-clicker/services/map/map-encounter-statuses.ts` | Status tick 与 Shield 明确隔离，保持现有 Status Receipt 语义。 |
| U16 `statusRemove` 使用 `statusReceiptVersion: 2`；U17 Modifier 使用仅针对 Modifier evidence 的 `programReceiptVersion: 2`；AG-1 scheduler 为 v5。 | Task 0320 U16/U17 合同与 `src/arona-clicker/services/map/map-run-service.ts` | 新 Shield 证据不能覆盖或混用已有版本字段。 |
| MapRun 以 detached Encounter plan 计算，再由 Owner 一次安装；AG-1 Restore 从提交开始快照重放。 | `src/arona-clicker/services/map/map-run-service.ts` | Shield、HP、资源与 Receipt 必须同计划原子提交。 |
| 当前无 Shield 字段、Shield statement、独立 Shield Receipt 或 Shield Save/Restore 校验。 | `src/arona-clicker/contracts/map/map-effects.ts`、`src/arona-clicker/contracts/map/map-run.ts` | 以下冻结合同需要按 U18a–U18e 新增实现与验证。 |

## 冻结合同

### 作者合同与作用范围

- Map-local Shield 只作为 Encounter 内单位状态；首片只允许 `source` 或单位 `primary` 作为目标，不允许 Team、CardRef、additionalTarget 或 TargetSet 直接授 Shield。
- 新增闭合语句 `{ op: 'shieldAdd', target, amount }`；`target` 仅为 `source` 或 `primary`，不接受 CardRef、additionalTarget 或 TargetSet；`source` 仅在 source identity 是 Party Character 或 Enemy Actor 时可用，Ability/Item 只能作用于有效的单位 `primary`。`amount` 沿用 damage/heal 的安全 Value 语法，但运行结果必须为正 safe integer。嵌套在 `forTargets` 时，amount 同样可读当前 `loopTarget` 并按现有 loop Value 规则读取该 TargetSet 的 `targetCount`；该循环 `targetCount` 在循环体外不可用，Shield 目标仍只能是 source/primary。只允许 AG-1 Program 使用；旧 E1/legacy Action 语义不变。
- “友方 3 Shield，付能量 1”使用正常 Action `costs` 支付，不把能量消耗编码进 Shield 语句。Registry 静态验证目标上下文；提交时仍由既有 Owner 费用预检与逐来源支付负责。
- Shield 与 Status 分属不同账本。Shield 不拥有 Status ID、持续轮数或来源实例；本首片不新增减伤 Modifier、类别、抗性、护盾类型或持盾来源优先级。

### 身份、叠加、上限与清理

- 每个 Encounter 单位持有一个聚合 Shield pool，身份键为完整单位身份（`partyCharacter:id` 或 `enemy:id`）；不按施加者拆成独立 Shield 实例。
- 多次 `shieldAdd` 直接累加同一单位 pool。首片不另设玩法软上限；单单位 pool 的硬上限为 `Number.MAX_SAFE_INTEGER`。使用精确整数检查；数学结果超过上限时拒绝整轮，不饱和截断。
- Shield 在 Encounter 各 Round 间保留；Encounter 正常结束、终局、离开活动 Encounter 或 Run 结束时清空。它不跨 Encounter/Node，不保存到长期 AC 状态。
- 倒地单位可以保留 pool 但不能藉 Shield 复活。对已倒地目标执行 `shieldAdd` 时记录 `notApplied/defeated` 且不增加 pool；对 HP 为 0 的 damage hit 不消耗 Shield。后续 Revive 若获准，另行冻结该 Shield 是否仍有效。

### damage、repeat、TargetSet 与其它 HP 路径

- TargetSet 仍在语句开始时解析并冻结一次。按现有顺序逐个目标、逐次 repeat hit 更新账本；每一 hit 的顺序如下：

  1. 按既有 Value 语义求出本 hit 的非负 safe-integer requested damage；已批准的 damage modifier 先应用，Shield 读取最终请求量。
  2. 目标 HP 大于 0 时，吸收量为 `min(requestedDamage, shieldBefore)`；更新 Shield。
  3. `remainingDamage = requestedDamage - absorbed`，再将目标 HP 减少 `min(remainingDamage, hpBefore)`。
  4. 若目标 HP 已为 0，则本 hit 不消耗 Shield，HP 与 Shield 均保持不变。

- 同一来源内，早先 `shieldAdd` 可保护后续来源；来源 skip 时不生成 Shield。Shield 完全吸收时也扣除相应 Shield，但 HP 变化为 0。
- **只有 AG-1 Effect Program 的 `damage` 语句消耗 Shield。** Status `burn` roundEnd、`regen`、`heal`、`hpChange` 和 E1/legacy Action 均保持现状，不读写 Shield；`hpChange` 保持显式直接 HP 变化，不暗中转成 damage。
- Effect Program `damage` 的 TargetSet 在语句开始时冻结一次，按当前顺序逐目标、逐 repeat hit 结算 Shield→HP；后续 hit 读取前一 hit 更新的 Shield 与 HP。普通 heal 不复活、不触碰 Shield。
- 此首片不定义 damageApplied/healApplied 触发器。Shield 完全吸收后 HP 伤害为 0 的事件资格留到 Trigger 合同裁定。

### 溢出、失败与原子安装

- 所有 Shield 数值为非负 safe integer。Shield 加法用精确整数计算；若数学结果大于 `Number.MAX_SAFE_INTEGER`，拒绝整轮。
- Shield 吸收只做非负整数的 `min`/减法。若输入账本状态无效、Trace/预算校验失败、Restore 证据不符或任何后续 statement 失败，整个 detached plan 拒绝；不得安装部分 Shield、HP、资源、费用或 Status 变化。
- Preview 在副本中计算，不安装 Shield。成功 Commit 在既有 Owner 安装点一次写入最终 HP、Shield、资源、费用和 Receipt。

### Receipt、Restore 与版本共存

- 保持 AG-1 排序键、候选来源、source identity 与执行队列不变。**带有 `shieldAdd` 的 Map 使用 `schedulerFormatVersion: 6`**，因为起始 Shield 是完整 Planner 输入；不含 `shieldAdd` 的既有 Map 继续产出 scheduler v5。v6 把 Shield ledger 放在 `schedulerStartSnapshot.encounter.shields`，与其它 Encounter-local Planner 输入同属 encounter；Restore 原样接受历史 v5，v6 起点必须包含 Shield ledger。
- 保持现有 `programReceiptVersion` 规则：不含 CardRef Modifier evidence 的 Receipt 继续 v1；含 Modifier evidence 的 Receipt 继续 v2。`shieldAdd` 本身不触发 Program Receipt v2，也不改写 U17 Modifier trace。
- 保持 `statusReceiptVersion: 2` 及现有 Status Remove/roundEnd trace 形状；Shield 不进入 Status v2。
- 带有 `shieldAdd` 的 Map 在每次 AG-1 Commit 使用独立 `shieldReceiptVersion: 1`，包括来源 skip 或本轮无 Shield 事件的情况；`shieldTrace: []` 与起点/结果 ledger 仍作为明确证据。无关旧 Receipt 不新增 Shield 字段。
- `shieldReceiptVersion: 1` 包含提交开始 Shield ledger、最终 ledger，以及依计划执行顺序排列的 `shieldAdd` / `damage` 逐事件 Shield 前后值、吸收量、requested/remaining damage、HP before/after、来源/目标完整身份与 statement path。不扩展 Program Receipt v1/v2 或 Status Receipt v2。
- Restore 从 scheduler v6 起点重建 sources 并重放 Shield plan，逐字段比较 trace、最终 Shield/HP 与当前 Owner 状态；缺失、重复、篡改来源/目标/顺序/数值、错误版本或伪造最终账本均拒绝。历史 scheduler v5 的精确字段与 Restore 路径保持原样。
- 活动 Encounter Save/Resume 需保存并校验 Shield ledger；带 Shield 作者语义的现有 Map 必须提升自己的 `resumeVersion`。本合同首个示例是新 Map，初始 `resumeVersion: 1`。没有 Shield 的旧 Map 仍按空 Shield、旧 v5 读取；不编写存档迁移器。

## Task Owner 冻结记录

| 决策 | 冻结结果 |
| --- | --- |
| Shield Owner / 身份 | Encounter-local 聚合 pool；每个 Party Character / Enemy 单位一个池，不按来源拆分。 |
| 生命周期 | Encounter 内跨 Round 保留；Encounter 终局、离开当前 Encounter 或 Run 结束清空；不跨 Node/Encounter/MapRun。 |
| 额度 | 正 safe integer 请求；单池上限 `Number.MAX_SAFE_INTEGER`；溢出拒绝整轮。 |
| 倒地规则 | 倒地目标不会获得新 Shield；HP 为 0 的 damage hit 不消耗 Shield；本首片无 Revive。 |
| damage 结算 | 已有 Modifier 后逐 hit `Shield → HP`；确定 TargetSet 顺序和 repeat 顺序不变。 |
| HP 路径边界 | `heal`、`hpChange`、burn/regen roundEnd 与 E1/legacy 路径不接 Shield。 |
| 回放版本 | Shield Map 使用 scheduler v6 + 独立 Shield Receipt v1；非 Shield Map 继续 scheduler v5；Program v1/v2、Status v2 与 E1/legacy 路径各自不变。 |
| 本次不做 | 减伤、Status cleanse、Revive、Trigger queue、跨 Encounter 状态和任意 Shield 类型。 |

以上为 Task Owner 对 U18 合同的最终裁定，现已允许进入 U18a1–U18e 实施。

各实现片只能按本文冻结的语义施工；如施工证据要求改变 Owner、生命周期、回放输入或版本边界，应停下并补充 Task Owner 裁定。

## 施工切片

按依赖串行进行；每片沿用约 3–5 个手工维护文件。超过范围时继续拆分，不一次改完所有层。

### U18a1：作者 AST 与语法

**Allowed Files：**

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`

实现闭合 `shieldAdd` 语法与 AG-1 门控；不得手改生成 Schema。

### U18a2：Context/Registry 与 Schema

**Allowed Files：**

- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（只运行 `npm run gen:schema` 生成）

验证 `source` / `primary` 的合法单位上下文与 AG-1-only 门控；作者和 Registry 数据保持同源。Map 是否包含 Shield 语义由 U18c 的 MapRun Owner 按已归一化的 Action Programs 递归判断，不存入 Registry 衍生元数据。

### U18b：纯 Planner Shield 与 damage 结算

**Allowed Files：** `src/arona-clicker/contracts/map/map-effects.ts`、`src/arona-clicker/services/map/map-effect-planner.ts`、`tests/engine/gameplay-b-effect-planner.test.ts`。

覆盖 Shield 聚合、逐 hit 扣除、repeat/TargetSet 顺序、0 HP 不消耗、倒地 shieldAdd no-op、heal/hpChange/burn/regen 不触碰 Shield、上限溢出和纯计划原子失败。此片不写 MapRun/Runtime。

### U18c：AG-1 Owner、scheduler v6、Shield Receipt、Save/Restore

**Allowed Files：** `src/arona-clicker/contracts/map/map-run.ts`、`src/arona-clicker/services/map/map-run-service.ts`、`tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts`、`tests/engine/gameplay-b-effect-save-resume.test.ts`。

覆盖空/非空 Shield 起点、来源次序、费用与 Shield 同一 detached 提交、失败不安装、独立 Receipt v1 Shield evidence、按 Map 的归一化 Action Programs 递归确定 v5/v6、v5/v6 Restore 双路径、U17 Program Receipt v1/v2 与 U16 Status Receipt v2 共存、Save/Resume、Restore 篡改拒绝。

### U18d：正式样例与回归验证

**Allowed Files：** `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`、`tests/engine/gameplay-b-effect-example.test.ts`。

加入新的可进入 AG-1 Map：“友方获得 3 Shield，支付能量 1”，并展示后续一击先扣 Shield 再扣 HP；新 Map `resumeVersion: 1`。测试 Commit HP/Shield/费用与 Receipt 一致，Save/Restore 重算一致，倒地目标、费用不足、溢出等失败原子。

### U18e：Shield ReadModel 与 Workspace 可见结果

单独扩展当前只读 Encounter 投影与对应 Workspace，清晰显示单位 Shield 数值及本轮 Commit 的吸收/剩余伤害；不让 Component 读取 Runtime 写引用。完成后复用此入口进行 U18d 屏幕验收；若人工浏览器操作仍不可执行，交付独立屏幕验收需求单。

## 明确不包含

- 减伤、抗性、Shield 类型/穿透、一次性受击保护 Modifier。
- 部分层数消费、类别净化、Revive、damage/heal Trigger queue、到期 Trigger。
- 跨 Encounter/MapRun Shield 或 Status 生命周期、AC Tick/EventBus 写入。
- 修改 Hand RNG、AG-1 排序、费用先后合同或既有 U17 CardRef Modifier 语义。
- 将 Shield 作为 HP、Status、Counter、Team resource 或 PlayerState 资源保存。
- 本文仅冻结合同；源码、测试与生成 Schema 按 U18a–U18e 的 Allowed Files 与 Schema Sync 流程分片修改。
