# docs-830：项目地图与 Wiki 覆盖调查

> 调查日期：2026-10-28。本文是后续编写的范围与入口，不把候选主题直接当作已验证的机制规范。

> 后续澄清：本轮用户所指的是世界区域的 Area Map，而非 Gameplay B MapRun。Area Map 的专门调查和优先编写范围见 [[ai/plan/report-area-map-wiki-2026-10-28]]；本文保留为更广范围的参考，原有 Gameplay B 排序不代表此次需求的优先级。

## 调查方法与限制

以 GALHCG 项目 `acprogram` 的当前保存图为导航，展开产品领域、Engine、数据服务、Runtime、UI、编辑器及工程支持的直接模块和子模块，再对照 `docs/docs-830/` 现有 42 篇页面、部分源码和测试。项目地图的图摘要是导航线索，本轮没有刷新图、修改图或写入 freshness；已保存图不证明每个文件均为最新。对没有独立概念节点的 Gameplay B MapRun，依据源码路径、测试与现有作者示例补充判断。

本报告区分：**缺少机制正文**表示现行 Wiki 尚没有能系统解释该主题的页面；**概览已有、需要加深**表示页面已经提到该主题，但不足以回答所列问题。不是每个 Concept 都必须有独立页面，实际拆页仍应按稳定职责决定。

## 首要范围：Gameplay B 地图玩法

现有 [[maps-and-operations]] 已比较 MapRun 和 Operation Run，但 MapRun 主要停留在创建、移动、遭遇和恢复概览；[[operation-action-planning]] 描述的是另一套 Operation 规则，不能代替 MapRun。地图中 `Gameplay B` 概念与当前 `src/arona-clicker/runtime/runtime.ts` 的 `gameplayBMapDatapack` 装配、`src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts` 的地图内容相互印证。是否启用仍取决于包选择和保存状态，不能把内置包等同于每个存档始终启用。

### 1. MapRun 总览与节点活动

- **现状**：已有总览，缺少 Map 定义、Run、节点、方向边、Encounter / Shop 活动以及完成/终止之间的完整生命周期说明。
- **应写入**：入场输入、局内状态所有者、可走路线与拒绝原因、节点活动顺序、与 PlayerState 的边界；用真实地图和测试串起一次短流程。
- **核对入口**：`src/arona-clicker/services/map/map-run-service.ts`、`src/data-services/contracts/gameplay-map.ts`、`tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-runtime-integration.test.ts`。

### 2. 遭遇行动、手牌与提交

- **现状**：缺少可独立理解的 MapRun 遭遇规则；现有 Operation 的 PreparedBeat / planVersion 不应被当作 MapRun 合同。
- **应写入**：角色/敌方候选来源、手牌和目标选择、玩家草稿与预览、实际行动来源、AG-1 执行顺序和提交边界；说明候选、预览和已经安装的状态之间的区别。
- **核对入口**：`src/arona-clicker/services/map/gameplay-b-hand-resolver.ts`、`gameplay-b-action-preview-resolver.ts`、`gameplay-b-ag1-source-adapter.ts`、`gameplay-b-ag1-scheduler.ts`；`tests/engine/gameplay-b-ag1-order.test.ts`、`tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-cards.test.ts`。

### 3. Effect Program 与局内资源

- **现状**：现行 Wiki 没有 Map Action Effect Program 的机制正文；[[ai/guide/examples/gameplay-b-effect-program-e1]] 及多个回馈示例提供作者场景，但不是统一的规则与边界说明。
- **应写入**：声明、输入/目标、局内资源与 HP 的作用范围、规划结果与提交的关系；按源码区分 AG-1 与兼容路径，不把 Map Effect 和 Engine Effect 混为同一机制。选择一个真实可复现的 Action 展示输入与结果。
- **核对入口**：`src/arona-clicker/services/map/map-effect-planner.ts`、`map-effect-summary.ts`、`gameplay-b-effect-rng.ts`；`tests/engine/gameplay-b-effect-program.test.ts`、`tests/engine/gameplay-b-effect-program-commit.test.ts`、`tests/data/gameplay-b-effect-registry.test.ts`。

### 4. Status、护盾与回合生命周期

- **现状**：作者示例已经覆盖多种状态，但 `docs/docs-830/` 没有统一解释 Encounter-local 和 MapRun Status 的归属与生命周期。
- **应写入**：状态来源、持有者、层数和时长、回合结束处理、护盾和伤害关系、移除与消费；区分本遭遇状态和跨遭遇状态，说明适用合同及不支持的情况。
- **核对入口**：`src/arona-clicker/services/map/map-encounter-statuses.ts`、`src/arona-clicker/services/map/map-effect-planner.ts`；`tests/engine/gameplay-b-maprun-status-example.test.ts`、`tests/engine/gameplay-b-effect-lifecycle.test.ts`。现有场景见 [[ai/guide/examples/gameplay-b-statuses]]、[[ai/guide/examples/gameplay-b-maprun-status]]。

### 5. MapRun Facts、路线与候选池

- **现状**：可执行示例 [[ai/guide/examples/gameplay-b-maprun-fact-gated-pools]] 已说明多项规则，但正式 Wiki 缺少统一的 Fact、门控和读取时点。
- **应写入**：Counter / Flag 的定义和写入边界；候选池读取快照与路线边读取当前事实的区别；内容校验、条件不满足和恢复时需要核对的契约。详细规则须重新对照当前实现与测试，不能直接把示例全部提升为规范。
- **核对入口**：`src/arona-clicker/services/map/map-edge-conditions.ts`、`gameplay-b-hand-resolver.ts`、`src/data-services/registry/registry-validate.ts`；`tests/engine/gameplay-b-maprun-fact-gated-pools.test.ts`。

### 6. 存档、回执与恢复校验

- **现状**：现有总览仅说明 `resumeVersion` 和不兼容拒绝，未解释局内快照、提交记录、随机状态及重放校验的关系。
- **应写入**：哪些状态进入 MapRun 快照、版本检查的范围、恢复如何验证提交记录及失败的影响；不要只罗列内部版本号，也不要推断所有旧回执都适用同一种规则。
- **核对入口**：`src/arona-clicker/services/map/map-run-service.ts`、`map-effect-receipt-validator.ts`；`tests/engine/gameplay-b-map-save-resume.test.ts`、`gameplay-b-map-ag1-restore.test.ts`、`gameplay-b-effect-receipt-boundaries.test.ts`。

### 7. 地图工作区与关系呈现

- **现状**：[[workspace-navigation-and-rendering]] 说明路由与视图，但没有专门解释 Map 工作区中行动、目标、关系与信息流的交互路径。
- **应写入**：只读投影、目标和卡牌选择如何转成命令，实际提交前的预览边界；工作区 DOM 更新、焦点和信息流与运行状态的关系。
- **核对入口**：`src/ui/components/map/map-workspace.ts`、`src/ui/workspace/map-relation-presentation.ts`、`map-relation-interaction.ts`、`src/ui/flow/map-flow-model.ts`；`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`。

## 第二优先：世界地图与进度揭示

### 8. Area Map 与旅行

- **现状**：现行世界与 Workspace 页面提到 Area 和 Area Map，但没有系统说明区域地图定义、导航查询、移动/快速旅行及界面会话。它与上面的 Gameplay B MapRun 是不同主题，不能合并。
- **应写入**：Area Map 与 Area/Spot 的关系、入口和位置来源、普通移动与快速旅行的检查，以及相机 / UI 会话只负责呈现的边界。
- **核对入口**：`src/arona-clicker/services/world/area-map-query.ts`、`src/ui/workspace/area-map-controller.ts`、`area-map-session.ts`；`tests/engine/area-map-travel.test.ts`、`area-map-fast-travel.test.ts`、`tests/ui/area-map-workspace.test.ts`、`tests/data/area-map-registry.test.ts`。

### 9. 信息揭示、里程碑与成就

- **现状**：[[world-and-spots]] 有一段概述，但地图中的 Information Reveal、Milestone 和 Achievement 涉及派生监听、完成状态及视图，尚缺可单独理解的机制解释。
- **应写入**：何时产生 Watch、如何随 Init/内容变化重建、何时重验条件并写入完成事实；里程碑与成就视图的区别，以及恢复与失败边界。
- **核对入口**：`src/arona-clicker/services/world/information-reveal-domain.ts`、`information-reveal-adapter.ts`、`milestone-domain.ts`、`milestone-adapter.ts`、`src/arona-clicker/read-model/achievement-view.ts`；`tests/engine/information-reveal-save-rebuild.test.ts`、`milestone-runtime.test.ts`、`achievement-view.test.ts`。

## 第三优先：扩充现有机制页

### 10. Trigger 运行时注册与内部 Action

- **现状**：[[trigger-mechanism]] 已覆盖普通声明、事件过滤、`once` 和挂载；事件总览只简述内部 runtime action。
- **应补充**：注册 key、token、group、tag、同 key 幂等与冲突、派发中撤回的边界；以及内部 action 如何与普通 `effects` 分流。此内容适合挂在 Trigger 详解下，未必需要再建页面。
- **核对入口**：`src/engine/effect/trigger-system.ts`、`tests/engine/trigger-system.test.ts`、`tests/engine/information-reveal-adapter.test.ts`、`milestone-adapter.test.ts`。

### 11. 主题来源与编辑路径

- **现状**：[[story-chat-and-theme-presentation]] 已给出来源及投影表，但一页同时覆盖聊天、主题选择、临时层、实体表现和两类编辑，细节较密。
- **应补充**：按读者问题区分玩家主题、内容包主题、剧情临时层和实体覆盖；以一个已验证的应用和清理过程解释生命周期；优先从现有页拆分，不复制视觉规范正文。
- **核对入口**：`src/arona-clicker/services/` 下的主题与实体表现服务、`src/ui/controller/controller-theme.ts`；`tests/ui/controller-theme-cleanup.test.ts`、`tests/engine/entity-presentation-service.test.ts`。

### 12. Operation 的当前定位和内容准入

- **现状**：Operation 已有两篇较完整机制页，但总入口未清楚说明内置 Gameplay B 地图包与通用 Operation Runtime 的关系；内容准入目前主要集中在一段概述。
- **应补充**：用当前装配证据明确两条运行路径和内容来源；如作者需要了解校验错误，再按实际合同补充 Event、Action、Profile、Scene 与引用验证，而不是假设地图示例即 Operation 示例。
- **核对入口**：`src/arona-clicker/runtime/runtime.ts`、`src/arona-clicker/services/operation/operation-definition-validation.ts`、`operation-participant-admission.ts`；`tests/engine/operation-runtime-service.test.ts`、`tests/engine/student-operation-runtime.test.ts`。

## 推荐编写顺序

1. **先建立 MapRun 总览**，明确与 Operation、Area Map 和 PlayerState 的关系，并挂入现有总索引。
2. **再写遭遇行动、Effect Program、Status 和 Facts**，以可运行的项目示例与测试说明各自边界。
3. **补 MapRun 保存恢复与 UI 投影**，将长期状态、局内快照和展示层串起来。
4. **补 Area Map、信息揭示 / 里程碑**，然后按实际阅读问题扩展 Trigger、主题和 Operation。

每页至少说明职责、输入与输出、状态归属、运行过程、关键边界、一个经核对的例子以及源码 / 测试入口。只在主题有足够独立内容时拆页；已有作者示例可链接，核心规则由 Wiki 统一解释。

## 本次未执行

本次为只读调查与报告编写，没有改游戏代码、重写现行 Wiki、运行游戏测试或维护 GALHCG 语义图。测试文件作为后续编写和验证入口，不能视为本次测试通过。
