# Task 0161 Patch Units

此目录将 Task 0161 的跨层施工拆为六个可独立核验的 Unit；各 Unit 的唯一文件白名单与验收见对应正文，执行证据放在 `receipts/`。机制目标、总体验收与状态仍以根目录的 `task-0161-theme-background-layer-lifecycle-pipeline.md` 为准。

| Unit | 范围 | 状态 |
| --- | --- | --- |
| [[task-0161-u01-runtime-source-snapshots]] | Runtime 来源快照、按来源替换 Preview 背景 | 完成 |
| [[task-0161-u02-selector-projection]] | 选择页全局基底与焦点主题投影 | 完成 |
| [[task-0161-u03-theme-layer-inheritance]] | 用户图层继承、空覆盖与编辑器 Preview | 完成 |
| [[task-0161-u04-task-transfer-and-docs]] | 0158 归档、0161 接管、机制文档更新 | 完成 |
| [[task-0161-u05-selector-surface-vars]] | 选择页子树与 body 外背景使用来源一致的 CSS 变量 | 完成 |
| [[task-0161-u06-restart-selector-init-theme]] | Restart 撤离选择页不叠加当前 Area 主题 | 完成 |

整体浏览器验收与未解决项仍以根 Task 状态为准；Unit 完成不代替 Task 终态核验。
