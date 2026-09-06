# 06-adr/0002 — 生产结算树重构与 Affector 修复（taskProduction Phase 1-7）

- **状态**：已完成（分 7 个 Phase 落地，评审项逐一回填）
- **来源**：Affector 系列设计评审（`types/trigger.ts` Affector 类型 → `affector-engine` → `tag-effect` / GameNum 桥接）+ 生产结算全量重构

## 背景

评审发现三类问题：

1. **严重（功能错误）**：Affector 实例不落存档 → 读档后全部丢失（flows 归零、区表被清、一次性发放不重放）；初始状态物品/强化无挂载；`Effect[]` 在 Affector 中每 tick 全量执行（一次性 op 会无限发放）。
2. **高（语义断裂/死字段）**：`persistent` 声明即死；`life` 三档无执行者且缺省不一致；`syncAffectorZoneEffects` 每 tick 全量重建（含随机 id 节点）。
3. **旧生产结构**：「baseYield + tagMultiplier + 全局累加」隐式上抛，语义不可解释。

## 决策

### 生产结算树（Phase 1-3, 5-6）

- 显式四级层级树 `primitiveGain → initFull → areaFull → spotFull`，乘区只乘下一级 base 链；
- 区记录 value 为确定性 GameNum 叶子（const/expr，id = `${source}:${category}[:${multiplierId}]`），删除随机 id 与旧投影路径；
- 失效改事件驱动定向（`gainResourceDeps` 静态扫描 + `markSubtreeDirty`/`markDirty` 双向），tick 不再每帧失效。
- 详见 [[docs-828/04-mechanisms/production]]。

### Affector 修复（Phase 4, 7）

| 项 | 决策 |
| --- | --- |
| 读档/初始挂载缺失 | `reconcileMounts()` 按 PlayerState 对账重挂载，接线 init / enterInit / restoreFromSave / reset；回归测试 `affector-reconcile.test.ts` |
| 每 tick 全量执行 | `perTickEffects` 双通道拆分：`effects` 仅激活沿执行一次；声明类 op 动态读取 |
| `mount` 覆盖重复发放 | `mount` 幂等（已存在只 recheck） |
| 重复 entry id 隐式 OR | 注册期检测并经 DevLog 警告（语义保持） |
| `getSpotMaxLevelOverrides` 全扫 | 覆盖集合缓存，翻转时失效重建 |
| 每 tick 区表重建 | 改事件驱动同步（mount/unmount/recheck/标签变化等触发） |
| `persistent` / `life` 死字段 | 直接删除（含数据实参，不做迁移） |
| `spotCount` 命名 | 更名 `areaSpotCount` |
| builder 仅收 number | `modTag`/`modEntity` 放宽为 `number \| ValueExpression` |

## 后果

- **收益**：存档往返正确性恢复；生产语义可解释（每级可单独求值）；失效成本从每帧全树降到定向子树。
- **保留的纪律警告**：`flows` 与 `effects[addResource]` 并存会叠加（激活沿一次 + 每帧持续 = 双倍），数据作者二选一（见 [[docs-828/04-mechanisms/trigger-effect]]「双通道警告」）。
- **范围外未修**：`SpotFunctionalityDef.id` 兼作 pack 命名空间键的隐式覆盖（记录于 [[docs-828/03-data-structures/id-reference-semantics]] §六.3）。

## 相关文档

[[docs-828/02-modules/game-num]] · [[docs-828/02-modules/affector]] · `todoTask/taskProduction/REPORT.md`（执行记录）
