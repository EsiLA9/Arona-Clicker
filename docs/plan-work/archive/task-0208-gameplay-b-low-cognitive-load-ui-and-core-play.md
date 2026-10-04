# Task 0208 — 玩法 B 低心智负担界面与核心游玩验收

状态：done — U1–U3 已完成；玩法 B 原型 UI、固定桌面路线走查与终态核验通过

## 目标

在独立 `prototypes/gameplay-b/` 中整理路线、场景选择与玩家主动卡的表现，让玩家能快速看清当前位置/合法路线、每批必选与可选内容、目标、费用和一次 Click 的后果。通过固定 Seed 浏览器实走确认核心路线与战斗编辑仍易发现、可理解。

此 Task 覆盖 Draft 0207 的 UI 与玩家验收阶段；不改 Route/Battle 规则，不接入 AC Runtime，不改变游乐园节点和路线选择内容。

## 设计决策

1. **路线图按需展开。** 默认线路摘要只突出当前位置、已走路线和当前真实开放的出口；玩家可展开完整 13 节点拓扑图，显示节点连接、区域/层级与访问次数。路线出口选择阶段展示 Runtime 返回的全部合法出口及目标地点；若出口会消费持有物，按钮说明所消费物品。迷宫四路内容保留。
2. **Individual 留在中央工作区。** 每个当前行动批次为每名存活角色保留一行，显示待选/已选状态和所选行为；行内直接选择行为，不要求逐个打开菜单后记忆前项。完成后进入下一批，不能把“本批完成”显示为“本场景完成”。Global 只显示一个共享选择。
3. **玩家场景卡先选卡再确认目标。** 未选中的卡没有目标控件。选择目标卡后显示目标候选；单目标/多目标均须显式确认合法目标后才纳入本批，取消时同时撤回卡牌和目标草稿。同名卡实例须能区分。
4. **批次信息集中且分层。** 中央工作区呈现必选行为、可选卡、选中目标、总 Cost/余额与一次 Click 将结算的内容；费用与 Click 摘要各只有一份。行动说明含简短效果/检定风险与费用。日志显示已发生结果，不充当待选表单。
5. **右侧默认留白。** 不为填充留白复用敌方区。只有能减少重复信息且不遮挡 Chara/敌方、也不混淆路线和战斗语义时，才允许显示一份简短当前批次摘要。
6. **主 Click 在固定桌面画布易找到。** 本 Demo 只按 1280×720 桌面视口设计与验收；不考虑窄屏引起的布局重排或内容移位，也不改造这类适配。中央主列自身承担纵向滚动，底部唯一 Click 固定可见；滚动阅读旧日志时不跳到底。路线转移后中央列回到顶部并聚焦新当前位置，普通选择/目标改动不丢失焦点或重建不相关 DOM。
7. **战斗控制仅补发现性证据。** 保留现有普通卡点击重选、合法目标拖拽、冻结意图及失效行动回落语义；用浏览器验收证明玩家能发现和使用，不扩大规则。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 公园图配置 13 节点，横跨地面园区与地下设备层；有环、持有物条件/消费和 `maxVisits`。 | `prototypes/gameplay-b/src/content/park-graph-route.ts`：`parkGraphRoute`；`prototypes/gameplay-b/src/runtime.ts`：`validateRouteInput()`、`completeCurrentNode()`、`chooseExit()` | UI 显示图结构和访问次数但不更改路线规则。 |
| 路线图目前按区域常驻显示所有节点标签，没有边；当前/到访状态高亮，合法出口仅在等待出点时显示。 | `prototypes/gameplay-b/src/view.ts`：`route-map-panel`、`syncMapAndResources()`；`prototypes/gameplay-b/src/style.css`：`.route-map-*` | 用当前摘要+可展开全图减少默认扫描量，并补拓扑关系。 |
| Runtime 的出口列表按条件/持有物/目标节点访问上限过滤；出口 UI 遍历全部 `availableExits`，当前布局为 flex-wrap。镜面迷宫可以同时开放四出口。 | `prototypes/gameplay-b/src/runtime.ts`：`completeCurrentNode()`；`prototypes/gameplay-b/src/view.ts`：`syncMapAndResources()`；`prototypes/gameplay-b/src/content/park-graph-route.ts`：`node-7`；`prototypes/gameplay-b/tests/park-graph-route.test.ts`、`prototypes/gameplay-b/tests/route-runtime.test.ts` | 不设 3 项上限，按钮显示目的地及消费物品。 |
| Individual 每位存活角色各选一个行为；Global 是全队一个行为。Runtime 输出批次选择及费用；页面目前以逐角色 `<select>` 和全局按钮呈现。 | `prototypes/gameplay-b/src/runtime.ts`：`getSceneChoiceView()`、`selectIndividualBehavior()`、`selectGlobalBehavior()`；`prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()`；`prototypes/gameplay-b/tests/route-runtime.test.ts` | 将状态改成可扫读的稳定逐角色行/选择项。 |
| 目标类场景手牌无论选中与否都显示目标 `<select>`；选卡会携带记忆/默认目标直接进入待提交状态。目标通过实体卡 ID 区分。 | `prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()` 的 `scene-card-target-select` 与 `selectPlayerCard`；`prototypes/gameplay-b/src/runtime.ts`：`selectPlayerCard()`、`unselectPlayerCard()` | 需显式拆分“选卡”与“确认目标”，选中状态不得伪装为已确认。 |
| 有场景选择时预览区隐藏；行为仅显示名称与 Cost，汇总行显示总 Cost/余额；场景卡在另一控制组，Click 在页面底部 Dock。 | `prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()`、场景状态更新；`prototypes/gameplay-b/src/style.css`：`.scene-choice-panel`、`.action-dock` | 同一工作区按必选/可选/费用与结算后果分层，避免重复并保持 Click 可见。 |
| 当前样式在 1100px 以下会调整为双列并把敌方区置于下方；旧的 Click 底沿观察先于 Task 0205 的此项验收。 | `prototypes/gameplay-b/src/style.css`：`@media (max-width: 1100px)`；归档 `task-0205-gameplay-b-map-and-player-actions.md` U4B Receipt | 这只是当前代码事实；Task 0208 不改、不测试窄屏重排，不把历史现象误记为当前桌面缺陷。 |
| 战斗卡提示逻辑已实现，但 Task 0206 未做浏览器手动验收。 | `prototypes/gameplay-b/src/view.ts`：`cardEditInstruction()`；归档 `task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback.md` U3 Receipt | 加入可发现性浏览器验收，不改战斗模型或动作逻辑。 |

## 施工切片

### U1：当前位置摘要与可展开路线图

**Goal：**默认状态优先显示玩家当前所在、已走路径和实际合法出点；完整路线拓扑通过一次明确操作展开，显示所有节点连接、区域/层级与访问次数。

**Must Read / Read Set：**

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Unit 白名单、预算、Receipt 与停止条件。 |
| 文档 | `docs/ai/frontend-design-project-overlay.md` | 参考刷新范围和交互连续性要求；该原型不是 `src/ui/`，按本 Task 的 DOM budget 执行。 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：`syncMapAndResources()`、map creation | 现有稳定地图、节点和出口 DOM。 |
| 源码 | `prototypes/gameplay-b/src/content/park-graph-route.ts`：`parkGraphRoute` | 节点/出口/区域数据来源。 |
| 源码 | `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteView` | 视图拥有的节点访问与合法出点数据。 |
| 测试 | `prototypes/gameplay-b/tests/park-graph-route.test.ts`、`prototypes/gameplay-b/tests/route-runtime.test.ts` | 保持出口过滤、四出口、消费和回环语义。 |

**Context Budget：**目标 10k–20k token；文档 Read Set 3 篇；历史文档默认 0 篇；超过 60k token 拆分或升级。

**Optional Read Set：**归档 Task 0205 的 U4B DOM budget 与浏览器验收记录，仅为确认之前已验收的焦点/地图路径。

**Do Not Read by Default：**`docs/plan-work/archive/**`（上项除外）、`src/` AC Runtime 与无关 UI 模块。

**Confirmed Facts：**见本 Task「当前事实与代码落点」的路线图和出口条目。

**Constraints：**仅 UI 投影；不改变 `availableExits` 过滤；显示全部 Runtime 返回出口；出点按钮体现目标与消费物品。展开/收起不能推进 Click、路线、RNG 或事件。

**Allowed Files：**

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-ui.test.ts`（允许新增）

**Explicit Non-goals：**不改路线图节点/出口、路线 Runtime、持有物条件语义、访问上限、Cost、主题素材或 AC Runtime。

**Stop Conditions：**按 `docs/ai/PROJECT-CONSTITUTION.md`「停止条件」六项执行；特别是需要扩大地图视图契约或修改白名单文件时停止上报。

**Completion Criteria：**

- [x] 默认摘要明确当前节点与访问次数、已走路线和正在等待的状态；场景尚未完成时不把结构性邻接误标为可选出口。
- [x] 一次展开后可理解 13 节点连接/跨层路径；当前位置、已访问节点和访问次数可辨。
- [x] 4 个合法出口同时返回时全部出现，文字能读出目标地点和实际消费物品；无凭证路径仍能通过兜底路线继续。
- [x] 展开/收起、出点选择和普通地图更新不推进游戏状态、不重建不相关角色与日志 DOM。

**Verification：**

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npm test -- route-ui`、`npm test -- park-graph-route`，工作目录 `prototypes/gameplay-b/` | 新增的纯展示映射测试与既有路线内容测试通过。 |
| 类型检查 | `npm run typecheck`，原型目录 | 通过。 |
| 浏览器 | 固定 Seed 到镜面迷宫首次完成，依次观察折叠态、展开态和 4 出口；另测试 ferris 有/无持有物路线 | 所有选项可见，路线、访问次数、消费描述正确，操作不引发 Click。 |

### U2：场景批次工作区与主动卡目标流程

**Goal：**让玩家在一个中央工作区完成 Global/Individual 当前批次和可选卡编辑，显式确认目标、费用和待结算结果。

**Must Read / Read Set：**

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Unit 施工与交付协议。 |
| 源码 | `prototypes/gameplay-b/src/runtime.ts`：`getSceneChoiceView()`、选择命令、`selectPlayerCard()`、`unselectPlayerCard()` | 确认视图契约、原子费用和选择阶段。 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：`syncSceneChoices()`、场景状态更新 | 替换当前下拉/目标控件的 UI 流程。 |
| 源码 | `prototypes/gameplay-b/src/content/park-graph-route.ts`：`node-3`、`node-4`、`node-7`、`playerDeck` | Global、Individual、多人/重复牌样例。 |
| 源码 | `prototypes/gameplay-b/src/locations/activity.ts`：`LocationActivityDefinition`、`ActivityOutcome` | 依据已声明检定/效果生成简明行为说明，不添新规则。 |
| 测试 | `prototypes/gameplay-b/tests/route-runtime.test.ts`、`prototypes/gameplay-b/tests/route-cards.test.ts` | 保留玩法批次和路线卡行为。 |

**Context Budget：**目标 10k–20k token；文档 Read Set 2 篇；历史文档默认 0 篇；超过 60k token 拆分或升级。

**Optional Read Set：**归档 Task 0205 的玩家主动卡实现收据，确认现有卡牌样例和 Runtime 语义。

**Do Not Read by Default：**`docs/plan-work/archive/**`（上项除外）、战斗卡编辑器与 AC Runtime。

**Confirmed Facts：**见本 Task「当前事实与代码落点」的场景选择与场景卡目标条目。

**Constraints：**场景批次内保留统一共享 Cost；卡牌费用和行为费用一起校验。普通选择/撤销不推进 Click/RNG。行为文案依据当前配置生成，不添加角色 Cost 技能或新卡规则。

**Allowed Files：**

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-ui.test.ts`

**Explicit Non-goals：**不改 Runtime 行动/卡牌结算、抽牌规则、牌组内容、战斗卡目标编辑、角色卡 DOM 或角色 Cost 技能。

**Stop Conditions：**按 `docs/ai/PROJECT-CONSTITUTION.md`「停止条件」六项执行；如显式目标流程要求改变 Runtime 选择契约，停止并报告，不得自行扩大范围。

**Completion Criteria：**

- [x] Individual 每批的每位存活角色都有稳定行；4 人和 6 人状态一眼可查，已选行为可读，下一批重新出现正确待选状态。Global 只提交一项共享行为。
- [x] 必选行为与可选卡牌分区明确；行为文本提供短效果/检定风险及费用；玩家能看到已选目标、单批总费、余额与不足费用状态，且摘要不重复。
- [x] 目标卡只有被选中后才显示目标选择；初次选中不偷偷提交默认目标。合法目标须明确选择并确认后才结算；重复同名卡可区分。
- [x] 取消目标/卡牌会清空该卡待提交状态，不残留假目标；非法目标与 Cost 不足继续由 Runtime 拒绝并保留状态。
- [x] 两个镜面迷宫行动批次均需分别完成 Individual 选择；完成首批不会误报场景出口已开放。

**Verification：**

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npm test -- route-ui`、`npm test -- route-cards`、`npm test -- route-runtime`，工作目录原型目录 | UI 映射回归及既有规则测试通过。 |
| 类型检查 | `npm run typecheck` | 通过。 |
| 浏览器 | 固定 Seed 覆盖四人 Global、四人/六人 Individual、两行动批次、选目标卡→改目标→取消→重选、重复同名卡、Cost 不足 | 玩家能解释必选与可选、目标/费用，结算前能说明本批后果。 |

### U3：Click 可见性、战斗手势发现性与全程玩家验收

**Goal：**保证唯一 Click 在主桌面视口易找、操作文案准确；将场所与战斗合入固定路线实走并记录玩家任务证据。

**Must Read / Read Set：**

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md` | Unit 施工边界。 |
| 源码 | `prototypes/gameplay-b/src/view.ts`：`action-dock`、`cardEditInstruction()`、`update()` | 唯一 Click 状态和战斗操作提示。 |
| 源码 | `prototypes/gameplay-b/src/style.css`：`.action-dock` | 固定桌面画布的主操作区表现。 |
| 测试 | `prototypes/gameplay-b/tests/route-ui.test.ts`、`prototypes/gameplay-b/tests/battle-cards.test.ts`、`prototypes/gameplay-b/tests/player-card-edit.test.ts` | 可见摘要映射及既有战斗编辑护栏。 |
| 文档 | 归档 `task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback.md` | 核对战斗逻辑已测但浏览器尚未验收的边界。 |

**Context Budget：**目标 10k–20k token；文档 Read Set 2 篇；历史文档 1 篇；超过 60k token 拆分或升级。

**Optional Read Set：**归档 Task 0205 U4B 的固定桌面视口 scroll/focus 验收收据。

**Do Not Read by Default：**AC Runtime、无关战斗规则模块、其他 UI 工作区。

**Confirmed Facts：**见本 Task「当前事实与代码落点」的布局与战斗发现性条目。

**Constraints：**一次 Click 只处理当前批次/冻结战斗轮。不得通过 fixed Dock 遮挡可操作内容；保留日志“未读历史时跟随尾部、阅读历史时不跳动”和路线转移焦点连续性。

**Allowed Files：**

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-ui.test.ts`

**Explicit Non-goals：**不改 Battle Runtime、冻结技能/敌意、战斗结算、路线规则、角色卡编队、移动端专项或 AC Runtime。

**Stop Conditions：**按 `docs/ai/PROJECT-CONSTITUTION.md`「停止条件」六项执行；若必须改变战斗规则/选择契约，停止并上报。

**Completion Criteria：**

- [x] 主 Click 在固定 1280×720 桌面视口可见且不遮挡；标签始终准确说明当前将结算一批场景行为还是一轮冻结战斗。
- [x] 浏览器可发现战斗普通卡重选、合法目标拖拽及取消/非法目标行为；不得因编辑推进 Click、改变冻结意图或重掷随机结果。
- [x] 日志阅读历史时保持 scroll；选择、目标确认、取消不重建无关列表；路线转移后焦点落到当前节点标记。
- [x] 一条固定 Seed 实走覆盖 Global/Individual、两批行动、分支、回环、四出口、持有物捷径与无物兜底、进入战斗并完成一轮卡/目标改选。
- [x] 验收记录包含 Seed、路线节点、角色/物品状态、视口、页面滚动状态；逐项记录玩家是否找到入口、是否一次选对、能否复述费用/目标/Click 后果及结算后下一步；不记录速度得分。

**Verification：**

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npm test -- route-ui`、`npm test -- battle-cards`、`npm test -- player-card-edit`，工作目录原型目录 | 通过，战斗规则保持不变。 |
| 原型验证 | `npm test`、`npm run typecheck`、`npm run build` | 玩法 B 原型全测、类型检查、构建通过。 |
| 浏览器 | Edge/Chrome 固定 Seed 主路线；1280×720 固定桌面视口 | 记录交互证据；Console 无新增错误。 |

## DOM Budget 与交互连续性

- **新增 wrapper / 节点：**不新增只作装饰的 wrapper；复用现有线路牌、场景选择面板、日志和 Action Dock。新增最多一个地图展开按钮和一个 SVG 路线边层；边 `path` 数不超过配置出口数。目标候选仅为当前被选中的目标卡创建。
- **稳定节点：**现有 13 个 map marker、角色卡、场景选择根、日志滚动容器、Action Dock。复用中心列作为 scroll container，不添加滚动容器 wrapper。
- **behavior patch 范围：**当前/到访状态、选择标记、Cost/状态文案、地图展开态和目标选择状态。
- **region 替换范围：**只在当前场景类型、角色数量或手牌实体集合改变时更新对应 map/choice/exit 子区；日志持续追加。
- **full render 条件：**只允许启动/重启整局时重建页面。普通选择、目标选择/取消、展开地图、路线确认和 Click 后反馈不得调用全页重建。
- **scroll / focus / hover：**保留日志容器节点和用户的历史 scroll；中心列可滚动且 Action Dock sticky；路线切换时中心列回到顶部并将焦点移到新当前节点，出点/地图展开不抢不相关焦点；关闭或移除的目标控件清理其局部状态和指向。
- **click 后 identity：**路线 marker（节点 ID 不变时）、角色卡、日志容器和 Click 按钮跨普通行为选择与目标操作保持节点身份。

## 非目标

- 修改 AC Runtime、`src/` 主游戏 UI、Engine 或 Datapack。
- 改路线图/战斗规则、分支内容、访问次数、出口条件、Cost 结算、卡组/抽牌、人物技能和冻结随机语义。
- 窄屏/移动端适配、因窄屏导致的重排或内容移位、全面视觉换肤、自动游玩/速度压力、战斗规则扩展或角色 Cost 主动技能。

## 最终核验（2026-10-03）

- U1–U3 完成；仅修改允许的原型视图、样式与 `route-ui.test.ts`，没有改路线/战斗 Runtime、场景内容或 AC Runtime。
- 固定种子：`park-inspection-graph-demo`。1280×720 实走包含两条路线：
  - 有持有物路线：西门临时执勤点 → 林荫连廊 → 游园服务亭 → 代币电玩馆 → 镜面迷宫 → 摩天轮检修廊 → 地下设备层控制室 → 中央舞台设备井。广播联络和维修通行证卡使员工广播凭证、维修通行证入手；迷宫完成后 4 个出口同时出现。控制室显示两条有物品门槛的设备井捷径及各自消费物品；选择通行证路线后日志记录 `maintenance-pass` 消耗。Cost 携带上限在路线日志中实显（迷宫离开 6→5、检修廊离开 6→4、控制室离开 7→5）。
  - 无持有物回环路线：西门临时执勤点 → 林荫连廊 → 游园服务亭 → 代币电玩馆 → 游园服务亭（到访 ×2）→ 代币电玩馆（到访 ×2）→ 镜面迷宫 → 摩天轮检修廊。未打出物品卡且持有物为“无”时，检修廊仅出现“经后台前往排练广场”的普通兜底出点；记录了访问次数与环路路径。
- 场景走查覆盖 Global 共享按钮、4 人 Individual 直接选择、两批迷宫逐角色选择、场景玩家卡 Cost 合并、目标卡选择/改选/取消，以及 Click 结算后当前批/路线状态更新。浏览器操作者完成了找入口、辨认费用/目标/结算下一步的任务；这是内部首轮操作走查，不等同于独立玩家样本研究。
- 战斗走查：普通行动卡打开重选架，灰显“爆破”说明起始 sCost 不足；由理改选冲锋目标，从护具学生拖到红面具领队，冻结预览更新且编辑没有推进 Click。之后只结算一轮，页面进入第 2 轮准备。浏览器也演练目标草稿取消；非法目标/费用规则由既有 Runtime 与编辑器测试覆盖。
- 桌面布局：1280×720 下主列自身可纵向滚动，底部 Click Dock 保持可见（观察 rect top 623.7、bottom 701.3）；主列滚动后可读完整场景内容与长日志。事件日志历史位置滚动时保留在自身容器；地图展开不推进场景或 Click。路线切换将主列滚回顶部并聚焦当前节点。
- 最新重载后首屏正常。Console API 保留一条早于目标摘要修复的历史 `cardTargetIds` 报错（2026-10-03 13:58 UTC）；重载后无新 Console error。
- 定向验证：`npm test -- route-ui` 4/4、`npm test -- route-cards` 7/7、`npm test -- route-runtime` 17/17；随后玩法 B 原型全测 18 个文件 / 156 项通过，`npm run typecheck`、`npm run build` 均通过。
- 文档核验：Task 归档并更新索引后复跑 `npm run check:docs`，扫描 577 篇 Markdown、0 errors；最终 `git diff --check` 通过（仅有工作区现存换行格式提示，无空白差异错误）。

## 剩余工作

- 本 Task 范围内无剩余施工项。无独立玩家样本的 usability study 不属于本 Task 的交付阻塞；当前结论是内部首轮体验走查。
- 玩法 B 后续机制内容/最终目标阶段仍在 Draft 0207 与后续 Task 的范围内；本 Task 完成不代表整个玩法 B 目标完成。

## 相关路由

- [[draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance]]
- [[task-0205-gameplay-b-map-and-player-actions]]
- [[task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/frontend-design-project-overlay]]
- [[docs/docs-829/05-conventions/testing]]
