# Task 0298：Gameplay B 作用关系、Hover 与目标交互

状态：in progress — P0a 与单位版 P1—P4 已验收；首个卡牌效果已确定为减免 scost。同一角色卡牌之间只高亮、不画线；删除左右卡牌目标规则及狭小连线出入点设计，不再等待该裁定。P0b 未完成，P5 / P6 未开始。

历史交接：[[docs/plan-work/task-0298-units/handoff-0298-20261019]]（截至 U15）。负责人随后要求继续；当前已推进至 U21，卡牌 UI / scost 结算明细与正常入口闭环已完成，Flow 全范围、相对规则与 P5 / P6 仍未完成。当前事实见下方执行记录及各 Receipt。

## 目标

让玩家先看清谁正在发出作用（Source）、谁将承受作用（Recipient）、哪些对象可以改选（Candidate），再完成换牌、点击与拖拽修改目标，最后接入作用线。

覆盖 P0—P6 的完整方向。P0—P5 必须在没有任何 SVG 作用线、没有连接线路由系统时独立可用；P6 只增强已有关系的可视化。最终可完成“查看关系 → 换牌 → 重选目标 → 显式 Commit”的整轮操作。

需求来源：负责人于 2026-10-19 提供的 Roadmap、八项全局约束、五级 Hover 优先级及随后转交的 SolChat 修订。修订已明确换牌后旧目标作废、按新行为重新解析；以下区分已核实代码事实、已给定需求与尚需收敛的玩法细节，不将计划写成现行机制。

## 设计边界与依赖

- 工作对象是新版 Gameplay B MapRun 三栏 Workspace：左我方、中 Talklet Flow、右敌方。不是旧 Operation UI 的全面改造，也不进入独立 Datapack Editor 的 UI 重构。
- 衔接 [[docs/plan-work/task-0297-gameplay-b-unified-unit-cards]] 的共用 UnitFace、当前生效行为牌、右侧换牌浮层；0297 尚待浏览器验收，不能把“implemented”当成视觉验收通过。
- 衔接 [[docs/plan-work/task-0296-gameplay-b-shared-talklet-flow]] 的共享条目与滚动管线；普通 Chat / Story 不获得 MapRun 命令能力。
- 包含单位、双方附属玩法卡、流内当前玩法卡的身份与关系，以及公开敌方来源。历史回执、情报文本、地图胶囊和普通聊天气泡不会因为长得像卡片就成为可编辑领域目标。
- 领域规则、合法候选、权限、草稿版本与 Commit 验证归 MapRun；UI 只持有临时交互、可视实例映射及事件分发。
- 不改变每角色单项有效准备行为、Swap 免费、PlayerCommand 既有费用、唯一整轮 Commit 等基础合同；不新增多行动槽、敌方手牌系统或通用 Buff 系统。
- P0 分为现有单位关系基础与领域扩展两部分：先完成单位关系投影，使 P1 / P2 可用；真实卡牌目标与相对规则按依赖补齐，最迟在 P5 完整验收前完成，不能只给 DOM 加 ID 宣称支持。敌方先忠实表达当前可公开机制，不强求准备阶段具有确定目标。
- 继承现有主题、字体、Frame 和滚动 owner，按 `frontend-design` skill 与 [[docs/ai/frontend-design-project-overlay]] 施工。验收以桌面宽屏为准，本任务未要求移动端适配。
- 规划时工作树有 0297 / Flow 等未提交修改；本轮开工复核时这些前序已进入当前基线，仅本 Task / 索引仍有修改。保留已有工作，不回退或覆盖；事实依据日期为 2026-10-19。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| Map Action target 只有 `none / self / partyCharacter / enemy`；没有卡牌目标、上下单位或左右卡牌规则。HP 效果面向单位；资源 effect 的 recipient 也不能直接解释为卡牌。 | `src/data-services/contracts/gameplay-map.ts`：`GameplayMapActionTargetDef`、Action effect 类型；`src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`：`resolveGameplayBActionPreview` | 先复用单位规则推进基础高亮；卡牌目标部分另需真实领域契约与作者校验，不能由颜色或卡面文案推导。 |
| 显式 TargetSelection 按角色保存我方 / 敌方单位 ID；Ability / Item 有独立 actorless 草稿与单位目标。Enemy ID 仅在 Encounter 内有效，Action ID 仅在 Map 内有效。 | `src/arona-clicker/contracts/map-run.ts`：`MapRunEncounterTargetSelection`、`MapRunEncounterSourceTarget`、draft token；`src/data-services/contracts/gameplay-map.ts` | 统一引用必须携带上下文，不能仅使用 actionId / enemyId；actorless 来源不能伪造执行角色。 |
| 只读 preview 提供生效行为、当前目标、合法候选与待选标记；self 自动定位自身，唯一合法单位目标自动解析，多候选无显式选择时待选；Wait 没有虚构 Action。 | `gameplay-b-action-preview-resolver.ts`；`tests/engine/gameplay-b-map-run.test.ts` 的 no-target / self / unique target / repeated previews 用例 | 关系投影要区分无目标、待选和无行动，沿用确定性解析，Hover 不写草稿或推进 RNG。 |
| Swap / PlayerCommand 更新和清除 Override 都会删除该角色的显式 target selection。 | `src/arona-clicker/services/map-run-service.ts`：`setActionOverride`、`clearActionOverrideForSlot` | 保留这一已有方向并核验 F4：旧目标作废，按新行为和实际规则重新解析；不再新增合法目标继承机制，也不能在 UI 发第二条命令补回旧目标。 |
| Runtime 持有私有 MapRun Owner，Workspace 读取 detached View；Controller 用 `GameCommands` 转发带草稿 token 的 Swap、PlayerCommand、单位 Target、Ability / Item 命令。 | `src/arona-clicker/runtime-game-instance.ts`：`#mapRunOwner`、Workspace 投影与命令；`contracts/runtime.ts`；`src/ui/controller-actions-operation.ts`：`readMapDraftToken`、`handleMapClick` | 新卡牌目标也必须穿过完整命令链。`TargetSelection` 在本 Task 是草稿意图总称，不是假定已经存在的通用命令 API。 |
| 当前角色行为牌点击用于展开 / 收起手动 Popover；候选点击才执行换牌。目标仍主要通过角色下方按钮选择，没有 Map 共用的关系 Hover / 拖拽状态机。 | `src/ui/components/map-workspace.ts`：`renderActivePartyMember`；`controller-actions-operation.ts`：`closeMapHandPicker`、`handleMapClick` | 不让同一点击同时换牌、固定选中与确认目标；先明确交互入口，再复用现有委托与浮层生命周期。 |
| 敌方当前公开查询提供 roster、HP、damage；攻击按结算中变化后的存活状态与最低 HP 决定受用单位，再写入回执，并非已有固定准备目标。 | `map-run-service.ts` 的敌方结算段；`contracts/runtime.ts`：Encounter 与 recentCommit View | 不把上一轮回执当本轮意图；公开预测须由领域产生并注明随草稿变化，UI 不自行预测，更不能因共享组件而开放敌方控制。 |
| Flow 已有 `streamKey / instanceKey / contentId`、current / observed 生命周期和受控 actions，但没有通用的当前玩法卡领域目标 DTO。 | `src/ui/flow/flow-entry.ts`、`map-flow-model.ts`；`tests/ui/map-flow-adapter.test.ts` | 流条目实例键不是领域卡实例 ID；P0 / P1 增加受控玩法卡投影时保留共享管线和历史只读边界。 |
| Map DOM 按 flow / focus / region 等 key 协调；现有滚动和范围内浮层清理可以复用。旧 Operation Hover overlay 有顶层副本但绑定旧结构。 | `src/ui/workspace/map-dom-updates.ts`：`patchMapDOM`；`src/ui/operation-card-hover-overlay.ts`；`tests/ui/map-dom-updates.test.ts` | 扩展共用视觉角色，不能直接照搬旧 Operation 规则；Hover 副本应是同一对象的另一个视觉实例，不拥有新目标。 |

## 拟采用的共享合同

### 领域身份与关系

- 分开三类身份：领域对象引用、一次行为的关系引用、一个对象的视觉实例引用。卡牌定义 actionId 不能单独区分不同角色或轮次中的独立玩法卡；一个领域对象可有多个视觉实例，但展示副本不因此获得独立结算身份。替换候选只引用现有合法行为选项，不要求为每个候选新建领域卡实例。
- 现有单位引用先携带足够的 run / node / activity / encounter 上下文；真正独立的玩法卡再按其领域生命周期扩展引用与版本校验。具体字段在 P0 相应部分冻结，不把纯展示容器身份强加给领域对象；不得使用 DOM 顺序、旋转角度、像素位置或展示名称作为逻辑身份。
- 关系投影分别表达 Source（行为卡或单位）、可选执行单位、selected target（目标规则当前选定的对象）、合法候选、选择模式、公开程度、可控制能力及版本依据；effect recipients 按各项效果描述实际作用对象，不能与 selected target 合并为一个字段。保留零个或多个效果受用对象的表达空间，不顺带把现有单目标行动改成多目标选择。
- 选择模式至少区分无目标、自身、玩家可选、规则确定、待选择；“目标未知 / 未公开”不等于“无目标”。规则确定的相对目标不默认允许拖拽绕过规则。
- 当前基础交互主要高亮 Source 与 selected target，不要求立即展示全部附带效果。例：射击选择机器人 A 并对其造成伤害，同时给白子恢复资源；机器人不是整张卡全部效果的唯一受用方，Team 也不能伪装成任意队员。
- 提交前的关系是确定目标、条件预测或暂未确定；提交后实际 effect recipients 与作用量来自结算回执。两者分开标记和存放，不能把预测称为已发生的效果。
- UI 高亮消费 Owner 投影；换牌候选的临时 preview 也走无写入的领域查询。不可通过临时执行 Swap 再撤销取得预览。

### 视觉角色

| 状态 | 渲染合同 |
| --- | --- |
| Source | 作用卡上浮、层级提高、外缘强调、发起标识；单位来源在其身份面给出对应发起标记，不任意移动整列。 |
| 当前目标的 Recipient 提示 | 基础交互标示 selected target：环绕轮廓或四角括号、独立受用标识、轻微响应；不暗示这是所有附带效果的唯一受用对象，不沿用 Source 的主动抬升。 |
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

## P0 分段合同门槛

P0a 先统一当前已有的单位关系，作为 P1 / P2 基础准入；P0b 独立补足卡牌目标与相对规则，只有依赖这些新能力的切片等待其合同。各部分仍先确定领域关系再接相应表现，不颠倒 P0—P6 的责任顺序。若选择会改变玩法含义，先交负责人裁定；不以整仓审计替代，也不让 P0b 阻塞现有单位目标高亮。

| 门槛 | 必须明确的内容 | 退出证据 |
| --- | --- | --- |
| F1 卡牌实例与实际效果（P0b） | 首个实际效果已由负责人确定为减免 scost（界面当前标作 sCost），不实施 HP 效果增强。仍需冻结真实卡牌身份、减免量、本轮生效 / 消耗 / 失效、费用校验与结算顺序；不把其他资源费用或 PlayerCommand 固定费用当作 scost。换下卡是否失效由领域定义，Flow 回收 DOM 本身不销毁卡。 | 类型草案、Owner 入口、正常与失效案例及真实领域样例；卡牌目标完整经过查询、校验、草稿与 Commit，最迟 P5 验收前完成。 |
| F2 对象归属与相对顺序（P0b） | 覆盖自身、来源阵营中上下单位及其关联卡、流内玩法卡、对方单位 / 卡与无目标。友方相对来源阵营解释，适用于我方、敌方与可发出作用的流内牌。相对单位顺序与归属来自领域定义，不能从 DOM 推断。负责人澄清“左右一张”原意为连线出入点，并非新增玩法目标选择；该狭小连线设计已放弃，不新增紧邻 / 最近合法 / 左右一侧全体等卡牌目标语法或解析规则。 | 不受 DOM 重排、旋转、叠放与 Hover 抬升影响的解析测试；完整覆盖保留的单位顺序与卡牌归属范围，最迟 P5 验收前完成；不存在等待左右卡牌选择的门槛。 |
| F3 敌方公开意图（P0a 基础，按需扩展） | 已确定且公开显示正常目标；条件预测标为预计；尚未决定显示未知且不虚构受用方；已结算从回执显示实际对象。预测仅由领域给出，注明条件 / 草稿依据，不改变既有结算顺序，不沿用上一轮目标，也不开放敌方操作权限。 | P0a 可用现有公开来源与未知状态进入 P1 / P2；有预测时补领域投影及条件测试，不要求为 Hover 新建 AI 或强行预测。 |
| F4 换牌后重新解析（负责人修订要求） | 准备行为实际更换时旧目标作废，即使新卡也允许原对象也不继承；由当前准备卡 + 对应实际行动 / 目标规则 + 当前遭遇状态重新解析。取消 Override / 恢复自然行为也同样重算，不恢复之前保存的旧目标。能够确定则显示新目标，否则按实际选择规则显示待定 / 待选；无目标不伪造对象。 | Owner 回归覆盖新旧卡都允许 A 也不继承、恢复自然行为重算、自身 / 唯一目标、待选 / 无目标、费用不足和 stale 零写入；重复读 View 不改变解析结果或随机状态。 |

F4 已由本轮负责人修订明确，删除旧版的合法目标继承方案。这里的“策略”仅指 Gameplay B 当前实际用于决定行为和目标的规则，不重新引入旧 StrategyProfile，也不新建通用 AI 系统。重新解析可能合法地再次得到 A，但必须来自新规则的结果，而非继承旧选择。Hover、刷新 View、重新打开浮层不重新抽牌，也不无依据地改变已确定准备目标；同一行为的幂等重复命令不伪装成一次新换牌。

P0a 核对现有单位规则、三类关系语义、F3 基础状态及 F4 解析入口后即可进入单位版 P1 / P2。F1 / F2 的具体作者语法和新增卡牌效果仍需在 P0b 收敛，缺少裁定只阻塞依赖部分；不得从 P5 总验收中静默删去真实卡牌目标。

## 施工切片与独立验收

顺序为 P0 → P1 → P2 → P3 → P4 → P5 → P6。P0a 通过后先完成现有单位版 P1 / P2 / P3 / P4；P0b 按独立领域切片补足后，接入相应卡牌表现与操作，全部在 P5 汇合验收。阶段记录区分“单位基础已验收”与“全范围已验收”，不能把部分完成写成整个阶段完成。不得以“等作用线完成”解释前序不能使用。

### P0：统一作用对象与目标身份

- **P0a：现有单位关系基础。** 复用现有 MapRun 行为、单位目标、合法候选和命令入口，投影 Source、selected target、权限、版本与确定 / 预计 / 未知状态；区分 effect recipients 与结算回执，核对 F3 / F4，不以新卡牌效果为准入条件。
- P0a 独立验收：不加载 DOM 也能表示现有我方 / 敌方来源、单位目标、自身 / 无目标、待选与未知；重复查询不改版本、费用、HP、Hand 或 RNG；非法 / 过期操作零写入。完成后可进入 P1 / P2 单位基础施工。
- **P0b：真实卡牌目标与相对规则。** 收敛 F1 / F2，为实际独立玩法卡接通领域引用、效果、候选、权限与失效判断；解析相对顺序，不从视觉布局取规则。此部分独立施工，必须先于对应卡牌操作接入且最迟在 P5 完整验收前完成。
- P0b 独立验收：真实卡牌效果可经查询、草稿、合法性校验与 Commit 生效；保留的单位上下顺序、卡牌归属及双方阵营 / 流内来源按合同解析，不要求左右卡牌规则；视觉实例移除不销毁仍有效卡，领域失效引用被拒绝。
- 各部分按实际影响接通契约、Registry / Resolver、命令、存档验证链；新增作者字段遵守 Schema 同步，生成物仅经生成器更新；变化影响活动 Run 时处理 `resumeVersion`，不写旧存档迁移层。

### P1：统一作用方与受用方渲染

- UI 开工前核对 0296 共享 Flow 与 0297 UnitCard 的 DOM identity、卡牌悬浮、Popover 与局部刷新是否稳定可用；记录实际证据与必要前序修复，不能只引用文档状态。
- 先在现有 UnitFace、悬挂 / 浮动行为 Card 上验证 Source 与 selected target 的角色适配，支持双角色、无目标、待选及当前实际公开的敌方信息；不建立通用领域规则组件，不要求立即画出附带效果。
- P0b 相应合同完成后再接入真实卡牌目标与 Flow 当前玩法卡，继续走共享条目渲染与转义，不接受任意 HTML。
- 独立验收：单位基础先证明关闭连接线也能识别 Source / Recipient 提示 / Candidate，友方治疗与攻击都用中性标记；卡牌补充验收在 P0b 后完成，不能用历史文本替代当前卡牌或宣称视觉即完整领域支持。

### P2：Hover、Focus 与固定状态联动

- Hover / Focus 行为牌先检查现有单位关系，必要时弱示合法候选；反向检查选中单位时展示已公开关联来源，P0b 后扩展到真实卡牌目标。
- 敌方正常目标、预计目标、未知与已结算结果按 F3 区分；目标未知时只展示可公开来源和未知说明，不强行高亮一个单位。反向查询不能把未知 / 上轮结果变成本轮确定关系。
- 多个公开来源可列出或同时标记，但不能覆盖锁定编辑来源；不公开来源不进入反向提示。
- 实施共享优先级、输入切换、退出恢复与生命周期清理。
- 独立验收：鼠标跨单位、悬挂卡、浮层、Flow 移动不清除高优先级状态；键盘可以检查与固定；查询不发送领域命令、不改变领域快照；局部更新后状态仍指向有效对象。

### P3：Override 与右侧换牌浮层

- 复用 0297 展开 / 收起和候选委托，候选从领域查询取得；右侧优先、越界时保持可访问，保留费用不足的禁用理由。
- 操作为“点击当前准备牌 → 右侧浮出可替换候选 → 点击候选 → 更新准备行为 → 收起浮层”。浮层只是现有候选的选择界面，不是第二套 Hand，不为展示重新抽牌或创建可独立结算的候选卡实例。
- Hand 内候选使用 Swap；合法但未抽入 Hand 的行为使用 PlayerCommand，保留其额外 PlayerCost 与可支付校验；展示位置不改变命令类别。
- 预览候选不写入；确认才发送 Swap / PlayerCommand，Owner 按 F4 清除旧目标并根据新卡牌、实际策略与当前遭遇重新解析。同步刷新 View、Hover、高亮、候选预览与 Commit readiness，不继续显示旧行为关系。
- 取消 Override / 恢复自然准备行为同样重算，不恢复历史目标；仅关闭候选浮层未改变准备行为，因此保持当前草稿。
- 独立验收：换牌后原目标作废，新目标按新卡牌与实际规则重新产生，能够确定则显示，不能确定则按规则待定 / 待选；两卡都允许 A 也不得继承。恢复自然行为重新解析；失败命令保留旧草稿；预览、收起、刷新和重开不抽牌、不扣费用、不推进轮次、不 Commit，也不无依据反复改变准备目标。

### P4：点击与拖拽修改目标

- 从单位附属行为或 Flow 当前玩法卡的独立入口进入编辑；作用来源以领域关系为准，不能把 Card 所在列当成执行方。
- 点击合法对象确认；行为卡或目标手柄可拖拽，使用拖拽副本、候选高亮和吸附响应。没有 SVG 线也必须完整工作。
- P4 建立最小元素身份标记、Pointer 命中查询与合法性反馈：指针经过的可交互实例映射到领域对象，再与 Owner 候选核对；释放确定唯一目标。拖拽副本不遮挡命中，重叠对象有明确命中规则，遮挡 / 滚动对象可展开、滚动定位或通过候选入口选择。
- 该命中能力先服务单位目标；P0b 后复用到友方 / 敌方 / 流内真实卡牌。P4 不建立 SVG 线、连接线路由或临时连线系统；P6 再补几何锚点与作用线。
- 原对象可与受用对象相同；相对规则固定、无目标、无权限关系不开放非法改选。键盘提供进入、选择、确认与取消的等价路径。
- 成功确认发送一次带最新有效上下文的 TargetSelection 草稿命令；无效释放零命令；过期命令由 Owner 拒绝并提示重新检查。
- 独立验收：现有单位目标先完成无 SVG 的点击 / 拖拽闭环，P0b 后完成卡牌对应验收；两种输入得到同一草稿结果，命中 / 非法 / 遮挡 / 滚动可验证，命令前后版本可追踪；任何 Hover、释放、点击都不能进入 Commit。

### P5：跨三栏卡牌与交互稳定性

- 验证左我方 / 中 Flow / 右敌方、叠放与旋转、外伸 CardTray、浮层、滚动和遮挡。需要实际新增 CardTray 时先在对应 Unit 写明其节点与刷新职责。
- 多个视觉实例同步角色；隐藏 / 纯展示副本不重复获得交互或权限。遮挡对象可通过展开、键盘或语义候选入口选择；离屏目标仍保留领域选择，提供定位 / 展开入口，不自动强迫阅读滚动跳转。
- 分别核验领域玩法卡、单位右下视觉卡、替换浮层候选与 Flow 卡牌展示：可指向同一真实对象，也可能只是行为候选展示，均不因复制 DOM 增加结算对象。Flow 同 ID 回收只移除旧视觉实例，仍有效的领域卡可由新实例代表；领域卡何时失效仅由 MapRun 判断。
- Hover、拖拽、替换候选分别检查实例支持的操作与领域权限；纯展示卡不自动成为操作入口，候选不自动成为合法受用对象。
- 浮层拖拽期间保持来源与候选可访问，按交互状态协调关闭；滚动、来源移除、Flow 回收、读档、路由切换与终态完整清理监听和捕获。
- 独立验收：P0b、卡牌目标的真实结算 / 合法性与 P1—P4 对应补充验收全部完成；跨栏操作保留 Frame、滚动 owner、有效焦点与无关浮层，敌方来源只读，同名 / 同 actionId 不串目标。DOM 回收与领域失效分开验证；P0—P5 在作用线完全关闭时通过全流程验收。

### P6：最后接入作用线（纯表现层）

- 准入：P0—P5 均有验收证据，包括卡牌目标、公开敌方、跨栏和无 SVG 的实际操作；不得提前搭建完整连接线路由系统。
- 此时才建立统一 Visual Anchor Registry 与 Workspace Connector Overlay；Registry 管理领域对象到可见视觉实例的映射，不能成为对象或关系 Owner。
- 根据现有关系与同一交互状态绘制：方向、自身、同侧上下、跨栏、Flow、公开敌方；无目标不连。同一角色所属卡牌之间不画作用线，仅保留 Source / Recipient / Candidate 高亮；不再设计这些卡牌间的左右连线出入点，也不为此新增左右目标规则。该绘制过滤不删除仍然合法的领域作用关系。其余允许画线的关系，Hover 显示已选线，编辑显示预览，拖拽跟随指针并吸附领域已批准候选。
- 敌方预计关系沿用预计标识，不画成已确定关系；未知 / 未公开目标不连，历史结算关系只属于对应回执，不混入当前准备关系。
- 多实例择锚以当前交互实例和可见性为依据；离屏 / 缺失锚点省略线或明确边缘提示，不伪造另一目标。Overlay 不拦截卡牌命中、点击或键盘焦点。
- 独立验收：关闭 / 移除 SVG overlay 后 P0—P5 功能与正常提交全部保留；同一角色卡牌之间始终只有角色高亮、不画线，其他角色 / 跨栏关系不因此被一并屏蔽；滚动、展开、旋转后只更新几何，不重新计算合法性、不改草稿；不为线条新建目标选择状态。

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
- P4 的身份与命中查询只回答“指针指向哪个可交互对象、能否选择”；P6 才增加用于绘线的几何锚点。两者复用对象引用与交互状态，但无需在 P4 提前构造完整锚点注册或连接线路由。
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
- [ ] 换牌和恢复自然行为后旧目标均作废，按新准备卡、实际策略与当前遭遇重新解析；读取 / Hover / 重开浮层不抽牌或无依据改目标。目标点击与拖拽只改草稿，所有入口受权限与版本校验。
- [ ] Source、selected target、各项 effect recipients 与提交前预测 / 提交后回执分清；单目标选择不等于整张卡只有一个效果受用对象。
- [ ] 多实例、遮挡、Flow 滚动、浮层、路由 / 读档 / 终态不留下悬挂状态、重复命令或错目标。
- [ ] P0—P5 无 SVG 线也能查看、换牌、点选 / 拖拽并显式提交；P6 关闭后完全保持可玩。
- [ ] 每阶段有独立结果与实际验证记录；未完成项不借后续作用线施工掩盖。

## 执行组织

确认后采用正式 Patch Unit；每阶段可以拆多个 Unit，不把 P0 或 P5 一次塞进巨型补丁。通常每 Unit 3—5 文件、约 300—500 行净改动，包含 Goal、Read Set、Allowed Files、Non-goals、Completion Criteria、Stop Conditions 与 Receipt；超过三个 Unit 时再按项目规则拆同级目录，本轮不预建空 Unit。

最小 Read Set 按阶段选择：P0 / P3 读取上表契约、Owner、preview resolver、Runtime 直接调用与相关测试；P1 / P2 / P4 / P5 读取 Map renderer、controller 委托、Flow DTO / renderer、DOM patch、对应 CSS 与目标测试；P6 再读取锚点 / overlay 的实际消费者。沿用 [[docs/ai/context-packs/ui-presentation]]、[[docs/ai/context-packs/datapack-schema]] 及 [[docs/ai/task-read-set-routing]]，不顺序通读整个仓库。

尚未确定的玩法含义、预算超出或事实冲突须先收敛 Task / Unit，不能由表现组件临时补规则。每阶段结束独立核对代码与 Receipt；不把本轮规划核验当作未来实现通过。

## 当前核验（2026-10-19）

- [[docs/plan-work/task-0298-units/0298-U1-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U1]]：已完成。

- [[docs/plan-work/task-0298-units/0298-U2-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U2]]：已完成。

- [[docs/plan-work/task-0298-units/0298-U3-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U3]]：已完成。

- [[docs/plan-work/task-0298-units/0298-U4-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U4]]：共享视觉角色完成，U5 已补单位版浏览器验收。

- [[docs/plan-work/task-0298-units/0298-U5-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U5]]：单位 Hover / Focus、反向来源检查、固定与浮层优先级完成；U8 已补最高优先级的编辑 / 拖拽锁定。

- [[docs/plan-work/task-0298-units/0298-U6-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U6]]：Owner 无写入替换预览完成。
- [[docs/plan-work/task-0298-units/0298-U7-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U7]]：浮层候选预览、换牌后 / 恢复自然行为重新解析验收完成。
- [[docs/plan-work/task-0298-units/0298-U8-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U8]]：单位点击 / 键盘 / 拖拽目标编辑完成。
- [[docs/plan-work/task-0298-units/0298-U9-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U9]]：真实命令链跨栏回归与桌面独立 Commit 闭环完成。
- [[docs/plan-work/task-0298-units/0298-U10-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U10]]：补齐目标编辑期间换牌互斥，取消后恢复正常委托；8 个定向文件 99 项、类型与架构检查通过。新增两项回归先复现再修复，未扩大为 P5 卡牌验收。
- [[docs/plan-work/task-0298-units/0298-U11-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U11]]：MapRun 卡牌身份 / 有效期与公共查询完成；4 个定向文件 60 项通过，尚无卡牌效果 / 草稿结算或 Flow 独立玩法牌。
- [[docs/plan-work/task-0298-units/0298-U12-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U12]]：卡牌目标 / scostDiscount 作者合同、Registry 校验与生成协议完成，130 项数据 / 同步测试通过；运行解析与结算仍待后续片，不向正式样例提前启用。
- [[docs/plan-work/task-0298-units/0298-U13-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U13]]：卡牌候选与选择解析完成。
- [[docs/plan-work/task-0298-units/0298-U14-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U14]]：正式卡牌目标草稿命令、失效引用清理及存档校验完成。
- [[docs/plan-work/task-0298-units/0298-U15-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U15]]：scost 净费用 / 实扣 / 回执 / 保存重试完成；交接前最新 4 文件 61 项通过。尚未接卡牌 UI，也未启用正式新样例。

- [[docs/plan-work/task-0298-units/0298-U16-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U16]]：统一单位 / 卡牌关系引用与确认入口。
- [[docs/plan-work/task-0298-units/0298-U17-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U17]]：Owner 卡牌关系 / 效果预测与 Workspace 目录投影完成。
- [[docs/plan-work/task-0298-units/0298-U18-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U18]]：卡牌共享高亮、可访问选择代理、真实命中拖拽和实际 sCost 显示完成。
- [[docs/plan-work/task-0298-units/0298-U19-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U19]]：正常入口协同演练与 1440×900 浏览器闭环完成；提交前第 1 轮只更新草稿，显式提交进入第 2 轮，芹香 sCost 6→5、敌 HP 6→4。41 项定向测试通过，完整剩余范围未结项。

- [[docs/plan-work/task-0298-units/0298-U20-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U20]]：活动 / 持久回执显示实际 sCost 原费、减免和实扣，浏览器已验证。
- [[docs/plan-work/task-0298-units/0298-U21-unit]] · [[docs/plan-work/task-0298-units/receipts/receipt-0298-U21]]：旧布局 / 清除入口与随机依赖的正常入口测试已对齐当前交互，保留原双敌演练。

| 阶段 | 当前验收结果 | 尚缺范围 |
| --- | --- | --- |
| P0a | 已完成：单位关系、各效果受用方区分、敌方未知、权限 / 版本、F4 原规则回归 | 不宣称卡牌目标已实现 |
| P1 / P2 单位基础 | 已完成：差异高亮、双角色、Hover / Focus、反向检查、固定与优先级 | 真实卡牌已由 U16—U19 补验；Flow 对应实例尚待后续 |
| P3 单位基础 | 已完成：右侧既有候选、无写入预览、Swap / PlayerCommand、旧目标作废与恢复行为重算 | Flow 独立玩法牌与对应全范围回归 |
| P4 单位基础 | 已完成：点击 / Enter / 拖拽、合法命中、取消 / stale、唯一草稿确认与独立 Commit | 流内玩法卡操作 |
| P0b | 卡牌身份、目标查询 / 草稿 / Commit / Save / 作者校验、scost 本轮减免与卡牌 UI 闭环已完成；左右卡牌规则已删除 | Flow 独立玩法牌、其真实目标 / 来源、保留的单位顺序与相应全范围验收 |
| P5 / P6 | 未开始 | 卡牌与跨三栏完整验收后，才允许纯表现作用线 |

- 已读取用户完整需求、0297、相关工作流、UI / 架构 / 测试 / Schema 约定与样式入口；定向核实上表源码、测试入口及 Runtime / Owner 链路。
- 规划与修订阶段仅编写 Task / 索引；负责人确认后执行 U1—U15，实际源码、测试与样式 / 刷新文档变更见各 Receipt。U12 已改作者 Schema 并运行生成器；U13—U15 扩展目标 / 回执结构并同步恢复校验，无迁移层。
- U1—U10 收敛时 8 文件 99 项通过，并完成 1440×900 浏览器单位高亮、候选预览、换牌清除目标、点击 / 拖拽与独立 Commit 验收。U15 交接前最新 4 个领域文件 61 项通过；U12 数据 / Schema 130 项通过，类型 / 架构检查通过。以上为历史 U15 截止口径；U21 已补卡牌 / UI 合并回归与浏览器验收，仍未运行全仓测试，不合并历史数字冒充全量通过。
- 历史单位阶段文档检查扫描 905 篇、0 errors。U21 后合并定向回归：8 文件 116 项通过（MapRun 32、卡牌 17、关系 7、Workspace 21、正常入口 3、Flow 18、交互 14、呈现 4），类型 / 架构通过；本次数量不包含全仓测试。阶段末 `npm run check:docs` 扫描 930 篇、0 errors，`git diff --check` 通过。
- 负责人追加裁定（2026-10-19）：首个效果选择“减免 scost”；放弃同一角色卡牌之间的连接线，仅保留高亮。随后明确“左右一张”本意是连线出入点，不是领域目标规则；已撤回紧邻 / 最近合法的询问，删除该新增规则和连线细节，不再以 F2 左右选择阻塞施工。该澄清覆盖原 Task 对左右卡牌规则的扩大解释。
- U18—U19 已将实际 sCost 余额、卡牌目标与效果说明接入 UI，并通过正式 Map Entry 的卡牌协同演练验证；无资源数据的敌方仍显示 —。Flow 独立玩法牌尚未完成，不能称为全卡牌范围完成。
- scost 实施合同：复用 Actor 资源 `sCost` 的实际行动费用；减免只改变所指领域卡牌本轮实际执行时的该项费用，最低为零，不增加余额、不减 PlayerCommand 固定费用。样例先采用减免 1；多项减免累加后封顶至原费用；完整草稿先解析减免，再原子校验整轮净费用，成功 Commit 的回执区分原费用、减免和实扣；下一轮不继承。未执行的 Hand 牌不扣费，也不把未用减免转移给另一张牌。此为已选效果方向的具体实施收敛，不新增左右目标语法。

## GALHCG 影响闭环

- 已以工作目录调用 `graph_project`，确认 `project_id=acprogram` 与实际项目根一致。
- `MapRun` 图内查询、`UnitCard` 路径查询无命中；改用 `map-run` 路径查询定位 contracts / service / tests，回到当前文件核实，未据零命中判定无实现。定向 `graph_read` 复核敌方结算与 Flow DTO；部分新源码未入地图，未因此触发刷新。
- 本轮对本 Task 与 `docs/plan-work/00-index.md` 分别执行 `graph_health(check="changed")`：新 Task 返回 `unreferenced_path`，无直接 Evidence / maps_to，故没有地图依据可核验；索引返回 `content_changed`，1 / 1 路径、4 / 4 owner 完整，关联工作流与规划模块，3 条已有 Evidence 提示内容变化，无后续分页。该结果不代表图谱已同步，也不授权维护。
- 执行阶段对 16 个直接源码 / 测试 / 样式 / 刷新文档路径再次只读核验：Runtime contract 2 / 2、Runtime 实例分页 7 / 7、Controller 3 / 3、样式约定 3 / 3、刷新文档 2 / 2 owner 完整，均报告 `content_changed`，无剩余分页；其余路径无直接 Evidence / maps_to。结果是地图待更新线索，不代表地图已同步。
- 分拆的 9 份 Unit 与 9 份 Receipt 逐路径只读复核均为 `unreferenced_path`；活动索引 4 / 4 owner 完整。无隐含图维护或刷新。
- U16—U21 对直接新增 / 变更路径与 Unit / Receipt / 交接只读复核：新关系 / 卡牌 / Flow / renderer / 测试等无直接 Evidence / maps_to；Runtime contract 2 / 2、实例分页 7 / 7、Controller 3 / 3、索引 4 / 4、样式 3 / 3、刷新文档 2 / 2 owner 完整，均有 content_changed 提示，无剩余分页。未写图或 freshness。
- 地图只读，不编辑图、不刷新清单、不写 freshness；尚无地图维护授权。已实现单位阶段以源码与 Receipt 为证，其余设计仍是计划。

## 剩余工作

- 当前：负责人已在交接后要求继续，U16—U19 完成真实卡牌关系投影 / 高亮 / 点击拖拽、实际 sCost 显示与正式协同演练入口。实际费用明细亦已完成；后续补 Flow 玩法牌与保留的单位相对规则；P5 全范围与 P6 尚未完成。历史交接保留 U15 当时状态，以本节与后续 Receipt 为当前证据。
- Task 内：P0b 与卡牌版 P1—P4、P5 全部范围验收后，才能进入 P6；总验收清单仍按最终完整范围保留未完成状态，不把单位基础当作全任务完成。
- 相关前序：U3 已补现有来源区遗漏、更新旧布局测试并核实 UnitCard / Flow / Popover 基础；不扩大为对 0296 / 0297 全部历史工作的结项声明。
- Task 外：多行动槽、完整敌方 AI / 手牌、通用 Buff、完整历史回放与移动端适配不属于本轮；后续若需要另立范围。

## 相关路由

- [[docs/ai/goal-workflow]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/galhcg-project-map]]
- [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]] · [[docs/docs-829/05-conventions/schema-sync]]
- [[docs/docs-829/06-wiki/50-ui/read-model-context]] · [[docs/docs-829/06-wiki/50-ui/refresh-update]]
- [[docs/ai/frontend-design-project-overlay]] · [[ui-style/00-index]]
