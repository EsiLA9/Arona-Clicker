# Task 0296：统一 Talklet 呈现流并接入 Gameplay B Map Workspace

状态：implemented（自动化与 DOM 验收完成）— U1—U6 已实施并记录 Receipt；Story/Contacts Workspace 回归已修复。Operation Controller 的 18 条既有失败归属独立 Operation Workspace 范围，不阻塞本 Task。

日期：2026-10-18。

后续施工注记：本 Task 原始范围中“右栏移动入口暂留”已由后续用户需求替代。当前相邻地点移动器已迁入流内 Talklet，仅在 Node 完成或空闲地点需要移动时出现；成功移动后回收原移动器，留下“从……移动到了……”旁白。原始 U1—U6 Receipt 保留历史范围；当前机制见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 目标与可交付结果

普通 Chat／Story 和新版 Gameplay B Map Workspace 共用**一条信息流条目呈现与滚动基础管线**。Game/Story 继续决定剧情与聊天内容，MapRun 继续决定地图、活动、行动和结算；共享层只处理呈现条目、流内身份、显式同 ID 回收、DOM 协调及滚动连续性。此 Task 覆盖投递需求的 P1（共享机制）与依赖它的 P2（Map 接入），不提前实施 P3—P7 的复杂交互。

本阶段重点是**迁移信息流内容与机制**，沿用现有 Map 三栏和操作入口，不施工新的中上地图面板或 Rich Talklet 业务界面。普通 Chat 仍能显示发言、旁白、图片与演出；Map 的真实地点、活动和最近结算按相同的通用条目渲染路径呈现。重复查询当前情报时，同一流内旧查询条目回收，新条目在末尾出现。左右单位区域保持稳定；现有右侧移动入口暂时保留，未来由**流内移动 Talklet**取代，本 Task 不预设移动必须归属中上区域。

## 来源、裁定与范围

- 需求来源：负责人投递的《P1—P2 统一 Talklet 信息流机制与 Gameplay B 接入》（2026-10-18）。方向背景见 [[docs/plan-work/archive/draft-0296-gameplay-b-and-chat-shared-render-pipeline]]；该 Draft 是调查与建议，具体可施工边界以本 Task 及当前源码为准。
- 已有三栏按钮版基线见 [[docs/plan-work/archive/task-0294-gameplay-b-three-column-button-ui]]；Battle → Rest → Shop 正式样例见 [[docs/plan-work/archive/task-0295-gameplay-b-basic-map-p0-p3]]。本 Task 不重做它们的领域规则或按钮。
- **Talklet 逻辑身份裁定：** 当前 `src/data-services/contracts/story.ts` 的作者 `Talklet` 没有 `id`；`ChatEntry.id` 是数值实例 ID，`storyPageKey` 是 Story 页同步指纹，均不等于需求中的逻辑 ID。P1 可用 UI `FlowEntry`（名称可等价）承载逻辑 `id` 和 `repeatPolicy`，暂不改 `StoryDef.talklets` 或生成 Schema；但这两个字段表达的是**Talklet 级内容身份及投递策略**，不能被降为 Map 专属 DOM 键。P1 必须提供类型化投递／适配路径，将显式声明的 `id`、`repeatPolicy` 原样传给 `FlowEntry` 和统一 reducer，并以带 ID 的 Talklet 形态输入证明可用。当前匿名 Story Talklet 继续默认追加；未来 Story 作者字段获准扩展时可直接透传，不必重设计回收机制。
- `append` 是缺省策略；`replaceSameId` 只在新条目显式选择且提供非空逻辑 `id` 时生效。新条目先从**同一流实例**删除全部同 ID 旧条目，再追加到末尾；即使旧条目是 `append` 也要回收。不同流的同 ID 条目互不影响，不能按文本、HTML、业务类型或 DOM ID 回收。重复策略在条目数据层执行；恢复和重新渲染不得重新制造旧实例。
- Map 的 `requestId`、`runId`、`nodeId/activityId` 是可用的来源身份；它们与 `FlowEntry.id`、实例键各有用途。相同回执的重复投影不能被当作新事件；不同提交不能仅因显示在同一“最近回执”位置而合并。

## 当前事实与代码落点

| 已核实事实 | 当前源码／测试依据 | 施工含义 |
| --- | --- | --- |
| 作者 `Talklet` 只有文本、说话人、图片、演出／选择等字段，没有逻辑 ID 或重复策略。 | `src/data-services/contracts/story.ts` 的 `Talklet` | 本阶段先让类型化投递入口接受并透传可选逻辑身份，不直接扩张 Story Schema；未来作者字段可沿同一路径接入。 |
| `ChatEntry` 用数值 `id`、`timestamp`，已送达 Story 页另有 `storyPageKey`；`ChatStream` 按一般聊天／角色流隔离，负责剧情指纹、typing/thinking/pause、横幅、自增 ID 与 200 条上限。 | `src/ui/components/story.ts` 的 `ChatEntry`；`src/ui/chat-stream.ts` 的 `activeStream()`、`syncCurrentStory()`、`append()`、`restoreHistoryState()`；`tests/ui/story-history-resume.test.ts` | 抽取或调用通用呈现／条目操作，但不让 Map 进入 Story 页门控、指纹或被动聊天。保留现有历史兼容。 |
| 普通 Chat 用 `renderChatHistory()` 渲染发言、旁白、system、reward、typing；`renderTalk()` 处理头像、侧向、图片与主题宿主。`.chat-stream` 在 `.chat-pane` 内，按钮与演出覆盖层在流外。 | `src/ui/components/story.ts`；`src/ui/components/center-panel.ts` 的 `renderChatTab()`；`src/ui/components/contacts.ts` | 共享的通用条目渲染必须由普通 Chat 和 Map 实际调用。Story 专属选择、底部发送与覆盖层仍在原 owner。 |
| `ScrollManager` 目前查询单个 `.chat-stream`，保存比例、贴底标志和条数，图片加载用 `ResizeObserver` 跟随；不是多流实例通用 API。 | `src/ui/scroll.ts` 的 `captureChat()`、`restoreChat()`、`observeChatStream()` | 抽出以明确流宿主为参数的底部跟随／锚点机制，并保持 Chat 原有行为；Map 不能仅添加 `.chat-stream` 类来冒充复用。 |
| Map 中部 `renderFeed()` 直接拼地点、遭遇、最近回执 HTML；`renderRecentCommit()` 先读 `actionPreview.recentCommit`，回退到 `run.lastEncounterCommit`。商店 `lastPurchase` 当前在操作区。 | `src/ui/components/map-workspace.ts` 的 `renderFeed()`、`renderRecentCommit()`、`renderShopDock()` | 建 Map→Flow 纯适配器；把普通内容送入共享渲染，保留回执专属细节格式化与当前操作区。 |
| Map 更新用同一 detached `MapRunWorkspaceView` 经 `UIController.refreshMapWorkspaceRegion()` 和 `patchMapDOM()` 协调三列；当前自己按 `requestId` 决定回执跟随并保持 focus/scroll。 | `src/ui/controller.ts`；`src/ui/workspace/map-dom-updates.ts`；`tests/ui/map-dom-updates.test.ts`；[[docs/docs-829/06-wiki/50-ui/refresh-update]] | 沿原 Dispatcher 收敛，不建第二调度器；只把 feed 的滚动算法和条目 DOM 交给共享层，跨栏协调仍由 Map 更新入口负责。 |
| Run 只有 `lastEncounterCommit`，活动商店只有 `lastPurchase`，成功终态仅有简短结果；Map View 没有完整事件序列或角色对话序列。 | `src/arona-clicker/contracts/map-run.ts` 的 `MapRun`、`MapRunActiveActivity`、`MapRunSuccessResult`；`src/arona-clicker/contracts/runtime.ts` 的 `MapRunWorkspaceView` | P2 只能呈现这些可重建事实。不得把 UI 缓存伪装为可存档的全部战斗／购物／对话历史。 |

## 结构与责任设计

```text
普通 Chat / Story：Story Talklet → ChatStream → ChatEntry ┐
                                                      ├→ FlowEntry → 共享条目渲染 → Flow Host → 共享 Scroll
Gameplay B Map：MapRunWorkspaceView → Map Flow Adapter ┘

Map Workspace（沿用现有 Frame、三列宿主和操作按钮）
├─ 左：现有我方单位／候选／目标
├─ 中：现有 feed → 共用 Flow Host（唯一滚动 owner；条目按稳定键协调）
├─ 中下：现有 Ability／Item、Shop、Commit／离开操作区
└─ 右：现有敌方／背景／进度／移动入口（本阶段不迁位）
```

- 引入可复用 Flow Host 组件和条目键，不另造 Workspace Frame／Panel，也不要求额外包一层 DOM。Chat 只替换现有 `.chat-stream` 的内容组合入口；Map 复用已有 `data-map-region-key="talk-feed"` 滚动容器作为 Flow Host，保留现有 `action-dock` 和各列结构。新增节点的确切数量与名称由施工切片登记，不能为样式重复包裹 Host。
- `FlowEntry` 是纯呈现 DTO：明确 `streamKey` 或由调用方提供流实例、稳定**实例键**、可选逻辑 `id`、`repeatPolicy`、通用内容种类及来源身份。实例键用于 DOM 协调／阅读锚点；逻辑 ID 只供显式回收。类型化 Talklet 投递入口接受可选逻辑身份并透传；持久化的普通 Chat 条目保持现有数字 ID 与 `storyPageKey`，适配时映射实例键，不重解释成 `replaceSameId`。
- 共用一个通用条目渲染入口，覆盖普通文字／角色发言／旁白／图片／system／reward／状态提示。Map 回执允许受控的专属正文格式化，再嵌入共享条目外框；业务值必须先走 `UIContext` 查询和转义，不能接受数据包提供的原始 HTML。本阶段不预建 Rich Talklet 的 UI slot、业务 Widget 或新的内容类型体系；未来 Hand、Shop、奖励等复合交互另行设计。
- `FlowEntry` reducer 对一条流执行 `append` 或 `replaceSameId`；处理先于上限裁剪、DOM 渲染与存档。Map 的权威 View 适配与 UI 查询投递必须合入**同一个按 Run 隔离的流实例和有序条目序列**，不能每次先重排完整 View 快照、再把临时条目一律放到末尾。首次挂载按来源生成基线；相同来源键的快照刷新原位更新或保持，不改变次序；新 `requestId` 的真实回执只追加一次；查询按实际点击时序尾插，`replaceSameId` 删除同逻辑 ID 的全部旧实例后尾插。失去来源的当前状态条目应移除，敌方 HP 等被查询事实变化时旧“当前情报”失效而不自动重投递。流内先前观察到的回执可以在当前 UI 会话继续显示，但只有 MapRun 当前仍提供的最近回执可在重新进入／Save-Resume 后重建；不得称前者为持久领域历史。Run 离开／dispose 时清理 UI 临时序列。

  例如同一 Run 的输入顺序为「地点说明 → 查询机器人（HP 6/6）→ `requestId=R1` 的结算 → 再查机器人（HP 3/6）」，可见顺序应为「地点说明 → R1 结算 → 机器人 HP 3/6」。中途任意次数重读同一 View 不改变顺序；新查询移除旧查询并尾插，不能在下一次快照协调时复活旧查询。
- 右侧现有敌方列表只是 HP 文本，尚无“查询情报”动作。本 Task 为每个活动敌方增加明确的只读“查看情报”按钮：Controller 从当前 detached View 取敌方名称／HP 等已有事实，写入当前 Run 的 UI 临时流，统一使用逻辑槽 `gameplay-b:current-enemy-info` 与 `replaceSameId`，所以查看另一敌人也回收上一条查询。它不能触发 Target Selection、Commit 或任何 GameCommand；查询入口失效时不显示旧情报为当前事实。
- 共享滚动工具按实际 Flow Host 元素和流实例工作：原在底部才跟随新增；阅读历史时优先用仍存在的条目实例键加相对偏移恢复锚点，锚点被显式回收时选相邻稳定条目并夹取滚动位置；图片加载及内部展开保持同样规则。每个 Host 独立，不能全局 `querySelector('.chat-stream')` 误命中普通 Chat。普通 Chat 的原有 `forceToBottom()`、切页／恢复语义继续由 `ScrollManager` 包装。
- Flow Host 具有可读的标签和 `role="log"`；只对真正新增的条目进行适度通知，刷新当前数值或重投影同一回执不能反复播报。删除／回收的条目不得留下失效的焦点目标。
- Flow 更新作用于 `behavior` 或 `region`，不得因普通条目追加、查询、焦点、滚动或 Shop 状态变化无条件调用 `UIController.render()`。现有 `patchMapDOM()` 可保留为三栏协调器，但应把 feed 条目键与共享 Flow patch 接口接通；删节点前通知范围内 popover，更新后复核锚点，保留 Frame、现有标题、左右列、滚动 owner、有效按钮及焦点。缺失 feed 时只恢复中栏所属区域；路由／Run 身份不匹配时丢弃过期请求，结构重建只用于真正的路由或 owner 变化。
- 本 Task 只迁移中部信息流，不重划三栏职责，不增加随活动切换的左右业务面板。左侧继续以我方单位为主，右侧继续以敌方单位情报为主；Rest／Shop 等无敌人的状态不把右栏改成商店主面板。当前右栏的地图进度和移动按钮属于既有过渡 UI，P2 须保持可用，但不把它们确立为未来位置；后续任务用流内移动 Talklet 替代该入口，并单独迁移命令、禁用原因与焦点路径。
- Story 演出页推进、指纹去重、typing/thinking/pause、被动聊天、StoryService 写入、`story-gate` 横幅均不搬入 Map。Map 业务点击继续走 Workspace／UIController → GameCommands，Flow 条目不直接修改 MapRun 或执行 Effect。普通 focus、浏览或切换 UI 选择不等于领域 Target Selection／Gameplay Action。

## P1：共享呈现流机制

### P1.1 基线与接口冻结

先用当前源码和回归测试画出 `Talklet → ChatStream → ChatEntry → renderChatHistory → .chat-stream → ScrollManager → Controller` 的真实调用链，并记录旧 Chat/Story 的节点、滚动、图片、typing、存档恢复表现。确认新增 Flow DTO、条目实例键、逻辑 ID 与 Story 原字段的映射；设计并测试带可选逻辑身份的类型化 Talklet 投递路径。禁止本阶段直接改 `StoryDef.talklets` 或把 `ChatStream` 作为 Map 数据仓库。接口应最小，优先从 `story.ts` 中抽出已存在的 `renderTalk` 等通用原语。

### P1.2 纯条目操作与共用渲染

实现流内 `append`／`replaceSameId` 操作和共用渲染；普通 Chat `renderChatHistory()` 必须委托它。验证：带逻辑 ID 的 Talklet 形态输入能透传到 Flow；匿名输入保持默认追加；默认 `append` 可保留同逻辑 ID 的合法重复；新 `replaceSameId` 清理同流所有旧实例并追加到末尾；跨流隔离；空 ID 被拒绝；上限裁剪次序确定；序列化／恢复后再次插入仍遵守显式策略；Story 页 `storyPageKey` 去重和 typing 不变。渲染输出带稳定实例键，支持同人连发分组在条目移除后正确重算。

### P1.3 Flow Host、滚动和局部更新

把 Chat 当前单 Host 的底部跟随／图片伸展处理抽成按 Host 使用的共享能力，补条目锚点和焦点保护；原 Chat 入口改为调用共享能力。给普通 Chat 和可独立挂载的 Flow Host 定向测试，证明新条目贴底、上翻不跳、同 ID 回收、图片晚加载、流实例切换、缺失宿主和卸载清理；测试 DOM identity 与滚动数值，不只比较生成 HTML。

**P1 门槛：** 普通 Chat/Story 现有显示及存档回归通过，且测试能在共享 renderer/reducer/scroll 实现上同时构造普通追加和显式回收；P1 完成记录落在本 Task 后才开始 P2。

## P2：Gameplay B Map 接入

### P2.1 纯 Map Flow Adapter

从 `MapRunWorkspaceView` 只读生成 Flow 快照。映射表在实现前以测试固定：

| 来源 | 呈现与身份 | 生命周期 |
| --- | --- | --- |
| 当前 Map／Node 标题与活动进度 | 沿用现有标题／说明位置；进入 Flow 的内容由 Adapter 按 `runId + nodeId + activityId` 定位 | 派生当前状态，不当作每次进入的历史事件；本阶段不新造中上面板 |
| 当前地点／遭遇说明 | Flow 中的通用说明条目，按 `runId + nodeId + activityId` 定键 | 当前状态；状态改变时可用 `replaceSameId` 回收同一说明槽 |
| `actionPreview.recentCommit` 或 `run.lastEncounterCommit` | 同一个 `requestId` 只投影一次；保留来源 Node／轮次标签和可读结算详情 | 仅最近可恢复回执，不承诺逐回合历史 |
| 当前活动商店 `shop.lastPurchase` | 当前 Shop 的最近购买提示；名称从当前 offer 只读解析 | 只在来源仍可读取时可恢复，离开后不声称存在完整购买历史 |
| 成功／失败结果 | 对应现有最小结果投影的只读结束条目 | 成功只用 retained result；失败遵守当前 Runtime-only 限制 |
| 玩家点击右栏“查看情报”查询当前敌方 | `gameplay-b:current-enemy-info` 逻辑槽，使用 `replaceSameId`；同 Run 同流 | 临时展示，不进入 MapRun Save，也不伪称领域事件；不复用目标选择按钮 |

当前 View 没有角色对话、进入 Node 的完整事件日志、每次购买记录、每轮战斗回执或可恢复的逐活动叙事。若 P2 页面需要显示这些内容，只能接入确有来源的已存在只读事件；本 Task 不增加 MapRun 历史字段。施工模型须在验收记录中标明尚未提供的内容，不能编造对白或在 `render()` 时追加“进入地点”来冒充持久记录。

### P2.2 Map DOM 与操作入口

`map-workspace.ts` 改为通过 Adapter＋共享 Flow Host／renderer 输出中部条目；`map-dom-updates.ts` 仍负责跨栏语义消费者，只将 Flow 子树交给共享条目协调；`UIController.refreshMapWorkspaceRegion()` 继续使用现有 Dispatcher 与 detached View。新增“查看情报”事件由 `controller-actions-operation.ts` 委托给 Controller 的 UI 临时流，更新当前 Flow 区域，不发送 GameCommand。保留 `requestId` 幂等、`data-map-focus-key`、来源 Activity 身份、Shop 草稿版本、左侧 Hand/Swap/PlayerCommand/Target、右侧敌方与现有移动入口。中下指挥区不并入滚动 Flow；本阶段不迁移移动按钮或重排三栏。

### P2.3 生命周期与验收流程

以正式 `gameplay-b:map:activity-hall` 的 Battle → Rest → Shop 为主流程，另用现有 Map 战斗／失败／Save-Resume 夹具覆盖其他状态。重复刷新同一 View 不增加或重排条目；Commit 后新 `requestId` 的回执按发生时序进入流；重复查询同槽回收旧条目并尾插；离开／重新进入／读档后仅重建有权威来源的内容。已有聊天与 Story 的条目、节奏、图片和存档行为不回归。用可重复的 DOM／行为自动化验证三栏节点身份、滚动和焦点；本项目不要求窄屏验收，见 [[docs/ai/frontend-design-project-overlay]]。

## 施工 Read Set、分片与停止条件

- P1 最小 Read Set：`src/data-services/contracts/story.ts`，`src/ui/chat-stream.ts`，`src/ui/components/story.ts`、`center-panel.ts`、`contacts.ts`，`src/ui/scroll.ts`，`src/ui/controller-core.ts`，`tests/ui/story-history-resume.test.ts`，`tests/ui/components/chat-image.test.ts`；刷新约定 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。只按实际影响补读调用方。
- P2 最小 Read Set：`src/arona-clicker/contracts/map-run.ts`、`runtime.ts`，`src/ui/components/map-workspace.ts`，`src/ui/workspace/map-dom-updates.ts`，`src/ui/controller.ts` 的 Map 刷新段，`src/ui/controller-actions-operation.ts` 的 Map 动作段，`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/map-dom-updates.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts`，正式样例 `src/arona-clicker/content/operation-samples/gameplay-b-map-datapack.ts`。
- 施工按 [[docs/ai/PROJECT-CONSTITUTION]] 在开工前拆成小 Patch Unit：建议依次为「Flow DTO／reducer」「共用条目 renderer 与 Chat 接入」「按 Host 滚动／局部更新」「Map Adapter」「Map DOM／Controller 接入」「端到端回归与当前文档」。每 Unit 单独列 `Allowed Files`、Read Set、失败回退和 Receipt；不得把上述候选文件表视为一次性修改白名单。
- 需要改变 Story／Datapack Schema、MapRun 状态或保存合同、复用旧 Operation 专属工作区、增加第二 UI 调度器、产生任意 HTML 插槽，或发现当前 View 不能支持既定验收时，停止对应 Unit，记录证据并由 Task 负责人收口；不能自行扩大施工范围。状态写入或跨层依赖变化读 [[docs/docs-829/05-conventions/architecture-discipline]]；若裁定改作者字段再按 [[docs/docs-829/05-conventions/schema-sync]] 另定施工边界。
- 旧 `.operation-chat-stream` 仍在 `operation-workspace.ts`；本 Task 只接入新版 Map。旧 Operation 的迁移／退役归既有 C5 任务，不为形成表面“三处统一”而顺手改旧页面。

## Patch Unit 分片（2026-10-18 开工前拆分）

按 [[docs/ai/PROJECT-CONSTITUTION]] C1—C3 拆分；每 Unit 独立实施、独立验证、独立 Receipt，不合并为一次提交。U1—U3 交付 P1 门槛，U4—U6 交付 P2；P1 门槛未在本 Task 记录完成前不开始 U4。

| Unit | 目标 | 主要文件 | 依赖 |
| --- | --- | --- | --- |
| U1 | Flow DTO、`append`／`replaceSameId` reducer、类型化 Talklet 投递 | 新增 `src/ui/flow/` 下的 flow-entry.ts、新增 `tests/ui/` 下的 flow-entry.test.ts | — |
| U2 | 共用条目 renderer、实例键，Chat 改为委托 | `src/ui/components/story.ts`、`src/ui/chat-stream.ts`、新增 flow-render.ts、`tests/ui/components/chat-text.test.ts`、`tests/ui/story-history-resume.test.ts` | U1 |
| U3 | 按 Host 滚动／锚点／图片伸展，Chat 入口改调共享能力 | 新增 flow-scroll.ts、`src/ui/scroll.ts`、`src/ui/components/center-panel.ts`、`src/ui/components/contacts.ts`、`tests/ui/scroll.test.ts` | U1、U2 |
| U4 | Map Flow Adapter、受控多行正文与按 Run 隔离的流模型 | 新增 map-flow-model.ts、新增 `tests/ui/` 下的 map-flow-adapter.test.ts、`src/ui/flow/flow-entry.ts`、`src/ui/components/story.ts`、`tests/ui/components/chat-text.test.ts` | U1 |
| U5 | Map Flow Host／DOM 协调／查看情报入口 | `src/ui/components/map-workspace.ts`、`src/ui/workspace/map-dom-updates.ts`、`src/ui/controller.ts`、`src/ui/controller-actions-operation.ts`、`src/ui/context.ts`、`src/ui/css/map-workspace.css`、`tests/ui/gameplay-b-map-workspace.test.ts` | U2—U4 |
| U6 | 端到端自动化／DOM 回归与当前文档 | `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts`、`tests/ui/story-history-resume.test.ts`、`tests/ui/contacts-story-workspace.test.ts`、`docs/docs-829/06-wiki/50-ui/refresh-update.md`、本 Task、`docs/plan-work/00-index.md` | U5 |

### 跨 Unit 共用约定

- 键与属性：流实例 `data-flow-stream-key`，条落实例键 `data-flow-entry-key`，宿主 `data-flow-host-key`。**不为条目新增包裹节点**，实例键挂在各条目现有根元素（`.chat-talk`／`.chat-narration`／`.chat-system`／`.chat-reward`）上，避免改变 `.chat-stream`／feed 的 flex／grid 布局与现有 CSS。
- 实例键格式：普通 Chat 用 `chat:<entry.id>`；Map 用 `map:<sourceKind>:<sourceId>`（来源种类与 ID 由 U4 固定）。实例键只用于 DOM 协调与阅读锚点，不承担回收语义。
- 逻辑身份与策略只作用于数据层：`contentId`（可选，非空才允许 `replaceSameId`）与 `repeatPolicy`（缺省 `append`）。普通 Chat 的持久条目继续使用数字 `id` 与 `storyPageKey`，适配时不写 `contentId`，因此永不触发 `replaceSameId`。
- 上限裁剪（200）与策略执行都在 reducer 内、渲染与序列化之前完成；两处调用同一实现。
- U1／U3 的新模块只依赖 `UIContext` 与纯数据结构，不得导入 `ChatStream`、`command` 或 `MapRunService`。

### U1：Flow DTO 与策略 reducer

- 交付：`FlowEntry`（`streamKey`、`instanceKey`、可选 `contentId`／`repeatPolicy`、通用内容种类、`source` 来源身份、`lifecycle: 'current' | 'observed'`）、`FlowContent` 呈现字段、`applyFlowEntry(entries, entry, max)`、`FLOW_STREAM_MAX`、`flowEntryFromTalklet(input)`（接收可选逻辑身份并原样透传，不改 `Talklet` 类型）、`chatEntryToFlowEntry(streamKey, entry)`。
- 验证：默认 `append` 允许同逻辑 ID 合法重复；显式 `replaceSameId` 删除同流全部同 ID 旧实例后尾插；跨流互不影响；空 `contentId` 被拒绝（先由类型化投递拒绝，reducer 再做防御断言）；上限裁剪后新条目仍在末尾；`JSON` 往返后再次插入仍遵守显式策略；匿名输入保持默认追加。
- 失败回退：不触碰任何调用方，删除新模块即回到现状。

### U2：共用条目 renderer 与 Chat 接入

- 交付：从 `story.ts` 抽出单条目渲染入口 `renderChatEntry(ctx, entry, options)`（现有 `renderTalk`／旁白／system／reward／typing 分支原样搬入，输出带 `data-flow-entry-key`），`renderChatHistory` 改为逐条调用它；`flow-render.ts` 提供 `renderFlowEntry(ctx, entry)`，按 `FlowContent` 投影到同一入口；`ChatStream.append()` 改走共享 reducer 与同一上限，`ChatEntry` 声明可选 `contentId`／`repeatPolicy`（普通 Chat 不写入）。
- 验证：`renderChatHistory` 输出与既有测试一致（仅新增键属性）；同人连发分组在条目被移除后按数组重算；普通 Chat／角色对话流仍各自调用同一入口。
- 失败回退：`renderChatHistory` 恢复内联分支；键属性可独立保留。

### U3：按 Host 滚动与局部更新

- 交付：`FlowScroll` 按实际宿主元素工作，保存 `atBottom`／比例／锚点（实例键 + 相对偏移），提供 `capture`、`restore`（`ratio` 供 Chat、`anchor` 供 Map）、`observe`（只观察宿主内 `<img>`）与 `reset`；`ScrollManager` 的 `captureChat`／`restoreChat`／`observeChatStream`／`forceToBottom` 改为薄包装，Chat 行为与数值不变；两个 Chat 宿主补 `data-flow-host-key`／`data-flow-stream-key` 与 `role="log"`。
- 验证：贴底跟随、上翻不跳、锚点被回收后选相邻稳定条目并夹取位置、图片晚加载、流实例切换、缺失宿主、卸载清理；两个 Host 并存时互不串扰；普通 Chat 不触发整页 `render()`。
- 失败回退：Map 侧退回 U5 前的 `scrollTop` 记录；Chat 侧保留原 `ScrollManager` 实现。

### U4：Map Flow Adapter 与按 Run 隔离的流模型

- 交付：`MapFlowModel`（每个 `runId` 一份，由 Controller 持有）与纯适配函数，从 `MapRunWorkspaceView` 生成基线条目；`sync(view)` 只做「同键原位更新或保持、缺失的 `current` 条目移除、新来源追加」，不重排整份快照；`pushEnemyInfo` 写入 `gameplay-b:current-enemy-info` 逻辑槽并按 `replaceSameId` 尾插；`dispose()` 在离开 Run 时清理。为保留 Map 现有可读结算详情与语义锚点，`FlowContent` 增加受控的 `heading`／`lines`（纯文本，渲染器负责转义）与 `marks`／`headingMarks`（仅允许 `data-*`／`role`／`tabindex`／`aria-*`，值统一转义），不开放任意 HTML。
- 键与生命周期：Node／遭遇说明按 `runId + nodeId + activityId`；最近回执按 `requestId`（`observed`，会话内保留，重新进入只从 View 重建）；Shop 最近购买按 `requestId`（`observed`，仅来源可读时重建）；终态结果按 `outcome`（`current`）；敌方情报 `current` 且携带事实签名，敌人 HP 等变化即失效、不自动重投递。
- 验证：任务文档「地点说明 → 查询 A → `requestId=R1` 回执 → 查询 B」顺序；重复 `sync` 不重排、不复活的旧查询；同 `requestId` 只投影一次；不同提交不被合并；无来源时不生成历史／对白。
- 失败回退：Adapter 纯函数可丢弃；Controller 尚未接入前不影响现有 Map UI。

### U5：Map Flow Host、DOM 协调与查看情报

- 交付：`map-workspace.ts` 中部 `talk-feed` 成为 Flow Host（`data-flow-host-key`、`role="log"`），条目走 `renderFlowEntry`，保留 `data-map-current-node`、`data-map-recent-commit`、`data-map-region-key`、`data-map-focus-heading` 等既有锚点；`map-dom-updates.ts` 的 `mapNodeKey` 接入 `data-flow-entry-key`；`refreshMapWorkspaceRegion` 用 `FlowScroll` 取代自写「原在底部才跟随」；右栏每个敌方新增只读 `data-map-enemy-info` 按钮（`focus-key=enemy-info:<enemyId>`），`controller-actions-operation.ts` 委托 Controller 写入 UI 临时流，不发 `GameCommand`。
- 验证：Frame、左右列、标题、中下指挥区、未变按钮与滚动 owner 身份不变；无敌人时右栏不变成商店主面板；现有移动按钮可用；查看情报不改变领域目标选择；失效按钮不复活、不免费重抽；缺失 feed 时只恢复中栏。
- 失败回退：feed 退回 U4 前的直接拼接渲染，右栏保留情报按钮但不写入流（或整按钮回退）。

### U6：端到端回归与文档

- 交付：Battle → Rest → Shop 主流程与现有战斗／失败／Save-Resume 夹具的定向回归；通过可重复 DOM／行为自动化验证三栏节点身份、滚动与焦点；实现稳定后更新 `refresh-update.md` 与本 Task 的结果记录。
- 验证：任务文档「测试与完成定义」全部条目；`npx vitest run` 相关文件、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`；未执行项如实记录，不得写作通过。
- 失败回退：文档与测试结论按实际结果记录，不修改实现来迁就文档。

### 各 Unit 停止条件

除 [[docs/ai/PROJECT-CONSTITUTION]] 默认停止条件外，本 Task 额外停止并上报的情形：需要改 `StoryDef.talklets`／生成 Schema／MapRun 状态与保存合同；需要新增第二 UI 调度器；需要为 `FlowContent` 引入任意 HTML 插槽；`MapRunWorkspaceView` 无法提供既定验收所需来源；发现 U1 约定（键格式、`contentId` 语义、200 上限）与源码事实冲突。

## 施工 Receipt

### Receipt 0296-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/ui/flow/flow-entry.ts`、新增 `tests/ui/flow-entry.test.ts` |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | `graph_health(check="changed")` 对新增路径返回 `unreferenced_path`（尚无 Evidence／maps_to）；未改图、未刷新、未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/flow-entry.test.ts` | 通过 16/16 | 覆盖默认追加、显式回收、跨流隔离、空 ID、上限、JSON 往返、Talklet 适配、Chat 适配 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 初次失败见下 |
| 架构边界 | `npm run check:architecture` | 通过 | 新模块未被 engine／data-services 反向依赖 |
| 文档检查 | `npm run check:docs` | 通过 | errors: 0 |

#### 遇到问题

- 初版把投递形态写成 `Talklet & FlowIdentified`，而 `FlowIdentified` 的字段名是 `contentId`，导致作者字段 `id` 既不可读也无法校验。改为 `FlowTalkletInput extends Talklet` 声明 `id`／`repeatPolicy`，并在适配成 `FlowEntry` 形状后再调用 `assertFlowIdentity`；两套命名只在一处转换。

#### 需上游确认项

- 无。

#### 事实更新建议

- 普通 Chat 条目现声明可选 `contentId`／`repeatPolicy`（不写入）；后续若 Story 作者字段获准扩展，可直接透传而无需改 reducer。

### Receipt 0296-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（含一条既有失败待上游裁定） |
| 实际修改 | `src/ui/components/story.ts`、`src/ui/chat-stream.ts`、新增 `src/ui/flow/flow-render.ts`、`tests/ui/components/chat-text.test.ts` |
| 未完成内容 | `tests/ui/story-history-resume.test.ts` 的 2 条用例仍失败，失败原因与本 Unit 无关，未修复（见下）。 |
| 范围外变更 | 把 `src/ui/chat-stream.ts` 补入 U2 白名单（原表未列）：不接入共享 reducer 就无法满足「两侧复用 reducer」；已同步更新 Unit 表。未改动 `chat-stream.ts` 的指纹、门控、横幅与恢复语义。 |
| GALHCG 影响闭环 | `graph_health(check="changed")` 对 `src/ui/components/story.ts` 返回 `content_changed`，owner 为 `concept:ui-story-chat-presentation`（1 条 maps_to + 3 条 Evidence）；新增 `src/ui/flow/flow-render.ts` 为 `unreferenced_path`。未改图、未刷新、未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/flow-entry.test.ts tests/ui/components/chat-text.test.ts` | 通过 33/33 | 新增键属性、移除后分组重算、`FlowEntry` 与 Chat 单条输出完全一致 |
| 回归测试 | `npx vitest run tests/ui/chat-typing.test.ts` | 通过 30/30 | 连发分组、门控按钮、typing 气泡未回归 |
| 回归测试 | `npx vitest run tests/ui/story-history-resume.test.ts` | 失败 2/8 | 两条「返回游戏再打开 Story」用例在 `querySelector('[data-story-workspace-leave]')` 得到 null，测试中止在 `.click()`；不是断言不相等。 |
| 既有失败归因 | 把本轮 `story.ts`／`chat-stream.ts` 改动 `git stash` 后复跑同一文件 | 同样失败 2/8 | 失败在改动前已存在，与本 Unit 无关；未通过修改测试或实现来消除。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 初次失败：`ChatEntry[]` 与 `FlowIdentified` 无共同属性；以在 `ChatEntry` 声明可选策略字段解决 |
| 人工验收 | 当时未执行 | — | 当时计划在 U6 验收；负责人后续改定以自动化／DOM 验证结项，桌面浏览器不再是门槛，见 U6。 |

#### 遇到问题

- 当时 `story-history-resume` 的两条用例要求 Story 工作区存在 `[data-story-workspace-leave]`，但当时 `story-workspace.ts` 未渲染该按钮。该缺口已在 U6 修复，相关回归现通过；此历史记录不再代表当前未完成项。

#### 需上游确认项

- 当时等待决定是另立修复任务还是在 U6 修复；负责人已授权在本 Task 内解决，U6 已补齐 Story 标题栏离场按钮并通过相关回归。

#### 事实更新建议

- `refresh-update.md` 的「Chat 流」描述仍是单 `.chat-stream` 观察器；U3 落地后再更新，暂不改。

### Receipt 0296-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/ui/flow/flow-scroll.ts`、`src/ui/scroll.ts`、`src/ui/components/center-panel.ts`、`src/ui/components/contacts.ts`、`tests/ui/scroll.test.ts` |
| 未完成内容 | 无（Map 侧接入在 U5）。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | `graph_health(check="changed")` 对 `src/ui/scroll.ts` 返回 `content_changed`，owner 为 `concept:ui-overlay-focus-scroll`（1 条 maps_to + 1 条 Evidence）；新增 `src/ui/flow/flow-scroll.ts` 为 `unreferenced_path`。未改图、未刷新、未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/scroll.test.ts` | 通过 15/15 | 贴底、翻历史、图片晚加载、锚点保留、锚点被回收退相邻、多宿主隔离、缺失快照 |
| 组合回归 | `npx vitest run tests/ui/flow-entry.test.ts tests/ui/components/chat-text.test.ts tests/ui/scroll.test.ts` | 通过 48/48 | — |
| 组件回归 | `npx vitest run tests/ui/components/contacts.test.ts` | 通过 16/16 | 对话空间宿主属性未破坏渲染 |
| 工作区回归 | `npx vitest run tests/ui/contacts-story-workspace.test.ts` | 失败 7/13 | 见下，既有失败 |
| 既有失败归因 | 移出本轮 5 个改动文件后复跑同一文件 | 同样失败 7/13，用例名完全一致 | 与 U2／U3 无关；未修改测试或实现来掩盖 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 初次失败：测试向 `readonly scrollHeight` 赋值；宿主形状改为可变字段 |
| 架构边界 | `npm run check:architecture` | 通过 | — |
| 人工验收 | 当时未执行 | — | 当时计划在 U6 验收；负责人后续改定以自动化／DOM 验证结项，桌面浏览器不再是门槛，见 U6。 |

#### 遇到问题

- 恢复语义修正：初版把 `follow` 当成无条件贴底，导致「上翻历史 + 有新内容」被拽回底部；改为 `follow && state.atBottom`，与原 `ScrollManager` 语义一致（原有测试直接暴露）。
- 当时 `contacts-story-workspace` 的 7 条失败集中在 Story／Contacts Workspace 顶栏与导航（缺 `[data-story-workspace-leave]`、缺「故事导航」）；U6 已修复，当前该文件通过 13/13。

#### 需上游确认项

- 当时建议另立 Workspace 修复 Task；负责人已授权在本 Task 内修复，现有 Chat/Story 回归已通过。

#### 事实更新建议

- `refresh-update.md` 可补一句：聊天流滚动已委托 `FlowScroll`，Map 在 U5 接入 `anchor` 模式；等 U5 落地后一次性更新，避免描述半成品。

### Receipt 0296-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `src/ui/flow/map-flow-model.ts`、新增 `tests/ui/map-flow-adapter.test.ts`、`src/ui/flow/flow-entry.ts`、`src/ui/components/story.ts`、`tests/ui/components/chat-text.test.ts` |
| 未完成内容 | 无（DOM 接入在 U5）。 |
| 范围外变更 | 按 U4 表更新，把 `flow-entry.ts`／`story.ts`／`chat-text.test.ts` 纳入：Map 需要保留可读结算详情与焦点锚点，必须给 `FlowContent` 增加受控的 `heading`／`lines`／`marks`／`headingMarks`；未开放任意 HTML。 |
| GALHCG 影响闭环 | 新增 `src/ui/flow/map-flow-model.ts` 无地图关联；`story.ts` 已在 U2 复核为 `content_changed`。未改图、未刷新、未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 适配测试 | `npx vitest run tests/ui/map-flow-adapter.test.ts` | 通过 14/14 | 基线顺序、重复刷新不重排、`requestId` 幂等、地点变更、查询回收／失效、商店来源、`dispose`、终态 |
| 渲染测试 | `npx vitest run tests/ui/components/chat-text.test.ts tests/ui/map-flow-adapter.test.ts` | 通过 34/34 | 标题等级、附加行、标记白名单（`style`／`onclick` 被忽略）、Chat 单段正文不变 |
| 回归测试 | `npx vitest run tests/ui/chat-typing.test.ts` | 通过 30/30 | 气泡正文重构未改变普通 Chat 输出 |
| 类型检查 | `npx tsc --noEmit` | 通过 | — |
| 人工验收 | 当时未执行 | — | 当时计划在 U6 验收；负责人后续改定以自动化／DOM 验证结项，桌面浏览器不再是门槛，见 U6。 |

#### 遇到问题

- 初版 `sync()` 只消费 `current` 条目的键，`observed` 回执虽已保留在结果中，仍会再追加一次同名基线条目（测试「重复刷新」与「新 requestId」暴露）。改为在追加前用 `present` 集合拦截已存在实例键。
- `Array.prototype.at` 超出 tsconfig 的 ES2020 lib，测试改用本地取末项辅助函数。

#### 需上游确认项

- 无。

#### 事实更新建议

- `MapRunWorkspaceView` 的 `actionPreview.recentCommit` 与 `run.lastEncounterCommit` 字段形状不同（前者动作已解析为 `MapWorkspaceActionView`，后者只有 `actionId`）；本 Unit 用归一化视图抹平，后续若要扩字段需同步两处。

### Receipt 0296-U5

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/ui/components/map-workspace.ts`、`src/ui/workspace/map-dom-updates.ts`、`src/ui/controller.ts`、`src/ui/controller-actions-operation.ts`、`src/ui/context.ts`、`src/ui/css/map-workspace.css`、`tests/ui/gameplay-b-map-workspace.test.ts` |
| 未完成内容 | 无；移动入口、三栏划分与操作区按本 Task 要求保持原状。 |
| 范围外变更 | 更新 U5 文件表：补 `src/ui/context.ts`（承载 `MapFlowReader`，使全量 `render()` 与区域刷新共用同一 Run 级流，而不引入第二调度器）与 `tests/ui/gameplay-b-map-workspace.test.ts`（新增查看情报用例）；两处均在本 Unit 目标内。另修正该测试中两处按旧实现的滚动断言（`scrollHeight` → 真实可滚动底部）。 |
| GALHCG 影响闭环 | `graph_health(check="changed")` 对 `src/ui/controller.ts`、`src/ui/components/map-workspace.ts` 等直接改动路径只读复核为 `content_changed`（owner 仍在既有 UI 节点下）；新增 `src/ui/flow/map-flow-model.ts` 为 `unreferenced_path`。未改图、未刷新、未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts` | 通过 16/16 | 含新增「查看情报只保留最新一条且不改目标选择」；三栏身份、回执 `requestId`、滚动与焦点断言保持 |
| 定向测试 | `npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts` | 通过 3/3 | 正常入口、双角色 Commit、区域刷新次数 |
| 定向测试 | `npx vitest run tests/ui/gameplay-b-basic-map-p0-p3.test.ts` | 通过 4/4 | Battle → Rest → Shop → 出口；Rest 轮次条目与 Edge 条件 |
| 定向测试 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | 通过 6/6 | Save-Resume 后条目只重建有权威来源的内容 |
| 定向测试 | `npx vitest run tests/ui/map-dom-updates.test.ts` | 通过 4/4 | 条目键接入后节点身份与浮层范围不变 |
| 回归测试 | `npx vitest run tests/ui/scroll.test.ts` | 通过 16/16 | 流状态改为按流实例键保存后，Chat 全量重建仍能恢复比例 |
| 回归测试 | `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts` | 失败 18/33 | 与本轮基线一致（见下），无新增失败 |
| 类型检查 | `npx tsc --noEmit` | 通过 | — |
| 架构边界 | `npm run check:architecture` | 通过 | — |
| 人工验收 | 当时未执行 | — | 当时计划在 U6 验收；负责人后续改定以自动化／DOM 验证结项，桌面浏览器不再是门槛，见 U6。 |

#### 遇到问题

- 信息流滚动初次接入时无条件跟随，导致「上翻阅读 + 无新条目」也被拽到底；改为仅在实例键集合出现新键且原本贴底时跟随。
- 会话内保留旧回执后，`data-map-region-key="feed-recent-commit"` 与 `data-map-recent-commit` 同时出现在多个条目上，测试与单例语义冲突。改为：最新回执独占这两个标记，旧回执改带 `data-map-commit-receipt` 与 `feed-commit:<requestId>`。
- `FlowScroll` 初版按 DOM 元素保存状态，普通 Chat 全量 render 换节点后读不到旧比例（`gameplay-b-operation-controller` 新暴露 1 条失败）。改为按流实例键保存状态、观察器仍绑元素；Chat 使用固定 `chat` 键。
- `[data-map-rest-rounds]` 原在独立 `<p>` 上；并入条目后改挂遭遇条目根节点，`.textContent` 断言仍成立。

#### 需上游确认项

- `renderShopDock` 的「最近购买」改为信息流条目后，操作区保留一句说明文案；若负责人希望商店区完全不提购买历史，需要新的展示裁定。

#### 事实更新建议

- `refresh-update.md` 的 Map 段需要从「最近回执以 `requestId` 标识变化、只有原本位于底部才跟随」更新为「信息流按条目实例键协调，滚动由 FlowScroll 按流实例恢复」。

### Receipt 0296-U6

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（自动化与 DOM 验收通过；桌面浏览器验收按负责人最新裁定不作为本 Task 门槛） |
| 实际修改 | `docs/docs-829/06-wiki/50-ui/refresh-update.md`、本 Task、`docs/plan-work/00-index.md`；`src/ui/components/story-workspace.ts`、`contacts-workspace.ts`、`src/ui/focus.ts`、`tests/ui/focus.test.ts` |
| 未完成内容 | 无。本 Task 不再要求桌面浏览器流程或截图；以可重复的 Vitest DOM／行为回归作验收。`ui-style/` 未改动（本 Task 未新增视觉方向）。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | 对 `refresh-update.md` 只读复核：属于既有 UI 文档路径，内容已变；本轮不获得改图／刷新授权，也未写 freshness。 |

#### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Story／Contacts 回归 | `npx vitest run tests/ui/story-history-resume.test.ts tests/ui/contacts-story-workspace.test.ts --silent --reporter=dot` | 通过 21/21 | 历史恢复、工作区离场／导航、局部刷新焦点恢复 |
| 焦点身份回归 | `npx vitest run tests/ui/focus.test.ts --silent --reporter=dot` | 通过 3/3 | 唯一控件身份恢复；重复无标签按钮在原路径改变且身份不唯一时不误聚焦 |
| Task 定向回归 | 14 个核心文件：Flow、Chat、Scroll、Map Adapter／Workspace／DOM／Save-Resume、Contacts、Story 与 Focus | 通过 170/170 | Battle → Rest → Shop、Map Save-Resume、节点身份／焦点／滚动与 Story 恢复 |
| Operation Controller 回归 | `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts --silent --reporter=dot` | 失败 18/33（既有独立失败） | 失败集中在 Operation 入口准入、旧 SceneAction/目标选择器与节点身份；本 Task 对该渲染／运行时仅添加 Map 路由分支，并未改 Operation 卡片契约。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | — |
| 架构边界 | `npm run check:architecture` | 通过 | — |
| 文档检查 | `npm run check:docs` | 通过 | 885 篇 Markdown，0 错误 |
| 桌面浏览器验收 | 不再要求 | — | 按负责人最新裁定，使用可重复自动化／DOM 验收，不以桌面截图作为结项条件 |

#### 遇到问题

- Story／Contacts 回归初次暴露的缺口是 Story 左栏缺少离场标题栏，且共享焦点路径失效时过早返回；补齐标题栏，并在路径失效时仅按唯一 ID、稳定 data 属性或可唯一识别的控件身份恢复焦点。重复无标签控件不做猜测。
- 原有 `gameplay-b-operation-controller` 18 条失败复验仍在。失败用例聚焦 Operation 入口条件、操作卡／目标选项缺失和 Operation log 节点替换；本 Task 对 `controller-actions-operation.ts` 增加的代码只处理 Map Entry 与 MapRun 命令，Operation 卡片组件未由本 Task 改动。因此记录为独立现存回归，不计入 0296 的结项门槛。

#### 需上游确认项

- 无本 Task 待办。Operation Controller 的 18 条失败保留为独立 Operation Workspace 事项。

#### 事实更新建议

- U6 已补 Story 左栏「故事导航」标题及离场按钮，并修复 Workspace 区域重绘后的焦点身份恢复；`story-history-resume` 与 `contacts-story-workspace` 当前 21/21 通过。

## 测试与完成定义

- [x] P1 条目层测试覆盖类型化 Talklet 逻辑 ID／策略透传、匿名默认追加、同一流 `append`、显式 `replaceSameId` 删除多个旧实例并尾插、跨流隔离、空 ID、上限、恢复后再插入；Story 合法同页文本和不同页相同文本仍按原规则显示。
- [x] P1 普通 Chat／角色 Chat／Story 定向测试覆盖发言、旁白、图片、system/reward、typing、连发分组、演出覆盖层与 Save/Resume；Story / Contacts Workspace 回归现通过 21/21。两侧实际调用相同的通用条目 renderer。
- [x] P1 共用滚动测试覆盖贴底、历史阅读、锚点回收、图片晚加载、焦点／输入保持和多流并存，证明以 Host 实例隔离；普通 Chat 无无谓整页 render。
- [x] P2 Adapter／合流测试按「地点说明 → 查询 A → 新 `requestId` 回执 → 查询 B」逐步核对顺序、旧查询回收、快照刷新不重排／复活旧条目、查询事实变更即失效；最近回执以 `requestId` 幂等，没有领域来源时不生成历史／对白，终态只使用可读结果字段。右栏连续查看同一／不同敌人只保留最新情报，且不改变领域目标选择。
- [x] P2 Map UI 测试证明 Battle → Rest → Shop、Hand/Swap/PlayerCommand/Target/Commit、Ability/Item、购买／离开、成功／失败及 Save/Resume 保持可操作，失效按钮不会重新启用或免费重抽。
- [x] P2 DOM 测试证明 Flow 更新不替换 Frame、左右栏、现有标题、中下指挥区、未变的按钮及滚动 owner；无敌人时右栏不变成商店主面板，现有移动按钮仍可用；范围内浮层清理、范围外浮层保留，焦点和上翻阅读位置连续。
- [x] 源码调用链和测试同时证明普通 Chat 与 Map 复用共用 renderer、reducer（需要追加／回收时）和按 Host Scroll；仅复用 CSS 或增加 `.chat-stream` 类不算完成。
- [x] 相关 Vitest、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 已通过；Battle → Rest → Shop、Map Save-Resume、DOM 身份／滚动／焦点及 Chat/Story Save-Resume 均由可重复自动化覆盖。桌面浏览器自验收与截图按负责人最新裁定不再是结项门槛。Operation Controller 18/33 属于独立失败，已记录。

## 当前核验（2026-10-18）

- 首次核验：已读投递稿、Draft 0296、当前 Story/Chat/Map 关键源码、正式 Battle → Rest → Shop 样例入口与相关测试名称；当时只建立 Task，不修改运行时代码、Schema 或测试。
- 施工后：U1—U5 已实施并逐 Unit 记录 Receipt；共享条目、共享 reducer 与按流实例的滚动均已接入 Chat 与 Map，`refresh-update.md` 已同步机制说明。
- 本轮复验：14 个 Task 核心文件通过 170/170；其中 `story-history-resume` 与 `contacts-story-workspace` 通过 21/21，`focus.test.ts` 通过 3/3。`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 均通过。`gameplay-b-operation-controller` 单独复跑仍有 18/33 失败，见 U6 归因。
- 按负责人最新裁定，桌面浏览器流程与截图不作为本 Task 必需门槛；本 Task 以自动化／DOM 回归验收。

## GALHCG 影响闭环

- 发现：`graph_project(workspace_path=项目根)` 返回 `acprogram`；`graph_search(target="graph", query="Chat")` 命中 UI Story and Chat Presentation；`Talklet` 图内零命中后按路径定位 `src/data-services/contracts/story.ts` 并回到源码核实。Workspace 关系另由 UI Workspace Renderer／Operation 节点与当前文件核实。
- 本轮新建 Task 和更新计划索引后，已对两个直接影响路径运行 `graph_health(check="changed")` 只读复核：`docs/plan-work/00-index.md` 返回 `content_changed` 且分页完整；新增 Task 返回 `unreferenced_path`，表示当前地图尚无直接 Evidence／maps_to，并非文件不存在或正文错误。查询和文件改动不授权改图、刷新或写 freshness。施工模型改代码后按各 Unit 路径逐一只读复核，分页与 owner/Evidence 完整性依返回结果判断。
- 本轮补修后只读复核：`story-workspace.ts`、`focus.ts` 为 `content_changed`，owner/Evidence 返回完整；`contacts-workspace.ts` 为 `metadata_only`；本 Task 文件为 `unreferenced_path`。未改图、未刷新、未写 freshness。

## 剩余工作与后续依赖

本 Task 内：U1—U6 实现、机制文档与自动化／DOM 定向验收已完成。Operation Controller 18 条失败作为独立 Operation Workspace 事项保留。最终方向仍缺完整可存档的 MapRun 事件／结算／购买历史、真正有来源的角色对话、Rich Talklet 业务 Widget与 P3—P7 跨区域交互；这些需要独立来源与验收，不由本 Task 的 UI 临时缓存填补。

## 相关路由

[[docs/plan-work/archive/draft-0296-gameplay-b-and-chat-shared-render-pipeline]] · [[docs/plan-work/archive/task-0294-gameplay-b-three-column-button-ui]] · [[docs/plan-work/archive/task-0295-gameplay-b-basic-map-p0-p3]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/ai/goal-workflow]] · [[docs/ai/PROJECT-CONSTITUTION]]
