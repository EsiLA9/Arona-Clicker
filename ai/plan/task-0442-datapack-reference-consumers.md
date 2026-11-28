# Task 0442 · 独立编辑器的定义与引用查询入口

状态：待处理

## 目标、现状和范围

交付 [M02-C](../../docs/prototype-blueprints/AC-module-blueprints-v3/02-definition-catalog.md) 的首个作者界面。依赖 [[ai/plan/task-0440-datapack-definition-catalog]] 与 [[ai/plan/task-0441-datapack-reference-index]]。用现有独立工具读入的 Datapack 在同一入口查询实体、打开原始声明、查看正反向引用并跳到可定位的源或目标。此任务为只读能力，不依赖 0438、M04 草稿或 M05 Workbench。

`tools/datapack-editor/ui/file-layout.ts` 已持有本次导入的 `ProjectRead`，用于源文件树和转换预览。普通表单的 `EditorModel` 持有自己的编辑历史。`ui/navi.ts:resolveRef` 按表单行查找，没有原始文件或重复声明的定位。当前 `Datapack` 布局页面可浏览不完整项目，因此适合作为作者查询的实际宿主。`task-0432` 负责游戏内 Workbench 的关系展示、跳转和编辑，承接同一基础服务。

## 目标设计与施工

在现有文件组织源区接一个「定义与引用」入口，共用当前 `ProjectRead`。按表、名称或 ID 使用共同 `find` 查询。选中搜索结果或源树声明时，右侧查询区显示表、键、包内路径和 Pointer，列出出向、入向引用及解析状态。引用行可打开目标声明；入向边可回到具体来源字段。局部节点停留在所属地图记录内，需要时显示局部 Pointer。歧义时列出具体候选，缺输入或字段定位不足时显示可用范围与定位精度。重复 ID 的导航按声明选择，不自动跳到首条。

用现有 `schema/datapack.schema.ts:TABLES` 为受支持的已知字段补表单名称及类型，未知字段显示原键和值。项目缺少部分文件仍能查询可读内容，输出保持现有完整度门槛。查询和局部定位操作只更新源区选择与查询区，保留布局操作和预览输入。换项目时清空旧选择并使用新快照重新查询。原表单未保存编辑仍留在表单，查询区标明使用导入源。保留 `navi.ts` 当前表单导航和实时候选，因为它消费当前可编辑行。基于草稿切换候选与可写关系由 M04/M06 和 Task 0432 另接。

## 验收

打开真实 addition-test，查 scanner 以及 welcome Entry，从 Entry 跳 Story，再从 Story 的入向边跳回 `02-story.json` 中的原字段。用双声明、缺失依赖、坏分片和无精确字段位置的副本验证选择与诊断。表单有未保存修改时，打开查询仍看到导入源，返回保留表单变更。重新导入不同副本后，旧选择失效。与 CLI 查询同一数据对照目标、位置和置信度，补桌面浏览器验收及受影响的 `tools/datapack-editor/ui/io.test.ts`、`navi.test.ts` 等回归。

## 工作项

- [ ] 将现有源树和查询区接共同定义、引用服务。
- [ ] 验证真实作者流程、歧义、诊断及表单状态保持。

## 施工记录

待施工。
