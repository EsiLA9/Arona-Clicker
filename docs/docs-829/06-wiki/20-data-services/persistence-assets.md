# 06-wiki/20-data-services/persistence-assets — 持久化与图片资产

本文回答 Data Services 中图片资源、存储适配和归档写入各自负责的范围。

包解析器从包文件读取图片并生成带路径的资源 URL；PackManager 的 Runtime target 清理旧登记并按包重新登记。`PicService` 负责基于图片定义解析引用、查询定义、列出定义及将已解析图片登记到 `ImageStore`。图片 ID 和定义字段见 [[docs/docs-829/03-data-structures/datapack-contracts]]。

`persistence/` 提供 `StorageAdapter` 抽象和 `SaveSystem` 的 LocalStorage 适配；`SaveSystem` 负责主存档 JSON 编解码、固定格式版本检查和基础读写，不编排 Runtime 生命周期，也不解析字段语义。当前 `SaveData` 可带可选 Gameplay B `operationRun` checkpoint；其事件版本校验、Registry 内容重建和 Run 恢复由 AronaClicker Runtime 负责。`archive/` 的 `ArchiveWriter` 把规范化后的相对路径条目写成 ZIP，检查路径、重复项及内容类型。它处理归档输出，不等同于 Datapack 语义校验。

存档、包记录、包资源和 ZIP 导出属于不同数据流。本文不推断其间自动同步关系；应用图片与包选择流程见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]，模块入口见 [[docs/docs-829/02-modules/data-services]]。
