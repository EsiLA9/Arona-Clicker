# 压缩归档

退役正文统一存入 `history.zip`；此处只保留本说明和压缩包，避免 Obsidian 索引大量历史 Markdown。旧归档正文已于 2026-10-30 删除，本压缩包不会补回已删除内容，首次投入时创建。

在项目根目录运行：

```powershell
npm run archive:docs -- add ai/plan/task-编号-主题.md
npm run archive:docs -- add ai/plan/task-编号-units
npm run archive:docs -- list
npm run archive:docs -- read ai/plan/task-编号-主题.md
```

其他待封存资料先放入 `ai/archive/inbox/<批次>/`，再使用 `add ai/archive/inbox/<批次>`。`add` 保留项目相对路径、校验压缩字节后移除原文件；同名条目拒绝覆盖，已有包损坏或并发锁占用时保留源文件。异常退出可能留下 `history.zip.lock` 或 `history.zip.tmp`；确认没有归档进程后才清理并重试。

`list` 可附包内路径前缀；`read` 接收完整包内路径并输出原文，两者均不解压。需要导出时写到 Vault 之外，不把历史正文重新展开到此处。归档后同步移除活动索引，并修正指向原文件的链接；包内条目不是 WikiLink 目标。历史仅用于追溯，当前机制仍以源码、测试与 `docs/docs-830/` 为准。
