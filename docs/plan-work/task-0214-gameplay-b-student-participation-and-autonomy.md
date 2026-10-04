# Task 0214 — 玩法 B 学生参与与自主行动 Profile

状态：proposed — Task 0213 已完成；准备开始施工

## 目标

让由 AC Character 身份选入队伍的学生以独立 Event Actor 参加一场事件，并使用明确的操作 Profile 表达现场专长、行动倾向与候选行动范围。

## Why

学生必须影响“能做什么、先做什么、现场结果如何”，而不能只作为显示资料或数值倍率。长期角色成长和事件临时状态需要独立拥有者。

## Scope

- 事件入场时按 Character ID 解析学生身份，并为本局创建独立 ActorState。
- 定义学生的 `StudentOperationProfile` 语义：行动优先级、能力标签、专属行动候选和无合法计划时的安全回退。
- 保留角色各自的随机抽取技能作为 Profile 的独立规则：仅在 Commit 冻结后按 EventRun Seed 检查触发和结果；准备、预览、撤销与目标编辑不掷技能随机数。
- 至少一种专属现场能力必须改变处理问题的可行方案；数值倍率或普通标签差异不能单独满足此条件。
- Profile 与 CharacterVariant 保持松耦合；不把现场战术规则作为每个 Character 的基础持久字段。
- 角色因基础属性、战斗受伤或局内资源发生的变化保存在 EventRun；事件终局只返回结果，不自行写长期进度。
- 允许事件内容为对手或环境提供相同行动决策所需的参与者描述，但它们不进入玩家 roster。

## Non-goals

- 不在本 Task 创建角色养成、好感关系、通用社团模拟或敌人角色收集系统。
- 不复用 CharacterVariantProgress 作为临时战斗状态。
- 不让玩家逐个为所有学生挑选行动；有限指挥由 Task 0215 实现。

## Current AC facts

| 已核实事实 | 证据 | 设计影响 |
| --- | --- | --- |
| CharacterSystem 提供由 Registry 解析的角色定义与档案，RosterSystem 管理持有和可用角色。 | `docs/docs-829/02-modules/arona-clicker.md`；`docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth.md`；`src/data-services/contracts/character-data.ts` | 学生身份和可选阵容复用现有角色服务。 |
| CharacterVariant 是差分定义，VariantProgress 是每差分进度。 | `src/data-services/contracts/character-variant.ts`；`src/data-services/contracts/character-progression-def.ts` | Variant 不自动成为操作 Profile 或 ActorState。 |

## Data / API

- `ParticipantSpec`：Location 中的 participant ID、阵营、身份引用、Profile 引用和基础状态覆盖；优先作为 Location 的嵌入值。
- `StudentOperationProfileDef`：Character ID、排序后的行动候选/偏好、能力标签、可读理由键及可选的角色随机技能规则引用。Profile 专属现场能力与随机技能各自表达，不互相替代。
- `ActorState`：EventRun 内的 HP、操作资源、已应用的局部状态与本 Beat 计划；只保留该玩法实际使用的字段。
- 不复用主游戏 CharacterState 或 CharacterVariantProgress 结构作为 Run Actor。

## 保留的设计输入

早期用户裁定要求保留角色自己的随机技能，并且不新增消耗路线级 PlayerCost 的角色主动技能（[[draft-0204-gameplay-b-map-and-player-actions]]）。旧原型将其实现为满足条件后的额外随机触发检查（见归档 [[draft-0209-gameplay-b-current-loop-and-identity-review]]），不是玩家场景卡组的随机抽牌；这是 AC-native 玩法设计输入，不代表 AC 当前已有该 Runtime。Profile 专属能力为本 Roadmap 新增的可解释角色差异；两者并行。为符合 Draft 0212 的 Commit-only RNG 裁定，AC-native 的随机触发推迟到 Task 0215 有效 Commit 结算阶段消费 EventRun 随机流，不沿用旧原型预览前冻结结果的时序。

## Runtime Flow

选取 AC roster 中有效学生 → 用 CharacterSystem 读取身份与所需基础资料 → 用操作 Profile 算出本 Location 的 Actor 候选/专长 → 将当前局内数值复制到 ActorState → 供 Task 0215 的准备器使用。

## Acceptance

- [ ] 三个具有不同 Profile 的学生可参加同一 EventRun，并得到不同的行动资格、优先顺序或处理能力；差异可从 ReadModel 理由中解释。
- [ ] 缺失或不匹配的 Character/Profile 引用在开始事件前返回诊断，未拥有的学生不能绕过 AC roster 规则入队。
- [ ] 同一学生参加两局时 HP、资源和临时状态互相隔离；改变局内 ActorState 不改变长期角色进度。
- [ ] 对手和环境 Actor 可被同一准备/结算管线读取，但不要求其存在玩家角色档案或 roster 记录。
- [ ] 缺省/无可用行动时得到明确的观察/待机计划，并可由后续规则覆盖。
- [ ] 至少一个核心切片问题有 Profile 专属的有效解法；换下该学生或移除该能力后，合法行动、目标进度或可达结果有可观察变化。
- [ ] StudentOperationProfile 可声明角色随机抽取技能；技能不消耗 PlayerCost，重复 seed 与输入得到相同技能触发/结果，预览与改选不推进技能随机流。
- [ ] 行动理由解释“该学生为何在当前局势选择此行动”，并能追溯到优先级、能力或可见条件。

## Tests

- **Unit：**Profile 排序、能力资格、回退计划、随机技能触发规则引用和角色入场校验。
- **Runtime：**roster 入场、角色状态快照隔离、敌方/环境 participant 无 Character 引用路径、角色技能仅在 Commit 消费随机流。
- **Integration：**CharacterSystem/Roster 查询与操作 Run 创建协作；不对 Character 持久状态写入。
- **UI：**确认 OperationView 有足够理由字段；实际界面由 Task 0216 验收。

## Dependencies

- 依赖 Task 0213。
- Task 0215 使用本 Task 创建的 ActorState 和操作 Profile。

## Documentation / GALHCG

- 稳定后更新角色参与机制页和 `docs/docs-829/03-data-structures/player-state.md` 中适用边界；不得把每个角色的操作细节写入通用 CharacterSystem 正文。
- 学生操作 Profile 是可复用产品语义时才加入 GALHCG；单个学生配置与测试 Actor 不建语义节点。
- Read Set：`docs/docs-829/06-wiki/30-arona-clicker-domain/character-acquisition-growth.md`、Character/Roster 源码及相关测试、Task 0213 新运行时。

## 当前核验与剩余工作

当前核对了 Character/Variant/Roster 的定义边界；未实现、未运行测试。Profile 的实际字段须从行为需求反推，避免提前扩展 Character 基础 Schema。

## 相关路由

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]
- [[task-0213-gameplay-b-event-runtime-and-session-state]]
- [[docs/docs-829/05-conventions/schema-sync]]
