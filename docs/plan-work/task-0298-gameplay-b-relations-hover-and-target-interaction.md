# Task 0298：Gameplay B 作用关系、Hover 与目标交互

状态：proposed — 背景与关键实现已核实，等待负责人确认；本轮仅编写 Task，未开始源码施工。

## 目标

让玩家先看清谁正在发出作用（Source）、谁将承受作用（Recipient）、哪些对象可以改选（Candidate），再完成换牌、点击与拖拽修改目标，最后接入作用线。

覆盖 P0—P6 的完整方向。P0—P5 必须在没有任何 SVG 作用线、没有连接线路由系统时独立可用；P6 只增强已有关系的可视化。最终可完成“查看关系 → 换牌 → 重选目标 → 显式 Commit”的整轮操作。

需求来源：负责人于 2026-10-19 提供的 Roadmap、八项全局约束与五级 Hover 优先级。以下区分已核实代码事实、拟采用施工合同与尚需收敛的玩法细节；确认本 Task 前不将提案写成现行机制。

## 设计边界与依赖

- 工作对象是新版 Gameplay B MapRun 三栏 Workspace：左我方、中 Talklet Flow、右敌方。不是旧 Operation UI 的全面改造，也不进入独立 Datapack Editor 的 UI 重构。
- 衔接 [[docs/plan-work/task-0297-gameplay-b-unified-unit-cards]] 的共用 UnitFace、当前生效行为牌、右侧换牌浮层；0297 尚待浏览器验收，不能把“implemented”当成视觉验收通过。
- 衔接 [[docs/plan-work/task-0296-gameplay-b-shared-talklet-flow]] 的共享条目与滚动管线；普通 Chat / Story 不获得 MapRun 命令能力。
- 包含单位、双方附属玩法卡、流内当前玩法卡的身份与关系，以及公开敌方来源。历史回执、情报文本、地图胶囊和普通聊天气泡不会因为长得像卡片就成为可编辑领域目标。
- 领域规则、合法候选、权限、草稿版本与 Commit 验证归 MapRun；UI 只持有临时交互、可视实例映射及事件分发。
- 不改变每角色单项有效准备行为、Swap 免费、PlayerCommand 既有费用、唯一整轮 Commit 等基础合同；不新增多行动槽、敌方手牌系统或通用 Buff 系统。
- 卡牌目标、相对目标与敌方公开意图是当前缺失的领域合同，须在 P0 明确并验证，不能只给 DOM 加 ID 宣称支持。
- 继承现有主题、字体、Frame 和滚动 owner，按 `frontend-design` skill 与 [[docs/ai/frontend-design-project-overlay]] 施工。验收以桌面宽屏为准，本任务未要求移动端适配。
- 当前工作树已有 0297 / Flow 等未提交修改；施工前重新核实其最新状态，保留已有工作，不回退或覆盖。本文记录的是 2026-10-19 阅读时的事实。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Map Action target 只有 `none / self / partyCharacter / enemy`；没有卡牌目标、上下单位或左右卡牌规则。HP 效果面向单位；资源 effect 的 recipient 也不能直接解释为卡牌。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionTargetDef`、Action effect 类型；`src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`：`resolveGameplayBActionPreview` | P0 涉及真实领域契约扩充与作者校验，不是纯 UI 整理；卡牌效果含义不能由颜色或卡面文案推导。 |
| 显式 TargetSelection 按角色保存我方 / 敌方单位 ID；Ability / Item 有独立 actorless 草稿与单位目标。Enemy ID 仅在 Encounter 内有效，Action ID 仅在 Map 内有效。 | `src/arona-clicker/contracts/map-run.ts`：`MapRunEncounterTargetSelection`、`MapRunEncounterSourceTarget`、draft token；`src/data-services/contracts/gameplay-map.ts` | 统一引用必须携带上下文，不能仅使用 actionId / enemyId；actorless 来源不能伪造执行角色。 |
| 只读 preview 提供生效行为、当前目标、合法候选与待选标记；self 自动定位自身，唯一合法单位目标自动解析，多候选无显式选择时待选；Wait 没有虚构 Action。 | `gameplay-b-action-preview-resolver.ts`；`tests/engine/gameplay-b-map-run.test.ts` 的 no-target / self / unique target / repeated previews 用例 | 关系投影要区分无目标、待选和无行动，沿用确定性解析，Hover 不写草稿或推进 RNG。 |
| Swap / PlayerCommand 更新和清除 Override 都会删除该角色的显式 target selection；当前不保证换牌后保留仍合法的原目标。 | `src/arona-clicker/services/map-run-service.ts`：`setActionOverride`、`clearActionOverrideForSlot` | P3 必须修改 Owner 中的原子保留 / 失效合同并补回归，不能在 UI 连发两条命令“补回目标”。 |
| Runtime 持有私有 MapRun Owner，Workspace 读取 detached View；Controller 用 `GameCommands` 转发带草稿 token 的 Swap、PlayerCommand、单位 Target、Ability / Item 命令。 | `src/arona-clicker/runtime-game-instance.ts`：`#mapRunOwner`、Workspace 投影与命令；`contracts/runtime.ts`；`src/ui/controller-actions-operation.ts`：`readMapDraftToken`、`handleMapClick` | 新卡牌目标也必须穿过完整命令链。`TargetSelection` 在本 Task 是草稿意图总称，不是假定已经存在的通用命令 API。 |
| 当前角色行为牌点击用于展开 / 收起手动 Popover；候选点击才执行换牌。目标仍主要通过角色下方按钮选择，没有 Map 共用的关系 Hover / 拖拽状态机。 | `src/ui/components/map-workspace.ts`：`renderActivePartyMember`；`controller-actions-operation.ts`：`closeMapHandPicker`、`handleMapClick` | 不让同一点击同时换牌、固定选中与确认目标；先明确交互入口，再复用现有委托与浮层生命周期。 |
| 敌方当前公开查询提供 roster、HP、damage；攻击按结算中变化后的存活状态与最低 HP 决定受用单位，再写入回执，并非已有固定准备目标。 | `map-run-service.ts` 的敌方结算段；`contracts/runtime.ts`：Encounter 与 recentCommit View | 不把上一轮回执当本轮意图；公开预测须由领域产生并注明随草稿变化，UI 不自行预测，更不能因共享组件而开放敌方控制。 |
| Flow 已有 `streamKey / instanceKey / contentId`、current / observed 生命周期和受控 actions，但没有通用的当前玩法卡领域目标 DTO。 | `src/ui/flow/flow-entry.ts`、`map-flow-model.ts`；`tests/ui/map-flow-adapter.test.ts` | 流条目实例键不是领域卡实例 ID；P0 / P1 增加受控玩法卡投影时保留共享管线和历史只读边界。 |
| Map DOM 按 flow / focus / region 等 key 协调；现有滚动和范围内浮层清理可以复用。旧 Operation Hover overlay 有顶层副本但绑定旧结构。 | `src/ui/workspace/map-dom-updates.ts`：`patchMapDOM`；`src/ui/operation-card-hover-overlay.ts`；`tests/ui/map-dom-updates.test.ts` | 扩展共用视觉角色，不能直接照搬旧 Operation 规则；Hover 副本应是同一对象的另一个视觉实例，不拥有新目标。 |

## 拟采用的共享合同

### 领域身份与关系

- 分开三类身份：领域对象引用、一次行为的关系引用、一个对象的视觉实例引用。卡牌定义 actionId 不能单独区分不同角色、不同轮次、不同容器里的牌；流内副本与浮层副本共享领域对象引用，但视觉实例不同。
- 领域引用至少能区分我方单位、敌方单位与玩法卡实例，带足 run / node / activity / encounter-round 作用域。具体引用字段及卡实例生命周期在 P0 合同中冻结；不得使用 DOM 顺序、旋转角度、像素位置或展示名称作为逻辑身份。
- 关系投影表达：关系身份、行为来源、可选执行单位、当前具体受用对象、合法候选、选择模式、公开程度、可控制能力及版本依据。支持零个或由领域明确声明的多个受用对象；本任务不顺带把所有现有单目标行动改成多目标。
- 选择模式至少区分无目标、自身、玩家可选、规则确定、待选择；“目标未知 / 未公开”不等于“无目标”。规则确定的相对目标不默认允许拖拽绕过规则。
- effect recipient 与 Action target 可能不同，例如资源 effect 落在 actor 或 team。P0 明确可见关系究竟指向选中目标还是实际 effect recipient；多项效果不能错误压成一个单位，Team 不能伪装成任意队员。
- UI 高亮消费 Owner 投影；换牌候选的临时 preview 也走无写入的领域查询。不可通过临时执行 Swap 再撤销取得预览。

### 视觉角色

| 状态 | 渲染合同 |
| --- | --- |
| Source | 作用卡上浮、层级提高、外缘强调、发起标识；单位来源在其身份面给出对应发起标记，不任意移动整列。 |
| 当前 Recipient | 环绕轮廓或四角括号、独立受用标识、轻微响应；不沿用 Source 的主动抬升。 |
| 其他合法 Candidate | 弱虚线轮廓或角点，仅在需要检查 / 编辑候选时出现，强度低于已选受用方。 |
| 不合法对象 | 保持普通状态，不吸附、不接受目标确认；可查看内容仍可只读查看。 |
| 无目标 / Wait | 无目标行为只强调真实来源；Wait 不生成行为卡来源或虚构受用方。 |
| 同对象双角色 | 发起与受用标识占不同位置，轮廓与层级可叠加，不能互相覆盖。 |

受用高亮是中性的“作用落在这里”，适用于治疗、强化和攻击；不依赖敌我颜色或效果正负。沿用主题 token，形状、位置、标记同时表达区别；键盘焦点轮廓保持可辨，减少动态效果时仍能识别角色。

### 交互优先级与命令边界

| 优先级 | 状态 | 行为与恢复 |
| --- | --- | --- |
| 1 | 正在编辑目标 / 拖拽 | 锁定当前来源，只更新候选与临时受用预览；路过其他牌不能抢走来源。 |
| 2 | 换牌浮层展开 | 保留原来源；Hover / Focus 候选时显示替换预览，离开候选恢复原关系；此时不换牌。 |
| 3 | 固定选中行为 | 持续显示来源与当前受用方；允许查看其他内容，但不清除固定关系。 |
| 4 | 普通 Hover / 键盘 Focus | 临时检查公开关系；同层以最近实际输入为主，离开 pointer 后若仍有有效键盘 Focus 则恢复 Focus 关系。 |
| 5 | 空闲 | 显示单位与当前准备行为，不同时强调全部关系。 |

- 所有消费者读取同一份临时交互状态；不再建一套作用线 Hover 状态。保存明确的固定态与临时态，取消高优先级操作后恢复仍有效的较低优先级状态。
- Hover / Focus / 固定选中 / 拖拽移动不修改 MapRun；只有确认换牌或确认合法目标才发草稿命令；Commit 保持显式独立操作。
- 保留当前“点击生效行为牌切换换牌浮层”。新增独立的目标编辑 / 固定选择控件；可替换牌内的目标手柄不能触发换牌。无替换候选的行为牌仍能通过编辑入口选择目标。
- 点击与拖拽共用一条目标确认路径；Pointer 达到拖拽阈值后抑制尾随 click，避免放下后又打开浮层或发送第二次命令。
- Escape / 无效释放 / pointercancel / 失去捕获取消临时编辑，保留之前已确认草稿。来源失效、版本变化、离开 Run、读档、进入终态时重核或清理临时状态；不得用旧 token 自动重试提交。

## P0 前置合同门槛

以下是实施前必须在本 Task 留下的合同与证据，不以整仓审计替代；当前没有冻结具体字段或伪造支持。若选择会改变玩法含义，先交负责人裁定，才能进入依赖该合同的施工。

| 门槛 | 必须明确的内容 | 退出证据 |
| --- | --- | --- |
| F1 卡牌实例与实际效果 | 哪些附属 / 流内牌是领域对象；卡被换下、流条目回收、跨轮后引用如何失效；至少一种真实卡牌目标效果及其结算 / 费用 / 生命周期。不能把单位 HP 效果直接作用于 actionId。 | 类型草案、Owner 入口、正常与失效案例；卡牌目标完整经过查询、校验、草稿与 Commit。 |
| F2 相对顺序 | 上下单位的逻辑 roster / party 顺序，左右卡牌的领域容器与顺序、是否跳过失效对象、边界无邻居时的结果；换牌是否改变槽位；规则确定与手动指定如何互斥。 | 不受 DOM 重排 / 旋转影响的解析测试；不得以随机视觉角度定义左右。 |
| F3 敌方公开意图 | 哪些来源 / 关系允许公开、预测依赖哪个草稿；在结算后状态才确定的目标如何标示条件性或未知；不改变既有敌方结算顺序。 | 公开只读 DTO、权限测试及 preview / settlement 一致性或明确条件限制。 |
| F4 换牌保留目标 | 本 Task 拟采用：新行动仍接受同一具体目标且目标合法时原子保留，否则删除旧显式选择；self / 唯一目标按领域规则自动解析，无目标清空；多个候选待选并提示。恢复自然行为 / 清除 Override 同规则。 | Owner 层回归覆盖保留、清除、自动解析、费用不足和 stale 零写入。 |

本 Task 确认代表接受整体方向与 F4 拟定合同；F1—F3 的具体作者语法与新增卡牌效果不由本轮阅读擅自决定。P0 必须先收敛这些内容，若缺少裁定则明确停在对应门槛，不将卡牌 / 相对目标从总验收中静默删掉。

## 施工切片与独立验收

顺序为 P0 → P1 → P2 → P3 → P4 → P5 → P6。每阶段记录测试、实际观察与剩余问题；前一阶段通过才能以其成果作为下一阶段基础。不得以“等作用线完成”解释前序不能使用。

### P0：统一作用对象与目标身份

- 收敛 F1—F4；由 MapRun 解析单位 / 卡牌引用、具体受用对象、候选、相对规则及控制能力；暴露 detached 关系与无写入候选 preview。
- 接通必要的契约、Registry / Resolver、命令、存档验证链。新增作者字段遵守 Schema 同步，生成物仅经生成器更新；变化影响活动 Run 时处理 `resumeVersion`，不写旧存档迁移层。
- 独立验收：不加载 DOM 也能解析我方 / 敌方、单位 / 卡牌、自身 / 无目标、相对顺序与无权限关系；非法、跨遭遇、跨轮、过期引用被拒绝且无写入；重复查询不改版本、费用、HP、Hand 或 RNG。

### P1：统一作用方与受用方渲染

- 在现有 UnitFace、悬挂 / 浮动 Card 与 Flow 当前玩法卡上使用共享的视觉角色适配；不建立通用领域规则组件。
- 支持双角色、无目标、待选、单位 / 卡牌目标及公开敌方来源。Flow 只增加受控玩法卡内容，继续走共享条目渲染与转义，不接受任意 HTML。
- 独立验收：给定真实关系投影，关闭连接线即可分别识别 Source / Recipient / Candidate；治疗友方、攻击敌方与强化卡牌都使用中性受用标记。没有合法当前卡牌实例时不得用历史文本替代。

### P2：Hover、Focus 与固定状态联动

- Hover / Focus 行为牌检查当前关系，必要时弱示合法候选；反向检查受用单位 / 卡牌时展示已公开的关联来源。
- 多个公开来源可列出或同时标记，但不能覆盖锁定编辑来源；不公开来源不进入反向提示。
- 实施共享优先级、输入切换、退出恢复与生命周期清理。
- 独立验收：鼠标跨单位、悬挂卡、浮层、Flow 移动不清除高优先级状态；键盘可以检查与固定；查询不发送领域命令、不改变领域快照；局部更新后状态仍指向有效对象。

### P3：Override 与右侧换牌浮层

- 复用 0297 展开 / 收起和候选委托，候选从领域查询取得；右侧优先、越界时保持可访问，保留费用不足的禁用理由。
- 预览候选不写入；确认才发送现有 Swap / PlayerCommand，并在 Owner 原子执行 F4，随后重新读取关系、候选与 Commit readiness。
- 独立验收：换牌 → 原目标合法保留 / 非法清除 → 自动解析或提示待选 → 同步高亮闭环；失败命令保留旧草稿；预览、收起或取消不扣费用、不推进轮次、不 Commit。

### P4：点击与拖拽修改目标

- 从单位附属行为或 Flow 当前玩法卡的独立入口进入编辑；作用来源以领域关系为准，不能把 Card 所在列当成执行方。
- 点击合法对象确认；行为卡或目标手柄可拖拽，使用拖拽副本、候选高亮和吸附响应。没有 SVG 线也必须完整工作。
- 原对象可与受用对象相同；相对规则固定、无目标、无权限关系不开放非法改选。键盘提供进入、选择、确认与取消的等价路径。
- 成功确认发送一次带最新有效上下文的 TargetSelection 草稿命令；无效释放零命令；过期命令由 Owner 拒绝并提示重新检查。
- 独立验收：单位与卡牌目标的点击 / 拖拽得到同一草稿结果；命令前后版本可追踪；任何 Hover、释放、点击都不能进入 Commit。

### P5：跨三栏卡牌与交互稳定性

- 验证左我方 / 中 Flow / 右敌方、叠放与旋转、外伸 CardTray、浮层、滚动和遮挡。需要实际新增 CardTray 时先在对应 Unit 写明其节点与刷新职责。
- 多个视觉实例同步角色；隐藏 / 纯展示副本不重复获得交互或权限。遮挡对象可通过展开、键盘或语义候选入口选择；离屏目标仍保留领域选择，提供定位 / 展开入口，不自动强迫阅读滚动跳转。
- 浮层拖拽期间保持来源与候选可访问，按交互状态协调关闭；滚动、来源移除、Flow 回收、读档、路由切换与终态完整清理监听和捕获。
- 独立验收：跨栏操作保留 Frame、滚动 owner、有效焦点与无关浮层；敌方来源只读；同名 / 同 actionId 不串目标；P0—P5 在作用线完全关闭时通过全流程验收。

### P6：最后接入作用线（纯表现层）

- 准入：P0—P5 均有验收证据，包括卡牌目标、公开敌方、跨栏和无 SVG 的实际操作；不得提前搭建完整连接线路由系统。
- 此时才建立统一 Visual Anchor Registry 与 Workspace Connector Overlay；Registry 管理领域对象到可见视觉实例的映射，不能成为对象或关系 Owner。
- 根据现有关系与同一交互状态绘制：方向、自身、同侧上下、同组左右、跨栏、Flow、公开敌方；无目标不连。Hover 显示已选线，编辑显示预览，拖拽跟随指针并吸附领域已批准候选。
- 多实例择锚以当前交互实例和可见性为依据；离屏 / 缺失锚点省略线或明确边缘提示，不伪造另一目标。Overlay 不拦截卡牌命中、点击或键盘焦点。
- 独立验收：关闭 / 移除 SVG overlay 后 P0—P5 功能与正常提交全部保留；滚动、展开、旋转后只更新几何，不重新计算合法性、不改草稿；不为线条新建目标选择状态。

## 结构与刷新方案

拟采用结构，具体新增路径在实施 Unit 冻结：

```text
MapRun Owner → detached relation / candidate / permission projection
  → Map Workspace Controller：唯一交互状态与命令委托
    → 左侧 UnitFace + 当前行为 Card + 替换 Popover
    → 中央 FlowEntry → 受控当前玩法 Card / 历史只读内容
    → 右侧 UnitFace + 可公开意图 Card
    → 角色呈现适配：Source / Recipient / Candidate
    → P6 才新增：Visual Anchor Registry → Connector Overlay
```

- 保留 Frame / 列 / `party-scroll`、`talk-feed`、`action-options`、`context-scroll`；每领域对象在每容器中以独立稳定视觉 key 协调，不能把所有副本强塞入同一 DOM key。
- 优先在现有卡根加语义属性，用伪元素绘制轮廓；每卡最多按需要增加独立发起 / 受用标记及目标手柄，不额外套整列装饰容器。拖拽副本只在拖动期间存在，P6 Overlay 只在 P6 增加。
- Hover / Focus / pointermove 采用 behavior 更新 class / attribute / 副本位置；换牌或改目标沿用现有一次命令收敛点与 `patchMapDOM`，协调所有受影响消费者，不重建共同祖先。
- 临时 role 属性不能在下一次 Map reconciliation 中被误清除；以同一交互状态在该次更新中重核呈现，保持有效节点与指针捕获，不通过重挂整页“恢复”Hover。
- 删除 / 替换卡节点前关闭受影响锚定浮层；范围外浮层保留；来源或版本失效先取消编辑。缺失单个消费者只补所属 region；Run / route 身份变化才允许 structure，旧请求直接失效。
- 各 Unit 开工前说明实际新增节点、稳定 key、更新类型、回退范围与浮层生命周期；本草图不是无限制新增文件白名单。

## 验证计划与总验收

重要跨层合同优先构造行为与边界测试，再施工并严格审查。规划阶段不新增占位测试。

| 验证层 | 入口与要求 |
| --- | --- |
| Owner / 投影 | 扩展 `tests/engine/gameplay-b-map-run.test.ts`、`gameplay-b-map-source-transactions.test.ts`；覆盖 F1—F4、纯查询、权限、版本、非法目标、失败零写入及整轮 Commit。 |
| Runtime / Save | 按实际契约影响选择 `tests/engine/gameplay-b-map-runtime-integration.test.ts`、`gameplay-b-map-save-resume.test.ts`；重载时不保留 UI 临时态，不安装失效卡引用。 |
| 作者入口 | 字段变化补 `tests/data/gameplay-b-map-registry.test.ts`、Resolver / Schema 同步测试与实际 Datapack 样例；不只靠强制类型转换夹具。 |
| UI 行为 | 扩展 `tests/ui/gameplay-b-map-workspace.test.ts`、`map-dom-updates.test.ts`、`map-flow-adapter.test.ts`，按需增加独立关系交互测试；检查命令次数、优先级、节点 identity、Focus / 滚动 / Popover 与普通 Chat 回归。 |
| 工程 | 代码契约改动运行 `npx tsc --noEmit`；跨层边界运行 `npm run check:architecture`；作者字段运行 `npm run gen:schema` 及同步测试；文档运行 `npm run check:docs` 与差异空白检查。 |
| 浏览器 | 桌面真实交互验收 P1—P6，记录截图与操作证据；自动化 DOM 测试不能证明拖拽吸附、遮挡与高亮可读性。 |

- [ ] 单位、双方附属卡与流内玩法卡可准确引用；定义身份、视觉副本、历史条目不混淆。
- [ ] 无目标、待选、自身、单位、卡牌、相对关系与公开 / 未公开敌方都有可观察且正确的结果。
- [ ] Source / Recipient / Candidate 凭形状、位置与标记可区分；友方治疗和卡牌强化不会显示为统一受伤警报。
- [ ] 五级优先级及离开 / 取消后的恢复成立；Hover / Focus 无领域写入。
- [ ] 换牌后目标按 F4 原子保留 / 清理；目标点击与拖拽只改草稿，所有入口受权限与版本校验。
- [ ] 多实例、遮挡、Flow 滚动、浮层、路由 / 读档 / 终态不留下悬挂状态、重复命令或错目标。
- [ ] P0—P5 无 SVG 线也能查看、换牌、点选 / 拖拽并显式提交；P6 关闭后完全保持可玩。
- [ ] 每阶段有独立结果与实际验证记录；未完成项不借后续作用线施工掩盖。

## 执行组织

确认后采用正式 Patch Unit；每阶段可以拆多个 Unit，不把 P0 或 P5 一次塞进巨型补丁。通常每 Unit 3—5 文件、约 300—500 行净改动，包含 Goal、Read Set、Allowed Files、Non-goals、Completion Criteria、Stop Conditions 与 Receipt；超过三个 Unit 时再按项目规则拆同级目录，本轮不预建空 Unit。

最小 Read Set 按阶段选择：P0 / P3 读取上表契约、Owner、preview resolver、Runtime 直接调用与相关测试；P1 / P2 / P4 / P5 读取 Map renderer、controller 委托、Flow DTO / renderer、DOM patch、对应 CSS 与目标测试；P6 再读取锚点 / overlay 的实际消费者。沿用 [[docs/ai/context-packs/ui-presentation]]、[[docs/ai/context-packs/datapack-schema]] 及 [[docs/ai/task-read-set-routing]]，不顺序通读整个仓库。

尚未确定的玩法含义、预算超出或事实冲突须先收敛 Task / Unit，不能由表现组件临时补规则。每阶段结束独立核对代码与 Receipt；不把本轮规划核验当作未来实现通过。

## 当前核验（2026-10-19）

- 已读取用户完整需求、0297、相关工作流、UI / 架构 / 测试 / Schema 约定与样式入口；定向核实上表源码、测试入口及 Runtime / Owner 链路。
- 本轮仅新增本 Task 并在活动索引登记；未修改游戏源码、测试、Schema 或现行视觉约定。
- `npm run check:docs` 通过（扫描 887 份 Markdown，0 errors）；`git diff --check` 通过。未运行游戏测试、类型检查或浏览器验收，因为未施工。

## GALHCG 影响闭环

- 已以工作目录调用 `graph_project`，确认 `project_id=acprogram` 与实际项目根一致。
- `MapRun` 图内查询、`UnitCard` 路径查询无命中；改用 `map-run` 路径查询定位 contracts / service / tests，回到当前文件核实，未据零命中判定无实现。定向 `graph_read` 复核敌方结算与 Flow DTO；部分新源码未入地图，未因此触发刷新。
- 本轮对本 Task 与 `docs/plan-work/00-index.md` 分别执行 `graph_health(check="changed")`：新 Task 返回 `unreferenced_path`，无直接 Evidence / maps_to，故没有地图依据可核验；索引返回 `content_changed`，1 / 1 路径、4 / 4 owner 完整，关联工作流与规划模块，3 条已有 Evidence 提示内容变化，无后续分页。该结果不代表图谱已同步，也不授权维护。
- 地图只读，不编辑图、不刷新清单、不写 freshness；尚无地图维护授权。本 Task 是提案，不登记为已实现机制。

## 剩余工作

- 当前：等待负责人确认本 Task 的整体范围、顺序、视觉 / 交互合同及 F4；确认前不开始源码施工。
- Task 内：P0 收敛 F1—F3 具体合同，按 Unit 完成 P0—P5 并独立验收，随后才允许 P6；所有总验收目前均未完成。
- 相关前序：0297 单位卡 / Popover 与 0296 Flow 的浏览器未验收项需在衔接时核实，必要修复单独记录归属，不直接宣告前序完成。
- Task 外：多行动槽、完整敌方 AI / 手牌、通用 Buff、完整历史回放与移动端适配不属于本轮；后续若需要另立范围。

## 相关路由

- [[docs/ai/goal-workflow]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/galhcg-project-map]]
- [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]] · [[docs/docs-829/05-conventions/schema-sync]]
- [[docs/docs-829/06-wiki/50-ui/read-model-context]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]]
- [[docs/ai/frontend-design-project-overlay]] · [[ui-style/00-index]]
