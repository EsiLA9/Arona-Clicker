# Receipt：Task 0288-U4 MapRun 最小状态机

## 完成内容

- 新增 MapRun 状态合同与独立 `MapRunService`；只依赖 U3 `MapContentResolver`，每个服务仅持有一个 Run，不写 PlayerState，也不接 GameInstance / UI。
- 开始时解析并固定 Map ID、Run ID 与起点；起点和移动到未完成 Encounter 节点时立即激活 Encounter。
- 移动只接受当前 Node 的有向邻接 Edge；活动 Encounter 阻止移动。只有当前 Encounter 声明 `completion.kind === 'manual'` 才能完成，成功后清除活动状态、记录完成并留在原 Node。
- 无遭遇的出口到达后终止为成功；已完成 Encounter 的 Node 重访不重新触发。拒绝命令保留 Run 状态；对外快照为冻结副本。
- 出口 Node 若带未完成 Encounter，先进入遭遇；完成后仍停留在该 Node 并将 MapRun 终止为成功。
- 本 Unit 未增加 Encounter 失败命令：C1a 只有手动成功完成动作，失败条件与结算仍不在本单实现范围。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-run.test.ts`：通过，1 个测试文件、6 个测试。
- `npx tsc --noEmit`：通过。

## GALHCG 直接路径只读复核

- 对新增 `map-run.ts`、`map-run-service.ts` 与 `gameplay-b-map-run.test.ts` 执行 `graph_health(check="changed")`：均返回 `unreferenced_path`，当前图没有这些新路径的直接 Evidence 或 maps_to 关联。
- 本任务只做只读复核；没有负责人授权进行 `graph_edit`、刷新或写入图。源码与测试仍是实现事实来源。
