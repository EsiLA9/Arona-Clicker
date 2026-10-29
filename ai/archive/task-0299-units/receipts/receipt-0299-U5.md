# Receipt 0299-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 src/arona-clicker/services/gameplay-b-target-selection.ts；src/arona-clicker/services/gameplay-b-action-preview-resolver.ts；src/arona-clicker/services/map-run-service.ts；src/arona-clicker/contracts/map-run.ts；tests/engine/gameplay-b-map-run.test.ts；新增本 Receipt |
| 未完成内容 | SkipReason 的 Runtime / Workspace 投影由 U9 处理；Team 自然费用预留由 U6 处理。 |
| 范围外变更 | 无；未触碰 Task 0291 U4 Workspace / Runtime View 文件。 |
| GALHCG 影响闭环 | 项目身份 acprogram 已核对；直接复核 target selector、Preview、Commit Plan、receipt Restore 与相关测试；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Runtime / receipt / card 回归 | npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-cards.test.ts | 通过 | 3 files、61 tests；包含自动重选、无替代目标跳过、PlayerCommand 费用和 Skip Receipt 保存恢复。 |
| 类型检查 | npx tsc --noEmit | 通过 | — |
| 差异空白 | git diff --check；rg 检查 Allowed Files | 通过 | git 只报告仓库已有 CRLF 转换提示；未发现尾随空白。 |
| GALHCG | 项目身份与直接源码调用路径只读复核 | 完成 | 未授权图维护，本 Unit 不改变模块关系。 |

## 遇到问题

- 初次断言把缺省 targetEnemyId 误写成显式 undefined；改为只断言实际保存字段后定向回归通过。

## 需上游确认项

- 无；自动 / 手动目标、费用范围和 Task 0291 C4 窄例外均由本 Task P0 冻结。

## 事实更新建议

- MapRun 的纯 Commit Plan 现在按固定角色顺序逐个模拟 Character Action HP；自动失效目标可重选或以 noLegalTarget 跳过，手动目标仍按 C4 付费并产生 0 HP delta。
