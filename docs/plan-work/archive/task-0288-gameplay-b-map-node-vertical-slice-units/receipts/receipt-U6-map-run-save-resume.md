# Receipt Task 0288-U6：保存 MapRun 并按内容版本恢复

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/save-data.ts`、`src/arona-clicker/contracts/save-codec.ts`、`src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts`、`src/arona-clicker/runtime-save-codec.ts`、`src/arona-clicker/runtime-game-instance.ts`、新增 `tests/engine/gameplay-b-map-save-resume.test.ts` |
| 未完成内容 | 无 |
| 范围外变更 | 无；未修改 `contracts/runtime.ts`、PlayerState、Registry 或旧 OperationRun 合同 / 恢复逻辑 |
| GALHCG 影响闭环 | 已核对 `acprogram` 项目；对改动路径执行 `graph_health(check="changed")` 只读复核。已关联的 SaveData / SaveCodec / GameInstance 路径显示 `content_changed` 且现有 Evidence 过期；MapRun 合同、服务与新测试显示 `unreferenced_path`。GameInstance 的 7 个 owner 分两页读完。未刷新 freshness、未写图。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 | 1 个测试文件、4 个测试。覆盖活动 Encounter checkpoint、完成进度、无效版本启动保护，以及未知 Map / 版本失配只拒绝 MapRun 并保留 PlayerState 和 OperationRun。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 人工验收 | 检查保存 / 恢复调用顺序和 owner 写入 | 通过 | 只写入 MapRunService 私有 slot；恢复不调用 `start`、`move` 或 `completeEncounter`。 |
| GALHCG | `graph_project` 与逐路径 `graph_health(check="changed")` | 只读完成 | 未影响图状态；未维护 freshness。 |

## 遇到问题

- Registry 当前不校验 Map 的 `resumeVersion`。因此 MapRunService 在 `start()` 拒绝非正安全整数版本；活动 Run 在 checkpoint 时若版本异常则抛错，不会静默从 SaveData 省略。

## 需上游确认项

- 无。

## 事实更新建议

- 若后续将 `resumeVersion` 校验下沉到 Registry，应保留 MapRunService 的入口保护，避免非 Registry Resolver 绕过后生成不可恢复的 Run。
