# Receipt：0236-U0-A 声明式 Action 目标范围

状态：completed — 按上游裁定将类型范围限定到 Event Actor `type` 字符串，合同、结构校验与规定验证通过；保留现有 Operation `hand` Schema 边界。

## Goal

扩展 Operation Action target 合同，支持 Event Actor ID 精确 allowlist 与声明 `type` 字符串范围；新增字段纳入结构校验和 Datapack Schema 同步，同时保留未声明限制的旧行为。

## 实际修改

- `src/data-services/contracts/operation.ts`：`kind: 'actor'` 增加可选 `allowedActorIds` 与 `allowedActorTypes`。两者同时声明时均须满足；省略时不改变既有 `relation` 规则。`allowedActorTypes` 明确匹配 Event Actor 声明的 `type: string`，不使用 participant 分类。
- `src/arona-clicker/services/operation-tactical-definition-validation.ts`：校验 ID 与 Actor type 字符串数组非空、唯一且无首尾空白；不对 Actor type 作枚举校验。拒绝空过滤列表及 `kind: 'none'` 上的过滤字段；Actor ID 是否引用本 Event 留给 U0-D 检查。
- `tests/engine/student-operation-runtime.test.ts`：覆盖 legacy 无过滤目标、当前 Event 中已声明的 Actor ID + type 合法组合、空 / 重复 / 非法 ID/type、未声明 Actor ID/type 与过滤字段置于错误 target kind 等情况。
- `tools/datapack-editor/schema/engine-defs.gen.json`：`npm run gen:schema` 成功；输出只有 `generatedAt` 时间戳噪声，已按上游要求以 `git restore --source=HEAD -- tools/datapack-editor/schema/engine-defs.gen.json` 精确恢复，未手改生成 JSON。

## 验证

| 检查 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/student-operation-runtime.test.ts` | 通过：1 个文件、8 个测试 |
| `npm run gen:schema` | 成功；生成文件仅更新时间戳，随后按上游裁定精确恢复生成噪声 |
| `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts` | 通过：1 个文件、8 个测试 |
| `npx tsc --noEmit` | 通过 |
| `git --no-pager diff --check` | 退出码 0；仅对其他并行脏文件 `registry.ts`、`registry.test.ts` 报 CRLF 提示 |

## 类型语义裁定

施工中确认 `OperationActorDef.type` 是任意字符串，而 `OperationActorKind` / `participantKind` 表示 student / opponent / environment 参与者分类。按上游裁定将字段定为 `allowedActorTypes: readonly string[]`；U0-B 匹配声明 Actor `type`。U0-B 首轮据此中断，U0-A 重开并在同一 Allowed Files 内改正合同和校验后，本 Receipt 再标记完成。`allowedActorIds` 的 Event Actor 存在性由 U0-D 负责。

## Schema 边界裁定

上游确认不扩展独立 Datapack Editor 的 Gameplay B 表单：当前 `TABLE_META` 的 13 张表没有 Operation 表，且 `OperationActionDef.target` 在本次改动前已是 `kind: "hand"`。本 Task 不新增 Editor 表 / 子表单，因此 Schema 生成和同步测试通过后不要求扩展 `editor-extras`。生成 JSON 没有语义字段差异，仅时间戳变化；按上游要求精确恢复该生成文件。

## 回归复核

上游扩大 U0 回归时发现测试正例曾使用不属于夹具 Event 的 Actor ID / type。现改用 `ACTOR_IDS[0]` 和已声明的 `student` type；同一测试明确断言未声明 Actor ID 与未声明 Event type 均被静态内容校验拒绝。定向测试复跑通过（1 个文件、8 个测试）。

## GALHCG 影响

本 Unit 修改既有 Operation 合同、校验和测试路径，没有新增文件映射概念或跨模块关系。代码路径 Evidence / `maps_to` freshness 需由任务负责人在代码方案定稿后统一复核；本 Receipt 不声称已完成地图写入。
