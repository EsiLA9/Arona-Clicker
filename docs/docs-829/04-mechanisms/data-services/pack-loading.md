# 04-mechanisms/data-services/pack-loading — Datapack 解析与应用

本文回答一个包如何从文件来源成为运行时内容，以及包内校验和启用集校验的边界。

## 解析

`parsePack()` 从 `PackSource` 列出条目，要求根目录 `datapack.json`，解析 manifest 后读取 JSON 分片并合并为 `Datapack`；支持的图片文件会读为资源 URL。manifest 与分片的 `name`、`version` 必须相同，manifest 的 `modName` 覆盖到 Datapack。ZIP 入口先构造 ZIP 来源，再复用同一解析流程。解析错误会带文件路径（可得时）。

解析阶段验证 manifest 格式、JSON 可解析性和分片合并要求；这不是完整内容语义校验。

## 包记录、选择和校验

`PackManager` 保存包记录、顺序、启用状态与选择配置。配置验证要求记录存在、启用集没有重复 `modName`，并满足 manifest 声明的依赖。AronaClicker 产品包库还要求启用集恰有一个 `modName=base` 的记录；基础包不能直接停用或删除，必须通过同名交换替换，旧记录会回到未启用列表以供回退。

产品发布基础包由 `src/arona-clicker/content/base-pack/datapack.json` 与 JSON 分片打包，记录来源标为 `bundle`。它与 `datapack-dev/` 的来源对账无关；发布基准只读，复制出的新 Version 编辑态记录可以进入启用序列并由 RuntimeEditor 保存。旧快照中的 `builtin` 来源不再定义是否必需，必需性由 `base` 槽位承担。

保留原 TypeScript 内容模块的同时，可运行 `npm run datapack:export-base` 生成标准 Base 文件夹包，默认位于 `datapack/base@<Version>/`。导出包含 manifest、JSON 分片和图片资源；图片引用转为包内 `zip:` 路径。该目录是从现有 TypeScript 内容重新生成的包产物，不会替换 Runtime 当前读取的 JSON 发布资源。导出测试会经 `FolderPackSource` / `parsePack()` 解析并与 TS 组合逐字段比较。

现有 RuntimeEditor 可编辑 Init、Area、Spot、Enhancement。基础包的其它内容表在 RuntimeEditor 保存时继续从原记录保留；字段级人工编辑覆盖另见对应施工 Task。

提交配置前，管理器可将将要应用的 Datapack 列表交给 `target.validate`。应用目标据此构建候选运行时 Registry；包按顺序校验时，部分引用可使用此前加载的定义。单包调用 `Registry.validate(dp)` 只使用当前 Registry 上下文与该包内容；具体引用字段仍可能限定包内，例如 `Area.defaultSpots` 只查本包 Spot 表，不应据此假设所有跨包引用都可解。

## Runtime Apply

应用计划按包顺序产生 Datapack 列表，调用目标的 `reload(datapacks)`，清除旧图片资源，再按包登记新图片。目标可提供 capture/restore；应用中抛错时，若存在快照及 restore，则尝试恢复并向上抛出原始错误。PackManager 对 Runtime Apply 与普通启用配置均沿目标接口委派 Registry 重载，具体 Runtime 目标由调用方装配。

完整协作关系见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]；表合并语义见 [[docs/docs-829/03-data-structures/registry]]。
