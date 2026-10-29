# 独立编辑器：从 Schema 到字段表单

本文说明独立 Datapack Editor 如何把源契约转成可编辑字段，以及修改契约后应该核对什么。编辑器整体见 [[datapack-editor-and-schema]]；游戏内编辑器的提交路径见 [[runtime-editor-and-project-checks]]。

## 一条字段从哪里来

```text
TypeScript 定义与文档注释
  → Schema 生成器
  → engine-defs.gen.json
  → 生成字段 + editor-extras 补充/覆盖
  → buildTables() / TABLES
  → EditorModel 和字段表单
```

源类型是契约入口；`engine-defs.gen.json` 是生成结果，不应手工修补。`editor-extras.ts` 为需要更具体编辑体验的字段补充选项来源、复杂结构、覆盖和分组等信息。`buildTables()` 处理表元数据与字段，字段存在 override 时优先采用 override，否则转换生成字段。

## 为什么有时会看到 JSON 编辑器

生成字段的 `hand` 类型用于无法由通用字段结构安全展开的递归或联合契约；`convertGenerated()` 将它映射为 JSON 控件，以保留作者数据。复杂字段也可能由 `editor-extras.ts` 提供更具体的编辑描述。应先核对生成结构与 override，而不是只因为表单出现 JSON 就推断数据契约不存在。

## 一次字段变更如何核对

1. 修改权威源类型及面向作者的说明，确认字段属于哪张定义表。
2. 按 [[ai/guide/conventions/schema-sync]] 运行生成命令；不要直接编辑生成结果。
3. 查看生成字段是否能表达类型、枚举和引用；必要时修改编辑器补充元数据。
4. 检查最终 `TABLES` 中字段及控件，并运行 Schema 同步测试和所需的类型检查。
5. 若字段改变业务语义或引用关系，另行核对 Registry 校验与相关行为测试；字段能够显示并不证明运行时接受或正确使用它。

`tools/datapack-editor/schema/engine-schema.sync.test.ts` 检查生成协议一致性、生成字段与 `TABLES`、覆盖 key、引用目标和枚举等。它能发现结构同步问题，不替代所有编辑器交互或产品运行行为验证。

一个跨多表的具体案例见 [[operation-content-authoring]]：从 Operation Event、地点和行动到引用校验与运行准入。

## 编辑与游戏状态的边界

独立编辑器的 `EditorModel` 在本地持有表数据与包元数据，并提供撤销、重做、校验和序列化；导入 / 导出使用 JSON 或 ZIP。它不会仅因表单改动就直接更新游戏运行中的 Registry 或玩家状态。游戏内 Runtime Editor 使用另一套草稿和提交入口。

源码：`scripts/gen-engine-schema.mjs`、`tools/datapack-editor/schema/merge.ts`、`tools/datapack-editor/schema/editor-extras.ts`、`tools/datapack-editor/model/editor-model.ts`、`tools/datapack-editor/ui/io.ts`。测试：`tools/datapack-editor/schema/engine-schema.sync.test.ts`、`tools/datapack-editor/model/editor-model.test.ts`、`tools/datapack-editor/ui/io.test.ts`。
