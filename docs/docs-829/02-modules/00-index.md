# 02-modules/00-index — 模块卡片入口

> 本文按主要源码模块路由；每张卡片只说明职责边界、关键入口、测试位置和相关专题。**模块**是职责分区，不保证一个模块只对应一个文件或一个执行步骤。

第一次了解项目时，先读 [[docs/docs-829/01-architecture/run-logic]] 看启动顺序，再按问题选择模块卡。静态源码依赖、程序运行时的调用顺序和数据传递分别描述不同关系；全局依赖方向见 [[docs/docs-829/01-architecture/dependency-map]]。

| 模块 | 卡片 | 源码 |
| --- | --- | --- |
| 应用与 Runtime | [[docs/docs-829/02-modules/app-runtime]] | `src/app/`、`src/arona-clicker/runtime/runtime*.ts` |
| Data Services | [[docs/docs-829/02-modules/data-services]] | `src/data-services/` |
| Engine | [[docs/docs-829/02-modules/engine]] | `src/engine/` |
| AronaClicker Domain | [[docs/docs-829/02-modules/arona-clicker]] | `src/arona-clicker/` |
| UI | [[docs/docs-829/02-modules/ui]] | `src/ui/` |
| Datapack Editor | [[docs/docs-829/02-modules/datapack-editor]] | `tools/datapack-editor/` |

从概念与协作关系进入 [[docs/docs-829/06-wiki/00-index]]；查数据语义走 [[docs/docs-829/03-data-structures/00-index]]；查运行行为走 [[docs/docs-829/04-mechanisms/00-index]]。
