# 05-conventions/schema-sync — Datapack Schema 同步

> 本文回答：修改数据契约后，如何同步独立 Datapack Editor 使用的 Schema。

## 权威输入与生成结果

- 类型和定义契约位于 `src/engine/types/`、`src/engine/contracts/`、`src/data-services/contracts/`。
- 生成器位于 `scripts/gen-engine-schema.mjs`。
- 生成协议为 `tools/datapack-editor/schema/engine-defs.gen.json`；禁止直接编辑生成文件。
- 编辑器补充语义位于 `tools/datapack-editor/schema/editor-extras.ts`，合并逻辑位于 `schema/merge.ts`。

## 变更流程

1. 修改源类型，并为面向作者的字段和枚举添加清晰 TSDoc。
2. 运行 `npm run gen:schema` 更新生成协议。
3. 对复杂字段维护 `editor-extras.ts` 的表元数据。
4. 运行 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 对应测试。
5. 运行 `npx tsc --noEmit` 检查契约使用者。

该协议仅负责编辑器字段同步，不替代 Registry 引用校验或编辑器交互测试。
