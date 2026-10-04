# Receipt 0215-U8

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 扩展 `EventRun` / `OperationLifecycleEvent` 合同；`OperationRuntimeService` 保存并冻结每个 Run 的战术规则、计划版本、基础 PreparedBeat、干预槽、tactical RNG 与 bounded Resolution history；窄 `OperationEntryFacade` 增加 Preview/Revise/Clear/Commit 命令。 |
| Run 初始化 | 通过 admission 的 `OperationRunStartInput` 经现有 content validation 后深拷贝/冻结到私有 Run rules；start 创建 planVersion 0 的首个 PreparedBeat。低层结构性 `OperationEventDef` fixture 没有战术 rules 时 PreparedBeat 保持 null，战术命令返回 domain error。 |
| 命令与版本 | `previewIntervention` 是纯读取；`reviseIntervention` 先跑 U5 preview，再存单一 Draft、递增 planVersion 并重建同版本的 canonical base Beat。`clearIntervention` 清除 Draft 时递增一次；当前无 Draft 时返回 unchanged snapshot。成功的 `applyStateDelta`、Location enter/complete 与 finish 都递增版本，并重建或失效 PreparedBeat、清除过期 Draft；失败不改 Run。 |
| 原子 Commit | 仅接受 `{runId, planVersion}`。从 Run 当前冻结快照调用 U7 planner，校验批次身份、Location、base version 与 RNG cursor；复制候选 Run 后验证并应用 HP/Actor/Team/Track 数值变化，提交 RNG、beat index、resolution sequence，追加省略 `nextRandomState` 的 Resolution（只保留最近 32 条），清除 Draft 并准备下一 Beat。以上完成后仅执行一次 Run slot pointer swap，再发布 `beatResolved`。任一规划/验证/下一 Beat 准备失败都不替换 Run、不写游标/历史或通知。 |
| Retry 与通知 | 最新 Resolution 的 `basePlanVersion` retry 检查先于 stale/terminal 检查，并返回历史中同一个已冻结 Resolution 对象；不重复扣费、抽 RNG、递增版本或发通知。更早版本及其他 runId 拒绝。通知 listener 看到 pointer swap 后的快照；listener 异常被隔离，回调期间的写重入仍由 owner 拒绝。 |
| Facade 边界 | `GameInstance.operationEntry` 只暴露原有 `start/getSnapshot` 与 `previewIntervention/reviseIntervention/clearIntervention/commitBeat`；不暴露 owner、任意 delta、finish/reset、subscribe 或 frozen Run rules。 |
| GALHCG 影响闭环 | `acprogram` 定向刷新本 Receipt、`operation.ts`、Runtime/Entry service 与两份 runtime test 共 6 条路径；`resolve_paths` 6/6 成功且不需再刷新。全部 6 条 `review_changes` 路径均完整；4 条有既有 owner 的实现/测试路径 owner 分页均结束，5 个现有文件合计 17 条 Evidence 报 `content_changed` / stale，8 条 maps_to 需要在 U9 读取最终文件后更新 token；涉及 `Operation EventRun Runtime` 与 `Operation Student Profile Admission`。新 Receipt 为 `unreferenced_path`。本 Unit 未写语义地图；U9 统一复核关系、补写最终机制依据并更新 Evidence。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 | 2 个文件，29 tests passed；覆盖冻结规则、首 Beat、版本失效、preview/revise/clear、原子写回/失败零写、通知顺序/异常/重入、latest retry、旧版本 stale、bounded 32 条 history 与窄 facade。 |
| U7 回归 | `npx vitest run tests/engine/operation-resolution-planner.test.ts` | 通过 | 1 个文件，8 tests passed。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| 架构检查 | `npm run check:architecture` | 通过 | Engine 与 Data Services 依赖边界通过。 |
| 文档检查 | `npm run check:docs` | 通过 | Receipt 加入后检查。 |
