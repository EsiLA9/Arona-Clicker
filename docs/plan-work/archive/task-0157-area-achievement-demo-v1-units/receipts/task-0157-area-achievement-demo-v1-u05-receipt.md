# Execution Receipt：Task 0157 U05

日期：2026-09-26

## 结果

- 关联 Area Listener 的 Milestone 现在仅为 `$InitProducedAmount <initId> <resourceId>` 与 `$InitCollectedAmount <initId> <itemId>` 的数值 `>=` / `>` 条件派生 Watch；DSL 参数数必须精确，且统计 Init 必须等于 Listener Area 的 `initId`。
- 资源累计目标派生精确的 `resourceChanged(resourceId)` Watch，物品累计目标派生精确的 `itemCollected(itemId)` Watch。事件进入现有 Adapter 后继续重验完整 Condition。
- 其他统计函数、错误 Init、额外 DSL 参数、不支持的比较符和无 Listener 的旧 Milestone 不获得该能力。
- Runtime 测试验证资源／物品身份过滤、资源花费与物品使用后累计量不回退，以及 Listener 准入时已有累计量达标仍会完成。统计叶与第二条件组成的 AND 组也证明每个唤醒都重验完整 Condition。StatsService 与资源／物品事件契约未改。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/milestone-adapter.test.ts` | 通过；1 个文件、9 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 315 |

## 限制

- 只覆盖两个指定 Init 统计函数；其他 `stat` 函数仍不生成实时 Watch。
