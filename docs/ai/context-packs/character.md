# 上下文包：角色、招募与培养

适用：Character、Variant、Roster、Gacha、Cultivate、好感、装备和通讯录角色域。

## Required Read Set

机制改动先读 [[docs/docs-829/05-conventions/architecture-discipline]] 与 [[docs/docs-829/02-modules/arona-clicker]]；领域概览见 [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]]。再按实际子题选择：

| 子题 | 先读 |
| --- | --- |
| 招募 / 卡池 | [[docs/docs-829/04-mechanisms/arona-clicker/gacha-cultivation]]、[[docs/docs-829/03-data-structures/player-state]] |
| 通讯录 / 拥有关系 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]]、[[docs/docs-829/03-data-structures/player-state]] |
| 培养 / 成长 | [[docs/docs-829/04-mechanisms/arona-clicker/gacha-cultivation]]、[[docs/docs-829/03-data-structures/player-state]] |
| 装备 | 当前文档没有专门的装备机制页；从 [[docs/docs-829/06-wiki/30-arona-clicker-domain/00-index]] 定位后核对目标源码与测试 |
| 好感 | 当前文档没有专门的好感机制页；从 [[docs/docs-829/02-modules/arona-clicker]] 定位并核对目标源码，历史设计理由按需查 [[affection-planning]] |

每次还要读取目标角色服务、状态写入口的相关调用及测试；不默认阅读全文或整个服务目录。

## Optional Read Set

- [[docs/docs-829/03-data-structures/player-state]]

## 默认不读

- `docs/plan-work/archive/**` 中关于角色拥有体系的历史计划，除非任务明确恢复该方向
- 独立 Datapack 编辑器文档

## 最小验证

角色域定向测试、`npx tsc --noEmit`；涉及字段时补 Schema 同步。
