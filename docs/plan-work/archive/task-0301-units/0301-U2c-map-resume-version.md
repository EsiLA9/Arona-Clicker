# Unit 0301-U2c：Map 存档兼容版本

## Goal

使扩展后的 Encounter snapshot 与已保存的 Gameplay B MapRun 明确断代。旧 checkpoint 不再尝试按新 Enemy Hand / 资源结构恢复。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P2 / Save 规则 | 已批准的无迁移要求 |
| 源码 | `src/arona-clicker/content/gameplay-b-map-datapack.ts`：所有正式 Map `resumeVersion` | 当前正式 Map 内容与兼容版本 |
| 源码 | `src/arona-clicker/services/map-run-service.ts`：restoreSaveSnapshot | 已有版本不匹配拒绝路径 |
| 测试 | `tests/engine/gameplay-b-map-save-resume.test.ts` | 旧版本 checkpoint 的外部可见拒绝行为 |

## Constraints

- Gameplay B Encounter snapshot 形状已变化，所有本 Datapack 中可以产生 Encounter snapshot 的正式 Map 都递增 `resumeVersion`。
- `gameplayBMapDefinition` 当前为 2，递增到 3；其他七张正式 Map 当前为 1，递增到 2。
- 不改 Runtime 的版本拒绝语义，不添加 Snapshot 迁移层。
- Task 0301 P5 若继续修改这些 Map 的行动内容，应再按现行规则递增版本。

## Allowed Files

- `src/arona-clicker/content/gameplay-b-map-datapack.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`
- Task 0301 与本 Unit / Receipt

## Completion Criteria

- [x] 八张正式 Gameplay B Map 都已递增 `resumeVersion`。
- [x] 保存的旧版本被现有 `content-version-mismatch` 路径拒绝，PlayerState 不变。
- [x] 当前版本 checkpoint 仍可恢复。

## 实施结果

- `gameplayBMapDefinition` 从 2 提升到 3；其余七张正式 Map 从 1 提升到 2。
- Save / Resume 测试检查整个 Gameplay B Datapack 已断代，并用旧版本与新版本 checkpoint 验证既有内容版本拒绝 / 恢复流程。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Save / Resume | `npx vitest run --silent tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |
