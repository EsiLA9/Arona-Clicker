# Task 0440 · Datapack 实体识别与定义查询

状态：待处理

## 目标与范围

交付 [M02-A](../../docs/prototype-blueprints/AC-module-blueprints-v3/02-definition-catalog.md) 的可查询目录。在现有 CLI 给出一个实际的 `find` 入口，能按表、精确 ID、名称或源文件定位定义，显示同键声明及读取完整度。以已验收的 M01 为前置。

## 当前实现

`src/data-services/datapack/project-source.ts:readProject` 提供 `ProjectRead.definitions`。每条有原始 `value`、表、同表序号、`occurrenceId` 和 `source`。部分项目仍有可读声明，完整项目另外提供合并 Datapack。合并结果不能找回重复定义。M01 的 `projectEntityKey` 为文件组织尝试 `id/resourceId`，未按领域表核对。运行 `Registry` 消费有效定义。独立编辑器的 `TABLES` 由已有 Schema 生成内容与 `editor-extras` 合成，`ui/navi.ts:resolveRef` 用首条表单行处理导航。当前 `scripts/datapack-layout.mjs:inspect` 已能列出来源，但没有按实体键分组查询。

## 目标设计与施工

在基础数据服务中建立从 `ProjectRead` 生成的只读目录。声明标识使用 `(packageRef, occurrenceId)`，逻辑查询键使用 `(table, key)`。二者分别用于定位和查找。换文件后可用逻辑键重新查询，返回新的 Pointer。记录保留原值和原序，普通列表用按表声明的 `id`，`resourceDisplays` 用 `resourceId`，三个单例以表识别。键保持大小写。Active/Passive Entry 保留物理表和各自来源，需要联合查询时同时查两个表。建立通用列表的物理浏览，首批保证 Init、Area、Spot、AreaMap、Story、Active/Passive Entry、StoryDirectory、Pic、ColorGroup、Character、Variant 及资源显示的类型识别和三种单例。Tags、extras 或含特殊组合语义的内容按来源浏览，范围内未实现的领域解析明确标出。

提供 `find`、按声明取详情和按表/键取候选。候选以数组保存，同包同键输出全部并标记重复，缺键行仍能按位置查详情。只扫描该次提供的输入。缺文件或未提供 manifest 声明的依赖时，附带未查范围。发现了一条候选只说明所选输入中看见一条，不能据此确认全局唯一。首轮可显式提供若干只读依赖作为候选来源，条件只覆盖调用方给定的范围，多个候选不自动选有效值。涉及深合并、字段来源和全量多版本组合的能力随 M03 的实际组合消费者推进。

在 `scripts/datapack-layout.mjs` 共用现有打开入口。保留 `inspect` 输出用途，增加 `find <输入> [--table <表>] [--id <精确键>] [--query <名称或 ID>] [--file <包内路径>]`，返回只读查询结果及覆盖状态。验证冷启动或缓存重建时 stdout 仍为单一 JSON，Vite 构建日志改走 stderr 或通过该命令的日志级别抑制。Schema 在本任务只需复用已有表名和身份依据。字段详情供 0442 从现有 `TABLES` 展示，基础服务不导入 `tools/` 或 UI，后续 CLI 字段描写扩展按实际需求。

## 交付与验收

用 `addition-test:spot:scanner` 返回 `00-world.json#/spots/0`，用 `addition-test:story:welcome` 返回 `02-story.json#/stories/0`。将 scanner 整条复制到测试副本另一个有效分片，查询输出两处。再加缺键条目和坏文件，核对可定位的原值、重复状态、未查范围及空结果区别。查一对真实 Character/Variant，并验证 `resourceId` 和一个单例。将目录/ZIP/单 JSON 的已知行为沿用，以实际 CLI 验证退出码、冷启动 stdout 和不写入。以 `tools/datapack-editor/ui/project-layout.test.ts` 和现有 Registry 行为用例作兼容回归，新增公共查询与命令回归。

## 工作项

- [ ] 按已验收的物理声明建目录与分类，接入精确键、名称、文件和声明查询。
- [ ] 接实际 CLI 并用真实样本验证重复、缺键和不完整查询。

## 施工记录

待施工。
