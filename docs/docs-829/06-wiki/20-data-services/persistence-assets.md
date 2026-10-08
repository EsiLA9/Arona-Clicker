# 06-wiki/20-data-services/persistence-assets — 持久化与图片资产

本文回答 Data Services 中图片资源、存储适配和归档写入各自负责的范围。

“存储”在这里指几种不同工作：`SaveSystem` 保存玩家存档 JSON，包管理器的存储端口保存已导入包和启用顺序，`ArchiveWriter` 则把给定文件条目写成 ZIP。图片登记是另一条运行时资产流程，不是存档字段，也不是 ZIP 导出。

包解析器从包文件读取图片并生成带路径的资源 URL；PackManager 的 Runtime target 清理旧登记并按包重新登记。`PicService` 负责基于图片定义解析引用、查询定义、列出定义及将已解析图片登记到 `ImageStore`。图片 ID 和定义字段见 [[docs/docs-829/03-data-structures/datapack-contracts]]。

`persistence/` 提供 `StorageAdapter` 抽象和 `SaveSystem` 的 LocalStorage 适配；`SaveSystem` 负责主存档 JSON 编解码、固定格式版本检查和基础读写，不编排 Runtime 生命周期，也不解析字段语义。当前 `SaveData` 可带可选 Gameplay B `operationRun` checkpoint；其事件版本校验、Registry 内容重建和 Run 恢复由 AronaClicker Runtime 负责。`archive/` 的 `ArchiveWriter` 把规范化后的相对路径条目写成 ZIP，检查路径、重复项及内容类型。它处理归档输出，不等同于 Datapack 语义校验。

存档、包记录、包资源和 ZIP 导出属于不同数据流。本文不推断其间自动同步关系；应用图片与包选择流程见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]，模块入口见 [[docs/docs-829/02-modules/data-services]]。

## 从哪里核对

- `src/data-services/assets/pic-service.ts`：`PicService.urlOf()` 解析图片引用，`defOf()` 和 `list()` 查询图片定义，`register()` 将已解析资源交给 `ImageStore`；它不负责读取包文件。
- `src/data-services/persistence/storage.ts` 的 `SaveSystem.save()`、`load()`、`import()` 与 `delete()` 处理固定版本的存档 JSON；`StorageAdapter` 把实际读写委托给 LocalStorage。包库快照是另一条路径，由 `tests/data/pack-storage.test.ts` 覆盖；适配器入口由 `tests/data/storage-adapter.test.ts` 覆盖。
- `src/data-services/archive/archive-writer.ts` 的 `validateArchivePlan()` 检查相对路径、重复路径和 string/Uint8Array 内容；`ZipArchiveWriter.write()` 再生成 ZIP。`tests/data/archive-writer.test.ts` 验证稳定排序和路径安全。
- 图片解析、登记行为的测试入口是 `tests/engine/pics.test.ts`。应用加载后重建图片登记的时序见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]。
