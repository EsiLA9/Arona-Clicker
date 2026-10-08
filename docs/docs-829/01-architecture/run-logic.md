# 01-architecture/run-logic — 启动、会话与 Tick

> 本文回答：打开游戏后，应用如何装入内容、显示界面，并在玩家开始后运行会话。

## 先分清四种关系

- **静态依赖**：文件通过 `import` 引用另一个模块，表示代码装配时可以使用它，不代表每帧都会调用它。
- **运行时调用**：程序执行时，一个函数把工作交给另一个函数；下方顺序图表示的就是这类先后关系。
- **数据流**：一份内容或状态从一个模块交给另一个模块，例如 Datapack 定义进入 Registry。
- **事件协作**：一个模块发出事件，订阅者收到后更新自己的状态或派生结果；它不是普通调用链的同义词。

## 从浏览器入口到界面

`src/ui/main.ts` 是游戏 UI 的启动文件。它先创建 `AronaClickerRuntime`（产品运行时）和包快照存储，再由异步 `boot()` 恢复包库、检查开发包并应用启用集，最后创建 `UIController` 并挂载界面。

```text
静态依赖：main.ts → App bootstrap / Runtime / UIController / 包存储

运行时调用：
main.ts 创建 Runtime
  → boot() 恢复 PackManager 快照
  → reconcileDevelopmentPacks()
  → loadDefaultDatapack() → applyEnabledPacks()
  → PackManager 调用 Runtime 提供的 Apply target
  → Runtime.reload() → GameInstance.init()
  → Registry.load() / 引用核验 / 派生系统重建
  → UIController.mount()

数据流：启用包中的 Datapack 定义 → Runtime → Registry
        启用包中的图片 → 图片存储 / 注册表
```

`GameInstance` 是产品运行时组合好的门面：构造时 `wireGameInstance()` 创建并连接 Registry、EventBus、状态写入口、Engine 系统和领域服务。这个创建/接线顺序只说明对象依赖，不是会话每秒执行的顺序。`AronaClickerRuntime` 再加入 PackManager、包应用和产品内容管理能力。

包应用不是“PackManager 自己直接读文件”。`PackManager` 保存包记录和选择，并根据这些记录生成应用计划；`AronaClickerRuntime` 提供回调，让计划可以校验 Datapack、重载运行时、清理旧图片并注册新图片。运行时会先留快照；应用失败时尝试恢复原运行时。包加载细节见 [[docs/docs-829/06-wiki/10-application-runtime/pack-application]]。

## Lobby、Init 与会话

初次启动装入包后，游戏 UI 留在 Lobby：没有活动 Init，也没有运行 Tick。**Init**（世界线）是包含起始区域、进度和专属规则的一段游戏状态。玩家从界面选择新世界线或恢复已有进度后，Controller 通过 Runtime 命令进入 Init 并调用 `start()`；`GameInstance.start()` 再交给 `SessionService` 启动定时会话。这里的“选择/恢复”和“会话开始”是连续的调用步骤，不是 Registry 的装载步骤。

`init(datapacks)` 负责加载定义、统一核验跨包引用并重建依赖定义和状态的系统。游戏 UI 的首次包应用会显式保持 Lobby；兼容其他直接调用方的 `init()` 默认行为则可自动进入第一个无显示门槛的 Init。包热替换时，Runtime 根据替换前是否已有活动 Init 决定是否恢复进入状态。

```text
装载完成 → Lobby（activeInit 为空、Tick 停止）
  → 玩家选择新 Init / 恢复 Init
  → Controller 进入游戏并调用 Runtime.start()
  → SessionService 定时调用 GameInstance.tick()
  → stop() 停止该会话
```

区域旅行、Init 重启、存档读写和数据包重载不是同一个“重建”动作。重载会先停会话、清注册表和机制缓存，再按选项初始化；`load()` 恢复存档状态；`reset()` 清运行状态；`dispose()` 停止会话并释放局内服务。细节见 [[docs/docs-829/06-wiki/10-application-runtime/lifecycle]] 与 [[docs/docs-829/03-data-structures/player-state]]。

## Tick 与事件

会话定时器由 `SessionService` 管理，它通过接线回调调用 `GameInstance.tick()`。`tick()` 推进 `TickSystem`，并处理持续效果、阻断复检和统计等步骤。Tick 内部通过定义与状态计算产出；业务状态更新走状态写入边界，并可发出事件，由订阅者更新可见性或其他派生系统。不要把“有事件”写成所有阶段都只通过 EventBus 调用；具体写入和事件顺序见 [[docs/docs-829/04-mechanisms/state-mutation]] 与 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]。

当前帧计数 `totalFrames` 在 `TickSystem` 直接递增；其状态写入口边界仍按 [[docs/docs-829/05-conventions/architecture-discipline]] 单独核对，本页不预裁定为通用规则的例外。

## 代码与测试入口

| 想核对什么 | 入口 |
| --- | --- |
| 浏览器启动与挂载 | `src/ui/main.ts`：`boot()` |
| Runtime 工厂 | `src/app/runtime-bootstrap.ts`：`createAppRuntime()`、`loadDefaultDatapack()` |
| 包管理与应用 | `src/arona-clicker/runtime.ts`：构造函数、`applyEnabledPacks()`、`createPackApplyTarget()` |
| 子系统接线 | `src/arona-clicker/runtime-wiring.ts`：`wireGameInstance()` |
| Registry 装载和会话门面 | `src/arona-clicker/runtime-game-instance.ts`：`init()`、`start()`、`tick()`、`load()`、`reset()` |
| 包默认选择与恢复 | `tests/data/pack-manager.test.ts`、`tests/engine/arona-runtime-pack.test.ts` |

先看模块职责：[[docs/docs-829/02-modules/00-index]]；包解析和 Registry：[[pack-loading]]；App Runtime 专题：[[docs/docs-829/06-wiki/10-application-runtime/00-index]]。
