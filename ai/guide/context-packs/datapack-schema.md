# context-packs/datapack-schema — Datapack、Registry 与 Schema

> 本文回答：数据内容、引用验证与编辑器协议任务应从哪里进入。

| 任务 | 入口 |
| --- | --- |
| 包结构、解析与导入 | [[package-io-and-source-layers]] |
| Registry 装载与内容解析 | [[datapack-and-registry]] |
| 类型、字段或枚举的 Schema 同步 | [[ai/guide/conventions/schema-sync]] |
| 独立 Datapack Editor | [[datapack-editor-and-schema]] |
| 游戏内 Runtime Editor | [[runtime-editor-and-project-checks]]、[[runtime-content-coordination]] |

先按任务读取对应契约、Registry 实现与测试。改作者字段时同步源类型、生成 Schema、编辑器补充元数据和相关验证；不手改生成文件。