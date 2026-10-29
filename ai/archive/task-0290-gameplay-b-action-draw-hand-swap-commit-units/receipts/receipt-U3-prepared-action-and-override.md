# Receipt 0290-U3：Prepared Action、Target 与共享 Override

**结果：实现完成；补充测试后独立只读复核通过。**

## 修改内容

- 自然 Prepared Action 始终从每名队员 Hand 的第一项推导；空 Hand 表示 Wait，不生成 Wait 卡。
- 新增纯 Preview resolver，返回每名队员的完整 Hand、自然与最终 Prepared Action、目标类型、合法目标、是否需要目标选择、当前共享 Override，以及 PlayerCommand 可用候选和支付状态。
- `none` 不需目标，`self` 自动选择执行者，唯一合法队伍目标自动确定，多目标须写入明确选择。
- 免费 Swap 只能选择同一角色 Hand 中非首项行动；PlayerCommand 只能选择该角色当前 Encounter 候选中 Hand 外的行动，并要求当前 PlayerCost 与 Action 自身 Actor / Team costs 均可支付。PlayerCommand 预览标示精确 1 PlayerCost，不在草稿时扣除。
- 所有队伍共用一个 Encounter-local Override。草稿可以修改 / 清除；改动目标、Swap 或 Command 都只更新草稿版本，不改变 Hand、PlayerCost、Actor / Team resource、round 或 RNG。
- 所有草稿 API 使用 `{nodeId, round, draftVersion}` 令牌；错误 Node、旧 round / revision、非法目标、不可支付 Command、重复 Override 等请求均拒绝且不写入。
- Checkpoint 保存 / 恢复 Override 与目标选择，并由 Preview resolver 校验；兼容上一版 U2 checkpoint 中三个草稿字段全部缺省的快照，部分缺字段仍拒绝。

## 行为矩阵与验证

| 输入 | 结果 | 状态变化 |
|---|---|---|
| 重复 Preview / 查询 | 返回同一 Hand 与 Prepared | 无写入 |
| Hand 内非首项 Swap | 该角色 Prepared 改为所选候选 | 不扣 PlayerCost；占唯一 Override |
| 合法 Hand 外 PlayerCommand | 该角色 Prepared 改为指定候选 | Preview 显示 1 PlayerCost；草稿不扣费；占唯一 Override |
| 合法多目标选择 | 写入该角色目标选择 | 只增加 draftVersion |
| 清除 Override | 恢复 Hand 首项自然 Prepared | 只清除 Override 和相应目标草稿 |
| 无效 / 不可支付 / 过期 / 第二角色请求 | 拒绝 | MapRun 快照、资源、Hand、round 与 RNG 不变 |
| 保存并恢复 PlayerCommand 草稿 | Override、目标、Prepared 与 Preview 一致 | PlayerCost、Actor / Team resource、Hand、round、RNG 不变 |

- 定向测试：MapRun 与 Runtime Integration 两文件 **24/24** 通过。
- `npx tsc --noEmit` 通过。
- `git diff --check` 与 cached check 无空白错误；两个 Unit 测试文件无尾随空白。
- 独立只读复核通过。复核者未改文件、未运行测试；并按复核建议补齐错误 round token 零写入与 PlayerCommand checkpoint Save / Load roundtrip 覆盖。

## 边界

- U3 提供 `MapRunService` 行为草稿 API；GameInstance / GameCommands 与 Workspace 命令接线由后续 Unit 处理。
- U3 不执行费用扣除、Action effects、round 推进或下一轮 Draw；统一 Commit 在 U4 实现。
