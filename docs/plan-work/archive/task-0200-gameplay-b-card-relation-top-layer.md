# Task：玩法 B 卡片关系置顶层

状态：completed — 双侧卡片独立覆盖层与关系可视层已施工，并完成战斗/场所浏览器核验

## 目标

修正玩法 B 独立原型的卡片、关系线与作用目标层级：所有准备卡始终绘制在 Chara 卡内容之上；Hover/focus 时，来源卡、对应关系线和所有作用目标升至最高交互层。敌我两侧、前后排、场所卡及其他卡片目标均遵守同一可见层级，线段不得遮挡目标卡内容。

本 Task 只处理表现层级、节点归属与交互连续性，不改卡片语义或玩法规则，不接入 AC。

## 问题诊断（源码已核实）

- `mountRouteGameView()` 将 `.battle-relation-layer` 作为 `.desk-layout` 的直接子节点；样式给它 `z-index: 45`。
- Hover 来源 Chara 和作用目标 Chara 分别被设为 `z-index: 60` 与 `55`，因此都绘制在 `z-index: 45` 的 SVG 关系线上方，线在卡片边缘附近或角色表面上被遮住。
- `.prepared-action-card` 嵌在 `.character-card` 内。卡片自身 Hover 时 `z-index: 1000`，但所在角色卡建立的 stacking context 限制了子卡；子卡 z-index 不能越过兄弟 Chara 卡或其父层。
- 场所卡嵌在 `.field-effect-zone` 内；Hover 时该容器同样建立局部 `z-index: 60` 层。继续提高内部卡片的 z-index 不能解决跨容器次序。
- `.desk-layout` 使用 `isolation: isolate`，两侧 panel 独立滚动；任何置顶方案都必须同时处理根 stacking context、父层约束、滚动锚点与焦点连续性。

源码依据：`prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`refreshActiveRelation()`、`drawRelations()`、`showPreparedBatch()`、`showRouteActivityBatch()`；`prototypes/gameplay-b/src/style.css`：`.desk-layout`、`.battle-relation-layer`、`.character-card.is-hover-owner`、`.character-card.is-link-target`、`.prepared-action-card`、`.field-effect-zone.is-hover-owner`。

## 设计边界

- 所有现有准备卡（我方行动、敌方意图、免费/特殊技能、探索与场所效果卡）静止或悬停时都必须高于角色卡的主体内容；左右两侧和所有前后排一致。
- Hover/focus 某卡后，来源卡与其所有关联关系作为一个交互组抬高；关系线显示在无关角色卡和中间面板内容上方，关联目标也抬高并高亮。
- 路径在作用目标的视觉边界终止；目标的文字和卡面内容绘制在线条上方，不能被线贯穿遮挡。多个目标都必须保持可见并分别连接。
- 不能只继续增大嵌套子卡的 z-index；实现必须处理所属父级 stacking context。可调整根层分组或卡片渲染层，但需保留节点身份、Hover/focus 锚点与当前批次回收语义。
- 清除 Hover/focus、替换战斗轮次/路线活动批次或移除目标时，所有置顶状态与 SVG path 立即回收；不重掷、不触发 Runtime 写入或 full render。
- 明确非目标：战斗/活动卡片内容、目标规则、Runtime/Model、三栏布局重构、AC `src/ui/` 接入及多尺寸兼容矩阵。

## 当前事实与代码落点

| 已核实事实 | 源码依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 唯一 SVG 关系层直接挂在 `.desk-layout` 内，层级为 45 | `prototypes/gameplay-b/src/view.ts`：`relationSvg` 创建与 `shell.append()`；`prototypes/gameplay-b/src/style.css`：`.battle-relation-layer` | 线层与左右 panel 内容参与根隔离容器中的次序竞争 |
| 目标/来源角色父卡 Hover 时分别使用 z-index 55/60，来源卡节点嵌套在该父卡内 | `prototypes/gameplay-b/src/view.ts`：`refreshActiveRelation()`；`prototypes/gameplay-b/src/style.css`：`.character-card.is-link-target`、`.character-card.is-hover-owner` | child z-index 1000 无法跨出父卡 stacking context，且当前 SVG 低于父卡 |
| 场所卡和战斗卡共用 `preparedCardElements`、同一 Hover 委托和关系表；场所卡位于独立 field-effect-zone | `prototypes/gameplay-b/src/view.ts`：`preparedCardElements`、`showPreparedBatch()`、`showRouteActivityBatch()` | 修复必须同时覆盖两种卡片宿主，不能只修敌/我战斗卡 |
| 两侧 `.side-panel` 独立滚动；关系几何在 scroll、resize、ResizeObserver 时重绘 | `prototypes/gameplay-b/src/view.ts`：关系事件监听与 `geometryObserver`；`prototypes/gameplay-b/src/style.css`：`.side-panel` | 若提升卡片到共享层，锚点需持续贴合滚动后的源卡与目标 |

## Patch Unit 0200-U1：全局卡片与目标关系置顶

### Goal

解决嵌套卡片受父 stacking context 限制、关系 SVG 被 Chara 卡盖住的问题；保证来源卡、关联线和影响目标在跨栏交互中都能按预期置顶，且目标表面保持清楚。

### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| UI 协议 | `docs/ai/frontend-design-project-overlay.md` | 约束层级实现不得破坏 DOM budget、refresh level 与交互连续性 |
| 前置 Task | `docs/plan-work/archive/task-0198-gameplay-b-action-cards-and-hover-targets.md`：U1 Receipt | 保持战斗卡及既有关联端点行为 |
| 前置 Task | `docs/plan-work/archive/task-0199-gameplay-b-location-cards-and-line-anchors.md`：U1 Receipt | 保持场所卡、location endpoint 与动态端点行为 |
| UI | `prototypes/gameplay-b/src/view.ts`：`mountRouteGameView()`、`resolveCardElement()`、`refreshActiveRelation()`、`drawRelations()`、批次更新 | 评估可提升的稳定节点及节点 identity |
| 样式 | `prototypes/gameplay-b/src/style.css`：根布局、side panel、Chara 卡、准备卡与 SVG 层级 | 核实 stacking context、裁切和层级顺序 |
| 测试 | `prototypes/gameplay-b/tests/battle-cards.test.ts`、`prototypes/gameplay-b/tests/route-cards.test.ts` | 防止战斗/场所卡关联投影回归 |

### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens；限于 UI stacking context、卡片/关系生命周期与对应验证 |
| 文档 Read Set | 3 篇：项目 UI Overlay 与两个前置 Task 收据 |
| 历史文档 | 2 篇既有 Task 收据，解释要保留的卡片与关系边界 |
| 超预算处理 | 若需 Runtime/Model/内容变更、额外机制或超过 3–5 个文件 / 300–500 行，停止并交回上游拆分 |

### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 关系层 z45 低于 Hover owner z60 与 target z55 | `prototypes/gameplay-b/src/style.css`：对应选择器 | 直接构成当前遮挡次序 |
| 角色卡定位与 z-index 形成父堆叠上下文；准备卡为其后代 | `prototypes/gameplay-b/src/style.css`：`.character-card`、状态类、`.prepared-action-card`；`prototypes/gameplay-b/src/view.ts`：卡片 append 点 | 子卡 1000 不代表全局 1000 |
| 当前活动关系通过稳定父级事件委托并对卡片集合单批替换 | `prototypes/gameplay-b/src/view.ts`：pointer/focus handlers、`clearPreparedBatch()`、batch update | 新层级不得破坏 Hover/focus 和旧批次同步失效 |

### Constraints

- 保持玩法 B 原型与 AC 隔离；只消费现有卡片/关系投影。
- 保留唯一关系 SVG，除非施工中确认现 DOM 不能实现用户要求；增加 overlay 或卡片承载层必须满足真实的绘制层级职责，并记录 DOM budget。
- 任何卡片提升或重挂载都要保留其 `cardRef`、批次回收、键盘焦点与 pointer/focus 连续性；若无法保留则优先选用不搬动节点的方案。
- 影响对象可以是 Chara 卡、行动卡、特殊技能卡或当前 location card；多目标全部纳入置顶关系组。
- 目标卡面盖在线条端点上方，关联轮廓/强调仍清晰；线条不穿过目标文字内容。

### Allowed Files

- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`
- `prototypes/gameplay-b/tests/route-cards.test.ts`
- `docs/plan-work/task-0200-gameplay-b-card-relation-top-layer.md`
- `docs/plan-work/00-index.md`

### Explicit Non-goals

- 不修改 `runtime.ts`、`model.ts`、`content/**`、战斗/活动规则或数字。
- 不更改卡片内容、关系来源、目标解析或 Click 语义。
- 不重构 AC UI、主题系统、整体三栏布局或窄屏布局。

### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件；特别是新增顶层结构会破坏卡片焦点、滚动锚点、事件委托，或需扩大 Allowed Files 时停止并上交。

### Completion Criteria

- [x] 我方行动、敌方意图、技能、探索与场所卡由各自面板内的 portal layer 承载，绘制在 Chara 主体内容上方；保留卡片 DOM identity 与批次回收。
- [x] Hover/focus 时来源卡置顶；单一 SVG 关系层高于无关 Chara/中间内容，目标 Chara、场所卡与目标行动卡提升并高亮。
- [x] 常规关系按卡片中心向量落在对象边界；目标表面覆盖终点。两张同角色扇形行动卡重叠时，连线沿扇形外露边缘绕行，保持卡面文字可读。
- [x] 战斗、场所卡、location 与 Chara/行动卡目标使用统一解析与层级；1280×720 浏览器验证敌我行动、同角色免费修正、单目标场所效果和全队多目标效果。
- [x] 批次替换和离开 Hover/focus 会同步移除旧卡、目标高亮与 SVG path；scroll 捕获监听、窗口 resize 与 ResizeObserver 都触发锚点重算。浏览器 Demo 面板在 1280×720 下未出现需滚动的内容，因此滚动连续性以监听与重算实现核验。
- [x] 战斗与路线定向测试、原型全测、typecheck、build、文档检查通过；1280×720 核对战斗/场所遮挡、五目标连线、卡片回收。

### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | 原型目录运行 `npm test -- tests/battle-cards.test.ts` 与 `npm test -- tests/route-cards.test.ts` | 现有关联和端点语义不回归 |
| 类型/全量验证 | 原型目录运行 `npm run typecheck`、`npm test`、`npm run build` | 全部通过 |
| DOM/层级检查 | 检查 computed stacking context 与卡片注册节点；操作 Hover/focus、scroll/resize | 卡片/线/目标顺序稳定，节点引用与焦点连续 |
| 浏览器 | 1280×720 独立原型；战斗与场所效果卡、角色/卡牌多目标 | 线越过无关卡片并准确停在目标边缘；所有目标置顶可辨 |
| 文档/差异 | 根目录 `npm run check:docs`、`git diff --check` | 通过 |

## 最终收据（2026-10-03）

- 根因修复：左右 side panel 各加一个定位承载层，卡片从 Chara/field-effect-zone 的局部 stacking context 移出；滚动/resize 时按 owner 的新边界重新定位。图层顺序为 owner Chara `z75`、关系 SVG `z80`、target Chara `z85`、准备卡层 `z100`；来源卡 `z300`、目标行动卡 `z200`。
- 同角色扇形卡重叠时，新增纯几何 `overlappingFanCardCurve()`，连线经过卡组上方的空白区域，连接在源卡外露边和目标卡外露边，不穿过标题或描述。
- 浏览器 1280×720：Node 5 看见我方冲锋卡连至敌方 Chara，且目标 Chara 高亮；免费技能与校准镜卡可显示行动关系；Node 6 场所全队恢复卡同时连至五名 Chara。结算 Node 6 后旧全队效果卡被回收，下一场所卡批次正常显示。
- `npm test -- tests/battle-cards.test.ts`：5/5；`npm test -- tests/route-cards.test.ts`：7/7；原型完整测试：123/123；`npm run typecheck`、`npm run build` 通过。
- 根目录 `npm run check:docs`：567 篇 Markdown、0 errors；`git diff --check` 通过。
- 未修改 AC Runtime/规则/model，也未接入 `src/ui/`；玩法 B 继续独立预研。

## 相关路由

- [[draft-0183-gameplay-b-ui]]
- [[task-0198-gameplay-b-action-cards-and-hover-targets]]
- [[task-0199-gameplay-b-location-cards-and-line-anchors]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/ai/frontend-design-project-overlay]]
