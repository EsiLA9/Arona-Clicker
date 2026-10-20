# Task 0300：Gameplay B 可复用卡牌宿主与对象交互基础层

状态：completed — P0—P3 核心切片与 P6 地点卡选择 / Click 提交已实施；地点卡宿主与提交入口按负责人 2026-10-19 的后续要求完成修订。P4 多目标与 P5 作用线按本文定义保留为独立后续阶段，不阻塞本 Task 完成。

## 目标

以后任何 Gameplay B 界面显示一张真实参与本轮 MapRun / Encounter 的卡牌时，只需提供领域引用、视觉实例和入口声明，就能复用现有查看关系、目标高亮、点击及拖拽能力。MapRun 决定游戏规则；宿主决定在哪里显示、提供哪些入口；一个 Workspace 内的一份交互状态协调所有可见副本。

本 Task 交付 Map 单位卡、悬挂行为卡、替换候选浮层和首个 Flow 真实玩法卡的共用接入路径。它是小范围整理与一个跨宿主竖切片，不建设跨游戏通用卡牌引擎。未来宿主能沿同一路径接入，但不承诺无需领域开发就能增加新玩法。

基础层还必须能够承接已明确的后续例子：将地点选择从直接移动的按钮改为 Talklet 内的固定尺寸卡牌，选定地点后用 Map Workspace 现有 Click 入口提交。该功能必须基于本 Task 的宿主、身份绑定和交互机制实现；地点是 MapRun 地图对象，不因此成为 Encounter 行动牌或战斗目标。具体边界见 P6。

## 来源、范围与前序关系

- 需求来源：负责人于 2026-10-19 提供的 SolChat 编写指导，以及“统一、简单的卡牌放置宿主 / 卡牌作用对象工具”的补充。本文件将建议收敛为待审阅方案，不把建议写成现行机制。
- 唯一目标为新版 MapRun / Encounter；旧 Operation / EventRun 不迁入本基础层。
- 复用 [[docs/plan-work/archive/task-0296-gameplay-b-shared-talklet-flow]] 的 Flow reducer、渲染、滚动及回收；复用 [[docs/plan-work/archive/task-0297-gameplay-b-unified-unit-cards]] 的 UnitFace、悬挂牌和替换 Popover。
- 承接 [[docs/plan-work/archive/task-0298-gameplay-b-relations-hover-and-target-interaction]] 已有领域身份、卡牌目标和交互；本 Task 专门负责跨宿主接入。0298 剩余的 Flow 卡相关工作与本 Task 交叉时，由本 Task 的切片统一实施、回填证据，不两边各造一套实现；不在此宣称 0298 全部完成，也不改其保留的单位相对规则。
- [[docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy]] 正在修改默认目标、无目标跳过和费用；本 Task 不覆盖这些规则。其 U9 与 0291 U4 的 View / Workspace 写集仍需在施工前复核。仅暂停真实重叠的切片，不要求所有前序任务先结项。
- 调查开始时已有未提交产品与测试改动；2026-10-19 负责人确认工作树中的旧 Gameplay B Operation、原型与 demo 移除由本人完成。施工按移除后的当前结构重新核对基线，不以旧 Task 开头摘要代替当前源码；未主动回滚该移除范围。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `MapRunCardRef` 带 run/map/node/activity/round scope；Owner 目录生成 Hand、已选 PlayerCommand 和存活敌方意图对象。Swap 不创建新牌，未选指令候选没有真实卡牌身份。 | `src/arona-clicker/contracts/map-cards.ts`；`services/map-card-catalog.ts:catalogMapRunCards`；`tests/engine/gameplay-b-map-cards.test.ts` 的目录、Swap 与 Save/Resume 用例 | 保留真实引用与逻辑顺序；视觉副本、候选 offer 不产生领域对象。 |
| 只读查询已提供 `getCards`、`resolveCardReference`、Workspace 的 `cards / relations`；命令已有单位 / 敌方 / 卡牌目标入口。 | `src/arona-clicker/contracts/runtime.ts:MapRunQuery`；`runtime-game-instance.ts` 的 query 组装与 `setMapPreparedCardTarget`；`services/map-run-service.ts` | 不增第二目录或 Owner；命令仍走 Controller → GameCommands → MapRun。 |
| `MapActionRelation` 已区分 performer、selectedTarget、candidates、effectRecipients、source kind、权限和 draft；当前选择与命令主要是单目标。 | `contracts/map-relations.ts`；`services/map-relation-projector.ts:projectMapRelations`；`tests/engine/gameplay-b-map-relations.test.ts` | 保留选择目标与效果受用方的区别；单目标投影不冒称多目标机制。 |
| 卡牌目标目前针对有 Actor sCost 的真实卡牌；实际效果只有 `scostDiscount`，在 Commit 计划中减免本轮实际执行牌的费用。 | `services/gameplay-b-action-preview-resolver.ts` 的目录过滤；`services/map-card-effects.ts:resolveMapCardEffects`；`tests/engine/gameplay-b-map-cards.test.ts` | 本 Task 的 Flow 示例直接使用现有协同演练，不借机扩展效果体系。 |
| Controller 已有唯一 `mapRelations`，绑定应用 root，通过当前 Map route 查询关系并转发目标命令。 | `src/ui/controller.ts` 构造器、`disposeMapFlow`、Map 局部刷新后的 `reconcile` | 保留实例与生命周期；Map、Flow、Popover 不各建一个状态机。 |
| `MapRelationInteraction` 已有 Hover/Focus、固定、替换预览、编辑锁、6px 拖拽、合法候选命中、尾随 click 抑制、版本取消和 dispose。 | `src/ui/workspace/map-relation-interaction.ts`；`tests/ui/map-relation-interaction.test.ts` | 提取接入约定，不重写优先级和指针流程。 |
| 高亮已按 Object Key 更新所有副本，来源与受用角色可以共存；事件命中仍依赖 Map 专用 selector，缺少逐视觉实例的入口限制。 | `map-relation-presentation.ts:presentMapRelations`；交互类的 `face/targetAt/beginEdit`；`tests/ui/map-relation-presentation.test.ts` | “同对象多副本”已有基础，真正缺口是绑定与入口能力，不是再造 Hover。 |
| `cardAttributes` 现在按 owner/action 查询目录；当前准备牌另挂 Relation Key。未选 Hand 与 Hand 外指令候选都在替换层，但两者领域身份不同。 | `src/ui/components/map-workspace.ts:cardAttributes/renderActivePartyMember` | 将绑定从具体卡面拼接中收敛；不可按 actionId 或候选按钮数量生成身份。 |
| Flow 有 streamKey、instanceKey、contentId、current/observed，已有 actions 和 Map 专用 DTO，但没有真实玩法卡载荷；marks 只是转义后的呈现属性。 | `src/ui/flow/flow-entry.ts`、`map-flow-model.ts`、`flow-render.ts`；`components/story.ts:renderChatEntry`；`tests/ui/flow-entry.test.ts`、`map-flow-adapter.test.ts` | 加一个受控玩法卡载荷即可；marks、文本和普通 Talklet 不授予命令资格。 |
| DOM 协调先用 Flow entry key，再用 focus/region key；删除前清理相关浮层，滚动独立由 FlowScroll 管理。 | `src/ui/workspace/map-dom-updates.ts:patchMapDOM`；`src/ui/flow/flow-scroll.ts`；`tests/ui/map-dom-updates.test.ts` | 卡牌实例键接入现有协调与焦点，不替换 Flow 身份、滚动或 Dispatcher。 |

前序 Task 中“尚无卡牌目标”“sCost 未投影”等早期事实已被后续代码局部替代；0298 的后续 Receipt 和本次源码核实覆盖这些部分，不能照抄早期摘要。测试文件的存在不等于本次运行通过，实跑结果单列于文末。

## 最小结构与职责

```text
MapRun / Resolver → 当前 cards、relations、draft 与合法候选
                              ↓ 只读
Map / Popover / Flow → 共用卡牌绑定 → 唯一 MapRelationInteraction
                              ↓ 操作意图
                    Controller / GameCommands → MapRun 校验并写草稿
                              ↓
                    原有 Dispatcher / region patch → reconcile
```

### 领域 Owner

继续拥有真实对象、行动准备、合法目标、规则权限、费用、随机流、版本与 Commit。UI 从当前可信查询取得引用；`resolveCardReference` 查不到的对象不得当作当前牌操作。命令拒绝 stale、跨 Run、跨回合、非法对象和无权限修改；任何宿主都不能提交自带效果或 Resolution。

本 Task 不新增长期状态或 checkpoint 字段。Object Key 是引用的序列化键，不是凭证；关系投影只提供当前许可，实际写入仍由 Owner 再校验。UI 的只读限制用于限制入口，不能被误写成 Owner 已具备“判断 DOM 来源”的权限机制。

### 交互服务

保留 `MapRelationInteraction` 名称和既有优先级：目标编辑 / 拖拽 → 已打开替换层 → 固定关系 → Hover / Focus。统一处理入口、取消、候选命中和同对象副本高亮；不按宿主拆分当前 source、pin 或 drag。

将构造器改为 Options 对象，必需项仅为 `root`、`query`、`sendIntent`；`previewReplacement` 按当前需求保留可选。`query` 提供当前 scope、版本及关系；`sendIntent` 由 Controller 适配现有命令，不让交互层持有 GameInstance 写引用。意图携带来源视觉实例、Relation Key、draft 及目标引用；第一版只发送现有单目标确认，不新增任意字符串命令总线。

第一步将唯一产品调用方与相关测试同步迁为 Options，保留命令语义即可；不维护长期位置参数重载。浮层定位、滚动、线层不先加入一串空回调；存在真实使用点时再增加可选能力。

### Card Host

宿主是“已有容器 + 绑定约定”，首版无需 Host 基类、插件注册中心或新布局系统。拟在 UI 层新增一个小的 binding/helper 模块，例如在 `src/ui/cards/`（拟新增目录）中建立 `card-host.ts`：统一生成 / 读取经过转义的身份与入口标记，避免每个 renderer 再拼 selector 和 key。只有确有两处重复卡面时才提取小的 card-face renderer；不强制单位面、行为牌与 Talklet 使用同一种外框。

绑定最小内容：宿主内稳定 `instanceKey`、当前 `MapTargetRef`（如有）、可选 Relation Key、表示真实对象 / 替换候选 / 历史展示的用途、少量入口集合。入口只包含实际需要的查看、修改目标、替换行动、作为目标命中；不是一颗 `interactive: true` 开关。替换候选另带已有合法 option 引用，不伪装成当前 source。

这里的“宿主绑定”不要求所有卡形对象都实现 `MapRunCardRef` 或战斗 `MapTargetRef`。地点选择接入时，以窄的地点选择适配提供真实 Node 引用、选中与确认意图，复用共用实例定位、Hover/Focus、选中反馈和生命周期；不强造战斗 Relation Key，也不为此把核心接口扩大为任意业务命令系统。

先覆盖一个 Map Workspace DOM 子树：Popover 即使进入浏览器 top layer，仍保留原 DOM 归属并使用同一委托。未来真正出现子树外 portal 时再增加显式挂载 / 卸载入口，不提前扫描 document 或监听所有窗口。

## 三种身份及权限组合

| 身份 | 现有落点与使用方式 | 禁止替代 |
| --- | --- | --- |
| Object Key | 保留 `data-map-object-key`，由领域 `MapTargetRef` 经统一 helper 生成；单位与牌种类及完整 scope 均进入 key。 | actionId、文本、Flow contentId、DOM 序号。 |
| Relation Key | 保留 `data-map-relation-key`，来自当前投影的 `relation.key`，描述准备行为 / 关系；只在该对象确实对应当前 source 时关联。 | 将同角色所有候选都挂成同一当前 source，或把目标 key 当关系 key。 |
| Instance Key | 宿主标识 + 宿主内稳定槽位 + 对象引用构成；新增一致的卡牌实例标记，衔接已有 focus/region key。Flow 牌用 streamKey + entry.instanceKey + 卡槽区分多个实例。 | 作为领域 ID，或复用相同 HTML id / focus key 给所有副本。 |

一张卡既可发出关系 A，又可接收关系 B；两种高亮标记可以同时存在。当前 source 的所有可见副本共享同一个 Relation Key，目标副本通过 Object Key 共同高亮。备选 Hand 牌仍是目录中的原对象，但只有被准备时才成为该准备关系的 source；Hand 外 PlayerCommand offer 在实际选择前没有 Object Key。

| 实例用途 | 查看当前关系 | 从该实例修改 / 换牌 | 编辑其他 source 时命中为目标 |
| --- | --- | --- | --- |
| 当前 Map 准备牌 | 允许 | 宿主提供入口且领域允许时 | 本身为领域合法候选时 |
| Flow 当前真实牌的只读副本 | 允许 | 禁止 | 宿主明确提供目标命中且领域允许时 |
| 替换层现有 Hand 牌 / 未选指令 offer | 查看已有替换预览 | 只允许已有替换意图，不默认编辑准备目标 | 首版沿既有 Popover 关闭 / 编辑互斥规则；不借候选层新增目标命中入口 |
| 历史战报、过期牌、普通卡形按钮 | 历史文案 / 普通 UI 行为 | 禁止玩法命令 | 禁止 |

有效操作同时满足：当前 route/scope 与 draft 有效、Owner 允许该动作、该视觉实例提供对应入口、操作引用仍在当前查询中。入口只收窄领域能力。普通 Flow marks 即使带相同 Object Key 也不满足真实卡载荷与实例绑定，不得由通用属性白名单绕过。新增的卡牌绑定 / 入口标记保留给类型化卡牌 renderer，通用 marks 输出过滤这些保留标记；已有移动等 Flow action 标记继续使用原路径。交互层所有新旧入口都统一通过绑定检查，不能残留绕过限制的旧 selector 分支。

“只读副本”默认表示不能从它发起修改；是否能作为别人的目标单独声明。严格只展示实例则同时关闭目标命中。点击只读副本不会自动跳转到另一个可操作副本发命令。

## 真实行动例子与 Flow 的最小接入

使用已有 `gameplay-b:map:scost-training`（卡牌协同演练），不新增卡组规则。通过现有 Swap 明确准备白子的 `planning`（战术筹划）与芹香的 `rifle-shot`（精确射击），不假定随机 Hand 首张恰好为该牌。

1. 芹香的真实 Hand 牌在单位右下和当前 Flow Talklet 内各显示一次。两处引用同一 `MapRunCardRef`，有不同 Instance Key；Flow reducer 不制造第二张牌。
2. Hover 白子的筹划，两处射击副本同时呈现相同目标 / 候选角色。Hover Flow 射击可查看其真实射击关系；它没有换牌和修改目标入口。
3. 从白子 Map 卡开始目标编辑，点击或拖到 Flow 中的射击副本，交互服务按 Owner candidates 找到该引用，Controller 只调用一次 `setMapPreparedCardTarget`。草稿更新后两处一致；RNG、余额、round 均不变化。
4. 只按原 Commit 按钮才实际执行减免。若精确射击本轮执行，原费 2、减免 1、实扣 1；目标若改为未执行 Hand 牌，减免不能转移给另一张准备牌。使用现有费用测试保障此规则。
5. Flow 条目按同 contentId 回收后，仅删除视觉实例；Map 中的牌、Owner 目录与草稿不变。下一轮旧引用失效，历史文案可以保留，但不得重新绑定成新一轮同 actionId 的牌。

Flow 只增加一个类型化、可选的当前玩法卡载荷，放在已有纯 UI Flow DTO 内，由 Map adapter 从当前 Workspace `cards / relations` 构造，渲染通过现有 `renderFlowEntry → renderChatEntry` 接入小的卡面 helper。保留普通 Talklet 的文本、图片、actions 与共享外框；不开放任意 HTML、全业务 widget 插槽或作者 GameCommand 字段。

后续宿主的接入操作应收敛为三件事：从当前 View 取真实引用与展示内容；提供自己的稳定 Instance Key 和入口集合；用共用绑定 / 卡面 helper 放进现有容器。它不实例化新交互服务、不注册新领域牌、不重新实现目标按钮和拖拽算法。新增卡形普通按钮可以完全不提供领域绑定。

首个产品入口为协同演练活动中的一个“当前准备牌”Talklet，随当前 View 原位协调；对应普通地图不强制增加整套卡牌信息流。当前玩法卡条目是 `current`，不能被回执 `observed` 当作可操作来源。历史卡仅保存显示所需快照，移除 live binding。UI 查询失败时清空当前玩法绑定，不凭缓存身份继续操作。

## 生命周期、命中与一次命令

- 一次输入只归一个处理方。交互层确认目标时消耗事件；其余换牌按钮继续交给现有 Controller 委托。拖拽结束抑制尾随 click，键盘 Enter/Space 与指针不得重复发命令。
- 开始编辑时记录来源 Instance Key、Relation Key 与版本；只读 source 不得触发编辑。target hit 需要目标实例入口和 Owner candidate 同时命中；只读目标副本不因此取得 source 权限。
- Flow 回收 / DOM patch 后复用现有 `reconcile`。Hover/Focus 的节点移除就清理；拖拽来源被移除则取消、移除 ghost 并释放 capture；目标副本移除后重新命中，不能确认旧节点。同一对象还有其他副本不意味着删除领域对象。
- pin 以仍有效的关系为准；来源关系失效即清除。scope、draft、route、load、离开 Run 与 dispose 沿既有 reset 路径取消过期交互。只移除一个副本时，其余副本关系继续有效；焦点按现有稳定槽位回退，不强制滚到另一个副本。
- 旋转、堆叠、展开与滚动只影响视觉实例和命中位置。使用真实指针命中与 `elementFromPoint`，ghost 不参与命中；逻辑次序、资格和自动目标完全取自领域。行为更新不结构重建三栏。

## 施工切片与直接结果

本轮已按 [[docs/ai/PROJECT-CONSTITUTION]] 将 P0—P3 与 P6 拆为 10 个 Patch Unit，写入同级 `task-0300-units/`，各自带 Read Set、Allowed Files、行为验收、停止条件与 Receipt。P4 / P5 未启动，需各自有真实用例与施工白名单。

| 阶段 | 最小改动与候选落点 | 可独立验证的结果 |
| --- | --- | --- |
| P0：基线与接口整理 | `map-relation-interaction.ts`、`controller.ts`、对应交互测试；迁 Options，保留一份 session 与已有命令适配。 | Map Hover/Focus、pin、Popover、拖拽、取消、stale 和独立 Commit 保持；不依赖 Flow 或连线。 |
| P1a：共用绑定 | 新 UI card-host helper、`map-workspace.ts`、必要的 DOM key 接入及组件测试；将真实对象 / offer 与三个 key 分开。 | 同对象多实例不混淆；Hand offer 不造牌；旋转、Swap 与 DOM 更新保持原对象身份。 |
| P1b：入口与事件收敛 | 交互类、呈现 helper、Controller 及对应测试；统一解析绑定和检查逐实例入口。 | 一个可编辑副本和一个只读副本共存；一个物理输入至多一个命令；已有替换预览仍不写 Run。 |
| P2a：Flow 当前卡投影与渲染 | `flow-entry.ts`、`map-flow-model.ts`、共用渲染分派、card-face helper 与 adapter/renderer 测试；按 Unit 预算进一步拆分。 | 协同演练 Flow 出现一张来自 Owner 的真实牌，普通 Chat/Story 不变；只读 / 目标命中入口明确。 |
| P2b：跨宿主真实交互 | 既有 Controller refresh、Flow/Map DOM 协调及集成测试；补删除范围清理，复用 FlowScroll。 | Map 筹划可选 Flow 射击为真实目标；两处高亮一致；回收不删领域牌；Save/Resume 和新轮正确处理引用。 |
| P3：回归与桌面验收 | 定向 engine/UI 测试、必要的稳定机制文档更新与 Receipt；不修无关旧 Operation 失败。 | 完成本 Task 下方验收矩阵，并记录未运行与失败归属。证明关闭任何连线仍可操作。 |

顺序为 P0 → P1a/P1b → P2a/P2b → P3。相邻切片可以复用相同源码，但每个 Unit 都应独立验证；不能为了少写 Unit 一次重写 Controller / renderer。

### P4 后续：按真实需求增加多目标 / 分步骤选择

本次不改 Owner 单目标合同。保留 `selectedTarget / candidates` 的现有事实；基础层的角色绘制可接收多个引用，单目标适配为零或一个，避免 UI 把目标数量写死在命中 / 高亮流程中。这个表现适配不能宣称已支持多目标提交。

当真实 Action 获准需要多选时，先在独立领域切片定义数量、顺序、重复规则、默认策略、部分完成与取消语义，再由 Owner 投影“已选目标、本步候选、是否完成、允许的操作及版本”。交互层只发选择 / 撤销意图；每次返回新投影决定下一步，不在 UI 按 ownerId 推导第二步候选。尚未完成的选择是否进入可保存草稿也由该领域切片裁定，不能藏在 UI session 中充当领域事实。

验收顺序为两个同类目标 → 一个单位和一张牌 → 单位后其所属牌，逐项由真实需求启动，不一次实现三种。规则固定、无目标、自动多效果与未知目标各保留自身语义；effectRecipients 不是玩家选择步骤。无真实多目标需求时，不为未来字段修改 Schema、Save 或 GameCommands。

### P5 后续：共用对象定位的纯表现作用线

在 P3 跨宿主无连线验收通过后再单独启动。复用 Instance Key 定位当前可见节点和同一份关系 / 交互状态；仅按当前被关注的关系画线，不为每个副本重复生成领域关系。优先使用发起交互的实例，其次使用仍可见的稳定实例；不按 DOM 顺序改变目标。对象不可见就不画，不自动滚动或生成替代目标。

遵循 0298 已有“同一角色卡牌间只高亮、不画线”裁定；几何与去重选择不能改变游戏候选。滚动、resize、Popover 和 DOM patch 只重新定位，卸载清理；关闭线层、缺少线层或定位失败时，P0—P3 全部可用。首版不引入路径避障、跨窗口连接器或几何注册框架。此阶段不是本 Task 核心交付的阻塞项，也不据核心完成把 0298 P6 标为完成。

### P6 实施：Talklet 地点卡选择 → Workspace Click 提交

这是负责人明确提出的需求，不只是换一套卡片 CSS。施工前 `MapFlowModel.moveChoicesEntry` 将可达出口投影为流内按钮并直接请求移动；第一版改成“先选目的地，再独立确认”。现按最新要求把独立确认改为 Map Workspace 的统一 Click 提交入口，保留领域可达性与活动锁定规则。

例如当前位于地点 A，领域投影提供相邻地点 B、C：

1. 标准 Talklet 内只提供一个卡牌落点宿主；B、C 地点卡附着于此，仍保持角色行动卡的 82×58 固定尺寸。卡牌按宿主配置的左右对齐与间距排列，并以稳定实例身份派生小角度；名称、说明、进度与锁定原因来自当前 Map View。Hover/Focus 只查看和反馈；点击 B 只将 B 设为待提交地点，并显示明确的选中状态，当前位置仍为 A。
2. 改选 C 时，只替换待提交地点；不移动、不消耗资源、不启动 Encounter、不推进回合。待提交地点为空或已失效时，Map Workspace 的统一 Click 按钮保持阻塞；选择有效地点后，按钮显示目的地点并允许提交。即使只有一个合法地点，也不因显示卡牌而自动提交。
3. 玩家点击 Map Workspace 现有 Click 提交入口后，Controller 重新检查当前 Run、来源地点 A 与候选有效性，再调用现有移动命令。MapRun 最终验证邻接、Edge 条件和活动状态，成功后才到达目标、触发既有活动并回收原地点选择条目；失败时保留当前位置、刷新候选并显示原因。

接入必须满足以下边界：

- 地点卡使用真实 Node 对象身份，例如 run/map/node 组成的地点引用；选择上下文另包含来源地点和当前可移动状态。相同地点的多个视觉副本共享 Object Key，各有 Instance Key；不套用 Encounter round 身份、不放入 Hand/牌目录、不参加 sCost 或战斗目标候选。没有实际作用关系时 Relation Key 可缺省。
- 复用 Card Host 的绑定、静态落点布局、卡面组合、命中、Hover/Focus 与同一 Workspace 的交互协调；新增的仅是有类型的“选择地点 / Click 提交”适配。待提交地点放入现有 Workspace 交互会话，以 Run 和来源地点隔离，不创建另一套地点卡 Hover 服务或长期 Owner。位置仍由 MapRun 唯一持有。
- 当前 Click 在地点选择模式下提交移动；Encounter 活跃时继续执行既有战斗 / 活动入口，不让同一次点击同时触发移动与整轮 Commit。目标编辑锁与地点选择模式互斥；重复点击不得再次从旧来源地点移动。
- 仅 Flow 数值刷新且来源和候选仍有效时保留选择；候选失效、来源地点变化、选择条目被回收、load、离开 Run 或 dispose 时清除待提交态。该 UI 预选不进入 Save，也不产生回执；重新进入后要求重新选择。历史地点卡和普通地图概览默认只读，不因同 Node ID 自动取得选择或提交权限。
- P6 已在 P3 基础闭环后独立实施，不依赖 P4 多目标或 P5 作用线。地点选择使用类型化 Flow 投影、共用 Card Host 与唯一 `MapRelationInteraction`；Controller 按最新 View 复核后调用既有移动命令，不改地图生成、路线规则或 Runtime / Save 合同。

原独立确认入口曾通过定向回归。随后按负责人要求改为：地点卡仍只做选择，Map Workspace 的统一 Click 按钮在无有效选择时阻塞，有选择时提交移动；此次复用同一 Controller 复核和 MapRun 命令。卡牌 DOM 位于标准 Talklet 的单一落点中，保持 82×58，排列由宿主对齐 / 间距配置决定，角度基于稳定实例身份生成。桌面浏览器验收按既有豁免未执行。

## 验收矩阵

| 场景 | 必须观察的结果 | 证据入口 |
| --- | --- | --- |
| 同牌在 Map 与 Flow | Object/Relation Key 一致、Instance Key 不同；两处来源/目标/候选角色一致，来源与受用可共存。 | `map-relation-presentation.test.ts` + 真实 Workspace 集成 |
| 可编辑与只读副本 | Map 发起修改正常；Flow 不发起修改或换牌；同一次点击/拖拽/键盘确认仅一个对应命令。 | `map-relation-interaction.test.ts`、Controller spy 与实际草稿 |
| Map → Flow 真实目标 | 筹划选中真实射击引用；领域接受；提交前 round/RNG/余额不变，显式 Commit 后 receipt 与实际 sCost 一致。 | `gameplay-b-map-workspace.test.ts`、`gameplay-b-map-cards.test.ts` |
| Flow 回收与裁剪 | 同 contentId 回收、200 条裁剪、当前条目更新只移除视觉实例；目录与草稿不被删除；无悬挂 pin/drag/ghost。 | `flow-entry.test.ts`、`map-flow-adapter.test.ts`、DOM 集成 |
| 历史 / 伪装 / 越权 | 历史牌、过期引用、普通卡形按钮与只有 marks 的条目无玩法入口；宿主伪声明可编辑仍不能绕过 Owner 拒绝非法命令。 | renderer/interaction 负例 + Owner 版本/候选测试 |
| 换牌与多实例 | Swap 不造牌，已选 PlayerCommand 才产生真实命令牌；旧目标清除遵循 Owner；移除一处副本不影响另一处。 | `gameplay-b-map-cards.test.ts` + DOM key 验收 |
| 单目标兼容与复合效果 | none/self/selectable/rule/unknown 与当前默认策略不变；攻击敌人 + 恢复行动者资源只让领域指定的目标可选。 | `gameplay-b-map-relations.test.ts`、定向 Owner 测试 |
| 路由 / 存档 / 生命周期 | Save/Resume 保持本轮牌身份和显式目标；成功 Commit 后旧轮引用失效；同 ID load 也 reset；离开销毁监听和 capture。 | 已有 card/save 测试 + interaction session 用例 |
| 视觉与交互连续性 | 旋转/叠放/Flow 上翻/浮层展开不改逻辑次序；真实遮挡命中正确；Frame、三列、Flow scroll owner 与可保留焦点不重建。 | `map-dom-updates.test.ts` + 桌面浏览器 |
| 新宿主接入成本 | 首个 Flow 接入没有自己的 Hover/drag 状态机或另一套合法性算法；只增加绑定、载荷与渲染组合。 | 实现差异与调用链审查 |

施工时先补关键边界行为测试，再改跨层接口。桌面验收至少包含真实协同演练、Flow 只读发起限制、Map→Flow 点击及拖拽、候选层开关、滚动后命中、条目回收、显式 Commit、重进/恢复；记录窗口尺寸与实际结果。视觉调整须使用 frontend-design skill 并按 [[docs/ai/frontend-design-project-overlay]] 复用现有主题与卡面，避免借本 Task 改版。

候选回归命令：`npx vitest run tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-relations.test.ts tests/ui/map-relation-interaction.test.ts tests/ui/map-relation-presentation.test.ts tests/ui/flow-entry.test.ts tests/ui/map-flow-adapter.test.ts tests/ui/map-dom-updates.test.ts tests/ui/gameplay-b-map-workspace.test.ts --silent`。影响 Flow renderer / scroll 时补 `tests/ui/components/chat-text.test.ts`、`tests/ui/components/chat-image.test.ts`、`tests/ui/contacts-story-workspace.test.ts`、`tests/ui/story-history-resume.test.ts` 与 `tests/ui/scroll.test.ts` 中命中的回归；不以此长命令强制每个小 Unit 重跑全组。

跨层接口施工后执行 `npx tsc --noEmit`、`npm run check:architecture`；文档运行 `npm run check:docs` 和 `git diff --check`。本核心范围预计无作者 Schema / Save 变化；若实际需要，先调整切片并按 [[docs/docs-829/05-conventions/schema-sync]] 核对，禁止手改生成文件。

## 明确非目标与停止条件

- 不重做 MapRun、Hand、Swap、PlayerCommand、Commit、三栏 Workspace、Story 或 Flow；不增加第二状态 Owner、第二合法性算法或独立宿主 Hover。
- 不新增卡组构筑、通用 Effect/Target DSL、敌方手牌、任意 Flow 业务组件、拖牌到宿主即迁移牌区的规则。Card Host 是放置视觉副本的容器，不是新领域 zone。
- 不承诺通用多目标编辑器、随机目标、跨 Encounter 持续卡牌、跨窗口 portal、连线路由；P4 / P5 的后续切片必须另有明确验收与授权。
- 施工遵守 [[docs/ai/PROJECT-CONSTITUTION]] 的停止条件。新增真实玩法语义、持久字段或第二命令写入口、Read Set 与当前源码冲突、超过 Unit 白名单/预算、必要验证失败时，停止受影响 Unit 并给出证据；不回滚其他在途任务、不把前序未结项当作默认全局阻塞。

## 完成定义与剩余工作

- [x] P0—P3 全部实施，Map、Popover 与至少一张真实 Flow 玩法牌共用绑定和唯一 session。
- [x] 验收矩阵通过；桌面证据按负责人 2026-10-19 指示豁免，未执行原因已记录。
- [x] 调用链与差异审查确认宿主接入没有复制领域规则或独立交互状态；稳定机制更新见实施记录。
- [x] 完成直接影响路径的 GALHCG 只读复核，Task / Unit / Receipt 按实际状态收尾。
- [x] P6 地点卡选择 / Workspace Click 提交完成；选择只在当前 Workspace session 中保存。

P4 真实多目标与 P5 作用线仍为后续阶段；它们不属于本 Task 的核心完成定义。继续 P4 / P5 时可沿用本 Task 的交互基础，不重新设计卡牌宿主。

## 实施记录（2026-10-19）

P0—P3 与 P6 已完成，详细 Unit 与 Receipt 见 [[docs/plan-work/archive/task-0300-units/index]]。

| 切片 | 实际落点 | 结果 |
| --- | --- | --- |
| P0 Options | `map-relation-interaction.ts`、`controller.ts`、交互测试 | 唯一 session 保留；`sendIntent` 携带 relation / target / sourceInstanceKey |
| P1a 绑定 | 新增 `src/ui/cards/card-host.ts`、`map-workspace.ts` | 真实卡 / 替换 offer / 目标控件共用实例与入口标记 |
| P1b 入口 | 交互类、`map-workspace.ts`、`story.ts` | 卡牌目标与编辑源按实例入口校验；普通 marks 不能伪造绑定 |
| P2a 载荷 | `flow-entry.ts`、`map-flow-model.ts` | 当前 Encounter 的真实准备牌进入 Flow；历史回执不参与 |
| P2a 渲染 | 新增 `src/ui/cards/card-face.ts`、`story.ts`、`map-workspace.css` | 只读卡面复用主题；`inspect` / `target` 入口 |
| P2b 跨宿主 | `map-relation-interaction.ts`、`map-dom-updates.ts`、Workspace 集成测试 | Map 筹划可选 Flow 射击副本；高亮一致；单次命令；实例协调 |
| P6a 候选投影 | `card-host.ts`、`flow-entry.ts`、`map-flow-model.ts`、adapter 测试 | 使用 Run / Map / Node Object Key；Flow 不再提供直接移动 Action |
| P6b 卡面呈现 | `story.ts`、`map-workspace.css`、样式约定与 renderer 测试 | 标准 Talklet 内提供单一落点；固定 82×58 地点卡显示进度与锁定原因 |
| P6c 选择 / Click 提交 | `map-relation-interaction.ts`、`map-workspace.ts`、`controller.ts` | 单 session 暂存、改选、失效清除、Click 阻塞 / 放行、Controller 最新状态复核与单次移动 |

**实际验证**：

- 候选回归 8 文件共 107 项全通过：`flow-entry` 16、`map-flow-adapter` 19、`map-relation-presentation` 4、`map-dom-updates` 5、`map-relation-interaction` 16、`gameplay-b-map-relations` 7、`gameplay-b-map-cards` 18、`gameplay-b-map-workspace` 22。
- `node ./node_modules/typescript/bin/tsc --noEmit` 通过；`npm run check:architecture` 通过。
- 浏览器验收未执行：负责人 2026-10-19 明确 agent-浏览器交互链路断裂，本轮不需要浏览器验收或桌面截图。未以测试结果冒充桌面验收。
- 未运行全量 `vitest`；未运行旧 Operation / 已删除 demo 的测试。失败归属无新增。

**P0—P3 阶段范围限制**：

- 当时未实现 P4 多目标、P5 作用线、P6 地点卡选择 → Click 提交；P6 已在后续切片完成，P4 / P5 保持后续阶段。
- 未新增持久字段、Schema、Save 或第二命令入口。
- `currentCardsEntry` 对所有含真实准备牌的 Encounter 生效，不写死协同演练内容 ID；无卡普通地点不生成条目。

## 初始核验记录（2026-10-19，P0—P3 实施前）

- 已读当前源码与 0296、0297、0298、0299，核对身份、Owner 查询/命令、唯一 session、Flow reducer/渲染、DOM 协调与测试入口。
- 初始运行记录：上述 7 文件共 95 项，92 通过、3 失败；6 文件全部通过，Workspace 为 18/21。该运行发生在 U9 与本次 P6 前，失败断言属于后来变更的旧手动目标 UI；不作为当前 P6 验收结果。
- 3 项基线失败均在 `tests/ui/gameplay-b-map-workspace.test.ts`：约 505 行预期手动完成按钮、620 行预期 Commit 按钮不存在、780 行预期提示“选择对象”。当前 `renderActionDock` 优先提供可提交行动，而当前 Owner 已提供自动目标；0299 U9 也记录旧手动目标门槛断言待更新。这里记录现象和相关证据，具体修复归属须与 U9 核对，不在文档轮顺手修复，也不将未来回归要求放宽为可忽略失败。
- 初始产品代码、类型 / 架构检查和新界面浏览器验收未运行；当时仅编写 Task 与登记索引。初始 `check:docs` 与空白检查结果仅记录该时点，不替代 P6 当前验证。
- P6 实施后首次全仓 `check:docs` 报 49 项：含本 Task Unit 索引 `README` 与既有目录同名的 1 项，以及工作区旧 Operation / demo 移除导致的 48 项失效源码路径。本次已将 Unit 索引改为 `index.md`；最终复检只剩旧 Operation / demo 文档的 48 项失效源码路径，未在 P6 Unit 内修改。

## P6 当前验收（2026-10-19）

- 定向行为回归：`tests/ui/map-relation-interaction.test.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/map-flow-adapter.test.ts`、`tests/ui/card-host.test.ts`、`tests/ui/map-location-card-render.test.ts`，共 5 文件 / 71 项通过。
- `node node_modules/typescript/bin/tsc --noEmit` 通过；`node scripts/check-architecture-boundaries.mjs` 通过；`git diff --check` 通过。
- `node scripts/check-docs.mjs` 仍有 48 项旧路径失效，集中在已移除的旧 Gameplay B Operation / demo 文档引用；本次未修改这些范围。
- 桌面浏览器验收依负责人 2026-10-19 的既有豁免未执行；Happy DOM 的卡片渲染与 Workspace 行为测试通过。

## GALHCG 影响闭环

- 项目身份：本会话 `graph_project(workspace_path=任务绝对目录)` 返回 `acprogram`，根目录一致。按 Operation / Gameplay B 概念定位后回到源码；图中较早映射主要是旧 Operation，不视为新版能力清单。
- 本轮按 `0297` 定向路径查询找到对应活动 Task；0300 编号通过当前路径核对未占用。新 Map 代码与 Flow 内容以当前文件和测试核实。
- 已对本 Task 与 `docs/plan-work/00-index.md` 执行 `graph_health(check="changed")`：新 Task 为 `unreferenced_path`，无直接 Evidence / maps_to；索引为 `content_changed`，4/4 owner 完整返回，路径与 owner 均无剩余分页。仅记录检查边界，不改图、不刷新、不写 freshness；规划文档写入不等于图维护授权。
- P6 结束时按直接路径执行 `graph_health(check="changed", options.path=...)`：`controller.ts`、`controller-actions-operation.ts`、`story.ts` 与 `ui-style/patterns.md` 有现存 owner；新 Card Host、Flow DTO、交互、CSS、Task 与 Unit 路径部分无直接 Evidence / maps_to。所有检查只读；未执行 graph_edit、刷新或 freshness 写入。

## 相关路由

[[docs/ai/goal-workflow]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]] · [[docs/docs-829/05-conventions/doc-maintenance]] · [[docs/docs-829/06-wiki/50-ui/read-model-context]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]]
