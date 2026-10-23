# Unit 0320-U11b：`additionalTarget` 作者 Schema 同步

## Goal

将 U11 已实现的 Map Action 可选 `additionalTarget?: 'partyCharacter' | 'enemy'` 作者字段同步到独立 Datapack Editor Schema，并用同步测试锁定字段类型和值域。Schema 由现有生成器产生；本 Unit 不改源类型或运行时。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口 | `AGENTS.md` → datapack-schema context pack、`docs/ai/PROJECT-CONSTITUTION.md` | Schema 路由与 Patch Unit 纪律 |
| Schema 规范 | `docs/docs-829/05-conventions/schema-sync.md` | 生成器与同步测试流程 |
| 上游合同 | U11 `GameplayMapActionDef.additionalTarget`、U11 Receipt | 已冻结字段二值集合及来源约束 |
| 生成输入 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionDef` | 核对字段 TSDoc 与生成器输入；只读 |
| 生成产物 | `tools/datapack-editor/schema/engine-defs.gen.json` | 确认 Action authoring schema 当前是否包含字段 |
| 同步测试 | `tools/datapack-editor/schema/engine-schema.sync.test.ts` | 为字段及枚举值增加结构断言 |
| 项目地图 | `graph_project(acprogram)` 与 `engine-schema.sync.test.ts` 定向路径搜索 | 核实项目身份与直接影响；不改图、不刷新 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 8k tokens；限 Map Action Schema 生成与同步断言 |
| 文档 Read Set | 3 篇/节 |
| 历史文档 | 0 篇；U11 Receipt 是当前作者字段事实 |
| 超预算处理 | 需要改源类型、Editor UI 或 runtime 时停止并交回 Task Owner 拆分 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Map Action 源类型已有 `additionalTarget?: 'partyCharacter' | 'enemy'` | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionDef` | U11 已完成静态合同与 Registry/Context 校验 |
| Schema 由 `npm run gen:schema` 生成，生成 JSON 禁止手改 | `docs/docs-829/05-conventions/schema-sync.md` | 允许运行生成器更新产物 |
| Gameplay Map 同步测试已检查 Action 字段与旧数组边界 | `tools/datapack-editor/schema/engine-schema.sync.test.ts`：Gameplay Map contract case | 本 Unit 只增加额外目标字段断言 |

## Constraints

- 不改变 U11 字段合同：可选字符串联合值必须且只能为 `partyCharacter`、`enemy`。
- 运行 `npm run gen:schema` 生成 JSON，不手动编辑生成文件。
- Schema 断言必须确认字段非必填、枚举值精确匹配；现有闭合作者结构与旧数组不可见断言保持通过。
- Schema 可见只证明作者字段已同步；不表示额外目标身份选择、Draft、Preview、Commit、Receipt、Save/Resume 或 Restore 已实现。

## Allowed Files

### 施工实现白名单（Agent）

- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由 `npm run gen:schema` 生成）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`

### Task Owner 维护的施工记录

- 本 Unit、对应 Receipt、Task 0320 与 `docs/plan-work/00-index.md`

实现控制为 2 个实现路径；预期生成 JSON 与测试断言的有限差异。

## Explicit Non-goals

- 不修改源类型、Registry、Context、Schema generator、Editor UI 或任何 runtime / Save / Receipt 路径。
- 不实现或宣称 `additionalTarget` 可在运行时选人、提交、结算或恢复。
- 不修改 Task 0316–0319，不操作 GALHCG 图、不刷新或写 freshness。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若生成器未读取现有源字段、需要修改白名单外文件，或字段生成结构与闭合合同冲突，停止并上报证据。

## Completion Criteria

- [x] `npm run gen:schema` 成功，并在生成 Schema 中输出可选 `additionalTarget` 字段与两个允许值。
- [x] Schema 同步定向测试锁定字段可选性和值域，且原 Gameplay Map authoring 结构断言通过。
- [x] `npx tsc --noEmit`、`npm run check:docs` 与 `git --no-pager diff --check` 通过并记录 Receipt。
- [x] Receipt 明确记载该结果仅为作者 Schema 同步，不宣称运行时目标选择已实现。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema generation | `npm run gen:schema` | 生成器将源类型的字段写入 Schema |
| Schema sync | `npx vitest run --silent tools/datapack-editor/schema/engine-schema.sync.test.ts` | 字段与枚举断言通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 文档链接/结构 | `npm run check:docs` | 新 Unit/Receipt 路由无错误 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
