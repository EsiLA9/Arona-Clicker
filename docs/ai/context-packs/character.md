# 上下文包：角色、招募与培养

适用：Character、Variant、Roster、Gacha、Cultivate、好感、装备和通讯录角色域。

Spot 招募入口是 Spot 的 `gacha` 功能项，不在通讯录。

## 按子题选择

只读命中的一行；领域未知时从 [[docs/docs-829/02-modules/arona-clicker]] 或 [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]] 定位。改变架构或状态写入边界时，再读 [[docs/docs-829/05-conventions/architecture-discipline]]。

| 子题 | 先读 |
| --- | --- |
| 招募 / 卡池 | [[gacha-cultivation]]、[[docs/docs-829/03-data-structures/player-state]] |
| 通讯录 / 拥有关系 | [[docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth]]、[[docs/docs-829/03-data-structures/player-state]] |
| 培养 / 成长 | [[gacha-cultivation]]、[[docs/docs-829/03-data-structures/player-state]] |
| 装备 | 当前文档没有专门的装备机制页；从 [[docs/docs-829/06-wiki/30-arona-clicker-domain/00-index]] 定位后核对目标源码与测试 |
| 好感 | 当前文档没有专门的好感机制页；从 [[docs/docs-829/02-modules/arona-clicker]] 定位并核对目标源码，历史设计理由按需查 [[affection-planning]] |

再核对目标角色服务、相关状态写入口及测试；不默认读取整个服务目录。

## Optional Read Set

- [[docs/docs-829/03-data-structures/player-state]]

## 默认不读

- `docs/plan-work/archive/**` 中关于角色拥有体系的历史计划，除非任务明确恢复该方向
- 独立 Datapack 编辑器文档

## 验证入口

行为改变时运行角色域定向测试；契约改动时补类型检查，涉及字段时按 Schema 同步规则执行。
