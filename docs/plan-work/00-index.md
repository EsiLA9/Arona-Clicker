# docs/plan-work — 计划、讨论与冻结历史入口

状态：active — 当前计划与讨论路由持续维护；历史层于 2026-09-15 冻结

> **本目录不是当前事实源。** 项目当前事实以 `src/`、`tests/` 与 `docs/docs-829/` 为准。`docs/archive/docs-828-snapshot/` 是只读旧版快照；旧 `docs/docs-828/` 路径仅保留兼容重定向。
> 这里的根目录承载当前确实推进的 Task / ADR / Draft；`archive/` 与 `mechanisms/` 保存冻结过程文档。归档文件保留完成或中断时的边界与证据，不能因位置推定其已完成。

> 当前推进项在本索引登记；本轮已将原有工作文档冻结归档，逐项状态见 [[active-work-freeze-2026-09-25]]。

玩法需求由 [[docs/ai/goal-workflow]] 路由：可删除的最终目标集与阶段 Goal 放在 [[docs/plan-work/goalsets/README]] 所述目录；进入正式讨论后建立滚动 Draft，满足准入再建独立可验收的 Task。具体 Goal Set 不登记到本索引，也不作为正式文档的依赖。

主题 UI 生命周期 Task 0161 已由用户确认完成并归档；验收范围与归档时未执行的浏览器视觉检查见 [[task-0161-theme-background-layer-lifecycle-pipeline]]。

## 当前推进

- [[draft-0212-gameplay-b-ac-native-design-roadmap]]：draft；定义“老师有限指挥自主学生处理现场事件”的玩法契约、AC 语义映射、v1 纵向切片与 10 个有依赖关系的 proposed Task；本轮只新增规划文档。
- [[task-0213-gameplay-b-event-runtime-and-session-state]]：proposed；建立 EventRun/EventState 的生命周期及独立状态 owner。
- [[task-0214-gameplay-b-student-participation-and-autonomy]]：proposed；连接现有 Character 身份与局内 Actor/Profile，形成可解释的学生自主行动。
- [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]]：proposed；实现 PreparedBeat、Intent、一次有限指挥、冻结 Commit 与确定性统一结算。
- [[task-0216-gameplay-b-command-loop-vertical-slice-ui]]：proposed；交付核心可玩切片，验证竞争性干预、学生专属能力、只读 OperationView 与单地点结果反馈。
- [[task-0217-gameplay-b-objectives-and-partial-outcomes]]：proposed；用事件轨道/事实支持战斗与场景目标及成功、部分成功、失败结局。
- [[task-0218-gameplay-b-causal-locations-and-route-selection]]：proposed；构建带事件因果的多地点路线，并分离路线选择与战术 Beat。
- [[task-0219-gameplay-b-event-save-and-resume]]：proposed；保存及精确恢复 EventRun、待提交计划与随机流。
- [[task-0220-gameplay-b-datapack-contracts-and-registry]]：proposed；将事件、地点、动作与目标内容纳入声明式 Datapack/Registry 并验证。
- [[task-0221-gameplay-b-authoring-and-content-validation-workflow]]：proposed；构建作者可创建、诊断、加载与迭代完整事件内容的 AC 正式工作流。
- [[task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]]：proposed；作为 V1 产品切片，将正式多地点事件接入 AC 玩家入口并完成三类结局和性能回执。
- [[draft-0209-gameplay-b-current-loop-and-identity-review]]：draft；提取玩法 B 的路线、场所、战斗 Runtime 与源码配置边界，辨明真实规则与写死 Demo 内容，并记录熟悉感及待议身份问题；不授权代码施工或接入 AC。
- [[draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance]]：draft；以减少心智负担为核心，记录玩法 B 场所/战斗体验审查、候选信息布局方向及固定 seed 玩家验收任务；不授权代码施工。
- [[draft-0185-gameplay-b-progressive-prototype-tasks]]：draft；玩法 B 轻量调研与阶段来源，正式施工已拆为下列 Task 0186–0193；串行验收推进，原型不依赖 AC 运行部件。
- [[task-0193-gameplay-b-calibration-and-standalone-delivery]]：active；U1 固定 seed 诊断、U2 零调参和 U3 仓库外完整试玩已通过；本机安全策略拦截临时副本清理，待用户确认替代清理动作后终态核验。
- [[draft-0181-click-turn-location-gameplay-b]]：draft；预研 Click 推进战斗与场所路线，含 12 节点游乐园巡查 Demo；首版从 2+2 初始编队开始，详尽方案拆见导演、UI、样本引擎三个子 Draft；纯预研，不接入现有代码。
- [[draft-0182-gameplay-b-director]]：draft；设计 2+2 初始角色、普通牌组/AI/随机技能、两个营地与中途角色、敌人模板及 12 节点聊天文本。
- [[draft-0183-gameplay-b-ui]]：draft；设计左我方 Chara / 中 Click 与聊天 / 右敌方 Chara 的三栏 UI，维持单一 Click 推进。
- [[draft-0184-gameplay-b-sample-engine]]：draft；设计隔离的轻量数值与事件引擎，覆盖场所行为、战斗牌合成和日志结算。
- [[draft-0195-galhcg-content-maintenance-experience]]：draft；记录图谱内容维护的变更发现、Evidence 同步、范围/分页、结果可读性与 freshness 闭环问题；GALHCG 服务端实现尚待核实。
- [[task-0176-base-runtime-editor-full-content-coverage]]：proposed；为基础包剩余 22 个内容表补结构化 RuntimeEditor 编辑面，保留原包字段与引用。

## 本次完成（2026-10-04）

- [[task-0211-gameplay-b-cost-consumption-slot-preview]]：按用户反馈将 Cost 改为单排当前持有槽，本批拟消费格闪烁/降色，点击结算后移除消费格；目标未确认/费用不足等状态不显示假余额。1280×720 验收及玩法 B 全测 159/159、类型检查、构建、579 篇文档检查通过。
- [[task-0210-gameplay-b-player-cost-action-dock-meter]]：Action Dock 左侧新增当前持有与本批 Click 后玩家 Cost 横向槽，并从地图/批次状态移除重复余额读数；目标草稿、Cost 不足、待出点均有明确状态。1280×720 浏览器验收及玩法 B 全测 159/159、typecheck、build、578 篇文档检查通过。

## 本次归档（2026-10-03）

- [[task-0194-runtime-editor-panel-minimal-dom-refresh]]：按用户要求冻结归档；U1/U2 与定向验证已完成，U3 桌面编辑验收、既有 pack-export UI 测试确认及 Task 终态维护仍待续，不代表 Task 完成。
- [[draft-0169-galhcg-active-scope-and-audit-enhancements]]：按用户要求归档；保留 8 项调用侧候选、续页复现及服务端待核验边界，未授权或实施 GALHCG 服务修改。
- [[draft-0170-equipment-effect-consumption-boundary]]：按用户要求归档；保留静态消费者调查和未裁定的装备效果接入/内容语义问题，未实施运行接入或内容改写。

## 本次完成（2026-10-03）

- [[task-0208-gameplay-b-low-cognitive-load-ui-and-core-play]]：U1–U3 完成；折叠/展开 13 节点路线图、场景批次与目标卡选择、固定 1280×720 Click/战斗操作走查交付。固定 seed 浏览器覆盖 4 出口、持有物消费捷径、无物兜底、路线回环、角色选择及战斗目标改选；原型全测 156/156、类型/构建通过，文档检查 577 篇 / 0 errors。
- [[task-0205-gameplay-b-map-and-player-actions]]：U1–U4B 全部完成；13 节点游乐园多区域图、回环和访问上限、持有物捷径/兜底、Individual/Global 场景选择、共享 Cost 上限、有限玩家卡组与目标选择 UI 已交付。固定 seed 浏览器实走分支、回环、通行物消费、无物品兜底、设备井战斗 Click、日志滚动/焦点和 1280×720/1024px 布局；原型 152/152、typecheck/build、574 篇文档 / 0 errors 通过。策划基线见归档 [[draft-0204-gameplay-b-map-and-player-actions]]。
- [[task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback]]：玩家普通卡与独立免费技能可跨规则声明的合法行改目标，默认优先目标保持不变；失效普通行动回落观察、退还本轮 sCost。玩法 B 152/152、类型检查、构建与文档检查通过；无 AC Runtime 接入。
- [[task-0205-gameplay-b-whole-card-drag-and-target-choice]]：整张可见行动卡可起拖，浏览器原生选字与合成 click 不再抢手势；单目标改选、非法落点、普通 click 选卡组、Escape / 取消均已核验。玩法 B 全测 147/147、类型 / 构建通过；根类型与文档检查通过。根全量测试另有 9 项 AC 测试失败，记录见 Task 收据。
- [[task-0203-gameplay-b-standalone-entry-port]]：玩法 B 开发服务固定在 127.0.0.1:5174；本地工具台卡片从 5173 实测可新开独立原型首屏。原型全测 134/134、类型检查、独立构建、文档检查 570 篇 / 0 errors 通过；AC Runtime 不变。
- [[task-0202-gameplay-b-overlapped-card-drag-hit-area]]：修正战斗行动卡与特殊技能卡的扇形遮挡，普通卡至少露出可辨标题/拖拽区，特殊技能仍保持右侧高层；浏览器确认普通卡可拖至新目标并同步预览。原型全测 134/134、类型检查、独立构建、文档检查 569 篇 / 0 errors 通过；无 AC 接入。
- [[task-0201-gameplay-b-player-card-targeting-and-reselection]]：玩法、清晰度、引擎/交互三项子 Agent 审理后完成 U1–U3；行动卡可拖拽改合法目标或打开普通卡组选架，冻结技能与 Click 边界保持；浏览器 1280×720 核验，原型全测 134/134、typecheck/build 通过，文档检查 568 篇 / 0 errors；与 AC 隔离。
- [[task-0200-gameplay-b-card-relation-top-layer]]：将战斗/场所准备卡迁入左右面板覆盖层，修正来源、目标和关系线次序；同角色重叠扇形卡的连线绕开卡面，全队场所效果 5 目标线同时可见。1280×720 验收通过；原型全测 123/123、typecheck/build 通过；无 Runtime/AC 接入。
- [[task-0199-gameplay-b-location-cards-and-line-anchors]]：非战斗角色探索意图/结果卡挂入 Chara 卡；单人及全队场所效果进入对方空区并精确连接目标。关系线改用中心向量求边界端点并提升悬层。1280×720 检查 Node 2/3/5/6；定向 6/6、原型全测 122/122、typecheck/build 通过；无 Runtime/AC 接入。
- [[task-0198-gameplay-b-action-cards-and-hover-targets]]：独立玩法 B 原型按冻结行动生成 Chara 小卡片、技能修正/免费行动关系及曲线目标指示；轮次切换、战斗离场和终局均完整回收。固定 seed 浏览器全路线 26 Click 到达 complete；定向测试 5/5、原型全测 116/116、typecheck/build 通过；不接入 AC。
- [[task-0196-gameplay-b-correctness-fixes]]：全队初始倒地在任何节点入场副作用前立即失败；Node 2 第二次巡查摘要改为不预判检定成败。定向测试 13/13、原型全测 111/111、typecheck/build 通过；文档检查 564 篇、0 errors。
- [[task-0197-gameplay-b-portal-entry-card]]：本地工具台保留 `/game`、`/editor` 并新增独立玩法 B 预研卡片；1280×720 浏览器确认三卡同排，卡片打开独立原型正常。
- [[task-0192-gameplay-b-three-column-ui-acceptance]]：U1/U2/U3 完成并归档；日志合并至一条 Runtime event 一项并关联已冻结预览；固定 seed 全路线 26 Click、12 节点通关，终态唯一按钮禁用。原型全测 107/107、typecheck/build、561 篇 Markdown 文档检查通过；Console 0 errors，重载网络请求仅本地资源。
- [[task-0191-gameplay-b-complete-park-demo]]：U1–U7 完成并归档；12 节点、4→5→6 人队伍与三战路线可复现。固定 seed `park-inspection-demo` 完成 26 次 Click（战斗 4/5/6 轮）；胜败平夹具、19 项整局/内容回归、类型检查、独立构建、文档检查及浏览器全路线验收通过，原型保持与 AC 隔离。
- [[task-0190-gameplay-b-camp-route-lifecycle]]：U1–U4 完成并归档；原 Route/camp 组合 U2 按 C2 拆为 451 行 Route Runtime U2 与 159 行 camp U3。原型全测 72/72、typecheck/build、561 篇 Markdown 文档检查通过；1280×720 短路线浏览器烟测完成 11 Click、两战共 7 轮、79 条连续事件，终态完成。原型保持与 AC 隔离。
- [[task-0186-gameplay-b-prototype-rule-baseline]]：规则基线、R01–R10 决定状态、Runtime 字段契约与九组手算完成；R06/R09/R10 标为原型暂定并交接 0187，保留 2026-10-04 用户验收修订。归档前 `npm run check:docs` 通过（538 篇 Markdown，0 errors）。
- [[task-0187-gameplay-b-standalone-click-prototype]]：独立 package、四人 seeded 场所 Runtime 与三栏 Click 样本完成。6 项定向测试、类型检查、独立构建及 1280×720/1440×900 浏览器验收通过；三次 Click、自动进出口、终态幂等、固定 seed 刷新重开、稳定 DOM、日志滚动与 Console/Network 均核验。确认无 AC 依赖，已交接 0188。
- [[task-0188-gameplay-b-deterministic-battle]]：U1/U2/U3 确定性战斗、同步净值结算和首战三栏页面完成；原型全测 32/32、类型/构建/文档检查通过。1280×720 浏览器完成四轮首战胜利、日志对账、终局幂等、滚动与 Console 验收；R11 倒地复起时点仍为原型暂定，留待 2026-10-04 用户验收，已交接 0189。
- [[task-0189-gameplay-b-card-recipes-and-skills]]：U1/U2/U3 完成；原型测试 54/54、typecheck、build、docs 检查通过，Edge 1280×720 完成一轮 Click 冒烟。已交接 0190；本地可选 `favicon.ico` 404 与 R11 倒地治疗资格暂定项记录在 Receipt。

## 本次完成（2026-10-02）

- [[task-0180-runtime-editor-shared-content-workspace]]：内容浏览器改为 Codex 同款三栏桌面工作区，四类现有编辑闭环沿用原 Draft / Apply 策略；Codex 保持当前 Runtime 有效内容范围，`.codex-inspector-tabs` 完成分段视觉、键盘焦点和详情 slot 局部刷新。6 个定向 UI 文件 / 71 项、类型 / 架构 / 文档 / 构建核验及桌面浏览器验收通过；Task 0176 的 22 类表单仍独立推进。
- [[task-0179-game-loading-feedback-and-lazy-ui-chunks]]：启动 Shell 与最小状态投影完成；将 JSZip 从 initial graph 移入 ZIP 首次使用 chunk，gzip 初始 JS 减少约 29.7 KB。冷 / 热启动计时与浏览器错误 / 正常路径均核验；全量测试有 4 项既有 Gear / Init / UI Host 工作区失败，Task 定向 28 项通过。Base JSON 分片继续延后。
- [[task-0177-base-typescript-datapack-folder-export]]：新增 `npm run datapack:export-base`，从既有 Base TypeScript 模块导出标准文件夹包至 `datapack/base@1.0.0/`；包含 1 个 JSON 分片和 3 个图片资源。真实导出、parsePack 字段逐项比对、资源字节及重复导出确定性测试通过；类型 / 架构 / 文档 / 构建 / diff 检查通过。
- [[task-0175-base-packageization-editing-and-swap]]：发布基础包 JSON、base 唯一必需槽位、同名普通态/编辑态交换、RuntimeEditor 支持表的编辑 Apply / 快照恢复 / 发布版本回退完成；定向 78 项、类型 / 架构 / 文档 / 构建 / diff 检查及桌面交互验收通过。剩余 22 表编辑进入 Task 0176；编辑态快照仍按浏览器 Profile 本地持久化。
- [[task-0174-editing-packs-in-runtime-and-conflict-swap]]：编辑态数据包可进入启用序列并继续由 RuntimeEditor 修改；拖放同名冲突支持高亮、确认交换和原位置保留，核心包保持不可交换；定向测试、类型/架构/文档检查及桌面浏览器验收通过。
- [[task-0173-development-datapack-source-loading-and-management]]：固定目录自动发现、启动时来源对账、普通/编辑态识别及双列表包库管理完成；8 个定向测试文件、类型/架构/文档检查和桌面浏览器验收通过。窄屏未纳入范围。
- [[task-0172-workspace-composition-and-datapack-management-shell]]：WorkspaceFrame 支持 left+center、center+right、全列组合；数据包管理场景输出唯一 frame，左侧合并导航/主体，右侧保留详情区；25 项定向测试、类型检查、文档检查和桌面浏览器验收通过。窄屏不在验收范围。



## 本次完成（2026-10-01）

- [[task-0168-active-artifact-cleanup-and-map-reconciliation]]：清理和地图对账完成；重启后 AOCI 工具为 0，14 份资料哈希归档，664/664 活跃 .ts/.css 映射；运行遗留由 Task 0171 完成。
- [[task-0171-retired-aoci-runtime-artifacts]]：511 个 AOCI 运行文件（约 108 MiB）已移至项目外本机备份，迁移前后二次 SHA-256 核验全部一致；原 .aoci 退出项目。


- [[task-0167-docs-828-reference-redirection]]：逐篇处理旧树 68 篇内容，将快照归档并为原路径建立重定向；改正现行 Read Set、工具与源码注释。`npm run check:docs` 通过（511 篇 Markdown，0 errors）。AOCI 生成索引未更新，按用户计划弃用 AOCI 的指示留待统一退役。

## 本次完成（2026-09-30）

- [[task-0161-theme-background-layer-lifecycle-pipeline]]：用户确认主题图层、选择页投影与 Restart 生命周期工作完成并要求归档；U01–U06 六个 Patch Unit 均有完成收据。浏览器视觉验收未执行，作为归档时的已知限制保留。
- [[task-0166-galhcg-typescript-css-full-file-coverage]]：ACProgram 全部 643 个 `.ts` 与 22 个 `.css` 已通过有依据的 Concept→File `maps_to` 覆盖（665/665，缺项与越界均为 0）；新增 1 个工程支持 Module、35 个 Concept，语义边从 227 增至 1,026。写入批次均 dry-run 后提交，结构遍历无环；MCP 使用不便和单个未确认活跃调用的 `bondDict.ts` 记录在归档 Draft 0165。

## 本次冻结归档（2026-09-30）

- [[goalset-and-draft-freeze-2026-09-30]]：按用户要求，将 Draft 0165 与三个 Goal Set 的 15 篇内容文档移入 `archive/`；保留冻结时的未完成/暂缓状态，不表示这些目标已完成。Goal Set 通用说明仍由 `goalsets/README.md` 提供。

## 本次完成（2026-09-28）

- [[task-0164-docs-system-v2-from-source]]：从当前源码和测试重建 `docs/docs-829/`，切换 `AGENTS.md` 当前文档路由；`npm run check:docs` 通过（438 篇 Markdown，0 errors）。旧树未作为内容输入。

- [[task-0163-outline-driven-project-wiki]]：按 AC Outline 建成 6 篇分层 Wiki 正文，修正并标记有源码证据的陈旧文档内容；`check:docs` 通过，Tick 计数写入口问题保留待裁定。
- [[task-0162-registry-wiki-reference-pilot]]：Registry 只读 Code Review 与多 Agent Wiki 风格参考页试点完成；发现一项加载失败非原子性问题和一项待确认的跨包默认 Spot 引用边界，均未在本 Task 中改代码。

## 本次完成（2026-09-26）

- [[task-0157-area-achievement-demo-v1]]：双区域独立数据包、Area 首访成就、累计进度、一次性效果与玩家可见 Records 页已交付；玩法裁定见 [[draft-0156-area-achievement-demo]]。

## 暂缓归档（2026-09-27）

- Agent 观测工程 G01 按用户优先级暂缓：[[draft-0159-agent-observability-query-contract]] 与 [[task-0160-agent-operation-result-slice]] 已移入 `archive/`，保留归档时状态。该 Goal 未撤销；恢复时按工作流另立新的 Draft / Task。

## 冻结约定

- `archive/` 与 `mechanisms/` 冻结为**单一考古层**：原 `active/`、`completed/`、`newPlan/`、`review/`、`registry&saves/` 已全部合并进 `archive/`，不再按生命周期分目录维护；
- 根目录 `task-*.md` / `adr-*.md` / `draft-*.md` 是当前施工入口，只保留确实要推进的工作；完成或按用户要求冻结后移入 `archive/`，不得在根目录长期保留已完成文档；
- `00-index.md` 继续维护活跃任务、未决方向和历史路由；`archive/` 与 `mechanisms/` 内的历史正文不做状态准出，只允许按需追加「更正（日期）」标注；
- 每份文档文首的 `状态：` 行保留**冻结时的最后已知状态**（`done` 已完成 / `closing` 仅差准出 / `active` 在推进 / `proposed` 待开工 / `draft` 未裁定）。这些取值现在只用于阅读时区分「做完了」与「没做完」，**不再被任何检查器强制**；
- 目录内文件只做链接完整性检查（`npm run check:docs`）。

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `archive/` | 全部冻结的过程文档（ADR / Roadmap / Task / 草案 / 审查记录 / 数据包施工计划） |
| `mechanisms/` | 按机制的**反向索引**：从当前机制出发找它的设计理由与历史来源 |
| `goalsets/` | 可整组删除的最终目标与阶段 Goal 讨论地图；使用说明见 [[docs/plan-work/goalsets/README]] |
| 根目录 `task-*.md` / `adr-*.md` / `draft-*.md` | 当前正在推进的任务或裁定，完成后移入 `archive/` |
| `00-index.md` | 本文 |

## 怎么用这一层

```text
想知道系统现在是什么        → docs/docs-829（当前文档入口）
想开始一个新方向            → 在 docs/plan-work/ 根目录新建 Task / ADR / Draft，并同步本文
想知道某个机制为什么这样设计 → docs/plan-work/mechanisms/<机制> → 再跳 archive 原文
想知道还有什么没做          → 本文「未决方向」（下列）
想恢复某个方向              → 从 archive 原文重新激活，另立 ADR / Task，不要就地续写
```

**不要**从本目录判断系统现状。ADR 中写「应如此」但源码未实现的地方，需对照源码、当前文档与对应 Task 重新核实；历史 ADR 中的未实现提案不代表现状。

## 未决方向（冻结时的未完成项）

> 以下方向在冻结时**既未完成、也未被正式撤销**。列出仅为避免意图丢失；它们**不在当前计划中**。需要推进时，从对应原文重新裁定。
> 本节较早条目中出现的“当前”“施工中”均是当时的历史措辞；2026-09-25 本轮状态以 [[active-work-freeze-2026-09-25]] 为准。

### 数据包与多包管理

- 单文件 / 文件夹来源适配器（与 zip 同构解析）。
- 按扩展名注册的通用分片解析器（`.dsl` 等）。
- **惰性存档的全量语义**：除 Tag 外 roster / 背包 / `storyReadLogs` / flags / 好感的存在性过滤，以及残留检查与清除界面。
- 残留数据跨 mod 合并语义、manifest 缺省降级、version 区间匹配、依赖拓扑排序。
- character / variant id 三段化（S1c）与相应校验收紧。
- `affectionConfig` 改特化表 + 角色级 `affectionConfigId`。
- mod 管理 UI 补全：文件夹 / 单文件导入、完整草案确认流程、残留管理。

原文：[[adr-0004-datapack-management]]、[[roadmap-0001-datapack-management]]、[[registry-saves-00-index]]、[[01-registry-plan]]、[[02-save-plan]]、[[03-rollout-and-acceptance]]

### 商店与卡池

- Spot 商店的完整 `ShopOffer` union（role / upgrade / spot / affector / effect）、`refresh` 库存类型、实例物品货币。
- 卡池 banner ↔ 候选集解耦、声明式候选来源、基础池随 Init 扩充、限定池隔离、`refreshWorldPool` 去留。

原文：[[roadmap-0002-spot-shop]]、[[roadmap-0003-gacha-pool-model]]、[[adr-0007-shop-transaction-boundaries]]

### 角色拥有与成长

- Chara 拥有体系 Init 化（roster / characters / fragments 默认翻转 init），图鉴发现记录与当前拥有分离。
- 追赶统计项与追赶机制（pity 修正、权重倾斜、好感补偿）。
- 角色成长 B 段：`ProgressionEffectResolver`、单源 zone 注入、跨世界线 catch-up、Chara-Spot 消费者。
- 技能 / 装备写入口与 UI、Proto milestone effects 消费端。

原文：[[roadmap-0004-chara-ownership]]、[[adr-0008-character-progression-boundaries]]、[[task-0041-character-progression-and-memory]]、[[11-gear-equipment-system]]

### 强化揭示与服务权限

- 分离「资源观察状态 / 强化揭示状态 / 资源支付判定 / 服务能力状态」；修未观察青辉石时 GlobalEnh 可见性与 NotVisible 路径。

原文：[[roadmap-0007-enhancement-reveal]]

### UI / 主题表现层

- 编辑器专用背景可视化预览与预览画布、目标反向选择。
- 表现层调试视图（来源 / 顺序 / 透明度 / 忽略状态）。
- 主题编辑器信息架构重构（三层折叠、来源链与空值表达、局部刷新、可访问性、窄屏）。
- 控件背景完整四态接入与按钮 / Tab 的 Edge 视觉回归。
- 簇—区域深合并（图层、系统层开关、透明度、排序）与回归测试。
- 表现层旧路径收束（`presentation.layers` 迁移、`backgroundLayerOrder`、`panels` 透明度归一）。
- 历史硬编码组件背景清理、窄屏视觉回归。
- 主题色语义节点 CSS 渐进迁移；UI 更新调度第二阶段（Reveal 分类与最小 Region 映射）。

原文：[[roadmap-0006-ui-background-layering]]、[[roadmap-0009-theme-control-backgrounds]]、[[roadmap-0010-presentation-layer-service]]、[[roadmap-0011-ui-component-layer-backgrounds]]、[[roadmap-0012-flat-presentation-targets]]、[[roadmap-0014-theme-editor-convergence]]、[[roadmap-0016-cluster-region-context-overrides]]、[[roadmap-0017-theme-state-and-semantic-storage]]、[[task-0065-ui-presentation-residual-and-visual-regression]]、[[task-0066-theme-css-progressive-migration]]、[[task-0067-ui-update-dispatcher-stage2]]

### 服务 / 工作区

- 存档工作区（列表 / 详情 / 读写 / 新游戏确认 / 数据包环境差异 / 残留按 mod 清除）。
- 记录工作区（图鉴总览分类 + 统计按数据包贡献 / 世界线 / 标签筛选）。
- 数据包工作区完善（导入预览、启用集草案、Registry dry-run 与失败回滚、影响报告）。
- 统一体验验收（危险命令影响预览、草案拦截、跨服务返回栈、可访问性、失败恢复）。
- 通讯录 / 档案工作区完整内容；宿主接入全量落地（服务内部子宿主、服务筛选目标）。

原文：[[roadmap-0020-service-workspaces]]、[[roadmap-0018-ui-host-registry]]、[[task-0047-contacts-story-workspace-ownership]]、[[04-service-workspace-plan]]

### Lobby / Pre-Init

- Lobby 文案区分「当前世界线 / 全局内容」；服务权限守卫（禁止依赖当前 Init 的写入口）；浏览器级视觉验收。

原文：[[roadmap-0024-lobby-pre-init-runtime]]

### 由 Task 承载的其他未决方向

- 按钮序列统一接入 Host 的剩余部分：[[task-0030-button-rendering-convergence-solution]]
- PassiveStory P0/P1 与池分层权重：[[task-0032-passive-story-scheduling]]
- Affector / GameNum 性能整改：[[task-0034-affector-performance-review]]
- Condition Presentation Tree：[[task-0035-condition-presentation-tree]]
- 图层类型化参数面板：[[task-0054-user-theme-layer-type-aware-value-editor]]
- 运行时数据包编辑工作台：[[task-0055-runtime-datapack-editor-mvp]]、[[task-0056-workspace-datapack-boundary-convergence]]、[[task-0057-single-mod-editor-workbench]]
- 背包剩余能力（整理持久化、出售丢弃、来源筛选）：[[task-0068-inventory-workspace-remaining-capabilities]]
- 未裁定的设计草案：[[01-ownership-and-development]]、[[02-unified-acquisition]]、[[03-spot-shop]]、[[04-recruitment-v2]]、[[05-fragments-and-currency]]、[[06-meta-loop-and-ui]]、[[07-mvp-scope]]、[[16-runtime-datapack-authoring]]
- 运行时数据包创作方向（2026-09-15 全部暂停，是本轮清退后新一轮策划的起点）：
  - 已交付并归档：[[task-0075-spot-runtime-affector-editor-demo]]（Spot Affector 可变列表与持续资源 Demo）、[[task-0074-spot-affector-resource-convergence]]（Spot 产出统一收敛至 Affector）；
  - 已暂停（移入 `archive/`）：[[task-0072-runtime-mod-editor-authoring-spine]]（S0 / S1-A 已交付；S2 `revealTriggers` 递归条件组、S3 工作区持久化与导出未完成）、[[task-0073-spot-field-authoring-ladder]]（S1-B1 已交付；S1-B2 `tags`/`global`、S1-B3 引用字段未完成；S1-B4 已由 0075 以受限形态覆盖）、[[task-0071-runtime-editor-p0-capability-baseline]]（需求基线与 33 键能力台账，交付顺序已被 0072 取代）；
  - 相关设计来源：[[16-runtime-datapack-authoring]]、[[runtime-editor-overlay-sol-review]]、[[def-resolution-withdrawal-sol-review]]
  - 新一轮策划（2026-09-15 起）：[[task-0076-unified-def-editor-service]]（前台统一编辑器服务：Def 编辑构建接口 / 全宽承载 + 左侧 Switch 分页 / 子编辑弹窗；含 Spot 层级样例楼层设计与 B1–B5 内容阶梯；策划完成，待裁定与开工）
  - Init / Area / Enhancement 编辑态 CRUD（2026-09-17，已被重新收敛）：[[task-0087-init-area-enhancement-editor-crud]]（原三类 Definition 方案，因 candidate reload 与 Enhancement 范围过大而中断）
  - Init / Area 热 CRUD 与当前位置兜底（2026-09-17）：[[task-0088-init-area-hot-crud-and-location-fallback]]（当前实施任务；共享 Spot 编辑框架，不做 Enhancement）
  - 条件编辑器专项任务（2026-09-16）：[[task-0077-runtime-editor-condition-tree]]（条件树、AND/OR 点击切换、原子条件摘要与弹窗编辑；主体已落地，待浏览器验收）
  - 原子条件目标编辑器（2026-09-16）：[[task-0078-runtime-editor-condition-target-editors]]（目标驱动字段、引用候选、摘要与校验；P0/P1 已落地，P2 施工中）
  - Manager 旧语义删除（2026-09-16）：[[task-0079-chara-spot-link-retirement-and-redesign]]（删除旧 Manager 状态、条件、Effect、事件与兼容路径；不涉及新的 Chara—Spot 关系设计）
  - Spot 默认支付退役（2026-09-16，已完成并归档）：[[task-0081-spot-payment-default-removal]]（删除 `baseCost` / `baseCostResource` 与升级旧价格回退，所有 Spot 解锁 / 升级改由显式价格组声明）
  - Runtime Editor 非法条目注记（2026-09-16，已完成并归档）：[[task-0082-runtime-editor-invalid-entry-annotations]]（为 Spot 集合条目与所属 Switch 增加轻量问题注记；不做调用链追踪）
  - 数据包加载策略持久化与启动自动恢复（2026-09-16，已完成并归档）：[[task-0083-datapack-load-policy-persistence-and-startup-restore]]（应用启用集后持久化，启动时自动恢复并加载已启用数据包）
  - Spot 价格传导链与初始价格可编辑性（2026-09-16，已完成并归档）：[[task-0084-spot-price-propagation-and-runtime-editability]]（RuntimeEditor 仅处理 Spot 默认价格 / 条件组，Affector 追加价格另立系统）
  - Def 审计时间元数据与无时间内容兼容（2026-09-16，已完成并归档）：[[task-0085-def-audit-metadata-and-missing-time-ordering]]（统一创建 / 修改时间，并在 Registry 中将缺失时间视为极早值）

## 本轮冻结归档（2026-09-25）

- [[task-0155-active-work-documents-freeze]]：本轮盘点、核验与归档执行记录（已完成）。
- [[active-work-freeze-2026-09-25]]：31 份工作文档（8 Draft、23 Task）的逐项摘要、最后已知进展与待续边界。
- 该次冻结后的新工作入口见上方「当前推进」；归档保留各文档冻结前的状态，不代表全部完成。

## 相关路由

- 最近完成：[[task-0151-milestone-persistent-arrival-facts-p0]]（Save-scope Persistent Arrival Fact；P0-A–D 与 5 个 Patch Unit 完成，39 项定向回归通过，2026-09-25）、[[task-0149-information-reveal-runtime-lifecycle]]（Information Reveal 的 Init、读档、重置与热内容对账，194 文件 / 1777 测试通过，2026-09-25）、[[task-0148-information-reveal-adapter-v1]]（Save Progress、Reveal 域与 EB-T Adapter，2026-09-25）、[[task-0146-reveal-domain-model-v1]]（Information Reveal v1 领域事实、Scope、prerequisite 与 WakePlan 裁定；仅设计与源码核验，2026-09-25）、[[task-0145-reveal-condition-event-coverage-audit]]（Reveal Condition / Event 覆盖只读审计，17 个目标矩阵、activation/invalidation 分析与首期建议，2026-09-24）、[[task-0144-trigger-runtime-registration-withdrawal]]（Trigger Runtime Registration & Withdrawal，188 files / 1748 tests 通过，2026-09-24）、[[task-0133-ui-refresh-repair-slices]]（依据 task-0132 逐切片完成 UI 刷新、焦点/滚动连续性与 Tabs 语义修复，2026-09-20 完成）、[[task-0132-ui-refresh-and-structural-density-audit]]（四 Workstream 多 agent 只读审计完成，2026-09-20 完成）、[[task-0130-runtime-editor-codex-def-inspector-plan]]（超级图鉴 Def 概览、关系与原始数据详览，2026-09-20 完成）。
- 本轮归档：[[task-0154-goalset-discussion-to-execution-workflow]]、[[task-0153-milestone-listener-admission-and-reactive-coverage-audit]]、[[task-0151-milestone-persistent-arrival-facts-p0]]、[[task-0150-aoci-governance-and-runtime-alignment]]、[[task-0149-information-reveal-runtime-lifecycle]]、[[task-0148-information-reveal-adapter-v1]]、[[task-0146-reveal-domain-model-v1]]、[[task-0145-reveal-condition-event-coverage-audit]]、[[task-0144-trigger-runtime-registration-withdrawal]]、[[task-0141-document-workflow-simplification]]、[[task-0087-init-area-enhancement-editor-crud]]（由 0088 取代）、[[task-0096-panel-granular-refresh-api-and-hover-continuity]]、[[task-0097-entity-presentation-content-selection]]、[[task-0128-runtime-editor-loaded-content-codex]]、[[task-0129-runtime-editor-codex-workspace-optimization]]。
- 最近完成的计划：[[task-0119-runtime-editor-base-full-export]]、[[task-0118-datapack-editing-creation-target-indicator]]、[[task-0117-datapack-editing-visible-label]]、[[task-0116-datapack-editing-active-gold-theme-token]]、[[task-0115-datapack-editing-active-gold-state]]、[[task-0114-datapack-edit-entry-and-apply-gate]]、[[task-0113-datapack-pane-control-density]]、[[task-0112-datapack-pane-group-order-and-mode-switch]]、[[task-0111-datapack-pane-slots-selection-and-atomic-apply]]、[[task-0110-datapack-editing-state-and-targeted-authoring]]、[[task-0107-runtime-editor-pack-export-service]]、[[task-0106-runtime-editor-draft-persistence]]、[[task-0105-init-selector-invalid-worldtilt-compatibility]]、[[task-0101-external-refresh-hover-race-and-invalidation]]、[[task-0102-entity-theme-immediate-refresh]]、[[task-0085-def-audit-metadata-and-missing-time-ordering]]、[[task-0084-spot-price-propagation-and-runtime-editability]]、[[task-0083-datapack-load-policy-persistence-and-startup-restore]]、[[task-0082-runtime-editor-invalid-entry-annotations]]、[[task-0081-spot-payment-default-removal]]、[[task-0075-spot-runtime-affector-editor-demo]]、[[task-0074-spot-affector-resource-convergence]]
- 最近一次清退（2026-09-15，暂停移入 `archive/`）：[[task-0071-runtime-editor-p0-capability-baseline]]、[[task-0072-runtime-mod-editor-authoring-spine]]、[[task-0073-spot-field-authoring-ladder]]
- [[docs/docs-829/00-INDEX]]（当前文档入口）
- [[docs/docs-829/05-conventions/architecture-discipline]]（当前架构约束）
- [[docs/docs-829/05-conventions/doc-maintenance]]（文档维护与归档规则）
- [[docs/plan-work/mechanisms/00-index]]（按机制的反向索引）
