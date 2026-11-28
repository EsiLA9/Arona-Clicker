# Task 0437 · 独立 Datapack 编辑器与 CLI 文件组织工具

状态：待处理

对应 [M01 首批工具交付](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md) 与 A3/B5 的文件组织部分。依赖 [[ai/plan/task-0435-datapack-multifile-source]]、[[ai/plan/task-0436-datapack-layout-transform]]。无需等待 M02 引用目录、M03 构建和 M04 草稿。

## 当前依据与施工

- `tools/datapack-editor/ui/main.ts` 已绑定导入和包下载。`ui/io.ts:fileInputImport` 仅收单 JSON/ZIP，ZIP 导入只向编辑器回传合并数据与 manifest。沿用现有工具，加入目录选择，保留 `ProjectRead` 用于文件组织及来源显示。兼容原表单继续消费 Datapack 合并结果，保留既有 JSON 导入、ZIP 导出等入口。文件组织针对本次打开的文件副本。表单有未保存改动时，说明当前组织输入并允许取消，避免对作者展示的内容和实际导出内容不一致。
- 在现有工具提供按表拆、按实体拆、选中文件合一、全合、快速分组的真实入口。同一预览显示目标目录、来源和问题。手工调整路径走 Task 0436 的覆写字段，确认后下载 ZIP 副本。取消不写入。可再导入输出 ZIP 查来源。当前浏览器下载的产品文案说明是副本。
- 在 `package.json` 登记一条现有工程风格的 Node 命令入口（建议 `datapack:layout`），适配目录、ZIP、单 JSON，调用与 UI 相同的读取及计划。支持预览、选择路径或指定规则、显式新输出目录/ZIP，输出可定位诊断。手工覆写和自定义规则沿用公共输入形状。Node 入口只负责编解码、stdout 和文件写入。M14 可在该入口上扩展，避免重建第二套转换命令。
- 旧默认数据 glob 和表单导出接口只在本任务需要接线处适配，生产导出归并留给后续 Task。产生新 UI 时遵循项目对应独立工具的视觉约定和桌面范围。

## 可用交付与验收

作者在独立工具打开真实目录，选文件合一，预览按 Init 或系列分组，手工移动一个文件后下载。用 CLI 对同一输入和规则导出新目录，比较内容和资产，验证可以回读。重复目标、漏选或坏 JSON 可定位，取消及预览不改变输入。通过 `npm test -- tools/datapack-editor/ui/io.test.ts` 及新增的实际命令入口回归，补一次桌面浏览器验收。完成即视为 M01 首批文件组织工具交付。

## 当前进展

已定位导入/导出调用方，待前置任务和施工授权。先让 UI 与 CLI 拿到同一读取结果，再接共同预览与输出。
