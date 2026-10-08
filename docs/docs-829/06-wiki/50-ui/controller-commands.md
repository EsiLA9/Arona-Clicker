# 06-wiki/50-ui/controller-commands — 从玩家输入到 Runtime

Controller 是 UI 的控制层：它接收按钮或表单事件，调用有明确名称的 `GameCommands`，再按结果安排提示和视图更新。**命令接口**把“玩家想做什么”表达成方法；真正校验业务规则并写状态的是 Runtime 服务和 Mutation。

## 例子：升级 Spot

```text
升级按钮点击
  → src/ui/controller-actions-inventory.ts 执行 executeSpotPayment()
  → ctrl.commands.upgradeSpot(spotId, paymentOptionId)
  → src/arona-clicker/runtime-commands.ts 委派给 game.spot.upgradeSpot()
  → SpotService 检查规则，必要时调用 Mutation 端口提交
  → StateMutationService 改状态并发布变化事件
  → Controller 显示结果，再刷新受影响面板
```

这是运行时调用和数据流示意，不代表这些层彼此都直接 `import`；静态导入边界应以文件中的实际 imports 为准。测试 `tests/ui/controller-init-select.test.ts` 覆盖从 UI 选择 Init 后的进入 / 恢复行为；`tests/ui/controller-events.test.ts` 覆盖事件发生后对应 UI 响应。Spot 支付规则不由这些 UI 测试证明，需到领域服务测试继续追踪。

沿着“升级 Spot”还能看到写入后的两个独立结果：`SpotService.upgradeSpot()` 校验付款后调用 `StateMutationService.commitSpotTransaction()`；它先原子写入付款和新等级、更新统计，再按实际变化发出 `resourceChanged`、`itemCollected`（如有消耗）和 `spotLevelChanged`。这些是已写入状态的通知，`TriggerSystem` / `AffectorEngine` 按订阅类型处理。命令返回后，Controller 另外调用 `refreshPanels(['right'])`；面板更新时经 UIContext 重新查询只读 GameView。因此“命令返回后的面板刷新”和“EventBus 订阅者的派生响应”是两条不同的后续路径。

对应入口为 `src/arona-clicker/services/spot-service.ts:upgradeSpot()`、`src/arona-clicker/state/state-mutation-service.ts:commitSpotTransaction()` 和 `src/ui/controller-actions-inventory.ts:executeSpotPayment()`。`tests/engine/game-instance.test.ts` 验证升级写入等级/资源与拒绝路径；`tests/ui/spot-payment-modal.test.ts` 验证 UI 选择付款项后走 Controller 命令（命令本身是测试替身）；`tests/ui/controller-events.test.ts` 验证 EventBus 通知触发局部 UI 响应。它们分别证明各自断言，不是一次集成式 Spot UI 测试。

## GameCommands 的边界

`src/arona-clicker/contracts/runtime.ts` 的 `GameCommands` 定义 UI 可发起的操作。`createGameCommands()` 在 `src/arona-clicker/runtime-commands.ts` 把命令委派给旅行、Spot、Story、物品、强化或 Mutation 等 Runtime 入口。对于会写游戏状态的操作，UI 不能因为按钮可见就跳过 Runtime 校验；命令返回失败时由 Controller 决定显示错误、保持当前位置或重新查询。

Controller 的 `commands` 是写操作门面。输入和读数的分界可简写为：**写入走 `GameCommands`；显示查询走 GameReadModel / UIContext**。这不意味着任何 eventBus 通知都能写状态，也不意味着所有 UI 局部状态都属于 PlayerState：选中的 Tab、滚动位置和表单草稿可以由 UI 持有。

## 事件回流不等于状态命令

Runtime 写入后可能发布 EventBus 事件。`src/ui/controller-events.ts` 订阅这些通知，再按事件语义更新可见性、日志、面板或轻量读数。例如揭示状态变化可能替换受影响卡片；Tick、Spot 产出和资源变化也可触发轻量数值刷新。EventBus 传达“已发生什么”；真正的状态写入口仍在 Runtime / Mutation。事件投递顺序和 Trigger 匹配见 [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]。

## 静态与运行时入口

- 启动和控制器挂载：`src/ui/main.ts` 的 `boot()`、`src/ui/controller.ts` 的构造器与 `mount()`。
- 输入委派：`src/ui/controller-actions-*.ts` 到 `src/arona-clicker/runtime-commands.ts`。
- UI 收到通知：`src/ui/controller-events.ts` 的 `bindEvents()`，再委派刷新给 Controller。
- 上述文件有静态模块依赖；箭头代表一次典型运行时调用 / 响应流程。

只读查询和 UIContext：[[docs/docs-829/06-wiki/50-ui/read-model-context]]；刷新范围：[[docs/docs-829/06-wiki/50-ui/refresh-update]]；返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
