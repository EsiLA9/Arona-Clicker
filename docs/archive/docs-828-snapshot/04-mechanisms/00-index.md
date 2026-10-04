# 04-mechanisms — 当前机制总入口

> 本目录用于记录当前代码已经实现或明确作为当前运行规则的机制。它与模块卡片、数据结构和未来计划分工不同。

## 目录职责

| 内容 | 归属 |
| --- | --- |
| 子系统职责、代码入口、依赖关系 | `docs/docs-828/02-modules` |
| 状态/实体/枚举/引用的数据形状 | `docs/docs-828/03-data-structures` |
| 当前机制的规则、结算管道、联动和推导 | `docs/docs-828/04-mechanisms` |
| 未实现设计、路线图、ADR、施工任务 | `docs/plan-work/` |
| 历史审查与风险记录 | `docs/docs-828/07-audit` |

## 迁移状态

机制正文已完成迁移。`docs/docs-828/04-mechanisms/` 现在是唯一当前机制事实源；`docs/docs-828/04-algorithms/` 仅保留迁移说明。

| 主题 | 当前文件 | 迁移目标 | 状态 |
| --- | --- | --- | --- |
| 状态变更管道 | `04-mechanisms/state-mutation.md` | `04-mechanisms/state-mutation.md` | ✅ |
| 生产结算 | `04-mechanisms/production.md` | `04-mechanisms/production.md` | ✅ |
| 抽卡结算 | `04-mechanisms/gacha.md` | `04-mechanisms/gacha.md` | ✅ |
| 培养推进 | `04-mechanisms/cultivate.md` | `04-mechanisms/cultivate.md` | ✅ |
| 色彩派生 | `04-mechanisms/color-derivation.md` | `04-mechanisms/color-derivation.md` | ✅ |
| 事件联动 | `04-mechanisms/trigger-effect.md` | `04-mechanisms/trigger-effect.md` | ✅ |
| 通讯录/招募入口 | `04-mechanisms/roster.md` | `04-mechanisms/roster.md` | ✅ |
| 装备成长 | `04-mechanisms/gear.md` | `04-mechanisms/gear.md` | ✅ |

迁移完成条件已满足：正文只保留一份、两个总入口已更新、全库 WikiLink 检查通过。

## 机制文档写作要求

每篇机制文档至少说明：

1. 触发入口与调用顺序；
2. 输入数据和状态层；
3. 结算/变更步骤；
4. 事件、Effect、Trigger 或 Affector 的联动边界；
5. 当前实现限制和未实现项；
6. 对应测试文件与最后核验日期。

