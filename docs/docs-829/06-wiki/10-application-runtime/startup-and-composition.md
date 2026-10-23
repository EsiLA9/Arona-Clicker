# 06-wiki/10-application-runtime/startup-and-composition — 启动与 Runtime 装配

> 本文回答：打开游戏后，哪些对象先被创建，哪些步骤会真正装入游戏内容？

**Runtime（运行时）** 是游戏启动后持有定义、状态和服务的对象。**组合根**是创建对象并连接依赖的地方。它负责把部件接起来，但不是所有业务的执行者。

## 先分清依赖和执行顺序

- **静态 import**：文件声明需要另一个模块；它告诉我们代码依赖方向。
- **运行时调用**：程序执行时一个函数调用另一个函数；下面的启动顺序是调用流程。
- **数据流**：Datapack 定义或图片由包记录流向 Runtime，再进入 Registry 或图片存储。
- **事件协作**：服务经 EventBus 发出事件，订阅者收到后执行自己的更新。启动图中的箭头不表示 EventBus。

全局静态依赖见 [[docs/docs-829/01-architecture/dependency-map]]；整体启动路线见 [[docs/docs-829/01-architecture/run-logic]]。

## 实际启动顺序

`src/ui/main.ts` 模块先导入 UI、Runtime 工厂和包存储，并创建 Runtime 实例。之后 `boot()` 异步恢复浏览器中的包快照、发现并对账开发包，再应用当前启用包。包应用完成后才创建并挂载 `UIController`。

```text
main.ts 创建 Runtime
  → boot(): restorePackManager()
  → reconcileDevelopmentPacks()
  → loadDefaultDatapack() → applyEnabledPacks()
  → PackManager 调用 Runtime 的 Apply target
  → Runtime.reload() → GameInstance.init()
  → UIController.mount()
```

这里存在两层创建和调用：

1. `createAppRuntime()` 是 App 工厂，创建 `AronaClickerRuntime`。
2. `GameInstance` 构造函数调用 `wireGameInstance()`，创建并连接 EventBus、Registry、Engine 系统和领域服务；`AronaClickerRuntime` 随后设置 PackManager 与产品内容管理器。
3. `boot()` 才按顺序恢复、应用包并挂载 UI。

因此，“构造时创建了 SessionService”不等于此刻已启动 Tick。只有进入游戏后 UI 调用 Runtime 的 `start()`，SessionService 才驱动会话。新 Init、恢复 Init 和重载的差别见 [[docs/docs-829/06-wiki/10-application-runtime/lifecycle]]。

## 谁负责哪一段

| 部件 | 负责什么 |
| --- | --- |
| `src/ui/main.ts` | 启动顺序、浏览器包存储恢复、开发包发现、UI 挂载 |
| `src/app/runtime-bootstrap.ts` | 创建 Runtime；将“加载默认内容”转到启用包应用 |
| `src/arona-clicker/runtime/runtime.ts` | 产品层组合根；管理 PackManager 和包应用回调 |
| `src/arona-clicker/runtime/runtime-game-instance.ts` | 持有组合后的 Registry、系统和服务，提供初始化及生命周期门面 |
| `src/arona-clicker/runtime/runtime-wiring.ts` | 创建底层系统与领域服务，并为它们连接共同依赖 |
| `src/data-services/` | 提供 Datapack、包管理、Registry 等共享内容能力 |

模块职责卡：[[docs/docs-829/02-modules/app-runtime]]、[[docs/docs-829/02-modules/data-services]]。包计划如何应用到 Registry 和图片见 [[docs/docs-829/06-wiki/10-application-runtime/pack-application]]。

## 源码与验证

- 启动：`src/ui/main.ts` 的 `boot()`。
- 工厂：`src/app/runtime-bootstrap.ts` 的 `createAppRuntime()`、`loadDefaultDatapack()`。
- 接线和包应用：`src/arona-clicker/runtime/runtime.ts`、`runtime-game-instance.ts`、`runtime-wiring.ts`。
- 验证入口：`tests/engine/arona-runtime-pack.test.ts` 核对启用包进入 Registry、初次启动留在 Lobby、包库快照恢复与无效包停用。
