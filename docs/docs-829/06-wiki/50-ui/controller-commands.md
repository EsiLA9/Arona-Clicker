# 06-wiki/50-ui/controller-commands — 控制器与用户操作

> 本文回答：UI 控制器怎样把输入转成 Runtime 操作，再协调界面响应。

## 控制器职责

`src/ui/controller.ts` 的 `UIController` 是界面集成门面。它持有当前 `PanelState`、DOM 根节点、`GameInstance`、`GameCommands`，并协调渲染、工作区、主题、事件订阅、保存、弹窗和更新调度。具体 UI 区域已拆到 `controller-actions-*`、`controller-events.ts`、`controller-theme.ts`、`controller-save.ts` 与 `components/`。

控制器构造时以 `createGameCommands(game)` 建立命令接口。按钮处理器调用 `ctrl.commands` 执行玩家操作；命令定义位于 `src/arona-clicker/runtime-commands.ts`，将产品操作委派给 Runtime 服务或 Mutation 入口。渲染组件消费查询视图，不应借 UI 引用直接改游戏状态。

## 事件回流

`controller-events.ts` 在挂载阶段订阅 EventBus。事件按影响面触发揭示检查、日志/面板更新、表现更新或延迟聊天通知。高频 `tick` 与 `spotProduced` 走轻量数值更新路径，不走通用揭示重建；内容批次期间的特定响应会暂缓。

一次操作的常见路径：

```text
DOM 事件 → controller-actions-* → GameCommands → Runtime / Engine
         → EventBus → controller-events → 局部 UI 更新
```

## 代码与测试

入口：`src/ui/controller.ts`、`src/ui/controller-actions-*.ts`、`src/ui/controller-events.ts`、`src/arona-clicker/runtime-commands.ts`。交互路由与刷新响应的测试见 `tests/ui/controller-events.test.ts`、`tests/ui/controller-tab-linkage.test.ts` 和 `tests/ui/workspace-lifecycle.test.ts`。
