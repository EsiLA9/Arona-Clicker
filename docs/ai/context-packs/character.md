# 上下文包：角色、招募与培养

适用：Character、Variant、Roster、Gacha、Cultivate、好感、装备和通讯录角色域。

## Required Read Set

机制改动先读 [[docs/docs-828/05-conventions/architecture-discipline]] 与 [[docs/docs-828/02-modules/character]]。再按实际子题选择：

| 子题 | 先读 |
| --- | --- |
| 招募 / 卡池 | [[docs/docs-828/04-mechanisms/gacha]]、相关 [[docs/docs-828/03-data-structures/character-entities]] 章节 |
| 通讯录 / 拥有关系 | [[docs/docs-828/04-mechanisms/roster]]、相关 [[docs/docs-828/03-data-structures/character-entities]] 章节 |
| 培养 / 成长 | [[docs/docs-828/04-mechanisms/cultivate]]、相关 [[docs/docs-828/03-data-structures/character-entities]] 章节 |
| 装备 | [[docs/docs-828/04-mechanisms/gear]]、相关 [[docs/docs-828/03-data-structures/character-entities]] 章节 |
| 好感 | [[docs/docs-828/02-modules/character]] 的好感部分与目标源码；历史设计理由按需查 [[affection-planning]] |

每次还要读取目标角色服务、状态写入口的相关调用及测试；不默认阅读全文或整个服务目录。

## Optional Read Set

- [[docs/docs-828/01-architecture/state-layers]]

## 默认不读

- `docs/plan-work/archive/**` 中关于角色拥有体系的历史计划，除非任务明确恢复该方向
- 独立 Datapack 编辑器文档

## 最小验证

角色域定向测试、`npx tsc --noEmit`；涉及字段时补 Schema 同步。
