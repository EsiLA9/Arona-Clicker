# 06-wiki/10-application-runtime/startup-and-composition — 启动与 Runtime 装配

> 本文回答：当前游戏入口怎样创建产品 Runtime，并由组合根连接 Engine 与产品服务。

## 启动角色

`src/ui/main.ts` 创建 Runtime 与包存储，异步恢复 PackManager，应用默认包装载入口，随后构造并挂载 `UIController`。`src/app/runtime-bootstrap.ts` 中的 `createAppRuntime()` 仅创建 `AronaClickerRuntime`；`loadDefaultDatapack()` 委托给 Runtime 的 `applyEnabledPacks()`。

```text
src/ui/main.ts
  → src/app/runtime-bootstrap.ts:createAppRuntime()
  → AronaClickerRuntime（继承 GameInstance）
  → GameInstance constructor / wireGameInstance()
  → restorePackManager() / applyEnabledPacks()
  → UIController.mount()
```

## 组合根分工

- `AronaClickerRuntime` 增加 PackManager、应用策略及 Runtime Content 协调能力。
- `GameInstance` 持有组合后的 Registry、机制系统、产品服务、状态和生命周期门面。
- `wireGameInstance()` 创建服务并传入共享的 Registry、EventBus、写入 Port、查询回调和生命周期 hooks。
- `RuntimeEffectReactor` 等宿主适配器把通用 Engine 机制事件接到产品剧情、主题和聊天服务。

组合根的静态 import 结构和运行时执行流是两种关系；概览见 [[docs/docs-829/01-architecture/dependency-map]]。包应用见 [[docs/docs-829/06-wiki/10-application-runtime/pack-application]]。

## 代码入口

`src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts`、`runtime-game-instance.ts`、`runtime-wiring.ts`。运行与会话测试主要位于 `tests/engine/`。
