# Task：通讯录简易培养与 Spot 演练场入口

状态：completed — 2026-10-24。用户要求自主建立Task、由Luna辅助，通讯录培养与Spot正式演练入口已实施并验收。

## 目标与裁定

把「通讯录培养真实持有Variant → Spot进入演练场 → 当前持有/场景切片转译 → 真实战斗」串成可操作的小循环。按用户“不需要非常严谨”采用免费可重复培养，不增加材料/冷却/新养成轨道。原Task0324专用MapRun适配继续使用，不迁移普通地图Variant/actorId。

- 通讯录对应角色页提供训练+1000经验、交流+15好感、已有碎片突破；显示等级/好感经验与上限、准确碎片消耗与禁用状态。写入沿用StateMutationService，经GameCommands调用。
- 修复现有经验与好感纯计算未将已存经验计入本次升级判断的问题；行为回归先行。
- Spot功能新增固定 `variantTrainingEntry`，指向现有专用演练场。夏莱主区增加默认免费开放的演练设施，经真实Spot拥有/位置/utility/condition准入，打开正式游戏演练面板。进入场所沿用共享Modal宿主；面板复用现有来源预览、战斗、检查点，不依赖devConsole查询参数或试玩命令。
- 玩家未持有星野时仍可借用普通/强化切片；真实拥有可从既有阿比多斯联络点领取，不在演练入口暗授角色。演练无奖励、不写主地图与主SaveData；培养遵循原roster存档归属。

## 已核实事实

- `contacts.ts`已有经验+100和突破，controller现为右栏重绘；可窄扩展成培养区域原位补丁。
- RosterSystem从Registry查询曲线/好感；StateMutationService已有addExp/addAffectionExp/breakthroughStar。新增好感GameCommands仅适配已有写入口。
- applyExp/applyAffectionExp原先只以本次量判断升级，分次小额未跨级，现已构造回归并开始修复。
- 现有Spot功能为固定kind合同，经SpotFunctionalitySystem处理持有与condition；UI utility揭示与入口命令位置需同样复核。
- 独立VariantTrainingService已实现真实AG-1、版本化快照/检查点和生命周期清理；当前仅dev console挂载，需移出development作为共享正式面板。
- 工作树有前轮未提交与用户并行修改；既有map-workspace.schedulerTerminal类型错误不属本Task。

## 施工切片与边界

### U1：培养领域（Luna training_content）

白名单：`contracts/character/roster-query.ts`、`services/character/roster-system.ts`、`services/progression/cultivate-system.ts`、`services/character/affection-system.ts`、`tests/engine/cultivate-system.test.ts`、`tests/engine/character-cultivation-query.test.ts`（src路径均在src/arona-clicker下）。只读cultivationOf提供上限/经验/突破，修复累计计算；不改持久结构。

### U2：通讯录界面与命令（主Agent；Luna training_tests验证）

白名单：`src/ui/components/character/character-cultivation.ts`、`contacts.ts`、`src/ui/controller/controller-actions-contacts.ts`、`controller-events.ts`（好感播报与剧情培养即时同步）、`src/ui/css/entity-theme.css`、`contracts/runtime/{runtime,mutation}.ts`、`runtime/runtime-commands.ts`、`tests/ui/character-cultivation.test.ts`、现有直接受影响UI测试。

DOM：新增一个培养section，内部dl值、动作组、消耗与反馈；沿用char-stats/primary-button和主题token。培养普通click按element级补文本/disabled，按钮/角色页/左右滚动owner不替换，列表只补该Variant等级；区域缺失只回退右栏，聊天数据变化沿既有Chat owner刷新。

### U3：Spot合同/内容（Luna training_content续作）与正式演练面板（Luna training_ui）

领域白名单：`src/data-services/contracts/world.ts`、`src/arona-clicker/content/def-factory/spot.ts`、`src/arona-clicker/content/world/spots.ts`、`src/arona-clicker/content/world/areas.ts`（夏莱Area显式Spot清单）、必要Spot合同验证/Schema生成与定向测试。正式base内容由既有 `scripts/sync-base-datapack-bundle.mjs --write/--check` 同步到 `src/arona-clicker/content/base-pack/content.json`，审diff只纳本任务内容，不手工写生成JSON。新增固定kind，无自定义脚本或任意resolver。已核实作者DSL会过滤未知kind，故同步 `src/data-services/authoring/content-policy-dsl.ts` 的kind列表/无参数读写，以及 `tools/datapack-editor/schema/editor-extras.ts` 已有下拉kind/中文标签；仅防止现有编辑丢失功能，不新增编辑器交互。

UI白名单：`src/ui/components/character/variant-training-panel.ts`、原`src/ui/development/variant-training-panel.ts`（兼容导出/迁移）、`src/ui/css/variant-training.css`、原试玩台样式/样式导入、`src/ui/components/shared/production.ts`、新增Spot入口controller模块及其bind接线、`src/arona-clicker/contracts/runtime/runtime.ts`与`runtime/runtime-commands.ts`（窄门面接线）、Spot入口UI测试及既有训练面板测试。

DOM：Spot卡内新增mini-action。点击经Controller复核准入后打开共享Modal；正式面板source/actions常驻，preview/battle/result各自局部更新。关闭只离开观察，重新进入继续当前独立训练；Runtime生命周期仍清理。正式入口不提供“进入办公室”捷径；准入失败提示原因。每次命令重验来源Spot与当前Init/Area、持有/utility/condition。普通地图与页面壳不替换。

各Agent先核对当前源文件与分配边界；白名单外变更、事实冲突或预算超出先报告主Agent。收尾主Agent合并验证和文档，独立Luna审查。

## 验收

- [x] 训练/交流连续多次正确累计，未持有不可培养，达到上限禁用，突破只扣对应Variant碎片。
- [x] 当前持有重新转译反映新培养；旧局冻结，切片不随培养改变。
- [x] 培养按钮与滚动DOM保持，通讯录等级同步，无全页render。
- [x] 普通启动无需dev参数，夏莱Spot默认开放，点击功能可进入演练场；所有来源/战斗/检查点可操作。
- [x] 失去Spot拥有/位置/条件/utility或变更Init时拒绝旧入口命令，不隐式换线/授予角色。
- [x] 定向行为/UI回归、Schema同步、类型/架构/文档/空白检查与真实浏览器完成；类型检查仅余既有错误，见下方。

## 核验与剩余

2026-10-24用户后续澄清：期待经Spot进入真实卡牌玩法工作区。本Task交付的是培养与Modal式独立演练接线，没有交付MapWorkspace卡牌环境；该最终目标仍未完成，后续施工见 [[docs/plan-work/archive/task-0326-variant-translation-real-card-workspace]]。

U1–U3完成。Luna training_content负责培养领域/Spot内容与正式bundle同步，training_ui负责正式Spot入口与共享面板迁移，training_tests负责培养UI行为回归、交叉审查和最终只读地图复核。主Agent完成通讯录培养界面、命令适配、好感即时同步、整合与浏览器验收。

- 回归先行：等级60+40与好感8+7的累计跨级测试先见红后修复。交叉审查发现好感升级消息不立即显示、剧情增加好感未更新角色页，两条真实事件回归先见红后修复；当前中心播报与右侧培养读数都即时更新，培养控件保留。
- 最终定向回归18文件178/178：培养/好感/roster/持久化、角色页/通讯录/事件、训练内容/服务/Runtime、Spot领域/正式UI/共享面板/旧控制台、authoring与Schema同步。
- `npm run gen:schema`正常执行，生成Schema unchanged；既有editor-extras补固定kind。Schema同步15/15。正式base JSON由既有同步脚本生成，diff仅新Spot和Area引用；`--check`通过。
- 架构、文档与diff空白检查通过。`tsc --noEmit`仅剩施工前已有 `src/ui/components/map/map-workspace.ts:768` 的 `schedulerTerminal` 错误，本Task不扩大修改。
- 浏览器普通入口 `http://localhost:5173/src/ui/index.html` 无dev参数：正常解锁/进入夏莱，Spot功能直接打开演练；未持有普通切片可入场，第一回合敌先手后HP8/10，关闭重进保持第二回合。经阿比多斯联络点正常领取星野，在通讯录训练至Lv15、好感Lv3，等级累计与即时好感播报正确。回到Spot预览owned读取战备50→强化HP16/敏捷6，原普通局仍冻结HP8/10；重新开始owned实战三轮剩HP12/16，恢复检查点准确回到第二回合HP14/16。
- 宽屏1280×720截图：`C:/Users/15229/.codex/visualizations/2026/10/24/task-0325/cultivation.jpg`、`spot-training.jpg`。保留localhost正式游戏预览可继续操作。
- 浏览器环境事实：原127.0.0.1来源已有旧内容包缓存，普通进入旧Story时出现缺stages错误；用独立localhost来源验证当前正式bundle正常。不删除用户存档或缓存，不为该旧包建立迁移。正式演练关闭后本局保留；检查点仅当前面板实例内存保留，关闭重开需重新保存检查点。

最终仍不涵盖正式平衡、费用/冷却、其他转译模式、普通MapRun身份迁移和完整牌池/Tag绑定。

## GALHCG与路由

已通过graph_project核对acprogram，按character路径定位通讯录；Spot当前源码核对。Luna收尾对39条直接路径只读changed：28条有映射（27 content_changed、1 metadata_only），11条无直接Evidence/maps_to；所有owner分页完整，main.ts和计划索引完成第二页。不刷新/改图/写freshness；Task归档前未登记图关联，无图内迁移依赖。

- [[docs/docs-829/04-mechanisms/arona-clicker/gacha-cultivation]]
- [[docs/docs-829/04-mechanisms/arona-clicker/variant-translation]]
- [[docs/ai/frontend-design-project-overlay]]
