# Receipt task-0282-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/data-services/registry/runtime-content-reference-rules.ts`；公共内部类型 `runtime-content-reference-types.ts` 由主线程裁定归档到 U3，本 Receipt 只覆盖规则模块。 |
| 未完成内容 | 无；Browser 集成、类型检查与架构检查由主线程验证。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 已用 `graph_project` 核对 `acprogram`；`graph_read` 只读复核规则文件直接路径。`graph_health(check="changed", path=...)` 返回 `unreferenced_path`，因此无直接 Evidence / maps_to 关联；未获授权维护映射，也未修改图。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run --silent tests/data/runtime-content-reference-rules.test.ts` | 通过 | 9 tests passed。 |
| 类型检查 | `npx tsc --noEmit` | 未执行 | 按 Unit 约定由主线程完成集成类型验证。 |
| 人工验收 | 直接调用 `collectDefinitionReferences` 的规则回归 | 通过 | 覆盖精确路径、联合判别、候选隔离、局部表现选项、主题实体作用域、cycle 与 getter 安全；未依赖 Browser 接入。 |
| GALHCG | `graph_project`、`graph_read`、`graph_health(check="changed")` | 只读完成 | 查询和直接路径复核未触发刷新、freshness 写入或图修改。 |

## 遇到问题

- `graph_health(check="changed")` 对规则文件报告 `unreferenced_path`；当前 Unit 未授权维护映射，因此保留此状态并交由项目地图维护流程处理。

## 需上游确认项

- 无。

## 事实更新建议

- Spot 的 `functionalities[].kind === "operationEntry"` 时，`operationEventId` 指向 `operationEvents`；该设施引用由 U1 规则覆盖，Operation 六张定义表由 U2 覆盖。
- `Init.startStoryId` 可指向 `stories` 或 `activeStories`；`kizuna.storyId` 指向 `activeStories`；FollowUp 的 `storyEntryId` 指向 `activeStories` 或 `passiveStories`。
