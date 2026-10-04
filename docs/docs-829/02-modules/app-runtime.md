# 02-modules/app-runtime — 应用 Runtime 模块卡

> 本文回答：应用入口如何构造 AronaClicker Runtime，并将产品服务与 Engine / Data Services 组合。

## 职责边界

- `src/app/runtime-bootstrap.ts` 提供轻量 App 工厂与默认包应用入口。
- `src/arona-clicker/runtime.ts` 组合 PackManager、GameInstance 和产品热内容协调器。
- `src/arona-clicker/runtime-game-instance.ts` 提供 Runtime 门面与状态生命周期入口。
- `src/arona-clicker/runtime-wiring.ts` 构造并接线 Engine 机制和领域服务。
- UI 启动见 `src/ui/main.ts`；通用机制细节归 `src/engine/`，内容加载能力归 `src/data-services/`。

## 主要入口与验证

| 主题 | 路径 |
| --- | --- |
| 启动与包应用 | `src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts` |
| 组合根与生命周期 | `src/arona-clicker/runtime-game-instance.ts`、`runtime-wiring.ts` |
| UI 初始化 | `src/ui/main.ts` |
| 相关测试 | `tests/engine/arona-runtime-pack.test.ts`、`tests/engine/runtime-world-hot-crud.test.ts` |

概念与分功能路由：[[docs/docs-829/06-wiki/10-application-runtime/00-index]]；完整调用流：[[docs/docs-829/01-architecture/run-logic]]。
