# Execution Receipt：Task 0157 U15

日期：2026-09-26

## 结果

- Registry 结构文档新增 `milestones`、`milestoneListeners` 与 `achievements` 表，并记录合并后引用及一对一校验；保留可未关联的旧 Milestone。
- Effect／Trigger 模块卡片记录 Area Listener 的准入条件、受支持的精确唤醒源、两种同 Init 累计 stat、完成后一次性执行 `then`、异常 DevLog 与只读 Achievement 投影。
- Trigger／Effect 机制文档更正 Milestone“无奖励/展示”的绝对说法：Milestone 只表达持久完成事实；效果由关联 Listener 的 `then` 承载，玩家文案和状态由 Achievement 投影展示。未关联 Listener 的旧 Milestone 保持原 Watch／完成行为，不执行 `then` 或进入 Achievement 投影。
- 明确当前仅支持 Area Listener；Init／全局作者范围、附加 `when`、前置成就和作者编辑器尚未实现。
- 未修改源码、测试、UI 实现、数据包或 Task 主文档。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 335 |
| `git --no-pager diff --check` | 通过；无空白错误 |

## 范围

- 仅修改三份当前事实文档并新增本 Receipt。
