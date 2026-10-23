# Unit 0309-U10：Gameplay B 准备页说明内容

## Goal

为正式 Gameplay B 示例地图提供短简介和可执行的纯文本提示，让准备页不依赖 Node 剧透文本且具备真实信息内容。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` 的“信息优先级与来源” | 限定摘要 / 提示语义，避免虚构奖励或剧透 |
| 源码 | `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` 的八个 GameplayMapDef | 按各地图实际规则编写内容 |
| 测试 | `tests/ui/gameplay-b-basic-map-p0-p3.test.ts` 的准备页打开用例 | 验证准备页展示作者内容且仍只读 |
| 契约 | `src/data-services/contracts/gameplay-map.ts` 的 `entryInfo` | 字段形状与纯文本边界 |

## Constraints

- 每个提示只表达地图定义中可证实的操作规则；不写难度、奖励、战力、预测耗时或未来节点敌人剧透。
- `entryInfo` 仍为可选、纯文本，只展示，不参与 Run 规则或 `resumeVersion`。
- 不改生成 Schema；`AGENTS.md` 的范围约束仍生效。

## Allowed Files

- `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`
- `tests/ui/gameplay-b-basic-map-p0-p3.test.ts`

## Explicit Non-goals

- 不更改 Map 节点、战斗、资源、准入与 MapRun 规则。
- 不编辑生成 Schema 或编辑器 metadata。

## Completion Criteria

- [x] 八个正式 Gameplay B Map 都有非空短简介和 1–2 条依据实际规则的提示。
- [x] 准备页实际显示 map `entryInfo` 的简介与提示，测试仍确认打开前没有 Run。
- [x] 定向 UI 用例、完整 TypeScript 检查通过。
