# Receipt 0298-U6

- 状态：完成。Owner 增加 `previewActionReplacement`，公共只读 Query 增加 `previewReplacement`，返回 `replacementPreview` 关系；不安装任何草稿。
- 验证：关系 / MapRun / source transactions 共 45 项通过，类型与架构检查通过。覆盖同目标仍合法也作废、Hand 内外候选、非法 / stale 零写入和重复查询不推进 RNG。审查补充拒绝“预览当前生效牌”，避免把真正的幂等重复选择错误解释为新换牌。
- 问题：首轮类型检查发现 Query facade 参数缺少显式类型，已补齐后复核通过；未改费用 / 结算 / Save。
- 地图与阶段文档核验：见 Task 的统一阶段收敛记录；未授权图写入。
