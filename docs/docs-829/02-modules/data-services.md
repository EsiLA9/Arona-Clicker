# 02-modules/data-services — Data Services 模块卡

> 本文回答 Data Services 的源码边界、主要入口与深入阅读路径。

`src/data-services/` 为声明式内容提供契约、Datapack 解析与包选择、Registry 汇总和索引、定义解析、内容作者策略、图片资产及存储适配。**Registry** 是已装入定义的查询表和索引。这个模块提供共享基础能力，不负责 AronaClicker 的业务状态编排，也不会从这里反向创建产品 Runtime。

主要入口：`contracts/datapack.ts`、`datapack/pack-parser.ts`、`datapack/pack-manager.ts`、`registry/registry.ts`。程序运行时由 `AronaClickerRuntime` 调用 `PackManager.applyEnabled()`，并把 Apply target（应用目标回调）传进去；PackManager 依据包记录和启用选择生成计划，再调用 target。Datapack 和图片由 Runtime 应用；Registry 接收定义、建立查询索引，本身不读文件或存档。完整调用与失败恢复顺序见 [[docs/docs-829/06-wiki/10-application-runtime/pack-application]]。

| 需要了解 | 文档 |
| --- | --- |
| 契约集合和字段归属 | [[docs/docs-829/03-data-structures/datapack-contracts]] |
| Registry 表与索引 | [[docs/docs-829/03-data-structures/registry]] |
| 解析、启用与应用流程 | [[pack-loading]] |
| 与编辑、资产及持久化的协作 | [[docs/docs-829/06-wiki/20-data-services/00-index]] |

相关验证位于 `tests/data/` 的 Registry、Pack Manager、Pack Parser、作者策略和资产测试，以及 `tests/engine/arona-runtime-pack.test.ts`。

从浏览器启动到 Runtime 的组合关系见 [[docs/docs-829/02-modules/app-runtime]] 与 [[docs/docs-829/01-architecture/run-logic]]；此处只说明服务职责，不重复字段表或 Registry 校验细节。
