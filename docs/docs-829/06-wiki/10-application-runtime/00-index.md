# 06-wiki/10-application-runtime/00-index — App Runtime 与应用生命周期

> 本文回答：应用入口、包管理、Runtime 组合根和 GameInstance 如何协作。

第一次阅读可按“启动并装配 → 应用启用包 → 进入 Init 和开始会话”的顺序阅读。这里的 **Runtime** 指持有游戏当前定义、状态与服务的运行对象；模块创建顺序、运行时调用和内容数据流是不同关系，完整区分见 [[docs/docs-829/01-architecture/run-logic]]。

| 功能页 | 主题 |
| --- | --- |
| [[docs/docs-829/06-wiki/10-application-runtime/startup-and-composition]] | 浏览器入口、App bootstrap、Runtime 装配 |
| [[docs/docs-829/06-wiki/10-application-runtime/pack-application]] | PackManager 如何把启用集应用到 Registry |
| [[docs/docs-829/06-wiki/10-application-runtime/lifecycle]] | Lobby、Init、会话、保存与重建 |

模块卡：[[docs/docs-829/02-modules/app-runtime]]。具体调用流：[[docs/docs-829/01-architecture/run-logic]]。

若要了解共享包与 Registry 职责，继续阅读 [[docs/docs-829/02-modules/data-services]]；字段归属和游戏状态结构见 [[docs/docs-829/03-data-structures/00-index]]。
