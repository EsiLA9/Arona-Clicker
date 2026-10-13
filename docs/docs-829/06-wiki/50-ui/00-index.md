# 06-wiki/50-ui/00-index — 游戏界面怎样读写与更新

游戏 UI（User Interface，用户界面）负责接收玩家操作并呈现当前游戏视图。控制器把写操作交给 Runtime 命令；组件通过只读 UIContext 读取界面所需的数据。状态归属与写入仍在产品 Runtime 和状态服务中。

## 第一次阅读

1. 先看 [[docs/docs-829/06-wiki/50-ui/controller-commands]]，从按钮输入追到 Runtime 命令。
2. 再看 [[docs/docs-829/06-wiki/50-ui/read-model-context]]，了解组件怎样取得 View（面向界面的只读视图）和表现查询。
3. 页面切换与返回位置见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]；何时更新单个值、区域或整页见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。
4. 背景、主题和实体表现如何进入 UIContext，见 [[docs/docs-829/06-wiki/50-ui/presentation-theme]]。

| 读者的问题 | 页面 | 主要代码 / 测试入口 |
| --- | --- | --- |
| 输入怎样触发游戏操作？ | [[docs/docs-829/06-wiki/50-ui/controller-commands]] | `src/ui/controller-actions-*`、`runtime-commands.ts`；`tests/ui/controller-events.test.ts` |
| 组件怎样读取游戏信息？ | [[docs/docs-829/06-wiki/50-ui/read-model-context]] | `src/arona-clicker/contracts/runtime.ts`、`src/ui/context.ts`；`tests/ui/controller-init-select.test.ts` |
| 当前页面与返回位置由谁决定？ | [[docs/docs-829/06-wiki/50-ui/workspace-routing]] | `src/ui/workspace/workspace-router.ts`；`tests/ui/workspace-router.test.ts` |
| 怎样避免无关 DOM 重建？ | [[docs/docs-829/06-wiki/50-ui/refresh-update]] | `src/ui/update/`；`tests/ui/ui-update-dispatcher.test.ts` |
| 背景、主题和实体表现从哪来？ | [[docs/docs-829/06-wiki/50-ui/presentation-theme]] | `src/ui/presentation-service.ts`、`controller-theme.ts`；`tests/ui/presentation-service.test.ts` |
| 新页面继承什么风格、组件与内容入口？ | [[ui-style/00-index]] | `src/ui/css/variables.css`、`src/ui/css/cards.css`、`src/ui/components/workspace-frame.ts`、`src/ui/components/tabs.ts` |

## 总览：两条方向不同的路径

```text
写操作：DOM 输入 → Controller / GameCommands → Runtime 服务 → Mutation / 状态
                                            ↘ EventBus → Controller 响应
读操作：组件 → UIContext → GameView / 只读查询 → 格式化 HTML 与 DOM
```

图中的“调用”表示方法被执行；“状态流”表示写服务改变游戏状态；“事件响应”表示界面收到通知后决定怎样更新。事件不是命令本身，读到的 GameView 也不是 UI 拥有的可变 PlayerState。

## UI 代码入口

`src/ui/main.ts` 在应用 Runtime 和 Datapack 装载后创建 `UIController` 并挂载界面。`src/ui/controller.ts` 创建 `GameCommands`、绑定事件并安排渲染；`src/ui/components/` 通过 `UIContext` 生成界面结构。职责速览见 [[docs/docs-829/02-modules/ui]]；Runtime 与 Engine 的启动装配见 [[docs/docs-829/06-wiki/10-application-runtime/startup-and-composition]]。
