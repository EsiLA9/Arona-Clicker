# 02-modules/data-services — Data Services 模块卡

本文回答 Data Services 的源码边界、主要入口与深入阅读路径。

`src/data-services/` 为声明式内容提供契约、Datapack 解析与包选择、Registry 汇总和索引、定义解析、内容作者策略、图片资产及存储适配。它不负责 AronaClicker 的业务状态编排。

主要入口：`contracts/datapack.ts`、`datapack/pack-parser.ts`、`datapack/pack-manager.ts`、`registry/registry.ts`。包应用由 Runtime 提供目标回调；Registry 本身不读文件或存档。

| 需要了解 | 文档 |
| --- | --- |
| 契约集合和字段归属 | [[docs/docs-829/03-data-structures/datapack-contracts]] |
| Registry 表与索引 | [[docs/docs-829/03-data-structures/registry]] |
| 解析、启用与应用流程 | [[docs/docs-829/04-mechanisms/data-services/pack-loading]] |
| 与编辑、资产及持久化的协作 | [[docs/docs-829/06-wiki/20-data-services/00-index]] |

相关验证位于 `tests/data/` 的 Registry、Pack Manager、Pack Parser、作者策略和资产测试，以及 `tests/engine/arona-runtime-pack.test.ts`。
