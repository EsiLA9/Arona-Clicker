# Task：Gameplay B 敌方自主行动卡牌

状态：approved / complete — P0—P5 已完成；完整 Workspace 文件与仓库文档检查的已知问题记录在 Receipt 0301-U5c。

## 目标

让 Gameplay B 每名敌方单位像我方 Character 一样，拥有自己的行动候选、每轮 Hand、自然准备行动与自动目标，并使用同一套倾向权重、目标合法性、确定性准备和行动结算规则。敌方 Hand 只读，玩家不能 Swap、发 PlayerCommand 或手动改目标。

本 Task 扩展 Task 0299 的自主策略覆盖面，复用其已经完成的普通单位目标、情境权重、目标失效和费用合同；不恢复旧 Operation Planner，不增加第二个 MapRun Owner。

## 已冻结的产品规则

1. **敌方也是自主行动者。** 每个 Encounter 敌人各自有行动候选池及 `tendencyWeight`；候选引用 Map-local Action。每个存活敌人每轮按与我方相同的 Hand 容量、加权不放回规则和自然行动规则准备行动。固定空 Hand 仍表示 Wait，不暗加攻击。
2. **策略算法共用。** Action 合法性、显式 `tendencyRole` 的情境修正、目标资格、目标偏好、稳定平局顺序、随机流和回合快照共用一套机制。角色侧与敌方侧的单位身份及资源生命周期仍保持各自归属。
3. **目标仍由 Action 明确声明。** 本 Task 保留当前 `self`、`partyCharacter`、`enemy` 等目标类型；敌方攻击通常选择 `partyCharacter`，敌方支援可选择 `self` 或 `enemy`。不得读取 Action 名称、描述或 HP 效果正负猜用途。目标偏好只在合法候选中生效；`attack`、`defense`、`recovery` 的兼容性按候选所属行动者及双方关系校验。
4. **敌方不接受玩家干预。** 敌方不产生 Swap、PlayerCommand、手动 Target、Ability 或 Item 指令。读卡不写状态；敌方当前 Hand 及准备行动按只读卡牌表现，可查看但不能改变。
5. **准备与结算时点。** 每轮进入准备时，按固定队伍顺序、再按 Enemy roster 顺序，一次确定全部双方 Hand、自然行动和自动目标；同轮 Preview、UI 查看、Save / Resume 不重新抽取。Commit 保留 Task 0291 的玩家 Character → Ability / Item → Enemy roster 顺序。Enemy 行动先前可见，实际执行时若 Enemy 已死亡则跳过；自动目标已失效则按当前 Action 策略重选，找不到合法目标时跳过且不支付该 Action 的 Actor / Team resource cost。
6. **费用和资源隔离。** 我方 Action 继续使用现有 MapRun Character / Team 资源。Enemy Action 可使用 Enemy 自身 Encounter-local Actor 资源及独立的 Encounter-local Enemy Team 资源，不得消耗我方 Team 资源或 PlayerCost。自然 Hand[0] 按固定双方顺序做虚拟 Team 预留；实际扣费只发生在 Commit。
7. **存档确定性。** Encounter snapshot 持有每名存活 Enemy 的 Hand / 自然行动 / RNG 重演所需状态以及必要的目标、资源数据；恢复后的当前计划一致。改动相关 Map 内容时递增 `resumeVersion`；遵守当前不为存档结构编写迁移兼容层的规范。
8. **内容迁移。** 固定 `damage` 回击改由显式 Enemy Action 表达。不得继续同时运行旧固定伤害和新卡牌攻击；正式 Map、样例及测试内容逐步迁移，旧 checkpoint 按 `resumeVersion` 规则处理。

## 旧合同的有意变更

| 旧合同 | 本 Task 新合同 | 影响 |
| --- | --- | --- |
| Task 0291：敌方仅配置固定 `damage`，全部玩家来源结算后存活 Enemy 自动回击。 | 每名 Enemy 自己准备并执行 Hand[0]；其 Action 可包含显式目标、HP / 资源效果及倾向。 | 需要扩展 Datapack / Registry、Encounter 状态、策略、Commit / Receipt、Save / Resume 和只读 UI；所有固定伤害内容须改成 Action 内容。 |
| Task 0299：Enemy 在玩家阶段后按届时 HP 选择目标，意图不提前公开；Task 0299 P3 只覆盖 Character Action。 | Enemy 在回合准备阶段抽 Hand 并确定自然行动 / 自动目标，作为只读意图展示；执行时沿用自动目标失效修复规则。 | 0299 已交付的 Character 行为保持不变；只替换原有简化 Enemy 回击与隐藏意图规则。 |

## 实施前核实事实

| 已核实事实 | 源码依据 | 影响 |
| --- | --- | --- |
| `GameplayMapActionDef` 有 Character eligibility、target、tendencyRole、资源与 HP 效果；tendencyRole 当前按 Character 的 target 类型校验。 | `src/data-services/contracts/gameplay-map.ts:38`；`src/data-services/registry/registry-validate.ts:215–382` | 需要扩展 Enemy 候选资格与按行动者校验。 |
| Encounter participant 有加权 Action 候选；Enemy 只有 `id / initialHp / maxHp / damage`。 | `src/data-services/contracts/gameplay-map.ts:283–326` | 在 Enemy 上增加 Action 候选及初始局内资源。 |
| `drawGameplayBHands()` 以固定我方队伍顺序抽取，限制 Hand 为 3 张，并已有上下文权重、合法目标和 Team cost 预留。 | `src/arona-clicker/services/gameplay-b-hand-resolver.ts:13–18, 180–370` | 将现有 resolver 泛化到两侧，避免复制 Enemy AI 算法。 |
| Encounter snapshot 仅保存 Character Hands / Overrides / Targets 和 Enemy HP；Commit 另以固定 damage 生成 `enemyAttacks`。 | `src/arona-clicker/contracts/map-run.ts:251–281`；`src/arona-clicker/services/map-run-service.ts:1225–1241` | 增加 Enemy 准备与资源状态，并将固定回击替换成同一纯结算计划中的 Action 执行。 |

## P0—P5 施工顺序

### P0：合同与范围准入

- 固化上述 Enemy autonomy、只读控制权、准备 / 结算时序、资源归属、内容迁移及 Save / Resume 规则。
- 将 Task 0291 的固定伤害语义和 Task 0299 的隐藏 Enemy 意图语义明确标记为有意替换；既有 Character 已完成行为不回退。

### P1：Action 池与 Registry 合同

- 在 Enemy roster row 上声明加权 Action 候选；Action 支持显式 Enemy eligibility，并继续复用现有 Action 效果、费用与 target preference。
- 候选引用、target / tendencyRole 兼容性、HP 效果正负和 Actor / Team resource 作用域都由 Registry 校验；actorless Ability / Item 不可混成 Enemy 行动。
- 确保 Enemy Action 的攻击 / 支援 / 自保目标能够由现有 target 类型准确表达，不从文案推断。

### P2：共用策略准备与 Encounter 状态

- 将 Hand 选择、情境权重、合法性、自动目标和稳定随机抽取泛化到 Character / Enemy 两种行动者。
- 按 Character → Enemy roster 稳定顺序准备；Enemy 各自拥有独立 Hand 与自然 Action，无可付或无合法行动时走明确 Wait / Skip 行为。
- 增加 Enemy-local Actor / Team 资源、Prepared Action / Target / RNG 所需快照，并使 Save / Resume 可校验和确定性重演。

### P3：Enemy Action Commit

- 在现有原子 Commit 计划中执行已准备的 Enemy Action，移除固定 `damage` 回击结算。
- 敌人死亡时跳过其行动；自动目标失效时重选；无合法目标则不收 Actor / Team Action cost。Preview、费用、HP / 资源变化与 Receipt 使用同一计划。
- Receipt 记录敌方 Action ID、目标、实际效果、费用和 Skip reason；终局判断仍使用同一整轮结算事务。

### P4：敌方只读卡牌 UI

- Enemy roster 展示同一 Hand / Action card 结构，标记自然准备行动、自动目标及预览状态。
- 敌方卡只开放查看，不开放替换、Target edit 或 PlayerCommand；UI 只消费 Runtime View，不计算敌方策略。
- 优先复用 Task 0297 / 0298 / 0300 的卡牌宿主与交互基础。与 Task 0291 U4 或 Task 0300 的共享 UI 文件冲突时，只暂停此接线 Unit。

### P5：正式内容与多轮验收

- 将正式 Gameplay B 与测试 Encounter 从固定 damage 迁移到显式 Enemy Actions，递增相关 Map `resumeVersion`。
- 真实运行我方两人对多名 Enemy：无干预完成双方准备与 Commit；覆盖 Enemy 攻击、恢复 / 防御、目标修复、资源预算、击杀后跳过、下一轮重抽、只读 UI 和 Save / Resume。
- 通过 Registry、MapRun Owner、正式 Runtime / Datapack 路径和 Workspace 验收；记录定向测试、类型、Schema、架构、文档与差异检查结果。

## Patch Units

本 Task 超过 3 个 Unit；详细 Read Set、Allowed Files、Completion Criteria 和 Receipt 位于 `docs/plan-work/archive/task-0301-units/`。

| Unit | 阶段 | 目标 | 状态 |
| --- | --- | --- | --- |
| U0a | P0 | 建立本 Task、登记入口并冻结新合同。 | 完成 |
| U0b | P0 | 回写 Task 0291 / 0299 的旧规则替换说明。 | 完成 |
| U1a | P1 | 增加敌方行动候选 / 初始资源类型，并同步生成 Schema。 | 完成 |
| U1b | P1 | Registry 校验敌方候选、目标用途与敌方资源。 | 完成 |
| U2a | P2 | 共用同一 Hand / 倾向 / 费用准备算法并抽取 Enemy Hand。 | 完成 |
| U2b | P2 | 将 Enemy Hand / Actor / Team 资源写入 Encounter 准备快照。 | 完成 |
| U2c | P2 | 按内容版本使旧快照失效，并完成 Enemy 准备快照兼容性收口。 | 完成 |
| U2d | P2 | 为双方共用 Action Preview 增加 Enemy 自然行动和自动目标投影。 | 完成 |
| U3a | P3 | 为 Enemy 自然行动建立共享 Commit 计划与当轮目标修复。 | 完成 |
| U3b | P3 | 在原子 Commit 中结算 Enemy 费用、资源、HP 与回执。 | 完成 |
| U4 | P4 | 展示敌方只读 Hand / Intent。 | 完成 |
| U5a | P5 | 为所有正式战斗地图配置显式 Enemy Actions，并递增内容版本。 | 完成 |
| U5b | P5 | 移除固定 damage / enemyAttacks 合同并同步 Schema。 | 完成 |
| U5c | P5 | 用官方 Map-only Datapack 完成多轮 Save / Resume 与 Workspace 验收。 | 完成 |

## 验收

- [x] Character / Enemy 使用同一套抽牌、情境权重、目标 preference 与自动目标失效规则。
- [x] Enemy 各自持有稳定 Hand；玩家不能改变 Enemy Hand、Action 或目标。
- [x] Enemy 行动费用 / HP / 资源结算与 Preview、Commit、Receipt 一致；敌方资源不会扣我方 Team / PlayerCost。
- [x] Save / Resume 恢复同一轮双方 Hand、准备行动、目标和随机游标；重复 Preview 不推进 RNG。
- [x] 正式 Map-only Datapack 覆盖多角色 / 多敌人、多轮、击杀跳过与自动改目标，不依赖旧 Operation。
- [x] Schema / Registry、Owner / Runtime、Workspace / UI 定向测试、类型、架构与差异检查通过；`check:docs` 的 48 个旧路径错误及完整 Workspace 的一个事件敏感测试已在 U5c Receipt 中记录。

## 当前进展（2026-10-19）

- 源码核对与 P0 规则已完成；产品授权来自用户对“敌方共用我方 Chara 策略，只是不能操控其卡牌”及本 Task roadmap 的批准。
- 首轮执行不修改旧 Operation、旧 Timeline 或第二状态 Owner。
- P0 完成：新 Task 已登记，Task 0291 / 0299 的固定回击与隐藏意图条款已明确标记为后续有意替换。
- P1 完成：Enemy 行动候选、Encounter-local Enemy Actor / Team 资源已加入内容类型；Registry 按候选所属的 Character / Enemy 校验 tendencyRole，支持双边 target preference 与任一阵营的正负 HP 效果，并阻止 Enemy pool Action 作为 Ability / Item actorless 来源。Schema 同步由正式生成器完成。
- U2a 完成：`drawGameplayBHands()` 保留原 Character 抽牌流程，并在其后按 Enemy roster 抽取只读 Enemy Hands；同一 RNG、候选过滤、倾向权重与 Hand 容量复用。Character 与 Enemy 的虚拟 Team 预留分开计算，Enemy Actor 资源可从初始值或当前 Encounter 快照输入。
- U2b 完成：MapRun Encounter snapshot 现保存按 roster 排列的 Enemy Hands、Enemy Actor 资源、独立 Enemy Team 资源；首次准备读取 Encounter 初始资源，下一轮沿用保存值。Save / Resume 对这些字段做结构校验并以当前 HP / 资源 / draw cursor 重演双方 Hands；被改坏或漏掉的 Enemy Hand / 初始资源快照会拒绝恢复。
- U2c 完成：Gameplay B Datapack 中全部八张正式 Map 都递增 `resumeVersion`（原 2 变 3，原 1 变 2），旧 Encounter checkpoint 通过现有版本不匹配路径拒绝。Save / Resume 集成测试同时确认当前版本仍能恢复。
- U2d 完成：共同 Action Preview 现在投影每个 Enemy 的 Hand、自然 Action、单位目标或卡牌目标。普通单位目标沿用现有目标偏好和 roster 平局顺序；卡牌目标等双方 Hand 确定后通过真实卡牌目录解析。Runtime View 只读暴露敌方行动，不提供任何控制入口。重复 Preview 不改 Encounter 或 RNG。
- P3 完成：Character → Ability / Item → Enemy roster 顺序在同一纯 Commit plan 内结算。Enemy 自动目标在轮到执行时失效会按当前 Action 重新选择；没有目标、行动者已倒下或费用不足时免费跳过。Enemy Actor / Team 资源与我方隔离；HP / 资源变化、费用和跳过原因进入 Preview / Receipt，并经 Save / Resume 校验。细项见 U3a / U3b Receipts。
- U4 完成：Enemy 当前 Hand 复用 Map card binding 与静态卡牌宿主，在右栏使用 82×58 Action card；等待状态不制造虚构卡片，目标、自然行动和效果只读来自 Runtime。不存在 Enemy Swap、PlayerCommand 或 Target edit 入口。回执信息流展示真实 Enemy Action、目标、HP / resource 变化、费用与 skip reason。Workspace / Flow / Relation / DOM 定向检查已通过。
- U5a 完成：七张正式战斗 Map 都已把固定伤害内容改成显式 Enemy Action 候选，攻击目标与 HP 效果可在 Datapack 阅读；七张受影响 Map 的 `resumeVersion` 从 2 递增到 3。
- U5b 完成：`GameplayEncounterEnemyDef.damage` 与旧 `enemyAttacks` Receipt / Runtime / Flow 路径已删除；Registry 拒绝旧 Enemy damage 字段，旧格式 Receipt 因未知字段被当前合同拒绝。生成 Schema 与 Schema sync tests 已完成。
- U5c 完成：官方 `autonomous-target-battle` 样例现使用三名机器人及显式攻击 Action；正式 Runtime 两轮流程通过无干预首轮提交、击杀后改选、下一轮新 Hand、Swap、手动目标、Save / Resume 与回执重验。官方 Workspace 验收确认真实只读卡牌、自动目标、无需手点目标即可提交及 Enemy Action 结果。Owner / Registry / Runtime / UI 定向共 256 项通过；类型、架构、Schema 与差异检查通过。完整 Workspace 文件另有 1 个既有事件敏感测试整文件执行失败（隔离执行通过）；`check:docs` 有 48 条旧 Operation / Demo 路径失效，均记录在 Receipt 0301-U5c。

## 相关路由

- `docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md`
- `docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md`
- `docs/plan-work/archive/task-0300-gameplay-b-reusable-card-interaction.md`
- `docs/docs-829/05-conventions/schema-sync.md`
- `docs/docs-829/05-conventions/architecture-discipline.md`
- `docs/docs-829/05-conventions/testing.md`
