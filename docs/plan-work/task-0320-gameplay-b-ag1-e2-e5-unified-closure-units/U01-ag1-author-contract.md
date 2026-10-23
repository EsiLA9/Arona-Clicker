# Unit 0320-U01：AG-1 作者速度与执行合同字段

## Goal

为 AG-1 增加闭合的 Map 作者字段：来源使用的 Action 基础／上限敏捷、Party 与 Enemy 的冻结补足值，以及 Map 执行合同选择；保持旧 Map 缺省为 E1-COMPAT-1。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单与停止条件 |
| 规范 | `docs/docs-829/05-conventions/schema-sync.md` | 源合同到生成 Schema 的流程 |
| Task | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` | 本 Unit 目标与 AG-1 统一范围 |
| Draft | `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md` §13.1–13.2 | 已批准 AG-1 字段与敏捷公式来源 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapDef`、`GameplayMapActionDef`、`GameplayEncounterEnemyDef` | 作者合同落点 |
| 源码 | `src/data-services/registry/registry-validate.ts`：Map / Encounter Registry 校验 | 闭合值、引用与执行合同校验落点 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts` | Map 合同与 Registry 行为覆盖 |
| 生成协议 | `tools/datapack-editor/schema/engine-defs.gen.json` | 仅通过 Schema 生成器更新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k tokens；只读本 Unit 必需源文件与相邻测试 |
| 文档 Read Set | 4 篇／节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若需扩大到 Runtime、存档或外部成长服务，停止并交回负责人拆分 |

## Optional Read Set

- `tools/datapack-editor/schema/engine-schema.sync.test.ts`：仅当生成字段需补充 Schema 表元数据时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- AG-1 的 MapRun Runtime / Receipt / Save 实现；归后续 Unit。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `GameplayMapActionDef.agility` 使用闭合 `{base,max}` 数值合同。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionAgilityDef` | 两值均为非负安全整数且 `base <= max`。 |
| Party 敏捷输入保存在 Map 的固定队员补足表。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapDef.partyAgility` | `{characterId,agility}`；缺失成员为 0，Registry 校验固定队伍身份与重复项。 |
| Enemy 敏捷补足属于 Encounter Enemy 定义。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayEncounterEnemyDef.agility` | 缺省为 0；Registry 仅允许 AG-1 Map 声明。 |
| Map 执行合同是闭合枚举。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapDef.executionContractId` | 省略时保持 E1-COMPAT-1；可显式选择 E1-COMPAT-1 或 AG-1。 |
| Map `resumeVersion` 已是必填字段。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapDef.resumeVersion` | 改变 AG-1 输入的内容包须由作者提高该版本。 |

## Constraints

- 按已批准 AG-1 合同使用 `final = min(base + actorAgility, max)`；`base` 与 `max` 必须成对出现，均为非负安全整数且 `base <= max`；所有省略敏捷值均按 0。
- Map 增加可选 `executionContractId: 'E1-COMPAT-1' | 'AG-1'`；省略时保持 E1-COMPAT-1。只有 AG-1 Map 才能声明 Action `agility`、Map `partyAgility` 或 Enemy `agility`。
- Map 的 Party 敏捷补足字段为 `partyAgility?: {characterId, agility}[]`；重复或不属于 Map 固定队伍的 ID 必须拒绝。未列出的 Party 成员为 0。
- Enemy 敏捷补足字段为 `GameplayEncounterEnemyDef.agility`；缺省 0。输入对象拒绝未知字段，所有数值必须是非负安全整数；Action base 不得大于 max。
- Action 敏捷字段为 `agility?: {base,max}`；省略时作者输入默认为未声明，运行合同按批准规则将基础与上限视为 0。
- 本 Unit 只改作者合同、Registry / Schema 和定向 Data 测试；不接线到 MapRun、Receipt、UI 或存档。
- 禁止手改生成 Schema。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由生成器更新）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`（仅在确需补元数据时）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U01-ag1-author-contract.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U01-receipt.md`

## Explicit Non-goals

- 不修改 Runtime source ordering、支付、terminal、Receipt、Save/Resume 或 UI。
- 不改变 E1-COMPAT-1 语义；不重裁已批准的 AG-1 排序与支付合同。
- 不导入 Cultivate / Gear 等实时成长值；本合同只定义 MapRun 会冻结的输入字段。
- 不编辑生成 Schema JSON。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若遇到 Draft §13.2 与现行作者字段或 Registry 语境冲突，停止上报，不自行改写 AG-1 语义。

## Completion Criteria

- [x] `executionContractId` 与敏捷输入具有闭合类型和 Registry 拒绝边界；旧 Map 缺省仍为 E1-COMPAT-1。
- [x] 合法 AG-1 Action / Party / Enemy 敏捷输入通过；重复、外部 ID、base/max 不配对、非法整数和 E1 Map 上敏捷字段被拒绝。
- [x] 运行生成 Schema 与 Schema 同步测试；生成结果由生成器产生且 Schema 同步。
- [x] 写 Receipt，记录实际差异与检查结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 退出码 0；只更新生成产物 |
| Registry 行为 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts` | 通过 |
| Schema 同步 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 实施记录

- 已按上述字段名完成作者合同与 Registry 校验：`executionContractId`、Action `agility:{base,max}`、Map `partyAgility:[{characterId,agility}]`、Enemy `agility`。
- Registry 拒绝未知执行合同、E1 Map 的敏捷输入、闭合对象外字段、重复／非固定 Party ID、负数／小数／非安全整数，以及 Action `base > max`；Map 执行合同省略时保留旧 E1 Map 的装载形态。
- 正式样例版本断言已按当前 11 张 Map 的具体 ID 列出预期值，包含三张作者演练 Map；不再把所有新增样例错误地要求为 resumeVersion 4。
- 实际命令与结果见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U01-receipt]]。
