# 引擎类型与编辑器 Schema 同步

## 生成链

`scripts/gen-engine-schema.mjs` 读取 `src/engine/types/`、`src/engine/contracts/` 与 `src/data-services/contracts/`，生成独立 Datapack 编辑器使用的 `tools/datapack-editor/schema/engine-defs.gen.json`。生成器解析字段类型与 TSDoc 标签；复杂类型可保留为 hand 描述，等待编辑器提供细化定义。

编辑器侧的 `schema/editor-extras.ts` 声明表元数据和复杂字段定义，`schema/merge.ts` 将本地定义与生成协议合并，`schema/datapack.schema.ts` 暴露最终表。

## 修改后同步

当引擎实体字段、枚举或 Datapack 契约发生变化时，运行 `npm run gen:schema` 更新生成文件。若复杂字段生成 hand 类型或需要编辑器专属语义，再维护 `editor-extras.ts` 的覆盖。生成文件是派生产物，不应直接手工编辑。

`engine-schema.sync.test.ts` 会重新解析当前源码并检查生成字段在最终表中存在、hand 占位已覆盖、覆盖字段在源类型中存在，以及引用和枚举的基本一致性。它能提示漂移，但不能决定 UI 呈现是否符合编辑意图。

## 适用范围

此链条针对 `tools/datapack-editor/` 的独立编辑器 Schema。游戏内 UI 编辑器属于 `src/ui/`，其机制不由这份生成协议描述。
