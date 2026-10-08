# 06-wiki/60-engineering-support/schema-editor — 引擎类型与编辑器 Schema 同步

> 本文回答：引擎的 Datapack 类型变化后，独立编辑器怎样得到匹配的表结构？

这里的 **Schema** 是给编辑器读取的字段描述。此页说的是 `tools/datapack-editor/` 独立编辑器，不是游戏内的 Runtime Editor。

## 生成链

`scripts/gen-engine-schema.mjs` 读取 `src/engine/types/`、`src/engine/contracts/` 与 `src/data-services/contracts/`，生成独立 Datapack 编辑器使用的 `tools/datapack-editor/schema/engine-defs.gen.json`。生成器从 Datapack 契约整理表与字段，读取基础 TypeScript 类型和 TSDoc 标签；编辑器暂不能直接表达的复杂类型会用 `hand` 占位交给编辑器侧补充。

编辑器侧的 `schema/editor-extras.ts` 声明表元数据和复杂字段定义，`schema/merge.ts` 将本地定义与生成协议合并，`schema/datapack.schema.ts` 暴露最终 `TABLES`。独立编辑器 `tools/datapack-editor/ui/main.ts` 消费这些表渲染编辑界面；它不会直接读取 `src/engine/**` 的源类型。

```text
Engine / Data Services 类型和契约
  → gen-engine-schema.mjs
  → engine-defs.gen.json（生成文件）
  → engine-defs.ts 加载
  → merge.ts 合并 editor-extras.ts
  → datapack.schema.ts 暴露 TABLES
  → 独立 Datapack Editor 使用
```

## 修改后同步

当引擎实体字段、枚举或 Datapack 契约发生变化时，运行 `npm run gen:schema` 更新生成文件。若复杂字段生成 hand 类型或需要编辑器专属语义，再维护 `editor-extras.ts` 的覆盖。生成文件是派生产物，不应直接手工编辑。

`engine-schema.sync.test.ts` 会重新解析当前源码，并与基于生成协议和本地覆盖构成的最终表比较：检查 Datapack 表映射、生成字段是否进入最终表、`hand` 占位是否已被覆盖、覆盖字段是否存在于源类型、引用表目标和枚举选项是否基本一致。可单独执行 `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts`。它能发现合同和编辑器描述漂移，但不能判断编辑器交互或表单呈现是否符合作者意图。

## 适用范围

此链条针对 `tools/datapack-editor/` 的独立编辑器 Schema。游戏内 UI 编辑器属于 `src/ui/`，其机制不由这份生成协议描述。

字段源类型、生成命令与禁止手改生成产物的规则见权威页 [[docs/docs-829/05-conventions/schema-sync]]；怎样运行同步测试见 [[docs/docs-829/06-wiki/60-engineering-support/testing]]。
