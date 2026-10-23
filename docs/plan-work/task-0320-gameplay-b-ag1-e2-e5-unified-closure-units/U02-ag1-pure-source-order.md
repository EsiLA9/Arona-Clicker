# Unit 0320-U02：AG-1 纯来源排序器

## Goal

实现可复用的纯排序器，按 Draft 0312 §13.2 已批准的完整排序键为 AG-1 执行来源生成唯一序列。该 Unit 只冻结与验证排序输入和输出；不组装真实 MapRun 来源、不规划费用或效果，也不写 Owner、Receipt、存档或 UI。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单与停止条件 |
| Task | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` | AG-1 总范围与依赖 |
| 前置 Unit | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U01-ag1-author-contract.md` 及 Receipt | 冻结的来源字段名称与类型 |
| Draft | `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md` §13.2 | 已批准敏捷公式的输出字段及完整排序键 |
| 源码 | `src/arona-clicker/contracts/map/map-cards.ts`：MapRun CardRef / 容器身份 | logicalIndex 的现行领域来源 |
| 源码 | `src/arona-clicker/services/map/map-run-service.ts`：当前计划入口，仅读 | 后续 U03 的接线边界；本 Unit 不修改 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts` | 现行确定性 MapRun 行为与测试习惯 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k tokens；只读排序所需合同、类型和相邻测试 |
| 文档 Read Set | 3 篇／节 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若排序器需要真实规划、CardRef 解析或 Restore 状态，停止并拆交后续 Unit |

## Constraints

- 输入字段必须由 U01 已冻结的作者合同与调用者快照提供；排序器不从外部数据库、Map、DOM、locale、哈希迭代或随机源读取任何值。
- 排序键严格为 `(-finalAgility, -baseAgility, sideRank, sourceRank, ownerDeclarationIndex, logicalIndex, sourceKey)`：降序敏捷后依次升序稳定尾键。
- candidate 必须是闭合的纯数据对象，仅包含 `sourceKey`、`finalAgility`、`baseAgility`、`sideRank`、`sourceRank`、`ownerDeclarationIndex`、`logicalIndex`；额外字段或访问器属性拒绝。
- `sideRank` 固定 party=0、enemy=1；`sourceRank` 固定 party entity=0、Ability=1、Item=2、enemy entity=0。party 只允许 rank 0/1/2，enemy 只允许 rank 0；非法 side/rank 组合拒绝。
- 所有数值键须是非负安全整数，且 `finalAgility >= baseAgility`（U01 的非负补足与 `max >= base` 保证此关系）；`sourceKey` 必须非空且唯一。重复来源键必须报错，不能依赖输入顺序解决。
- 字符串尾键只使用明确的代码单元字典序比较，不使用 `localeCompare`。`sourceKey` 是调用者按 Draft §13.2 形成的规范身份；本 Unit 不定义运行时 sourceKey 编码。
- 返回新数组，不修改候选数组或其中的候选对象。
- 敏捷公式、基础值快照、来源集合、费用、目标、Effect、终局以及旧 Receipt 投影全部留给后续串行 Unit。
- 排序只处理调用者实际传入的候选，不新增第二个 Ability/Item、不生成来源，也不把 Wait 或未选 Hand 放入队列。
- 来源总数由后续调用者受 Registry 校验的 Party/Enemy roster 以及至多一条 Ability 与一条 Item 来源形成；本排序器不另设与合法内容无关的队列上限。

## Allowed Files

- `src/arona-clicker/services/map/gameplay-b-ag1-scheduler.ts`
- `tests/engine/gameplay-b-ag1-order.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U02-ag1-pure-source-order.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U02-receipt.md`

## Explicit Non-goals

- 不修改 `map-run-service.ts`、MapRun contract、Map author contract、Registry、Schema、`runtime-game-instance.ts` 或 UI。
- 不重裁 Draft §13 的敏捷公式、Party 先手条件、稳定尾键与来源资格。
- 不计算 AG-1 最终敏捷；调用者提供已按 `min(base + actorAgility, max)` 冻结得到的 `finalAgility` 与 `baseAgility`。
- 不引入保存格式或 Receipt 字段。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。若 U01 实际字段或 U01 Receipt 与本 Unit 预期的敏捷输入不同，停止并回报负责人，不在本 Unit 内修改前置合同。

## Completion Criteria

- [x] 排序器对任何输入排列都产生相同且满足完整排序键的序列。
- [x] 覆盖 final/base 敏捷、仅在前两键相同后比较阵营、来源 rank、声明序号、logicalIndex 与 sourceKey 的逐层 tie-break。
- [x] 拒绝非法安全整数、`finalAgility < baseAgility`、非法 side/rank 组合、闭合字段外数据、空 sourceKey 与重复 sourceKey。
- [x] 排序器不修改输入数组或输入对象，并返回新数组。
- [x] 运行定向排序测试、`npx tsc --noEmit` 与 `git --no-pager diff --check`；Receipt 记录实际结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 排序行为 | `npx vitest run tests/engine/gameplay-b-ag1-order.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 实施记录

- 新增 `resolveGameplayBAg1SourceOrder(candidates)` 纯入口和 `GameplayBAg1SourceOrderCandidate` 闭合输入类型，返回新排序数组。
- 输入对象必须仅含 `sourceKey`、`finalAgility`、`baseAgility`、`sideRank`、`sourceRank`、`ownerDeclarationIndex`、`logicalIndex` 七个数据字段。party rank 仅 0/1/2，enemy rank 仅 0；`finalAgility >= baseAgility`。
- 数值全用安全整数和关系比较，字符串尾键用 JS 代码单元字典序；不依赖 locale、随机、DOM、Map Run 或调用者传入次序。
- 定向测试枚举 5 个来源的所有输入排列，并覆盖排序键、rank 组合、闭合字段、输入不可变和无溢出比较。命令结果见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U02-receipt]]。
