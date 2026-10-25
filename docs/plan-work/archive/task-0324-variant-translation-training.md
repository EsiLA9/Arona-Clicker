# Task：Variant 转译演练场

状态：completed — 2026-10-24；用户批准按简单设计执行，U1–U3与自动化/浏览器验收完成。

## 目标与边界

在现有 Gameplay B 本地试玩台增加可操作的「Variant 转译演练场」：固定一个 Hoshino Variant，在玩家当前持有、普通切片、强化切片三种来源间选择；固定 gameplay-b 模式；预览→确认→真实 MapRun 短战斗→结果核对，并支持独立 JSON 测试检查点恢复。

- 普通切片 HP10、敏捷2/8；强化切片 HP16、敏捷6/8。训练靶HP6、敏捷4，双方固定伤害2；样例数据只供测试。
- 玩家来源按当前真实持有与培养解析，不自动授予角色或修改培养；切片由测试入口提供借用资格。
- owned profile 为测试用战备属性：base20 + (level-1)*2 + stars*2 + (affectionLevel-1)，0..10000，50起为强化档；此数据不写入正式 Variant 定义。
- 使用独立 MapRun owner 与固定单槽适配器，不覆盖进行中的普通地图，不把切片伪装成玩家持有。不迁移 MapRun 全局 Variant/actorId 合同。
- 显式将快照的HP和敏捷接入实际 AG-1 运行，普通后手、强化先手。能力、Tag/候选来源的通用绑定仍不在此片实现。
- 独立检查点包含模板版本、转译快照、MapRun checkpoint；加载先验证并重建同一地图，再原子替换测试 owner。仅战斗中可保存，结果页可恢复先前检查点。
- 测试全部在当前内存运行，无奖励、无主 SaveData 字段、无 Datapack/生成 Schema 改动。

## 当前事实

- Task0323已交付 `variantTranslation` 独立接口，尚未被普通Map消费。
- `MapRunService` 可使用可信 `MapContentResolver`、保存/恢复版本化检查点；AG-1使用 Map.partyAgility 与 Action.agility 的base/max执行。
- 现有 `mountGameplayBQuickTestConsole` 仅在开发模式 `?devConsole=gameplay-b` 挂载，已有可复用 dialog、按钮、主题与命令区。
- 当前工作树含用户既有地图/UI未提交改动，之前发现 map-workspace.schedulerTerminal 类型错误和地图调查完成方式断言失败，本次不顺手修改。

## 施工切片

### U1：测试内容与真实地图适配

- Allowed Files：`src/arona-clicker/contracts/character/variant-training.ts`、`src/arona-clicker/content/gameplay-b/variant-training-content.ts`、`tests/engine/variant-training-content.test.ts`。
- Read Set：本Task、Task0323接口合同、GameplayMapDef、现有AG-1测试；预算3文件约600行。
- 完成：可信规则/来源/切片与单槽地图；参数进入真实HP/AG-1字段，拒绝非本关卡构筑。

### U2：测试owner、检查点与Runtime接线

- Allowed Files：`src/arona-clicker/services/character/variant-training-service.ts`、`tests/engine/variant-training-service.test.ts`、`tests/engine/variant-training-runtime.test.ts`（主地图/存档隔离与真实生命周期回归）、`src/arona-clicker/contracts/character/variant-training.ts`（补充检查点一致性binding）、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/arona-clicker/contracts/runtime/event-catalog.ts`、`src/arona-clicker/index.ts`。
- Read Set：U1、VariantTranslationService、MapRunService start/commit/save/restore/move、Runtime lifecycle；预算5文件约900行。
- 完成：预览确认、实际战斗/结果、版本命令校验、独立原子存取、Runtime生命周期清理、无玩家/正式地图副作用。

### U3：试玩面板与验收

- Allowed Files：`src/ui/development/variant-training-panel.ts`、`src/ui/development/gameplay-b-quick-test-console.ts`、`src/ui/css/gameplay-b-quick-test-console.css`、`tests/ui/variant-training-panel.test.ts`、`docs/docs-829/04-mechanisms/arona-clicker/variant-translation.md`、`docs/plan-work/00-index.md`、本Task。
- Read Set：frontend-design技能、项目UI overlay/样式目录、已有试玩台及其测试、U1/U2合同；预算代码约600行，文档另计。
- DOM：dialog原控制台保持挂载，追加独立section；source select/动作按钮常驻，preview、battle、result三个拥有者区域分别更新，保存点只存在当前测试内存。无全页render、无新调色/字体。
- 完成：可选来源、预览/确认/回合/存取均可点击；DOM保持选择/按钮/原命令区身份；沿用现有色彩与控件样式；宽屏实浏览器验收。

各Unit遇白名单外修改/事实冲突/预算超出先报主Agent调整，不扩大为普通地图身份迁移。重要行为优先测试，最终独立审查。

## 验收

- [x] 两种切片无需持有，真实owned缺持有拒绝；同一Variant身份保留。
- [x] 普通HP10且敌先手，强化HP16且己方先手；三回合可结束并核对结果。
- [x] 入场后培养变更不改变本局；重新预览读取当前值。
- [x] 战斗中检查点JSON恢复保持HP/轮次/手牌/来源/版本；伪造或跨构筑拼接拒绝且不破坏当前测试。
- [x] 无持有、培养、资源奖励、主地图或主SaveData写入；生命周期清理。
- [x] 行为/UI定向测试、类型/架构/文档/空白检查、实浏览器和Luna交叉审查。类型检查仅余施工前既有错误，见Receipt。

## Receipt 与剩余

U1–U3完成：固定可信训练内容、独立MapRun owner与Runtime窄门面、真实AG-1战斗、独立JSON检查点和现有试玩台面板均已接通。已用frontend-design技能继承现有dialog样式与稳定控件，Luna分别完成内容、服务行为测试和面板施工，并交叉只读审查，无阻断问题。

- 自动化：训练content/service/runtime共19项、面板4项、既有试玩台17项、转译规则/服务/Runtime32项、角色持久化8项，合计9文件80/80通过；浏览器发现获得角色后提示未更新，已补回归并重跑面板4/4。
- 架构与文档检查通过；类型检查仅有既有 `map-workspace.ts:768 schedulerTerminal` 错误，训练代码无新增错误。既有地图调查完成方式断言问题未扩大修改。
- 浏览器：未持有普通/强化切片均可进入；普通敌先手三轮HP4/10，强化己方先手三轮HP12/16；第一轮后保存，跨构筑结果页恢复到普通切片第二回合HP8/10、敌HP4/6；未持有来源中文拒绝；通过现有内存试玩命令获得星野后owned预览读到真实数据。控件可反复开始，来源选择明确标注用于下一次预览。
- 可操作入口：`http://127.0.0.1:5173/src/ui/index.html?devConsole=gameplay-b` → 本地试玩台 → 进入夏莱办公室 → Variant转译演练场。浏览器保留强化切片第二回合供继续操作；检查点仅当前页面内存有效。
- 截图：`C:/Users/15229/.codex/visualizations/2026/10/24/variant-training/training.jpg`。

后续仍为普通MapRun真正Variant/actorId迁移、其他枚举模式、完整牌池/标签能力接线；本测试适配器不代表这些已完成。

## GALHCG

已核对 acprogram 项目身份，收尾对16条直接路径只读changed复核，Runtime与索引owner分页完整读取。6条已映射路径标记content_changed；10条新合同/内容/服务/面板/测试/机制文档/Task无直接Evidence或maps_to关联。不刷新、不改图、不写freshness；归档Task无已登记迁移关联。

## 相关路由

- [[docs/docs-829/04-mechanisms/arona-clicker/variant-translation]]
- [[docs/plan-work/archive/task-0323-variant-unified-translation-interface]]
- [[docs/ai/frontend-design-project-overlay]]
