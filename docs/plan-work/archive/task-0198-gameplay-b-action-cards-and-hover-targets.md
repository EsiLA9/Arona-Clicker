# Task：玩法 B 战斗行动卡与悬停目标关系

状态：done — Unit 0198-U1 完成（2026-10-03）

## 目标

在玩法 B 独立原型的战斗准备阶段，将双方已冻结的行动显示为 Chara 卡内的小卡片。悬停或键盘聚焦某张卡片时，抬高卡片层级，绘制曲线指向其作用对象并高亮目标。目标关系可以落在角色卡，也可以落在其他行动/技能卡。

## 设计边界

- 只读消费战斗 Runtime 已冻结的 `pendingRound`、`pendingSkills` 与 `pendingRecipePlan`；UI 不重选行动/目标、不重掷、不支付、不结算。
- 我方每名可行动角色显示普通行动小卡；实际触发的特殊技能按冻结顺序排在右侧。敌方每名行动者显示本轮意图卡。观察/待机也作为普通行动呈现。
- 小卡显示标题、非常简短的效果说明及费用。普通牌显示本次支付的 sCost；免费技能显示免费 / sCost 0；当前不使用 sCost 的敌方意图显示“—”。角色卡原有 sCost 继续表示当前资源余额。
- 仅展示实际触发的技能卡。只提供既有普通行动修正的技能（如校准镜）仍显示为独立技能卡并指向被修正的行动/对象，不伪造第二次攻击。
- 目标端点不限定为敌方角色卡：可指向敌我角色卡、普通行动卡或特殊技能卡；卡牌配方的关联行动也能以卡片作为关系端点。所有关系必须能从冻结准备数据中的 actor、action、skill 或 recipe 关联解析出来；不能因页面上存在某张卡就凭空创建目标关系。
- 卡片倾角轻微、接近正向并受限；视觉随机感由回合与卡片身份稳定地产生，不消耗游戏 RNG，也不因重绘跳角度。
- 行动卡按 `encounterId + round` 组成一次性批次：新一轮准备时进场一次；该轮 Click 结算后回收该批次；终局或离开战斗时清空所有批次。旧批次不能残留、重复显示或被新轮复用为有效卡片。
- 明确非目标：AC `src/ui/` 接入、任何战斗规则或牌组/技能内容调整、玩家选牌、目标选择菜单、实时或连点行为。

## 当前事实与代码落点

| 已核实事实 | 源码依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `BattleRuntimeView` 提供冻结的 `pendingRound`、`pendingSkills` 和 `pendingRecipePlan`；玩家行动带 `cardName`、`costPaid`、`targetIds`，敌方意图带 `intentName`、`targetIds` | `prototypes/gameplay-b/src/model.ts`：`PreparedPlayerAction`、`PreparedEnemyIntent`、`BattleRuntimeView`；`prototypes/gameplay-b/src/runtime.ts`：`GameplayBBattleRuntime.getView()` | 小卡与箭头从只读准备快照产生 |
| 触发技能既可能产生免费行动，也可能修正既有行动；技能修正含 `actionId`，自由行动带目标 ID | `prototypes/gameplay-b/src/battle/skills.ts`：`PreparedBattleSkills`、`PreparedBattleSkillModifier`；`prototypes/gameplay-b/src/model.ts`：`SupplementalFreeBattleAction` | 需要将技能卡解析到行动卡或目标角色卡，不能把纯修正误绘为第二次攻击 |
| 配方结果以行动 ID 配对，并保存在冻结的 `BattleRecipePlan` | `prototypes/gameplay-b/src/model.ts`：`BattleRecipeMatch`、`BattleRecipePlan` | 卡片间协同关系也使用行动卡 ID 作为端点 |
| Route UI 复用并更新角色卡节点，当前 `character-card` 没有准备卡堆叠或 Hover 箭头 | `prototypes/gameplay-b/src/view.ts`：`createCharacterCard`、`createBattleCharacterCard`、`mountGameplayBView`；`prototypes/gameplay-b/src/style.css`：`.character-card` | 在现有 Chara 卡内部增量加入卡片和唯一关系覆盖层，保留角色卡节点 |

## Patch Unit 0198-U1：冻结行动卡与 Hover 目标关系

### Goal

用冻结战斗快照渲染 Chara 小卡片，并以 Hover / 焦点关系视图显示卡片间与角色间的目标连接，不改变现有 Click 战斗语义。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规则 | `docs/plan-work/archive/task-0186-gameplay-b-prototype-rule-baseline.md`：R02 / R03 / R07 与 PreparedRound 字段契约 | 确认准备、冻结、Click 结算时序和不预报结果边界 |
| 前置 UI | `docs/plan-work/archive/task-0192-gameplay-b-three-column-ui-acceptance.md`：完成收据 | 保持已验收的三栏结构、Click 与日志行为 |
| 数据类型 | `prototypes/gameplay-b/src/model.ts`：`PreparedBattleRound`、`PreparedBattleSkills` 消费类型、`BattleRecipePlan` | 解析 actor/action/skill/recipe 标识与目标 |
| 技能准备 | `prototypes/gameplay-b/src/battle/skills.ts`：`PreparedBattleSkills` | 区分免费额外行动、行动修正和触发顺序 |
| UI | `prototypes/gameplay-b/src/view.ts`：`createCharacterCard`、`mountGameplayBView`、准备数据更新 | 复用稳定卡片并限定局部刷新范围 |
| 样式 | `prototypes/gameplay-b/src/style.css`：`.character-card`、side-panel、desk 布局 | 定义角度、堆叠、图层和覆盖层坐标空间 |
| 测试 | `prototypes/gameplay-b/tests/skills.test.ts` 与新增 `prototypes/gameplay-b/tests/battle-cards.test.ts` | 复用技能测试夹具并覆盖卡片投影 / 关系解析 |
| 项目 UI 约定 | `docs/ai/frontend-design-project-overlay.md` | 约束行为/区域刷新、稳定节点、Hover 与锚点生命周期 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens；仅限本 Unit 数据路径、已验收边界、DOM 生命周期及定向测试 |
| 文档 Read Set | 4 篇：本 Unit 列出的规则基线、0192 Task、项目 Overlay 与本 Task 入口 |
| 历史文档 | 1 篇冻结规则基线，仅为实现冻结时序 / 目标契约所需 |
| 超预算处理 | 若 UI 关系需修改 Runtime/模型或需要第二职责，停止并先修订 Task；不得扩张白名单 |

### Optional Read Set

- `prototypes/gameplay-b/src/battle/recipes.ts`：仅在 `BattleRecipeMatch` 的实际排序/配对含义无法由 `model.ts` 与 `skills.ts` 确认时读取。

### Do Not Read by Default

- AC 游戏 `src/ui/`、引擎、数据包与存档源码。
- 非战斗路线 UI、主题系统、多尺寸兼容矩阵或其他视觉重构。

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Click 前存在完整且只读的战斗准备快照；Click 后结算该快照，战斗存续时准备下一轮 | `prototypes/gameplay-b/src/runtime.ts`：`GameplayBBattleRuntime.getView()`、`click()`、`prepare()` | Hover 不得触发 Runtime 读取以外的状态写入或随机调用 |
| 角色卡有可复用的稳定节点；已准备行动和角色卡位于三栏独立原型 UI | `prototypes/gameplay-b/src/view.ts`：`createCharacterCard`、`mountGameplayBView` | 卡片集合更新应限制在各角色卡内部 |
| 普通卡目标使用 actor ID；技能可经 `actionId` 修正/引用普通行动；配方使用行动 ID 配对 | `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/battle/skills.ts` | 目标解析器需支持多种卡片 ID，不能把每个端点都强制解读成角色 |

### Constraints

- 只修改本 Task 的 Allowed Files；保持原型与 AC 隔离。
- 角色卡自身复用，不新增纯装饰外层 wrapper。
- 将新增显示节点和刷新等级控制在以下 DOM budget；Hover / focus 只能触发 behavior 更新；新一轮卡集合变化只允许替换卡片子节点 region；不得因 Hover / scroll 调用全量 `render()`。
- 所有箭头目标都从冻结数据映射；Hover 不重算战斗效果。
- 本 Task 不改变普通卡支付、技能、配方结果、目标选择、同 Click 净值结算或胜负判定。

### DOM Budget

- 新增 wrapper / 节点：不新增角色卡外层 wrapper；直接在现有 `.character-card` 内追加行动小卡。新增 1 个稳定 SVG 覆盖层；Hover 时每个实际关系目标最多 1 条 SVG path。
- 可复用稳定节点：我方/敌方 `.character-card`、现有 side panel、战斗 Root 与日志区域。
- Behavior patch：来源小卡最高层级、目标卡高亮、当前曲线路径和可访问焦点态；Hover / focus / scroll / resize 均为 behavior 级局部更新。
- Region patch：每个 `encounterId + round` 拥有唯一行动卡批次。新 `pendingRound` 到达时只协调各角色卡内的小卡 region；更新前关闭旧 Hover、清空旧路径并解除旧目标高亮。批次换代时从节点、注册表和关联索引一并注销旧卡，再挂载新批次；同一轮重复 `update` 不得重复进场或累加卡片。
- 进场 / 回收：新批次的卡片可使用短暂 CSS 进场表现。Click 结算旧轮后，该批次立即标记失效、从目标注册表与活跃卡片集合回收，再显示新轮。若加入回收过渡，过渡仅作表现；卡片清理必须同步完成或有确定的取消/超时兜底，不能只依赖 `animationend` / `transitionend` 才释放节点和引用。终局、战斗切换或无 `pendingRound` 时清空所有行动卡、SVG path、Hover 与目标高亮。
- Full render 条件：本 Task 不允许 Hover 或 Click 驱动 full render；只沿用既有路由 / 队伍结构变化的渲染入口。

### Interaction Preservation

- **Scroll：**左右队伍侧栏继续独立滚动；在活跃关系期间，以 scroll/resize 几何更新重算当前 SVG path，不重建侧栏或日志。
- **Focus：**小卡不是行动按钮；使用可聚焦语义节点及完整简短 `aria-label`，焦点进入与 Hover 展示同一关系，焦点离开清除。
- **Hover / popover：**用稳定父节点事件委托处理 pointer enter/leave；目标卡不消费指针事件；从来源卡离开时清理 Hover / 高亮 / path。
- **Round generation：**以 `encounterId + round` 标识当前卡片批次；update 同轮幂等。结算后旧批次所有卡片、`cardRef → element` 注册和 Hover/箭头引用失效；新一轮集合必须与新冻结快照一一对应，不多不少。终局或离开战斗后集合为空。
- **Click identity：**每个已存在角色卡与日志滚动容器保持节点 identity；每次 Click 后只刷新冻结行动卡子区域。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`（新增）
- `docs/plan-work/task-0198-gameplay-b-action-cards-and-hover-targets.md`
- `docs/plan-work/00-index.md`

### Explicit Non-goals

- 不修改 `runtime.ts`、`model.ts`、规则/技能/配方/敌人或任何数值。
- 不增加玩家选牌/选目标、攻击动画、实时循环或新的 Click 行为。
- 不把技能修正显示成额外攻击；不显示失败/未触发技能为已生成行动卡。
- 不调整 AC 游戏 UI 或构建/服务器配置；不做窄屏和多尺寸兼容矩阵。

### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件；特别是发现必须修改 Runtime/模型或目标关系无法由现有冻结数据表达时停止并上交，不在 UI 中猜测/补造语义。

### Completion Criteria

- [x] 战斗等待 Click 时，双方实际行动者的小卡片显示冻结行动标题、简短说明与对应费用；我方显示本次支付 sCost，免费技能标记免费，敌方不伪造 sCost。
- [x] 特殊技能小卡按冻结准备顺序追加在右侧；纯修正技能准确指向被修正行动/作用目标，不制造第二次攻击。
- [x] 受限倾角稳定于同一回合/卡片且不消耗游戏 RNG；默认卡片顺序与层级明确，Hover / focus 来源卡升至最高。
- [x] 关系端点支持角色卡、普通行动卡和特殊技能卡；可显示敌我目标、其他行动卡及准备数据中已存在的卡片协同关系。多目标逐一连线、高亮；无目标不画箭头。
- [x] Arrow 使用曲线路径，准确连到实际目标卡；scroll/resize 时锚点仍对齐，离开 Hover / focus 或轮次更新时路径和高亮被清理。
- [x] 每个 `encounterId + round` 恰有一个有效卡片批次；新轮卡片只进场一次。Click 结算旧轮后，其卡片、DOM / 注册表引用、目标高亮和 SVG path 被回收，下一轮集合与新快照精确对应。
- [x] 同一轮重复 `update` 不复制卡片；快速跨轮、终局及离开战斗均不会遗留旧卡或旧目标引用。回收不依赖动画结束事件，减少动画/系统降动效时仍能完整清理。
- [x] Hover/focus 不改 Runtime/RNG/Click 状态，不触发 full render；普通 Click 仍仅结算一轮，原有角色卡、事件日志与滚动行为保持连续。
- [x] 卡片投影、目标解析与技能/配方关联定向测试通过；原型 typecheck、完整测试、build 通过；1280×720 浏览器完成 Hover、focus、多种卡片端点、连续回合替换、终局/离场清理验收。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 在 `prototypes/gameplay-b/` 运行 `npm test -- tests/battle-cards.test.ts` | 普通行动、待机、敌方意图、技能修正、特殊技能、卡片端点和批次生命周期均符合冻结数据 |
| 类型检查 | 在原型目录运行 `npm run typecheck` | 通过 |
| 全量测试 / 构建 | 在原型目录运行 `npm test` 与 `npm run build` | 全部通过 |
| 调用链检查 | 根目录运行 `npm run ui:callgraph -- --hot` 并检查变更调用链 | 此工具仅扫描 AC `src/ui/`（113 个文件），不覆盖独立原型；另以事件处理代码检查与浏览器交互确认 Hover / scroll 只做局部表现更新 |
| 浏览器 | 1280×720 打开独立玩法 B，连续结算多轮，并检查行动卡进场/回收、卡片目标、曲线、高亮、终局/离场清理 | 每轮仅有一套新卡片；旧卡与引用回收完整；不丢滚动 / 焦点、不重复结算 |
| 文档 / 差异 | 根目录运行 `npm run check:docs` 与 `git diff --check` | 通过 |

## Execution Receipt 0198-U1（2026-10-03）

- **实现：**在 `prototypes/gameplay-b/src/view.ts` 消费冻结的行动、技能与配方快照，投影我敌双方行动卡、费用/效果摘要、技能修正与卡片关系；在 `prototypes/gameplay-b/src/style.css` 增加卡片堆叠、轻微稳定倾角、进场、Hover/focus 高亮与曲线样式；新增 `prototypes/gameplay-b/tests/battle-cards.test.ts` 覆盖投影、费用、技能触发、目标端点、配方关系、批次身份和待机行为。没有改 Runtime、规则或 AC 代码。
- **批次回收：**批次使用 `encounterId + round`；同轮 update 保持幂等。新轮替换时同步清理旧卡 DOM、注册与关系引用；无待定回合、终局、战斗切换时清除卡片、Hover、目标高亮与路径，不依赖动画回调。
- **浏览器验收：**1280×720 独立原型中检查了 Hover 与键盘 focus、角色和其他卡片目标、曲线和高亮、连续回合替换，以及 Node 5 胜利离场至 Node 6 营地时的清理。固定 seed 全路线以 26 次 Click 到达 Node 12 `complete`；终态没有残留行动卡、路径或目标高亮。
- **验证：**定向测试 5/5；原型全量测试 14 files / 116 tests；`npm run typecheck`、`npm run build` 通过。`npm run ui:callgraph -- --hot` 已运行，但扫描范围只包括 AC `src/ui/`，因此不能作为独立原型调用链证据；原型事件处理器静态检查及上述浏览器操作确认 Hover/focus 不调用 Runtime 或全量 render。文档检查与差异空白检查在归档后执行。
- **边界：**此交付只完成独立玩法 B 预研 UI，不表示接入 AC。

## 剩余工作

- 无（Task 0198-U1 已完成并归档）。
- 仅预研原型 UI 阶段；不代表玩法 B 已接入 AC。

## 相关路由

- [[draft-0181-click-turn-location-gameplay-b]]
- [[draft-0183-gameplay-b-ui]]
- [[draft-0184-gameplay-b-sample-engine]]
- [[task-0193-gameplay-b-calibration-and-standalone-delivery]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/frontend-design-project-overlay]]
