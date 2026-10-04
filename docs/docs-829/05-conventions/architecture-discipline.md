# 05-conventions/architecture-discipline — 架构边界

> 本文回答：功能跨层实现时，应保持哪些稳定的依赖与状态边界。

## 稳定边界

- 产品业务状态写入集中经 `StateMutationService`；Engine 只依赖最小写入 Port，不依赖 AronaClicker 服务实现。
- 跨系统联动优先通过 EventBus、Trigger、Effect 或 Affector 契约连接，避免在组合门面集中硬编码业务反应。
- 新机制优先由 Datapack 声明；改变 Schema 字段后同步生成的编辑器协议。
- UI 组件消费 `GameReadModel` / `UIContext`；用户命令经 Controller 与 `GameCommands` 进入产品 Runtime。
- 新状态字段先确定 global、per-Init snapshot 或 per-Init current 的生命周期归属。
- 基础 `src/data-services/` 不反向依赖 UI、产品内容、测试数据或旧存档实现。
- 存档结构改动不编写迁移兼容层；由项目明确执行清档策略。

## 当前实现边界待核对

`src/engine/system/tick-system.ts` 对 `state.totalFrames` 有直接写入。该计数与产品业务状态写入口的关系需要按状态类型、Port 契约与测试单独裁定；不能只根据“单一写入口”口号推导其已是批准例外或违规。

## 检查入口

- `npm run check:architecture`：静态检查基础层 import 边界。
- `npm run check:docs`：文档路径与路由检查，不判定语义新旧。

跨层结构图见 [[docs/docs-829/01-architecture/dependency-map]]。
