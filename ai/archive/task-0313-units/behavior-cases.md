# Task 0313-U4：可转测试行为基线

状态：设计推演完成；**所有E1新语法及AG-1都未实现、未运行**。这是U4文档fixture，不是产品测试结果或玩法批准。合同版本按 Draft0312 §11–§13：旧数据 `OLD`；保旧调度的规范化 `E1-COMPAT-1` / `EQ`；E1新增程序与局内状态 `E1-NEW`；敏捷混合队列 `AG-1` / `AG`。

批准更新（2026-10-21）：用户“全部按推荐”已确认Task0313 P1–P8。本文主方案现为已批准的测试期望；备选仅为未采用方案对照。以下“待批／未批”措辞保留推演时快照，其当前批准状态以Task0313 §10与Draft0312 §11/§13为准；“未实现／未运行”仍然成立。

## 通用fixture与判读

这些默认值供每例未覆盖字段继承；每个用例的覆盖值优先。ID只用于未来最小Datapack，不表示当前已有对应数据。

- Map `test:map:task0313` / `resumeVersion=3`；Node `n`、Battle activity `b`、Encounter Round 1；固定队伍顺序 `p1,p2,p3`（文内别名分别映射合法Registry角色 `shiroko`,`serika`,`hoshino`；fixture必须走Variant lookup，不是自造身份）；Enemy声明顺序 `e1,e2`。Actor HP均10/10，Enemy HP均10/10；未提及的Actor/Enemy/Team资源为0；未声明其他Enemy行为的样例用空Hand/Wait，无额外Enemy cost/HP effect。Item `kit` 为数量1的Consumable、`useCondition=true`。初始 `PlayerCost=2`。
- Run、draftVersion、commitVersion、requestId、CardRef Scope均从真实Owner流程取得：Start/Move后捕获当前run/draft token/commitVersion，Swap/Command等只通过合法命令增加版本；不手工伪造版本或Scope。每例只保留实际选中来源，未选Hand候选不入队。随机状态不直接构造：测试用例在Encounter创建前固定Math.random种子参数，调用Owner真实Encounter/Hand draw流程后捕获实际`randomState.seed/cursor`与`drawCursorStart`；seed/cursor取可复现fixture实测值，不能任意拼成看似可恢复状态。
- 未来AG全序键采用Draft推荐 `(-final,-base,sideRank,sourceRank,ownerDeclarationIndex,logicalIndex,sourceKey)`；party sideRank=0、Enemy=1；party实体sourceRank=0、Ability=1、Item=2、Enemy实体=0；owner索引按party/Enemy声明，Card logicalIndex按实际Hand。D09/D10数值与比较是推荐且未批；来源身份/入队时点按A01/A05作为工程合同。final=`min(base+actorAgility,max)`、Actorless补足0、Wait与未选来源无队列项。凡比较D10替代方案，仅替换第二排序项为actorAgility；base/final仍按同一公式。
- 每个可Commit例默认执行两次Preview：Run/HP/resources/locals/Hand/RNG/库存均不变且计划、排序/目标/费用一致；计划成功才Commit一次；同request/相同draft重放不重复扣费/库存/locals，冲突request拒绝。Save例加载同 `resumeVersion` 的当前内容，核恢复后续结果一致；damage/费用等终局Run没有可恢复terminal快照。AG trace断言采用D07建议：`programReceiptVersion`、`executionContractId`、来源/action/effectPath/语句/受用者，实际delta/before-after（包括0）、guard结果与实际HP/cap/local读数、费用/Item/目标/skip/序号；旧Receipt分组仍是投影，不比较新trace字节相同。
- 输入“超速/伤害/locals”均只是本次fixture数，不是平衡批准。E1新原语不能接AG排序；AG不能被写成当前Vitest结果。Hand候选资格沿现有起始状态规则，不因敏捷度扩大。

## OLD：当前行为金样

### OLD01 — 普通射击

**输入**：party p1的自然Hand `shot`，cost `Actor(p1,ammo)=1`，起始ammo=1，`target={kind:enemy}`并设`hpEffects=[{amount:-3}]`；自动目标e1 HP5/10、另有e2 HP10/10；`PlayerCost=2`。seed/cursor/draft沿通用值。当前规则无敏捷字段。

**执行/结果**：Preview当前目标e1；PlayerCost 0、Actor ammo费用1、e1 HP从5到2；队伍完成后Enemy再行动。Commit后ammo=0、e1 HP2，battle非终局；Receipt `settlements[p1]` 保留Action、target e1、cost ammo−1、HP delta−3，Enemy行动列按原声明序。Save/Load后数据一致；重放receipt不再次扣ammo。

**关联**：`map-run.test.ts`“commits prepared actions and resolved targets atomically…”、“draws a weighted, unique Hand…”；当前测试需由后续产品Task保留/拆为精确旧语法金样。

## E1-EQ：旧表达规范化等价基线

### EQ01 — OLD01以effectProgram表达

输入完全继承OLD01；唯一改动为Action旧 `hpEffects`/`effects`/`cardEffects` 改成单个 `effectProgram.resolve=[hpChange(primary,-3)]`，costs/target/Hand不变；同Action不混填旧新效果字段。采用 `E1-COMPAT-1`，不添加敏捷字段、不排序来源。

**预期**：visible HP=2、ammo=0、PlayerCost=2、Enemy阶段/终局完全同OLD01；两Preview零写、Receipt旧 `settlements` 中cost/HP投影相同、重放零重复。E1 trace可比对 `effectPath=resolve[0]`、delta−3，但不要求旧Receipt多出该字段。Save/Load的可见状态与OLD01相同；新内容格式变化按地图 `resumeVersion` 边界处理，不迁移不兼容checkpoint。

**差异分支**：任何不是同一HP/资源/费用/Skip/终局结果的输出都不是“兼容等价”，应阻止相应规范化；无玩法备选。关联 `Draft §11.2`、`Task0312 §5`，现有实现尚无effectProgram测试。

### EQ02 / AG08 — 多重sCost折扣、慢折扣源被击倒

**共同输入**：p1有Action `shot`，actor sCost=2，CardRef logicalIndex=0；p2的CardRef `d1` prepare折扣p1的shot 1；p3的CardRef `d2` 再折扣同一shot 2。起始p1 sCost=2；p2 HP2/10。Enemy `e1` final7、攻p2造成2；p1 shot final9（base/max/actor=9/9/0），e1 final7(7/7/0)，p2折扣Action final2(2/2/0)。另留e2 HP10使e1击倒p2不终止战斗。三名角色均从Owner真实draw到各自唯一合法自然Hand；每Actor只占一个Prepared来源，p2持`d1`，p3持`d2`，两个来源都作用到p1真实选中CardRef。队列键与实际draw结果一致：p1 shot final9→e1 final7→p2 d1 final2→p3 d2 final1。规则版本：EQ用E1-COMPAT-1，AG用AG-1。

**EQ预期**：旧prepare政策先合计折扣3并截到原价2；shot实付0，折扣不送余额；旧次序下来源是否被击倒不逆转已经准备的折扣。receipt记原2/折2/付0，preview不改余额，Save后不重复折扣。

**AG推荐预期(D02-DISCOUNT)**：轮初两折扣仍先统一准备并冻结，故即使e1先攻打倒慢速p2，shot已有折扣2、实付0；两折扣最终实际作用不超过原成本，未打出折扣卡不制造执行条目。**实质备选**：执行时折扣；e1先击倒p2，故d1为`defeated`；p3的d2仍会在更后阶段执行，但p1已经支付shot的sCost2，后来折扣不回溯退款，shot付2、p1剩0。若折扣源在shot前执行，则只对其后尚未支付费用生效。两种是不同成本结果，建议轮初prepare（D02-DISCOUNT）。

**队列/trace/save**：AG队列p1 shot→e1→p2若存活才d1→p3 d2；推荐prep摘要应标明d1/d2来自轮初合法来源；若p2被击倒其program trace为source defeated/未执行。Save/恢复保存/重算折扣及排序输入，不回溯重扣已经装入的cost。现有映射：`map-cards.test.ts`“discounts on an unplayed Hand card…”, “a new round has no inherited discount…”, “discounts cannot fund unrelated costs…”；AG新断言尚无。

### EQ03 / AG09 — 显式目标倒地、自动fallback

**输入**：e1 HP3/10，e2 HP5/10。p1/p2各有合法自然Action `hit`，Action攻击3、Actor ammo成本1，p1 final9、p2 final8，两个都起始ammo1；p1先对e1。分支A：p2显式锁定e1；分支B：p2只有自动偏好目标e1、未显式锁定。其余共用值继承；Enemy费用/HP无终局影响。

**OLD与EQ推荐**：A中p1击倒e1；p2仍以e1为合法身份目标，HP实际delta0、不复活、不换人，正常支付ammo1及其其他合法效果。B中p1击倒e1后，p2自动按当前活体/偏好选e2，e2从5到2并付ammo1；无替代目标的另一子例把p2 Action cost设Actor ammo1、起始ammo1，此时Actor cost/effect=0、natural PlayerCost=0，Receipt记`noLegalTarget`。若p2是PlayerCommand，仍扣Command PlayerCost1，但Actor/Team费用=0。

**AG推荐(D04/D05-AG)**：同一目标语义且该轮尚未终局时结果完全相同；第二个活着的Enemy是必要fixture，避免p1清空最后敌人后p2应是`roundEnded`而非测试fallback。**实质差异**：若合同改为显式目标失效时重选，A会把e2从5降2并多产生命中效果；这不是推荐。若没有e2且p1清最后Enemy，推荐D05为p2 `roundEnded`、不付Actor/Team而不是`noLegalTarget`；显式/自动“合法后倒地”对照不能混作终局后skip。

**证据/映射**：`map-run.test.ts`“preserves a manually confirmed sole default target…”、“reselects automatic Character targets in order…”、“keeps an already paid PlayerCommand fee…”；后续EQ与AG需各有保存和trace断言，未运行新规则。

### EQ04 / AG04、AG05 — Skip费用分通道

**OLD01自然skip输入**：p1/p2两张合法行动都自动指e1，e1 HP3；p1先打3，p2无其他可自动目标，p2 Action cost Team supplies1，起始Team=2；p2不是Command。旧Actor/Team `costs` 仅实际非skip项计入己方起始余额聚合。预期p1付/执行；p2 `noLegalTarget`、Actor/Team=0，不花PlayerCost。若p2选PlayerCommand的Hand外行动，起始Team与PlayerCost必须足以让该offer合法；自动目标无替补后其PlayerCost=1仍累计，Action Team cost=0。

**OLD Enemy skip子例**：①`unaffordable`：初始EnemyTeam fuel=1；e1合法自然Action cost0、resource effect fuel−1；e2合法自然Action cost1。e1按声明序执行后fuel变0，e2到执行时才预检并免费skip；Enemy Hand抽选时e2起始费用可付。②`defeated`：p1先手击倒e1，e2仍活且无终局，e1自己的后续source因HP0免费skip、e2继续。③旧`roundEnded`：队伍只剩p1且HP1；e1先攻造成2使全队failure，e2仍存活且在后序，因此e2记`roundEnded`，费用/HP=0。当前旧planner在Enemy循环先检查source HP，再检查terminal，所以不能用“击杀唯一Enemy后的已死e1”声称旧`roundEnded`。

**EQ**：规范化后保留以上Skip和分组Receipt。**AG推荐**：Actor/Team/Ability费不足或程序错误拒整个detached plan；Enemy当时余额不足仅skip本源；terminal先于来源HP，已有终局全后续`roundEnded`；来源HP0但尚未终局是`defeated`。Command被选中的1 PlayerCost已在起始PlayerCost校验中保留，即使该来源后来skip。备选“skip来源仍扣Actor/Team/Item”会改变玩家损失，Draft §13不推荐。

**关联**：`map-run.test.ts`“keeps an already paid PlayerCommand fee…”、“skips a defeated Enemy natural action for free…”、“resolves Enemy turns in declaration order…”、“keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict”。`unaffordable`/`defeated`/`roundEnded` fixture需分别独立，不能折叠成笼统“全skip免费”。

### EQ05 — 保存恢复、幂等与摘要完整性

**输入**：非终局Encounter：e1 HP10，p1 `shot` costs ammo1、HP−3；Item `kit`映射Action且合法、当前库存1；Map声明 `resumeVersion=3`；Hand/RNG/版本均取真实Owner绘制和草稿流程结果，PlayerCost够Ability。先Save含合法Item draft（尚未Commit）；恢复到空MapRun Owner，同定义/版本。Commit request `req-save-1` 一次，再Save并Load；另做相同request重放、冲突request、改Receipt target/scope/resource delta/cost/顺序或resumeVersion的损坏副本。

**预期**：Save包含`mapId+resumeVersion+run`与activeEncounter/Hand/targets/drafts/Receipt/RNG；恢复重核现行Registry、party、resources、Encounter、Receipt和版本；合法请求只扣ammo、只消耗1 kit并保存一次结果；同ID同命令/draft不重写，异输入拒绝；损坏Scope/费用/Receipt或resumeVersion拒恢复，无迁移。重复Preview零写且不推进RNG。AG/E1未来格式另核`executionContractId`、`schedulerFormatVersion`、被冻结agility及trace序列，不能仅重排旧分组数组。

**映射**：`save-resume.test.ts`“round-trips an in-progress MapRun…”、“rejects unknown Map or mismatched resumeVersion…”；`source-transactions.test.ts`“saves an Item draft…”、“rechecks useCondition…”；`map-run.test.ts`“commits prepared actions… atomically…”；未来trace恢复负例待加。

## E1-NEW：程序/locals与作者边界

### NEW01 — 条件治疗与when时点

**输入**：两个各自独立Encounter样本：伤者primary HP4/10与5/10；p1合法自然治疗Action目标伤者，resolve为guard及hpChange primary+3，Team已有`med=0`；PlayerCost/Actor成本0，locals可为空，Battle保留e1 HP10。版本E1-COMPAT-1，seed/versions走通用值。每样本用两种合法写法：A `when(HP<5, then=[heal3,team med+1], else=[heal3])`；B `heal3`后`when(HP<5,then=[med+1])`。

**D01推荐输出（到达位置读当前HP）**：A：4→7且med+1；5→8且med不变。B：先分别4→7/5→8，guard都读当前7/8且不奖励。then/else仅一支；trace每个guard有predicate、实际读值、branch；存档可恢复locals/HP与最后成功trace。另一个“program开始快照”方案仅在B且初HP4时奖励+1（读4），造成与书写先治疗后判断相反结果；不推荐。资源余额condition不允许，不能据此检查med。

**映射**：当前无when；未来E1行为测试候选`tests/engine/gameplay-b-map-run.test.ts`或新program测试。旧HP/费用基线见`map-run.test.ts`相应用例；不声称当前通过。

### NEW02 — Team恢复能否供另一行动费用：资格约束与AG合法fixture

**不可构造的负例**：Encounter起始Team supplies=0，拟在自然Hand选取一张Team cost1行动，同时另一来源resourceChange(sourceTeam,supplies,+1)。在当前Hand抽选规则中该自然行动不可由零余额起始构造；Actorless Ability/Item不能拿来绕过，因为它们没有额外Action costs（来源费用仅Ability PlayerCost1 / Item库存1）。期望资格/作者验证阻止把这当合法自然Hand正例；Actorless外加Team cost应在Registry/作者校验定位到Action/source，不进入执行队列。它只证明“不能凭空构造”，不声称新program已实现。

**合法对照Fixture（复用真实现有构造）**：Map使用`LATE_EFFECT_COMMIT_MAP`现有最小两人输入，起始Team supplies=1、PlayerCost=1。shiroko自然Hand `shiroko-spend` 花Team1；serika自然Hand为Wait（`hands=[{shiroko,[shiroko-spend]},{serika,[]}]`），但她有合法Hand外PlayerCommand `serika-refill`，花Team1、resource effect +1 supplies，命令选择PlayerCost1。现有用例实际确认该Command候选合法、命令后Preview因合计Team费用2而不能Commit；自然/Command资格沿起始余额规则不变。AG样例只给两条实际source：serika-refill final8 (base8/max8/actor0)，shiroko-spend final2 (base2/max2/actor0)，target.kind=none且无HP终局；Actorless/Item未参与。

**版本分支**：E1-COMPAT-1合法草稿的起始Team总费用2>1，故整轮拒绝，team仍1、PlayerCost仍1、HP/Receipt/round/RNG不变。AG-1 D02-AG推荐 serika-refill 先开始时支付Team1→0，再执行+1→1；shiroko-spend之后支付Team1→0；serika的PlayerCost1由起始PlayerCost扣除，Commit成功。Trace顺序/余额before-after逐条相符。D02备选起始余额预留：Team需求2>起始1，整轮拒绝且所有状态不变。初始Team=0的NEW02不是可构造自然Hand的正例。

**trace/save**：AG trace顺序与各资源before/after对得上；Preview两次Team仍1；安装后保存恢复Team0、PlayerCost0、trace/order一致、重放无重复。现有fixture映射：`map-run.test.ts`“reserves natural Hand-first Team costs…”、“keeps a naturally payable round when a later PlayerCommand adds a Team cost conflict”、“treats a missing MapRun resource balance as zero when filtering Hand candidates”。未来AG功能未测。

### NEW03 / NEW04 — Counter策略、上下界、Flag与溢出

**NEW03输入**：p1/p2两合法自然来源各`counterAdd(trust,+1)`，先后由party声明index；无Resource/Item成本。它是non-battle `Rest` activity（Enemy roster省略/空）、`rounds=3`、completion字段省略、Round1。locals `trust={initial:2,min:0,max:3}`。Save/Load在本轮Commit后继续。

- D03推荐clamp：p1 2→3，actualΔ+1；p2 3→3，actualΔ0；trace两项，Receipt/active snapshot最终trust3，仍round1→2不立即完成（此例不声明completion condition）；Save/Load trust3。
- 实质备选strict reject：第二次+1越max使整轮零安装，party HP/Team/locals/Receipt/Item不变，seed/Hand/round也不推进；diagnostic指出Encounter/action/effectPath及trust上界。

**NEW04边界样本**：同一完整fixture中分别单独跑：a) `trust=0,min=0,max=3` 再−1；clamp→0、delta0 trace，strict→整轮拒绝。b) initial4/max3在作者校验期拒绝。c) trust=`MAX_SAFE_INTEGER`加1在任何clamp前算术溢出，两方案均整轮拒绝。d) Flag `ready=false`，同轮依序`flagSet(true); flagSet(false)`，最后false，trace记录两个before/after而非删除键；非bool字符串true拒绝作者输入。重复Counter来源仍各记录实际变化，不能折叠丢失第二条0 delta。

**映射**：当前无locals/Counter/Flag，所有是E1-NEW预测；Registry新增测试候选。D03未批只保留clamp/reject，溢出拒绝属工程默认。保存恢复跨轮locals保留、新Encounter重置；本轮例断言Save仍3/0/Flag false。

### NEW06 — 逐Encounter作者声明与Actorless限制

**输入**：Action `share`用于Encounter A和B，effectProgram引用Counter trust；A声明`trust`，B未声明。分别尝试缺失Counter出现在未选中的else。party `sourceTeam supplies`缺失用独立Map样本（Map级`initialTeamResources`不能按Encounter分别声明）；Enemy `sourceTeam fuel`缺失用Encounter A/B样本，A有`initialEnemyTeamResources:[{resourceId:"fuel",value:0}]`，B缺该行。还尝试Ability/Item Action `costs`非空、`sourceActor` HP、`prepare.discountSCost`/CardRef target、self/card/none/无unit primary目标的静态负例。

**预期**：Registry按Map/每个引用Encounter/source上下文校验所有可能分支；B定位B/Action/effectPath拒绝，AC Resource同名不代替局内balance声明；party/enemy同拼写余额分池。Actorless Action的`costs`非空一律静态拒绝（不是忽略），且不允许sourceActor/self/card/prepare CardRef折扣；合法Ability/Item仅有明确Unit primary、允许primaryActor/sourceTeam受用，Ability执行才扣PlayerCost1、Item实际执行才扣Inventory1。Actorless补足按D09另列方案，不得构造伪Actor。

**映射**：`registry.test.ts`“does not treat an Enemy-pool Action as an actorless Ability or Item Action”、“accepts Enemy-owned Action pools…”；相关是旧Registry正反例，program locals/Actorless新字段仍待未来测试。

## AG-1：敏捷导致的有意差异（全未批、未实现）

### AG01 / AG02 / AG03 — 上限、二级键、稳定尾序

**AG01输入**：Party p1的selected Action `A` base2/max5、actorAgility10，final5；Enemy e1行动base6/max6、actor0、final6。两者目标合法且不致终局，party/enemy各自资源余额可支付（无Action成本更简单），HP10；排序e1→p1，不增加行动或数值。推荐加法后cap公式下party仍是5，enemy先。D09方案对照：另一独立输入`base4,actor3,max8`时推荐加法final7；备选`max(base,actor)`后截cap final4；对手final5，则推荐先party、备选先Enemy，说明备选有真实顺序结果。负max/base>max/负actor/越safe整数在作者校验/restore拒绝。关联未来Registry+map-run测试。

**AG02输入**：A=`p1` final5/base4/actor1，B=`e1` final5/base2/actor3；可支付且非终局。推荐D10 base二级：A先；替代actor二级：B先。交换阵营归属（A变Enemy、B变party）仍由二级字段决定A/B，只有final与二级同才party先，不能提前应用A03 sideRank。所有行动数值/费用本身不改。

**AG03输入**：final5/base4两侧相同；party `p1,p2` 各同速同base，按ownerDeclarationIndex p1再p2；Enemy e1/e2同速按Enemy声明。完整键在各自side/sourceRank后逐个稳定尾键排序。重算Preview/存档恢复/同输入相同队列；尝试复制同一sourceKey的重复条目则整计划拒绝。D10通过后同速才Party优先，Party内始终有定义序。

**映射**：当前无敏捷字段/排序实现；AG01–03均新设计测试候选，不声称当前测试。

### AG04 / AG05 / AG10 — 击杀/击倒、终局先于source HP

**AG04高速击杀输入**：Party仅p1/p2；Enemy仅e1 HP3/10。p1自然Action `kill`打3，final9/base9；p1 HP7/10。p2自然Hand `heal` final1/base1，目标p1、HP+1、Team cost1。Ability `aid`与Item `kit`分别映射p1、各HP+1，base/max=0、Actorless补足0；Ability PlayerCost1，Item count1且useCondition=true；Actorless无Action cost/discount/CardRef。起始Team supplies=1、PlayerCost=1；e1有合法Enemy natural source final2/base2、energy初值1。所有sources/Hand由Owner实际候选/抽取生成，无其他受影响目标。

- D04/D05-AG推荐：排序p1→e1→p2→Ability→Item。p1打倒最后Enemy后同源完整结束并检查victory，后列来源遇到terminal=`roundEnded`。p2 heal未执行、HP仍7，Team cost不扣；Ability不执行、不扣PlayerCost；Item不执行、库存仍1；Enemy energy1未扣。Commit是成功victory，非计划错误；终局request重放不重复。
- 实质备选“Battle整队列末检查/沿E1旧阶段结束”：AG仍按同一敏捷全序，但选择Battle仅在整条有序队列末检查终局：p2治疗Team−1且p1 HP7→8，Ability PlayerCost−1且p1 HP8→9，Item库存1→0且p1 HP9→10；之后才结束victory。Team起始1、PlayerCost起始1确保皆合法；e1已HP0，其Enemy来源仍以`defeated`跳过并不花energy。推荐方案在p1同源击杀后立刻terminal，后序为`roundEnded`，差异仅是终局时点与后续效果/成本。两者是否执行Item/治疗和扣费显著不同。推荐即时同源后查终局，不是已批。

**AG05敌方抢先输入**：Party按`p1=serika,p2=shiroko`固定顺序；p1 HP2/10且Actor ammo=1，p2 HP10/10。Enemy e1 final9，以Action damage2攻击p1；Enemy e2 HP10/10且不行动，确保e1攻击后Party未全灭、Command target仍合法。p1从真实Owner draw得到免费natural `observe`（target none）；另一个合法participant Action `cmd`在Hand外，target e2、Actor ammo cost1、`hpEffects=[{amount:-3}]`、target kind enemy。PlayerCost=1。用现有`map-run.test.ts`“PlayerCommand selects a payable Hand-out candidate for one PlayerCost without deducting it”的候选/调用形态构造，调用真实Owner抽牌与Command API，固定seed参数使observe实际入Hand；不手动删除cmd/改Hand。Command候选起始`canPayActionCosts=true`。

- AG-1推荐排序e1→p1 Command→p2 Wait/free natural。e1先使p1 HP 2→0，但p2存活且e2活着，未terminal；p1 source `defeated`，Actor ammo和效果均0，PlayerCost仍扣1；e2仍HP10。p2之后无效果来源执行/Wait。trace/Receipt标sourceKey、defeated、PlayerCost1、Actor/HP delta0，Save/Load后来源与版本一致。
- E1-COMPAT-1或“来源倒地仍执行”对照：p1 Command在Enemy阶段前执行，PlayerCost1、Actor ammo1，e2 HP10→7；随后e1使p1 HP0，p2仍活，Encounter未failure。该对照实测旧排程顺序；Actor/目标/命令来源都起始合法。

**AG10继续留存来源输入**：按AG04，但保留另一活Enemy `e2`，p1击倒e1不足以终局；p2慢治疗可执行、随后e2/其他队列再决定终局。此对照明确：p1对e1击倒后e1自身行动为`defeated`，e2继续；只有击倒最后Enemy或全队倒地才把更后条目记`roundEnded`。另用AG04单Enemy输入覆盖真正终局后的Ability/Item未执行。

**当前证据映射**：`map-run.test.ts`“PlayerCommand selects a payable Hand-out candidate…”、“keeps faction-scoped Enemy targets… auto-wins without an Enemy turn”、“resolves Enemy turns in declaration order, stops on party defeat…”；这些只支持OLD来源和事务，不证明AG排序/停轮。

### AG06 — Swap/PlayerCommand改变真实队列

**输入**：p1 Hand有自然`slow` base2/max10/actor0与可Swap `fast` base8/max10/actor0；p2有legal natural final5及一张合法Hand外Command offer final7；两人目标/费用可支付。初始source行是p1 slow、p2 natural；进行Swap p1→fast改变draftVersion 4→5并重做目标/CardRef，然后p2选PlayerCommand取代其natural，draftVersion 5→6。p3只有Wait，不创建执行行。请求使用各自draft/commit版本，旧token 4/5不能安装新规划。

**AG推荐输出**：版本4先p2 natural(5)→p1 slow(2)；版本5 swap后p1 fast(8)→p2 natural(5)；版本6 command后p1 fast(8)→p2 selected Command(7)。旧natural/offer/UI克隆不入队，PlayerCommand费用独立1，替代Action的Actor/Team成本正常，Swap自身免费。新token可Commit一次，Receipt/AG trace记录最后选中的CardRef/Action与sourceKey；Save恢复只保留版本6状态。测试候选既有`map-run.test.ts` Swap与PlayerCommand覆盖，但敏捷重新排序无测试。

### AG07 — 全来源入队与Actorless数值

**输入**：同Round同时选择p1 natural final3 (base2,actor1)、Ability映射Action base4/max10 (actorless补足0)、Item映射Action base2/max10 (actorless0, kit count1)、Enemy e1 final5/base5、p2 Wait。所有Ability/Item有合法Party unit primary目标且无需额外Action cost/Actor cost，Ability起始PlayerCost1；Enemy自己的Actor资源够。PlayerCost初始2；生命/资源不致终局。每个输入有真实Action映射，Actorless没有CardRef。Hand由真实Owner draw生成并捕获seed/cursor；不得手造state。

**推荐D09/D11序**：Enemy e1 final5 → Ability4 → p1 natural3 → Item2；Wait没有队列项；所有来源sideRank/sourceRank/声明索引按完整键处理。Ability执行扣1 PlayerCost，Item实际执行才扣1 kit；自然/Enemy按各自费用，Owner/阵营相同资源名分账。Actorless Action 不增加任何Action cost，不借p1补足，不创建sourceActor/单位source HP；primary是显式unit目标，sourceTeam可写party team。

**D09实质备选数值**：另设映射Ability base2/max10与Enemy final4，p1 party leader agility5。推荐Actorless actor=0，则Ability final2，Enemy4先；Actorless借队长补足则Ability final7先，两种顺序明确不同。另对Action base4/actor3/max8，推荐base+actor=7、`max(base,actor)`后截=4；若对手final5则排序分别party先/敌方先。旧值缺失全视0（Draft推荐）时与迁移键一致。D09数值字段/公式仍待批；Actorless不借队长为推荐。

**负例**：Ability/Item声明额外Team/Actor `costs`、sourceActor HP、target self/card/none、无unit主目标均资格/静态校验失败；不能借Ability额外Teamcost给AG供给用例。sourceKey/阵营重复必须拒绝。测试来源事实见`source-transactions.test.ts`及`registry.test.ts`；AG入队尚无测试。

### AG08 — prepare折扣失效源

沿用EQ02输入但目标卡p1 final8、Enemy e1 final7先击倒p2 final2，保留e2活着。输出及prepare/执行时机两个可观察分支见EQ02；AG trace另外按source序列记录p2后续`defeated`与已生效轮初折扣快照，D07恢复需重算折扣与冻结输入。准备阶段必须只对轮初合法、已实际选中来源生效；未选Hand/候选卡无队列，也不提供本轮减费。推荐D02-DISCOUNT轮初统一prepare；执行时折扣为实质备选且p1需付ammo/sCost2。

### AG09 — 显式/自动目标中的敏捷窗口

沿用EQ03输入并固定同一完整队列：p1 final9攻击e1(3 HP)后，p2 final8已锁显式e1→HP实际delta0且仍付Actor1；另一个同输入自动目标p2改取e2(5→2)并付Actor1。两个样本均保留e2所以不会越过battle terminal。若把p2调为Command，显式/自动目标规则不影响PlayerCost1。AG07的Actorless Ability/Item目标也要求明确单位目标，不随其他source死亡暗中改主目标；合法目标死后且尚未终局时其primary HP效果0但其他合法效果/费用仍执行。没有实质玩法备选：外来Scope/过期/伪造仍是输入拒绝；若实现误把合法显式目标自动换人，e2会受额外伤害；它是旧行为回归反例，不是待批玩法选项。

### AG10、NEW05 / AG11 — 未执行Item与双终局/non-battle完成

**AG10终局输入**：直接继承AG04单Enemy快杀。Trace应有p1执行并击杀、p2 heal/Ability/Item后条目各自`roundEnded`，Item未消费、Ability不扣PlayerCost；PlayerCommand skip的PlayerCost例外由AG05单独覆盖；胜利保存不存在，终端request内存重放返回相同结果不重复执行。

**NEW05/AG11 battle双全灭输入**：单program合法targets：e1 HP1/10、p1 HP2/10，p1是唯一Party成员、e1是唯一Enemy；Action合法目标为e1且resolve依序`hpChange(primary,-1); hpChange(source,-2)`，费用0，Encounter其他内容为空。该合法来源完整执行后e1和p1都归0；AG-1 D05推荐failure优先于victory，Commit成功failure、后续来源均roundEnded。该输入使用E1已列的source/primary单位HP写入能力推演，但AG-1尚未实现或获批。

**NEW05/AG11 non-battle输入**：非战斗Encounter Round1、completion condition trust≥1；locals trust0..3 initial0；source p1 final9 counter+1，后列p2 final5 Team cost1、resource supplies+2。Team初始1，PlayerCost够，p1/p2候选均合法，非Battle。D05推荐整队列完成后查condition：p1 trust1、p2先付1再supply +2；terminal一次推进。若每source即时检测，p1达标立刻推进，p2 `roundEnded`、Team保持1/supply0；会丢掉正常付费效果，该备选是实质差异。E1-COMPAT-1若完成条件尚未采用，则只按现有rounds/manual，不能假装condition存在。locals/trace/receipt随下一round保存，换Encounter清理。

### AG11 terminal优先顺序附注

AG推荐每次source完成后按failure优先再victory，且对后续来源先检查已终局再查source HP；所以单Enemy被击杀后更后行动为`roundEnded`，不能说source倒地`defeated`。要覆盖`defeated`必须多留一只活Enemy；敌方先手击倒我方行动者时必须至少留一名Party存活者，否则是全队failure后`roundEnded`；显式目标合法后倒地要另留活Enemy，确保该source没有先遇到terminal，才断言HP0实际0但照付。

## NEW07 / D06–D08：验证、Receipt和预算边界

**D06上下文输入**：①同一Map Action `share`用于Encounter A/B，program读Counter trust；A声明trust，B漏trust（包括缺失引用出现在未选中的else），Registry定位B/action/effectPath拒绝；Counter不可由A声明代偿。②Enemy source Action `enemy-share`用于两个Battle Encounter A/B并引用Enemy sourceTeam `fuel`；A的`initialEnemyTeamResources`声明fuel=0，B缺该Enemy Team余额，B/action定位拒绝。③party sourceTeam `supplies`属于Map级`initialTeamResources`，另用一个Map声明/缺失两样本；不能写成同Map某Encounter有、另一Encounter缺。`resourceId`为MapRun局内键，同名AC Resource不能代替余额声明，party/enemy同名资源分池。④Ability/Item Actorless负例：Action `costs`非空（任何额外Actor/Team cost）、sourceActor HP、`prepare.discountSCost`/CardRef target、self/card/none目标或无unit primary目标均静态拒绝；只保留合法unit primary与sourceTeam/primaryActor范围，Ability仅有1 PlayerCost，Item仅按实际执行消耗1 Inventory。

**D08静态预算输入/输出**：

- program静态计数64=prepare叶子+resolve statements（含when）+condition树每predicate/logic节点；数组容器不计；静态64接受、65拒绝。prepare单独8接受、9拒绝。resolve根深度1，when子列表每层+1；condition根1、嵌套逻辑每层+1；各自深度4接受、5拒绝。then与else皆静态计数且皆校验；locals counters+flags总64接受、65拒绝。
- 动态访问整轮4096预算：所有实际访问program来源共享。每访问一条语句、实际访问condition节点、prepare叶子各+1；短路未访问节点、未执行branch、被skip source的resolve不计；prepare只一次。4096正好成功，4097时整个detached plan失败，Hp/locals/资源/PlayerCost/库存/RNG/Receipt零安装、不生成截断trace。旧数组规范化不追溯新64/4096阈值。
- 动态预算可构造正例：Encounter含64个合法实体来源（1个party + 63个Enemy），每个来源各自Action只有64个flagSet(ready,true)叶子、无prepare/条件/HP/费用/终局影响，locals只声明ready=false；所有source均有起始可抽的唯一零成本候选，并经Owner真实draw固定Hand。每个source实际访问64条，共4096，成功后ready=true，保存trace记录4096条变化。再增加第65个合法Enemy来源、同样只有1个flagSet，总访问4097，拒绝整轮零安装。用例fixture的source数量必须通过Registry/Owner roster约束并以实际draw状态生成，不能用一个65静态节点program替代动态预算边界。
- 当一program定义65 static nodes，即使超额在未走else中也作者期拒绝；dynamic边界则用4096/4097实际访问分支。错误写入 `Map/Action/program path`、limit和值。

**D07 trace篡改输入**：合法AG快照含唯一sourceKey、current resumeVersion、schedulerFormatVersion、executionContractId=AG-1、base/max/actor补足快照、sort inputs、trace顺序/source/effectPath/target/actual deltas/guards/cost/item。复制后逐项篡改effectPath不属于规范化Action、重复/错序order key、非法sourceKey、guard read不符、before/after不连续、HP超cap、费用/库存重复、locals缺失、Scope版本不符、scheduler/receipt版本不匹配。恢复应逐项拒绝且Owner保持空；合法同current Encounter checkpoint将末值与snapshot互校、加载后下一轮结果相同。旧Receipt仅party/enemy/ability/item分组，不可从它推断跨来源顺序；离开Encounter后只核定义和trace内一致性，不能声称还原完整前历史。格式/地图不兼容提高版本并拒旧save，不加迁移。

**E1-COMPAT-1 vs AG-1**：AG序列必须真实写入且可恢复排序结果；E1只使用旧分阶段planner与保旧字段receipt投影。执行版本不是AG的要求不能应用到E1；A01–A06保持敏捷只改顺序、不改抽牌、Action次数、费用公式或效果数值。

## 覆盖/缺口索引

| 裁定 | 样例覆盖 | 仍缺/归属 |
|---|---|---|
| D01 | NEW01 | when新程序未实现；E1测试转产品Task |
| D02 / D02-AG | OLD01、NEW02、EQ04、AG04/05/07/08/10 | 需待批AG支付及折扣；AG fixture需真实合法Hand |
| D03 | NEW03/04 | 饱和vs拒绝待批；超safe溢出工程拒绝 |
| D04 / D04-AG | EQ03/EQ04、AG05/09/10 | 来源倒地/终局skip待批；区分三个测试状态 |
| D05 / D05-AG | NEW01、NEW03、AG04/05/10、NEW05/AG11 | Battle即时终局vsphase-end差异待批；non-battle condition phase待批 |
| D06 | NEW02/NEW06/07、AG07 | Actorless具体目标/补足待审；不能给Ability/Item额外Action cost |
| D07 / D07-AG | EQ05、全部AG trace、NEW03/07 | 新序列恢复属于待后续实现；不把现存分组Receipt当全序 |
| D08 | NEW07 | 数字为工程默认；测试计数实现待后续Task |
| D09 | AG01/07 | 加法/Actorless补足数值玩法待批；借队长可翻转AB顺序的数例在AG07 |
| D10 | AG02/03 | base vs actor二级玩法待批；稳定尾键工程默认 |
| D11 | AG06/07/09 | 实际来源身份、入队与快照时点按A01/A05作为工程合同；仅Actorless是否借队长补足属于D09玩法分支 |
| D12 | OLD/EQ/AG分组与每例版本 | 工程先E1-COMPAT-1后AG-1默认；E0不建立产品Task |

**当前测试映射总览**：OLD/EQ用`tests/engine/gameplay-b-map-run.test.ts`、`gameplay-b-map-cards.test.ts`、`gameplay-b-map-source-transactions.test.ts`、`gameplay-b-map-save-resume.test.ts`的命名现测作为旧行为来源；NEW和AG对应的是未来新增/更新行为断言候选，必要作者负例在`tests/data/gameplay-b-map-registry.test.ts`。当前没有新语法/AG测试。U4未重跑测试；U1的四文件78项仅为当前旧代码基线，并不能证明本文件的未来期望。

## 边界与人工复核项

- 真正待批玩法结果：D01条件读取顺序/else合同、D03 Counter越界、D04敏捷来源倒地与skip、D05战斗/非战斗结束时点、D09加法与Actorless agility、D10二级比较、D02/D02-DISCOUNT AG政策；Actorless补足0还是借队长作为D09备选。D11真实来源/入队/排序快照按A01/A05落实为工程合同。文档给推荐分支和精确备选，未取得批准。
- 已定的人类原则A01–A06不得重新开选项；AG排序不得改变抽牌/行动次数/费用/效果公式。
- 工程默认无需额外人类选型：D06资源/上下文校验、D07有界trace恢复与版本、D08预算/零安装、稳定尾键、双Owner原子安装；若有新的可观察玩家差异再升为待批。
- 确认窗口边界：要观测某个Enemy来源`defeated`，需其source HP0且尚有活Enemy、Party未终局，之后其他Enemy仍可执行；要观测`roundEnded`，推荐AG用例可让Party击杀最后Enemy后停后续。当前旧planner先查Enemy source HP，再查terminal，所以旧`roundEnded`需让e1击倒最后Party、后面的活e2再跳过。敌方击倒一人但至少另一名Party存活才是source `defeated`；全队清空后其他source `roundEnded`。显式合法target HP0测试也须留活Enemy且本轮未终局。
- 本文推演若遇到作者/来源限制无法构造，标为静态拒绝或资格不可达；不得伪造一个合法Ability/Item Team-cost来填表。NEW02起始Team0成本1只用于Hand不可达或Actorless禁止额外cost的反例；AG正例复用`LATE_EFFECT_COMMIT_MAP`两源fixture（Team1、serika-refill PlayerCommand付1再+1、shiroko-spend自然Action付1）。
- 证据路径：U1 `current-behavior-evidence.md`；D裁定/AG键与阶段以当前Draft0312 §11–§13、E1阶段以Task0312 §3–§5为准。工作树中原U1文档存在，U4不修改它。

### Skip补全 — Enemy noLegalTarget与非法作者/费用拒绝

**Enemy noLegalTarget最小输入**：Battle仍有两名存活Party与两名存活Enemy；e1选中一张合法Enemy Hand Action，target.kind=`card`，当前Encounter的source-relative合法目标CardRef集合为空；e1 Team/Actor资源足够，Action cost=EnemyTeam fuel1，初fuel=1；其他行动不导致终局。现有planner在target解析后遇`targetCard=null`写`noLegalTarget`，本源cost/resource/HP均0；不影响e2执行。Receipt仍按Enemy声明顺序。该输出不同于`unaffordable`（有效目标但当时余额不足）、`defeated`（source HP0且未终局）和`roundEnded`（已终局优先于source HP）。当前可引用`map-run.test.ts`“projects Enemy unit and card targets…”作为目标投影入口，但没有专门的Enemy空Card候选回执基线；标为未来应补的旧行为测试，不把未覆盖写作已验证。

**其他零安装负例**：先制作完全合法来源/余额/目标，再分别令MapRun `Actor/Team` cost聚合超过己方起始余额、resource delta使余额低于0或超过MAX_SAFE_INTEGER、草稿/commit版本过期、来源Action在Commit前从Encounter定义/Hand撤下、显式外来目标/Snapshot Scope错配、CardRef round/node/activity错配、同Action旧数组+effectProgram混用、program缺local/resource声明。预期费用不足整轮失败；其余作者/身份/stale错误定位到Map/Action/source/字段并拒绝；全都不安装HP/locals/资源/PlayerCost/Item/Hand/RNG，状态/版本/库存保持输入快照。冲突requestId拒绝；同requestId异draft拒绝。这些分别落`map-run.test.ts` stale/invalid target/receipt corruption，`source-transactions.test.ts` missing target/stale/no inventory，`registry.test.ts` malformed source/duplicate balance；新program字段检查是未来负例。
