# docs-830/04-presentation/read-model-and-ui — 只读视图与 UI

本文回答：界面如何读取游戏状态，以及如何发起业务操作。

## 查询数据流

```text
PlayerState + Visibility / Stats / Story 等派生数据
  → GameView / GameReadModel → UIContext → UI Components
```

`GameInstance.getView()` 调用 `buildGameView()`，把游戏状态、可见性、当前剧情、活跃 Affector 和统计快照组织成面向查询的视图。UI 再由 `UIContext` 组合显示格式、主题和表现查询，组件据此渲染。

常用视图字段包括活动 Init、当前 Area、帧数、资源、Spot 等级、库存、解锁内容、StoryView、可见性快照和统计信息。更大的 `GameReadModel` 还暴露按领域组织的查询端口；组件可以在统一上下文中消费这些只读能力，而不直接依赖 Registry 表或底层状态对象。

## 命令路径

```text
DOM 事件 → Controller action → GameCommands → Runtime / 领域服务
                                      ↓
视图刷新 ← UIContext ← GameReadModel ← 状态与派生查询
```

`runtime-commands.ts` 将 Controller 使用的命令委托给 `GameInstance` 或具体领域服务。组件负责呈现及收集用户输入；Controller 负责把输入转换成命令；领域层校验并执行后，下一次视图构建反映新状态。这使查询模型与写入命令保持分离。

## 读写分工

- 查询和展示读取 GameReadModel / UIContext 提供的数据。
- 玩家操作由 Controller 命令进入 Runtime 或领域服务。
- 组件不直接承担领域状态写入。

主要源码：`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/arona-clicker/read-model/game-view-builder.ts`、`src/ui/runtime/context.ts`、`src/ui/controller/`。

继续阅读：[[system-composition]]、[[state-and-events]]。

## 举例：展示资源与响应操作

资源显示从视图读取当前值和派生结果；用户在界面发起操作时，Controller 将输入转成命令，实际校验和写入发生在领域服务及其写入口。完成后界面通过查询和刷新展示新状态。单纯更新数字不会因此自动成为领域状态写入；同样，更新只读视图也不能代替执行命令。

调查“数字不对”时可先区分领域状态是否正确、查询投影是否正确、DOM 是否刷新；调查“点击没有结果”时则继续检查命令、领域校验和写入。具体刷新范围及 Surface 过期机制见 [[update-dispatch-and-surface]]。
