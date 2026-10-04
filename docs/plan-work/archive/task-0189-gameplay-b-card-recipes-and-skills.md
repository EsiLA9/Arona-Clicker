# Task：玩法 B cardTag 配方与免费技能闭环

状态：done — U1/U2/U3 与一轮浏览器冒烟均完成；已交接 0190，R11 倒地角色是否可作治疗目标仍标为原型暂定

## 目标

在独立原型的一场战斗中加入确定性 cardTag 配对、免费角色技能与可解释的替代结算，并证明查看只读预览不会重掷或重复支付。

## 设计边界

- 本 Task 分为纯配方匹配、免费技能准备、战斗结算接入与回归三个 Unit。施工须依序进行；U2 依赖 U1，U3 依赖 U1/U2。
- 用户已确认三种首版配方的输出：敌方掩护 + 我方同目标狙击，移除该目标 2 点护盾后由狙击正常攻击一次；敌方冲锋 + 我方同目标掩护，冲锋伤害 −1 并保留 2 点护盾；我方冲锋 + 另一名 Chara 的掩护，冲锋伤害 +1 且冲锋者获得 1 点护盾。已匹配的行动由完整替代结果取代，不重复结算原牌效果。配方优先级、竞争处理与牌列顺序属于可复核的原型实现口径；攻击标记叠加/消费、范围攻击加成等其他 R09 细则仍按 0186 暂定，不能说成用户逐项裁定。实际施工前若基线与配方输出冲突，停止并回报。
- 技能范围为初始四名角色和两名中途加入角色；加入者先通过夹具验证，不因此变更本阶段实际编队。技能为免费效果，不消耗 sCost，也不增加角色每回合普通行动额度。
- 原型仅位于 `prototypes/gameplay-b/`，使用其自身 TypeScript/Vite/Vitest 配置和普通 DOM/CSS；不得依赖、修改或接入 AC Engine、StateMutationService、PlayerState、Registry、Datapack、Story、UI、资源、存档、根 package 或 AC 运行时代码。Runtime 集中写状态，UI 只读视图。
- 非目标：脚本/嵌套事件系统、持久化、实时循环、自动战斗、玩家选牌、编队编辑、路线分支、经济/成长系统，以及把原型接入 AC。

## 依赖与开工门槛

直接前置为归档 Task `task-0188-gameplay-b-deterministic-battle.md`，U1/U2/U3 与浏览器验收均已完成。0189 开工前已核对 0188 Receipt、白名单源码与测试，以及 0187 随机数接口；本 Task 的实际实现签名仍以源码为准。

0188 当前已交付 `PreparedBattleRound`、纯准备/结算函数和独立 `GameplayBBattleRuntime`，不改变 0187 的 `GameplayBRuntime`。战斗 Runtime 视图包含冻结的 `pendingRound`、`lastResolution`、事件与终态，但目前不持有 seed/RNG，也不准备技能。0189-U2 将提供接收注入随机源的技能准备函数；0189-U3 将在战斗 Runtime 中持有 `SeededRandom`，准备时仅掷一次并冻结技能结果。若真实前置接口与此计划不符，先修订白名单/Read Set；禁止猜接口、在 UI 绕过 Runtime 或退回已完成的 0188 而不说明精确缺口。

## 已核实事实与当前落点

| 已核实事实 | 依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 0187 独立包、场所 Runtime、seeded RNG 与三栏页面已完成并归档 | `archive/task-0187-gameplay-b-standalone-click-prototype.md` Receipt 与原型源码 | 保留并复用 Activity `GameplayBRuntime`；不假设它等同于战斗 Runtime |
| 0188-U1 已交付 `PreparedBattleRound`/`prepareBattleRound`，含冻结双方行动、目标、费用及 Tag | `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/battle/prepare.ts`、0188-U1 Receipt | 配方匹配必须消费此冻结数据，不重选牌或重锁目标 |
| 0188-U2 已交付 `GameplayBBattleRuntime.getView()/click()` 与 `BattleRuntimeView`、`resolveBattleRound`；战斗路径尚无 RNG | `prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/src/battle/resolve.ts`、0188-U2 Receipt | U2 自带 `SkillRandom` 注入契约；U3 改 Runtime 以用本包 `SeededRandom`，不改 `random.ts` |
| 三种配方输出由用户确认；优先级/竞争/牌列顺序和攻击标记等其他 R09 细则仍属原型实现口径或暂定默认 | 0186 收据与 R05/R09 案例；`draft-0184-gameplay-b-sample-engine.md`；用户回答“采用这组推荐配方” | 输出按确认版本实现；未确认的匹配细则和其他 R09 规则不得说成用户裁定 |

## Must Read / Read Set

- 权威路由与施工纪律：`docs/docs-829/00-INDEX.md`、`docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`。
- 规则与内容：`task-0186-gameplay-b-prototype-rule-baseline.md` 中 R05/R09 与对应手算案例；`draft-0182-gameplay-b-director.md` 的角色牌组/技能/配方小节；`draft-0184-gameplay-b-sample-engine.md` 的行动准备、配对、结算与只读视图小节。
- 前置交接：`task-0187-gameplay-b-standalone-click-prototype.md` 的 U2/U3 实际 Receipt 与对应源码/测试；`task-0188-gameplay-b-deterministic-battle.md` 的完整交接 Receipt 及其修改文件/直接测试。只读本 Task 列出的接口及其直接调用方，不默认浏览原型全树。
- 当前原型入口：Unit 指定的 `model.ts`、`random.ts`、`runtime.ts`、`view.ts` 与对应战斗准备/结算测试；路径和符号必须以 0188 交接的实际文件为准。若这些接口不足，触发停止条件，不扩大 Read Set。

## Patch Unit 0189-U1：纯 cardTag 配方匹配

### Goal

以显式内容表定义三类已确认配方及可复核的暂定匹配顺序，纯函数式地从已准备普通行动和可选的补充免费技能行动中输出配对、消费关系和完整替代效果；不写 Runtime 状态。替代结果必须可表达复合输出。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则 | `task-0186-gameplay-b-prototype-rule-baseline.md`：R05/R09 与对应案例 | 核对牌 Tag、目标限制、替代效果与暂定标记 |
| 内容 | `draft-0182-gameplay-b-director.md`：牌组及首版配方 | 核对原型所用的牌和 Chara 限制 |
| 配对约定 | `draft-0184-gameplay-b-sample-engine.md`：配方表与匹配流程 | 明确候选优先级、牌列顺序和一牌至多一配对 |
| 前置代码 | 0188 Receipt 实际交付的行动类型、目标标识与队列 | 用真实接口适配纯匹配；不得按预期结构臆造字段 |
| 测试 | 0188 直接准备测试及拟新增 `prototypes/gameplay-b/tests/card-recipes.test.ts` | 保持输入与前置准备结果兼容，并覆盖可复现配对 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含交接、目标源码/测试和工具输出 |
| 文档 Read Set | 默认 3–8 篇；只读本 Unit 指定章节 |
| 历史文档 | 0 篇；规则来源限定为明确指向的基线和 Draft |
| 超预算处理 | 不扩读全树；按停止条件交回高层 AI 拆分或收窄 |

### Optional Read Set

- 仅在指定调用方无法解释行动字段时，申请读取 0188 Receipt 明确点名的一个直接调用方；先停下并说明原因。

### Do Not Read by Default

- `docs/plan-work/archive/**`（除上述明确指向的基线外）、AC 运行时代码、与配方无关的场所/UI/内容目录。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0188 已在 `model.ts` 交付冻结战斗行动类型 | `prototypes/gameplay-b/src/model.ts`、0188-U1 Receipt | U1/U2 按实际 `PreparedBattleRound` / `PreparedPlayerAction` 对接 |
| 配方需要两侧、Tag、目标关系/角色限制及可能由多种效果组成的替代结果 | 0186 已确认的三个配方描述与 `draft-0184-gameplay-b-sample-engine.md` | 以复合替代结果表达已确认输出，不能强塞为单一 `BattleActionEffect` |
| 技能可产生免费行动；其中小栞“并肩掩护”可加入匹配，其他技能可产生修正或额外效果 | `draft-0182-gameplay-b-director.md` 技能表；0186 用户确认“技能随机生效并可能协同” | matcher 接收可选的补充行动记录；实际技能骰与效果由 U2 冻结 |
| 配方优先次序和 R09 输出是原型暂定 | 0186 基线与 0184 配方表的标注 | 不是用户逐项裁定 |

### Constraints

- 匹配只读输入行动和配方表，输出结果，不支付费用、不掷骰、不改状态。
- 每个普通或补充免费行动最多消费一次；跨侧配方按同目标限制；同侧协同必须满足不同 Chara 限制。
- 优先级采用 0184 明列的 1→2→3 作为原型暂定默认；同级按行动列顺序，遇多 Tag 时取优先级最高且行动序最早的可用配方。该顺序不是用户逐项确认，需保留标注并由竞争/多 Tag 测试证明确定性。
- 为替代结果定义可组合结构，至少表达“移除 2 盾+狙击一次”“冲锋伤害−1+目标获 2 盾”“我方冲锋伤害+1+冲锋者获 1 盾”；被消费牌的原效果不重复结算。
- 已配对牌只生成配方完整替代效果；未配对牌保留原行动。纯匹配测试须证明不产生第二份原牌效果。

### Allowed Files

- `prototypes/gameplay-b/src/battle/match.ts`
- `prototypes/gameplay-b/src/content/recipes.ts`
- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/tests/card-recipes.test.ts`
- `docs/plan-work/task-0189-gameplay-b-card-recipes-and-skills.md`（仅本 Unit 的实际 Receipt）

### Explicit Non-goals

- 不在匹配层结算伤害/护盾，不修改 Runtime、技能、UI 或普通牌选择/支付。
- 不引入新的配方、Tag、牌组或用户操作，不将暂定规则写入 docs-829 机制正文。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 的六项停止条件：需要修改白名单外文件；需新增未列文件或超过 3–5 文件/300–500 行预算；需读取 Read Set 外超过 2 个文件；源码/测试与事实或规则基线冲突；需自行裁定机制或扩大目标；必需验证失败、无法执行或结果无法解释。另：0188 实际交接缺少行动类型/目标关系时，退回 0188，不在本 Unit 设计战斗接口。

### Completion Criteria

- [x] 内容表表达三类已确认配方的双方、Tag、目标/角色限制和复合替代输出；另将匹配优先级、竞争、多 Tag 与牌序作为原型实现口径标清。
- [x] 优先级、同级牌序、多 Tag、配对竞争均确定且由测试覆盖；每张行动最多进入一组配对。
- [x] matcher 支持技能 U2 提供的补充免费行动记录；测试用合成的免费掩护行动验证它能进入匹配。
- [x] 测试覆盖跨阵营同目标配对、同侧不同 Chara 限制、不匹配行动及配对后原效果不重复输出。
- [x] 匹配过程不读写 Runtime，也不消耗 sCost 或随机数。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/card-recipes.test.ts` | 配方顺序、限制、竞争及消费结果用例通过 |
| 类型检查 | `npm run typecheck`（同目录） | 严格 TypeScript 检查通过 |
| 手算核对 | 对照 0186 中用户确认的三类配方案例与行动输入/输出，并单独核验暂定匹配顺序 | 目标、效果数值和原牌消费逐项一致 |

### Execution Receipt 0189-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `prototypes/gameplay-b/src/model.ts` 增加免费补充行动、配方行动/替代效果/匹配计划类型；新增 `prototypes/gameplay-b/src/content/recipes.ts` 三配方内容表、`prototypes/gameplay-b/src/battle/match.ts` 纯匹配器、`prototypes/gameplay-b/tests/card-recipes.test.ts`；本节写入实际 Receipt。 |
| 行动接口来源 | `model.ts` 的 `PreparedBattleRound`、`PreparedPlayerAction`、`PreparedEnemyIntent`；`battle/prepare.ts` 的 `prepareBattleRound(input: BattlePreparationInput): PreparedBattleRound`。普通行动来自 `playerActions`，敌方行动来自 `enemyIntents`；两者提供 `actorId`、`tags`、`targetIds` 与效果。匹配器另接可选 `SupplementalFreeBattleAction[]`，没有假设 U2 已交付。 |
| 已确认机制 | 当前用户确认的三项完整替代结果及限制：敌掩护 + 同目标我方狙击，移除目标 2 盾并由狙击攻击一次；敌冲锋 + 同目标我方掩护，冲锋伤害调整 −1 且该目标获得 2 盾；我方冲锋 + 另一 Chara 掩护，冲锋伤害调整 +1 且冲锋者获得 1 盾。被配对行动只由替代输出表示；未匹配行动保留原效果。 |
| 暂定实现口径 | 优先级 1→2→3、同优先级配方表顺序、多 Tag 按可用配方优先级处理、每种配方按左右行动列序选最早可配对项、免费行动接在普通我方行动之后。以上均是可复核的原型匹配默认，不是用户逐项裁定；后续可调整。 |
| 未完成内容 | 未做 Runtime / 技能准备 / 伤害护盾结算 / UI 接入；不开始 U2。 |
| 范围外变更 | 本次写入仅限 Allowed Files。最终复核时仓库含大量其他路径脏改动；其起始状态和归属不由本 Unit 推断，本 Unit 未编辑或清理。 |

#### U1 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `prototypes/gameplay-b/`：`npm test -- tests/card-recipes.test.ts` | 通过 | 1 个文件、8 项测试；覆盖三配方、目标/Chara 限制、优先级与多 Tag、列序竞争、免费补充行动、单次消费、未配对原效果和输入不变。 |
| 类型检查 | `prototypes/gameplay-b/`：`npm run typecheck` | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 根文档检查 | 项目根目录：`npm run check:docs` | 通过 | 扫描 538 篇 Markdown，errors: 0。 |
| 边界与空白 | 白名单路径复核及 `git diff --check`/新文件空白复核 | 通过 | 本 Unit 仅触及 Allowed Files 五项；五项无尾随空白，范围内 `git diff --check` 通过。最终仓库状态仍含大量其他路径脏改动；本 Unit 未编辑或清理。 |

#### U1 遇到问题与需上游确认项

- 无接口阻断。三种配方输出按当前用户确认实现；匹配优先级、候选竞争、Tag 次序与行动列序保留为暂定实现口径。

## Patch Unit 0189-U2：免费技能准备与冻结

### Goal

使用前置战斗准备接口，为六名角色配置免费技能，按原型暂定触发条件准备技能结果并冻结到本轮；不支付 sCost、不占普通行动额度。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则 | `task-0186-gameplay-b-prototype-rule-baseline.md`：技能/攻击加成相关基线与案例 | 核对免费性、标记消费及允许的随机边界 |
| 技能内容 | `draft-0182-gameplay-b-director.md`：六名角色的技能条件与效果 | 确认角色技能输入，不新增效果 |
| 引擎约定 | `draft-0184-gameplay-b-sample-engine.md`：准备阶段/随机/只读视图小节 | 核对骰点冻结和预览纯读要求 |
| 前置代码 | 0188 Receipt 实际交付的 `prototypes/gameplay-b/src/battle/prepare.ts`、角色/敌人模型、`prototypes/gameplay-b/src/random.ts` | U2 提供纯随机注入入口，U3 在 Runtime 使用已交付的 SeededRandom；名称/签名以实物为准 |
| 测试 | 0188 的准备测试、U1 实际配方接口 | 覆盖技能牌/修正结果与普通行动之间的关系 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含前置交接、技能目标文件和测试 |
| 文档 Read Set | 默认 3–8 篇，限定本 Unit 指定章节 |
| 历史文档 | 0 篇；不复查无关历史方案 |
| 超预算处理 | 按停止条件回报；不得扫描原型全树 |

### Optional Read Set

- 若 0188 纯准备结果缺少本 Unit 所需条件字段，先按现有 `BattlePreparationInput` 与 `PreparedBattleRound` 核对；不得为方便而改写 RNG 或跨 Unit 扩文件。

### Do Not Read by Default

- AC 代码、未交接的未来 Task、无关 UI 样式/场所内容与历史归档。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 六名角色及技能条件/效果目前写在内容 Draft 中，不构成已实现技能代码 | `draft-0182-gameplay-b-director.md` 技能小节 | 仅供验收原型范围，未来接口需核对 |
| 当前 0187 Runtime 的已核实随机用途是场所活动 | `prototypes/gameplay-b/src/runtime.ts:resolveActivityClick`、`prototypes/gameplay-b/src/random.ts:SeededRandom` | 0189 在 Battle Runtime 单独接线，不改 Activity Runtime |
| 0188 基础战斗计划关闭免费技能 | `task-0188-gameplay-b-deterministic-battle.md` 设计边界 | 本 Unit 依赖其完成交接后扩展真实实现 |

### Constraints

- 仅当规则指定的准备条件成立时才做对应技能检定；随机抽取位置、调用次序与触发率遵循交接后的暂定基线，不由该 Unit 擅自定案。
- `prepareSkills` 接收窄的可注入随机接口，仅在一次回合准备时调用并返回冻结技能检定/效果记录；只读预览不得调用该函数、抽取随机数或修改费用/行动。U3 在 Runtime 中调用它并保存结果。
- 免费技能不消耗 sCost，不增加每名 Chara 的普通牌行动数；后两名 Chara 仅在测试夹具中覆盖。
- 修正型技能附着于原行动，不复制 Tag/牌/攻击；是否仍有效取决于原行动是否被配方消费及基线明示规则。
- 随机抽取序列/触发概率使用明确标记为原型暂定的实现默认；`random.ts` 不修改。`SkillRandom` 由本 Unit 的纯准备入口注入，实际 Runtime 接线留给 U3；不得让 UI 或视图抽取随机数。

### Allowed Files

- `prototypes/gameplay-b/src/battle/skills.ts`
- `prototypes/gameplay-b/src/content/characters.ts`
- `prototypes/gameplay-b/src/battle/prepare.ts`
- `prototypes/gameplay-b/tests/skills.test.ts`
- `docs/plan-work/task-0189-gameplay-b-card-recipes-and-skills.md`（仅本 Unit 的实际 Receipt）

### Explicit Non-goals

- 不在本 Unit 结算伤害、治疗、护盾或匹配配方；不新增玩家菜单/技能开关。
- 不修改随机数实现、全局 Runtime、视图或 AC 代码；缺少接口时回前置任务补交。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。额外地，若实际 `prepareBattleRound` 快照无法支撑技能条件/目标，或白名单不能实现注入骰值的纯准备函数，记录最小缺项并停下修订本 Task；不得扩改 0188 已完成范围、`random.ts` 或 Runtime。

### Completion Criteria

- [x] 六个角色的技能条件/结果由内容配置与技能处理器完整表达；千世、玲奈通过夹具覆盖，不改变本阶段出战成员数。
- [x] 条件成立、未触发、条件不成立和无合法目标均有注入骰值测试；相同注入序列/输入所得检定记录和结果完全一致。
- [x] 技能结果在准备阶段冻结；每角色每轮最多一次检定，随机顺序按准备快照中的我方名册顺序。
- [x] 成功触发的卡牌型免费技能返回 `SupplementalFreeBattleAction[]`；“校准镜”只返回附着原狙击的修正，不复制牌/Tag。
- [x] 免费行动独立于冻结普通行动与支付记录；不消耗 sCost、不增加普通行动数。
- [x] 修正技能不生成第二张原牌或第二次攻击；修正带有 U1 普通行动 ID，供 U3 按配方消费结果处理。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/skills.test.ts tests/battle-prepare.test.ts` | 条件、骰点、费用/普通额度与冻结行为测试通过 |
| 类型检查 | `npm run typecheck`（同目录） | 严格 TypeScript 检查通过 |
| 确定性核对 | 使用测试注入的确定骰值，重复准备相同战斗 | 抽取次序、技能结果和普通牌支付完全一致；同种子集成重放留 U3 |

### Execution Receipt 0189-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；后续由 U3 接入 Runtime，详见 U3 Receipt。 |
| 实际修改 | 新增 `prototypes/gameplay-b/src/battle/skills.ts` 与 `prototypes/gameplay-b/src/content/characters.ts`；扩展 `prototypes/gameplay-b/src/battle/prepare.ts`，新增纯组合入口 `prepareBattleRoundWithSkills`；新增 `prototypes/gameplay-b/tests/skills.test.ts`；本 Task 更新 U2 验收与收据。总计 5 个白名单文件。 |
| 真实接口 | `SkillRandom.nextInt(): number`；`prepareSkills(round: PreparedBattleRound, random: SkillRandom): PreparedBattleSkills`。入口只对条件成立的存活角色调用一次，并校验骰值为整数 1–4。`prepareBattleRoundWithSkills(input, random)` 返回冻结的 `{ round, skills }`；Runtime 后续可用 `() => seededRandom.nextInt(1, 4)` 适配 0187 `SeededRandom`，本 Unit 未改 `random.ts` 或 Runtime。 |
| 调用顺序与结果 | 按 `PreparedBattleRound.combatants` 内我方角色顺序检查；没有技能的队员不掷骰，倒地角色记为 `ineligible` 且不掷骰。返回 `checks`、供 U1 matcher 使用的 `supplementalFreeActions`、附着普通行动的 `modifiers` 与额外固定伤害 `effects`；结果深冻结，不引用或修改输入对象。芽衣的免费 `attack-buff` 记录与其 `modifier` 描述同一 +1 结果，U3 应以 modifier 的 `actionId` 应用一次，不能重复结算。 |
| 六角色映射 | 小栞：有敌方 `charge` 意图时检定；触发返回锁定冲锋目标的免费 `cover`。由理：已准备针对存活敌前排的 `charge` 时检定；触发返回同目标 `pursuit`，并以独立固定伤害记录表达额外 1 点。芽衣：存在我方普通攻击时检定；触发返回 `support`，目标为本轮攻击者中最低 HP 者，并以来源技能/免费行动 ID 记录附着该普通行动的 +1 攻击标记。纺希：已准备普通 `sniper` 时检定；触发只给原行动 `player-action:<序号>:tsumugi` 附加 +1。千世：存在未满 HP 且不高于半血的队友时检定；触发对其中当前 HP 最低者免费恢复 1。当前 U2 纯准备按现有 R11 预设允许 HP=0 队友进入此目标选择；这是原型暂定、待 2026-10-04 验收，不表示用户确认可治疗回合开始已倒地者。玲奈：已准备 `blast` 且范围内有存活敌前排时检定；触发返回免费 `blast` 记录，并以固定伤害记录指向范围内当前 HP 最低的存活前排。千世、玲奈由本地夹具覆盖。 |
| 暂定边界 | 1d4、掷出 1 触发及我方名册检定顺序来自 0184/R02 的原型暂定默认，不表示用户逐项裁定；各技能条件/输出沿用 0182 草案。Tsumugi “只修正原狙击 +1、原攻击被配方消费则取消”是用户确认内容。小栞检定条件已满足但冲锋意图无合法目标时，记录 `triggered-no-target`、不创建空目标行动；该空目标处理作为本 Unit 的确定性实现默认保留。千世对 HP=0 队友的技能治疗目标资格沿用 0188 R11 暂定实现，待 2026-10-04 验收，不升格为用户裁定。 |
| 未完成内容 | 未接入 `GameplayBBattleRuntime`，未做伤害/护盾/治疗结算或 UI 投影，留给 U3。 |
| 范围外变更 | 无。U2 写入仅落在本 Unit Allowed Files；未编辑 `random.ts`、Runtime、模型、U1 matcher 或 AC 代码。 |

#### U2 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `prototypes/gameplay-b/`：`npm test -- tests/skills.test.ts tests/battle-prepare.test.ts` | 通过 | 2 个文件、15 项测试；包含六技能固定骰、Chise/Reina 夹具、条件不满足、空目标、未触发、重放确定性、深冻结/输入不变、U1 免费掩护配对及准备费用不变。 |
| 包类型检查 | `prototypes/gameplay-b/`：`npm run typecheck` | 通过 | `tsc --noEmit --project ./tsconfig.json`。 |
| 根文档检查 | 项目根目录：`npm run check:docs` | 通过 | 扫描 538 篇 Markdown，errors: 0；在收据写入后执行。 |
| 白名单/边界 | 逐项复核 U2 触及路径及新代码依赖 | 通过 | 仅修改上述 5 个 Allowed Files；技能代码依赖本原型的 model/content/matcher/prepare 与 Vitest，无 Runtime/RNG 实现改动。 |
| 空白检查 | U2 五个白名单文件的行尾空白与补丁边界复核 | 通过 | 未发现尾随空格或越界路径；具体检查在最终收据完成后执行。 |

#### U2 遇到问题与需上游确认项

- 首轮定向测试发现玲奈夹具的当前 HP 高于定义 HP 上限；只修正了白名单测试夹具后重跑通过。
- 需上游确认项：无。U3 应把 `SkillRandom.nextInt()` 适配为 `SeededRandom.nextInt(1, 4)`；结算层对 `effects` 中的固定 1 点伤害与普通攻击公式作区分，并以 `actionId` 判断技能结果是否被 matcher 消费。

## Patch Unit 0189-U3：配方/技能结算接入与预览回归

### Goal

将 U1 匹配和 U2 冻结技能结果接入实际战斗结算与只读视图，保证每个效果恰好结算一次，并回归验证预览不重掷、不重复支付。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则 | `task-0186-gameplay-b-prototype-rule-baseline.md` 对应配方/效果案例及 R09 标注 | 做最终效果逐笔核对并保留暂定属性 |
| 交接/前置 Unit | 本 Task U1/U2 Receipt、0188 的结算/准备/Runtime 交接 | 确认真实结算入口、效果记录与支付边界 |
| 配方 | `prototypes/gameplay-b/src/battle/match.ts`、`prototypes/gameplay-b/src/content/recipes.ts` | 读取已完成的匹配输出，不重复实现匹配 |
| 技能 | `prototypes/gameplay-b/src/battle/skills.ts`、`prototypes/gameplay-b/src/content/characters.ts`、`prototypes/gameplay-b/src/battle/prepare.ts` | 读取被冻结的技能结果和触发记录 |
| 结算/视图/Runtime 测试 | 0188 与 0187 实际交付的 `prototypes/gameplay-b/src/battle/resolve.ts`、`prototypes/gameplay-b/src/view.ts`、Runtime 入口及其直接测试 | 核对结果展示与只读预览；修改前按实际路径重审白名单 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token，含两前置 Task 的实际交接与直接文件 |
| 文档 Read Set | 默认 3–8 篇；聚焦规则、U1/U2 与实际结算接口 |
| 历史文档 | 0 篇；不打开无关历史方案 |
| 超预算处理 | 按停止条件拆分或退回，不扩读整包 |

### Optional Read Set

- 若 `runtime.test.ts` 无法定位预览入口，仅在停工说明后申请读取其一个直接调用方；不要从 UI 全链路推断。

### Do Not Read by Default

- AC 业务源码、无关内容/路线/样式目录、未交付的 0190+ 实现。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 0187 的 Activity Runtime 和 0188 的 Battle Runtime 是分开的；Battle Runtime 已提供 `getView()`/`click()` 与 `pendingRound`/`lastResolution` | `prototypes/gameplay-b/src/runtime.ts:GameplayBRuntime, GameplayBBattleRuntime`、0188-U2 Receipt | 页面由 0188-U3 接入；本 Unit 不把场所 Runtime 误当战斗 Runtime |
| 0188 Battle Runtime 当前无 RNG；纯准备接口与结算接口已交付 | `prototypes/gameplay-b/src/battle/prepare.ts:prepareBattleRound`、`prototypes/gameplay-b/src/battle/resolve.ts:resolveBattleRound`、0188-U2 Receipt | 0189-U3 必须在 Runtime 内注入 `SeededRandom` 并保存每轮技能结果 |
| 配方与技能结果须基于一次性冻结的准备快照，仅由真实 Click 结算 | 0186 已确认边界及 R11 暂定实施；0188-U1/U2 接口 | 视图读取不得重选、重骰、支付或结算 |

### Constraints

- 配方匹配只产生一次替代效果；被消费原牌效果不得额外进入普通结算路径。
- 每张免费技能的冻结结果最多由结算消费一次；攻击加成/范围目标的 R09 处理完全遵守原型暂定基线。
- 视图/预览读取为纯只读：在准备结果后重复读取不得移动随机游标、重复支付费用、重新选牌、重新匹配或改变状态。
- 真实 Click 才能提交该轮的冻结结果；测试须从可观察状态/事件验证效果恰好一次。
- `runtime.test.ts` 明确属于本 Unit 白名单，以确保预览纯度和跨层支付回归被覆盖。
- U3 在 `GameplayBBattleRuntime` 中持有可重放 RNG，向 U2 的技能准备入口注入 `nextInt`，冻结本轮技能结果后供匹配/结算/视图共用；不修改 `random.ts` 或 Activity Runtime。
- U2 `PreparedBattleSkillEffect` 的 `fixed-damage` 是独立固定伤害，不是普通攻击公式的额外来源。对应的 Yuri `追击` / Reina `余波` 免费行动记录仍供 matcher/Tag 使用，但结算时不得把其占位 `attack` 再按角色 ATK/目标 DEF 额外算一次；按稳定 `actionId` 将已匹配/未匹配行动与其固定伤害来源关联，并且每个冻结结果只消费一次。
- U2 Mei `support/attack-buff` 补充行动与 `PreparedBattleSkillModifier` 描述同一枚 +1 攻击标记；Runtime/结算必须将该枚标记交给 R09 的统一规则只处理一次，不能又结算一次普通 `attack-buff` 再单独加 modifier。
- Tsumugi 的狙击修正绑定被准备的普通狙击：若该普通行动被 cardTag 配方消费，修正随之取消；免费卡牌型技能（如小栞掩护）仍可正常参与 U1 matcher。技能状态呈现须区分条件不满足、检定未触发、已触发待结算与检定成功但无合法目标。
- 若实际 Runtime/view 接口与交接不同，先更新白名单与交接；不在 UI 内补算机制，也不让预览重新准备。

### Allowed Files

- `prototypes/gameplay-b/src/battle/resolve.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `docs/plan-work/task-0189-gameplay-b-card-recipes-and-skills.md`（仅本 Unit 的实际 Receipt）

### Explicit Non-goals

- 不重写 U1/U2 算法，不新建额外战斗接口或 UI 层规则分支。
- 不扩展新卡、配方或技能；不改 Click 模型、AI 选牌、基础战斗公式、Task 0190 路线和 AC 项目代码。

### Stop Conditions

遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六项停止条件。若真实结算、Runtime 或只读预览所需入口落在 Allowed Files 之外，或 0188 交接未能区分准备/支付/结算/投影时点，停止并退回前置任务更新；禁止在 `view.ts` 中写状态、在 `runtime.test.ts` 外偷加文件或扩大 U3。

### Completion Criteria

- [x] 三类配方效果与 U2 技能效果都由单一的实际结算路径消费；原牌不重复结算。
- [x] R09 暂定的攻击加成、护盾、目标和范围效果按定向用例落到正确角色/目标和次数。
- [x] Yuri/玲奈技能的固定 1 点额外伤害恰好结算一次；技能 carrier 的 Tag/匹配不导致其 `attack` 占位效果再结算普通公式；校准镜在原狙击被配方消费时不生效。
- [x] `runtime.test.ts` 覆盖抵消、削弱、合成、未配对行动、技能修正/技能额外效果，以及准备后多次读取不重掷、不重复支付、不重复结算；单次 Click 仅消费冻结结果一次。
- [x] 攻击标记按暂定牌序只修正该 Chara 下一张造成伤害的行动一次；范围行动对每个目标各加 1，但整张行动后消费该标记一次。
- [x] 固定种子和同一 Click 序列的连续战斗在视图/事件模型中的结果一致；战斗终态及既有基础战斗回归通过。
- [x] 浏览器三栏侧栏、战斗日志/配方预览可见，并完成一轮 Click 冒烟；已记录本地 favicon 404，不将其描述为无 Console 错误。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向战斗与 Runtime 回归 | 在 `prototypes/gameplay-b/` 执行 `npm test -- tests/runtime.test.ts tests/battle-resolve.test.ts tests/card-recipes.test.ts tests/skills.test.ts tests/battle-prepare.test.ts` | U1/U2/0188 既有回归全通过；预览无 RNG/支付副作用 |
| 包级检查 | `npm run typecheck`、`npm run build`（同目录） | 严格检查与独立构建通过 |
| 页面冒烟 | `npm run dev` 后使用固定样例点完一轮并重复查看预览 | 通过：使用 Edge 154.0.4258.48、1280×720 隔离 headless 页面；Click 一次后进入第 2 轮准备态，事件数从 12 增至 32，重复读取状态稳定。页面截图确认三栏角色侧栏、战斗日志/配方预览及下一轮 Click 可见。应用请求均为本地资源；唯一失败请求是可选 `favicon.ico` 返回 404，并有对应资源 Console 错误；无运行时异常。 |
| 隔离复核 | 检查 U3 Allowed Files 与依赖 | 通过：仅本 Unit 五个 Allowed Files；未见 AC import、根 package/config 或 AC 资源依赖 |

### Execution Receipt 0189-U3

| 项 | 内容 |
| --- | --- |
| 状态 | U1/U2/U3、代码与文档核验及一轮浏览器冒烟完成；允许交接 0190。R11 的倒地 Chara 是否可被治疗作为原型暂定保留，待 2026-10-04 用户验收。 |
| 实际修改 | `prototypes/gameplay-b/src/battle/resolve.ts`、`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/tests/runtime.test.ts` 与本 Task 收据；共五个 Allowed Files，未修改 `model.ts`、`random.ts`、`main.ts` 或 AC 文件。 |
| Runtime 接口 | `GameplayBBattleRuntime(input: BattlePreparationInput, seed?)` 在准备时调用 `prepareBattleRoundWithSkills`，冻结技能结果与 `matchPreparedBattleRound` 输出；`getView()` 返回 seed/RNG cursor、pending round/skills/recipe plan 和 last resolution 的防写拷贝。`click()` 只结算当前冻结轮一次，存活战斗才准备下一轮；终态重复 Click 幂等。 |
| 结算口径 | 配方消费行动后只应用 replacement；Mei 免费 attack-buff 与 modifier 合并为一个暂定 R09 攻击标记；Tsumugi 修正只挂普通狙击，被配方消费时取消；Yuri/玲奈 fixed-damage 载体不再额外套普通 ATK−DEF 公式。recipe damage adjustment 与 shield removal 分字段结算。 |
| 技能/配方证据 | `runtime.test.ts` 增加固定种子只读、同 seed 重放、用户确认的三种配方、Mei 单标记与 AoE、Tsumugi cancellation、Yuri/玲奈固定伤害一次、R09 跨轮标记和 Chise HP=0 目标净值复起。后三者中 R09 与 Chise HP=0 资格仍按原型暂定；Chise 倒地目标用例明确留待 2026-10-04 验收。 |
| 定向与完整测试 | 在 `prototypes/gameplay-b/` 执行 `npm test` | 通过：5 个测试文件、54 项测试。 |
| 类型检查 / 构建 | `npm run typecheck`；`npm run build`（同目录） | 均通过；Vite 8.3.2 构建成功。 |
| 文档与边界 | 根目录 `npm run check:docs`；五个 Allowed Files 的 `git diff --check`、尾随空白与路径复核 | 通过：538 篇 Markdown，0 errors；未发现补丁空白问题或白名单外修改。 |
| 浏览器 / Console / Network | 使用 Edge `Edg/154.0.4258.48`，视口 `1280×720`；Click 一次后从“第 1 轮准备完成”进入“第 2 轮准备完成”，事件数 12→32；立即重复读取 DOM 状态稳定，未见运行时异常。全部应用请求为 `127.0.0.1` 本地地址；`/favicon.ico` 返回 404 并产生对应 Console resource error，未发现其他失败请求。截图核对三栏侧栏、可滚动战斗日志/配方预览和 Click 控件可见。 | 该可选 favicon 错误是已知环境/页面瑕疵；没有声称 Console 完全无错误。 |
| 需上游确认项 | 无实现接口阻断。Battle Runtime contract 已交接 0190。R11 中“HP=0 是否为本轮治疗的合法目标”仍是原型暂定口径：目前测试覆盖净值复起，但不把它写成用户确认规则，留待 2026-10-04 验收。 |

## Context Budget 与全局停止条件

- 单个代码 Unit 目标上下文 10k–30k token，限 3–5 个白名单文件及约 300–500 行净改动。各 Unit 的 Receipt 在本 Task 内联记录；不使用通配路径放宽白名单。
- 遵守 `docs/ai/PROJECT-CONSTITUTION.md` 六类停止条件：白名单外修改、超预算/新增文件、Read Set 越界、源码与文档冲突、需自行裁定机制或扩展目标、必需验证失败/无法执行/无法解释。
- 发现配方或随机技能的前置接口缺陷，记录实际缺口并退回 0188/0187 修复和重新验收；不在内容、视图层绕过。
- 不把暂定的 R09 攻击标记、范围加成、配方优先级/竞争顺序提升为 docs-829 正式机制事实；三种用户确认的配方输出按原裁定保留。不得改 AC 源码、根 package、Schema 或其他 Task/Draft。

## 任务验收

- [x] 三类已确认配方结果在可重放测试和页面日志/配方预览中可解释；竞争、多 Tag、优先级/牌序等暂定匹配规则清楚标记并有可复核用例，目标关联及单次消费符合已确认配方边界。
- [x] 六名角色免费技能的触发/条件/免费性均有固定案例；加入者只以夹具纳入。
- [x] 原效果不重复；只读预览不重掷、不重复支付、不改变状态，Click 后仅结算一轮。
- [x] 原型 `test`、`typecheck`、`build` 通过，页面有一轮战斗冒烟；依赖复核未见 AC 接入。浏览器唯一 Console 资源错误为可选 favicon 404，已记录。

## 验证入口

所有原型命令均在 `prototypes/gameplay-b/` 执行：

```text
npm test -- tests/card-recipes.test.ts
npm test -- tests/skills.test.ts tests/battle-prepare.test.ts
npm test -- tests/battle-resolve.test.ts tests/runtime.test.ts tests/card-recipes.test.ts tests/skills.test.ts tests/battle-prepare.test.ts
npm run typecheck
npm run build
npm run dev
```

按 Unit 仅运行其影响的定向命令；最终验收运行完整回归和浏览器冒烟。文档修改的 `npm run check:docs` 与 diff 空白检查只在实际执行时写入对应 Receipt，不预填“通过”。

## Execution Receipt 与交接

U1、U2、U3 均已有实际施工/核验 Receipt；U3 的一轮浏览器冒烟已完成，页面上的可选 favicon 404 已记录。R11 倒地目标资格仍保留原型暂定口径，不得改写为用户已逐项裁定。

已完成项可交接并归档本 Task，再推进 `task-0190-gameplay-b-camp-route-lifecycle.md`；归档 Receipt 保留上述浏览器瑕疵与 R11 暂定项。归档前记录终态核验、更新索引并复核受影响文档。

## 相关路由

- `draft-0182-gameplay-b-director.md`
- `draft-0184-gameplay-b-sample-engine.md`
- `task-0186-gameplay-b-prototype-rule-baseline.md`
- `task-0187-gameplay-b-standalone-click-prototype.md`
- `task-0188-gameplay-b-deterministic-battle.md`
- `task-0190-gameplay-b-camp-route-lifecycle.md`
