# Task 0315 Unit U10：Registry 拒绝与 Schema 同步

状态：completed — U09 源契约与 Registry 收敛已完成；拒绝覆盖与生成 Schema 同步已验收。

## Goal

证明 Registry 不再装载旧 Action arrays，且 Datapack Editor 生成 Schema 已反映新作者合同。

## Allowed Files

- `tests/data/gameplay-b-effect-registry.test.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tools/datapack-editor/schema/editor-extras.ts`（仅当字段映射确实存在）
- `tools/datapack-editor/schema/engine-defs.gen.json`（只允许 `npm run gen:schema` 生成，不得手工编辑）
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 原始 JSON 仍含任一旧 Action 字段时被 Registry 精确拒绝；正常 effectProgram 与 Shop Offer `effects` 可装载。
- 生成 Schema 不再暴露 Action 的旧字段；Schema 只由生成器更新。
- Registry 对 first-party 包与导入包使用相同字段规则。

## Stop Conditions

- 生成器的差异超出 GameplayMap Action Schema，或影响范围要求改白名单外工具时停止并说明差异。

## Validation

- `npm run gen:schema`
- `npx vitest run tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `git --no-pager diff --check`
