# Task 0320-U30：E4 MapRun 持续 Party Status 合同

状态：合同、运行时实现、作者样例与自动化回归已完成。屏幕验收需求单已交付，仍待人工执行；不把自动化结果记为人工通过。实现回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U30-receipt]]。

## 目标

在现有 Encounter-local Status 上增加显式 MapRun 生命周期：少数作者明确选择 `lifetime: 'mapRun'` 的 Status 可由固定 Party 持有并跨本 MapRun 的成功 Encounter 转场保留。未声明该字段的 Status 继续按现有 Encounter-local 合同处理。

本 Unit 只扩展 Status 的归属和寿命，不新增 Status kind、伤害计算点、触发事件或 AC 状态写入路径。实现继续使用 AG-1 detached Commit、Receipt 重放与 Save/Resume。

## 作者字段与来源资格

- `GameplayMapStatusDef` 增加可选 `lifetime: 'mapRun'`。字段省略时语义固定为 `encounter`；不接受作者显式写入其它寿命字符串。该扩展只允许 AG-1 Map。
- 只有 Party Character Action source 可以施加 MapRun Status。`statusApply.target` 只允许 `source`，或允许 `primary` 且 Action 的 `target.kind === 'partyCharacter'`。实例 holder 必须是该 Map 的固定 Party 成员。
- `statusApply.target: 'source'` 将 Status 施加给当前 Party Action 的来源角色。`statusApply.target: 'primary'` 将其施加给该 Action 的 Party primary；source 与 holder 可为不同的 Party Character。
- 不允许 Enemy source、Enemy holder、Ability、Item、`loopTarget`、敌方 primary、E1/legacy Action 或只通过 `candidatePoolIds` / 候选 Pool 引用的来源施加 MapRun Status。
- 每个 MapRun `statusApply` Action 必须在其来源角色对应的、实际声明的 Node/Activity Encounter `participants[].actions` 中直接列出。候选池展开不满足此条件；同一 Action 同时被直接列出和被 Pool 引用时，资格证明只取直接条目。`eligibleCharacterIds` 还必须包含该来源角色。
- 每个 MapRun Status 实例保存 `originNodeId` 与可选 `originActivityId`。省略 Activity ID 表示其来源是该 Node 的单个直接 Encounter；存在 Activity ID 时必须指向该 Node 实际声明的 Encounter Activity。来源资格验证始终回查这个原始 Encounter 的直接 `participants[].actions`，不要求来源 Action 出现在当前／后续 Encounter，也不读取后续 Encounter 的 candidate snapshot。
- 恢复来源时还需验证：来源是固定 Party 角色；来源 Action 存在于 Map 的 Action 定义中且 `eligibleCharacterIds` 包含该角色；该 Action 的 Effect Program 确实包含对该 Status ID 的允许 `statusApply`；primary 写法只与 Party primary Action 相配。无效或缺失的来源 Node/Activity、间接 Pool-only 资格、source/action 与 Status 不匹配均拒绝。
- Status 实例仍按现有 `(holder, statusId, source, actionId)` 身份合并。同一实例被同来源重施时，延续现有加层／刷新时长语义并保留首次施加的 `originNodeId` / `originActivityId`；实例被清除后再次施加时记录新的来源位置。
- 现有 Status kind（`burn`、`regen`、`damageReduction`、`damageProtection`）在显式选择 MapRun 寿命后继续使用各自既有作用规则。U30 不改变 Shield、Damage、Heal、hpChange、Revive、Trigger 或 E1/legacy 的作用范围。

## Owner 与只读投影

- `MapRun.mapRunStatuses` 是所有 MapRun-lifetime Status 实例的唯一权威 Owner。它属于单个 MapRun，Save/Resume 保存它；新 Run 初始化为空，Run 清除后不存在可供后续 Run 继承的 Status。
- `activeEncounter.statuses` 继续只持有 Encounter-lifetime Status。根据 MapRun Status 定义，一个 Status ID 的实例只能属于其中一个列表；任何实例都不得同时写入两个 Owner。
- 活动 Encounter 所需的完整 Status 集合是只读派生投影：将当前有效的 `activeEncounter.statuses` 与 `run.mapRunStatuses` 合并后，按既有 Party roster / Enemy roster 顺序、Status ID、来源身份和 Action ID 稳定排序。Planner、伤害结算、Status 清除／消费／类别净化与 UI 只消费该投影；规划结果再按定义寿命分别安装到两个 Owner。不得把 MapRun 状态拷贝进可保存的 `activeEncounter.statuses` 字段。
- `statusApply` 按 Map Status 定义将新实例写入相应 Owner；`statusRemove`、`statusConsume`、`statusRemoveCategory` 和轮末结算针对同一只读合并视图计算，随后按 Status 定义分区。所有列表更新、资源与 HP 变化必须处于同一 detached Commit。
- `MapRun.mapRunStatuses` 只含 `lifetime: 'mapRun'` 且 holder 为 Party 的状态。Encounter-local 实例只在 `activeEncounter.statuses`。存档、Receipt 或运行时状态若破坏该分区规则，必须拒绝。

## 时长与 Encounter 转场

- `remainingRounds` 表示该实例未来还可经历的成功 roundEnd Status tick 次数。仅成功的、未在普通来源阶段终局的 Encounter Commit 会执行 roundEnd；Shop、节点移动、Activity 转换、Encounter 入场和离开页面都不消耗时长。
- 当前 Commit 新建的实例不在同一 Commit 的 roundEnd 触发。已有实例按现有 Status 稳定顺序参与当轮 tick；自然到期仍按 U26 `onExpire` 合同在最后一次 tick 后结算。
- 持续 Status 使用跨 Encounter 单调时钟记录 `appliedCommitVersion` 与 `lastTriggeredCommitVersion`。`appliedCommitVersion` 保存首次成功安装该实例时的 Commit 起始版本；同一实例重施时不重置首次应用标记。当前计划在该版本中创建的实例跳过当前 roundEnd；之后每个成功 roundEnd Commit 最多 tick 一次，并记录该次 Commit 起始版本。持久实例不使用重置的 Encounter `round` 作为跨节点 tick 身份。
- Encounter terminal 发生在 roundEnd 前时仍遵循现有规则：Status tick 被跳过。中间 Encounter 胜利后，保留 `MapRun.mapRunStatuses` 中有效的 Party 实例，不扣 duration、不触发 `onExpire`；下一 Encounter 第一个 roundEnd Commit 按跨 Run 版本正常 tick。终局 Encounter 的本地 Status 仍清空。
- Shop 或没有活动 Encounter 的节点间隙保留 MapRun Status 根列表，但不触发其战斗效果、tick 或到期回馈。进入下一 Encounter 后从 MapRun root 读取同一列表，不生成副本。
- Run 失败、成功到达 Exit、显式清除 Run 或开始新 Run 时清空全部 MapRun Status。Run 终止清理不是自然到期，不触发 `onExpire`。若 `burn`/其它既有 roundEnd 效果在 roundEnd 后造成 Run 失败，则先完成该合法 tick 与 U26 到期回馈，再清除终止 Run 的状态；若普通来源已先令 Encounter/Run 终局，则仍跳过 roundEnd。
- 倒地 Party 仍是该 Map 的固定 Party holder；只要 Run 未终止，其 MapRun Status 保留并按 roundEnd 规则计时。Status 本身不复活目标。

## Receipt、Scheduler 与恢复兼容

- 新增 Status Receipt v7，只用于声明 MapRun-lifetime Status 的 AG-1 Map。v7 分别记录 Encounter-local Status 计划与 MapRun root Status 起点／计划结果；统一 `statusTrace` 按完整只读投影的稳定顺序记录 tick，实例身份包含来源 Node/Activity。`plannedMapRunStatuses` 是当前 Commit 及终局边界处理后的最终 MapRun root 列表：普通回合为 roundEnd 后的 root 状态；中间 Encounter 胜利为未经 terminal tick 的保留 Party 状态；Run 失败／成功 Exit 为清空列表。
- U30 Map 使用 scheduler format v7。Scheduler 起点快照增加 MapRun root Status 起点，并保持 `encounter.statuses` 仅为 Encounter-local 状态。含 Shield 的 Map 在 v7 中同时保留既有 Shield 起点和 Trace 规则。Commit Restore 从 scheduler 起点、Map/Encounter 定义与实际 Status Source 重新规划，校验双 Owner 分区、来源 Origin、tick/clear/expiry Trace、最终 root 状态及 Receipt。
- Shop gap 和刚进入下一 Encounter、尚未提交首轮的 Save/Resume 也须验证 `MapRun.mapRunStatuses` 与最近提交回执的 `plannedMapRunStatuses` 一致，即使没有可供比较的当前 `activeEncounter`。恢复到活动 Encounter 时，再核对本地列表与 root 列表互斥且完整投影唯一。
- 旧 Status Receipt v1–v6、scheduler v5/v6 的精确字段、计算和 Restore 分支保持不变；不在其格式里增加 root 字段或重解释其 `appliedRound`。未声明 `lifetime: 'mapRun'` 的 Map 继续选择已有版本。E1/legacy Status Receipt v1 与独立 Validator 不变。
- 含 MapRun-lifetime Status 的正式 Map 只提升自身 `resumeVersion`；不升级无关 Map。项目清档策略继续遵循现有架构规范，不新增隐式历史存档迁移。
- 恢复必须拒绝：丢失／增补／重排／篡改 root Status、来源 Node/Activity 或 direct Action 资格、Status lifetime Owner 分区、统一 Status Trace、tick 版本、expiry 资源结算及最终 Receipt。任何失败均不得部分安装 HP、Shield、Status、费用、资源或游标。

## 验收矩阵

| 场景 | 预期结果 |
| --- | --- |
| Party 直接 Action 施加 `target: source` MapRun Status | 创建一个 root 实例；活动 Encounter 列表不含该实例；同 Commit 不 tick；保存并恢复后 source、Action、origin、层数、时长一致。 |
| Party 直接 Action 施加 `target: primary`，Action primary 为 Party | holder 为固定 Party 成员；同 Commit 后续来源可见；Status 只进入 MapRun root。非 Party primary 或无法证明来源资格时作者校验／Restore 拒绝。 |
| Enemy、Ability、Item、Pool-only Action 或 `loopTarget` 施加 MapRun Status | Registry/Context 拒绝；这些来源仍可继续使用现有 Encounter-local Status（若原合同允许）。 |
| 活动 Encounter 的非终局成功 Commit | MapRun Status 按完整 Status 顺序参与伤害／效果与 roundEnd；只递减一次；记录 `lastTriggeredCommitVersion`。新施加实例不在创建 Commit tick。 |
| Status 重施 | 按既有 holder/ID/source/Action 身份加层和刷新时长；保留首次 origin 与应用版本；roundEnd 仍最多一次。清除后再次施加则记录新的 origin。 |
| 中间 Encounter 普通来源阶段达成胜利 | 跳过 roundEnd；未到期 Party MapRun Status 原样保留且不触发 `onExpire`；Encounter-local 与 Enemy-holder Status 清空。下一 Encounter 首轮来源可读取同一 root Status。 |
| 成功胜利后经过 Shop／节点间隙 | MapRun root 状态保留，Shop/移动不 tick、不到期；Save/Resume 可校验最近 Receipt；进入下一 Encounter 后不复制 Status。 |
| 进入下一 Encounter 后首个成功非终局 Commit | MapRun Status 在来源执行时生效，之后按剩余时长正常 roundEnd tick；多个 Encounter 的 round number 重置不会重复或漏 tick。 |
| 最后一次 tick 到期 | 使用 U26 `onExpire` holder 回馈与顺序；自然到期移除 root 实例并记录资源变化。终局清理、显式移除／消费／净化不伪装成自然到期。 |
| Run 失败、成功 Exit、显式清除或重新开始 | root Status 清空；不触发 `onExpire`；新 Run 不继承旧实例。中间 Encounter 胜利与 Run Exit 必须区分。 |
| Save/Resume 位于活动 Encounter | Root MapRun 状态与 Encounter-local 状态互斥；只读合并投影准确且无重复；v7 Restore 重算 Receipt。 |
| Save/Resume 位于 Shop gap 或刚进入下一 Encounter | 当前活动 Encounter 可以为空／无上一轮 Receipt scope；仍核对 root 与最近回执的计划结果、来源 Origin 与所有 MapRun 状态字段。 |
| 历史兼容 | E1 Status Receipt v1、AG-1 Status Receipt v1–v6、scheduler v5/v6（含既有 Shield Map）维持现有夹具与 Restore 结果；U30 新 Map 使用 Status Receipt v7 与 scheduler v7。 |

## 自动化与实屏验收

- 自动化至少覆盖上表中的来源拒绝、双 Owner 分区、同轮不 tick、跨 Encounter round 计时、Shop 间隙、自然到期、terminal cleanup、失败原子、Receipt 篡改拒绝与历史 v1–v6/v5–v6 Restore。
- 新增独立可进入 AG-1 Map 示例：Party 直接 Action 给 source 或 Party primary 施加一项 `lifetime: 'mapRun'` Status，完成 Encounter A，中间经过 Shop，再在 Encounter B 观察作用与剩余轮数；另覆盖 Exit/失败清理。示例不复用 U26 Ability 来源以绕过 U30 来源限制。
- 新合同需有正式作者说明和迷你控制台白名单演练命令。人工屏幕验收仍需用户在宽屏浏览器实际执行，需求单状态保持“待人工执行”；自动化、文档或命令输出均不等于屏幕验收通过。
