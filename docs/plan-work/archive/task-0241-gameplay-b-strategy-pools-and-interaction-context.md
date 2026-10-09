# Task 0241：Gameplay B 角色倾向、行动池抽取与交互场景上下文

状态：completed — E0/E1、U12/U13 Engine 修正、U10 相似玩法实例、U11 headless 虚拟回放与 Engine/D1/D2 GALHCG 维护均已完成并通过复核。

## 目标

扩展 AC 内 Gameplay B Operation，使角色本轮可见/可选的行动来自当前交互事实与多个 CardPool 的合并，并由角色 StrategyProfile 对合法候选施加可解释的权重偏好，形成每名角色独立、有限且可重复的行动 Hand。ActionCard 继续以当前 Operation Action 的目标、费用和效果合同为实际行为来源。

完成引擎闭环后，另建独立的 Gameplay B 测试内容实例，覆盖接近原始 B Demo 的战斗、场所活动、既定阵容中的角色位置/状态变化、路线和结束流程；内容要专门证明倾向抽取、站位变化后的候选重解析及一个非战斗场景，而不是只用最小夹具宣称玩法成立。Gameplay B Run 的 Actor roster 在开始时固定，当前 Operation 不支持运行中增删 Actor；原型的动态队伍加入属于本轮明确未复制项，Director 应通过已有角色的位置/状态变化提供相似的选择后果。提供无需浏览器的虚拟游玩/回放入口，供人手动查看、选择和核对结果。

本 Task 覆盖最终方向的第一阶段：验证“Context → CardPool → 合法 Candidate → Strategy Weight → Character Hand → 行动提交”在现有 Operation 生命周期中可工作。它不代表通用 NPC AI 或任意世界交互模拟已经完成。

## 设计边界

- 本 Task 包含：Operation 专用的交互事实读取、Pool 命中/合并、Action 合法性过滤、策略偏好加权、每名学生的有限行动 Hand、确定性抽取及存档恢复边界；Registry/Datapack 内容接线；独立的近完整玩法 B 测试实例；可审阅的 headless 虚拟游玩与回归验证。
- ActionCard 优先复用现有 `OperationActionDef` 的目标、费用、参与者、能力与有限效果。新增规则须证明现有 Operation 合同无法表达，并由最小行为案例驱动。
- `playerSceneDeck` 是事件级共享场景牌组；新建的角色 Hand 是逐角色行动候选结果。两者不能混名、混状态或意外共用抽牌/费用语义。
- 按 Operation/AronaClicker 的 Runtime 边界施工，不让基础 Engine 依赖 Gameplay B 或产品数据。唯一已确认的窄例外是为两个新顶层 Datapack 表在 `src/engine/core/entity-id.ts` 的共享 `ENTITY_TYPES` 增加其稳定 typeName；这只扩充通用 Registry ID 词汇，不改 parser/validator 算法或基础 Engine 行为。超出该精确例外仍须有跨产品案例与边界测试并先交 Task Owner 裁定。
- 新 Datapack 合同遵守 Registry、Schema 源类型及生成约定；“忽略 Editor”是排除 Editor 界面、操作流和编辑体验施工，不授权手改生成 Schema，也不豁免必要的契约同步。
- 新测试实例使用与现有 `gameplay-b@1.0.0` 不冲突的独立 Event / Location / Action / Profile / Pack 身份；不替换或悄悄扩大既有旋转木马演示，不复用原型临时 ID。
- E1 已实现的 CardPool 来源为 Event、Location、学生 Operation Profile 的静态引用，Context facts 只负责激活已声明 Pool；没有运行时临时 Pool 注入。现有 `randomSkillRuleId` 是 Commit 概率效果，也不等价于角色行动卡池抽选。Director 的本轮验收用静态已声明 Pool 完成，并将原型临时/random Pool 玩法标记为未复制项；若其成为必需验收，再另立引擎补充 Task。
- 明确非目标：独立 Datapack Editor 功能、Editor 表格配置/UX、角色招募 Gacha 卡池或 GachaService 改造、完整 Strategy Tree / Behavior Tree / GOAP / 通用 Utility AI、DatingAI / NegotiationAI、完整世界模拟、任意脚本条件 DSL、原型所有剧情文本的逐字复刻、浏览器验收。
- 使用者指定的阶段顺序：① Luna 负责引擎实现、引擎行为诚实验收与该阶段 GALHCG 图维护；② 该阶段完成后再委派“导演”负责独立 Datapack/玩法实例施工、抽象玩法复核及无浏览器虚拟游玩设计；③ 内容通过人工可审阅的玩法闭环核验后，再维护该数据阶段的 GALHCG 图。E1 后续发现并补列 U12/U13，因此须在 U13 Engine 验收后先完成 Engine 图谱增量，再恢复 Director U10/U11；D1/D2 数据图仍须等内容/回放验收后单独维护。阶段间不得并行修改同一批合同或数据文件。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| AC Gameplay B 使用 `operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles` 四张 Datapack 表；Action 含参与者类型、能力要求、reason/tag、有限 Cost、目标和效果，Profile 按 Character 声明静态候选/优先顺序/能力/reason/可选随机技能规则。 | `src/data-services/contracts/operation.ts`：`OperationActionDef`、`StudentOperationProfileDef`、`OperationEventContentDef`；`src/data-services/contracts/datapack.ts` 的四张表；`src/arona-clicker/services/registry-operation-content-resolver.ts` | 可以复用 Operation Action 执行合同，但 Strategy、CardPool、Entry Weight 与 Context 条件均不能假设已存在。 | 
| 学生 Profile 入场时被冻结为本局快照；候选只按静态 `candidateActionIds` / `actionPriorityIds` 投影，并按静态 capability 标记资格。 | `src/arona-clicker/services/student-operation-profile-resolver.ts`：`snapshotProfile()`；`src/arona-clicker/contracts/operation.ts`：`OperationStudentProfileSnapshot` | 动态位置/武器/场景事实与 Pool 重解析需有明确 Runtime owner；不能直接把静态 `capabilityIds` 说成动态事实合成。 |
| Beat 准备按 Actor 声明顺序检查候选资格、地点启用、目标与费用，选首个合法行动；无可用项时使用稳定 Wait。没有加权行动抽取或角色手牌。 | `src/arona-clicker/services/operation-plan-preparation.ts`：`validateStudentCandidateRows()` 与 `prepareOperationBeat()`；`tests/engine/operation-plan-preparation.test.ts` | 新抽取阶段应定义与规范计划、玩家干预和 Commit 的连接点，并证明失败/预览不消耗随机状态。 |
| 当前 `OperationActionDef.tagIds` 已用于 Combination 的有序输入标签；没有证据说明这些 Tag 已具有 Strategy Bias 语义。 | `src/data-services/contracts/operation.ts`：`OperationActionDef.tagIds`、`OperationCombinationRuleDef`；`src/arona-clicker/services/operation-combination-resolver.ts` | 复用 Tag ID 作为开放策略分类是候选方案而非已裁定语义；须明确多个 bias 命中、无匹配默认权重和重复池条目的合并规则。 |
| Operation 的 Location/事件/Actor/轨道是有限 Runtime 事实；没有 `OperationAction.when` 通用条件字段、Actor 前后排状态或武器字段。非战斗已具备 Individual/Global SceneAction 与同 ActionDef 结算。 | `src/data-services/contracts/operation.ts`：`OperationActorDef`、`OperationLocationDef`、`OperationActionDef`；`src/arona-clicker/services/operation-view-projector.ts`；`operation-runtime.md` | Context 首期应小而有界，至少能表达验收所需的场景、position/weapon 事实和动态转换；Pool/Action 条件的可查询面须受限。 |
| Operation EventRun 的 Actor roster 在 Run start 时由 Event 固定；OperationRuntimeService 只提交已有 Actor 的状态变化，没有运行时参与者加入/移除命令。 | `src/arona-clicker/services/operation-runtime-service.ts`：`createRun()`、`validateRestoredRun()`；`src/arona-clicker/contracts/operation.ts`：`OperationEventDef.actors`、`OperationRunStartInput.actors` | 当前引擎阶段不复制原型的“队伍加入”；Director 使用既定 roster 上的位置、资源、HP 或事实变化产生可玩选择，并把动态成员加入标为未覆盖。 |
| 现有 `playerSceneDeck` 是事件级、共享 PlayerCost 的有限物理牌组；使用 drawPile/hand/discard，地点入场抽牌，不回洗。 | `src/data-services/contracts/operation.ts`：`OperationPlayerSceneDeckDef`；`src/arona-clicker/contracts/operation.ts`：`OperationCardZones`；`operation-runtime.md`“EventRun 状态与归属” | 角色行动 Hand 是新逐 Actor 概念，与玩家 SceneCard 抽牌独立；随机流、恢复及 Zone 生命周期须显式规定。 |
| 当前战术 RNG 为 Run 持有的局部确定性流，主要在成功 Beat Commit 中对有限 Student Skill Rule 抽样；它不是角色行动抽牌。 | `src/arona-clicker/services/operation-tactical-rng.ts`、`src/arona-clicker/services/operation-resolution-planner.ts`；`tests/engine/operation-tactical-rng.test.ts` | 可以评估复用既有 Run 随机算法或拆出独立 stream，但须确保重放与 Save/Resume 一致且 preview/rejected command 不推进已提交游标。 |
| 当前正式玩法 B 包为独立可选 `gameplay-b@1.0.0` bundle，旋转木马现有内容提供固定三名学生、多个 Opponent/Environment、成本/目标/Combination/技能及路线场景切片。 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`carousel-safety-slice.ts`、`carousel-scene-action-slice.ts`、`carousel-route-slice.ts`；`tests/engine/gameplay-b-scene-action-sample.test.ts`、`gameplay-b-route-sample.test.ts` | 现有内容可作为接线参考，但不满足同武器/站位的差异抽取、站位变化重解析或 Negotiation 验收；新样例须独立。 |
| 原型 B Demo 含 12 节点游园路线、3 场战斗、场所活动、队伍加入/休整、敌方意图、普通行动牌和行动配方；这些内容有测试覆盖，部分数据仍属候选规则。 | `prototypes/gameplay-b/README.md`、`prototypes/gameplay-b/src/content/first-battle.ts`、`prototypes/gameplay-b/src/content/characters.ts`、`prototypes/gameplay-b/src/content/park-graph-route.ts`、`prototypes/gameplay-b/tests/park-demo.test.ts`、`prototypes/gameplay-b/tests/battle-prepare.test.ts`、`prototypes/gameplay-b/tests/skills.test.ts` | Director 数据阶段须制作“相似但独立”的近完整可玩验证实例，并标清沿用哪些已确认机制、哪些原型规则只是测试候选；不可只搬几张卡就宣称对标完成。 |
| 根项目有 Vitest / TypeScript 测试环境，无交互式 Runtime CLI 或 `tsx` 入口；现有 DEV quick-test console 不能启动或操作 Operation Run。 | 根 `package.json`；`src/ui/development/gameplay-b-quick-test-console.ts`；`tests/engine/gameplay-b-scene-action-sample.test.ts` | Director 应优先提出能从现有依赖执行的 headless 回放/操作方案；不得声称当前已有终端试玩能力，也不使用浏览器。 |

## 需裁定点与文本-潜在解决方案

以下方案在 E0 前用于指导核验和收敛；其待选分歧已由本 Task 的 E0 裁定收敛。若实现源码证据否定当前合同，仍须停在对应切片记录事实与替代项，不以原始 SOL 草案压过现有事实。

1. **Profile 与 StrategyProfile**：可将 StrategyProfile 独立为顶层定义并由学生 Operation Profile 引用；也可先把 bias 内嵌于 Profile，避免无独立复用场景时增加实体。两者都须与 Character / Variant 身份、保存快照和 Datapack 覆盖规则一致。
2. **CardPool 来源与正交合并**：候选来源可包含场景公共、position/weapon capability、角色专属及临时运行时来源；考虑独立 Pool Def 表和 Entry 引用现有 Operation Action。重复 Action ID 应按显式规则合并来源/权重，不能因多池命中而意外重复抽取。
3. **InteractionContext 与 Condition**：建议先建立 Runtime 提供的有限值视图，只包含首期验收所需的 `scene/activity/position/weapon` 与当前 Actor/Run 状态；Pool 激活条件与单 Card 合法性条件分层。不要默认把通用 Condition DSL 接到 Operation，也不要创建通用 WorldContext Entity。
4. **权重合并与概率保证**：首期可评估 `entryWeight × strategyFactor`，提供正权重、无匹配 tag 的中性因子、非正/非法值校验及可解释来源。必须确保 Strategy 只改变合法候选的相对概率，不授予能力、不覆盖目标/费用合法性。
5. **抽取时机 / Hand 生命周期 / 随机流**：选择每 Beat、每 Location 或显式 refresh 时抽取有限容量 Hand；Hand、抽取游标和 Seed 的 Run 归属需支撑读档和重放。现有战术随机算法或独立派生 stream 均可评估；抽取预览、失败操作不得偷偷改变 committed cursor。
6. **Hand 如何变成行动**：可由玩家通过已有干预/受控命令从 Hand 选行动，也可暂用简单确定性 Runtime 逻辑选择；不做生产 UI 的情况下，测试接口必须能显式选择并观察所选卡，且仍经既有 legal target / cost / atomic Commit 校验。最终选择应由 Luna 在写代码前记录理由。
7. **能力事实与前排转换**：可把位置作为 Operation Actor 的可变事实，并由 `Step Forward` Action 更新；重新解析候选时位置变化自然改变匹配 Pool。若实现上需要统一 facts/capabilities 表示，须证明其不会模糊静态 Character 能力与当前状态。
8. **被动闲聊池 / Gacha 卡池边界**：`PassivePoolDef` 是剧情被动池树，`GachaPoolDef` 是角色差分抽取；两者都不是 Operation 行动池的即插即用 Runtime。只在字段与生命周期语义吻合时复用纯抽选工具，不复用会混淆内容类型或状态 owner 的系统。
9. **虚拟游玩途径**：首选 Node/Vitest 可运行、确定性、可读 transcript 的 headless 回放；由人工操作步骤/决策脚本驱动真实 Operation facade，逐回合列出 Context、匹配 Pool、被过滤行动及原因、调整前后权重、Hand、最终目标/费用/Resolution。若需真正交互式终端且当前依赖不支持，应先给出最小实现方案与运行方式；不启用浏览器、独立 Editor 或外部运行依赖。

## 施工切片与委派顺序

### E0：Luna — Operation 引擎合同与设计收敛

- 复核上述事实与原型边界；确定最小 schema、Condition/context 可见字段、Pool 合并、权重、手牌大小/抽取时机、RNG/Save/Resume、行动选择入口。
- 把最终选择和仍未解决的分歧记录在本 Task 后再施工。需要修改共享 Engine、Game UI、Editor 或跨出白名单时先上报，不自行扩张范围。

### E1：Luna — Runtime/Datapack 引擎施工与诚实验收

- 实现 Pool 匹配/合并、Card Condition 合法性过滤、Strategy Bias 调权、角色 Hand 确定性抽取、Action 选择到既有目标/Cost/Effect/Commit 边界的最小闭环。
- 如果需要改 Run/Save/Resume、View 或 Registry/Schema，同步更新合同、校验、resolver、纯 planner/projector、相关恢复逻辑和测试；不新增存档迁移层。
- 至少证明两个条件相同但 Strategy 不同的角色产生可复现且明显有别的候选/Hand；无合法攻击行动时不会因攻击偏好产生行动；位置转换后激活对应 Pool；预览/非法命令与失败提交不消耗随机流；Save/Resume 后 Hand 与抽取状态一致。
- 由 Luna 执行引擎定向测试、类型检查及其负责文件的 GALHCG review/update_map；更新本 Task Receipt/状态后才交接数据阶段。

### D1：导演 — 独立内容包与近完整相似玩法实例

- 仅在 E1 稳定后开工。构造独立 Gameplay B pack/event 作为平行测试实例，不替换当前游乐园 demo；按原型 B Demo 的 12 节点路线与 3 场战斗构造接近完整的平行体验（建议约 10–12 个可进入节点、3 个战斗阶段、多个活动/场景结算、路线分支与终局），并由 BDemo 对标表逐段说明覆盖，不能缩水为单战斗小夹具。路线要包含既定阵容角色的位置/状态变化、同武器/站位的不同倾向抽牌对照、一个 Negotiation Scene，以及至少一个有实际后果的路线选择。原型的动态队伍加入本阶段标为未复制项，因为 Run roster 只在开始时固定；无需为此扩展 Operation roster 机制。
- 在该路线内提供两个可比较角色（同武器与 position、不同 StrategyProfile）、多个公共/角色专属 Pool、position 转换后重解析；提供一个微型 Negotiation Scene 并证明同一 StrategyProfile/tag bias 随 Context 生效。内容和测试要实际使用引擎新增合同，不能仅在无消费者的夹具定义数据。
- 对照 `prototypes/gameplay-b/` 的确认机制与候选规则，列表说明哪些 BDemo 维度已映射、哪些明确不复制以及为何；确保内容足以让人手动比较 Hand 分布、站位转变和交涉行动。
- BDemo 对标表明确记录未复制的运行时动态队伍加入、临时/随机 ActionPool 注入，以及只属于原型候选而未裁定的规则；不得用静态 Context 选择或现有 Random Skill 冒称覆盖这些能力。
- 设计并落地无浏览器虚拟游玩方式。优先复用根项目 Vitest/TS 运行环境实现易运行、可读、带人工选择点的 headless replay/transcript；如果方案需要额外运行器，先证明依赖可用或提出最小增量，不构造 Editor/浏览器页面。

### D2：导演 — 抽象玩法审查、手动验收脚本与图维护

- 从内容作者角度检查：Context 决定候选空间、Pool 声明可用行动、Action 是可执行行为、Strategy 仅改变相对倾向；跨 combat/social 无第二套 AI；Pool 来源、抽选原因与过滤原因可解释。
- 使用 headless 虚拟游玩完整走通新的平行示例，保存可重放命令/seed 与关键 transcript 摘要；确认内容足以支撑人工比对现有 BDemo 体验，不以类型检查或断言数量代替玩法验收。
- 通过后由导演维护测试内容、文档与测试路径的 GALHCG Evidence/maps_to，并写完 D1/D2 Receipt；不得在这一阶段重新改引擎合同，若发现抽象缺口则先记录为待裁定事项回到 Task Owner。

## 验收

- [x] 角色候选来自所有当前匹配 Pool 的可解释合并结果；Card Condition 仅过滤合法性，Strategy 不创建 Action、不绕过能力、目标、费用或地点限制。
- [x] StrategyProfile 的 bias 与 Action tag 匹配只改变合法行动的权重；重复池命中、多个 bias 命中、零/非法权重与无 tag 匹配均有稳定规则和测试。
- [x] 角色 Hand 是有限、逐 Actor、确定性和可恢复的；同 seed / 初始 Runtime facts 可重放；Save/Resume 不重抽或丢失已见手牌；与事件级共享 `playerSceneDeck` 相互独立。
- [x] 同武器、同站位、同 Context 的高 protect/cover 与高 attack/aggressive 角色，面对共享候选池时有不同的 Hand 倾向；测试展示样本分布并验证种子/统计边界。
- [x] 位置 Action 将角色从 back 转为 front 后，候选重新解析并激活前排 Pool；不调用硬编码 `switchDeck(frontDeck)`。
- [x] 小型 Negotiation Scene 使用相同的 Strategy/Pool/Action 机制产生社交候选与偏好；实际 SceneAction wrapper 提交边界被明确记录；不增加 NegotiationAI / Social Simulator。
- [x] 手动选择的 Hand Action 沿既有 Operation target、cost、effect、原子 Commit 边界执行；invalid target / insufficient cost 不产生部分状态写入。
- [x] 新独立数据示例具备近完整可玩路线节奏与足够卡牌差异，覆盖战斗、活动、变化状态、路线和终局；Director 提供与 BDemo 对标映射及不能复制项说明。
- [x] 无浏览器的虚拟游玩入口可复现种子和关键流程，并逐角色观察匹配 Pool、过滤原因、策略调权、Hand、行动目标及结算结果；人手按脚本可走完整示例。
- [x] 不实现 Editor 工作流或浏览器验收；必要的 Datapack 源 Schema 变更按项目规则同步，生成物不手改。
- [x] Luna 与导演分别完成对应阶段的定向测试/检查及 GALHCG 变更闭环；测试结论、未完成项和地图复核范围记录在本 Task。

## 初始核验（2026-10-06）

- 已核验 SOL 草案相关当前合同、机制和测试入口；并经独立只读 Agent 审阅。结论：StrategyProfile、CardPool、动态 Context、角色 Hand 与 weighted draw 在 AC 玩法 B 中均属新能力，不是把现有 `candidateActionIds` 或 `playerSceneDeck` 更名即可获得。
- 已记录主要待裁定：Strategy Profile 归属、Context/Condition 限制、重复池 Entry/多标签权重规则、抽取时机/生命周期/RNG、Hand 选择入口；现已由下方 E0 冻结。
- 已找到可引用的原型 B Demo 路线/战斗内容与测试入口；当前 AC Carousel demo 不足以验证 Strategy 差异、动态 Position 和 Negotiation，因此 D1 要增加独立近完整样例。
- 已确认根项目没有交互式 Operation CLI；D1 需要设计真正可运行的 headless 人工回放路径。

## E0 — Luna 裁定（2026-10-06）

以下是 E1 的执行合同。它限于 AronaClicker Operation，不接入通用 Engine Condition、Effect 或 AI。

### Schema 与注册关系

- 新增顶层 `OperationStrategyProfileDef` 与 `OperationCardPoolDef`，分设 `operationStrategyProfiles`、`operationCardPools` Datapack/Registry 表。学生 `StudentOperationProfileDef` 通过 `strategyProfileId` 和 `cardPoolIds` 引用；Event 与 Location 各自提供可选 `cardPoolIds`。Event/Location/Character Profile 不内嵌 pool 内容。
- Registry 的所有定义 ID 共用三段式 `ENTITY_TYPES` typeName 登记；U2 仅向该目录增加 `operation-strategy-profile` 与 `operation-card-pool` 两项，并以 Registry 正反例测试覆盖。不改 Entity ID 解析规则或通用 Engine 行为。
- Action 增加开放字符串 `strategyTagIds` 与可选 `cardCondition`。该标签与 Combination 使用的 `tagIds` 分离。Strategy Profile 对 tag 声明正整数 `biasBps`；未命中时中性 10000 BPS。
- CardPool 的 `entries` 引用 Operation Action 并声明正整数 `weight`；Pool selector 与 Action `cardCondition` 共用有界 `OperationCardConditionDef`：`sceneIds`、`activityIds`、`positionIds`、`weaponIds`、`requiredFactIds`、`forbiddenFactIds`。数组空缺代表不限制；显式数组为 OR；selector 各字段之间为 AND。`sceneId` / `activityId` 由当前 Location 声明；事实只查询 Event 的 knownFactIds；position/weapon 只查询该学生当前快照事实。无任意路径表达式、无世界查询。
- `OperationActorDef` 可声明初始 `positionId` / `weaponId`。只新增有限的 `actorPosition` Action Effect（actor 或目标接收、设置 positionId）支持验收用的后排转前排；Runtime Facts 保持显式字段，不引入通用 key/value 容器。武器本阶段只读，不增加武器切换 Effect。
- `OperationEventDef.characterHandSize` 可选，缺省为 3，正整数且有内容校验上限 10。抽牌对象限学生；对手 Intent 与共享 `playerSceneDeck` 不进入角色 Hand。

### 解析、权重、Hand 与命令

- 单次解析按 Event pools、Location pools、学生 Profile pools 合并；Pool ID 去重。重复 Action Entry 按 Action ID 汇总基础权重并合并 source Pool IDs，不产生重复牌。基础权重为所有命中 Entry 的正整数 `weight` 之和。
- Pool selector 命中后，按 Action 的参与者类型、静态 capability、当前 Location `enabledActionIds`、Action `cardCondition`、目标/费用当前合法性过滤；只有合法 Action 可被加权。Strategy 命中的 bias 以 `max(0, 10000 + Σ(biasBps - 10000))` 计算，同一 tag 在一个 Action 上最多计一次。该 Task 有意采用对中性 10000 BPS 的线性偏离相加，不按 tag 逐个相乘；多标签角色示例（如 protect、cover）应按加法因子解释，以限制偏好叠加。最终权重是 `baseWeight × strategyFactorBps`；零权重候选不抽取。至少一个候选无 tag 命中时 factor 为 10000。
- Hand 对每名学生独立执行不放回 weighted draw，数量为 `min(characterHandSize, 合法候选数)`。Run start 生成首手；每次成功 Beat Commit 后，以 Beat 后的新 Run facts 重新解析并替换下一 Beat Hand；成功 SceneAction/Card batch Commit 后也按已更新的 Run facts 重新解析 Hand（保持当前 beatIndex）。初手与后续 Hand 使用由 Event seed、actor ID、已提交 beatIndex 派生的独立确定性手牌 stream（算法沿用 splitmix64-counter-v1，手牌 stream seed 独立派生）；仅输出的 Hand/beatIndex/seed 即可恢复和重放，无单独保存的未提交游标。现有 tactical skill stream 保持独立、不改变。
- **既有内容兼容**：现有 Gameplay B 样例 Profile 只有 `candidateActionIds`，Director 阶段不会为 Carousel 迁移旧数据。若学生当前 Event/Location/Profile 显式 Pools 合并后没有任何命中 Entry，就把该 Profile 的 `candidateActionIds` 当作隐式 legacy personal Pool（每项基础 weight 10000）；Action 仍必须通过同一 capability/Condition/target/cost/location 合法性过滤。只要显式 Pools 产生至少一个 Entry，就只使用显式 Pool 候选，不混入 legacy 候选。Strategy 缺省时中性；该规则确保现有 Carousel 行为保留，而新独立样例走明确 Pool。
- 当前 Beat 的规范计划仅可从已生成 Hand 中选择。沿用现有 Intervention 作为选择入口，显式选中的 Action 必须属于该 Actor 当前 Hand；默认准备可从 Hand 中选第一个当下合法行动。`OperationView` 投影每名学生的 Hand、Pool 来源、合法/过滤原因与权重说明，不暴露 RNG 内部状态。现有 preview/revise/commit 继续校验目标、费用和原子效果；preview/非法/失败提交不改变 Run/Hand/seed。
- Run start 初始化 Hand；成功 Beat Commit 更新 Beat、效果后事实和下个 Hand；位置变化因此在下次解析自动激活对应 Pool。读档保存已抽出的逐角色 Hand；恢复时使用当前冻结内容重算并校验当前 Hand 合法性及候选/策略合同，拒绝不匹配 Resume，不迁移旧存档。`playerSceneDeck` 的 zones、PlayerCost 与抽取完全独立。

### Patch Units

本 Task 采用 13 个正式 Unit，因超过 3 个而拆入 `task-0241-units/`，各自白名单与 Receipt 位于专属目录：

- `task-0241-units/0241-u1-operation-authoring-contract.md`：内容类型与 Datapack 汇总合同。
- `task-0241-units/0241-u2-operation-registry-validation.md`：Registry 表、引用/数值/selector 校验与解析接线。
- `task-0241-units/0241-u3-operation-content-handoff.md`：Registry 规则解析到受控 Admission/RunStart 的内容 handoff。
- `task-0241-units/0241-u4-operation-candidate-hand-runtime.md`：纯候选解析、权重与确定性抽取（含 legacy fallback）。
- `task-0241-units/0241-u5-operation-hand-preparation.md`：Preparation/Intervention 选择与校验。
- `task-0241-units/0241-u6-operation-position-effect-contract.md`：actorPosition Effect 的闭合 author/input validation。
- `task-0241-units/0241-u7-operation-position-resolution.md`：Pure Planner 的字符串 position change 计划。
- `task-0241-units/0241-u8-operation-save-commit.md`：Run/Save/Resume/Commit 状态 owner 与原子结算。
- `task-0241-units/0241-u9-operation-view.md`：OperationView 的角色 Hand 诊断投影。
- `task-0241-units/0241-u10-strategy-park-sample.md`：独立近完整相似玩法实例及其真实 Runtime 内容验收。
- `task-0241-units/0241-u11-headless-virtual-play.md`：无浏览器 headless 脚本回放、人工决策点、transcript 与 D1/D2 Receipt。
- `task-0241-units/0241-u12-scene-action-admission-separation.md`：修复 SceneAction / 共享场景牌资格误依赖角色战术候选导致现有 Carousel 无法启动的回归。
- `task-0241-units/0241-u13-context-card-condition-admission.md`：修复新 Location Context / Pool 字段和 Action `cardCondition` 被旧 Runtime Admission whitelist 拒绝的 Registry-to-RunStart 合同断层。

U1–U9/U12/U13 仅写 Operation 契约、Registry、Runtime 与 engine tests；U10/U11 的唯一内容是新增独立玩法样例 Datapack、样例行为测试和 headless 虚拟游玩回放。不改 Editor UX、浏览器/UI、现有 Carousel 样例或通用 Engine（U1/U6 明确批准的 `ENTITY_TYPES` 两个 typeName 是唯一窄例外）。源 Schema 若按项目规则要求生成协议，只运行生成器，不手改生成物、不做 Editor 界面施工。

## GALHCG 影响闭环

- 项目身份：`resolve_project` 对工作区 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram` 返回 `project_id=acprogram`，根目录匹配。
- 发现路径：从 Project overview 进入 `module:engine`、`module:arona-clicker-domain`、`concept:operation-event-run-runtime`；E0 初查地图时按 Action/Pool/Gameplay B 查询无对应概念命中。源码与测试确认当前边界；PassivePool 与 GachaPool 分别是闲聊内容和角色差分招募，不作为 Operation 卡池的既有机制。D1/D2 现已通过，并由独立测试和数据实例支持一个此前没有的实现概念“Operation Character Hand Resolution”；最终数据图阶段将为 Context → 静态 CardPool → 合法候选 → Strategy bias → 确定性 Character Hand 建立该单一概念，并复核它被 Operation EventRun Runtime 包含，不拆造 combat/social 子体系。
- 计划文档变更后按精确 Task 路径复核本页与 index 的 Evidence/maps_to，并确认 Task 仍以待实现方案陈述，不污染 `docs/docs-829/` 当前机制。
- E1 地图维护完成：Operation Runtime、Operation Student Profile Admission、Registry、Engine Schema sync 的对应 Evidence 与 maps_to 已刷新；新增映射覆盖候选解析器、候选解析测试、View projector 测试、U1–U9 合同/Runtime/测试及获准的 `ENTITY_TYPES` 窄扩展。E1 未创建新 Concept；待 U10/U11 对整个交互闭环和独立手动回放验收后再裁定。
- 为修复直接改动路径上旧 Evidence 的 stale 状态，另对 Data Services / Datapack Editor 节点和既有相关 maps_to、depends_on、contains 关系仅刷新 version token；逐项确认其 owner 与关系语义仍准确，没有增删边或扩展 Editor 施工。核对 owner 清单和结果见 `task-0241-units/receipts/0241-e1-operation-runtime-and-galhcg.md`。
- D1/D2 地图维护完成：新增确认 Concept `Operation Character Hand Resolution`，边界为静态 CardPool 合并、Context/行动合法性过滤、Strategy tag bias 与确定性 Character Hand 抽取；通过 `related_to` 连接 EventRun Runtime 和 Student Profile Admission。关联 Operation resolver/生命周期/投影/Admission/Datapack 契约，Strategy Park 内容、U10/U11 测试及 Receipt；刷新 Task 和 U12/U13 重命名后的 Receipt Evidence。所有直接变更路径 `review_changes` 为 unchanged/stale=0，新 Concept 15/15 Evidence freshness 为 fresh。

## 剩余工作

- E0 已裁定完成；U1 内容源合同/生成 Schema 已完成（同步测试 8/8）；U2 Registry 表与校验已完成（定向测试 44 项）；U3 内容解析与 Admission handoff 已完成（定向测试 14 项）；U4 候选解析、策略加权、独立确定性抽取和旧 Profile fallback 已完成（相关定向 59 项）；U5 Preparation/Intervention 已接入 Character Hand 选择边界（25 项）；U6 actorPosition 合同、strategyTagIds Admission 校验与生成 Schema 已完成（Admission 15 项、Schema 同步 8 项）；U7 纯 Resolution Position delta 已完成（Planner/Admission 联合定向 26 项）；U8 Run/Save/Commit 已完成（Runtime 与 Gameplay B Save/Resume 36 项）；U9 View Hand diagnostics 已完成（Runtime-to-View 1 项）。跨 Unit 回归 147 项、类型检查、diff-check 和本阶段 GALHCG review/update_map 均通过。E1 Receipt 记录最终 Evidence/owner 审核与交接边界。
- U10/U11 白名单与验收已完成。U10 独立园区样例经真实 Runtime 走完完整 12 点成功路线、三战 3/3/4 Beat、Negotiation 通行证 Gate、同 Context 策略手牌差异、back→front Pool 重解析；U11 Transcript 发现并驱动修复东出口 `social/handoff` 错误引用探索池问题，现终点命中独立 handoff Pool，`legacyFallback=false`。U10 和 U11 定向测试均 1/1 通过，完整 headless 文本与摘要同 seed 重放一致。U11 具体证据见 D1/D2 Receipt。
- U12 已分离 SceneAction/`playerSceneDeck` performer eligibility 与角色战术 Hand，并回归验证 Carousel 可启动、场景牌可结算且三张 SceneAction 不进入角色 Hand；Engine 4/4、类型检查和 diff-check 通过。UI controller 的 5 个启动后失败另记在 U12 Receipt，不属于本轮 UI 范围。
- U13 已补齐 Runtime Location `interactionSceneId` / `activityId` / `cardPoolIds` 与 Action `cardCondition` 的 closed-field/shape 校验，标准 Registry → Admission → `OperationEntry.start()` 行为验证和负例完成。与 U12 一同完成 Engine GALHCG Evidence/maps_to 增量；E1 U1–U9 的 147 项报告加 U12/U13 定向覆盖，不宣称全量测试通过。
- E1 局部边界：Actor roster 固定；Pool 来源是 Event/Location/Student Profile 静态引用，Scene Facts 只激活已声明 Pool。未实现运行时临时 Pool 注入；`randomSkillRuleId` 仍是独立的成功 Commit 概率效果，不是角色行动抽卡来源。
- U11 headless 人工决策脚本已覆盖全路线，明确展示每个 Context 的 Pool/Hand/weight/Resolution/route、战斗目标/费用、SceneAction 命令和成功终局；Negotiation 如实标注为 Hand 候选/bias 诊断而由 Location SceneAction wrapper 提交。Task Owner 与独立 Agent 均审阅通过。
- 复核后归档本 Task 及其 Unit/Receipt 路径；现行 Gameplay B Runtime 文档的后续维护不属于本 Task 的剩余工作。

## 相关路由

- [[task-0240-gameplay-b-operation-card-presentation-and-action-targeting]]、[[archive/task-0236-gameplay-b-typed-action-cards-and-target-layers]]、[[task-0221-gameplay-b-authoring-and-content-validation-workflow]]
- [[docs/docs-829/03-data-structures/operation-view]]、[[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]
- [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/testing]]、[[docs/ai/PROJECT-CONSTITUTION]]、[[docs/ai/galhcg-project-map]]
