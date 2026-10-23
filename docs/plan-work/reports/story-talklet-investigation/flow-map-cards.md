# reports/story-talklet-investigation/flow-map-cards — Talklet 呈现、地图与卡牌能力调查

本文回答：项目中被称为 Talklet 的显示单元究竟包含哪些能力，普通 Story 作者可以声明哪些，地图与卡牌能力如何进入共享呈现，以及未来 Story 编辑工具需要面对哪些边界。

状态：investigation；日期：2026-10-22；依据：当前工作树源码、现行 docs-829、已读取测试断言和本轮定向测试。当前工作树包含其他工作中的修改，本文不是提交版本的冻结证明。本分报告运行了下文列出的 5 文件 62 项测试，未进行浏览器验收、未修改产品代码或知识图谱。

## 1. 先给上层讨论的结论

用户记忆中的“地图、卡牌、位置、ID 等丰富 Talklet 功能”有真实实现依据，但它们分布在不同层次，不能用 `src/data-services/contracts/story.ts` 中的单个 `Talklet` interface 概括。

1. **作者 Talklet** 是剧情页定义，支持普通对话、旁白、点击页、图片、回复、选项、效果、跳转、羁绊卡片、节奏等。
2. **FlowContent / FlowEntry** 是共享呈现 DTO，额外支持地图概览、地点卡选择器、附着行动卡、多行正文、标题、受控按钮和语义标记。
3. **ChatTextEntry / showChatText** 是可用临时 ID 替换、清除、按聊天窗格坐标定位的覆盖层；可嵌入 Talklet 外观，不因此运行完整 Story 页交互。
4. **MapFlowModel** 从 MapRun 只读 View 投影真实地图条目，并维护当前 UI 会话中的有限历史。
5. **卡牌宿主绑定** 将视觉副本、领域对象、关联关系、入口能力、宿主与槽分开；没有脱离业务 Owner 的通用“点卡执行脚本”能力。

两项容易被高估的能力必须特别标记：

- `FlowContent.mapCards` **已有 DTO、渲染器及渲染测试**；本次全 `src` 搜索只有类型与渲染分派引用，未发现生产适配器生成它。不能据此声称普通 Story 已能声明行动卡，或当前 Map 每轮都在流内呈现行动卡。
- `FlowTalkletInput.id/repeatPolicy` 与 `flowEntryFromTalklet()` **已有类型化适配和测试**；本次全 `src` 搜索未发现该函数的生产调用方。普通 Story→ChatStream 路径仍手工映射呈现字段，未透传这组作者扩展。

上述“未发现”均限定为本轮当前源码字面引用及直接调用链核对，不替代动态插件或未来扩展的证明。

## 2. 术语与能力层次

| 名称 | 位置 | 负责什么 | 不承担什么 |
| --- | --- | --- | --- |
| `Talklet` | `src/data-services/contracts/story.ts` | StoryDef 的一个演出/交互页面 | 地图 DTO、通用 DOM 标记、Flow 实例身份 |
| `EngineTalklet` | `src/engine/contracts/talklet.ts` | Effect 内嵌演出载荷的最小结构 | 完整 Story 执行语义 |
| `ChatEntry` | `src/ui/components/story/story.ts:30` | 普通聊天历史的一条实际消息 | 剧情页效果与跳转执行 |
| `ChatTextEntry` | 同文件 `:60` | 可定位、可擦除的演出覆盖层 | 普通历史条目或独立剧情游标 |
| `FlowContent` | `src/ui/flow/flow-entry.ts:107` | 共享渲染输入 | 业务状态写入、Owner 校验 |
| `FlowEntry` | 同文件 `:150` | FlowContent + 流/实例/逻辑身份与生命周期 | Story 的页身份、地图领域对象身份 |
| `MapFlowModel` | `src/ui/flow/map-flow-model.ts:455` | 当前 Run 的 UI 条目序列与只读投影 | MapRun Owner、持久事件日志 |
| `MapCardBinding` | `src/ui/cards/card-host.ts:40` | 同一对象在某个宿主上的视觉入口 | 新卡牌领域 zone 或自由命令授权 |

现行解释入口：[[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/docs-829/06-wiki/30-arona-clicker-domain/story-and-chat]]。

## 3. Flow 呈现字段全集

源码：`src/ui/flow/flow-entry.ts:18–157`。以下是渲染能力，不表示每个字段都已成为 Datapack Story 作者字段。

| 字段 | 类型/含义 | 实际消费与限制 | Story 作者直接可用 |
| --- | --- | --- | --- |
| `kind` | talk/map/narration/system/reward/typing | renderer 的分派依据 | 仅 talk/narration/click；click 不入流 |
| `text` | 正文 | 转义文本 | 是 |
| `speaker` | 名称 | 气泡名称与头像匹配依据 | 是 |
| `heading` | 1/2 | 气泡正文标题 | 否 |
| `lines` | string[] | 每条转义为独立段落 | 否 |
| `actions` | FlowAction[] | 气泡中的受控按钮，见下文 | 否 |
| `mapOverview` | 地图名+地点列表 | 仅 `kind=map` 分支消费 | 否 |
| `mapCards` | FlowMapCard[] | 非空时优先渲染卡牌面板 | 否 |
| `mapLocations` | FlowMapLocations | 普通 talk 气泡内的地点卡落点 | 否 |
| `marks` | 属性表 | 根节点白名单属性 | 否 |
| `headingMarks` | 属性表 | 标题节点白名单属性 | 否 |
| `isPlayer` | boolean | 缺省 side 推断、玩家身份 | 没有该字段；回复由 UI 生成 |
| `align` | center/left/right | 旁白分支对齐 | 是，另供选择卡对齐 |
| `avatar` | 图片引用/URL | PicSystem 解析与降级 | 是 |
| `image` | 图片引用/URL | 气泡内正文上方图片 | 是 |
| `side` | left/right | 气泡侧，缺省由 isPlayer 推断 | 是 |
| `noAvatar` | boolean | 不画头像 | 是 |
| `showAvatar` | boolean | 普通聊天连发分组中强制显示身份 | 是；Flow renderer 本身不自动分组 |

### 3.1 字段组合不是任意 Widget 组合

`src/ui/components/story/story.ts:354` 的 `renderChatEntry()` 按以下优先级返回：

```text
mapCards 非空 → renderMapCards（直接返回）
否则 kind=map → renderMapTalklet
否则 kind=narration → renderNarration
否则 kind=typing → renderTyping
否则 kind=system → 系统行
否则 kind=reward → 奖励/通知小条
否则 → renderTalk
```

因此：

- `mapCards` 会覆盖同条目的地图/气泡/旁白正文渲染，不是附加到气泡末尾的任意插槽。
- `mapLocations` 只由 `renderTalk()` 放进气泡，配置到 narration/system/reward/map 分支不会得到相同控件。
- `heading/lines/actions/image` 的主要组合宿主是 talk 气泡；旁白和系统/奖励分支只消费自己的字段子集。
- `showAvatar` 的分组语义由 `renderChatHistory()` 处理；直接 `renderFlowEntries()` 只按数组逐条渲染，不计算普通 Chat 的同人分组。
- 当前没有数据包输入任意 HTML 插槽的契约。

### 3.2 受控按钮与标记

`FlowAction`：`label`、可选 `detail`、可选 `disabled`、`marks`。`renderBubbleContent()` 输出固定结构的 button，文本全部转义。

`FlowMarks` 属性名只接受 `/^(?:data-[a-z0-9-]+|role|tabindex|aria-[a-z-]+)$/i`，值为 string 或 true；true 输出无值属性，空字符串跳过。`onclick`、style 等任意属性不会通过。

额外排除卡牌专属保留属性，例如 `data-map-object-key`、`data-map-relation-key`、`data-map-instance-key`、`data-map-card-entry`、宿主/槽/usage/option/target-edit 标记。这些只能由类型化卡牌 renderer 构造，不能靠通用 marks 获得入口能力。

`actions` 的存在只说明可以画按钮。实际点击仍需要宿主 Controller 对属性进行委托并验证。当前 `MapFlowModel` 未通过 `actions` 生成移动器；移动器已经是类型化 `mapLocations`。

证据：`story.ts:135`、`:157`；`card-host.ts:134`；`tests/ui/components/chat-text.test.ts:254`、`:296`。

## 4. 六种身份，不能合并成一个 id

| 身份 | 例子 | 作用 | 重要边界 |
| --- | --- | --- | --- |
| StoryEntry ID | `base:activestory:...` | 剧情入口与执行来源 | 跳转期间来源 Entry 可保持不变 |
| StoryDef ID + 页码 | StoryDef + pageIndex | 当前内容位置 | 页码随作者插入/排序变化 |
| `storyPageKey` | JSON `[Entry, StoryDef, pageIndex]` | 已送达剧情页同步去重 | 不是内容逻辑 ID，也不按文本去重 |
| `ChatEntry.id` / `instanceKey` | `17` / `chat:17` | 消息实例与 DOM/滚动协调 | 不是 Story 页或领域卡 ID |
| `contentId` | `gameplay-b:move-choices` | 显式回收同逻辑内容 | 只在 replaceSameId 策略触发 |
| 卡牌 `objectKey` + `relationKey` | 编码的 MapRun 对象 / 关系 | 当前真实业务对象、操作来源 | 不等于视觉副本 instanceKey |

另外 `streamKey` 隔离流实例；`source.kind/id` 只提供来源诊断与协调，不参与 reducer 回收。

`mapInstanceKey(sourceKind, sourceId)` 生成 `map:<kind>:<id>`；MapFlow 的 streamKey 是 `map:<runId>`。卡牌副本 instanceKey 则用 `mapCardInstanceKey(host, slot, objectKey)` 生成 `host::slot::objectKey`。

## 5. 投递、替换和裁剪的精确行为

源码：`flow-entry.ts:194`、`:213`、`:227`、`:247`。

1. 缺省策略是 append，同 contentId 的合法重复仍保留。
2. replaceSameId 必须给 trim 后非空的 contentId；无效策略或空 ID 在写入前抛错。
3. 比较 contentId 时 trim，透传字段本身不因此被重写。
4. replaceSameId 清除当前数组中全部同逻辑 ID 旧条目，再把新实例追加到末尾。
5. 先回收，后裁剪；默认最多 200 条，丢弃最旧超额条目。
6. 上限先 floor 并夹到不小于 0；非有限值回默认 200。
7. `applyFlowEntry()` 返回新数组；`applyFlowEntryInPlace()` 保持原数组 identity。
8. `deliverFlowEntry()` 检查条目 streamKey 与流匹配，拒绝跨流写入。底层数组 reducer 本身没有流参数，跨流隔离依赖调用方选对数组。
9. reducer 不检查 instanceKey 的唯一性，也不执行 current/observed 生命周期；它只处理逻辑回收与上限。

`FlowTalkletInput` 在普通 Talklet 上添加 `id/repeatPolicy`；适配为 `FlowEntry.contentId/repeatPolicy`。适配函数还透传基本呈现字段、来源和生命周期；click 返回 null；effects/choices/jump/sendText/typing/thinking/kizuna 不在该适配的 Flow 输出中执行或渲染。

普通 Chat 的 `chatEntryToFlowContent()` 不带 contentId/repeatPolicy；`chatEntryToFlowEntry()` 映射为 observed、`chat:<数字id>`、source.kind=chat。ChatStream 自身追加仍使用共享 reducer，但正常剧情页没有逻辑回收字段。

测试：`tests/ui/flow-entry.test.ts` 的默认追加、回收所有重复、跨流隔离、空 ID、无效策略、先回收后裁剪、序列化往返、Talklet 适配、click 不入流与 Chat 投影均有断言；该文件由总报告负责人另行运行，本分报告不重复计入。

## 6. 地图概览：真实产品入口，但不是 Story 作者地图字段

`MapFlowModel.toggleMapOverview(view)`（`:537`）创建 observed 条目：

- contentId=`gameplay-b:map-overview`，replaceSameId；每次新增概览使用递增 sequence 的实例键。
- 地图节点可读取且包含当前位置时，kind=map，`mapOverview` 给地图名和按定义顺序的节点列表。
- 每个节点只有 title、state、stateLabel。state 优先级：current > completed > visited > unvisited。
- renderer 画有序地点胶囊与状态；当前位置带 aria-current=location。
- 这不是空间拓扑图、可拖拽节点编辑器或通用导航地图。该 DTO 不含边、坐标、子图、相机，也不提供地点点击命令。
- 地图不可读取时投递居中旁白“当前地图地点信息暂不可读取”。
- 已有概览位于流末两条中时再次点击会移除；不在末两条时回收旧概览并把新快照追加到末尾。
- observed 概览保持查询时快照，不由后续 sync 改为实时地图。

Renderer：`story.ts:269`。正式 Map Flow Host：`components/map-workspace.ts:375`，使用同一 `renderFlowEntries()`，并声明 role=log、flow host/stream key。

## 7. 地点卡：真实投影、真实选择与移动命令

### 7.1 谁生成

`mapLocationChoices()`（`map-flow-model.ts:48`）只在以下条件全部满足时生成候选：Run inProgress；没有 activeEncounterNodeId；没有 activeActivity；所有地点活动已完成。

候选来自 map.edges 中从 currentNodeId 出发的边，再查目标节点；找不到节点的边跳过。当前边条件投影为资源数量门槛；未满足的地点仍呈现但不可选，带原因。

`FlowMapLocations` 完整字段：runId、mapId、fromNodeId、可选 hostLayout、locations[]。

每个 `FlowMapLocation`：instanceKey、objectKey、ref、title、可选 description、stateLabel、selectable、可选 unavailableReason。ref 为 `{kind:'mapNode',runId,mapId,nodeId}`；objectKey 用四字段 JSON 数组编码。

`moveChoicesEntry()`（`:623`）将它装配为一个 talk/noAvatar 条目，speaker=移动，text=选择目的地点，heading=2，contentId=`gameplay-b:move-choices`、replaceSameId、current；实例键按来源 Node 稳定。

### 7.2 单条 Talklet 的落点呈现

`renderTalk()` 在标准气泡正文后调用 `renderMapLocations()`（`story.ts:321`）。所有候选装在一个 `.flow-map-locations__landing` 宿主中。

- 卡面复用 `renderMapActionCardButton()`；当前 CSS 固定 82×58。
- 宿主 alignment 支持 left/center/right，gapPx 夹取到 0..64；当前生产投影为 left、12px。
- 卡牌微旋转基于稳定视觉实例 key，刷新不会重新随机。
- selectable 时只给 `selectLocation` 入口；锁定卡不给入口并 disabled。
- 每张卡保留 host-ref、slot、instanceKey、objectKey、live usage。
- 当前条目内部没有独立提交按钮；统一由 Workspace 底部 Click 提交。

### 7.3 选择与提交分离

链路：

```text
MapRunWorkspaceView → mapLocationChoices → FlowEntry.mapLocations
 → renderMapLocations → typed card DOM
 → MapRelationInteraction.selectLocation（仅 UI 待选）
 → Workspace Click → commitSelectedLocation
 → UIController.commitMapLocationFromFlow
 → GameCommands.moveMap → MapRun Owner
 → 成功后 MapFlowModel.recordMovement
```

卡点击只选择，改选覆盖待选；Hover/Focus 只检查，不选择。地点选择模式与目标编辑模式互斥。失败保留仍有效选择并显示原因；候选、来源位置或 Run 改变时清空过期选择。

`controller.ts:682` 重新查询并核对当前路由、Run、mapId、来源 Node、ref.kind、objectKey、活动完成、边存在、节点存在与条件满足。命令抛错或结果未移动不追加移动历史。

成功后 `recordMovement()`（`:583`）清除旧移动器，追加 observed 旁白“从…移动到了…”。重新 sync 或读档不凭前后位置差异伪造历史。

证据：`tests/ui/map-location-card-render.test.ts`；`tests/ui/map-relation-interaction.test.ts:204–287`；`tests/ui/map-flow-adapter.test.ts:318`。

## 8. 行动卡附着：已有 renderer，但本轮没有生产流来源

`FlowMapCard`（`flow-entry.ts:68`）字段：instanceKey、objectKey、可选 relationKey、entries（inspect/target 的子集）、ownerName、actionName、可选 description、stateLabel、可选 scost、zone（hand/playerCommand/enemyIntent）。

`renderMapCards()`（`story.ts:293`）输出关联卡牌 section + 宿主列表，调用 `renderAttachedCardFace()`。卡牌绑定为 live、可检查/可作为合法目标；这里没有 editTarget 或 replace 入口。

- 多卡支持是数组级真实渲染能力。
- 每卡标题为 actionName，副标题为 ownerName，meta 显示 sCost。
- relationKey 只在当前卡确实对应一条来源关系时附带。
- zone 是 DTO 的来源标签，当前此 renderer 不以它分支产生不同操作。
- 卡牌优先分派会替代普通气泡正文；若未来要“对话+卡组”复合节点，需要另行明确组合契约。

**覆盖状态：** `tests/ui/components/chat-text.test.ts:222` 手工构造带 mapCards 的 FlowEntry，验证卡面、数值、绑定与只读入口。全 src 搜索 `mapCards` 未见 MapFlowModel 或其他生产方赋值；`tests/ui/map-flow-adapter.test.ts:374` 明确测试“不把每轮准备行动重复投影到 Flow”。因此它属于已实现且有测试的渲染基础设施，尚不能说是当前 Story 作者可用、或正式 Map 中已经普遍投递的功能。

## 9. 卡牌宿主模型的复用能力与约束

源码：`src/ui/cards/card-host.ts`、`cards/card-face.ts`、`workspace/map-relation-interaction.ts`。

### 9.1 三个层次

- 领域对象：objectKey 关联当前 Run 的同一对象。
- 视觉副本：instanceKey 区分同一对象在不同 host/slot 的拷贝。
- 静态挂载：hostId/slotId 描述 DOM 宿主关系，不表示作用目标关系。

`MapCardUsage` 支持 live、replacement、history、offer；`MapCardEntry` 支持 inspect、editTarget、replace、target、selectLocation。并非每个 usage 或宿主都开放所有入口。

同一个真实卡可以有多个视觉副本，保持同 objectKey、不同 instanceKey。替换报价可以只有 optionId 和实例身份而没有真实对象 key。历史副本不得凭过去的 source 继续作为当前命令来源。

### 9.2 命令合法性来自 Owner

组件只输出绑定。Interaction 的来源选择、目标命中等还查询当前 `MapActionRelation`；Controller adapter 再经 Run、scope、draft 和 Owner 候选确认。单靠 DOM 上有 data 属性不能证明命令合法。

已存在的真实单位/卡牌目标编辑支持：当前关系来源检查、合法目标候选、点击/拖拽确认、取消和来源失效清理；但不能因为同一机制可识别卡牌，推断普通 Story 已有跨 Run 卡牌命令。

测试证据：`tests/ui/card-host.test.ts` 的多宿主身份、binding 分层、无真实卡替换报价、地点 identity、保留标记；`tests/ui/map-relation-interaction.test.ts` 的 Owner 候选确认、版本变化取消、拖拽一次确认、遮挡/取消不提交。

## 10. MapFlow 序列、生命周期与历史

源码：`map-flow-model.ts:478` 的 `sync()`。

| 生产条目 | lifecycle | 内容来源 | 来源消失后的行为 |
| --- | --- | --- | --- |
| 当前地点 | current | 当前节点 title/description | 移除，新的地点追加 |
| 当前遭遇 | current | currentEncounter | 遭遇消失即移除 |
| 移动选择器 | current | 当前相邻边/条件 | 不满足准入即移除 |
| 最近购买 | current | shop.lastPurchase + 当前 offers | 来源不可读即移除，不是购买全集 |
| 结算回执 | observed | actionPreview.recentCommit，缺省回退 run.lastEncounterCommit | 会话内保留旧回执 |
| 地图概览 | observed | 用户查询时 View | 会话保留，可 toggle/替换 |
| 移动旁白 | observed | 已成功的移动命令 | 会话保留 |
| 成功/失败结果 | current | retained result / failure view | 随终态视图变化 |

算法：为当前 baseline 建 instanceKey→entry；遍历旧 entries，observed 原样保留，current 只保留 baseline 中仍存在的实例并原位更新；最后把新来源按 baseline 顺序尾插，避免每次快照把历史重排。

同 requestId 的回执不重复添加；只有最新一条回执拥有 `data-map-recent-commit` 和单例 region key，旧回执保留自己的 requestId。新建 MapFlowModel 时只能从当前 View 重建可读取的最近来源，无法重造全部往事。

**current/observed 是 MapFlowModel 解释的语义，不是 reducer 自动执行的策略。** FlowEntry 注释称缺省 current，但该 sync 实际把 `existing.lifecycle !== 'current'` 的条目保留；未来新增生产方应显式指定 lifecycle，避免依赖含糊缺省。

`dispose()` 清 entries 和 sequence；Controller 的离开 Run、读档、销毁沿 `disposeMapFlow()`（`controller.ts:2035` 附近）清模型、关系临时态与 Flow 滚动。MapFlow 不是 MapRun Save 的持久化成员。

## 11. 普通聊天、显示节奏与历史的边界

`ChatStream.syncCurrentStory()` 把 StoryView.page 手工投影到 ChatEntry：文本、speaker、kind、storyType、align、avatar、image、side、noAvatar、showAvatar；click 页纯底部交互，不进入消息历史。

- `storyPageKey` 包含 Entry、实际 StoryDef、pageIndex，避免 insert 子剧情同页码被误去重。
- 非右侧普通 talk 默认有 typing/thinking；消息送达与按钮可推进是不同阶段。
- 连发资格来自 UI，对应自动推进回调；没有按钮需求的左侧 talk 才进入连发。
- renderer 的同人分组比较 speaker、avatar、有效 side、isPlayer、noAvatar；旁白/系统/奖励等打断；showAvatar 可强制完整显示头像与名称。
- 图片经 `ctx.game.pics.urlOf()` 解析，失败不渲染该图片；头像优先显式图片，再按角色差分展示名/name/id 找装备或声明的 ColorGroup，最后首字母占位。

普通 Chat 历史可通过 Controller 写入主 SaveData，恢复时重建消息 ID 计数与当前页同步指纹。未送达 typing 不作为已送达历史持久化；这与 MapFlow 仅当前 UI 会话历史不同。

本文未重新展开 Effect 定位覆盖层的全套字段；`ChatTextEntry` 的坐标与 id、Talklet 内嵌样式由另一分报告调查。这里需要保留的结论是：覆盖层 Talklet 复用外观，不经过 StoryDef.talklets 数组，也不自动拥有剧情推进游标。

## 12. 滚动与 DOM 连续性

源码：`flow-scroll.ts:115`、`components/map-workspace.ts:375`、`workspace/map-dom-updates.ts`；现行文档：[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

- 状态按 streamKey 保存，不能按一次性 DOM 元素当唯一身份。
- 距底 24px 内视为贴底；有新内容时只跟随原本贴底的读者。
- ratio 模式保留普通 Chat 比例行为；anchor 模式记录可见条目 instanceKey 和相对偏移。
- 原锚点被回收时退到相邻索引的稳定条目；没有几何信息时保留原 scrollTop。
- 图片异步撑高由 ResizeObserver 协助跟随；用户上翻后停止拉回底部。
- DOM 重建前 capture 断开旧观察；reset 断开全部监听与观察并清快照。
- Map patch 保留工作区 Frame、列、滚动宿主与仍有效控件；同来源刷新原位协调，新增实例才考虑贴底跟随。

因此未来若把 Talklet 编辑为可重排/替换的复合节点，稳定实例 key、逻辑内容 ID、历史身份与滚动锚点不能混为一个字段。

## 13. 两段当前可执行形态的例子

以下是与源码契约等价的说明性输入，不代表新加入产品内容。

### A. 带逻辑 ID 的类型化 Talklet 投递

```ts
flowEntryFromTalklet({
  streamKey: 'map:run-1',
  instanceKey: 'note:delivery:2',
  lifecycle: 'observed',
  talklet: {
    id: 'field-note', repeatPolicy: 'replaceSameId',
    text: '更新后的现场记录', speaker: '阿罗娜',
  },
});
```

结果 contentId=field-note；追加到同流 reducer 时回收旧同逻辑记录。这不表示把相同对象写进 StoryDef 就会自动透传 ID；普通 Story 作者契约尚无该字段。

### B. 当前正式地图移动条目的结构

```text
FlowEntry(kind=talk, contentId=gameplay-b:move-choices, lifecycle=current)
  text=选择目的地点
  mapLocations(runId, mapId, fromNodeId, hostLayout)
    locations[ { ref(mapNode...), objectKey, instanceKey,
                 title, stateLabel, selectable, unavailableReason? } ]
```

它画标准气泡+地点卡；选卡不移动；Workspace Click 经当前 Owner 重验后移动。不是 `Talklet.effects=[travelToArea]` 的同一条领域路径。

## 14. 测试证据目录与实际覆盖

| 测试文件 | 可据此认定的行为 | 不能据此认定 |
| --- | --- | --- |
| `tests/ui/flow-entry.test.ts` | 回收、追加、身份映射、边界、上限、序列化 | Story 编辑器已经接入逻辑 ID |
| `tests/ui/components/chat-text.test.ts:160` 起 | 共用实例键、renderer 分派、多行、行动卡 DTO、白名单 | mapCards 已有正式业务生产方 |
| `tests/ui/components/chat-image.test.ts` | Pic 引用、图片降级、ColorGroup 头像与正式自拍内容 | 任意资产类型/脚本 |
| `tests/ui/map-location-card-render.test.ts` | 单一气泡宿主、固定卡面、typed 属性、无独立提交按钮 | 移动命令本身成功 |
| `tests/ui/map-flow-adapter.test.ts` | 当前/历史协调、回执顺序与重建边界、移动准入投影 | 完整持久 Map 历史日志 |
| `tests/ui/card-host.test.ts` | 副本/对象/宿主/入口身份分离 | 任意宿主都能执行命令 |
| `tests/ui/map-relation-interaction.test.ts` | 选择/提交分离、失效清理、目标合法性与取消 | 普通 Story 具备同等 Map 交互能力 |
| `tests/ui/scroll.test.ts` | 贴底、图像撑高、实例隔离、锚点回收与 DOM 替换 | 本轮浏览器体验已验收 |
| `tests/ui/story-history-resume.test.ts` | Story 页恢复去重、相同文本不同页、insert、消息 ID | 任意 Talklet 结构编辑后旧存档映射正确 |

本分报告实际运行：

```text
npx vitest run tests/ui/map-flow-adapter.test.ts
  tests/ui/map-location-card-render.test.ts tests/ui/card-host.test.ts
  tests/ui/map-relation-interaction.test.ts tests/ui/scroll.test.ts --silent
```

结果：5 文件全部通过、62/62 项通过（adapter 19、地点 renderer 2、card host 5、interaction 20、scroll 16）。这是 happy-dom/纯数据定向行为覆盖，不等于真实浏览器或完整 Story 编辑工具验收。输出中出现 Node localStorage experimental warning，没有影响该次结果。

## 15. 给上层 Chat 的待裁定问题

以下为调查推导的问题，不是已批准设计。

1. 新 Talklet 是要统一所有“可见条目”，还是保留 Story 页、通用 Flow、业务 Widget 与覆盖层几种身份？目标决定作者 schema 是否应包含地图/卡牌。
2. 编辑器中的单节点是否允许正文、地图、卡组、按钮同时存在？当前 renderer 有优先返回，不能直接把可选字段加起来当组合模型。
3. 行动卡是静态展示、当前领域对象副本、可作为目标，还是可执行行动？它们需要不同的绑定与 Owner 协作。
4. 稳定内容 ID、播放位置 ID、投递实例 ID、替换逻辑 ID 是否分开？目前各层已有不同语义，应显式迁移而非强行复用。
5. current/observed 是否升级为公共执行语义？目前只有 MapFlow 的 sync 真正解释它，普通数组 reducer 不解释。
6. Story 编辑预览是否要支持 MapRun 上下文？若没有当前 Run、scope、draft 和候选，卡牌预览只能证明外观，不能证明可执行。
7. 定位覆盖层与正常流内消息是否共享编辑节点但使用不同投递方式？坐标锚定、历史、重读和清理语义要各自确定。
8. 地图“概览”是否要扩展成真正拓扑地图或复用 AreaMap？当前只读地点胶囊不代表空间导航能力。
9. 历史可否重建、持久保存、撤销和重新编辑？MapFlow 会话记录与普通 Chat Save 的行为不同。
10. 今后如何验证能力完整性？至少应同时列出作者字段、适配器、领域执行、renderer、正式内容入口和行为测试，避免只有 renderer 就被当作完整功能。

## 16. 读取边界与复核方式

本次完成项目身份入口核对，project_id=`acprogram`；现行文档按 UI/数据流路由读取。没有写图或刷新索引。

主读文件：`src/ui/flow/flow-entry.ts`、`flow-render.ts`、`map-flow-model.ts`、`flow-scroll.ts`、`src/ui/components/story/story.ts`、`map-workspace.ts`、`src/ui/cards/card-host.ts`、`src/ui/workspace/map-relation-interaction.ts`、`src/ui/controller/controller.ts`、`chat-stream.ts`、`controller-actions-story.ts` 与上表测试。

上层讨论后若决定施工，应回到当前文件重核：本报告行号只定位本次工作树，不能抵抗其他任务后续修改。历史 Task 0296/0300 可说明设计来源，但本报告的实现结论没有以其完成状态替代源码证明。

### 可点击源码与测试索引

以下链接均相对于本报告所在目录；行号请配合正文中的符号定位。

- [Flow 全部 DTO、reducer 与适配器](../../../../src/ui/flow/flow-entry.ts)
- [MapFlowModel 与真实地图条目生产](../../../../src/ui/flow/map-flow-model.ts)
- [共享 renderer、地图/行动卡/地点卡分派](../../../../src/ui/components/story/story.ts)
- [Map Workspace Flow 宿主](../../../../src/ui/components/map/map-workspace.ts)
- [卡牌宿主与入口绑定](../../../../src/ui/cards/card-host.ts)
- [卡牌与地点卡交互](../../../../src/ui/workspace/map-relation-interaction.ts)
- [Controller Owner 重验与 moveMap 提交](../../../../src/ui/controller/controller.ts)
- [按流保存的滚动状态](../../../../src/ui/flow/flow-scroll.ts)
- [普通 Story 消息投递与节奏](../../../../src/ui/presentation/chat-stream.ts)
- [MapFlow adapter 测试](../../../../tests/ui/map-flow-adapter.test.ts)
- [地点卡 renderer 测试](../../../../tests/ui/map-location-card-render.test.ts)
- [卡牌宿主测试](../../../../tests/ui/card-host.test.ts)
- [交互测试](../../../../tests/ui/map-relation-interaction.test.ts)
- [滚动测试](../../../../tests/ui/scroll.test.ts)
- [共享 renderer 测试](../../../../tests/ui/components/chat-text.test.ts)
