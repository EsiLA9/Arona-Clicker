# Task 0306：area-hero 工作区、故事入口收敛与进入门控

状态：proposed — 需求已记录，等待其他模型接手；尚未实施。P0 须先核实事实并收敛下文待裁定项，再开展依赖这些规则的施工。

## 目标

本文回答：如何将正常游戏左栏的 area-hero 变为区域工作区入口，并将新故事与历史重播的入口职责分开。

来源：用户于 2026-10-21 在当前协调会话直接提出以下需求；本文是后续模型的交接 Task，不表示功能已存在。

1. area-hero 可点击进入围绕当前区域的 Workspace，中栏、右栏随之变化。它随后充当信息概览、区域故事、主动故事与事项提醒的唯一入口；原“故事”入口改为纯粹的历史重播入口。
2. area-hero 的进入必须门控：当前对话流须为 passiveStory 等允许内容，避免故事间打断。
3. area-hero 右上角需要提示小标。

本 Task 覆盖这轮入口、工作区与交互职责调整，作为后续大量区域交互和新概念施工的基础；不预先设计全部未来内容。

## 已裁定范围

- 目标是 `game` Workspace 左栏中的 area-hero；Map Workspace 复用的 `.area-hero` 不在本轮改造范围。
- 点击区域横幅进入有明确页面身份、返回行为与生命周期的区域 Workspace，不能只展开横幅内文字或只弹一个临时提示框。
- 中栏、右栏切换为区域工作区对应内容；左栏承担何种保留与导航职责，在 P0 结构草图中说明。用户未要求将左栏改成全新设计。
- 信息概览、区域故事、主动故事和事项提醒统一从 area-hero 进入，不保留可绕过这一入口直接启动新故事的重复导航。
- 原“故事”入口保留历史重播职责；不能继续承担未完成故事的首次启动、区域新故事发现或事项提醒入口。
- 进入工作区和启动其中的故事是两个不同动作。仅打开工作区不应自动启动、完成、取消或替换故事。
- 必须有真实的进入门控，不能只有禁用样式。被拒绝时保留当前流与演出进度，给出能理解的阻止原因。
- 右上角小标是入口的提示表达；不能通过点击小标绕过同一门控。

## P0 待裁定项与事实门槛

这些细节没有被用户完全指定。执行模型应先给出基于源码的精简方案，由主协调方承接产品裁定；不要把建议写成用户已批准的规则。其余独立调查可以继续。

| 问题 | 必须产出的结论 |
| --- | --- |
| “passiveStory 等内容”包含哪些状态？ | 当前可见对话流的 owner 如何解析；passive 播放、无故事 idle、无可用闲聊、active／首次故事、重播、学生对话分别允许还是阻止。passive 是允许基线；不能凭空将“等”解释成任意非 active 状态 |
| 演出和待确认入口如何参与门控？ | 核对 `sendGate`、`storyGate`、开幕演出与排队故事；明确哪些只是表现节奏、哪些代表需保护的故事生命周期，避免简单地把所有动画都当作禁止条件 |
| 四类内容首期展示什么？ | 从当前只读数据找到真实内容来源与过滤条件；没有现成“事项”定义时，提出首期最小范围，不自建完整任务／日程系统或伪造待办 |
| 右上角小标表达什么？ | 用户只指定位置与提示用途；有内容、可启动、未读或待办等含义、何时显示／清除、门控期间如何呈现须明确。可建议沿用主题的小点，未裁定前不引入数字计数或持久化已读状态 |
| 历史重播包括什么？ | 核对完成记录、`replayable` 和分支／重播策略，形成可重播列表规则；不可重播的完成项如何显示须明确，不能为迁移入口而放宽既有重播准入 |
| 唯一入口影响哪些既有路径？ | 定位故事分类、聊天流入口卡、学生入口与自动故事触发的真实调用方。用户明确了四类内容的唯一入口，但自动触发与特殊剧情内导航的处理尚需核对；发现冲突先记录并交协调方裁定，不顺手停掉所有自动剧情 |

## 当前事实与代码落点（2026-10-21 核对）

| 已核实事实 | 源码／符号依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 游戏工作区由左、中、右三栏组合，共用 Frame | `src/ui/workspace/workspace-renderer.ts`：`renderGameWorkspace`；`src/ui/components/shared/workspace-frame.ts` | 新工作区复用骨架与宿主规则，不复制一套三栏框架 |
| 当前路由没有区域 Workspace；返回位置是单层，不是历史栈 | `src/ui/workspace/workspace-router.ts`：`WorkspaceRoute`、`WorkspaceNavigationState`、`WorkspaceLocation` | 新页面需要明确 route 身份、返回点和 active Area 变化时的处理 |
| 正常界面 hero 来自当前 Area／表现查询；本体没有进入工作区动作 | `src/ui/components/shared/rail.ts`：`renderAreaTab` | 增加可访问点击入口；名称、说明继续来自既有查询 |
| 正常左栏的通讯录／故事按钮是 Workspace 路由入口，主体固定显示区域导航 | `src/ui/components/shared/rail.ts`：`LEFT_TABS`、`renderLeftPanel` | “故事”职责变更须覆盖真实路由和动作，不能只改按钮文案 |
| 右栏设施按当前 Area 过滤，并组合设施功能入口 | `src/ui/components/shared/right-panels.ts`：`renderRightPanel`；`src/ui/components/shared/production.ts`：`renderProductionNodes` | 区域工作区右栏需有自己的职责；返回正常界面应恢复原位置 |
| 现有故事导航同时提供首次“进入故事”和“重读”动作 | `src/ui/components/shared/rail.ts`：`resolveItemsAt`；`src/ui/components/story/story-workspace.ts`：`renderStoryWorkspace` | 重播职责收敛涉及条目筛选和启动路径迁移 |
| 故事视图以 `type: passive / active` 表达类型；回复状态另有 idle／advance／choice 等 | `src/arona-clicker/contracts/runtime/results.ts`：`StoryView`、`SendState` | 不能把 SendState 当作完整故事类型门控；重播身份和流 owner 还需继续核对 |
| UI 节奏 gate、故事入口确认 gate 与学生流 owner 分别存在 | `src/ui/components/shared/app-shell.ts`：`PanelState`、`StoryGateState`、`SendGatePhase`；`src/ui/controller/controller-actions-story.ts` | 门控应保护实际当前流，不只检查一个全局字段 |
| Map 的 hero 展示 Node 信息并带地图／重开／放弃操作 | `src/ui/components/map/map-workspace.ts`：`renderMapWorkspace` 内 hero 标记 | 不按共享 CSS class 将新点击和提示小标装到 Map 页面 |
| 区域 hero 渐变已有主题派生入口 | `src/ui/css/story-nav.css`：`.area-hero`；`src/ui/controller/controller-theme.ts`；`src/ui/presentation/theme-tree.ts` | 继承当前主题，不引入独立配色与整页视觉重塑 |

上述是交接时的局部事实，执行前须重新读取当前文件。工作区已有其他任务的未提交修改，尤其 `controller.ts`、`controller-panels.ts`、`controller-actions-inventory.ts`、`production.ts`、`ui-style/patterns.md`；不得回滚或覆盖其工作。

## Read Set 与施工边界

先从 [[docs/ai/context-packs/ui-presentation]] 按子题读取。结构和交互施工使用 `frontend-design` skill，遵守 [[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]]，按需读 foundations／patterns。

首轮源码只需上表落点，以及 `src/ui/controller/controller-actions-story.ts`、`src/ui/controller/controller-panels.ts`、`src/ui/controller/controller.ts` 的相关导航／故事方法。按 [[docs/ai/galhcg-project-map]] 主动定位未知的 Story 查询、启动、重播、排队和当前流 owner 实现；不顺序通读整个 Runtime。

- 读取与状态写入边界：[[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/docs-829/06-wiki/50-ui/controller-commands]]。
- 路由与更新：[[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。
- 若改写入口、状态归属或跨层依赖，先读 [[docs/docs-829/05-conventions/architecture-discipline]]；若改字段／枚举，按 [[docs/docs-829/05-conventions/schema-sync]] 核对是否涉及数据契约。
- 预计修改范围：`src/ui/` 命中的路由、组件、Controller、更新和样式，`tests/ui/` 对应行为测试，以及受影响的现行文档／风格条目。确有领域查询或命令缺口时，先提出窄扩展与其 owner，不让组件直接写 PlayerState。
- 本文尚未冻结 Patch Unit 白名单。P0 收敛后按 [[docs/ai/PROJECT-CONSTITUTION]] 拆正式 Unit、明确 Allowed Files 与验证，再执行；下方 P0—P3 是交付切片，不是已经批准的 Unit。

## 施工切片

### P0：补齐门控、内容来源与页面结构

- 回填待裁定表的事实和方案，列出所有受影响的首次启动／重播入口。
- 画简短组件／DOM 草图，说明区域 Workspace 的三栏职责、返回动作、route key、UI 临时状态 owner、实际滚动容器。
- 明确新增 wrapper 的数量和用途、稳定节点、`behavior / element / region / structure` 更新目标、目标缺失的恢复范围与浮层生命周期。
- 给出点击时复核门控的单一入口；页面显示后状态变化、快速重复点击、排队故事到达、返回／读档／切区时如何重核和清理必须明确。
- 延用既有主题和控件；若方案确需新视觉方向，按 skill 完成可审阅的方向说明后再推进依赖部分。

### P1：区域 Workspace 与受门控的入口

- area-hero 具备鼠标和键盘可达的进入动作；内部表现选项保持独立可用，避免嵌套按钮和事件冒泡误入。
- 路由和 UI 位置与业务状态分开；进入后中栏、右栏切换到已裁定的区域内容，返回恢复来源位置。
- 渲染提示、点击处理和任何同义导航调用复用同一准入结果；实际动作前重查当前状态，拒绝过期许可。

### P2：故事与提醒入口收敛

- 按 P0 内容方案接入信息概览、区域故事、主动故事、事项提醒；沿用现有 Story 查询、门槛、确认和命令链路。
- “故事”页仅展示历史重播相关内容，移除首次启动路径；重播不因 UI 改造重复发放首次收益。
- 迁移既有同类手动入口；按裁定处理自动触发／学生流／特殊入口，避免遗漏可绕过区域工作区的新故事启动路径。

### P3：提示小标、回归与交接

- 在正常游戏 area-hero 右上角显示已裁定的小标；可读状态同步提供非颜色独占的可访问说明，不增加单独的绕过入口。
- 按实际数据变化局部同步入口状态与小标，不因 hover、提示变化或普通选择重建整个 Workspace。
- 补齐行为测试和桌面浏览器验收，更新当前机制与命中的风格条目；记录剩余事项，不将未来概念施工一并标为完成。

## 测试与验收

- [ ] 点击／Enter／Space 均能在允许状态进入区域 Workspace；中栏和右栏发生符合结构方案的变化。
- [ ] 门控矩阵有逐行结果和用例；passive 允许基线成立，受保护故事期间拒绝进入，当前故事、选项、回复进度、确认 gate 均不被清空或误推进。
- [ ] 当前学生流与全局流区分正确；许可在点击前失效时仍被阻止；快速重复点击不重复挂载或启动故事。
- [ ] 工作区打开本身无故事写入副作用；后续故事启动仍走既有确认与 Runtime 准入；打开期间状态变化的处理符合 P0 结论。
- [ ] 四类内容统一从 area-hero 进入；“故事”导航只承担历史重播，未完成故事没有借旧入口首次启动的通路。
- [ ] 重播遵守完成／可重播／分支规则，不重复触发首次收益；既有自动故事按明确裁定回归。
- [ ] 返回恢复来源路由、页签、角色／对话选择与必要阅读位置；切区、读档、离开世界线后无旧 Area 内容或过期更新残留。
- [ ] 小标位于右上角，出现／清除／门控态符合已裁定规则；无内容时不伪造提醒，内部表现选项不会误触入口。
- [ ] Map 页面同名 hero 无新增区域入口或错误小标；新局部交互保留稳定节点、焦点、滚动及范围外浮层。
- [ ] 按 [[docs/docs-829/05-conventions/testing]] 完成定向行为测试、相关类型／架构检查、桌面浏览器视觉与交互验收；记录实际命令和结果。
- [ ] 更新受影响的 workspace-routing／refresh-update 等现行正文及 ui-style 条目，运行 `npm run check:docs` 和差异空白检查。

测试定位入口：现有 `tests/ui/workspace-router.test.ts`、`workspace-lifecycle.test.ts`、`controller-events.test.ts`、`workspace-frame.test.ts`，再按实际 Story 调用链定位相邻用例。不得只测试 helper 返回布尔值；需覆盖真实点击、阻止副作用与旧入口迁移。

## 当前核验（2026-10-21）

- 本轮只新增交接 Task 并登记索引，未修改游戏代码、未派发其他模型执行。
- 已实际读取当前 UI 路由、hero、三栏组合、故事工作区和相关契约；门控边界和内容来源仍按 P0 补核。
- 已运行 `npm run check:docs`：未通过，报告 8 处位于既有 `docs/docs-829/` 文档的失效源码／测试路径，涉及旧 Operation 示例、测试与 authoring 路径；本 Task 与索引未被报告错误。未扩大范围修复这些既有问题。
- 已运行针对本 Task 和索引的 `git diff --check`：通过；新 Task 另核对文件内容与尾随空白。游戏测试及浏览器验收未执行，因为本轮没有实施功能。

## GALHCG 影响闭环

- 已核对项目身份 `acprogram`；图内以 Workspace 搜索到 UI Workspace Routing and Lifecycle、UI Workspace Renderer 等候选，并回到当前文件核实。
- 本轮对两条直接路径执行 `graph_health(check="changed")`：新 Task 返回 `unreferenced_path`（无直接 Evidence／maps_to）；索引返回 `content_changed`，已读取 owner_offset 0、5 两页共 9 个 owner，末页 complete=true，无后续分页。该结果是文档变化诊断，不是语义错误或功能实现证明。
- 未维护地图：本轮为未来需求交接，没有地图维护授权；不将拟建区域 Workspace 写成 implemented，不刷新或写 freshness。
- 后续执行模型在修改后仅只读复核直接受影响路径；如需地图维护，另按项目维护规则处理。

## 剩余工作

- 本 Task：P0 事实补核与少量产品裁定，P1—P3 实施和全部功能验收尚未执行，等待其他模型接手。
- 后续方向：区域内更多新概念、完整事项系统、尚无来源的内容作者协议等另行讨论；本 Task 不预建通用通知中心、任务引擎或存档已读系统。
- 协调职责：主协调方承接产品问题、整理描述与施工边界；执行模型提交实际修改、验证证据、未完成项及需裁定的问题。
