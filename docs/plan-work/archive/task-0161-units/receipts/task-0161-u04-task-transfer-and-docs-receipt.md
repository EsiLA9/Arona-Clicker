# Execution Receipt：Task 0161 U04

状态：完成

## 实际修改

- 将 Task 0158 的证据与未完成范围转交 Task 0161，并保留最后已知状态归档；更新 `docs/plan-work/00-index.md` 为单一活跃入口。
- 在机制文档中记录来源快照、选择页投影、Restart 不叠加活动 Area、继承/空覆盖与 user Preview 替换行为。
- 修正 Patch Unit 索引中数量描述与实际列表不一致的问题，登记 U06。

## 验证

- `npm run check:docs`：通过，scanned markdown 363。
- 本 Unit 管理文档的 `git diff --check`：通过。
- 全仓库 `git diff --check`：仍报告 `aoci.code.txt:702: new blank line at EOF`；该文件属于 AOCI Volume，本 Unit 未直接修改。
