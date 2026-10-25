# Task：Variant 转译后进入真实 Gameplay B 卡牌工作区

状态：completed — 2026-10-24。三名 Luna MAX 子 Agent 协助完成主 MapRun 接线、三阶段构筑、正式存档与 Spot 卡牌工作区；普通游戏实屏完成三战及第二/三战刷新续行。开发控制台新参数仅完成独立设计，不计入本Task实现。

## 目标与前轮偏差

最终路径为：**通讯录培养 Variant → 夏莱 Spot「进入演练场」→ 直接进入真实 Gameplay B 卡牌工作区 → 第一战：玩家持有Variant → 第二战：普通切片Variant → 第三战：高级切片Variant → 完成/退出/续行。**三次作战属于同一关卡、同一个主MapRun，按固定顺序进行，不由玩家从三种来源中任选其一。

Task0324/0325复用了真实MapRunService和AG-1结算，但使用独立训练owner、固定单攻击与Modal数值面板。它证明了数值转译和战斗结算，没有交付真实卡牌场景。此前把“复用战斗引擎”当成“进入卡牌玩法环境”，使施工边界偏离用户期望。本Task以Spot直接进入现有 `map` 路由、真实卡牌交互和正常保存恢复为完成定义，不以增加弹窗或来源选择页结项。前一版Task提出的MapEntry选择/预览/确认流程已由本次裁定取代。

## 范围与推荐合同

### 玩家流程

1. 保留夏莱主区 `base:spot:variant_training` 与现有固定 `variantTrainingEntry` 功能，点击后直接进入现有 `map` runId路由，并到达第一场可操作的战斗；无来源选择、转译预览、额外入场确认或行前准备页。保留来源Spot和返回位置。
2. 首期仍是准确的 `Hoshino` Variant、单槽、固定 `gameplay-b` 模式。第一战使用玩家当前持有的该Variant及培养；第二战使用入口提供的普通切片；第三战使用入口提供的高级切片。高级对应当前 `enhanced` 切片，玩家文案使用“高级”，不因此新增转译模式。
3. 点击入口的领域命令内部校验Spot与三种来源，调用既有转译预览/确认机制，冻结本次三份构筑后原子开局；这不是玩家可见流程。第一战未持有准确Variant或任一来源无效时，原位提示原因，不开局、不跳过第一战、不暗授角色或用切片替代。
4. 三场都使用真实MapWorkspace的Prepared/Hand/候选、合法目标、敌方意图和AG-1回执。场景显示“第1/3战·当前持有”“第2/3战·普通”“第3/3战·高级”，并回显该场真实HP/敏捷与来源版本。
5. 本场胜利后，通过场景内标准继续动作进入下一场，无需再次选择/确认来源。第三场胜利才完成整关；任一场失败按现有Map失败流程结束，可重开，不能跳战。
6. 三场为构筑对照：敌方配置和可用卡牌规则保持一致，每场用该来源构筑重新初始化HP、敏捷、Hand/Prepared、局内资源和Encounter状态；不继承上一场伤势、护盾、临时状态或资源奖励。沿用同一Run，不能通过重建三个owner冒充连续关卡。
7. 离开场景返回原Spot位置，再次点击直接继续当前战斗；不插入续行Entry。重开整关回第一战，使用该局原冻结的三份构筑。需要读取最新培养时，明确放弃/结束旧局后从Spot新开；培养仍留在通讯录。

### 唯一战斗所有者

- 正式演练使用当前Runtime的主MapRun owner、相同ReadModel和GameCommands，不再让正式入口持有独立训练战斗owner。
- 转译服务负责来源、版本、预览与冻结构筑；场景适配负责将构筑接入主Map内容和准入；MapRun负责卡牌实例、Hand/RNG、草稿、目标、HP、结算与回执；UI只呈现和发命令。
- 同时只允许一张正式活动地图：其他地图进行中时演练入口给出阻塞原因，不覆盖、不暗中放弃，也不并行启动第二局。演练进行中时普通地图同样受该规则约束。
- Spot点击是显式开局命令，其内部完成转译确认；不增加玩家确认步骤。直接调用普通 `startMap(trainingMapId)` 不得绕过三来源校验和构筑冻结，不能凭一个地图ID或UI上传属性入场。

### 构筑、身份与内容

- 当前持有只读取准确Variant的真实roster培养；同Chara另一Variant不能替代。场景切片按入口声明提供借用资格，不写roster、不授予角色，不被普通地图的“必须已有角色/Variant”检查误拒。
- 新owned入场必须消费本次有效preview/confirm结果，由Spot开局命令内部执行。`restore(snapshot)`有意不重查当前持有/培养，只能用于冻结局恢复；不得把任意restore成功当成新开局授权。只读查询不得偷偷确认token、创建Run或改写活动构筑。
- 本关准入以已确认的Variant来源与场景授权为准。首期可保留旧Map合同需要的固定角色键作为单槽兼容映射；该键不负责选择Variant或授予资格，Chara不成为新的数值/牌池来源。
- 模板与转译依据来自可信内容。推荐为主resolver增加局限于当前场景绑定的内容适配，静态地图仍走Registry；不修改共享Registry定义，不保存调用方上传的任意Map定义。
- 同一固定mapId可产生不同三阶段冻结构筑，活动Run使用的内容必须随绑定固定，并由当前战斗节点确定准确来源；owner与Workspace查询解析必须一致。不能改变共享地图定义来切换数值，不能用当前培养重新生成第二/三场或恢复已有局。
- 固定演练模板为入口→持有作战→普通作战→高级作战→出口，入口只作内部初始化节点，不显示来源选择页。每场提供至少两种可实际选择、效果或敏捷不同的我方行动，以及可验证的目标选择。候选/Hand必须来自Map原生Action、候选池与CardRef流程，不用UI数组模拟卡牌，也不能仍只有一张固定攻击后自动提交。
- 每场HP与基础/最大敏捷必须来自其转译结果；行动速度修正、伤害/治疗等使用已实现的AG-1合同。普通沿用10HP/敏捷2，高级沿用16HP/敏捷6，持有按开局冻结培养计算；增加卡牌后不继续硬套旧固定三回合结果。
- 当前模板HP/敏捷是Map级定义，不能仅复制三个战斗节点就声称已切换出战构筑。P0必须明确逐场构筑绑定与进入战斗时的初始化合同；通过主owner的合法阶段转换应用，不能用UI直接覆写HP或临时换全局resolver。
- 本片牌池由可信演练模板声明。现有capabilityIds/tags/candidateSourceIds为空，不扩大为通用能力/Tag/候选来源注册系统；若演练需要非空来源，须在本Task内先补有限映射合同与测试，不能静默忽略。

### 保存、恢复与生命周期

- 正式演练进入主 `SaveData.mapRun` 保存/恢复路径，取消“关闭弹窗保存点就丢失”的正式体验；开发内存检查点不替代正常续行。
- 保存一个有界、带判别类型的场景绑定：准确模板修订、按持有/普通/高级固定排序的三份冻结转译snapshot、战斗节点与来源映射及与MapRun的关联依据。进度以MapRun节点/活动为权威，不另设会与节点不同步的UI战次游标。最终字段位置在P0冻结；静态地图不携带该绑定。不是新增第二份Run、独立训练存档或任意JSON内容仓库。
- 恢复顺序必须为：严格验证场景绑定/精确内容修订 → 用冻结来源重建可信地图定义 → 以相同resolver创建主owner → 恢复并校验MapRun。不能只恢复run再从当前培养猜回定义，也不能从最新模板顶替旧修订。
- 恢复保留当前战次、三来源版本、已完成节点和本场HP、Hand/CardRef、目标草稿、RNG与commitVersion；恢复到本场中途不得再次执行入场初始化而回满血/重抽牌。拒绝三场顺序调换、跨构筑拼接、未知版本和篡改，不部分安装错误场景。owned恢复按冻结培养重建；后续培养变化不改已有局，切片也不随培养变化。
- 按现有Map生命周期处理读档、Init切换、reset/dispose、重开和放弃；场景绑定与对应owner一起释放。无角色/培养/资源奖励，不新增结算奖励机制。没有旧实验检查点迁移要求。

## 施工前核实事实与接合点（历史基线）

| 事实 | 当前源码依据 | 必须处理的接合点 |
| --- | --- | --- |
| 正式Spot当前开Modal | `src/ui/controller/controller-actions-variant-training.ts`：`bindVariantTrainingActions/guardedPort` | 改为点击后直接启动/续行map，并保留Spot/Init/Area/utility/functionality复验 |
| 训练自建第二owner，直接固定回合 | `src/arona-clicker/services/character/variant-training-service.ts`：`createOwner/start/commitRound` | 正式战斗改交主owner，入口服务不继续持有第二份战斗状态 |
| 演练内容仅单候选攻击，HP/敏捷为Map级，能力/Tag/候选来源为空 | `src/arona-clicker/content/gameplay-b/variant-training-content.ts`：`buildVariantTrainingMap` | 增加三战与逐场构筑初始化，复用最小可交互卡牌模板 |
| 主内容解析当前只查Registry | `contracts/map/map-content-resolver.ts`、`services/map/registry-map-content-resolver.ts`、`runtime/runtime-game-instance.ts`：`replaceMapRunOwner` | 动态构筑绑定必须同时供owner和所有ReadModel查询使用 |
| 普通准入从Chara反查拥有Variant | `runtime/runtime-game-instance.ts`：`resolveMapPartyAdmission/admitMapParty/startMap/getMapEntryView` | 场景授权走独立的准确来源准入，不以普通拥有检查替代切片授权 |
| 现有真实卡牌视图/命令已具备 | `src/ui/components/map/map-workspace.ts`、`src/ui/controller/controller-actions-operation.ts`、`src/ui/workspace/map-dom-updates.ts` | 复用Prepared/Hand/目标/预览/Commit/局部DOM更新，不建立第二套战斗UI |
| 现有普通地图有map-entry和map两条路由 | `contracts/map/map-entry.ts`、`src/ui/components/map/map-entry-workspace.ts`、`src/ui/workspace/workspace-router.ts` | 本演练直接走map，不新增选择Entry；普通地图原行前流程保持 |
| 主保存只有mapId/resumeVersion/run | `contracts/map/map-run.ts`：`MapRunSaveSnapshot`；`contracts/runtime/save-data.ts`；`services/map/map-run-service.ts`：`createSaveSnapshot/restoreSaveSnapshot` | 必须额外绑定冻结转译依据，并先重建相同可信内容 |
| 正式base使用bundled JSON | `content/default-datapack.ts`、`scripts/sync-base-datapack-bundle.mjs` | 内容改动通过既有脚本同步并核对diff，不仅更新测试数据 |

上表未带src前缀的领域路径均相对 `src/arona-clicker/`。当前实现以源码为准，前轮完成记录只说明其窄范围交付。

## 施工阶段

### P0：冻结最小接合合同与行为回归

确认主owner三阶段场景绑定、来源准入、逐场初始化、resolver重建、保存DTO位置和内部token生命周期。优先构造：点击一次直接开局；owned缺持有则整关不开；三场顺序固定；场景切片自身不要求持有且不写roster；三份构筑在开局冻结；其他地图占用拒绝；同地图ID不同构筑不可串用；第二/三场中途恢复不重复初始化。确定两种以上行动的最小模板和实际可达的Hand/目标操作。

落点集中在角色转译/训练合同、Map场景/保存合同、场景内容适配及定向engine测试。保持单角色单槽，不新增来源选择Entry，不将全局actorId迁移变成此Task前置。

### P1：主MapRun接入、可信内容与恢复

实施领域入口服务、主resolver/owner三构筑绑定、合法逐战初始化、主ReadModel及主SaveData恢复；接入三战共用的最小卡牌规则。逐项证明所有Map查询和命令命中同一owner/同一冻结场景，本场结束后才推进来源，静态普通地图路径不退化。旧实验面板仅可留为开发诊断，不再作为正式Spot目的地。

### P2：Spot直入与三次真实作战端到端验收

Spot点击内部完成准入和转译，成功直接进入第一战，失败原位提示；已有本关活动Run则直接继续。复用当前卡牌工作区及命令，以本场节点更新“第几战/来源/数值”，选牌/目标/提交沿既有Map局部协调，保留Frame、滚动、焦点与范围外浮层。验证三场顺序、每场独立初始化、整关胜败、退出返回、重开/放弃、第二/三场普通存档刷新续行。移除正式入口对训练Modal、来源下拉和MapEntry确认页的依赖。

实施时按上述阶段拆为3–5文件、约300–500行的正式Patch Unit，先登记Read Set、Allowed Files和Receipt；不得将整个阶段当成无边界Unit。用户已允许Luna辅助，建议分别负责领域/恢复、UI接线、独立行为审查。主Agent负责跨层合同与最终实屏，不以子Agent“代码完成”代替终点验收。

## 完成定义与证据

- [x] 无开发参数，从普通夏莱Spot点击一次功能，直接出现 `data-workspace-frame="map"` 的第一战；无来源下拉、行前Entry、转译预览/确认或训练Modal。
- [x] 同一Run内严格按“持有→普通→高级”完成三场；不能选择、跳过、颠倒或在中途改出战来源。任一场失败结束整关，第三场胜利才通关。
- [x] owned缺准确持有时整关不开、不消耗/授予任何东西；第二/三场使用scene-provided切片，不写roster、不读取其即时培养。
- [x] 每场使用对应的真实HP与敏捷，且切场按合同重置本场战斗状态；培养后新开整关读取新owned，已开局三份构筑全部冻结。
- [x] 浏览器实际展开或查看Hand，选择至少两种不同行动，选择合法目标并提交；真实CardRef/草稿/AG-1回执和目标HP变化可核对。只看自动结算文字不算通过。
- [x] 准入、卡牌、预览、提交、地图移动、胜负和返回全部走主owner/主ReadModel；普通地图进行中不得被演练覆盖。
- [x] 离开后Spot点击直接续当前战次；重开整关回第一战并沿用原三构筑，新培养需结束/放弃后新开才生效。
- [x] 主SaveData JSON往返与浏览器在第二/三场中途刷新后，Spot可直接恢复同一战次/构筑/HP/手牌/目标/RNG/提交版本，不重复满血/重抽初始化；未知修订、顺序调换、跨构筑拼接和损坏输入被拒绝，无部分安装。
- [x] 训练不暗授角色、不发奖励；普通静态地图入口/玩法/保存恢复回归通过。
- [x] 桌面宽屏录入从Spot到选牌/目标/结算/退出/恢复的完整验收与截图；复用真实卡牌UI，DOM连续性定向测试通过。
- [x] 类型、架构、文档、Schema/正式bundle同步按影响检查；已知基线与新错误分开记录。实屏必需路径上的既有问题应复核并纳入明确修复切片，不仅绕到另一套试玩环境。

定向验证从 `tests/engine/variant-translation-*.test.ts`、`variant-training-*.test.ts`、现有MapRun保存/Runtime测试，以及 `tests/ui/gameplay-b-map-{workspace,vertical-slice}.test.ts`、`map-dom-updates.test.ts`、正式Spot入口测试扩展；不为形式运行无关全仓测试。

## 本轮核验与剩余

2026-10-24：P0–P2已完成。正式Spot一次点击进入现有Map工作区，三战按持有/普通/高级固定顺序；主owner经节点partySetup初始化对应HP/敏捷/资源，三份构筑开局冻结。主SaveData带严格场景绑定，恢复当前战次不回血/重抽，后续提交与再保存可用。旧独立单战只保留为开发诊断。

最新5文件34项和相邻12文件161项均通过，共17文件195项；最终类型、架构、文档、Schema同步及正式bundle检查通过。独立审查发现“完成演练后开普通地图保存误挂旧绑定”，已新增失败回归后修复。扩大回归的旧调查样例断言与本轮前dirty内容差异另记E1/R2 Receipt，没有改样例或把失败记为通过。

实屏使用无开发参数的 `http://localhost:5173/src/ui/index.html`：正常夏莱开局和联络点领取星野→Spot直入→真实Hand分别选择强力与快速打击、选择目标、提交；第一战4HP结束，第二战以10HP初始化，存8/10HP/敌3HP/round2后刷新仍续；第三战以16HP/敏捷6初始化，存14/16HP/敌4HP/round2后刷新仍续；返回Spot再入不重置，最后经出口显示通关。截图目录：`C:/Users/15229/.codex/visualizations/2026/10/24/task-0326/`。细节与命令见R1/R2 Receipt。

本Task无必需未完成项。范围外仍为多角色任意编队、同Chara多Variant共场的全局身份模型迁移、其他转译模式、通用能力/Tag/候选来源映射、正式平衡与长期奖励经济。`partySetup`首期消费可信动态场景；静态Registry作者字段专项校验未扩展。用户新增的控制台准备参数见 [[docs/plan-work/draft-0327-development-acceptance-console]]，仅设计未实现。

## Patch Unit Index — 共7个施工单元

`acprogram`项目身份已核对；收尾集中只读复核17个源码/测试/生成协议路径：6条有映射且Evidence陈旧、11条未引用，owner分页完整。未改图、刷新或写freshness。

| Unit | Scope / status | Specification | Receipt |
|---|---|---|---|
| UI1 | Spot直入 Map Workspace；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-ui1]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-ui1-receipt]] |
| E1 | MapRun逐节点战斗初始化；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-e1]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-e1-receipt]] |
| S1 | 三来源新开局与节点内容；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-s1]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-s1-receipt]] |
| S2 | MapRun保存绑定与严格恢复；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-s2]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-s2-receipt]] |
| R1 | 主Runtime场景准入与命令；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-r1]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-r1-receipt]] |
| R2 | 主保存恢复与生命周期；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-r2]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-r2-receipt]] |
| R3 | 文档、协议与验收收尾；完成 | [[docs/plan-work/archive/task-0326-units/task-0326-r3]] | [[docs/plan-work/archive/task-0326-units/receipts/task-0326-r3-receipt]] |
相关入口：[[docs/plan-work/archive/task-0325-character-cultivation-and-spot-training]] · [[docs/docs-829/04-mechanisms/arona-clicker/variant-translation]] · [[docs/docs-829/04-mechanisms/arona-clicker/gameplay-b-cards]] · [[docs/ai/frontend-design-project-overlay]] · [[docs/ai/PROJECT-CONSTITUTION]]。
