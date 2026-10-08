# Receipt 0241-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/operation-beat.ts` 增加可选 per-Actor Hand 输入与 `action-not-in-hand` 错误；`services/operation-plan-preparation.ts` 在有 Hand 快照时只准备手牌行动，保持手牌顺序并仍校验能力/地点/目标/费用；`services/operation-intervention-preview.ts` 拒绝手牌外命令并支持 Pool-only Action 的 capability/reason 校验；对应两份 engine tests 增加 Hand 边界断言 |
| 未完成内容 | 标准 Run/Commit 尚未生成并持续保存此 hand map；由 U7 负责 |
| 范围外变更 | 无；低层既有 Preparation 测试未提供 hand map 时仍走旧的静态 candidate 行为 |
| GALHCG 影响闭环 | 延后 E1 收尾，对 Preparation/Intervention tests/source 整批 review 与 maps_to Evidence 更新 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-plan-preparation.test.ts tests/engine/operation-intervention-preview.test.ts` | 通过 | 2 files / 25 tests |
| 类型检查 | `npx tsc --noEmit` | 通过 | |
| 空白检查 | `git diff --check` | 通过 | 只有工作树 CRLF 提示 |
| GALHCG | 延后 E1 收尾 | 未执行 | 后续 Run/View paths 仍在变化 |

## 遇到问题

- Pool Action 可合法存在于 Hand 而不出现在旧 Profile 的静态 `candidateActionIds` / `actionCandidates` 中；Preparation 现针对真实 Hand Action 按冻结 ActionDef 与能力现场生成 detached row，intervention 固定草稿后再沿现有 planner 核目标/费用。

## 需上游确认项

- 无。生产 snapshot 存在 Hand map 时它是选择硬边界；不提供该属性的低层结构 fixture 保持既有行为，标准 Runtime 在 U7 必须为每位 student 显式提供数组（包括空 Hand）。

## 事实更新建议

- 现有 Intervention Draft 可作为手牌行动选择入口；显式行动必须在该 Actor 当前 Hand 中，且仍受 Location/target/cost/atomic Commit 校验。
