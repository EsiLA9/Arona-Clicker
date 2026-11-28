# docs-830/02-data-and-state/package-io-and-source-layers — 包 I/O 与定义来源层

本文回答：Datapack 如何从文件变成定义，以及多个来源的同一条定义如何解析。

## 包读取与导出

`PackSource` 把目录或 ZIP 统一为可列举、可异步读取的相对文件条目。包解析器 `parsePack()` 要求根目录有 `datapack.json`，校验包身份与依赖字段，再解析其他 JSON 文件为 fragments 并合并为 `Datapack`；受支持的图片文件读取为运行期 URL。manifest 与 fragments 的 `name`、`version` 必须一致。其他非 JSON、非图片文件会计入 ignored，而不会进入定义。

```text
文件夹 / ZIP → PackSource → manifest + JSON fragments + 图片
            → manifest 校验 → fragment 合并 → ParsedPack
```

低层 `loadDatapackFromZip()` 可直接把 ZIP 内 JSON fragments 合并为 Datapack；它与带 manifest、身份校验和图片结果的 `parsePack()` 包路径职责不同。导出侧 `ZipArchiveWriter` 接收 `ArchivePlan`：先拒绝绝对路径、反斜线、空路径段、`.` / `..` 和重复路径，再按路径稳定排序并生成 ZIP。这样导出结果只包含调用方明确提供的条目。

作者工具通过 `project-source.ts:readProject` 读取单 JSON、目录或 ZIP。文件字节、声明原值、源路径及 JSON Pointer 随读取结果保存。完整输入提供 Datapack 投影，缺文件、坏分片或缺少包内图片时提供可读声明和诊断。文件位置属于作者布局，游戏 ID 由实体自身定义。

`project-layout.ts:planProjectLayout` 生成拆分、合一和分组的副本计划。每次输出可重新读入继续转换。分片物理排列不足以表达原表次序时，`.datapack-layout` 只为受影响表记录片内位置。普通运行读取入口会提示先生成兼容发行包。兼容全合输出旧清单、单内容分片和适用资产，无需附属顺序记录。实际操作见 [[datapack-editor-and-schema]]。

TypeScript Base 文件夹导出通过 `scripts/export-base-datapack.mjs` 读取作者源，写入 `datapack.json`、图片资源和 `content/` 下的分片；`metadata.json` 保存 name/version，每个 Datapack 顶层字段各有一个 JSON fragment。`parsePack()` 会把这些文件合并为同一 Datapack。Runtime 静态 bundle 仍由 `scripts/sync-base-datapack-bundle.mjs` 生成到 `base-pack/content.json`，与面向包目录的多文件导出分开维护。

## 来源层与覆盖解析

`DefinitionSourceLayer` 将定义按 `base`、`pack`、`draft` 来源分层，每条记录由 `(table, id)` 定位。`resolveDefinition(layers, key)` 按调用方给定的优先顺序从上向下检查；每层先检查 tombstone，再检查该层记录。遇到记录即返回 `resolved`。遇到 suspend tombstone 时，如果传入的层中存在该 key 的记录，就返回 `suspended` 及查找到的被遮蔽记录；记录也可能属于 tombstone 所在层。没有记录时返回 `missing`。

| 操作 | 作用 |
| --- | --- |
| `setDefinitionRecord` | 在当前层设置 owned 或 override 记录，替换同层同 key 记录 |
| `deleteLocalDefinition` | 删除当前层 owned 记录 |
| `removeOverride` | 删除当前层 override，使解析可回退到低层 |
| `suspendDefinition` / `resumeDefinition` | 在 draft 层添加 / 移除当前 draft 拥有的 tombstone |
| `createDefinitionDelta` | 比较前后解析结果，报告 added、changed、removed 与状态 transitions |

删除本层 owned 记录与暂停整个来源定义是不同操作；override 被移除后，底层定义仍可解析。来源层是编辑与合并机制，Registry 则是应用后的运行时查询表。

### 举例：临时隐藏一个 Spot

假设解析顺序为 draft、pack、base，pack 和 base 都有同一 Spot。正常解析得到 pack 的记录；在 draft 添加 suspend tombstone 后，结果变为 `suspended`，pack 记录仍保留为被遮蔽来源。移除当前 draft 拥有的 tombstone 后，解析再次得到 pack 记录。若传入的层均没有这个 Spot，则即使存在 tombstone，结果也是 `missing`。完整过程与边界见 [[definition-source-resolution]]。

源码入口：`src/data-services/datapack/source.ts`、`manifest.ts`、`pack-parser.ts`、`zip-loader.ts`、`src/data-services/archive/archive-writer.ts`、`src/data-services/definition/definition-resolution.ts`、`definition-types.ts`。测试见 `tests/data/datapack/pack-parser.test.ts`、`zip-loader.test.ts`、`archive-writer.test.ts`、`definition-resolution.test.ts`。

继续阅读：[[datapack-and-registry]]、[[authoring-policy-and-builders]]。
