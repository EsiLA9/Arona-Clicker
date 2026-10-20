# Task 0305 — Init / GlobalEnhancement 节点图重构调查

> 本文回答：如何把当前 Init 与 GlobalEnhancement 轮盘选择页，重构为全画布节点平面图与右侧独立工作台，同时沿用正式游戏的揭示、购买、启用和 Init 进入规则。

状态：investigation complete — 本文为只读调查与重构建议；未改游戏运行时代码，也未裁定最终视觉稿或新增玩法规则。

## 1. 调查范围与结论

本次核对了 Init / Enhancement 定义、PlayerState / ReadModel、揭示计算、购买 / 移除 / Init 进入命令、当前轮盘页面装配，以及 `tools/node-graph-ui-demo/` 的数据模型、DOM 和交互。**Demo 代码只供阅读和参考，正式游戏实现不得直接调用、导入、复制为运行依赖或让产品构建依赖它；未来会直接删除 Demo，删除后节点图选择功能必须仍可独立构建和运行。** Demo 明确不导入游戏模块、不读写存档。

建议把选择页改成单一全屏工作区：保留现有选择页顶部栏及其存档、服务、主题和返回游戏等公共入口；顶部栏下方由全画布节点图占据主区域，右侧固定独立工作台承载所选节点详情、状态、效果和操作。Init 与 GlobalEnhancement 在同一张可探索平面图上呈现，节点关系、位置与类型映射作为表现层配置；节点信息、条件、价格、效果、拥有态及所有修改仍从 Runtime 的只读数据与命令读取。

最重要的建模结论是不能把 Demo 的四态直接当作正式业务状态。图上“隐藏 / 可探索 / 已发现”表达发现与导航；正式系统的 `RevealStage` 表达存在性、信息揭示与可及性；业务层的已解锁、资源支付、效果生效和当前活动 Init 又是另一组状态。重构应保留这几组状态的来源和写入边界，再由 UI 投影组合呈现。

## 2. 当前数据与行为事实

### Init

- 定义为 `InitDef`（`src/data-services/contracts/world.ts`）：`id`、`name`、`description`、`defaultAreas` 是基础字段；还可声明 `enterEffects`、`startStoryId`、`triggers`、`revealTriggers`、`purchaseCost`、`worldTilt` / `worldTiltAlias`、`theme`、`presentation`、`tags` 与 `extra`。
- `PlayerState.activeInit` 表示当前 Init；`unlockedInits` 表示已解锁 Init；`visitedInits` 另记进入历史。`GameReadModel` 暴露只读投影，不应由组件直接改状态。
- `getInitReveal()` 将已解锁视为 owned；否则根据 `revealTriggers` 与当前资源计算揭示层级和可购买性。免费 Init 或当前支付得起时会进入 `purchaseable`。选择页以 `worldTilt` 排序，并将信息阶段、解锁态和价格综合为行项及详情。
- 解锁购买走 `GameCommands.purchaseInit()`。已解锁节点的主操作走 Controller：新游戏调用 `startNewGame(initId)`，重选 / 重启流程调用 `resumeInit(initId)`。这两个流程会进入 Init 生命周期，可能切换或恢复 Init 快照、启动会话、定位起始 Area、挂载 Trigger、运行进入效果等；不能由节点点击或局部 UI 状态替代。
- 首次启动的 Lobby 是 `activeInit` 为空且 Tick 停止的选择场景；进入 Init 后才启动会话。重启选择页与新游戏选择页文案及命令路径不同。

### GlobalEnhancement

- 全局强化仍使用 `EnhancementDef`（`src/data-services/contracts/enhancement.ts`），不是独立实体类型。其 `attachment.kind === 'global'` 是进入全局强化选择集合的主要分类依据。
- 定义可提供 `effects`、`autoApply`、`price`、`irreversible`、`affectorPackIds`、`addsFunctionalities`、`revealTriggers`、`theme`、`presentation` 与 `tags`。具体效果摘要应从定义 / 现有 UI 表达层派生，不能在节点图配置里再维护一份可能过期的描述。
- `PlayerState.unlockedEnhancements` 是强化拥有集合。当前没有独立的 `enabledEnhancements: Record<id, boolean>` 状态字段。购买经 `purchaseEnhancement()` 校验实体存在、未拥有、可见、解锁条件与资源后扣费并登记拥有；`autoApply` 强化可立即执行直接效果，Affector 等派生机制还会按当前运行状态挂载或重检。
- 可撤回强化通过 `removeEnhancement()` 从拥有集合移除，再刷新可见性并重检 Affectors；`irreversible` 强化禁止移除。因此产品 UI 可表达“已拥有 / 生效 / 可撤回 / 不可撤回”，但“是否启用”不能简单读写一个当前并不存在的 bool。若未来需要手动开关，必须另行定义状态持久化、移除与恢复语义、Effect/Affector 生命周期及存档范围。
- `getEnhancementReveal()` 根据 `unlockedEnhancements`、`revealTriggers` 和解锁条件产生 `RevealStage`。当前轮盘将全局强化按成本升序列出，购买与停用分别调用命令；从游戏中打开强化页时保留“返回游戏”入口。

### 正式揭示与 Demo 探索状态

- Engine `RevealStage` 为 `invisible | presence | partial | known | utility | purchaseable | owned`；它同时表达信息披露和可及阶段。`VisibilitySnapshot` 是派生只读结果，不是 PlayerState。
- Demo 的 `NodeState` 为 `hidden | frontier | known | owned`。拥有节点的邻接可达链接把相邻 hidden 改成 frontier；用户再按“探索”转为 known，按“取得”转为 owned。单向边只从起点揭示，虚拟边不参与揭示。选中状态独立于这四态。
- 因而二者不能一一映射：`frontier` 不是 Runtime 可购买，`known` 不是 `RevealStage.known`，`owned` 对 Init 可近似 `unlockedInits`，对强化可近似 `unlockedEnhancements`，但都不能替代 `activeInit`、价格可付性或派生效果是否生效。

## 3. 目标 UI 结构

### 页面骨架

```text
selector-shell（全屏，继续使用现有页面根与页面主题宿主）
├── selector-super-background（如保留主题背景，作为纯装饰层）
├── selector-topbar（沿用现有 Header，不再随图类型翻面）
└── init-graph-workspace（占据顶栏以下剩余视口）
    ├── graph-plane（全宽可平移 / 缩放，节点与关系在同一平面）
    │   ├── 图标题 / 面包屑 / 轻量图例 / 进度摘要（画布覆层）
    │   ├── Init 节点、GlobalEnhancement 节点、关系线
    │   └── 可选的视图工具（缩放、复位视图等）
    └── node-workbench（右侧固定宽度、独立滚动）
        ├── 未选择 / 当前节点标题与类型
        ├── 揭示 / 发现 / 购买 / 拥有 / 活动状态
        ├── 节点描述、条件、价格、效果摘要
        ├── 主操作及可用的次操作
        └── 操作结果 / 失败原因 / 资源反馈
```

- 对应当前实现，顶部栏来自 `renderHeader()`，页面主体当前在 `src/ui/components/selector-page.ts` 中装配；可保留 `selector-topbar` 的宿主和公共行为，替换 `.selector-viewport`、双 `.selector-face`、双 `.init-wheel` 与圆盘装饰为新的工作区。这里的“仅保留顶部栏”指保留原页面顶部栏作为轮盘页面中稳定的 UI 区域，其下方布局整体换成节点平面 + 右侧工作台；不等于删掉保存 / 服务 / 主题等由顶部栏提供的公共操作。
- 画布需占据左侧主要宽度并延伸至视口剩余高度；节点位置、关系和工作台各有清楚边界。工作台不随图平移 / 缩放，内容独立纵向滚动；桌面保持稳定侧栏，窄屏可折叠为抽屉或底部详情面板，具体断点与触控规则留到视觉设计阶段裁定。
- 新布局不应把工作台内容做成覆盖节点的浮层，也不应继续用左右翻面、按圆周重排卡片或双面详情。节点单击 / 键盘激活只改变选中节点，工作台原位更新。
- 顶部栏 theme host 目前根据选择面 / 当前聚焦实体投影主题。改为节点图后应确认主题来源：建议以当前选中节点的主题更新可主题化宿主，同时保持根选择页面的背景与顶栏切换连续；避免把每个节点 theme 直接变成整个画布重新挂载。
- 页面会在 Lobby 首次启动时自动保存一份本地存档；重构只替换 UI 不改变此生命周期。顶部栏“读取本地存档”、主题面板和服务导航必须继续由现有绑定工作。

### 组件责任建议

1. **选择页协调器**：管理页面级当前视图与选择节点，决定新游戏 / 重选模式，调用只读投影与命令；仍由 `UIController` / `GameCommands` 作为业务入口。
2. **节点图视图**：只接收已投影的节点、关系、状态与动作回调，绘制可见节点和连线；不直接访问 Registry、PlayerState 或 EffectEngine。
3. **节点工作台**：呈现当前所选节点的 View Model。可以复用 Init / Enhancement 当前信息格式化工具，但移除与轮盘绑定的布局假设；所有按钮由 Controller 的已有 commands 处理。
4. **图状态投影**：集中计算 node binding → ReadModel/定义 → `RevealStage`、可及性、资源可负担性、拥有态和可执行动作。它是只读 UI 派生，不以 SVG 或 DOM 状态作为权威。
5. **图内容映射**：提供节点布局、节点到产品实体的绑定、节点类型、连线类型 / 方向及可选分组。第一版宜作为独立表现层静态配置；待拓扑确认为内容作者可编辑后，再考虑 Datapack Schema / Registry 扩展并遵循 schema-sync。

## 4. 图模型与节点状态投影

### 节点和关系

建议的最小表现层记录（字段名称仅为讨论示例，尚非 Schema 裁定）：

```ts
type SelectorNodeKind = 'init' | 'global-enhancement';
interface SelectorNodeBinding {
  nodeId: string;                 // 图中的稳定节点 ID
  kind: SelectorNodeKind;
  entityId: string;               // InitId 或 EnhancementId
  position: { x: number; y: number };
  groupId?: string;
}
interface SelectorRelation {
  from: string;
  to: string;
  kind: 'route' | 'directed' | 'association';
}
```

- `kind` 决定图标、主题、字段解释和工作台动作路由；`entityId` 绑定现有产品实体。节点不要复制业务定义的 name / description / cost / effect，也不使用显示名称当作稳定键。
- `route` 可双向探索，`directed` 有明确方向，`association` 只表达关系、不解锁探索。是否保留 Demo 的三种线型语义应由产品规则最后确认；图线在正式接入前只应影响展示 / 导航发现，不能悄悄成为购买、进入或效果的授权条件。
- Init 与全局强化可以位于一张画布，但二者仍按 `kind` 使用各自详情和命令。可通过空间区块、群组或视觉编码区分，不应人为制造“Init 拥有强化”或“强化依赖 Init”的业务关系。
- 第一版建议每个产品实体最多绑定一个图节点；如果未来需要重复节点 / 入口别名，必须先定义相同实体跨节点选择、选中态和揭示传播行为。

### 四个互相独立的状态轴

工作台和图节点应从以下来源合成展示，不维护一份复制的业务真值：

| 维度 | 权威来源 / 计算 | UI 含义 |
| --- | --- | --- |
| 实体存在可见 | `VisibilitySnapshot` / `getInitReveal()` / `getEnhancementReveal()` 的 existence 结果 | 不可见节点不显示业务名称、图标、效果、标签或 tooltip；图上是否留匿名轮廓待裁定信息泄露策略 |
| 图上探索可见 | 图关系、可见入口、当前导航范围；若“探索”会永久记录，则需另定状态 owner | 尚未触达的节点可显示匿名 frontier；触达行为不可自动购买或进入 |
| 信息揭示 | `RevealStage` 与 `nameKnown` / `conditionKnown` / `utilityKnown` | 控制节点文字、条件、效果摘要、价格等披露粒度；Frontier/unknown 不通过 aria-label、tooltip、DOM 属性泄漏 |
| 可及与业务状态 | Init 购买条件、资源、`unlockedInits`、`activeInit`；强化 unlock 条件、资源、`unlockedEnhancements`、效果定义 / 派生挂载 | 计算购买 / 进入 / 移除是否可操作、活动标记与按钮状态；最终由 Runtime 命令再次校验 |

把“探索”从“可及”中拆开能避免两个错误：沿图边触达一个实体就绕过 `revealTriggers` / 购买条件；或将 Runtime 已可购买误写成图上必须先探索几次才可买。当前 Demo 的 `Frontier → Known` 如要保留，应仅成为发现提示 / UI 局部状态，除非产品明确定义为持久化的新玩法状态。

推荐状态表现：

- `hidden`：业务存在性不满足时完全不渲染实体信息；是否展示无名封闭节点需按保密要求裁定。默认不显示。
- `frontier`：图上可沿连接触达，但业务揭示可能仍是 `presence` / `partial`。只显示允许透露的占位信息；点击仅选中，明确“继续探索”操作只在产品规则授权时出现。
- `known`：名称、条件、效用的具体字段仍按 `RevealStage` 分级；UI 标签“已发现”不能自动保证 RevealStage 完整。
- `purchaseable` / `accessible`：作为 CTA eligibility 显示。Init “可购买”不能和“已解锁可进入”混淆；强化购买同时验证 `unlockCondition` 和资源。
- `owned`：Init 映射到 `unlockedInits`，强化映射到 `unlockedEnhancements`。Init 被选中进入后另加 `active` 标记（`activeInit`）；强化效果是否生效应从现有机制派生，不假设它等于拥有集合或另有 enable bool。
- `selected`：仅 UI 选择态，和节点业务状态正交，不写存档。

## 5. 交互流与命令接入

### 节点通用交互

1. 点击、Enter / Space 或触屏激活节点：选中并更新右侧工作台，不改变游戏状态。
2. 工作台按当前 View Model 显示合法主操作。按钮触发后端现有 Controller / `GameCommands`；命令响应后从最新只读模型重新投影节点、关系与详情。运行时拒绝、资源不足或并发状态改变时显示明确反馈，不仅靠按钮 disabled 做安全校验。
3. 图上探索 / 导航若会改变可见节点范围，应单独定义为展示状态或正式状态。无论哪种，探索命令不能复用 `purchaseInit` / `purchaseEnhancement`，也不能直接变更 `unlocked*` 集合。
4. 只有已选节点的详情操作可执行，关系线与工作台背景不执行购买。快捷键和焦点管理在选中、动作后更新时应落到仍存在的节点或下一合法按钮。

### Init 节点

| 当前投影 | 工作台建议操作 |
| --- | --- |
| 未拥有、可见但购买条件或资源不足 | 显示揭示到的名称 / 条件 / 费用；购买按钮不可用并提供原因 |
| 未拥有、可购买 | `购买解锁` → `GameCommands.purchaseInit(initId)`；刷新状态，不自动进入，延续当前轮盘行为 |
| 已解锁，Lobby 新游戏流程 | `开始新的世界线` → `startNewGame(initId)` |
| 已解锁，重选 / 软重启流程 | `回到世界线` → `resumeInit(initId)`，保留快照行为 |
| 游戏中从 GlobalEnhancement 面返回选择页 | 保留返回当前游戏按钮；选择页当前公开只提供强化热插拔入口，是否允许此模式下切换 Init 需沿用原准入规则，不应由节点图擅自开放 |

`activeInit === initId` 是“当前活动世界线”标签，不等于节点是否 selected，也不等于拥有。`visitedInits` 是访问记录，可作为未来徽章来源，但不是可进入授权。

### GlobalEnhancement 节点

| 当前投影 | 工作台建议操作 |
| --- | --- |
| 隐藏 / 未达到揭示阶段 | 按当前 `RevealStage` 遮挡内容；不提供购买操作 |
| 可见且解锁条件、资源满足 | `购买强化` → `GameCommands.purchaseEnhancement(enhancementId)`；扣费和拥有写入由服务层执行 |
| 已拥有且允许移除 | 显示拥有、当前派生效果摘要、`停用 / 移除` → 现有移除命令；文案采用项目已有语义，确认“停用”是否等价 remove+可重购 |
| 已拥有且不可撤回 | 显示活动 / 不可撤回标识，不给移除动作 |

工作台可以按类型把效果摘要分组显示为“效果 / 标签范围 / 新增功能 / 自动应用 / 可撤回性”，字段来自 EnhancementDef 与现有效果解释逻辑。效果真实启用状态应显示为“已获得 / 效果已挂载”等可证实信息；若系统无法从只读接口可靠判断，就不要虚构一个启用开关。

### 图探索与节点可及的关系

图边的探索规则目前只存在于 Demo，没有 Init / GlobalEnhancement 的产品拓扑字段或连接写入合同。本次建议在首次产品接入时将图边用作“导航和发现关系”，其能否使目标进入 `frontier` 只控制呈现，不替代实体 `revealTriggers`、购买门槛或 Runtime 命令校验。若期望“未探索就不能购买”，这是新增玩法规则，需单独设计持久化归属、重置语义、Effect / Reveal 联动、存档边界与测试，不能只在前端隐藏 CTA。

## 6. 迁移建议与文件触点

按可审查切片重构，后续实施前仍需补视觉裁定与影响面审查：

1. **固化只读投影**：为 Init 与 GlobalEnhancement 建节点 View Model，集中组装图 ID、实体 ID、节点 kind、RevealStage、资源 affordability、owned、active、允许动作与安全摘要；沿用 `UIContext` / `GameReadModel`。
2. **建立表现层图配置**：整理节点位置与关系。首版独立于内容 Schema；验证注册表中 ID 存在、绑定不重复、关系端点有效、单向边无歧义。默认用可预测固定坐标或已有布局策略，不从隐藏数据泄露标签。
3. **替换页面主体**：在 `src/ui/components/selector-page.ts` 保留 Header，替换双面和双轮盘 DOM 为画布 + 右工作台。新增独立 CSS 区块，确认画布和工作台的滚动、缩放、窄屏折叠和主题宿主。
4. **拆分轮盘状态协调器**：`src/ui/selector-page.ts` 当前管理 face、两个 selected ID、翻面计时、轮盘重排、滚轮选项和主题聚焦同步。移除面向 / 翻盘专有行为，保留 Init / Enhancement 选择 ID、页面重建恢复选择、Resize 等必要协调；不要保留一个伪轮盘兼容抽象。
5. **复用命令绑定并明确反馈**：`src/ui/controller-panels.ts` 内的 `purchaseInit`、`startNewGame`、`resumeInit`、`purchaseEnhancement` 路径应保留为 Controller command 边界；增强的移除动作复用其既有绑定，不绕开 commands 或直接 mutation。
6. **核查顶栏主题与通用工具绑定**：`bindTopBarActions()`、theme / entity presentation action 当前在整页 render 后绑定；确认保留顶部栏 class / selector-root 条件后原服务导航仍有效，检查 `refreshHeaderPresentation()` 与 `SelectorPage.refreshTopbarPresentation()` 是否适应图节点聚焦。
7. **按行为而非旧 DOM 形状验收**：重点覆盖 Lobby 初始选择、新游戏、Init 购买后独立进入、重启后恢复快照、全局强化购买 / 移除 / 不可撤回、揭示遮挡、返回游戏、主题切换、鼠标 / 键盘节点选择、节点探索不直接取得、资源变化后的按钮同步，以及窄屏工作台可达性。

预期源码触点（实施时逐项确认，不表示现在修改）：

- `src/ui/components/selector-page.ts`：选择页 DOM 根与头部保留，主体替换。
- `src/ui/selector-page.ts`：从双面轮盘协调转为图选择协调。
- `src/ui/components/init-select.ts`、`src/ui/components/global-enhancement-select.ts`：保留数据摘要/详情中可复用的纯呈现能力，解除对行项 / 圆盘布局的耦合；必要时抽纯 View Model。
- `src/ui/controller-panels.ts`、`src/ui/controller.ts`：复用现有 commands / Controller 回调，避免新增旁路状态写入。
- `src/ui/css/selectors.css` 或新建专用图样式模块：清理轮盘专属规则，建立全视口工作区、画布、节点、工作台及响应式布局。
- 相关测试主要位于 UI selector / Controller、`tests/engine/init-global-lifecycle.test.ts` 及 Enhancement 服务测试；精确集合待按最终行为核实。

不触及 `tools/datapack-editor/`；本项目“编辑器”默认指游戏内 UI。Demo 仅用于人工阅读其节点绘制、平面交互和视觉层级。不得从游戏源码导入 `tools/node-graph-ui-demo/`，不得把 Demo 的 `app.ts`、DOM、类型或内存状态作为产品运行依赖，也不以保留 Demo 为游戏功能成立的条件。正式节点图须在 `src/ui/` 内独立重建并接入现有 ReadModel / Controller / GameCommands；未来删除 `tools/node-graph-ui-demo/` 后产品仍须构建、运行。Demo 的空间投影可参考，业务控制流需重做。

## 7. 主要风险与待产品裁定

1. **发现是否持久化**：Demo 刷新即重置；游戏选择页有正式存档。确定探索状态只活在页面，还是作为全局跨 Init 进度记录。默认建议第一版沿用现有 `RevealStage` / 图连接计算发现态，不新增存档字段。
2. **拓扑是否影响授权**：当前没有节点图连线数据。确定图边只导航 / 发现，还是成为 Init / 强化购买前置条件。默认只作导航，不改既有业务可及条件。
3. **强化“启用”的定义**：现有状态没有 enable bool，且持有、`autoApply` 直接效果和 Affector 挂载存在区别。先明确是否只展示系统计算结果；若用户需要开关，再设计正式命令和状态字段。
4. **节点内容保密**：即便图节点未显示名称，SVG、DOM、tooltip 和辅助技术标签也可能泄露；必须以实体存在性及字段揭示层级裁剪数据，而不仅隐藏文本。
5. **Init 与强化混图的可读性**：节点类型、线条颜色、空间分区、拥挤与连接语义需在新视觉稿中明确。关系网络不能单纯按强弱关系自动布局导致节点移动、重叠或焦点丢失。
6. **生命周期与返回路径**：Lobby 新游戏、restart、mid-game 全局强化热插拔入口运行模式不同；统一画布不得把“选择 Init”和“选择全局强化”处理成一样的动作。
7. **主题覆盖范围**：当前每面聚焦不同实体并投影选择页主题。图上选中节点频繁变化时，需决定只更新工作台、更新顶栏 / 背景，还是保留选择页基底；涉及全局视觉重塑时再使用 `frontend-design` skill 并按 UI 风格包定稿。

## 8. 源码依据

- 数据定义：`src/data-services/contracts/world.ts`（`InitDef`）、`src/data-services/contracts/enhancement.ts`（`EnhancementDef` / `EnhancementAttachment`）。
- 玩家状态：`src/arona-clicker/types/state.ts`（`activeInit`、`unlockedInits`、`unlockedEnhancements`、`visitedInits`）；`src/arona-clicker/state/per-init-fields.ts`（强化按 global / local 附件范围保留或快照）。
- 揭示模型：`src/engine/contracts/reveal.ts`；`src/ui/components/tooltip-reveal.ts`（`resolveReveal`、`getInitReveal`、`getEnhancementReveal`）。
- 生命周期：`src/arona-clicker/services/init-service.ts`；机制页 [[docs/docs-829/04-mechanisms/arona-clicker/world-lifecycle]] 与 [[docs/docs-829/01-architecture/run-logic]]。
- 强化购买 / 移除：`src/arona-clicker/services/enhancement-service.ts`；产品边界 [[docs/docs-829/05-conventions/architecture-discipline]]。
- 旧 UI：`src/ui/components/selector-page.ts`、`src/ui/selector-page.ts`、`src/ui/components/init-select.ts`、`src/ui/components/global-enhancement-select.ts`、`src/ui/controller-panels.ts`、`src/ui/css/selectors.css`。
- Demo 参考：`tools/node-graph-ui-demo/README.md`、`tools/node-graph-ui-demo/index.html`、`tools/node-graph-ui-demo/app.ts`。Demo 本身尚有后续空间交互浏览器验收待补，且不属于产品行为证据。
- 项目入口：[[docs/ai/context-packs/world-lifecycle]]、[[docs/ai/context-packs/ui-presentation]]、[[docs/docs-829/05-conventions/doc-maintenance]]。

## 9. 后续实施准入

本文完成调查记录，不等于批准新增玩法或字段。开始 UI 重构前，应先裁定第 7 节中的持久化、图边授权和强化启用语义；如仍按本文默认方案，则只改表现和选择页交互，沿用现有业务命令与存档合同。若增添字段或枚举，补读 schema-sync；若新增状态写入、跨层依赖或 Init 归属，再读 architecture-discipline 与对应状态页。完成实施后按 UI 定向行为测试、类型检查和浏览器验收验证。
