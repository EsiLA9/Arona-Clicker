# docs-830/07-tooling/datapack-editor-and-schema — 独立 Datapack Editor 与 Schema

本文回答：独立 Datapack Editor 如何将契约转换为表单、校验并导入/导出内容包。

## 编辑器组成

`tools/datapack-editor/ui/main.ts` 是独立浏览器应用，使用三栏布局呈现表类型、记录列表和记录详情。`EditorModel` 在内存中持有多张表与包元数据，统一处理增删改、撤销/重做和变更通知；字段表单依据最终 `TABLES` 描述生成，保存/导出前可运行本地 Datapack 校验。

```text
Engine / Datapack TypeScript 契约
  → gen-engine-schema.mjs 生成 engine-defs.gen.json
  → editor-extras 提供编辑语义并与生成定义合并
  → TABLES / EditorModel 驱动表单、校验与导出
```

生成 Schema 负责一般字段结构、类型、枚举和引用；`editor-extras.ts` 补充复杂 tagged 字段、选项来源、字段分组、虚拟表和自定义编辑器。合并优先级为手写 override、生成定义、通用 JSON 控件。递归或复杂联合字段无法安全展开时保留 JSON 编辑能力，避免编辑器静默丢字段。

## 导入与导出

`io.ts` 支持加载默认分片、导入 JSON / ZIP、复制 JSON、下载 JSON / ZIP。ZIP 导入复用 Data Services 的包解析器；ZIP 导出写出 `datapack.json` manifest 和内容 fragment。导入的数据进入独立 `EditorModel`，编辑器不会直接修改已运行游戏的 Registry 或玩家状态。

源码入口：`tools/datapack-editor/ui/main.ts`、`model/editor-model.ts`、`ui/io.ts`、`schema/merge.ts`、`schema/editor-extras.ts`、`validate/index.ts`、`scripts/gen-engine-schema.mjs`。

相关测试见 `tools/datapack-editor/model/editor-model.test.ts`、`schema/datapack.schema.test.ts`、`schema/engine-schema.sync.test.ts`、`ui/io.test.ts`。游戏内 Runtime Editor 是另一条写入 Runtime 内容草稿的路径，见 [[runtime-editor-and-project-checks]]。

## 字段变更应该看哪里

当作者新增一个定义字段时，先修改权威 TypeScript 契约，再生成 Schema；独立编辑器按生成字段及手写元数据拼合最终表单。某些复杂联合字段由 JSON 控件承载，表单显示与运行时校验是两个不同问题。字段从契约进入表单的过程和同步测试边界见 [[editor-schema-to-form]]。
