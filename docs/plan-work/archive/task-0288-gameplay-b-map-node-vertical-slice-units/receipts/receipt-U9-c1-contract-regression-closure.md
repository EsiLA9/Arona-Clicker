# Receipt Task 0288-U9：关闭 C1 存档与 Map 版本校验回归

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/data-services/registry/registry-validate.ts`（增加 Map `resumeVersion` 正安全整数校验）；`tests/data/gameplay-b-map-registry.test.ts`（版本边界测试）；`tests/engine/gameplay-b-map-runtime-integration.test.ts`（Save/Load 与旧存档生命周期回归）；新增本 Receipt |
| 未完成内容 | 无 |
| 范围外变更 | 无；未修改 U8 文件、MapRun Runtime、SaveData / Codec、PlayerState、OperationRun 或生成 Schema |
| Units Guide | U9 已登记为依赖 U1–U6、可与 U8 并行且须在 C1 最终验收前完成；无需增加依赖记录 |
| GALHCG 影响闭环 | `graph_project` 确认 `acprogram`。对 Registry 校验文件执行 `graph_health(check="changed")`，结果为 `content_changed` 且已有 Evidence 过期；两个测试路径为 `unreferenced_path`。只读检查，未写图或 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/data/gameplay-b-map-registry.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts` | 通过 | 2 个测试文件、25 个测试。覆盖无效版本拒绝、正安全整数接受、MapRun Save/Load 保留 Run ID 与 Encounter 进度、旧 SaveData 不带 `mapRun` 时清空状态，以及 init/reset/dispose 清理。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 文档检查 | `npm run check:docs` | 通过 | errors: 0；scanned markdown: 852。 |
| 差异检查 | `git diff --check`（三个实现文件） | 通过 | 无空白错误；Git 对 `registry-validate.ts` 提示工作副本 CRLF 将来会转为 LF。 |

## 遇到问题

- 无。Load 的生产行为符合冻结合同；修正的是 U5 生命周期测试中过时的“load(save()) 后必须为空”预期。

## 需上游确认项

- 无。

## 事实更新建议

- Map 的 `resumeVersion` 在正式 Registry 校验时必须是正安全整数；MapRunService 的运行时保护仍保留为防御校验。
