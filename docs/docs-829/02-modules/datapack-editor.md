# 02-modules/datapack-editor — 独立 Datapack Editor 模块卡

> 本文回答：独立数据包编辑器如何使用生成 Schema 编辑 Datapack。

## 职责边界

- 独立工具位于 `tools/datapack-editor/`，与游戏内 `src/ui/runtime-editor/` 是不同入口。
- `schema/` 构建编辑器表；`model/` 维护编辑模型；`validate/` 做编辑侧校验；`ui/` 提供独立编辑器界面。
- 引擎与数据服务契约通过生成的 `schema/engine-defs.gen.json` 进入编辑器；复杂字段配置由 `schema/editor-extras.ts` 补充。

## 常用入口

- `npm run dev:editor` 启动独立编辑器；`npm run gen:schema` 更新生成协议。
- 同步护栏：`tools/datapack-editor/schema/engine-schema.sync.test.ts`。
- 源字段与协议步骤见 [[docs/docs-829/05-conventions/schema-sync]]。
