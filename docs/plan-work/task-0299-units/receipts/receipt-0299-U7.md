# Receipt 0299-U7

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts；src/arona-clicker/services/map-run-service.ts；tests/engine/gameplay-b-map-cards.test.ts；更新 U7 Unit 与 Task 0299 进度；新增本 Receipt |
| 未完成内容 | Runtime / Workspace Skip reason 展示交由 U9；Flow 卡身份与 P6 作用线不属于 MapRun 卡目标。 |
| 范围外变更 | 未修改卡牌目录、MapRunCardRef、`resolveMapCardEffects`、Runtime / Workspace View / Controller / CSS；工作树原有 UI 关系标记改动保持原样。 |
| GALHCG 影响闭环 | 项目身份 acprogram 已核对；直接复核 Card catalog、Preview、Commit、Receipt restore 和卡牌测试；未改图、未刷新或写 freshness。 |

## 结果

- 多个合法目标时，Preview 从真实 `catalogMapRunCards` 的稳定顺序选择第一个合法 `MapRunCardRef`；同 Action ID、不同角色的卡牌引用保持为独立实例。
- 明确合法的 `targetSelections` 仍优先于默认目标；选择清除、换牌或恢复自然 Action 后，按当前 Action 与候选重新选择首个合法实例。默认选择只从当前 Encounter 快照推导，不写入目标存档字段。
- 合法目标为空时，Prepared Preview 返回 `skipReason: noLegalTarget`，不再要求玩家选择不存在的目标。Commit 对此 Action 不收 Actor / Team Action cost、不应用 Card effect / scost discount / HP effect、不写目标卡；PlayerCommand 仍按 P0 计入 PlayerCost。
- Skip Action 以 null Action choice 排除于 `resolveMapCardEffects` 计算；领域 settlement 仍保留真实 Action ID 和 `noLegalTarget`。Receipt restore 接受对应的空费用 / 空目标 Skip 形状，GameInstance Save / Resume 回归验证保持 Receipt。
- 有目标的 Action 继续复用既有 MapRun card effects 和 scost Commit。无需 Task-0298 完成所有工作，也未引入 Flow 或旧 Operation Planner。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Runtime / Cards / Save / Resume | npx vitest run --silent tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts | 通过 | 3 files、64 tests；包含目录顺序默认值、重复 Action ID 实例、自动效果提交、零候选 Skip 与 Save / Resume Receipt。 |
| 类型检查 | npx tsc --noEmit | 通过 | — |
| 文档检查 | npm run check:docs | 通过 | errors 0；scanned markdown 947。 |
| 差异空白 | git diff --check | 通过 | 只提示工作树原有 CRLF 转换信息。 |
| 相关 UI 回归观察 | npx vitest run --silent tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-relation-interaction.test.ts tests/ui/map-relation-presentation.test.ts | 观察到 3 个失败；2 个 UI 文件通过 | Workspace 中 3 项旧断言仍预期玩家必须手动选普通目标 / 遭遇不可提交；新 P1 默认目标使其可以直接提交。UI / Runtime View 由 U9 在 Task 0291 U4 接口稳定后处理；本 Unit 没有改写这些文件。 |

## 遇到问题

- 一项原多目标卡牌关系断言预期“无手动选择、无目标接收者”；现改为验证目录首项自动决定目标及其效果接收者，同时保留玩家覆盖和状态纯读断言。
- UI 定向回归运行中，`tests/ui/gameplay-b-map-workspace.test.ts` 的遭遇完成按钮、提交按钮与“选择对象”三项期望因自动目标 / 自动提交而过时。它们的呈现属于受 Task 0291 U4 管理的 Workspace 接线；记录给 U9，不在本 Unit 越界改文件。

## 需上游确认项

- 无；卡牌默认稳定首项与零目标安全 Skip 已由 Task-0299 P0 / P4 冻结。

## 事实更新建议

- 真实 MapRun 卡牌目标具有确定性的目录首项策略；当目录无合法实例时使用独立的 `noLegalTarget` Skip settlement，而不是重新抽 Hand 或伪造 Wait。Skip 可由当前 card effect plan / Receipt 合同处理，不需要保存虚拟卡牌或新目录。
