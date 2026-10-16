# Task：超级图鉴阶段 B — 友好资料与共享工作区

状态：completed — 桌面图鉴工作区、详情回归、文档与1440×900交互验收于2026-10-15完成；窄屏验收按用户要求排除在本轮范围。

## 目标与依赖

把当前超级图鉴包装成容易查阅的内容工作区：用中文分类找到条目，阅读本体资料，查看“被哪些内容使用”，并能跨条目追踪和返回。保持完整定义可查，技术字段不占据主要阅读路径。

本 Task 交付共享框架的图鉴端，为未来编辑器迁入预留明确插槽；独立完成条件不要求编辑器已经迁入。

依赖 [[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]：阶段 A 的确定关系、技术候选、来源兜底与缓存合同验收后，才开始依赖这些合同的 B 功能施工。B 不自行重写关系扫描。

设计来源：[[docs/plan-work/draft-0282-super-codex-and-authoring-workspace]]。用户已批准A/B施工，延续冻结图鉴方向；C/D仍留后续。

## 冻结边界

- 主详情为“资料＋被引用”，完整向外引用、原始字段树和 JSON 位于按需打开的技术详情。
- 桌面三栏：分类／范围、搜索／条目、资料／引用。分类优先，包是筛选范围；默认全部当前生效内容，未知来源仍可见。
- 图鉴是当前加载内容的只读资料库，不是按拥有／解锁进度过滤的收集图鉴；不新增玩家状态读取或写入。
- 保留 body 工具宿主、现有入口及独立工具外观；延续浅色表面与图鉴强调色，去掉英文装饰标题，不随游戏场景主题换肤。
- 共用骨架须由图鉴实际使用，向未来编辑适配器提供导航、条目、详情、操作区插槽；不预建万能编辑器、不合并两套状态模型。
- 不实施阶段 C：四类表单迁入、按条目草稿暂存、保存／应用重构均留后续；现有编辑器入口与流程仍须正常工作。
- 不建设完整来源台账、覆盖历史、草稿引用索引或关系网络画布；不修改 Datapack Schema、Runtime 结算及玩家存档。

## 当前事实与代码落点

| 已核实事实 | 源码／测试依据 | 施工影响 |
| --- | --- | --- |
| 图鉴已有三个 Pane、窄屏选栏、搜索和详情注入 | `src/ui/runtime-editor/codex/model.ts / state.ts / view.ts` | 沿现有职责收敛，不另起独立应用 |
| 已有概览／关系／原始数据，Profile 与语义摘要可复用 | `src/ui/runtime-editor/codex-details/` | 资料按类型包装，完整字段有技术兜底 |
| 六张 Operation 表已进入通用浏览器，现有 Profile 台账未包含它们 | `profiles.ts`；当前 Registry 六类 getter；Draft 正式三包集核对 | 增补六类基础资料，不能只验证“渲染不抛错” |
| 工具由 `syncRuntimeEditorPanel` 挂载在 body；内容浏览器借用图鉴 class 但另拼布局 | `src/ui/runtime-editor/actions.ts / view.ts` | 保留工具生命周期；抽取共用结构但不迁移 Editor 会话 |
| 图鉴 CSS 使用局部 `--codex-*`，编辑工具使用 `--re-*` | `src/ui/runtime-editor/codex/codex.css`；`src/ui/css/runtime-editor.css` | 统一本次图鉴／共享框架中的角色，不能全局修改其它工具配色 |
| 共享 Workspace Frame 提供列、scroll owner、header、宿主；经 Presentation host 输出 | `src/ui/components/workspace-frame.ts`；`ui-style/patterns.md` | 优先复用列几何与滚动，需明确工具主题隔离及窄屏选栏适配 |
| 条目和页签已有局部节点保持测试；搜索仍替换 Pane 后恢复 input 焦点 | `actions.ts: bindRuntimeEditorCodexActions / refreshRuntimeEditorCodexPanel`；`tests/ui/runtime-editor-codex-integration.test.ts` | 改为保留搜索 input，不把手工恢复焦点等同于节点连续性 |

上述为施工前事实；A 验收后须以实际交接合同更新受影响事实，不把本表当作 A 的实现结果。

## 最小 Read Set 与修改边界

开工使用 `frontend-design` skill，读取 [[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]] 及命中的 foundations／patterns、[[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。先核对 A 的验收记录与实际只读契约。

源码先读图鉴 `codex/`、`codex-details/` 的目标文件，`runtime-editor/view.ts / actions.ts` 的相关区域、工具 CSS、共享 Frame 与其直接样式；对照已有图鉴测试和 `tests/ui/workspace-frame.test.ts`。读取具体资料字段时按领域契约补最小范围，不读独立编辑器 UI。

预计改动：

- `src/ui/runtime-editor/codex/` 的模型、状态、框架／列表视图及 CSS；必要的新共享框架或中文展示元数据放在同一职责目录。
- `src/ui/runtime-editor/codex-details/` 的资料 Profile、关系清单、技术详情和类型；`runtime-editor/view.ts / actions.ts` 的接入点。
- `src/ui/css/runtime-editor.css` 的工具宿主适配；共享 `workspace-frame.ts`、`layout.css` 及其测试仅在 B0 证明需要窄扩展时进入，禁止改其它工作区默认行为。
- 图鉴定向测试、必要的 Frame／popover 回归、`ui-style/` 与直接相关 UI 当前机制文档。

不在本 Task 修改 Editor Draft 持久化或内容写命令，不为演示改发布包。Task 级范围不等于正式 Patch Unit 白名单；开工按 [[docs/ai/PROJECT-CONSTITUTION]] 为实际 Unit 冻结具体文件和预算，本轮不预建空 Receipt。

## 施工切片

正式 Unit：[[docs/plan-work/archive/task-0283-units/u1-shared-frame]]、[[docs/plan-work/archive/task-0283-units/u2-catalog-shell]]、[[docs/plan-work/archive/task-0283-units/u3-friendly-details]]、[[docs/plan-work/archive/task-0283-units/u4-navigation-updates]]；A 验收前只准备 B0 的结构记录，不实施依赖 A 的 B 功能。

DOM动作与交互测试分别由 [[docs/plan-work/archive/task-0283-units/u5-dom-continuity]]、[[docs/plan-work/archive/task-0283-units/u6-navigation-regression]] 承担，U4保留模型／状态／适配。

### B0 结构冻结（2026-10-15）

采用共享 Frame 的纯布局输出窄扩展：`renderWorkspaceFrame` 继续经原 Presentation 列输出；新增纯布局入口供工具传入已渲染三栏，保持游戏默认行为。工具采用 `pane-switch` 响应式标记，不沿游戏的纵向堆叠规则。`codex/workspace.ts` 承担导航／列表／详情／可选操作区插槽，由图鉴实际调用；不复制三栏几何渲染函数。

相对现有图鉴：网格 wrapper 由 div 改为共享 section，不增加网格 wrapper；新增最多一个可选 footer，仅在有操作内容时挂载（B 图鉴为空）；各 Pane 原节点继续作为稳定宿主。搜索框与列表滚动容器分开，左栏自身滚动，右栏固定标题＋内容滚动；不新增同义 surface 包装。详情页签＋slot 沿用既有语义节点。没有游戏 host ID 或新主题叠层。

### B0：冻结可施工 DOM 与样式适配

- 对照 `renderWorkspaceFrame / renderWorkspaceColumn` 验证工具列几何、滚动和选栏；先确定复用方式，再改 UI。
- 保留现有 body 根与工具 header；Frame 不使用游戏内容 host ID，不让场景 Presentation 影响工具表面。
- 若需窄扩展共享 Frame，明确参数的默认兼容行为、主题隔离和窄屏语义；有结构性边界变化时先回填 Task，不在实现中隐式选型。
- 在本 Task 记录实际 DOM 草图、新增 wrapper 数量与用途、各 scroll owner、更新目标和缺失回退；未完成此记录不进入 B1。

拟固定的语义结构：

```text
body 工具宿主（稳定）
└─ 共享内容框架
   ├─ header：超级图鉴／范围／现有工具导航／关闭
   ├─ nav：中文分类＋包筛选（独立滚动）
   ├─ section：固定搜索 input＋条目列表（列表滚动）
   ├─ article：固定身份标题＋详情切换＋内容（内容滚动）
   └─ 可选操作插槽：本 Task 不挂编辑命令
```

只增加有上述职责的包装，已有节点能承担时直接复用。图鉴来源不明的条目在名称旁显示“来源待确认”，不能误称“系统配置”。

### B1：中文分类与列表

- 左栏组织世界与设施、角色与培养、物品与经济、剧情与对话、行动与场景、外观与素材、规则与配置；内部 kind 保留稳定键。
- 类型只归一个主分类；新增未知 kind 有“其它内容”兜底；派生剧情入口不与原始入口重复制造条目数。
- 名称与说明优先，ID 次级且可复制；结果数与当前筛选一致。数据名称来自既有只读源，UI 只拥有标签／分类映射。
- 包筛选仅使用 A 的可靠来源口径；保留全部和未知范围，不假装支持完整版本来源。

### B2：本体资料与技术详情

- 资料页去掉重复身份标题，按类型分组呈现字段、集合、费用、效果与条件；必要引用字段直接显示可点击目标名称。
- 首批专用资料覆盖 Init／Area／Spot／Enhancement、资源、物品、角色原型／差分、剧情入口和六类 Operation：Event／Location／Action／Student Profile／Strategy Profile／Card Pool。
- 其它类型有通用友好字段兜底；未包装字段放入可展开“其它定义字段”，完整字段树与 JSON 仍可查、可复制，不可写。
- 只展示静态定义语义，不把当前库存、等级或 Buff 后收益混进本体资料。

### B3：被引用清单与连续导航

- 默认只列 A 确定的直接入向关系，按 `{source.kind, source.fullId}` 分组为“引用者／用途／查看”；区分引用者数与位置数。
- 多路径展开说明具体用途，自引用单列；派生与 Runtime 生成规则独立呈现或在可靠 owner 下归并。疑似关系进入“可能使用”，不冒充确定引用。
- 空态说明当前范围与覆盖限制，不写“无人引用，可安全删除”。
- 跨包跳转保留列表筛选，详情提示“当前条目在筛选范围外”；用户主动点“在列表中定位”才调整范围。
- 返回历史保存条目、页签与阅读位置；发生主动定位时还原原列表范围。历史上限固定为 50 条，清理失效键。
- A 提供局部 owner／path 时打开所属定义并展示位置提示；有已渲染的语义目标可定位时再定位，不伪造独立全局条目。

### B4：交互连续性、窄屏与回归

- 两种屏宽均沿相同语义区；窄屏“分类／列表／详情”只切可见性，不重建内容。
- 引入共享插槽时图鉴实际使用；现有编辑器导航仍打开原流程，不呈现尚未实现的新编辑视图。
- 搜索、中文输入法、长 ID／名称、键盘操作、空态、缺失／歧义、未知来源与规则未覆盖均验收。
- 核对 popover mutation range、节点 identity、scroll owner 与刷新次数，浏览器验收后补当前样式记录；不能以截图代替交互证据。

## 状态与 DOM 更新合同

浏览会话拥有分类、范围、搜索、选中项、详情标签与历史，不写 PlayerState；生效内容、关系与来源由 A 查询提供。Editor 会话继续由原状态对象持有。

| 操作 | 更新类型及目标 | 保留节点／状态 |
| --- | --- | --- |
| 输入搜索 | 列表／计数 region；必要时协调已选详情 | input、输入法组合、光标、导航、稳定列表滚动宿主 |
| 选分类／范围 | 列表 region，导航 element 属性；需要时详情空态 | header、input、未受影响区 |
| 点条目 | 旧新选中项 element＋详情内容 region | 列表项及列表宿主、导航、工具根 |
| 切资料／被引用／技术详情 | 页签属性＋详情内容 region | 身份标题、列表及焦点锚点 |
| 引用跳转／返回 | 详情身份与内容 region，必要的筛选外提示 | 列表筛选、列表阅读位置与历史 |
| 展开引用位置／技术字段 | 现有节点行为／局部 element | 其它展开项、焦点、两侧栏 |
| 窄屏选栏／普通 Tick | 选栏为属性／可见性；Tick 不刷新工具 | 全部稳定宿主与浏览会话 |

`structure` 仅用于首次挂载、实际工作视图结构切换或损坏宿主恢复。目标缺失先恢复责任区，工具根不存在才恢复整个工具；不以游戏全量 render 兜底普通动作。替换前关闭受影响范围内 popover，范围外保持；替换后校验锚点连接。

## 测试与独立完成定义

- [x] A 验收通过且 B 使用实际交接合同；不复制或退回猜字符串关系。
- [x] 默认中文分类／搜索可找到真实内容，当前生效范围、未知来源及派生条目计数清楚。
- [x] 首批资料类型均显示有意义的名称、说明及领域字段，六类 Operation 有专用基本资料；其它类型和未识别字段仍可完整查阅。
- [x] 主阅读路径为资料＋被引用，向外引用与原始数据只按需打开；名称、说明不在多个标题区重复。
- [x] 引用者分组／用途／位置数、自引用／派生／候选分离正确，跨包跳转、主动定位及返回完整恢复上下文。
- [x] 共享框架已被图鉴使用并有明确插槽；B0 的真实 DOM／wrapper／scroll 记录完成；现有编辑器与入口未被破坏。
- [x] 搜索输入节点及输入法组合、条目列表、详情标题和浮层锚点按合同保留；普通 Tick 不重建工具，局部更新及回退有实际证据。
- [x] 桌面1440×900实际浏览器验收：长内容和长ID可访问，键盘可完成主要路径，无页面横向溢出，工具保持浅色表面且不随场景主题变化。窄屏390×844本轮按用户明确要求不验收，不作为完成条件。
- [x] 图鉴 shell／details／integration、A的数据查询与规则源回归及Frame／popover测试通过；另通过 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、差异空白检查。
- [x] `ui-style/` 仅记录已稳定实现的规则；直接路径GALHCG只读复核与实际验收记录完整。

## 当前核验（2026-10-15）

阶段B最终验收完成。A数据／Runtime五文件29项、B UI／Frame五文件62项全部通过；类型检查、架构检查、文档检查和差异空白检查通过。Runtime Editor兼容测试52项通过。浏览器只验收桌面1440×900，不操作用户现有Edge页面。

- 真实UI搜索“夏莱主厅”命中4条，资料页显示实际字段；被引用页显示13个引用者、14条引用路径。点击“信用点制造机”保留原搜索并显示筛选外提示；主动定位后连续返回恢复原Area、筛选、页签和滚动上下文。
- “请求维修通行证”长ID、Operation Profile资料及技术详情可读；技术详情呈现两条声明关系、候选与局部路径、缺失推断、覆盖说明和字段树。End切换至技术详情成功；页宽1440、详情Pane右边界1421，未横向越界。
- 原编辑器入口打开既有“内容浏览器”；内容浏览器没有可编辑Mod时显示现有空状态。未执行保存或应用写入。
- 超级图鉴在“主题系统展示 Init”场景下保持自有浅色表面。空搜索结果明确显示“没有匹配条目”。
- 桌面视觉和交互截图保存在Codex visualization输出目录。窄屏按用户要求未测试，不计作阻塞或通过。

## GALHCG 影响闭环

- 已核对 `project_id=acprogram`，沿用 Draft 的游戏内内容编辑与图鉴路径发现；源码／测试仍是当前事实权威。
- 本轮对新增 Task 及更新 Draft／索引执行直接路径只读复核；未建立图内关联的新增文档如实记录为范围限制。
- 实际结果：两份新 Task 与 Draft 返回 `unreferenced_path`；索引返回 `content_changed`，文件／owner 分页完整，3 条既有 Evidence 的内容基准已变化。没有刷新或维护图谱。
- 没有图谱维护授权，不创建／刷新图谱或写 freshness。施工时仅审查实际直接影响，不沿关系无界扩读。

## 剩余工作与下一步

- 本 Task 无剩余工作，Task及Units/receipts已归档。
- 阶段C的编辑器迁入、按条目草稿与保存／应用反馈，以及阶段D的更多编辑能力仍未完成；保留在Draft作为后续设计来源。

相关路由：[[docs/plan-work/archive/task-0282-super-codex-phase-a-reliable-relations]]、[[docs/plan-work/draft-0282-super-codex-and-authoring-workspace]]、[[docs/ai/context-packs/ui-presentation]]、[[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]]、[[docs/docs-829/05-conventions/testing]]。
