# Task 0361：Reveal 与 Area Map 实施

状态：S1—S7 代码与定向自动化验收完成；S8 的桌面鼠标流程仍待实际确认。创建于 2026-11-06，2026-11-07 续接实施。

承接 [[ai/plan/task-0360-reveal-and-area-map-discussion]]。0360 保留可修订的玩法讨论。本页先记录调查与施工默认建议；用户随后明确授权实施并指定 Reveal / Area Map。下文已更新为实际落点与验收状态；未逐字段裁定的玩法建议仍可后续修订。

## 1. 目标、范围与完成标准

用户需求：从实际游玩出发，分清知识、能力与经历；支持隐藏信息逐渐解开，也支持轻松探索节点在获得地图、达到指定揭示程度后直接前往。已获得地图要成为地图界面的快速切换指引，同图可以混合直达与沿通路探索，避免所有内容采用相同步调。

必须保持：地图已获得不等于图中地点已到访；可以抵达不等于已抵达；可以获取不等于已获取；打开 / 切换地图不移动玩家。实际成功行动才产生经历或持有变化。

首批施工范围：Area、AreaMap 与本地 Node 的知识 / 动作分离，地图收录、导览直达、统一查询、存档生命周期、默认内容与混合示例、游戏内作者 / 导演可编辑闭环。公共代码变动须检查其他调用方，但不顺带重做 Spot 交易、角色获取、全部 RevealStage 或 Gameplay B MapRun。

暂不实施：通用调查 / 宝箱领取系统、路线过程模拟、每条连接的持久发现记录、记忆清除系统、全新地图画布编辑器。0360 关于已知断桥保留等设想继续留作讨论；本 Task 不把全部助手候选一次实现。

最终验收：作者能在游戏内编辑态包创建 / 编辑 / 保存一个混合地图，导演能授予地图或知识；玩家收录后切图、向未到访直达点旅行、逐段探索隐藏支路；保存 / 恢复与内容热变更后语义一致。不能只完成类型或查询而留下作者无法配置的功能。

## 2. 调查基线：当前实现与缺口

核对时间：2026-11-06；调查时 HEAD 为 `623892c`，工作区有其他 Story / Schema / 内容施工改动，因此 HEAD 不是本调查的完整快照。以下以本轮实际文件为准，接手时复核直接相关差异，保留其他人的工作。

| 当前事实 | 源码 / 测试依据 | 对目标的影响 |
| --- | --- | --- |
| `RevealTrigger` 只有 existence / name / condition / utility / unlock；无同目标规则默认通过，多条按 OR | `src/engine/contracts/reveal.ts`、`src/engine/visibility/reveal.ts` | 同一结构混合信息与动作许可，不能直接把所有 unlock 改成知识 |
| AreaMap / Node / 目标的信息都在 `AreaMapQuery.info()` 实时求值；ready 合并图、节点、目标 unlock 与旅行预检 | `src/arona-clicker/services/world/area-map-query.ts` | 知识可能随资源回退；查询不读取持久揭示事实 |
| 信息事实已有 `informationRevealProgress.revealed`，Save 级保留；实体不含地图 / 节点，写入口拒绝 existence / unlock | `src/arona-clicker/types/state.ts`、`state/state-mutation-service.ts`、`services/world/information-reveal-domain.ts` | 可复用知识事实与幂等提交，不能直接向现有 API 塞地图或存在知识 |
| InformationRevealAdapter 只允许其批准的条件提交，不能作为任意剧情授予入口；Watch 只覆盖部分条件 | `services/world/information-reveal-adapter.ts`、`information-reveal-domain.ts` | 显式告知需新的受校验授权来源；不能简单删 validator 放行所有写入 |
| `revealCredit` 实际使用累计产出 stat；`revealResource` 才是当前资源量，当前 stat Watch 可退化为 admission-only | `src/engine/def-factory/reveal.ts`、`services/world/information-reveal-domain.ts` | 转写后需覆盖当前内容实际使用的 stat 唤醒，不能依赖打开 UI 才记录知识 |
| `getAreaReveal()` 将 visited 视为 owned，强制公开全部信息；通用 `resolveReveal()` 也会因 isAccessible 公开全部信息 | `src/ui/components/tooltip/tooltip-reveal.ts`、`tests/engine/entity-reveal.test.ts` | Area 要脱离此阶梯快捷判断，不能用访问记录替代独立知识；不误改其他实体合同 |
| 侧栏集合包含锁定的直接出口，禁用只看 visibility / 剧情；Area Tooltip 用 existence 条件充当解锁条件 | `src/ui/columns/area-navigation.ts`、`components/tooltip/tooltip-detail-area.ts` | 按统一旅行准入显示动作，按独立信息投影显示文字和原因 |
| 旅行只有 adjacent / visited / transit；真实图由静态邻接、Overlay、Affector 连接与交通网络构成 | `services/world/area-travel-routes.ts`、`init-service.ts`、`contracts/runtime/results.ts` | 没有导览直达来源；不得以绘图边或 Story 的 checkAdjacency=false 冒充玩家能力 |
| `travelToArea()` 完整执行目的地进入流程；`enterInit()` 另有默认位置与 visited 初始化路径 | `services/world/init-service.ts` | 新到访知识需同时覆盖首次 Init 起点、实际旅行与恢复；查询 / 开图不能执行这些流程 |
| 地图会话仅保存 UI 浏览历史、相机、选择；没有地图获得、收录列表或从无当前位置地图入口打开图册的能力 | `src/ui/workspace/area-map-session.ts`、`area-map-controller.ts` | 需要持久收录事实与命令；不能保存 UI 会话来冒充图册 |
| AreaMap 有 Registry / 包 / 引用验证与独立编辑器 Schema 表；游戏内作者策略和编辑器种类仅有 Init / Area / Spot / Enhancement | `src/data-services/registry/area-map-validation.ts`、`authoring/content-policies.ts`、`src/ui/runtime-editor/state.ts`、`tools/datapack-editor/schema/editor-extras.ts` | 游戏内 AreaMap CRUD / 导出需补齐；不能把独立编辑器已有表视为游戏内已可编写 |
| Story Operation 使用有限 `StoryStateAction` 命名参数，再转为 Effect；无授予地图 / 知识动作 | `src/data-services/contracts/story-node-actions.ts`、`services/story/story-node-action-host.ts`、`src/ui/story-editor/property-fields.ts` | 导演入口需同步声明、验证、投影、执行、回执与表单，不能只新增 EffectOp |
| 当前版本是 `GAME_SAVE_VERSION = 3.0.0`，存储及 Runtime 恢复拒绝版本不符 | `src/engine/contracts/save-version.ts`、`runtime/runtime-save.ts`、`src/data-services/persistence/storage.ts` | 按项目规范升级版本并执行清档策略，不写旧存档兼容层；本轮不执行清档 |

补充：`EntityPresentationService.entityVisible()` 仍读 Area 的 VisibilityEngine，`buildGameView()` 复制 visibility，`computeRevealFingerprint()` 对 Area 只比较 stage。这些是统一信息后的直接消费者，不能只改地图 SVG。

## 3. 施工默认建议：关键结构与职责

以下给出可执行的推荐基线，字段名可随现有模式微调，改变玩法含义则更新本页说明。目标是完成世界域闭环，不创建第二套通用状态机。

| 结构 / 推荐表达 | 含义与默认 |
| --- | --- |
| 世界信息定义 `reveal` | Area / AreaMap / Node 共用四个独立信息面：existence、name、utility、condition，对应存在、身份、内容、方法；保留英文语义映射，不要求一并重命名全项目 |
| 单项信息规则 | 公共信息、条件达成后记住、仅显式授予三种；省略默认公共。条件规则复用 Condition / ConditionGroup。必须能表达“仅由剧情告知”，不能以缺省门槛意外公开 |
| 独立动作要求 | Area 的 `enterCondition`、Map 的 `openCondition`、Node 的 `actionCondition`；只根据当前状态求值，不因曾满足而永久通过。无条件默认允许；信息是否公开不替代动作要求 |
| 到访揭示 | Area 的 `onVisitReveal` 建议默认 existence + name；作者可改为只知道存在或更多信息。已到访不是自动公开用途与方法的依据 |
| 地图收录规则 | Map 的 `collection` 建议为 onOpen / explicit，缺省 onOpen；explicit 图通过进入效果、物品使用、Trigger 或 Story Operation 授予。真正成功打开且声明 onOpen 才收录，查询、失败开图、编辑预览与剧情重播不收录 |
| 已收录地图事实 | 建议 `collectedAreaMapIds` 属于当前 Init / InitSnapshot，切线保存恢复，重置该 Init 时清空；同一地图可在多个 Init 分别收录，不给 Map 增加 Area 所有权。跨 Init 的图册不是本批默认 |
| 节点移动设定 | 放在旅行 action 内，建议 `travelMode: route / mapDirect`，缺省 route；只对 attemptAreaTravel 有效。直达揭示要求建议 existence，必要时可选 name；不增加一个会被误当信息的 RevealTarget=travel |
| 既有信息事实扩展 | 复用 Save 级 `informationRevealProgress`；世界域增加 existence 知识、areaMap 与 areaMapNode 身份。节点键必须同时包含 mapId 与 nodeId，建议结构化字段，不以 nodeId 单独标识或临时索引标识 |
| 玩家经历 / 持有 | `visitedAreas`、背包、购买 / 领取记录继续由实际动作产生；本批不新建重复的 visitedMapNodes / unlockedDirectNodes / 可领取即已领取 等派生存档 |

生命周期要明确区分：Save 级知识延续既有设计；当前 Init 的图册与到访进度随 Init 保存 / 重置；相机、浏览历史、当前选择只在 UI 会话中。记得地图名字不等于在当前 Init 已获得该地图。定义暂时缺失不删历史事实，查询过滤不可用引用，定义恢复后按当前内容重新验证能力。

旧 `revealTriggers` 暂只在其他尚未重塑的实体保持原合同；世界域新结构通过共用信息规则接入既有知识服务。不要让 Area 同时优先读两份可冲突的 Reveal 定义，也不要为首批交付顺带改写全部交易规则。

## 4. 公开、获得与动作的转写关系

### 4.1 从现有定义转写

这是内容转写，不是存档迁移。实施时逐项改第一方源码、示例、夹具并验证导出；不默默在每次查询时解释两种世界域格式。

| 现有表达 | 推荐转写 | 注意 |
| --- | --- | --- |
| name / utility / condition 的一组 RevealTrigger | 对应信息面的条件记忆规则，多条条件组成 OR；有无条件条目则为公共 | 达成后由写路径记录，不在读取时偷偷写入；原条件树保留 |
| 未声明某信息目标 | 公共规则 | 不把“原本无门槛”改成需要找到新道具 |
| existence 条件 | 对应 existence 知识规则；原来还承担准入的部分分别转入 enterCondition / openCondition / actionCondition | 缺省保留旧行动门槛，信息可记住；含义有意改变的示例单独注明，不把信息条件全部视为世界物理存在 |
| unlock 的多条条件 | 对应动作要求，原同目标 OR 语义保留 | 与旧 existence 准入合并时是 AND(旧 existence OR组, 旧 unlock OR组)，不是把所有叶子拍平成 AND |
| visited 自动全公开 / ready 自动全公开 | 实际到访产生明确的 onVisitReveal 知识；ready 只表示动作能力 | 恢复存档不重复进入、奖励或进入剧情，不在渲染时补经历 |
| navigationMapId | 保留为当前位置推荐图；成功打开普通地图可按 onOpen 收录 | 不把所有 Registry 地图或所有 Init 地图直接视为已获得 |
| 旧旅行节点与候选边 | 缺省 route；静态邻接、Overlay、Affector、交通保留 | 默认基础图不全量改为直达，防止探索节奏整体消失 |
| 旧临时浏览历史 | 仍为 UI 历史；新增图册读取真实收录事实 | 历史记录、可查询地图和已获得地图不是同一个集合 |

基础地图仍由 `base-datapack-source.ts` 生成，先转写内容源，再运行 `npm run datapack:export-base` 同步发布包。`revealCredit` 的累计统计语义必须保留，不能误转为当前余额。第三方旧世界字段需明确诊断与作者升级说明，不通过丢字段假装加载成功。

### 4.2 从作者操作到实际状态

```text
进入 / 剧情 / 导览物品 / 条件达成
  → 已校验的知识授予或地图收录
  → StateMutationService 幂等提交 → 事件与依赖失效
  → 世界信息 / 旅行 / 图册查询 → 地图、侧栏、详情刷新

成功开图命令 → 复核浏览许可 → 按 collection 决定是否收录 → 创建 / 切换 UI 会话
纯 getView / getEntryView / 图册读取 → 只投影，不授予、不移动

点击前往 → 最新领域准入 → 完整目的地进入流程
  → 实际位置与 visited 更新 → onVisitReveal → 进入效果 / 故事 / 统计
```

条件获得与显式授予是两个授权来源：前者必须重新核对条件与观察范围，后者必须核对内容目标、信息面、声明和执行来源，但不能要求自动条件已满足才能让导演告知。保留既有写入口防护，新增受校验的显式授予路径；不能绕过 validator 直接 push。

建议增加两个有限动作：`acquireAreaMap(mapId)` 与 `revealInformation(目标键, 信息面)`。Effect、进入效果、Trigger、Story Operation 最终汇入同一领域写路径；StoryStateAction 保持命名字段，不暴露任意 PlayerState 写入。结构化 Effect 载荷放低层契约，不能从 Engine 反向 import 产品类型。新增动作需完成 receipt / 重复 no-op / 部分失败回执与重播隔离。

## 5. 旅行和公开投影的执行合同

1. 普通 route 保留相邻首次进入、已到访可透传与交通规则。direct 不用 checkAdjacency=false，也不把目标伪装成物理邻接。
2. mapDirect 来源必须来自当前 Init 真正已收录且当前 Registry 有效的地图；节点声明直达、所需知识公开、actionCondition 当前满足，目标为当前 Init 的实际 Area 且其存在已知。目标未到访也允许作为候选；“匿名可前往”指知道有此地但不知道真实名称，不把完全未公开的目标 ID 作为旅行参数泄漏。只有局部线索而目标存在仍未知时，先保留线索，待作者安排存在揭示后再启用旅行。
3. 目标 enterCondition、AlreadyThere、世界线归属和剧情移动阻塞仍统一检查。导览只省略途中移动；它不自动取得钥匙或领取奖励。
4. `openCondition` 只控制浏览，不暗中成为所有旅行的权限。需要同时封锁直达时，写节点 actionCondition 或目标 enterCondition；收录 / 知识不会因暂不可查看而被删除。此处是推荐的权限分工，后续讨论若改变须同步测试。
5. 直达能力与当前是否打开该图无关。`getAreaTravelStatus`、最终命令与侧栏使用同一准入计算；结果新增 mapDirect 方法及可公开的来源说明。多个地图引用同一 Area 时，一个来源失效不删除其他来源或普通路线。
6. 先保留可用普通路线，再以直达作为补充，结果来源稳定；不能先经直达跳到远端，再把远端当作中间点扩展普通路线，从而顺带开放作者未声明的其他目标。
7. 地图节点自己的动作锁只约束该入口，不应被误写成 Area 全局锁。若其他路线仍可前往，应说明不同来源，而不是让同一来源的侧栏、地图和提交互相矛盾。
8. 每批查询只构造一次普通路线与有效直达来源集合。直达解析只读原始声明、知识与条件，不调用 `AreaMapQuery.getView()`；防止 getView → travelQuery → getView 递归，循环开图引用也不能递归展开。
9. 公共视图分别返回存在 / 名称 / 内容 / 方法知识、动作状态与受阻原因、current / visited、旅行方式，不用单个 owned / purchaseable 表达全部状态。存在未知时不泄漏原始目标 ID、真实文字或条件；匿名节点可保留作者明确编写的线索。
10. 方法公开不代表满足；公开条件按图 / 节点 / 目标来源与 AND / OR 层次解释，隐藏原因只给安全概述。标题、Tooltip、相邻标签、Spot 明细数量与 `nameOf` 条件文本也须检查遮挡，不能从原始 Registry 兜底泄漏。
11. 同图移动与开图仍分开：只有实际旅行产生到访和目的地进入事件，跳过的中间点不补 visit / enterEffects。成功旅行可继续关闭地图；失败保留选择、相机和反馈。
12. 首批连线继续采用公开端点 + 作者候选边 + 实际连接，直达不生成虚假物理线；UI 明示“导览直达”，允许无连线而可前往。不在这批引入每边持久知识；已知断桥保留为另一个待议增量。

知识观察建议只覆盖当前 Init 的实体、当前位置入口图与已收录地图；合法预览未收录图时由成功开图命令授权该次观察，不凭全 Registry 遍历发现所有秘密。节点知识可知不等于目标身份可知，本地线索不得自动授予目标全部信息。

## 6. 必须触达的文件与转写落点

以下文件表记录调查时定位的直接影响范围；“调查时状态”列保留原始施工前快照，实际改动与当前验收结果见第 9 节。文件表用于定位，不是修改白名单。

| 路径 / 文件组 | 当前用途与施工落点 | 调查时状态 |
| --- | --- | --- |
| `src/engine/contracts/reveal.ts`、`src/data-services/contracts/world.ts`、`src/data-services/contracts/area-map.ts` | 声明信息规则 / 目标身份、世界动作要求、收录与节点移动设定；保持其他实体兼容边界清楚 | 已核对，待改 |
| `src/arona-clicker/types/state.ts`、`state/state-factory.ts`、`state/per-init-fields.ts`、`state/state-mutation-service.ts`、`contracts/runtime/mutation.ts` | 知识键、收录事实与生命周期、幂等授予 / 到访写入口；本次触及的 Area 直接写状态应收束到 mutation，而不是复制旧写法 | 已核对，待改 |
| `src/arona-clicker/services/world/information-reveal-domain.ts`、`information-reveal-adapter.ts` | 复用知识查询与 Watch，增加世界存在知识、地图 / 节点、显式授予与完整唤醒 | 已核对，待改 |
| `src/engine/expression/condition-system.ts`、`condition-deps.ts`、`src/engine/contracts/state-query.ts`、`src/arona-clicker/contracts/runtime/event-catalog.ts` | 增加地图已收录条件的最小读取面与变化事件；知识 / 收录提交驱动重算，stat 等不能只依赖 Init 准入 | 已核对，待改 |
| `src/arona-clicker/services/world/area-travel-routes.ts`、`init-service.ts`、`area-map-query.ts`、`contracts/world/area-map-query.ts`、`contracts/runtime/results.ts` | 旅行来源集合、统一准入、信息遮挡与图册查询；保留完整进入流程 | 已核对，待改 |
| `src/arona-clicker/runtime/runtime-game-instance.ts`、`runtime-wiring.ts`、`runtime-commands.ts`、`contracts/runtime/runtime.ts`、`read-model/game-view-builder.ts` | 装配纯查询 / 命令，接入生命周期；Area visibility 不得成为第二套通行真相 | 已核对，待改 |
| `src/arona-clicker/services/presentation/entity-presentation-service.ts`、`src/ui/components/tooltip/tooltip-reveal.ts`、`tooltip-detail-area.ts`、`src/ui/columns/area-navigation.ts`、`src/ui/controller/controller-core.ts` | Area 展示统一消费知识 / 能力结果，移除 visited 全公开与 existence=锁定假设，补刷新指纹与表现遮挡 | 已核对，待改 |
| `src/ui/components/map/area-map-workspace.ts`、`src/ui/workspace/area-map-controller.ts`、`area-map-session.ts`、`area-map-dom.ts`、`src/ui/controller/controller-events.ts` | 图册入口 / 快速切图、开图命令、收录事件刷新、失效回退、保持局部更新与临时相机 | 已核对，待改 |
| `src/data-services/registry/area-map-validation.ts`、`registry.ts`、`runtime-content-reference-rules.ts`、`authoring/content-policies.ts`、`content-policy-dsl.ts` | 严格校验新字段、复合节点引用、条件 / Effect 引用，加入 AreaMap 作者策略；热提交失败不可留下半图 | 已核对，待改 |
| `src/arona-clicker/contracts/runtime/runtime-content.ts`、`services/world/runtime-world-content-coordinator.ts`、`src/ui/runtime-editor/` | 扩充地图草稿 / 表单 / 暂存 / 保存 / 删除 / 包导出，Area 新字段往返无损；复用现有包归属和提交策略 | 已核对，待改 |
| `src/engine/types/expression.ts`、`src/arona-clicker/state/effect-ops.ts`、`contracts/runtime/effect-mutation.ts`、`src/data-services/contracts/story-node-actions.ts`、`services/story/story-node-action-host.ts`、`src/ui/story-editor/property-fields.ts` | 地图 / 知识获得动作与导演命名字段，前置校验、执行、回执、引用投影和隔离重播配套 | 已核对，待改 |
| `src/engine/contracts/save-version.ts`、`src/arona-clicker/runtime/runtime-save.ts`、`runtime-save-codec.ts`、`src/data-services/persistence/storage.ts` | 新格式版本、收录快照和恢复重建；拒绝旧格式，不增加兼容迁移 | 已核对，待改 |
| `src/arona-clicker/content/base-datapack-source.ts`、`content/world/areas.ts`、`content/def-factory/area.ts`、`src/engine/def-factory/reveal.ts`、`src/ui/development/area-map-demo/content.json`、`scripts/gen-engine-schema.mjs` | 第一方定义与示例转写、生成工具核对；发布包与 Schema 走现有生成命令 | 已核对，待改 |
| `tools/datapack-editor/schema/editor-extras.ts`、`tools/datapack-editor/schema/engine-schema.sync.test.ts` | 源契约变化后的必要协议同步；不是将用户的“编辑器”需求转移到独立工具施工 | 已核对，待改 |

## 7. 可执行施工顺序与阶段验收

每项先补能识别语义错误的行为测试，再完成实现与直接调用方。依次推进，不要求为阶段另建 Task 或并行 Agent；后续负责人可按自身交付方式安排。

- [x] **S1 契约与内容转写。** 新增 WorldInformation 四面规则、Area / AreaMap / Node 动作与引用校验；世界地图已从旧 Reveal 字段转写。Schema 生成和 Base Datapack 导出已运行。
- [x] **S2 事实、授权与生命周期。** 信息事实为 Save 级；地图收录和 `hasAreaMap` 为 Init 级。到访、开图、显式授权走受保护写路径；版本升级至 3.1.0，无旧档迁移。
- [x] **S3 知识观察与统一查询。** Area、Map、Node 使用共同信息查询和依赖唤醒；已知知识保留、动作门槛按当前状态重算；覆盖资源、统计、收录及热替换回归。
- [x] **S4 导览直达旅行。** 普通路线与已收录地图的显式直达来源合并；命令复核目标 Init、Area 门槛、剧情锁和最新状态；直达结果不扩成普通中转路线。
- [x] **S5 玩家地图 / 侧栏闭环。** 地图册入口、索引切图、不可用条目、动作 / 信息遮挡和会话热刷新已接入；切图不移动。
- [x] **S6 数据包作者与导演闭环。** Runtime Editor 已支持 AreaMap CRUD、收录选择与节点 / 条件 JSON 集合、草稿、保存、热应用和导出；Story Editor 支持收录地图与授予显式信息，Schema 保留可编辑 JSON 合同。
- [x] **S7 混合示例与节奏。** Demo 包含剧情授予的 explicit 导览、未到访直达、匿名目标、条件隐藏支路、沿路商铺探索和门禁；首访山间观测站授予通行许可以便继续探索；基础地图仍使用 route。
- [ ] **S8 整合与交接收尾。** 机制文档、索引、定向自动化与静态检查、GALHCG 只读复核已完成。实际桌面鼠标流程仍待手工确认；不将自动化结果写成视觉验收通过。

编辑器落地建议：先用现有集合表单维护节点 / 条件 / 坐标，不为此建立新画布；开图获得是命令语义，表单预览只读。若 Runtime Editor 采用包级保存 / 重载而非局部物化，应沿既有能力描述显式标明，仍需保证引用校验、失败保护和生效后刷新，不能静默降级为只能手改 JSON。

## 8. 行为验收矩阵

| 编号 | 输入 / 操作 | 预期结果 |
| --- | --- | --- |
| A1 | 只查询地图、图册、旅行预检；失败开图 | PlayerState、visited、奖励及事件不变化，不收录 |
| A2 | 普通地图首次合法打开；explicit 地图仅预览；导演授予 explicit 地图 | 仅 onOpen 成功开图和有效授予收录；重复授予 no-op；列表立即刷新，地点仍未到访 |
| A3 | 已收录图中的直达点无普通路径且未到访 | 预检 / 地图 / 侧栏可用，标记未到访；点击后只目的地更新 visited 与进入效果 |
| A4 | 同图普通探索点、存在已知但名称未知的直达点、隐藏支路 | route 不因同图其他直达能力获放行；匿名可直达不要求名称；仅有线索但目标存在未知时不公开旅行目标，隐藏支路不泄漏目标与条件 |
| A5 | 知识条件一度满足后资源降低；满足可进入条件但未行动 | 已学知识保留，当前能力可回退；未行动不产生到访 / 持有 / 领取事实 |
| A6 | 初始 Area 与首次旅行；作者只授予存在 / 名称 | 分别执行实际到访规则，不自动公开用途 / 方法；恢复不重播进入效果或奖励 |
| A7 | 当前图没有浏览许可、目标缺钥匙、剧情阻塞、跨 Init | 浏览与旅行按各自要求拒绝，反馈不混同；已收录事实不被删除，直达不能越过目标门槛 |
| A8 | 同一 Area 被多图引用，一处来源撤销 / 节点热替换 | 正常路线或其他有效来源保留；旧视图先刷新，最终命令重新检查，无幽灵直达 |
| A9 | 直达后远端存在未声明的其他邻接点；循环 / 自引用开图 | 不把直达候选当普通 BFS 中转，额外地点仍不可达；查询无递归爆炸 |
| A10 | 获得地图后切图 / 返回 / 重开；当前 Area 无入口图 | 从图册进入，只有浏览状态变化；选择与相机生命周期清楚，不改实际位置 |
| A11 | 切换 Init、重置 Init、存读档；暂时禁用含地图的包再恢复 | 图册按 per-Init 合同恢复 / 清空，知识按 Save 合同保留；不可用定义过滤但不误删历史；UI 旧会话释放 |
| A12 | 合法 / 非法地图与节点键、外包引用、条件 / 新动作、OR 条件、旧字段 | 校验明确；非法输入不半提交，未知字段不静默丢弃，循环地图合法但局部节点不升级为全局实体 |
| A13 | Runtime Editor 创建 → 修改 → 删除 / 撤销 → 保存包 → 导出导入 | 新字段、地图与节点引用无损，受引用删除按现有保护处理；失败保留原有效定义与草稿 |
| A14 | Story Operation 授予知识 / 地图；重复执行、隔离试播、重播、失败 | 正式动作幂等并有真实回执；预览 / 重播不污染真实存档，失败不显示已获得 |
| A15 | 渲染地图、侧栏、Hero、Tooltip、条件方法文本及表现变体 | 读取同一知识结果；真实身份 / 描述 / 数量不经原始 nameOf 等旁路泄漏，局部线索不替代目标知识 |
| A16 | 旧格式存档导入 / 恢复、新格式保存恢复 | 旧版本明确拒绝且不破坏当前运行态；新版本恢复事实并重建监听 / 派生，不编写兼容迁移 |

基线中 `tests/engine/entity-reveal.test.ts` 的 Area owned 断言及部分“条件回退节点重新隐藏”的测试会随新语义调整；保留其他实体的原测试。不要把所有失败统一改期望，先判定属于刻意变更还是回归。

## 9. 验证入口与本轮实际结果

本轮已运行：

- 核心数据 / 引擎回归：19 文件、156 项通过；地图 UI、Runtime Editor 与 Schema 同步：5 文件、55 项通过；收尾复核：6 文件、77 项通过。
- 扩展回归覆盖了 30 个文件、282 项通过；`tests/ui/story-editor-properties.test.ts` 的 29 项完整文件在收集阶段触发 Node.js 约 4 GB heap OOM，未执行。该文件中地图收录作者表单的定向用例已单独通过；不能把 OOM 记为通过。
- 新增演示流程校验后，`tests/data/area-map-demo.test.ts`、`tests/engine/area-map-fast-travel.test.ts`、`tests/ui/area-map-controller.test.ts`：3 文件、22 项通过。Area C 首访现在实际授予通行许可，玩家可先观察锁定 / 隐藏状态，再经常规路线进入观测站并开放支路。
- `npm run gen:schema`（无生成差异）、`npm run datapack:export-base`、`npm run check:docs`、`npm run check:architecture` 与 `git diff --check` 通过。
- `npx tsc --noEmit` 仍报告 8 个 `tests/prototypes/infinite-board.test.ts` 的旧原型 API / fixture 错误；本 Task 未触及原型板，当前错误与此前记录一致。
- 浏览器自动验收未执行：桌面控制无法可靠判定 Edge 当前页面 URL，恢复一次后仍失败并停止 UI 操作。未将自动化 DOM 用例写成实际视觉通过。
- GALHCG `changed` 只读复核覆盖了本次核心文件：`information-reveal-domain.ts`、Runtime Editor state 与 Story property fields 返回 `content_changed` 且 Evidence 基线陈旧；其余所查文件没有直接 Evidence / `maps_to`。没有改图、刷新或写 freshness；图谱维护不在本轮授权内。

上述测试覆盖收录 / 显式授予、地图切换不移动、直达前匿名、条件揭示和准入回退、Init 与 Save 生命周期、热内容失效、Story / Runtime Editor 作者路径以及 Schema。完整测试日志由入口写入 `.test-artifacts/latest.log`。阶段结果不是所有文件均可通过一次全量进程的证据，尤其 Story 属性编辑器完整文件需要后续用更多 Node heap 或更窄拆分方式复验。

## 10. 接手说明与未裁定事项

- **推荐基线可执行，但仍可改。** per-Init 图册、缺省 onOpen、直达缺省 existence 揭示、到访缺省只认识存在 / 名称、openCondition 只管浏览，都是本页为便于施工提出的默认建议，不是用户逐项确认的裁定。若后续指令不同，先更新第 3—5 节，再同步实现和验收；不要将 0360 的开放讨论当成全部已批准。
- Story、Schema、引用规则与基础包和其他在飞改动重叠；本次沿当前工作区接续，未回滚历史或扩大到 Spot 交易、角色获取、Gameplay B MapRun 等旁支。基础包与 Schema 只经现有生成流程更新。
- **需要桌面手工确认。** 在开发服务器运行时打开 `http://localhost:5173/src/ui/index.html?areaMapDemo=1`：从“事务所”到“中央广场”并完成抵达剧情，确认剧情收录“郊外导览”；在“图册”切图并确认当前位置不变；通过“商场地图”进入商场入口后打开“一楼内部图”，选择“无名休息点”，确认显示“尚未到访 / 导览直达”且不泄漏真实 Area 名，前往后才显示到访与真实名字；在“山间导览”先确认许可不足时支路隐藏、锁定节点不可操作，再从城区常规路线到“山间观测站”领取通行许可并检查支路出现、可进入；返回图册切图、在应用内保存 / 恢复，确认地图收录、知识与当前位置符合各自生命周期。该演示使用临时内存存档，不写入普通存档。
- **作者与导演手工确认。** 在常规游戏工作页（不要使用上面的临时演示页）打开 Runtime Editor，新建一个同时含 route 与 mapDirect 节点的 AreaMap，保存 / 热应用 / 导出后确认字段往返；在 Story Editor 添加 `acquireAreaMap` 或 `revealInformation` Operation，运行一次后确认对应图册或知识更新，重复播放 / 试播不污染正式状态。
- 桌面鼠标确认与 Story Editor 完整属性测试仍未完成。上一轮完整 Story 属性测试因测试进程 heap OOM 未执行；定向表单测试与相关 Story projection / host 用例已通过。若应用内手工路径发现问题，应先更新上述默认建议与实际效果，再决定是否扩大修复范围。
