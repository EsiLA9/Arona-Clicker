# Unit 0301-U5a：正式地图 Enemy Action 内容

## Goal

为所有正式战斗地图配置显式 Enemy Action 候选，让正式 Encounter 的敌方行动也经过 Hand / Target / Commit 机制执行。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | Task 0301：P5 内容迁移规则 | 固定伤害替换合同与版本处理 |
| 源码 | `src/arona-clicker/content/gameplay-b-map-datapack.ts` | 正式 Gameplay B Maps 与 Spot 入口 |
| 源码 | `src/data-services/contracts/gameplay-map.ts` | Enemy Action / Resource 内容合同 |
| 测试 | `tests/engine/gameplay-b-map-save-resume.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 正式地图运行与版本校验 |

## Constraints

- Enemy 行动必须是 Map-local Action；目标、HP / resource 效果与 tendencyRole 全部显式声明。
- 不读取行动名称或文案猜测用途；没有候选 Action 的敌方仍然 Wait。
- 修改会影响 Encounter 快照重演的 Map 时，递增其 `resumeVersion`。
- 同一 Encounter 不得同时执行固定伤害和 Action 攻击。

## Allowed Files

- `src/arona-clicker/content/gameplay-b-map-datapack.ts`
- `tests/engine/gameplay-b-map-save-resume.test.ts`
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`
- Task 0301 与本 Unit / Receipt

## Completion Criteria

- [x] 正式七个含 Enemy 的 Map 都配置显式 Enemy Action。
- [x] 多敌样例保留低 HP 目标、存活后手与 roster 顺序特点。
- [x] 受影响正式 Map 递增 `resumeVersion`。
