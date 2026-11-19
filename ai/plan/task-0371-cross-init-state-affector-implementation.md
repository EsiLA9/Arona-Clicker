# Task：落地跨 Init 封存、全局钱包与星图 Affector 隔离

状态：待处理

依据 [[ai/plan/report-cross-init-state-affector-audit]]。按以下次序交付，先锁住已复现的错线写入，再收窄派生开销。

## 目标与验收

- 软退出只保留本地快照，回线恢复进度与合法位置，原线在大厅或 B 中没有运行中的经营、战斗、奖励监听。Global 钱包、历史、星图权限和明确的保存级设置保留。
- GlobalEnhancement 保留持有资格。服务和星图导航权限可在大厅使用，经营 Affector 仅在获准的活动 Init 创建，按节点声明的 Init／Area／Spot 绑定。整个活动 Init 内的 Area／Spot 经营与玩家所在 Area 解耦。
- 星图历史奖励通过稳定保存级键发放一次，资金归 Global 钱包；普通事件、剧本与本地里程碑奖励归来源 Init。
- 固定奖励与资格只作为回归用例。正式超级资源档位、定价、生产曲线和单轮新高作为后续玩法需求。

## 工作项

- [ ] **P0 归属与钱包。** 从 `StateMutationService.resourceBucket`、`InitService.getResourceAmount`、`ValueSystem`、`ConditionSystem`、`StatsService` 和 ReadModel 开始。产品层提供按资源归属的读取 Port，Engine 保持可独立使用；通用表达式、条件、支付校验、统计余额、Shop 与 Spot 交易、Effect 回执、UI 读模型使用同一桶。保留 `resourceChanged` 的精准失效，覆盖 Global 资源变更驱动的合法条件。统计中的历史总量按实际来源 Init 归因。归入 `InitSnapshot` 的余额排除 Global ID，余额读写和收费的单一提交点必须一致。
- [ ] **P0 封存与退场。** 统一软切线、回大厅、硬重开及定义删除时的退场边界。根据 `PER_INIT_FIELD_SPECS` 收口本地 `spotTagOverrides`、直接经营区记录、被动冷却与学生阻断，保持 Mod residue 可保存和按归属恢复；Affector 派生区记录由当前定义重建。核实未接线的 `enhancementAttachments` 是否有留存价值。使用 MapRun／Operation 现有 checkpoint 按 Init 封存可续局的局内状态，退出即撤销 owner 中的活动局及命令。回线只恢复合法版本、定义和阵容；过期或无法续局的 checkpoint 走已有拒绝或终止流程。硬重开清除该线快照和局内状态，保留保存级进度。区分首次大厅预购、软退出后恢复和真正新游戏；旧位置仍合法就恢复，否则回到该线默认 Area。继续保证读档只为保存时活动的 Init 批量结算，`gain × N` 与已有帧规则复用。
- [ ] **P0 角色、设施与错线奖励。** 将基础包名册、碎片、抽卡保底、装备、设施等级及派驻按 Init 封存，保留 `characterMemory`、`protoStats` 和收集历史。将夏莱联络点改成本地可领取设施，角色写入夏莱，替换现有允许跨线持有和 Global Spot 写入的断言；明确旧声明的停用或校验策略，避免外包静默保留经营实体。把按 Init 统计解锁的旧顶层奖励挂到对应 Init。其余以全局条件发本地奖励的旧 Trigger 逐条确定领取范围。显式全局限购可以继续使用现有 Shop 记录。
- [ ] **P1 星图与 Affector。** 让星图购买/授权与本地宿主独立。沿 `EnhancementService`、`AffectorEngine.reconcileMounts`、`SpotFunctionalitySystem`、`game-num-build.ts` 和 `game-num-tag.ts` 核对接线，复用现有条件索引、增量撤销和同 ID 热替换。持有来源、Init 归属、宿主实体共同确定实例身份；tag、通配和精确目标都在允许范围内匹配。没有适用宿主时经营声明不挂载，明确的服务／导航能力继续可查询。检查 flow、乘区/平加成、额外 Spot 功能、交通边、`effects` 与 `perTickEffects` 的作用域。整个快照恢复窗口抑制重放发奖，同时保留真实条件翻转。为基础包的「全能基建」「全域物流」「永恒契约」和主题权限给出显式承接，既覆盖随活动线经营的节点，也覆盖大厅能力。
- [ ] **P1 保存级领取。** 复用现有历史查询及 `milestoneProgress.completed` 资格，另记稳定奖励键和来源 Init。对有效的 Global 资源奖励，在同一 Mutation 提交余额与领取标记后发布通知，重复调用及同步重入均幂等。结算前校验完整奖励，钱包与领取记录随同一份存档持久化。本地普通奖励继续用本地完成记录。用固定历史条件与少量青辉石验证入口，后续正式星图奖励由数据配置。
- [ ] **P2 收窄派生工作。** 活动 GameNum 树、资源发现、目标通配及功能同步按活动 Init 和显式允许范围物化，Registry 仍服务静态预览。切线及同 ID 内容替换后撤销过期 contributions/依赖，保持真实新增资源能即时建树。用调查的同资源与独立资源压力夹具比较节点数、实例数和离线输出。

## 回归场景

| 场景 | 可验收结果 |
| --- | --- |
| A → 大厅 → B → A，途中存读档 | 大厅没有活动经营；B 无 A 的资源、道具、角色、派驻、tag override、局部区记录、冷却或阻断。A 回线恢复本地进度、合法 Area、已有剧情游标及有效局内 checkpoint，跨线旧命令失败。 |
| 软重启、硬重开、首次大厅预购、真正新游戏、热删活动定义 | 软切恢复、硬开清本线、真正新游戏清保存级进度。首次大厅预购在进首线后可用；热删依同一退出边界退回选择页，旧实例、监听与局内命令失效。 |
| 双 Init 同标签，A 再分两个 Area | 同线移动时 Area 效果只持续影响该 Area。B 的 flat、通配、显式 ID 和额外功能无法计入 A，B 可按自己的资格创建实例。离线 10 帧只从活动线计算，A 的快照未被写入。 |
| 读档及同 ID 热替换 | 同一贡献各有一个来源；替换的倍率、资源、目标和条件依赖更新；丢失的宿主撤销且无需全局重建。读档、切线往返和替换当下均不重发一次性奖励，真正的条件变化仍生效。 |
| 全局钱包、阿比多斯联络点及累计奖励 | 青辉石表达式、条件、费用、余额和统计来源一致，快照无重复青辉石余额，错误桶无法通过预检扣成负数。A 的联络点和招募只写 A，B 的累计奖励先到 A 再 Tick 时不会写 A，回 B 后只发一次。 |
| 星图历史奖励 | B 达成资格；在允许的入口领取一次，全局钱包只增一次。切线、读档、硬重开及重复调用均保留已领事实。结算失败时两者均不变，保存失败后读回最后一次完整存档时两者保持一致。 |
| 512 个同资源或 32 个独立资源的 inactive Spot | 活动生产、目标范围和活跃实例数量保持，活动树节点及资源键不随外线经营定义增长。 |

## 入口与完成条件

- 先把调查探针转换为小型行为回归。就近使用 `tests/engine/world`、`tests/engine/core`、`tests/engine/progression`、`tests/engine/character`、`tests/engine/gameplay-b` 与 `tests/engine/runtime-content`。复核 `base-onboarding-spot.test.ts`、`global-enhancement.test.ts` 中明确依赖旧行为的断言，钱包测试通过真实 Mutation 注资。
- 改动发布基础包时验证 `src/arona-clicker/content/base-pack/content.json` 及其作者入口。改动 Datapack 契约按 [[ai/guide/conventions/schema-sync]] 同步，存档结构发生变化时走项目现有存档版本策略。同步 [[init-state-snapshots]]、[[affectors-and-contributions]]、[[session-and-tick]] 和受影响的领域机制页。
- 运行 `npm test` 全量回归、架构和文档检查，并记录与调查一致的 inactive 节点数量对照。依 [[ai/guide/conventions/testing]] 复核所有状态写入、依赖和生命周期入口。

## 当前进展

- 下一步：先固定双 Init 的奖励错写、钱包读写不一及退场后的 Operation 提交复现，再改 P0。
