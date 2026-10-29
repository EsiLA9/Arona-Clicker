# Receipt 0326-UI1 — Spot 直入真实 Map Workspace

> Parent Task: [[ai/archive/task-0326-variant-translation-real-card-workspace]]
> Unit: [[ai/archive/task-0326-units/task-0326-ui1]]

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（UI 接线与定向回归通过） |
| 实际修改 | `src/ui/controller/controller-actions-variant-training.ts` 入口直调主领域命令并进入 Map；`src/ui/controller/controller-actions-operation.ts` 依据 `mapEntrySource` 选择 MapEntry 返回或直接返回原位置；`src/ui/components/map/map-workspace.ts` 将返回按钮文案改为通用“返回入口”；`tests/ui/variant-training-spot-entry.test.ts` 新增 5 项直入 / 拒绝 / 续行 / 重开回归 |
| 未完成内容 | 无；真实浏览器实屏流程仍属 Task P2 完成验收，不由此 UI Unit 声称已验收 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 直接影响游戏 UI 模块；与 Task 收尾合并复核。本 Unit 不授权改图、刷新或 freshness 写入 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/variant-training-spot-entry.test.ts --reporter=dot --silent` | 通过：5 tests | 覆盖直入真实 Map、领域命令拒绝、UI 快速校验、无 Entry 返回并续行、重开回第一战；另检查 Hand 候选、目标与 Commit 控件存在 |
| 相邻回归 | `npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts --reporter=dot --silent` | 失败：1 通过、2 失败 | 失败一处为本轮前已有 Map 手动完成 / 条件路线门控导致完成按钮缺失；另一处为 `field-investigation` 的 `verified-clues` Counter 未声明。主 Agent 已核定这两项不属于演练入口 Unit，不在此修复 |
| 类型检查 | `npx tsc --noEmit` | 最终通过（施工中间态曾失败） | 中间态曾报告 `tests/engine/map-stage-initialization.test.ts:78` 的 `source` 类型错误；主Agent最新合并检查已清除。 |
| 差异检查 | `git diff --check -- src/ui/controller/controller-actions-variant-training.ts src/ui/controller/controller-actions-operation.ts src/ui/components/map/map-workspace.ts tests/ui/variant-training-spot-entry.test.ts` | 通过 | 仅提示 `map-workspace.ts` 行尾格式转换警告，无空白错误 |
| 人工验收 | 核对 `renderActiveCenter` 的 `node.title` / `node.description`，终态 `data-map-back` 与重开现有命令路径 | 源码核实 | 未做真实浏览器录屏 / 截图 |
| GALHCG | Task 收尾统一复核 | 未执行 | 仅 UI 映射影响；未维护语义图、未刷新或写 freshness |

### 遇到问题

- 首次测试启动时 Runtime 正在接入，引用的 `variant-training-scenario` 文件尚未落地，Vitest 未能收集用例；主 Agent 完成集成后重跑，入口测试 5 项通过。
- 普通 Map vertical-slice 在本Unit施工中间态有两项失败记录，归因为既有 field-investigation 路线 / 文案差异；主Agent后续另报告旧12个文件共161 tests通过。该历史结果不改变Task P2的正式浏览器验收要求。

### 需上游确认项

- 无；主 Agent 已补充 `MapWorkspaceCommitPreviewView.schedulerTerminal` 的只读投影，类型检查未再报告该字段。

### 事实更新建议

- `ui-style/patterns.md` 当前仍描述正式 Spot 使用训练 Modal；需在后续获授权文档 Unit 更新该条目。
