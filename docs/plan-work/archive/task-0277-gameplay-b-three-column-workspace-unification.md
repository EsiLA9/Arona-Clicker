# Task：玩法 B 三栏 Workspace 结构统一

状态：completed — 三栏结构、卡牌交互与响应式验收已完成（2026-10-09）。

## 目标

将玩法 B 的左、中、右三栏统一到可复用的 Workspace 列结构，使标题区、正文区与顶部装饰分割器拥有明确且一致的层级，为后续三栏统一视觉设计提供稳定 DOM/CSS 契约；修复行动牌重复点击与场景卡折叠交互问题；让被激活的玩家手牌以轻微放大和柔和光晕等样式区别于未激活牌；并清理旧的执行者触发标记。

## 设计边界

- 本 Task 包含：核对既有三栏工作区的标题区基准；统一玩法 B 三栏的 column/header/body 结构；明确顶部装饰分割器的定位与层叠归属；修复并回归已选中的当前行动牌重复点击后不收起替代行动牌的缺陷；为处于激活态的 PlayerCard 手牌提供轻微放大和柔和光晕，与未激活牌明确区分；移除执行者选择中 `data-operation-performer-open` 属性及对它的查询依赖；在同一场景含多个可选行动牌时优先全部展开并响应式铺排，取消依赖 `operation-scene-alternatives` 折叠其余牌；覆盖桌面与响应式下的结构和交互回归。
- 标题文案和控件仍由 Operation View / UI 现有只读数据与 Controller 行为提供；组件不新增状态写入或玩法规则。
- 装饰分割器属于布局表现层，应位于标题与正文内容之后，不遮挡文字、按钮、卡牌或拖放目标，也不建立无必要的交互层。
- 本 Task 不裁定最终颜色、材质、边框样式或装饰造型；不重做三栏宽度、卡牌/对手/背景内容；不改 Operation Runtime、状态或存档；不连带重构所有其他 Workspace。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `renderWorkspaceFrame` 为每栏生成共同的 `.workspace-column`、`.workspace-column__slot` 与 `.workspace-column__body`；传入 `header` 时，`.workspace-column__header` 位于该 body 的内容之前。 | `src/ui/components/workspace-frame.ts`：`renderWorkspaceColumn`、`renderWorkspaceFrame` | 先复用这套共享结构；若需要扩充装饰宿主，应由明确的布局职责驱动。 |
| Operation 已通过共享 frame 渲染三栏；左、右栏传入 `header`，中栏没有 `header`，其标题、地点/推进信息和“返回聊天流”按钮被嵌在正文 `.operation-chat-heading` 中。 | `src/ui/components/operation-workspace.ts`：`renderMain`、`renderOperationWorkspace` | 三栏顶部标题当前处于不同 DOM 层级；中栏标题须接入与左右栏一致的列标题结构，并避免保留重复标题宿主。 |
| Operation 样式单独定义 `.workspace-column__header` 的布局与底边，并另行定义 `.operation-chat-heading`；左右栏 body 还有独立 padding 规则，中栏 body 为零 padding。 | `src/ui/css/operation-workspace.css` | 施工应区分结构收敛与最终视觉定稿，保留各栏所需内容空间，同时去除造成层级分叉的重复标题样式。 |
| `operation-workspace-view.test.ts` 已验证三列角色、列数、浮层宿主及 Operation 标题/内容；尚未约束三列 header 的父子关系。 | `tests/ui/operation-workspace-view.test.ts` | 为统一层级增加针对 DOM 结构的定向断言，并继续覆盖已有标题与浮层行为。 |
| 行动替代卡通过当前选中牌的 `aria-expanded` 控制：当前牌点击处理器切换该状态，并同步显隐替代卡与替代面板；测试分别覆盖打开后再点关闭，以及选择替代行动。用户报告在选择替代行动、当前选中牌更新后，再点该牌时内部待替换卡仍显示；现有测试没有覆盖这两个步骤连续发生的路径。 | `src/ui/controller-actions-operation.ts`：`handleOperationClick` 中 `[data-operation-action][aria-pressed="true"]` 分支；`src/ui/components/operation-workspace.ts`：`renderAction`、`renderPreparedCardLayer`；`tests/ui/gameplay-b-operation-controller.test.ts` | 增加“先替换行动，再点新的当前选中牌收起”行为回归，确保替代牌与面板的可见状态同步关闭。 |
| 玩家手牌容器用 `.operation-player-card.is-selected` 表达已激活状态，牌面同步有 `aria-pressed="true"`；当前 CSS 只让该状态与 hover/focus 共用较高 `z-index`，没有专属放大或光晕区分。 | `src/ui/components/operation-workspace.ts`：`renderPlayerCard`、手牌渲染；`src/ui/css/operation-workspace.css`：`.operation-player-card.is-selected`；`tests/ui/gameplay-b-operation-controller.test.ts` | 激活视觉必须跟随真实选中态，不依赖 hover/focus；实现柔和放大与光晕，并保证牌扇布局不跳动。 |
| 执行者选择 `<summary>` 带有 `data-operation-performer-open`，`focusPerformerPicker` 通过该属性寻找要聚焦的节点；选择控件本身已由 `<details data-operation-performer-picker>` 提供语义宿主。 | `src/ui/components/operation-workspace.ts`：`renderPerformerPicker`；`src/ui/controller-actions-operation.ts`：`focusPerformerPicker` | 删除旧标记及查询依赖，以 picker 内的语义 `summary` 定位并保留选择执行者后的焦点行为。 |
| `renderSceneActionOption` 默认只显示选中项和首项，其余选项带 `hidden`；场景卡附加 `operation-scene-alternatives` disclosure 才显示其余牌，点击、选项切换及无执行者分支都维护这套折叠状态。 | `src/ui/components/operation-workspace.ts`：`renderSceneActionOption`、`renderSceneActionCard`；`src/ui/controller-actions-operation.ts`：场景选项处理；`src/ui/css/operation-workspace.css`：`.operation-scene-alternatives`；`tests/ui/gameplay-b-operation-controller.test.ts` | 多选项卡牌须在同一场景中默认可见，并按可用宽度自动换行/铺排；不要让玩家先展开 disclosure 才能发现可选行动。 |

## 施工切片

### P0：确认共同标题与装饰层级契约

- 选取现有外部三栏 Workspace 作为对照，核对三栏标题区的宿主、顺序、占位和滚动边界；以当前源码为准记录对齐点。
- 在浏览器中定位玩法 B 顶部装饰分割器的实际 DOM/CSS 所有者和 stacking context，明确它相对列壳、标题区、正文与交互浮层的层级；不根据类名或单条 `z-index` 推断实际绘制结果。
- 保持最终装饰造型与配色开放，只冻结可核验的结构和层叠责任。

### P1：归一三栏标题结构

- 让 Operation 三栏都经共享 Workspace column header 宿主输出标题区；中栏标题、地点/推进信息和返回按钮仍完整可用。
- 标题区在三列具有相同的 DOM 层级和稳定的布局边界；正文从同一层级之后开始。移除因此变得重复的中栏标题容器或样式。
- 保持左栏学生数、右栏标签页及地图按钮的归属和可操作性；保留各栏自身内容布局、滚动 owner 和主题宿主。

### P2：修正顶部装饰层叠

- 将顶部装饰分割器限定在清楚的列/Workspace 装饰层级，避免它覆盖标题、正文或可交互元素。
- 不改变操作卡牌、行动关联线、拖放目标、地图弹层和其他既有浮层的 stacking 行为；如共享 stacking context 产生冲突，按实际宿主边界修正。

### P3：修复当前行动牌重复点击收起

- 复现路径：打开一名学生的替代行动牌，选择一张可用替代牌；待选中行动更新后，再点击同一张当前选中牌。
- 第二次点击必须关闭该学生的替代行动面板和所有内部待替换卡，当前牌 `aria-expanded` 回到 `false`；再次点击可重新打开。
- 同时覆盖渲染为 `data-operation-action-current-toggle` 的自动计划牌，以及拥有 `data-operation-action[data-operation-action-current]` 的已选行动牌；按实际适用类型保留相应行为。

### P4：区分激活与未激活玩家手牌

- 玩家手牌处于真实激活态（`data-operation-player-card.is-selected` / 牌面 `aria-pressed="true"`）时，用轻微放大和柔和光晕等样式突出；未激活手牌保持基础牌面表现。
- 视觉状态由激活状态驱动，与 hover、focus-visible 分开；使用不触发行列重排的表现方式，并保持卡牌扇形重叠、拖放、目标预览和牌面可读性。
- 仅作用于玩家 PlayerCard，不把学生战斗行动牌、SceneAction 卡或其他选中控件一并放大。

### P5：移除旧执行者触发标记

- 从渲染输出和 Controller 查询中移除 `data-operation-performer-open`；改用 picker 下的语义 `<summary>` 维持键盘选择后聚焦。
- 删除依赖该属性的过时测试或查询；保留 `<details>` 原生展开、候选执行者选择、清除操作和焦点连续性。

### P6：让同场景多行动牌直接铺开

- 同一场景卡有多个可用 SceneAction 时，默认渲染全部选项；不再隐藏未选项，也不要求点击 `operation-scene-alternatives` 才能看见。
- 在 `operation-scene-actions` 内按可用宽度使用可换行的布局尽量铺开；窄视口可以在该区域滚动，但不能把行动牌折叠到二级 disclosure 中。
- 保留选中状态、目标/执行者选择、费用预览和拖放语义；移除失效的 disclosure 按钮、状态同步处理与测试断言。

### P7：回归结构与操作

- 更新 `operation-workspace-view.test.ts`，断言三栏标题位于共同 column header 宿主，标题之后才是该栏正文，且中栏没有重复标题。
- 在 `gameplay-b-operation-controller.test.ts` 增加连续流程回归：打开替代牌、选择替代行动、点击更新后的当前牌并检查所有替代牌与面板隐藏；再点一次确认可重开。
- 覆盖 `data-operation-performer-open` 已不再输出、执行者选择后焦点仍落在当前 picker 的语义 summary。
- 覆盖同场景两张以上 Action 的 DOM 初始均可见，无需 `operation-scene-alternatives`；浏览器验收常规与窄视口下的换行/滚动。
- 浏览器确认已激活与未激活玩家手牌的大小/光晕区别清楚，状态切换无布局跳动，牌面、目标、拖放与手牌滚动仍可用。
- 在浏览器核对三栏顶部对齐、装饰分割器前后层级及窄视口折行/堆叠；实际操作返回、右栏页签/地图、卡牌选择与拖放，确认没有遮挡或滚动回归。

## 测试与验收

- [x] Operation 三栏共享相同的列标题 DOM 层级；中栏标题/地点/推进信息/返回操作完整，无重复标题宿主。
- [x] 顶部装饰分割器由共享 header 的底边在正常流中绘制；三栏起始和横向边缘对齐，标题、正文与控制不被装饰层遮挡，无新增无职责 wrapper 或交互拦截层。
- [x] 替换行动后，重复点击更新后的当前选中行动牌会收起全部待替换卡和面板，`aria-expanded` 与显隐状态一致；再次点击可重开。
- [x] 激活的玩家 PlayerCard 有轻微放大和柔和光晕等明确状态样式；未激活牌不使用该样式，且视觉变化不引起牌扇重排、遮挡或交互回归。
- [x] 渲染内容与 Controller 不再依赖 `data-operation-performer-open`；执行者选择和焦点返回行为完整。
- [x] 同场景有多张可选行动牌时全部默认可见，并尽量在 `operation-scene-actions` 中铺开；没有依赖 `operation-scene-alternatives` 才能访问的隐藏选项。
- [x] 左栏学生数、右栏页签/地图、中栏返回、卡牌选择/拖放、滚动归属和响应式布局均保持可用。
- [x] Operation Workspace 定向 UI 测试通过；`npx tsc --noEmit` 通过；完成桌面/窄屏浏览器结构与卡牌交互验收，记录视口和结果。

## 施工前核验（2026-10-09）

- 已读取 UI Context Pack、Workspace 模块入口、UI Wiki 路由、文档维护规则及 Task 工作流模板，并核对 `workspace-frame.ts`、`operation-workspace.ts`、`operation-workspace.css`、`layout.css` 和 `operation-workspace-view.test.ts`。
- 已核对替代行动卡渲染、点击切换处理及 Controller 测试；现有用例分别覆盖开/关和替换行动，未覆盖替换完成后再次点击新当前牌的连续路径。
- 已核对 PlayerCard 的选中标记和样式；当前仅通过层级提升体现选中，尚无放大/光晕状态差异。
- 已核对 `data-operation-performer-open` 当前仅作为 picker summary 标记和焦点查询条件；已确认 `operation-scene-alternatives` 会收起同一 SceneCard 中未选的 Action。
- 本节记录施工前事实；实现与验收结果见下方“实施与验收”。

## 实施与验收（2026-10-09）

- 中栏标题、地点/推进信息和返回按钮已接入共享 `.workspace-column__header`；三个标题宿主现在都是各自 `.workspace-column__body` 的直接子项，中栏 `.operation-chat` 不再包含重复标题。左/右栏 body 顶部 padding 与 header 外边距已调齐三栏边界。无可读 Run 时中栏也提供共享 header，返回操作仍可用。
- 1440×900 浏览器实测确认三栏 header 从同一 Y 坐标起始，外边缘与列面板对齐；标题底边最大差约 1.7px。分割线由共享 header 的 `border-bottom` 在正常布局流中绘制；header 位于列的局部 stacking context 内，标题、按钮和正文没有被装饰层覆盖。
- 替代行动展开/关闭统一通过 Controller 同步 `aria-expanded`、所有替代牌和面板；若旧替代牌或面板仍可见而 ARIA 状态已落后，重复点击会按实际可见状态收起。浏览器实测选择 Brace 后，新当前牌可重新展开并再次收起；回归测试覆盖当前行动牌和自动计划牌路径。
- 公共手牌选中态已加入轻微放大与柔和光晕，并使用短时变换过渡。1440×900 浏览器实测激活牌有 `aria-pressed=true`、外层 `is-selected`，计算变换约为 1.045 倍并上移 5px；未激活牌没有该光晕。视觉变化未改变布局尺寸。
- `data-operation-performer-open` 已从渲染和 Controller 查询移除；执行者摘要改由对应 picker 内的语义 `<summary>` 定位，焦点连续性由真实 Controller 路径验证。
- 同场景 `SceneAction` 选项现在默认全部可见，并在 `.operation-scene-choice-list` 内按宽度换行；disclosure 按钮、隐藏状态同步和相关 CSS 已移除。1440×900 实测三张行动牌同排；390×844 实测两张同排、第三张换到下一行，页面宽度 375px、没有横向溢出。
- 窄屏实测三栏纵向排列，标题边界与各列面板对齐；多牌区域能换行并由既有页面滚动承载。
- 浏览器中还实际操作了返回聊天流、打开/关闭地图浮窗、切换右栏“背景 / 持有物”页签及玩家手牌选中；地图关闭后 `aria-expanded=false` 且 popup 隐藏，页签状态与右栏内容同步。场景牌拖放与目标拖放由现有 Controller UI 回归测试覆盖。
- 定向 UI 回归：`npx vitest run --silent tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-entry-registry.test.ts`，3 个文件、42 个测试全部通过。
- 类型检查：`npx tsc --noEmit` 通过。`npm run check:docs` 扫描 760 份 Markdown、0 错误，通过；`git diff --check` 无空白错误。

## GALHCG 影响闭环

- 发现路径：绑定 `project_id=acprogram`；`lookup("Workspace")` 命中 `UI Operation Workspace`、`UI Workspace Renderer` 与相关 UI Module；`lookup("Gameplay B")` 命中 Operation 内容概念但未定位到布局结构；随后以 source 搜索定位共享 header、中栏标题、替代行动、玩家手牌状态、执行者摘要和 SceneAction disclosure 的 renderer、Controller、CSS 与测试。
- 变更审查：对 Operation renderer、Controller、CSS、三份 UI 测试、计划索引和归档 Task 均执行了精确 `review_changes`。本 Task 的代码修改保留了既有 `UI Operation Workspace` / `Controller → Runtime commands` / `Operation Sample Content` owners；其余文件 owners 与证据一并保留并刷新。
- 地图迁移与维护：先用 `plan_path_migration` 检查 Task 从根目录移入 `archive/` 的直接关系和 Evidence；随后定向刷新新旧路径（归档路径发现 1 个文件，旧路径清单移除 1 项），`resolve_paths` 将新 Task 解析为 `file:06f967291f3759ba9d8cdd0293cdb489`。三条 Task documentation `maps_to`（`UI Operation Workspace`、`Goal 与 Task 工作流`、`UI Workspace Renderer`）均已指向新 File；Index 的 planning module、项目包含关系与 Goal Workflow 追溯均保留。
- 证据写入：`plan_map_updates` 共规划 22 条 Evidence 引用、结构完整；正式 `update_map(dry_run=true)` 返回 `valid=true`，随后同批正式写入成功，更新了 3 个既有 node owners 与 14 条 `maps_to` / `contains` 边。Task 文本定稿后重新预览并刷新其 3 条 documentation Evidence。对 8 个实现、测试、索引和归档 Task 路径的写后 `review_changes` 均为 `unchanged`，`stale_evidence_reference_count=0`；`search(mode="map")` 唯一命中归档 Task File `file:06f967291f3759ba9d8cdd0293cdb489`，从 `UI Operation Workspace` 到该 File 的有向 `maps_to` 遍历 `complete=true`。`npm run check:docs` 扫描 760 份 Markdown、0 错误，通过。

## 相关路由

- [[docs/ai/context-packs/ui-presentation]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/06-wiki/50-ui/00-index]]
- [[docs/docs-829/06-wiki/50-ui/refresh-update]]
- [[docs/docs-829/05-conventions/testing]]
- [[docs/ai/goal-workflow]]
