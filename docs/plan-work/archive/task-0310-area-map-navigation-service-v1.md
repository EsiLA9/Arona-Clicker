# Task 0310：Area-Map 节点导航服务 V1

状态：completed — 已完成 P0—P4 实施、定向验证与桌面浏览器验收。2026-10-21 按用户要求由区域地图 Task 0308 改编号为 0310；ActiveStory 投递的 Task 0308 保持独立。

## 实际交付（2026-10-21）

- 已实现 areaMaps / area-map / navigationMapId、JSON/ZIP 装载、形状与最终有效集引用校验，以及生成 Schema 与作者引用元数据。Pic 图标使用既有 kind(pic) 格式。
- GameReadModel.areaMap 提供单图脱敏查询；正常旅行预检和原命令共享准入。直接初始化先验证候选集，失败不清空当前运行内容。
- 地图入口、三栏工作区、按访问顺序的浏览历史、每图最近相机、平移/锚点缩放、详情与显式移动已接线；会话只属于 UI。Hero/地图共用前台 gate，故事结束后入口原位恢复。
- 选择、跨图、Reveal 与操作反馈保留 Frame/viewport/滚动宿主；成功移动退出并排一次通知，失败保留会话；外部移动、读档、换线、受保护故事、销毁及显式导航释放会话。
- DEV 演示入口：/src/ui/index.html?areaMapDemo=1，真实 JSON 通过 FolderPackSource 装载；临时 GameInstance 与内存存档隔离普通游戏。
- 新增 49 项测试全部通过；最终跨域回归为 351/356 通过，其余 5 条是并行 StoryAvailabilityDeliveryMount 扩展后未同步的 Story 测试。类型/架构/生产构建通过；check:docs 保留 8 个既有 Operation 失效引用。详见 [[docs/plan-work/archive/task-0310-units/receipts/receipt-task-0310-final]]。

当前稳定机制见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]。下方原推荐方案与调查表作为施工设计来源保留，当前事实以源码、测试和上述机制文档为准。

### 施工清单

| Unit | 完成内容 |
| --- | --- |
| [[docs/plan-work/archive/task-0310-units/task-0310-u01-contracts]] | 独立契约 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u02-registry]] | 登记与验证 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u03-pack-loading]] | 包解析与启用集 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u04-schema]] | Schema |
| [[docs/plan-work/archive/task-0310-units/task-0310-u05-authoring]] | 作者字段与引用 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u06-travel]] | 共享移动预检 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u07-query]] | 脱敏查询 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u08-foreground]] | 共享前台门控 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u09-session]] | 会话/路由 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u10-workspace]] | 三栏工作区 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u11-dom]] | 局部 DOM |
| [[docs/plan-work/archive/task-0310-units/task-0310-u12-camera]] | 相机 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u13-controller]] | 控制器 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u14-demo]] | 真实演示包 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u15-integration-tests]] | 行为集成测试 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u16-runtime-admission]] | 初始化原子准入 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u17-current-docs]] | 现行文档 |
| [[docs/plan-work/archive/task-0310-units/task-0310-u18-entry-refresh]] | 入口状态刷新 |


## 目标与授权

本文回答：如何以数据包声明独立的区域导航 Map，并在主游戏三栏中安全浏览、跨图和尝试 Area 移动。

来源：用户于 2026-10-21 提供完整需求，初稿只调查与创建 Task；后续明确要求更名为 Task0310 并 Goal 执行，本次据此完成施工。

最终玩家结果：AreaHero 下方增加独立地图按钮；打开后左栏继续显示真实当前 Area 的 Switch、AreaHero 和临近区域，中栏显示当前一张节点图，右栏显示 Map／所选节点详情。浏览 Map、选节点、平移缩放不改游戏位置；只有显式“尝试前往”才调用现有 Area 移动命令，成功后关闭地图并恢复正常游戏。

本 Task 与 [[docs/plan-work/task-0306-area-hero-workspace-and-story-entry]] 相邻但独立：不实施或重塑 Hero 的信息概览、主动故事、提醒小标及历史重播职责；只复用其前台准入规则。Hero 不可用或该 Task 尚未验收，不等于可以省略地图门控。

## 不可混淆的四类关系

1. **Area → 入口 Map**：Area 可选关联一个 Map；多个 Area 可以共享 Map。Map 不拥有 Area、不要求有 Init 归属，不要求含对应 Area 节点。
2. **MapNode → 行为目标**：节点可以只展示信息、引用 Area 或引用另一 Map；节点不等于 Area，外观不决定行为。
3. **Map 内 Edge**：只连接本 Map 的局部节点，只是图形关系，不赋予可达权限、不执行移动，不建立路径规划。
4. **UI 浏览历史**：记录玩家本次看图顺序，与 Map 引用图独立；允许 A→B→C→A 和交叉引用，不构造父图、子图、根图或递归展开。

## 施工前调查基线与最小修正策略（历史设计记录）

以下事实为创建 Task 时的调查基线；施工期间 Story／AreaHero、MapRun 等并行工作继续演进，已逐个核对集成点并保留其改动。Task 状态文本不能代替实际源码；本轮新增机制和最终验证以页首交付记录为准。

| 主题 | 当前源码依据与事实 | 冲突／最小修正 |
| --- | --- | --- |
| 已有 Map 含义 | `src/data-services/contracts/gameplay-map.ts` 的 `GameplayMapDef`；Datapack `maps`、Registry `maps`、实体 type `map` 已用于 Gameplay B，包含起点、出口、队伍、HP、局内资源与 Encounter | 新增独立 `areaMaps` 表、`AreaMapDef` 和 `area-map` ID 类型；不扩展 GameplayMapDef 承担第二语义，不复用 MapRun 或其存档 |
| Area 契约 | `src/data-services/contracts/world.ts` 的 `AreaDef` 当前有 initId、defaultSpots、adjacentAreaIds、revealTriggers、表现等，未声明入口导航 Map | 新增可选 `navigationMapId`，保持旧包无此字段时不显示可用入口；不把入口映射塞进 UI 常量 |
| 当前左栏／Hero | `src/ui/components/rail.ts` 的 `renderAreaTab` 已出现 `data-area-workspace-open`，使用 `story.isBlockingInteraction()`；临近区域从 `availableAreaIds` 取得 | 在 Hero 下另加地图入口，保留 Hero 操作和实体表现选项；不可只依据上一轮“hero 是纯展示”的调查施工 |
| Area Workspace | `src/ui/workspace/workspace-router.ts` 当前有 `area`、`map(runId)` 路由；`src/ui/components/area-workspace.ts` 已有复用左栏的概览占位工作区 | 用独立 `area-map` 路由，保留 `area`；`map` 仍指 Gameplay B。新模块可参考现有 Area 工作区左栏组合 |
| 返回状态 | `WorkspaceNavigationState.returnTo` 是单层位置；`UIController.enterWorkspaceRoute` 每次记录来源，`replaceWorkspaceRoute` 保留来源 | 浏览历史由地图 UI 会话独立持有；切 Map 不反复 enter Workspace，不将顶层返回改为全局历史栈 |
| 移动权威 | `src/arona-clicker/services/init-service.ts` 的 `travelToArea` 顺序检查存在、同 Init、Story 阻塞、AlreadyThere、动态可达与可见性 | 继续调用 `GameCommands.travelToArea(areaId)`，使用默认 `allowDuringStory=false / checkAdjacency=true`；禁止使用剧情特权 true／false 绕行 |
| 移动成功副作用 | 同方法清理可打断 passive、更新当前位置／首访、播种 defaultSpots、记录统计、发 `areaEntered`、应用 enterEffects、刷新 Visibility／Affector／Milestone；`GameInstance.travelToArea` 还重检学生阻断 | Map 不自行设置 currentAreaId，不重放 enterEffects，不手工再发 areaEntered；兼容这个既有链路，不顺便重构其写入方式 |
| 动态可达 | `src/arona-clicker/runtime-game-instance.ts` 的 `availableAreaIds` 合并静态邻接、Runtime Overlay、Affector 连接 | 地图连线不参与判定；右栏预检和提交必须使用同一套真实可达性规则 |
| 玩家移动反馈 | `src/ui/controller-actions-inventory.ts` 的区域按钮成功时排入 `pendingTravelChats`，再 `scheduleRender`；错误文案在 `src/ui/components/errors.ts` 的 `travelErrorText` | 新入口复用通知顺序，只在成功后追加一次移动通知；失败留在原图，不走该按钮当前的无条件整页刷新路径 |
| Story 门控已演进 | `src/arona-clicker/contracts/story-query.ts` 暴露 `isBlockingInteraction(owner?) / isBlockingMovement(owner?)`；`story-service.ts` 中 active 恒阻塞交互，passive 的 blocksInteraction 阻塞交互与移动，leaveArea:false 另阻塞移动 | 不使用 `currentStory.type !== passive` 作为唯一判断；允许浏览不等于允许移动，当前流 owner 及确认状态还需 UI 组合 |
| 前台瞬态 | `PanelState` 有 conversationVariantId、sendGate、storyGate；Hero 当前点击主要检查全局 isBlockingInteraction；尚未从这些入口核实到覆盖所有 Spot 确认／选择／转换的统一 Busy 服务 | 提供供 Hero 与地图共同消费的窄前台准入 adapter，补当前 owner、待选回复／确认、操作中与转换中状态，不建立全局工作流引擎 |
| Reveal | `src/engine/contracts/reveal.ts` 定义 existence/name/condition/utility/unlock；`src/engine/visibility/reveal.ts` 提供 existenceMet/unlockMet；`src/ui/components/tooltip-reveal.ts` 有 resolveReveal/getAreaReveal | 复用 ConditionSystem 与这些语义；现有 VisibilitySnapshot 没有 Map／Node 桶，不能假定新增表会自动得到可见性；V1 在只读查询派生，不新增持久发现表 |
| Area 信息已知≠可前往 | `getAreaReveal` 以 visited 判定 owned，可展示已访问内容；实际 travel 用 VisibilityEngine 的 isAreaVisible 与动态拓扑 | 右栏分别呈现“信息已知”与“当前移动许可”；不以 visited、节点显示或条件文本代替真正预检 |
| 数据包装载 | `fragment-parser.ts` 的 DATAPACK_LIST_FIELDS／mergeFragments 显式维护字段；`Registry.tableSteps` 显式 merge/clear；`Registry.load/validate` 在合并前校验 | 新表必须贯通解析、登记、清理、导出／查询，只有 TypeScript 声明不足以支持 JSON 包；现有分片清单亦不能假定自动识别 `maps` 等新表 |
| 跨包引用 | Registry.load 逐包处理；`runtime.ts` 的 validatePackConfiguration/applyPackSelection/validatePackDatapacks 和 GameInstance.init 有多处顺序装载；部分引用已有全表装载后的 validateCharacterRefs 等先例 | 新增显式 `validateAreaMapRefs()` 在启用集的最终有效定义上校验；逐包阶段做形状、ID、局部 Edge 校验，避免正常前向／循环引用被加载次序误拒绝 |
| 星图参考 | `src/ui/components/selector-graph.ts` 的 SELECTOR_GRAPH_DEFINITIONS 是 Init/GlobalEnh 专用代码定义；`src/ui/selector-page.ts` 有指针平移、锚点缩放、相机与 graphHistory；Portal/backdrop/transition 带母图语义 | 复用视觉语言、SVG 几何和相机算法；不直接实例化 SelectorPage、不复制 Init 购买／进入逻辑，不引入其 Portal 星座和 parent relation |
| 作者编辑／引用工具 | `src/data-services/authoring/content-policies.ts` 的 AREA_CONTENT_POLICY 显式列可写字段；`runtime-content-reference-rules.ts` 显式声明可靠引用路径 | 新字段需核对热编辑保存不会丢弃；引用浏览补 Area→Map、节点→Area/Map。新增 JSON 表不自动授权复杂 Map 编辑器 |

## 推荐数据模型

采用新契约文件 area-map.ts（拟新增，位于现有 `src/data-services/contracts/`），名称和规则如下；这是推荐施工基线，执行模型先按现有导出／类型风格落地。

```ts
// AreaDef 增加可选 navigationMapId?: AreaMapId；@ref areaMaps。
type AreaMapId = string; // mod:area-map:idName；不是已有 mod:map:idName。
type AreaMapNodeId = string; // Map 内唯一局部 ID；不登记为全局实体。

interface AreaMapDef {
  id: AreaMapId;
  name: string;
  description?: string;
  revealTriggers?: RevealTrigger[];
  nodes: AreaMapNodeDef[];
  edges: AreaMapEdgeDef[];
}

interface AreaMapNodeDef {
  id: AreaMapNodeId;
  name?: string;
  description?: string;
  position: { x: number; y: number }; // 有限逻辑坐标，V1 使用平面布局。
  appearance?: { kind?: 'point' | 'landmark' | 'portal'; iconPicId?: string };
  revealTriggers?: RevealTrigger[];
  action?: AreaMapNodeAction; // 缺省按 inspect；外观不推导 action。
}

type AreaMapNodeAction =
  | { kind: 'inspect' }
  | { kind: 'attemptAreaTravel'; areaId: string }
  | { kind: 'openMap'; mapId: AreaMapId };

interface AreaMapEdgeDef {
  fromNodeId: AreaMapNodeId;
  toNodeId: AreaMapNodeId;
}

// Datapack 增加 areaMaps?: AreaMapDef[]。
```

- 节点 key 是 `(mapId,nodeId)`；UI DOM 属性与缓存必须组合这两个身份，不能把同名节点跨 Map 合并。
- 使用现有 ID 字符集与 type 检查，注册 `area-map`；Node 不提供任意脚本、Effect、Handler、HTML 或 URL 动作。图标沿既有 Pic 读取／转义路径，不接受脚本注入。
- 不设 root/parent/initId/startNode/exitNode/resumeVersion 等 Gameplay 或层级字段；Map 入口由 Area 关联指定。“回当前区域地图”不是回某个图根节点。
- V1 每节点最多一个声明式 action，缺省 inspect；Map 引用节点单击直接开图，受限时保持原图并反馈，Hover／Focus 提供已允许公开的简短说明；不额外增加确认步骤。
- 允许空 Map 并显示空态；不要求 Map 必有当前 Area 或可移动节点。重边按有序端点去重／拒绝重复；反向边可独立声明；自引用 Map 合法。Edge 无移动成本、Condition 和通行含义。
- name／description 缺省时可回退至已揭示的目标显示信息；信息不可知时用通用占位，不能从目标原始 Def、tooltip、aria-label 或错误正文泄露。
- 节点自身未发现时不输出 DOM，也不绘制其关联 Edge；已发现但目标不可见／action 未解锁时保留允许公开的信息与受限状态，拒绝动作。数据引用存在而 Reveal 隐藏属于合法内容，不是断引用错误。

### Reveal 与可用性组合

只读查询按既有规则分别求 Map 和 Node 的 existence、name、condition、utility、unlock；缺省目标无门槛，同目标多条 OR。使用 ConditionSystem 的求值，不自行重写表达式。实现可以抽取现有纯揭示 helper 的最小公共部分，禁止让 Data Services 导入 UI 的 tooltip 模块。

节点 action 的最终可用性为：当前 Map 存在且可见／可用、节点存在且可见／可用、目标存在且符合目标揭示、对应动作额外准入均满足。Area 行为再交移动预检／命令；openMap 再校验目标 Map。只在 conditionKnown 时显示条件文本；目标隐藏时不显示其隐藏名称、具体门槛或其他 Story 信息。

推荐 V1 为当前一张 Map 派生 detached View，不扩展 PlayerState 或存档；复用条件依赖事件做局部重核。时间／Tick 依赖条件也必须能够更新，可在既有 refreshLight 收敛点比较投影指纹，只补实际变化的节点／详情，不每 Tick 全图重画。不要求跨会话“发现后永久可见”；若未来要持久探索，另行裁定。

## 推荐查询、移动与前台 API

### 只读查询

在 AronaClicker 领域提供 `AreaMapQueryPort`，经 GameReadModel 的 `areaMap` 暴露，Registry 只登记定义。推荐方法：

- `getEntryView(areaId)`：当前 Area 的入口 Map 身份及可见／可用／缺失原因；UI 仍须核对它是实际 currentAreaId。
- `getView(mapId)`：单图 detached 投影，包含已过滤／脱敏的节点与 Edge、Map 标题说明、内容版本或 revision token；不递归求所有引用 Map，不保留可写 Registry 引用。
- `getNodeView(mapId,nodeId)`：从当前定义重核节点及 action，供点击／提交复验；也可由同一张 getView 查找实现，不强求多套缓存。
- View 用结构化状态／原因码，显示文案由 UI 和现有格式化入口处理；公开 DTO 不包含被遮蔽的原始目标内容。诊断信息另给 DevLog／作者工具。

### Area 移动预检与提交

现有 ReadModel 有 availableAreaIds，但未见与 travel 完整一致的 canTravel 方法。推荐新增只读 `getAreaTravelStatus(areaId)`，其结果为 ready 或带现有 TravelError 的 blocked。

- 从 InitService.travelToArea 的副作用之前提取共享纯准入函数，供该查询与原命令共同调用，保持检查顺序与错误码；不通过调用 travel 并回滚来预览，也不在 UI 再维护第二套拓扑／锁定规则。
- 此提取必须有原命令回归测试，尤其 StoryBlocked、NotAdjacent、Locked、跨 Init 和 AlreadyThere；不顺便改进入副作用或存档结构。
- 右栏显示目标 Area 的公开信息和当前已知准入状态；“尝试前往”只有显式操作才 `commands.travelToArea(areaId)`。预检只是快照，提交当下的命令仍为权威；不能因 map 连线、Map 可浏览或已经 visited 而绕过它。
- 已知不可前往可以禁用并显示已知原因；通过时允许尝试，状态变化导致命令失败则原地显示反馈。无论按钮呈现，过期／伪造事件都必须被动作重核拒绝。
- 地图不需要新的玩家位置写入口；不将 nodeId 当作 travel 目标，不传特殊 allowDuringStory/checkAdjacency 参数。

### 前台门控

先核对并行 AreaHero 工作是否已有共享 adapter；优先复用／窄扩展。推荐 `getForegroundInteractionStatus(intent)`，区分 `openAreaOverview / openAreaMap / attemptAreaTravel`，返回 allowed 或 reason。若 owner 属于 UI，不把整个 PanelState 注入 Runtime。

门控矩阵的实施基线：

| 状态 | 打开地图 | 地图发起移动 |
| --- | --- | --- |
| 无故事／安全空闲 | 允许 | 继续检查真实移动规则 |
| 普通可安全打断 passive | 允许 | 继续检查 isBlockingMovement 和真实移动规则 |
| passive blocksInteraction:true 或 active／重播演出 | 阻止 | 阻止 |
| passive leaveArea:false 但不阻塞交互 | 与 Hero 一致允许概览类浏览 | 阻止移动 |
| 待回复选择、待故事确认、未完成的 Spot 付款／操作确认、前台 Area 转换或提交中 | 阻止 | 阻止 |
| 普通 Tick／生产／后台数值刷新 | 不阻止 | 不单独构成阻止理由 |

- 同时核对全局故事和当前可见学生流 owner，保护真正受影响的故事；`sendGate` 的 typing/pause/thinking 不自动等于所有交互都忙，但未完成选择和不可安全打断内容必须阻止。不能把 `interruptible:false` 单独误读为现有移动锁，leaveArea/blocksInteraction 依现有语义执行。
- 渲染、入口点击和提交复用状态；点击前重读，地图提交期间用 UI 会话 `submitting` 禁止重复提交。现有 travel 为同步命令，锁覆盖调用、同步嵌套事件、结果处理到提交收敛完成，不能仅依赖重绘后禁用按钮。
- 关闭地图始终允许；纯浏览不写游戏状态。若地图打开后前台出现受保护 Story／选择，优先关闭地图恢复原流供其继续，不清故事、不挂起队列。Hero 与地图的共享准入补齐属于集成，不改变 Hero 的内容职责。
- 若核对发现 Hero 与上述忙碌要求冲突，记录差异并以最小共享门控修正处理；不能借“与 Hero 一致”保留可绕过 Story／Spot 的漏洞，也不引入全局暂停 Tick。

## UI 会话与返回规则

推荐 Controller 持有 `AreaMapSession`（拟新增 UI 状态类型），不放入 PlayerState、SaveData 或 Gameplay MapRun：

```ts
interface AreaMapSession {
  sessionId: string;
  originInitId: string;
  originAreaId: string;
  currentMapId: AreaMapId;
  selectedNodeId: string | null;
  history: Array<{ mapId: AreaMapId; selectedNodeId: string | null }>;
  viewports: Map<AreaMapId, { scale: number; x: number; y: number }>;
  submitting: boolean;
  feedback: { mapId: AreaMapId; nodeId: string; reason: string } | null;
  // 返回游戏位置由现有 WorkspaceLocation / FlowScroll 保持。
}
```

- 推荐 route 为 `{ kind:'area-map'; sessionId:string }`，surface key 按会话稳定；查看哪张 Map 属于会话，不让切图重置顶层 returnTo。route 与会话不一致时拒绝旧事件并恢复正常游戏，不能落入 game fallback 却残留地图状态。
- 仅从正常 game 左栏开启本次会话，进入时记录 WorkspaceLocation、正常中栏流实例键与滚动／焦点。左栏在地图模式继续显示，但地图按钮不新建第二会话；切换通讯录／故事／Hero 等显式离开时销毁本次会话，返回遵守现有位置机制。
- openMap 成功前重核目标；成功后将当前图和选择压栈，保存相机并打开目标图；失败不入栈、不修改 currentMapId。重复引用允许；同图自引用作为原地操作，不无限压入重复项。
- 返回上一图弹本次历史，不按引用方向找“父图”；恢复该图选择（若仍有效）和该图最近相机。Map A→B→C→A 的历史与 viewports 独立：同图多次访问共享会话内最新相机，历史项保存访问顺序。
- 返回当前区域地图：重新读取真实 currentAreaId 的 navigationMapId，校验后直接打开，清空浏览历史，恢复该图最近相机；它不是另压一条 openMap。入口 Map 不可见／缺失时保留原图并说明，关闭仍可用。
- 相机为平移／缩放；初次到图按可见节点坐标 fit，空图使用默认视角。适应视图按当前可见节点重新计算；重置恢复规定默认视角。缩放限制、拖拽阈值与 CTM 坐标转换参考 SelectorPage，拖动结束不误触节点。
- 关闭未移动：恢复原聊天流、Click、右栏页签及阅读位置，不制造移动通知、不清剧情。成功移动：退出会话、恢复主游戏并更新新 Area；失败：保留图、选中项、相机、历史，右栏反馈仅属于本次操作。
- 同一会话出现外部 Area 变化（左栏临近区域按钮、剧情 effect、热改定位等）时自动关闭并同步新区域；读档、切 Init、退出世界线、Runtime 重建、Controller 销毁均释放相机缓存、历史、监听、指针捕获和会话浮层。

## 三栏结构与更新方案

沿用项目主题、宽屏三栏和现有 Frame／Tabs／Titlebar，不引入新配色或母子图风格。结构建议（名称为语义草图）：

```text
WorkspaceFrame(area-map，保留顶栏)
├─ left：renderLeftPanel → Switch / AreaHero / 地图按钮 / 当前及临近 Area
├─ center：地图标题工具条（上一图／当前区域地图／适应／重置／关闭）
│  └─ viewport SVG → world group → edge group + keyed node group
└─ right：地图或节点详情标题 + 独立可滚动内容 + 尝试前往／反馈
```

拟新增主要布局宿主 4 个：center viewport、SVG world、右栏内容滚动区、右栏操作／反馈区；edge／node group 是稳定图层。使用 Frame 的列／标题入口，执行前给出最终 wrapper 数量、hostId、workspaceOwner 和 scroll owner，不双套 panel 或重复 heading。

| 操作／变化 | 更新范围与稳定节点 |
| --- | --- |
| 进入／退出地图模式 | route/owner 变化允许 workspace structure；保留左栏职责与实际 currentArea，记录／恢复来源 FlowScroll；不清消息和 Click 状态 |
| 平移／缩放／Hover／Focus | 原节点 transform／属性与共享 popover 生命周期；不调用 UIController.render，不换 SVG viewport 或右栏滚动宿主 |
| 选择 Area／inspect 节点 | 补选中节点属性、更新右栏详情 region；不替换左栏、工具条、地图节点集合或相机 |
| openMap／上一图／回区域图 | 同一会话内协调图内容与标题、右栏；保留 Frame／列／工具条／viewport，按 mapId 切 keyed 内容，恢复各图相机 |
| Reveal／数值条件／定义变化 | 仅协调改变的节点、Edge、动作状态与详情；指纹未变不动 DOM，不能每次资源变化重建页面 |
| 提交失败 | 提交锁与右栏反馈局部更新；不重建整个 Workspace，不丢选中对象 |
| 提交成功 | 既有移动流程收敛后一次退出更新主界面，通知在触发剧情之前排入既有队列；事件处理和命令返回不能各追加一次／各重建一次 |

新 region 通过既有 update dispatcher 与 surface token 归属接入；mapId/nodeId／定义版本和 sessionId 共同拒绝过期点击。缺少单个内容区只在所属列补回；只有 route/根不匹配才走 workspace 恢复，不把局部异常静默升级为全 App 重绘。替换范围前关闭范围内 popover，更新后 retainIfAnchored；范围外浮层保留。具体遵守 [[docs/docs-829/06-wiki/50-ui/refresh-update]] 与 [[docs/ai/frontend-design-project-overlay]]。

## 数据包校验、失效与兼容

### 装载与引用校验

- 逐定义检查：完整 AreaMap ID／type、同包重复 Map ID、局部 Node ID 唯一、坐标有限、合法 appearance 与 action union、必需目标字段、pic 引用、Edge 端点属于当前图。拒绝未知 action、函数和不合法 payload。
- 按最终启用集及现有覆盖顺序建立有效表，再验证 Area.navigationMapId、node.areaId/mapId、图标引用。覆盖后仍有效的外部引用必须成立；错误信息带包／Map／Node／字段路径。
- 正常 Map 图循环、交叉引用、同图引用是合法配置，不检测成错误，不执行拓扑排序，也不递归渲染；只校验每个直接 ID 存在。包 manifest 依赖仍沿现有规则，不能用 Map 循环要求放开包依赖循环。
- 推荐沿已有后装载引用验证模式添加 `Registry.validateAreaMapRefs()`。GameInstance.init、Runtime 配置验证、选择应用、通用 apply target 验证均接同一最终校验，避免“预览配置通过、实际应用失败”或反之；失败时不提交半套新 Registry。
- 现有单包 Registry.load 若不做最终集闭包，不得报告其已证明跨包引用完整；测试和调用契约明确何时必须 finalize。JSON 分片和 ZIP 导入测试必须通过，不能只测试内存对象 Registry.load。
- 声明新字段的 TSDoc／ref，运行生成器同步 Schema，不手改生成文件。独立编辑器仅做字段／引用元数据的最低同步，不开发地图画布编辑器。

### 运行时数据失效

- 每次动作按最新查询验证，不能信任旧 DOM target。打开的 Map／节点被移除、改变 action、变更目标或变隐藏后清除失效选择与反馈、移除相关 Edge、取消对应浮层。
- 当前 Map 消失／隐藏时先尝试当前 Area 的有效入口 Map，重置无效历史；无有效入口则关闭地图并保留正常游戏。只是引用目标失效时保留来源图，禁用对应动作并提示“目标不可用”，详细 ID 原因只进入诊断。
- 节点坐标／集合热改保留当前图相机，除首次显示或主动 fit 不强制重置；返回历史时跳过已不可用图，无有效历史则禁用上一图。
- 数据包整体 reload 伴随 Runtime 重建时直接销毁会话；现有 Area 局部 mutation 须校验 navigationMapId。新 Map 表 V1 不提供专用热 CRUD，但内容替换／查询输入变化必须可安全处理。
- 核对 AREA_CONTENT_POLICY、World 内容编解码／快照保留未开放字段的方式；必要时最小同步 navigationMapId 的引用校验与保留逻辑，不能让一次既有区域编辑静默删除地图关联。不借此扩建完整编辑能力。
- 在内容引用浏览规则补声明式确定引用，不只依赖字段名猜测；图内 Node/Edge 身份仍是 owner 内局部键，不能伪造全局 Node 实体。

## 涉及模块、文件与建议新增位置

这是影响清单，不是一次 Unit 的修改白名单。执行模型按阶段重新核对，使用 [[docs/ai/PROJECT-CONSTITUTION]] 拆分 3–5 文件／约 300–500 行的可验收 Unit，记录 Receipt；不一次修改所有文件。

| 领域 | 已有入口 | 拟新增／最小扩展 |
| --- | --- | --- |
| 数据契约／ID | `src/data-services/contracts/world.ts`、`datapack.ts`，`src/engine/core/entity-id.ts`，现有导出入口 | contracts 下 area-map.ts；新 ID type、navigationMapId、areaMaps 表与导出 |
| 包解析／登记／校验 | `src/data-services/datapack/fragment-parser.ts`、`pack-parser.ts`；`src/data-services/registry/registry.ts`、`registry-validate.ts` | area-map-validation.ts（拟在 registry 目录新增），独立表、形状和最终引用校验 |
| 启用集／Runtime 组合 | `src/arona-clicker/runtime.ts`、`runtime-game-instance.ts`、`runtime-wiring.ts`、`contracts/runtime.ts` | 查询装配、最终校验、重建清理；不引入 MapRun owner |
| 只读投影／旅行预检 | `src/arona-clicker/services/init-service.ts`、`contracts/results.ts`、`contracts/story-query.ts` | services 下 area-map-query.ts、contracts 下 area-map-query.ts；提取 shared travel admission，沿现有 GameReadModel 导出 |
| 左栏／路由／组合 | `src/ui/components/rail.ts`、`workspace/workspace-router.ts`、`workspace/workspace-renderer.ts`、`components/workspace-frame.ts`、`components/app-shell.ts` | area-map Workspace 组件与独立 UI session 状态；保留 area 和 map 路由 |
| 控制与更新 | `src/ui/controller.ts`、`controller-actions-inventory.ts`、`controller-events.ts`、`update/ui-update-types.ts`、`update/ui-update-dispatcher.ts`、`ui-host-registry.ts`、`flow/flow-scroll.ts` | 独立 area-map Controller adapter、区域协调器、共享前台 gate；依实际 Host 注册点接入 |
| 视觉／相机参考 | `src/ui/selector-page.ts`、`components/selector-graph.ts`、`css/selectors.css`、`components/workspace-titlebar.ts`、`condition-presentation.ts`、`components/errors.ts` | 独立 area-map 样式／交互；纯算法窄提取可行时共享，不依赖 SelectorPage 的业务类 |
| 作者协议／引用工具 | `scripts/gen-engine-schema.mjs`、`tools/datapack-editor/schema/editor-extras.ts`、`src/data-services/authoring/content-policies.ts`、`registry/runtime-content-reference-rules.ts` | 同步源契约及 ref 元数据，核对已有 Area 编解码；生成结果只由脚本更新 |
| 演示／测试／文档 | `tests/data/`、`tests/engine/`、`tests/ui/`，当前 `docs/docs-829/` 与 `ui-style/` | 独立导航 fixture／可通过真实 PackSource 装载的演示数据，按下方场景验证；新文档只记录实现后稳定机制 |

## 实施阶段与完成定义

### P0：复核、结构冻结与测试基线

- 核对当前并行 Story／Hero 变更与共享 gate、Spot 未完成操作、当前 owner、路由镜像解析和 UI 刷新入口；回填事实差异，冻结共享准入 adapter 和最终结构草图。
- 确认上述独立表／ID 和 route／session 方案，列出最终引用校验的全部入口、Area 编辑保留关联的落点。
- 先构造核心行为场景：看图无副作用、选节点不移动、循环与跨包前向引用合法、移动成功／失败／门控矩阵。已有源码变化时更新 Task 事实，不机械照旧落地。

### P1：声明式内容与完整装载链

- 落地数据模型、分片／ZIP 解析、Registry merge/clear、两阶段校验、Schema／引用工具最低同步和三个 Map／Area fixture。
- 独立完成定义：真实数据包可导入，非法 shape／断引用可诊断，循环与交叉引用合法；旧包与 Gameplay B maps 行为不变。

### P2：只读投影与共享准入

- 落地 Map／Node Reveal 脱敏投影、入口查询、共享 travel 预检、前台 gate 与失效处理。
- 独立完成定义：当前单图查询不递归，目标隐藏不泄漏，预检与现有命令一致；查询／预览没有 Enter／Story／资源写入副作用。

### P3：三栏 Workspace 与会话导航

- 增加 Hero 下按钮、独立工作区、SVG 交互、右栏详情、历史／按图相机、返回区域图与关闭，接局部更新与生命周期。
- 独立完成定义：A→B→C→A 可浏览及返回，实际 Area 一直未变；左栏按实际 Area，查看其他 Map 不更新成目标 Area，普通交互保持节点／viewport／滚动连续性。

### P4：移动闭环与回归交付

- 显式“尝试前往”接原命令、一次提交锁、成功退出／通知／Story 触发，失败原地反馈；接外部 Area 改变与内容失效。
- 完成定向测试、类型／架构／Schema 检查、桌面浏览器交互验收，更新受影响机制与风格记录，提交 Receipt 和剩余事项。阶段完成不等于整个 V1 验收完成。

## 最小演示数据与验收矩阵

独立 `area-map-demo` 数据包／fixture：一个测试 Init 内三个真实 Area（a/b/c），导航 Map ID 使用 `area-map-demo:area-map:a/b/c`，Area ID 使用 `area-map-demo:area:a/b/c`。至少 Area a 与 b 共享入口 Map A，以证明非一对一；c 可关联 Map C。真实 Area 邻接／Reveal 单独声明，不从图的 Edge 推导。

| Map | 节点 |
| --- | --- |
| A | 表示 Area a 的节点；attemptAreaTravel→Area b；openMap→B；纯 inspect 信息节点 |
| B | openMap→C；openMap→A；attemptAreaTravel→非当前 Area c |
| C | openMap→A 构成循环；暂不可用的 Area 移动节点（用节点 unlock 或真实 Area 可见门槛构造） |

另用测试变体覆盖 hidden／missing 目标、同名局部 Node、forward ref、Edge 到隐藏节点、热删节点与不相邻但图形相连的 Area；无效包只作负例，不装进默认运行包。演示需有真实浏览器可进入的游戏内入口，不能只留自动化 fixture，也不能替换当前默认内容或污染普通存档。

- [x] 1. 地图入口位于 Hero 下方，保留 Switch／Hero／临近区域；未关联 Map 的旧 Area 无可用地图入口。
- [x] 2. 打开后中栏为主要节点画布，右栏默认显示 Map 名称、说明和基础操作；正常信息流／Click 和设施在关闭后恢复。
- [x] 3. 平移、锚点缩放、fit／reset、鼠标及 Enter／Space 节点选择正常；拖动不误点击、键盘焦点可见。
- [x] 4. inspect 只选中和显示详情；Area 节点只选择，Map 节点单击直接开图并有受控 Hover／Focus 简介。
- [x] 5. A→B→C→A 交叉／循环引用工作，不生成父子结构，不递归展开全网络。
- [x] 6. 上一图按会话历史返回，恢复仍有效选择及各图最近相机；失败开图不入栈；self open 不无限压栈。
- [x] 7. 返回当前区域地图直接读取真实 Area 入口并清空浏览历史；非当前 Area 节点不会改此锚点。
- [x] 8. 任意看图／选择／相机操作均不改 currentAreaId、visitedAreas、资源、Story 游标、完成记录或发 areaEntered。
- [x] 9. 移动成功仅一次，关闭地图恢复正常三栏与 Click，新 Area/defaultSpots/首访/EntryEffect/Story 流按现有 Runtime 生效，通知不重复且顺序正确。
- [x] 10. NotAdjacent、NotInThisInit、AlreadyThere、Locked、StoryBlocked 等失败保留 Area、Map、选择、相机与历史，右栏反馈；不触发进入副作用。
- [x] 11. 隐藏／锁定／不存在目标、伪造或过期 node/action 事件不非法移动、不泄露隐藏名字／条件／tooltip／aria 内容；Edge 不赋予权限。
- [x] 12. active、blocksInteraction passive、leaveArea:false、回复选择、故事确认、Spot 确认、当前 owner 和转换／提交中按矩阵处理；Tick／生产继续运行，重复提交只调用一次原命令。
- [x] 13. 地图不枚举 Story，也不新增 Story action／搜索／未发现故事入口；Hero 的主动 Story 职责未被迁移到地图。
- [x] 14. 地图／节点数据更改、目标消失、Reveal 翻转、外部 Area 改变、读档／换线／Runtime 重建与销毁均安全收敛；旧请求不落入新会话。
- [x] 15. 真 JSON 分片／ZIP 导入、最终有效集引用校验、跨包前向引用和正常循环覆盖；非法 Node／Edge／ID／action／坐标被拒绝，旧包与 Gameplay B maps 回归通过。
- [x] 16. 普通节点操作与资源／条件刷新不全页 render，Frame／viewport／滚动 owner／范围外浮层保留，真实浏览器证据与自动化断言均记录。

## 验证方案与交付证据

按 [[docs/docs-829/05-conventions/testing]]，此任务涉及新增数据契约、查询和工作区生命周期，优先行为测试与严格审查；不以纯渲染快照或 helper 布尔值代替真实入口测试。

- 数据层参照 `tests/data/fragment-parser.test.ts`、`tests/engine/registry.test.ts` 和 `tests/data/gameplay-b-map-registry.test.ts`，新增独立 Area-Map 用例；同时证明 Gameplay B 原有 map 契约未串用。
- 领域层参照 `tests/engine/game-instance.test.ts`、`passive-pool.test.ts`，覆盖 travel 预检／提交一致性、失败无进入副作用及成功完整链路。
- UI 层参照 `tests/ui/workspace-router.test.ts`、`workspace-lifecycle.test.ts`、`workspace-frame.test.ts`、`controller-events.test.ts`、`spot-payment-modal.test.ts`、`selector-graph-navigation.test.ts`，新增 Area-Map 的会话、真实点击、失效与 DOM identity 用例。现有 Selector 测试只是参考，不能替代新系统验收。
- 按 Unit 运行定向 `npx vitest run <实际测试路径>`；完成契约后 `npx tsc --noEmit`、`npm run check:architecture`；Schema 源改动运行 `npm run gen:schema` 与 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 对应测试。必要新增命令／事件时补目录契约检查，不预建复杂测试工具。
- 桌面宽屏浏览器走上述 16 项；记录画布交互、跨图返回、失败反馈、忙碌期间禁止入口／提交、成功触发 Story 与返回阅读位置。无需手机适配，不为本 Task 额外做窄屏设计。
- 交付代码与真实数据包／演示入口、测试和浏览器证据、当前机制文档及 ui-style 命中条目、Unit Receipt／剩余事项；未执行或失败必须如实写明。

## 明确非目标与兼容风险

- 不做父子图、最短路径、自动地理布局、Edge 通行规则、任意脚本、Story 全局搜索、多图同时展开、复杂地图编辑器；不复用 Gameplay MapRun，不新建持久 UI 浏览／已读存档，不清档或编写存档迁移。
- 需要隔离的风险：`map` 同名误接 Gameplay B；单层 returnTo 被反复 enter 覆盖；逐包引用校验误拒绝合法循环；只改 TS 表导致 JSON 导入丢数据；Map Node 泄露目标信息；条件预检与 travel 漂移；同步 areaEntered 与命令返回重复退出／通知；后台事件误把地图替换成普通右栏；旧 Area 编辑丢 navigationMapId；并行 Hero／Story 改动使旧调查失效。
- 最小策略已经分别给出：独立表／ID／route、独立 UI history、最终集引用校验、贯通 parser、脱敏查询、共享旅行准入、一次收敛点、当前 surface 局部消费者、编解码保留与开工前复核。超出这些边界的新领域机制应先回协调方，不静默扩展 V1。

## 初稿调查核验记录（2026-10-21，施工前）

- 已只读核对上表涉及的当前源码与现行规范，未执行游戏代码施工、Schema 生成、游戏测试或浏览器验收；本文不声称 V1 已实现。
- 创建前后均已运行 `npm run check:docs`：均为同样 8 处既有 `docs/docs-829/` 文档引用已移除的 Operation 示例／测试路径，新增 Task 与索引未被报告错误；不在本 Task 调查轮修复。索引 `git diff --check` 通过，新 Task（尚未跟踪）独立尾随空白检查通过；未将全仓文档检查写成通过。
- GALHCG：先 graph_project 核对 `acprogram`；图内查询 Area／Registry／Reveal 获取候选，Selector 图内零命中后改查 path，并限定 src/ui 定位到实际 selector 文件；回到当前源码核实，未将零命中当作不存在。Registry 搜索仅用首批候选，没有声称遍历全图。
- 本轮直接修改为本 Task 与计划索引；`graph_health(check="changed")` 对新 Task 返回 `unreferenced_path`（无直接 Evidence／maps_to），对索引返回 `content_changed`；已按 owner_offset 0、5 读取两页共 9 个 owner，末页 complete=true、无后续分页。此为只读变化诊断，不代表语义错误或功能完成。未获地图维护授权，不刷新、不改图、不写 freshness。
- 初稿当时未完成 P0—P4；现已由页首施工清单与最终 Receipt 承接。地图功能无未完成项；并行 Story 测试与既有文档引用问题单独保留，不写成已通过。

## 相关路由

[[docs/ai/context-packs/ui-presentation]] · [[docs/ai/context-packs/datapack-schema]] · [[docs/ai/context-packs/world-lifecycle]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/schema-sync]] · [[ui-style/00-index]]
