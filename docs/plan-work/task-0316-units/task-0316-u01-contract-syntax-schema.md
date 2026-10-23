# Task 0316 U01：合同、语法与 Schema

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u01-receipt]]。

## 目标

定义受限 E2 target selector、整数 Value expression 与 damage/heal repeat 合同；保持 E1 形状兼容并生成同步的 Datapack Schema。

## 范围

- `src/data-services/contracts/gameplay-map-effects.ts`、对应 syntax validator / 测试。
- `tools/datapack-editor/schema/engine-schema.sync.test.ts` 与 Schema 生成流程。
- 不编辑生成 Schema 手工内容，不接入 Owner 执行。

## 完成条件

- 精确字段检查、集合上限 32、repeat 0–8、Value 节点/深度和安全整数约束均有行为断言。
- 非法侧别、排序、过滤器、负量、未知 Value op、错误字段和除零常量不在静态层（除运行时 Value 除零）进入有效合同。
- `npm run gen:schema` 与 Schema 同步测试通过。
