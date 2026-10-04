# Task：玩法 B 场所卡片与关系线布局

状态：done — Unit 0199-U1 完成（2026-10-03）

## 目标

在玩法 B 独立原型中扩展已有卡片表现：将非战斗场所里的角色探索行动/结果呈现在对应角色卡上；将全队场所效果放入当前为空的对方队伍区域，并连接到受影响角色。统一修正卡片关系线的层级与端点，让线从来源/目标边界上朝向对端中心自然进出。

本 Task 是首批非战斗卡片表达，不声称已将所有角色相关信息卡片化；不接入 AC。

## 设计边界

- 只读消费现有场所定义和路线 Runtime 快照；活动前展示已定义的探索/固定效果意图，Click 后显示对应 Runtime 事件记录的个人结果与已发生效果。
- 每名角色的个人探索卡挂在其现有角色卡内；场所固定效果卡使用敌方队伍空置区域，并可指向每名实际受影响的队员。
- 卡片只表现数据已声明的活动与效果；不预测随机结果、不额外生成数值、不改变 Click 次数、检定、HP 或路径规则。
- 关系线复用现有 SVG 与 Hover/focus 生命周期；提高线条在常规内容之上的层级，活动角色卡与目标卡仍可清楚盖在线条上。
- 明确非目标：AC `src/ui/` 接入、Runtime/Model/活动内容或测试夹具规则变更、扩展新的活动机制、窄屏兼容矩阵、重做三栏布局。

## 当前事实与代码落点

| 已核实事实 | 源码依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 路线 UI 可读取 `events`、`clickCount`、当前节点及队伍；路线事件带 `click`、事件类型、可选 `actorId`、骰子与结果文本 | `prototypes/gameplay-b/src/model.ts`：`RouteEventRecord`、`GameplayBRouteView`；`prototypes/gameplay-b/src/runtime.ts`：`GameplayBRouteRuntime.getView()`、`appendEvent()` | 用当前 Click 的冻结事件制作已发生结果卡，不需 Runtime 改字段 |
| 非战斗个人检定逐角色写入 `activity-result`；固定效果写入一条 `activity-fixed-effect` 汇总事件 | `prototypes/gameplay-b/src/runtime.ts`：`resolveActivityClick()` | 个人结果卡绑定 `actorId`；固定效果卡可消费汇总文本 |
| `heal-party` 固定效果为每名队员分别计算 HP 变化；个人检定只对满足条件的队员执行 | `prototypes/gameplay-b/src/locations/activity.ts`：`resolveActivity()`；`prototypes/gameplay-b/src/runtime.ts`：`resolveActivityClick()` | 场所固定效果卡指向全队角色卡；个人结果只指向实际有结果事件的角色 |
| 路线 UI 已稳定复用 `.character-card`，敌方空态与战斗卡使用现有敌方侧栏；关系 overlay 为一个绝对定位 SVG | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`showPreparedBatch()`、`resolveCardElement()`；`prototypes/gameplay-b/src/style.css` | 不新增 overlay；角色探索卡挂现有节点，场所效果卡复用敌方侧栏空区 |
| 当前关系线总从矩形固定左右边中点出入，overlay z-index 25，角色 owner/target 分别为 30/20 | `prototypes/gameplay-b/src/view.ts`：`drawRelations()`；`prototypes/gameplay-b/src/style.css`：`.battle-relation-layer`、`.character-card.is-hover-owner`、`.character-card.is-link-target` | 改成中心方向与矩形交边求端点，重新整理线/来源/目标悬层顺序 |

## DOM Budget 与交互连续性

- 不新增角色卡外层 wrapper；个人探索卡与既有行动卡共用角色卡内区域。
- 复用唯一 SVG、稳定角色卡、敌方空态区域与已有卡片注册表；活动卡属于单个 `nodeId + click` 批次，重复 update 不重复挂载，下一 Click 或进入战斗后回收旧批次。
- Hover/focus 只更新当前卡、目标 class 与 SVG path；滚动/resize 只更新路径几何。节点集合变化只更新卡片子区域；不因 hover、scroll 或普通 Click 调用全量 render。
- 活动卡切换时先清理受影响的 Hover、目标高亮与路径；两侧独立滚动容器保持原有位置与身份。

## Patch Unit 0199-U1：场所探索卡与动态关系线

### Goal

让非战斗个人探索与全队场所效果拥有可悬停的卡片表达，并把关系线端点与悬层修正到能清楚覆盖三栏内容的表现。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| UI 协议 | `docs/ai/frontend-design-project-overlay.md` | 核对 DOM budget、局部刷新与 scroll/focus/hover 连续性 |
| 前置 Task | `docs/plan-work/archive/task-0198-gameplay-b-action-cards-and-hover-targets.md`：U1 Receipt、卡片注册与关系生命周期 | 保留战斗卡片既有行为并扩展同一关系层 |
| 路线数据 | `prototypes/gameplay-b/src/model.ts`：`RouteEventRecord`、`GameplayBRouteView`、`GameplayBRouteNode` | 消费现有活动结果与当前 Click 身份 |
| 路线事件 | `prototypes/gameplay-b/src/runtime.ts`：`resolveActivityClick()`、`appendEvent()`、`GameplayBRouteRuntime.getView()` | 确认各结果卡出现/替换时点与既有目标语义 |
| 场所内容 | `prototypes/gameplay-b/src/content/park-route.ts`：`parkRouteNodes` | 读取当前节点的个人检定与全队固定效果预告 |
| 活动规则 | `prototypes/gameplay-b/src/locations/activity.ts`：`ActivityFixedEffect`、`resolveActivity()` | 确认全队效果与个人结果的真实作用对象 |
| UI | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`drawRelations()`、批次更新及卡片映射 | 复用节点并实现卡片/曲线关系 |
| 样式 | `prototypes/gameplay-b/src/style.css`：`.character-card`、`.battle-relation-layer`、`.prepared-action-card`、敌方空态 | 维护三栏线条层级与卡片区域布局 |
| 测试 | `prototypes/gameplay-b/tests/route-runtime.test.ts`、`prototypes/gameplay-b/tests/battle-cards.test.ts` 与新增 `prototypes/gameplay-b/tests/route-cards.test.ts` | 对照真实事件字段并覆盖路线卡投影与几何锚点 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens；仅限路线活动快照、卡片关系层和对应验收 |
| 文档 Read Set | 2 篇：UI Overlay 与 0198 已完成收据 |
| 历史文档 | 1 篇 Task 收据，仅为复用既有卡片生命周期所需 |
| 超预算处理 | 若需 Runtime/Model/内容改动或超过 3–5 个文件 / 300–500 行净改动，停止并交回上游拆分 |

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前活动点击后 `event.click === view.clickCount`；活动行可在同一 Click 自动进入下一节点 | `prototypes/gameplay-b/src/runtime.ts`：`click()`、`appendEvent()`、`resolveActivityClick()`、`enterNode()` | 结果渲染按 Click 批次识别；节点切换时不把旧活动卡伪作新活动预告 |
| 全队固定效果逐个处理所有在队角色；个人活动事件明确含 `actorId` | `prototypes/gameplay-b/src/locations/activity.ts`：`resolveActivity()`；`prototypes/gameplay-b/src/runtime.ts`：活动事件投影 | 场所固定效果连向在队角色；角色结果卡只为实际事件创建 |
| 端点卡 rect 可从 `getBoundingClientRect()` 获得；现关系图使用两端中心的左右判断，但 Y 坐标固定取矩形中点 | `prototypes/gameplay-b/src/view.ts`：`drawRelations()` | 用中心到中心的向量求 source/target 矩形边界端点，曲线仅作轻弯 |

### Constraints

- 只改本 Unit `Allowed Files`；保持玩法 B 与 AC 隔离。
- 不修改 Runtime、Model、场所配置、战斗规则及内容文本；路线卡只读取既有活动定义与当前事件。
- 个人探索只在活动配置存在个人检定时展示；结果卡只展示当前 Click 实际写入的结果事件。
- 固定效果卡只来自已定义的全队固定效果或当前 Click 的对应事件，不能根据日志措辞推测额外目标或效果。
- 线的端点须落在 source/target 视觉边界朝向另一端的交点；目标角色/行动卡悬层高于线，线层整体高于一般三栏内容。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/route-cards.test.ts`（新增）
- `docs/plan-work/task-0199-gameplay-b-location-cards-and-line-anchors.md`
- `docs/plan-work/00-index.md`

### Explicit Non-goals

- 不动 `prototypes/gameplay-b/src/runtime.ts`、`model.ts`、`content/**` 或活动/战斗规则。
- 不改变事件日志、活动检定时机、HP/sCost 数值、路线/战斗 Click 次数。
- 不新增行动选择、场所事件分支、抽卡或目标选择交互。
- 不接入 AC `src/ui/`，不做全局视觉重构或多尺寸浏览器矩阵。

### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件；尤其是发现当前冻结事件不足以确定作用目标、必须扩大允许文件或事件卡需要推测规则时停止并上交。

### Completion Criteria

- [x] 活动准备期间，有个人检定的每名可行动角色显示“场地探索”卡；场所定义的全队固定效果在对方队伍空区显示效果卡，并连接到全队角色卡。
- [x] Click 后，具有 `activity-result` 的角色卡显示对应结果文本与骰点；个人 `effect` 结果也在对方空区显示单人效果卡，固定效果卡标明本 Click 已结算并连向当时在队者。若同一 Click 自动进入下一活动节点，旧结果明确标为“上一处”；不预测未发生结果或虚构目标。
- [x] 场所卡/结果卡按 `nodeId + click` 幂等更新；新 Click、离开活动或进入战斗时旧批次、Hover、路径、高亮与注册引用同步回收。
- [x] 关系线从来源与目标卡矩形沿两端中心方向的边界交点出入；线层高于常规面板内容，活动 owner / 目标卡可盖在线层之上。
- [x] Hover/focus 维持现有行为处理；两侧 scroll、window resize 与节点 ResizeObserver 仅调度路径几何重绘。离开来源或批次更新后不残留路径/高亮；战斗行动卡关系行为不回归。
- [x] 新增投影/端点测试与原型 typecheck、完整测试、build 通过；1280×720 浏览器检查个人探索结果、单人/全队场所效果、多目标跨栏连线、敌方行动卡悬层及连续 Click / 节点切换回收。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 原型目录运行 `npm test -- tests/route-cards.test.ts` | 预告/结果投影、目标绑定、当前 Click 生命周期与边界端点通过 |
| 类型/全量验证 | 原型目录运行 `npm run typecheck`、`npm test`、`npm run build` | 全部通过 |
| 调用边界 | 检查事件委托、scroll/resize 调度与批次更新；浏览器 Hover/Click | 不触发 Runtime 写入或全量 render，路径及 card cleanup 正确 |
| 浏览器 | 1280×720 独立玩法 B：Node 2 活动、Node 3 单人效果、Node 5 战斗、Node 6 营地 | 个人结果、单人/全队效果卡、多目标跨栏连线、敌方卡线层级与连续节点切换正确 |
| 文档/差异 | 根目录 `npm run check:docs`、`git diff --check` | 通过 |

## Execution Receipt 0199-U1（2026-10-03）

- **实现：**`view.ts` 新增路线活动卡投影：个人检定准备卡显示在实际可行动角色卡上；`activity-result` 结算文本/骰点回到对应角色卡；个人 `effect` 结果和固定全队效果以场所卡显示在对方空区，分别指向具体角色/当时在队的全体角色。跨入下一活动节点的结果标成“上一处”；直接进入战斗或出口则由新视图批次接管并清理旧活动卡。全队固定效果在同 Click 新加入的角色会从目标集合排除。
- **连线：**保留单个关系 SVG；端点改为沿来源/目标中心向量与各自矩形求交，曲线控制点依据两端向量轻微偏移。SVG 层升至 z-index 45，来源容器 60、目标容器 55；战斗目标卡保持在线上方。新增 location card 端点；修复空态标记在战斗中/场所卡出现时仍显示的问题。
- **浏览器：**1280×720 独立原型检查 Node 2 四名角色结果卡及到场所的线、Node 3 单人 HP 效果卡、Node 5 双方战斗行动线和 Node 6 加入千世后的全队补给预览。Node 6 的补给卡正确连接到当时五名队员；敌方空态图案在战斗或效果卡占位时隐藏。连续推进时旧卡/线被下一批次替换。
- **测试与构建：**`npm test -- tests/route-cards.test.ts` 6/6；`npm test -- tests/battle-cards.test.ts` 5/5；原型全量测试 15 files / 122 tests；`npm run typecheck` 和 `npm run build` 均通过。端点测试覆盖水平、垂直和斜向边界交点；路由测试覆盖待检定、个人效果、全队效果、倒地者资格、Click 过滤与同 Click 后加入角色的目标边界。
- **刷新边界：**本原型不在 AC `src/ui/`；scroll 捕获、window resize 与 ResizeObserver 只安排 SVG 几何重绘。Hover/focus 沿用行为补丁，事件卡不改 Runtime/RNG/Click 状态；未修改 Runtime、Model、规则、活动内容或 AC 代码。未执行 AC 的 `ui:callgraph`，它不覆盖此独立原型。
- **终检：**归档后 `npm run check:docs` 扫描 566 篇 Markdown、0 errors；`git diff --check` 退出码 0。Git 提示工作区其他既有文件有 CRLF→LF 提示，但没有 whitespace error。

## 剩余工作

- 无（Unit 0199-U1 完成并归档）；玩法 B 仍是独立预研原型。

## 相关路由

- [[draft-0181-click-turn-location-gameplay-b]]
- [[draft-0183-gameplay-b-ui]]
- [[task-0198-gameplay-b-action-cards-and-hover-targets]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/frontend-design-project-overlay]]
