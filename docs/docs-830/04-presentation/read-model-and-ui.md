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

继续阅读：[[docs/docs-830/01-architecture/system-composition]]、[[docs/docs-830/02-data-and-state/state-and-events]]。
