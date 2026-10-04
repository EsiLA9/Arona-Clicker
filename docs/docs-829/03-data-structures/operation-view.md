# OperationView — Gameplay B 只读投影

> 本文说明 Gameplay B EventRun 面向 UI 的独立只读快照；精确字段以 `src/arona-clicker/contracts/operation-view.ts` 为准。

## 归属与边界

- `OperationView` 是 EventRun 的 detached UI 投影，不属于全局 `GameView`，也不写入 `PlayerState`、Init snapshot 或 SaveData。
- `GameReadModel.operationEntry` 只暴露 `OperationViewQuery.getView(expectedRunId?)`；启动、修订、取消和 Commit 由 Controller action 调用 Runtime 上的窄 Operation Entry facade。两者是分离的读写边界。
- Runtime owner 保持私有。UI 不读取 EventRun、冻结规则、resolver、ActionDef 或 mutable GameInstance 内容。
- `expectedRunId` 与当前 Run 不一致、Run 不可用或缺少 UI 所需战术内容时返回 `null`，防止过期 route 显示另一个 Run。

## 投影内容

投影包括当前 Event / Location、版本与 Beat、轨道/事实/持有物、Actor 与 Team、基础计划和干预后计划、合法 Action / Target 候选及阻塞理由、协同预览、Commit 状态、Resolution 历史和序号。角色技能结果只保留是否成功；tactical RNG cursor、roll 测量、原始规则对象和完整 Run 不出现在 UI DTO。

写命令重算候选时，projector 复用冻结规则上的纯干预预览与 Combination resolver；读取 View 不调用内容 resolver、不写 EventRun、不推进随机游标。返回结构深度脱离 owner 当前状态。

## AC UI 消费路径

Operation route 持有 `runId`，由 Workspace Renderer 在进入或重建 route 时查询投影。已挂载 Workspace 中的行动、目标、取消和 Commit 命令由 Controller 经 `operationEntry` 执行；每次成功或拒绝结果最多读取一次新投影，再请求一个 `workspace.operation` region 更新。route 进出属于 workspace structure 更新。

实现与回归测试：`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/components/operation-workspace.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`、`tests/ui/operation-workspace-view.test.ts`。

相关机制：[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]；UI 路由：[[docs/docs-829/06-wiki/50-ui/workspace-routing]]。
