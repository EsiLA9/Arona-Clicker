# Receipt：Task 0288-U1 Map 数据合同

## 完成内容

- 新增静态 `GameplayMapDef`、Node、Edge、Encounter 与 Encounter completion 合同；completion 只接受 `kind: 'manual'` 和作者可见 `label`。
- `Datapack.maps` 为可选表；相关类型从 `data-services` 公共入口导出。
- `map` 加入三段式实体类型登记，并增加接受 `base:map:*`、拒绝未知类型的定向测试。
- 未修改 Registry、Resolver、Runtime、UI 或生成 Schema。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-id.test.ts`：通过，1 个测试文件、2 个测试。
- `npx tsc --noEmit`：失败，报出两处非 U1 文件错误：
  - `tests/ui/gameplay-b-operation-controller.test.ts:382`：`{ type: "operation"; runId: string }` 缺少 `OperationWorkspaceState.returnContext`。
  - `tests/ui/gameplay-b-strategy-park-map.test.ts:129`：同样缺少 `returnContext`。

上述错误所在文件不属于 U1 改动范围；未核实其是否已存在于基线。类型检查输出未报告本次 Map 合同或 ID 测试的类型错误。

## GALHCG 直接路径只读复核

- 对 `gameplay-map.ts` 执行 `graph_health(check="changed")`：返回 `unreferenced_path`，当前图中没有此新路径的直接 Evidence 或 maps_to 关联。
- 对 `datapack.ts`、`data-services/index.ts`、`entity-id.ts` 执行 `graph_health(check="changed")`：均报告 `content_changed` 与已有 Evidence 过期；这些是现存映射对本次文件变化的提示。
- 本任务只读复核，没有负责人授权执行 `graph_edit`、刷新或写入图；源码与测试仍是实现事实来源。后续维护图关系需依项目维护协议另行授权。
