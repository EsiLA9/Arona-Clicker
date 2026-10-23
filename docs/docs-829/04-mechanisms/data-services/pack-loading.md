# 04-mechanisms/data-services/pack-loading — Datapack 解析与应用

本文回答一个包如何从文件来源成为运行时内容，以及包内校验和启用集校验的边界。

可以先把它看成四步：**读取文件 → 解析为 Datapack → PackManager 选出启用集 → Runtime 将整组内容应用到 Registry**。`PackManager` 管理包记录和启用选择；`Registry` 是 Runtime 供服务查询已装入定义的表。它们不是同一份数据。

## 解析

`parsePack()` 从 `PackSource` 列出条目，要求根目录 `datapack.json`，解析 manifest 后读取 JSON 分片并合并为 `Datapack`；支持的图片文件会读为资源 URL。manifest 与分片的 `name`、`version` 必须相同，manifest 的 `modName` 覆盖到 Datapack。ZIP 入口先构造 ZIP 来源，再复用同一解析流程。解析错误会带文件路径（可得时）。

解析阶段验证 manifest 格式、JSON 可解析性和分片合并要求；这不是完整内容语义校验。

## 包记录、选择和校验

`PackManager` 保存包记录、顺序、启用状态与选择配置。配置验证要求记录存在、启用集没有重复 `modName`，并满足 manifest 声明的依赖。AronaClicker 产品包库还要求启用集恰有一个 `modName=base` 的记录；基础包不能直接停用或删除，必须通过同名交换替换，旧记录会回到未启用列表以供回退。

产品发布基础包由 `src/arona-clicker/content/base-pack/datapack.json` 与 JSON 分片打包，记录来源标为 `bundle`。当前发布版本为 `base@1.0.2`。它与 `datapack-dev/` 的来源对账无关；发布基准只读，复制出的新 Version 编辑态记录可以进入启用序列并由 RuntimeEditor 保存。旧快照中的 `builtin` 来源不再定义是否必需，必需性由 `base` 槽位承担。

Gameplay B 当前默认只装载 Map 内容：可选 bundle `gameplay-b@1.0.0` 由 Runtime 装配 `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`，依赖 `base`，只声明 `maps` 和 `Spot.mapEntry`，不带 Operation Event / Location / Action / Profile 表。首次发现此包时默认启用；快照已记录该包、Pane 已有明确选择，或已有同 Mod 启用项时不覆盖玩家选择。

旧 13 地点 Strategy Park bundle `gameplay-b-strategy-park@1.0.0` 已从默认装配中退役。恢复旧包库快照时，Runtime 将该精确 `bundle` 身份列为退役项；`PackManager` 只移除对应的内置 bundle 记录，清理没有剩余记录的选择 Pane，并保存清理后的快照。用户导入包与编辑态副本不会因为这个内置退役规则被删除。

同 ID 的 `gameplay-b@1.0.0` bundle 在恢复时以当前 Map-only 内容替换旧混合 Carousel Operation / Map 内容，保留其包记录与启用选择。旧 `operationRun` 若引用已从 Registry 移除的 Gameplay B Event，会被 Operation 恢复流程拒绝；Runtime 记录失效提示，活动 Operation checkpoint 不会安装，后续存档写入时清除该旧 checkpoint。普通玩家状态仍按原 Save 流程恢复。

保留原 TypeScript 内容模块的同时，可运行 `npm run datapack:export-base` 生成标准 Base 文件夹包，默认位于 `datapack/base@<Version>/`。导出包含 manifest、JSON 分片和图片资源；图片引用转为包内 `zip:` 路径。该目录是从现有 TypeScript 内容重新生成的包产物，不会替换 Runtime 当前读取的 JSON 发布资源。导出测试会经 `FolderPackSource` / `parsePack()` 解析并与 TS 组合逐字段比较。

现有 RuntimeEditor 可编辑 Init、Area、Spot、Enhancement。基础包的其它内容表在 RuntimeEditor 保存时继续从原记录保留；字段级人工编辑覆盖另见对应施工 Task。

提交配置前，管理器可将将要应用的 Datapack 列表交给 `target.validate`。应用目标据此构建候选运行时 Registry；包按顺序校验时，部分引用可使用此前加载的定义。单包调用 `Registry.validate(dp)` 只使用当前 Registry 上下文与该包内容；具体引用字段仍可能限定包内，例如 `Area.defaultSpots` 只查本包 Spot 表，不应据此假设所有跨包引用都可解。

## Runtime Apply

应用计划按包顺序产生 Datapack 列表，调用目标的 `reload(datapacks)`，清除旧图片资源，再按包登记新图片。目标可提供 capture/restore；应用中抛错时，若存在快照及 restore，则尝试恢复并向上抛出原始错误。PackManager 对 Runtime Apply 与普通启用配置均沿目标接口委派 Registry 重载，具体 Runtime 目标由调用方装配。

完整协作关系见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]；表合并语义见 [[docs/docs-829/03-data-structures/registry]]。

## 入口与验证

- 源码：`src/data-services/datapack/pack-parser.ts`、`pack-manager.ts`、`source.ts`；产品启用集入口：`src/arona-clicker/runtime/runtime.ts:applyEnabledPacks()`。
- 测试：`tests/data/pack-source.test.ts`、`pack-parser.test.ts`、`pack-manager.test.ts`；产品 bundle 与 Registry 装载：`tests/engine/arona-runtime-pack.test.ts`。
- 往上看产品启动：[[docs/docs-829/01-architecture/run-logic]]；按问题浏览装载与作者流程：[[docs/docs-829/06-wiki/20-data-services/00-index]]。
