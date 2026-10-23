# 02-modules/app-runtime — 应用 Runtime 模块卡

> 本文回答：应用入口如何构造 AronaClicker Runtime，并将产品服务与 Engine / Data Services 组合。

这里说的 **Runtime（运行时）** 是游戏启动后持有当前内容、状态与服务的对象。**组合根**是创建这些对象并把它们连接起来的入口；它负责“谁创建谁、谁把依赖交给谁”，不代表所有功能都由这个入口执行。

## 职责边界

- `src/app/runtime-bootstrap.ts` 提供 `createAppRuntime()` 工厂；`loadDefaultDatapack()` 将启动转给 Runtime 的 `applyEnabledPacks()`。
- `src/arona-clicker/runtime/runtime.ts` 组合 PackManager、继承自 `GameInstance` 的产品 Runtime 和产品内容管理器。它提供 Apply target，让包管理计划可以调用校验、重载和图片处理回调。
- `src/arona-clicker/runtime/runtime-game-instance.ts` 提供 Runtime 门面与状态生命周期入口；构造时调用 `wireGameInstance()` 创建并连接 Engine 系统和领域服务。
- `src/arona-clicker/runtime/runtime-wiring.ts` 构造并接线 Engine 机制和领域服务。
- UI 启动见 `src/ui/main.ts`；通用机制实现归 `src/engine/`，共享内容契约、包管理和 Registry 等基础能力归 `src/data-services/`。

静态 import 方向不等于运行时调用顺序。启动步骤见 [[docs/docs-829/01-architecture/run-logic]]；包计划怎样交给 Runtime 见 [[docs/docs-829/06-wiki/10-application-runtime/pack-application]]；数据服务模块不负责产品状态编排，见 [[docs/docs-829/02-modules/data-services]]。

## 主要入口与验证

| 主题 | 路径 |
| --- | --- |
| 启动与包应用 | `src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime/runtime.ts` |
| 组合根与生命周期 | `src/arona-clicker/runtime/runtime-game-instance.ts`、`runtime-wiring.ts` |
| UI 初始化 | `src/ui/main.ts` |
| 相关测试 | `tests/engine/arona-runtime-pack.test.ts`、`tests/engine/runtime-world-hot-crud.test.ts` |

概念与分功能路由：[[docs/docs-829/06-wiki/10-application-runtime/00-index]]；完整调用流：[[docs/docs-829/01-architecture/run-logic]]。
