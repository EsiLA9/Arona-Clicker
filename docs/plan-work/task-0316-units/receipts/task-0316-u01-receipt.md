# Task 0316 U01 Receipt：合同、语法与 Schema

状态：complete

## 交付

- 在 `gameplay-map-effects.ts` 增加 E2 TargetSet、Value AST 和确定性预算：集合最多32名、每目标 repeat 最多8、每来源 expanded hits 最多1024、整轮仍4096 visits；Value 最多128节点／深度8。
- Syntax validator 对 TargetSet 字段、Value 节点、数值类型和 repeat / 集合边界执行严格检查。
- 运行 `npm run gen:schema` 生成 `tools/datapack-editor/schema/engine-defs.gen.json`，未手改生成文件。

## 验证

- `tests/data/gameplay-b-effect-syntax.test.ts`：7/7。
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`：14/14。
- 合法 primary E1、set E2、表达式和 repeat 通过；非法集合上限、未知字段与排序、负／小数和 repeat 越界被拒绝。
