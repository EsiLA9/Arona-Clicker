# Unit 0301-U1b：校验敌方行动池与双边 Action 规则

## Goal

让 Registry 验证 Enemy 行动候选、目标用途、资源初值和 Action 来源，保证可通过内容加载表达用户已批准的策略，而不允许敌方候选变成 Ability / Item 的隐式 actorless 来源。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`：P0 / P1 | 当前 Enemy Action 合同 |
| 文档 | `docs/docs-829/05-conventions/testing.md` | Registry 行为变更验证等级 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`：Enemy、Action、target、resource 字段 | U1a 的输入类型 |
| 源码 | `src/data-services/registry/registry-validate.ts`：Action、Encounter、participant、Ability / Item validation | 修改点和约束 |
| 测试 | `tests/data/gameplay-b-map-registry.test.ts` | 直接行为回归入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 按角色 / 来源校验拆分 Unit |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| `eligibleCharacterIds` 当前同时区分 Character Action 与 actorless Action。 | `registry-validate.ts` 的 `assertActorlessSourceAction()` | 空 Character 列表不能再单独推断 actorless；还要排除 Enemy 候选。 |
| tendencyRole 当前在 Action 定义处用绝对 target kind 校验，HP 正负也被 target kind 固定限制。 | `registry-validate.ts` Action validation | 新规则需按候选 owner 校验 role，并允许 Enemy 支援治疗同类 Enemy。 |
| Enemy schema / hand pool 已在 U1a 加入；本 Unit 只接入严格内容验证。 | Task 0301 U1a Receipt | 不改数据类型或生成 Schema。 |

## Constraints

- `attack` 对 Character pool 表示 Enemy target；对 Enemy pool 表示 partyCharacter target。
- `recovery` 对 Character pool 只允许 self / partyCharacter target；对 Enemy pool 只允许 self / Enemy target。
- `defense` 的权重条件由使用者自身 HP 决定，不从目标类型猜；保持无额外限制。
- unit target 的偏好 enum 支持稳定顺序、最低 HP 比例和最高损失 HP 比例；无偏好仍稳定顺序。
- HP effect 正负表示 damage / healing，可以作用于任一合法 `enemy` / `partyCharacter` target；Registry 不从阵营猜效果方向。
- Actorless Ability / Item 引用 action 时，该 Action 不得同时出现在本 Encounter Enemy action pool。
- 允许无候选 Enemy（Wait），不生成默认行动。

## Allowed Files

- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md`
- 本 Unit 与其 Receipt

## Explicit Non-goals

- 不准备或执行 Hand，不修改 Owner、Commit、Receipt 或 Save / Resume。
- 不迁移正式 Datapack 的固定 `damage` 内容；由后续 Unit 处理。
- 不修改 Datapack Editor UI 或 Schema 生成文件。

## Stop Conditions

- Registry 无法区分同 Encounter 的 Character / Enemy / actorless Action 来源。
- 必须改变已冻结的目标 preference、tendencyRole、资源费用或 Action 结算语义。
- 需要编辑 Allowed Files 外文件。
- 定向 Registry 测试失败且无法归因。

## Completion Criteria

- [ ] 可加载含多名 Enemy、各自候选池与 Encounter-local 初始资源的 Battle。
- [ ] 拒绝未知 / 重复 Action 候选、非法 Tendency 权重、候选行动者不兼容的 role / target 组合。
- [ ] Enemy recovery 可用 Enemy target；Enemy attack 必须使用 partyCharacter target；Character role 规则保持现状。
- [ ] Ability / Item 不会误引用 Enemy Action；旧合法 Ability / Item 继续通过。
- [ ] 单位 target preference 方向由内容声明；HP effect 正负允许分别治疗 / 伤害任一阵营。
- [ ] 直接 Registry 测试、类型检查与差异检查通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Registry | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 架构 / 差异 | `npm run check:architecture`；`git diff --check` | 通过 |
