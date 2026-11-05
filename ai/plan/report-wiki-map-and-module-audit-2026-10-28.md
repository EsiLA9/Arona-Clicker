# Wiki 调查：Area Map、MapRun 与其他模块

> 调查日期：2026-10-28。本文记录现行 Wiki 的覆盖情况和建议编写范围，不是机制规范，也不是已安排实施的 Task。

## 调查范围与判断方法

并行调查世界区域导航 Area Map、Gameplay B MapRun 和其他项目模块，并将现行 `docs/docs-830/` 与源码、测试及现有作者示例交叉对照。项目地图的 `graph_project` 确认项目为 `acprogram`；保存图用于寻找入口，未刷新或修改，也未核验全图新鲜度。模块盘点覆盖领域服务、数据、Engine、Runtime、游戏 UI 和独立编辑器的主要入口，并非逐文件穷举。归档文档只能提供历史线索。

本文的**缺少正文**指当前 Wiki 没有系统说明某机制；**已有概览、需要加深**指已有页面涉及但不足以回答列出的问题；**已覆盖、可补实例**指已有相应正文，不应误判为完全未写。按读者问题和稳定职责决定拆页，不要求每个类各有一页。

Area Map 是世界区域导航；MapRun 是地图玩法的局内状态；Operation Run 是另一个独立的局内作战流程。三者的命令、状态和规则不能相互替代。前两者应优先编写；Area Map 当前机制说明见 [[area-map-overview|Area Map 概览]] 与 [[area-map-projection-and-session|投影与会话]]，项目其他候选主题可对照 [[ai/plan/report-wiki-830-coverage-2026-10-28]]。

## 一、Area Map：世界区域导航

**覆盖状态：缺少机制正文。** [[world-and-spots]] 解释 Init、Area、Spot 和世界线快照，[[workspace-navigation-and-rendering]] 提到 Area Map 临时 UI 会话；两者都没有说明地图投影或旅行规则。

建议先从世界域入口增加一篇总览，再补旅行与交通、投影与界面两篇详解。定义和作者检查先归入总览，只有内容增长时才拆参考页：

| 要写的内容 | 读者应能回答的问题 | 当前核对入口 |
| --- | --- | --- |
| 地图定义与入口 | `AreaDef.navigationMapId` 如何关联 `AreaMapDef`？节点 ID、坐标、动作和边各代表什么？默认节点动作是什么？ | `src/data-services/contracts/area-map.ts`、`src/data-services/contracts/world.ts`；`tests/data/area-map-registry.test.ts` |
| 内容创作与校验 | 为什么定义可跨包引用、地图可循环或自引用？哪些错误按包验证，哪些在合并后的最终定义集合验证？ | `src/data-services/registry/area-map-validation.ts`；`tests/data/area-map-pack.test.ts`、`tests/data/area-map-authoring.test.ts` |
| 可见性与投影 | 节点何时省略，何时隐藏名称、目标或操作？为何地图显示的候选边也要有实际连接？ | `src/arona-clicker/services/world/area-map-query.ts`；`tests/engine/area-map-query.test.ts` |
| 真实旅行与交通 | `adjacent`、`visited`、`transit` 如何判定？已访问中间节点的 `quickPassage` 有什么作用？何时重验和写入？ | `src/arona-clicker/services/world/area-travel-routes.ts`、`init-service.ts`；`tests/engine/area-map-travel.test.ts`、`tests/engine/area-map-fast-travel.test.ts` |
| UI 会话与持久化 | 切图、选择、缩放与提交旅行分别改变什么？当前位置和访问记录属于什么状态，相机与浏览历史又归哪里？ | `src/ui/workspace/area-map-controller.ts`、`area-map-session.ts`、`src/arona-clicker/state/per-init-fields.ts`；`tests/ui/area-map-controller.test.ts`、`area-map-session.test.ts` |
| 默认内容和排查 | 如何用现成默认图核对入口、隐藏节点与失败原因？ | `src/arona-clicker/content/base-datapack-source.ts`；`tests/data/default-area-maps.test.ts`、`tests/engine/area-map-runtime.test.ts` |

写作时尤其要说明：地图候选线只是展示定义，实际连通性由 Area 邻接、运行时连接及交通网络决定；命令会重新检查目标和当前世界状态。默认内容目前按 Init 的 Area 生成地图，但这不是对所有第三方数据包强制的结构。旅行规则还有剧情指定移动的特殊路径，需以对应源码和测试界定，不能把常规旅行规则无条件套用。

**待写作时确认**：Affector 交通连接的激活/失效时机、独立编辑器对各字段的实际支持，以及最小示例的数据包包装。UI 相机与浏览历史属于暂态会话；当前位置和访问记录参与每 Init 状态，不能写成一份 MapRun 存档。

## 二、MapRun：Gameplay B 地图玩法

**覆盖状态：已有概览、缺少系列机制正文。** [[maps-and-operations]] 区分 MapRun 和 Operation 并解释基本恢复检查；Operation 已有 [[operation-runtime-and-admission]] 与 [[operation-action-planning]]，不能用 Operation 的版本化计划或结算规则代替 MapRun。

建议以“总览 → 局内遭遇和行动 → 效果、状态、事实 → 存档和界面”的顺序组织，实际页数按职责与篇幅决定：

| 候选专题 | 需要回答的问题 | 源码与测试入口 |
| --- | --- | --- |
| 地图定义和 Run 生命周期 | 内容从哪里装载？如何创建、移动、进入 Encounter / Shop、完成或失败？队伍快照和局内状态由谁持有？ | `src/data-services/contracts/gameplay-map.ts`、`src/arona-clicker/services/map/map-run-service.ts`；`tests/engine/gameplay-b-map-run.test.ts` |
| 手牌、目标、遭遇行动 | 玩家和敌人的候选如何产生？草稿、合法目标、预览与实际提交有什么区别？ | `src/arona-clicker/services/map/gameplay-b-hand-resolver.ts`、`gameplay-b-action-preview-resolver.ts`；`tests/engine/gameplay-b-map-cards.test.ts`、`gameplay-b-map-ag1-commit.test.ts` |
| 执行合同与顺序 | `E1-COMPAT-1` 与 `AG-1` 的行为边界是什么？行动来源和执行顺序如何确定？ | `src/arona-clicker/services/map/gameplay-b-ag1-source-adapter.ts`、`gameplay-b-ag1-scheduler.ts`；`tests/engine/gameplay-b-ag1-order.test.ts` |
| Effect Program | 动作如何声明效果、选择目标、表达数值、计算结果与形成回执？资源和 HP 的实际变化何时提交？ | `src/data-services/contracts/gameplay-map-effects.ts`、`src/arona-clicker/services/map/map-effect-planner.ts`；`tests/engine/gameplay-b-effect-program.test.ts`、`gameplay-b-effect-program-commit.test.ts` |
| 状态与生命周期 | 遭遇内状态与跨遭遇的 MapRun 状态如何获得、变化和消失？护盾、减伤等如何参与实际结算？ | `src/arona-clicker/services/map/map-encounter-statuses.ts`；`tests/engine/gameplay-b-effect-lifecycle.test.ts`、`gameplay-b-maprun-status-example.test.ts` |
| 地图事实、路线与候选池 | Counter / Flag 由谁写入，路线条件和候选池分别在何时读取？恢复时如何验证？ | `src/arona-clicker/services/map/map-edge-conditions.ts`、`gameplay-b-hand-resolver.ts`；`tests/engine/gameplay-b-maprun-fact-gated-pools.test.ts` |
| 存档、回执与恢复 | `resumeVersion`、当前定义、随机状态、提交记录和恢复校验之间是什么关系？不兼容时影响什么？ | `src/arona-clicker/services/map/map-run-service.ts`、`map-effect-receipt-validator.ts`；`tests/engine/gameplay-b-map-save-resume.test.ts`、`gameplay-b-map-ag1-restore.test.ts` |
| 工作区交互 | 卡牌与目标选择如何形成命令，预览、信息流和只读视图如何反映结果？ | `src/ui/components/map/map-workspace.ts`、`src/ui/workspace/map-relation-interaction.ts`；`tests/ui/gameplay-b-map-workspace.test.ts`、`gameplay-b-map-vertical-slice.test.ts` |

局内状态不等于长期 PlayerState，但不能写成两者绝不交互：Encounter Item 的成功提交涉及玩家物品栏与 MapRun 的协调，草稿和预览不扣物品。详见 `src/arona-clicker/runtime/runtime-game-instance.ts`、`tests/engine/gameplay-b-map-source-transactions.test.ts`。

作者示例 [[ai/guide/examples/gameplay-b-effect-program-e1]] 第 32 行的“当前没有随机抽选”等说法疑似过时：现行类型和规划器已有 `random` TargetSet 与受限的 `forTargets`，新 E2 效果 AST 需显式 `AG-1`；循环体也不是任意语句均可用。应以 `src/data-services/contracts/gameplay-map-effects.ts`、`src/data-services/validation/gameplay-map-effect-context.ts`、`src/arona-clicker/services/map/map-effect-planner.ts` 和对应测试核对具体支持范围，再单独修正示例；本文不把此发现当作所有执行合同都支持这些功能的证明。E2 是效果程序能力的称呼，不是第三种 Map 执行合同。

## 三、地图之外：其他模块覆盖情况

### 高优先：Variant 转译与训练

**覆盖状态：缺少机制正文。** [[character-growth]] 介绍的是等级、星级、装备等长期培养，不解释如何把角色转成 Gameplay B 构筑。`VariantTranslationService` 从已拥有角色或受信任的 slice 和内容生成候选；预览 token 是服务内句柄，确认时重新计算并核对，预览本身不创建 Run。应解释输入、选择、预览、确认、过期与状态变化的边界，并与长期玩家进度及 MapRun 入场衔接。

训练至少涉及两条不同路径：开发测试使用独立 `VariantTrainingService` 和 MapRun；正式 Spot 场景使用主 MapRun，并有对应角色和 Spot 准入及主 Run 互斥。编写时要将两条路径分别核实、分别示例，不能把整个训练说成只有独立测试 Run。

源码：`src/arona-clicker/services/character/variant-translation-service.ts`、`variant-training-service.ts`、`variant-training-scenario.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`。测试：`tests/engine/variant-translation-service.test.ts`、`variant-training-main-runtime.test.ts`、`variant-training-scenario.test.ts`、`tests/ui/variant-training-spot-entry.test.ts`。

### 高优先：信息揭示、Milestone 与 Achievement

**覆盖状态：已有概览、需要加深。** [[world-and-spots]] 只有一段介绍 Watch、Adapter 和进度投影，尚不足以解释条件、事件覆盖和恢复。建议增加世界进度机制详解，回答：如何判断已知与未解决的信息、何时建立或重建监听、条件何时复核、何时写完成事实、Achievement View 如何投影进度。

特别需要写清限制：信息揭示区分多种解析状态，wake plan 可能只覆盖部分条件或只能在准入时检查；Milestone 使用另一套条件叶子映射，不支持的条件可能无法建立 Watch。不能泛称“所有条件变化都会自动触发”。

源码：`src/arona-clicker/services/world/information-reveal-domain.ts`、`information-reveal-adapter.ts`、`milestone-domain.ts`、`milestone-adapter.ts`、`src/arona-clicker/read-model/achievement-view.ts`。测试：`tests/engine/information-reveal-lifecycle.test.ts`、`information-reveal-save-rebuild.test.ts`、`milestone-runtime.test.ts`、`achievement-view.test.ts`。

### 中优先：Trigger 运行时注册与内部 Action

**覆盖状态：已有机制正文、需要加深。** [[trigger-mechanism]] 已说明声明、事件过滤、条件、`once` 和挂载；[[event-effects-triggers]] 简述注册与撤销。可结合上面的 Watch Adapter 补充 registration key、token、tag/group、重复注册冲突和同次派发期间撤销的行为，以及 typed runtime action 与普通 Effect 的不同执行路径。

源码：`src/engine/effect/trigger-system.ts`；测试：`tests/engine/trigger-system.test.ts` 中的 runtime action、注册和派发撤销场景。建议扩充现有页，是否另拆取决于实例篇幅。

### 中优先：Operation 的内容作者路径

**覆盖状态：运行机制已有正文、作者贯通示例不足。** [[operation-runtime-and-admission]]、[[operation-action-planning]] 已解释运行与行动，[[editor-schema-to-form]] 已解释通用 Schema 到表单。可增加一个从 Event、Location、Action、Student Profile、Strategy Profile、Card Pool 等定义到引用校验、运行准入的实例；无需把 Operation 重判为未写。

源码：`src/data-services/contracts/operation.ts`、`src/data-services/registry/operation-content-validation.ts`、`src/arona-clicker/services/operation/operation-participant-admission.ts`。测试：`tools/datapack-editor/validate/operation-authoring.test.ts`、`tests/engine/operation-participant-admission.test.ts`。

### 中低优先：主题来源与编辑生命周期

**覆盖状态：已有机制正文、可补实例。** [[story-chat-and-theme-presentation]] 已介绍主题来源及表现；若需要支持内容作者或编辑器维护，可用主题预览、保存、revision 冲突及退出清理案例，补充内容包主题与玩家主题编辑的区别。

源码：`src/arona-clicker/services/presentation/theme-content-editor-service.ts`、`user-theme-service.ts`、`user-theme-layer-service.ts`。测试：`tests/engine/theme-content-editor-service.test.ts`、`user-theme-service.test.ts`、`tests/ui/controller-theme-cleanup.test.ts`。

### 目前已有入口的其余模块

世界线与 Spot、角色成长、剧情、商店、Runtime 内容协调、Engine 表达式和 Tick、游戏 UI 路由与刷新、独立编辑器与 Schema 均已有相应机制页和部分示例。本次按项目结构与重点源码抽查，**并未证明这些页完整，也不等于项目其余模块不存在缺页**。需要扩写时应针对具体读者问题和源码继续核对，避免只因某个源码文件没有同名 Wiki 就新增页面。

## 四、建议编写顺序与交付标准

1. **Area Map**：先总览和旅行，接着写投影/UI；以一个默认区域图和一条真实旅行路径贯通定义、查询、命令和保存边界。
2. **MapRun 与 Variant 训练**：先总览和一次遭遇，再逐步写效果、状态与事实、恢复/UI；用同一份真实内容串起行动和失败示例，并处理现有示例中的过时描述。角色转译与正式训练入口应与 MapRun 交叉链接。
3. **世界进度揭示与 Milestone**：补 Watch 如何建立、何时重新判断，以及何种条件无法被监听；再扩充 Trigger、Operation 作者路径和主题等已有页的实例。
4. 每个专题落地时更新索引与相关入口，注明源码符号和测试；对适用合同、状态归属、失败、恢复以及尚未支持的情况给出明确边界。

本轮只读取源码和测试、开展文档覆盖调查；没有运行游戏行为测试，也没有修改正式 Wiki、游戏实现或项目地图。`npm run check:docs` 仅检查现行文档结构和链接，不能证明机制说明正确。各行为测试在正式编写和验证时按涉及范围选择执行。
