# 研究报告：Agent 的测试、检验与开发证据需求

日期：2026-09-26

## 结论与取舍

项目已经具备若干有价值的诊断底座：只读 GameView、当前有效内容图鉴、GameNum contribution、DevLog、UI refresh stats/observations、Workspace/Host 元数据和静态调用图。缺口主要是统一的查询边界、完整性声明、结果与运行过程关联，以及可重复执行的场景和证据交付。

建议把“快速提供界面构成/逻辑运算的结果—切片—log”定义为一条有界证据链：先回答结果，再局部展开来源/差异，需要时查看实际轨迹。首期复用现有能力；不先建设通用浏览器代理、全状态录制器或第二套计算引擎。阶段地图见 [[gs-20260926-agent-observability-set]]。

## Agent 实际需求矩阵

| 工作类型 | Agent 需要回答 | 最小输入 | 应交付的切片 / 证据 | 不能据此声称 |
| --- | --- | --- | --- | --- |
| 开发定位 | 该界面区域是谁渲染、消费什么？ | route + Host/实体 | Workspace/Host、实际挂载节点、View/定义来源及源码候选 | 静态候选链就是本次执行链 |
| UI数值回归 | 数字是否更新，是否重建了卡片？ | 单次资源/Spot操作 | 原始值、显示值、节点身份、refresh前后差异 | 数字正确意味着布局正确 |
| 主题与转场 | 旧图层为什么残留/新图层为何缺失？ | 主题 + 转场步骤 | model→resolved→DOM/CSS→截图四层对照，含body浮层 | 局部重绘计数证明像素正确 |
| 交互连续性 | focus/scroll/hover 是否被刷新打断？ | 当前锚点 + 操作 | 节点身份、焦点/选区、scroll owner、popover前后状态 | happy-dom覆盖真实指针与绘制 |
| 逻辑单测 | 数值为何是这个值？ | 状态 + 内容 + 表达式 | 运算树、实际输入、贡献来源、cache/recompute模式 | 当前重算就是历史结算 |
| 拒绝边界 | 为何不能买/触发/Apply？ | 命令 + 前置状态 | 稳定拒绝码、条件叶/缺口、前后无副作用证据 | 一条错误文案证明原子性 |
| 事件联动 | 没注册、没唤醒还是提交失败？ | event/operation/实体 | 注册资格、候选、匹配、条件、once、commit轨迹 | 日志里没有就一定没发生 |
| 生命周期回归 | 读档/切Init/热内容后投影是否陈旧？ | 固定内容 + 生命周期步骤 | generation/revision、当前领域事实与派生监听/缓存差异 | 旧索引快照证明当前监听有效 |
| 编辑器检验 | Draft、Applied和Runtime是否一致？ | packRecordId + revision + 字段路径 | source/draft/applied区分、诊断与提交结果、目标UI差异 | 导出成功意味着Runtime已应用 |
| 确定性复现 | 下一位Agent能否重现？ | fixture + seed/clock + commands | 每步结果、规范化摘要、失败前后切片 | 只固定抽卡seed就控制全部随机源 |
| 浏览器冒烟 | 真实页面能否完成操作且无可见错误？ | 场景 + 浏览器/视口 | 截图、DOM断言、console/page error、加载就绪证据 | 截图存在即视觉通过 |
| 性能验证 | 改动是否减少真实成本？ | 同环境/规模/场景 | 耗时样本、分配/DOM指标、浏览器profile（按需） | callgraph fan-in或render次数即性能瓶颈 |
| 小模型交接 | 这次到底做了/验证了什么？ | Unit + runId | 事实路径、实际命令/退出码、失败摘录、产物链接、未验项 | 测试文件存在或旧报告就是本次通过 |

## 当前源码基线

以下为静态源码/测试阅读证据，不是本次测试运行结果。行号是本轮定位快照，后续以符号为准。

| 现有能力 | 已核对证据 | 对规划的约束 |
| --- | --- | --- |
| 游戏调试对象入口 | `src/ui/main.ts:44-48` 将 Runtime 与 Controller 暴露为 window.__game / window.__ui | 当前有入口，但它暴露的是实现对象，不是稳定、有界、只读的 Agent 协议；不能据此新增任意对象写入工具 |
| 只读视图与查询 | `src/arona-clicker/contracts/runtime.ts` 的 GameReadModel/getView/getDevLogs；`src/arona-clicker/read-model/game-view-builder.ts` | 优先从既有查询面适配，持久状态权威不迁移到诊断包 |
| 当前有效内容图鉴 | `src/data-services/contracts/runtime-content-browser.ts` 的 listDefinitions 等查询契约 | 可复用定义/引用切片；不把包库和编辑草稿混写为当前Runtime内容 |
| UI刷新观测 | `src/ui/controller.ts:136-157,624-630,1230-1242,1314-1324` | 计数覆盖full/panel/light/theme/workspace/region/element/behavior/drop；最近200条观察有scope/reason/surfaceKey/generation/outcome，缺少统一操作ID和具体目标信息 |
| Surface与局部更新 | `src/ui/update/ui-update-types.ts`、`ui-update-dispatcher.ts`、`ui-surface.ts` | 当前已有behavior/element/region/structure、合并和stale丢弃；不得新增旁路刷新管线 |
| UI构成骨架 | `src/ui/components/workspace-frame.ts:10-36,55-72`；`src/ui/ui-host-registry.ts` 的 UIHostRegistry | Workspace/slot/role/scroll与Host层级可复用；Host树是表现目标索引，不等于完整语义组件树或真实DOM树 |
| 静态调用图 | `scripts/ui-callgraph.mjs` 的 summary/chains/dom/reverse/forward/hot/JSON输出 | 语法近似、弱边需标记；JSON是生成报告，会写输出文件，不是运行轨迹或profiler |
| 展示日志 | `src/engine/core/dev-log.ts:8-18,27-68,71-191` | 默认80条、verbose默认20000条；部分事件不记录、正资源变化默认不记、普通tick每30帧汇总；现有字段无完整因果契约 |
| 生产贡献树 | `src/engine/expression/game-num.ts:247-255`；`game-num-eval.ts:171-244` | 已有id/kind/value/children，zone/flow为聚合叶；不能声称已有每个来源的详细贡献 |
| 条件与值求值 | `src/engine/expression/condition-system.ts` 的 evaluateExpr/evaluateGroup；`value-system.ts` 的 evaluate/evaluateValue | 主要返回boolean/number；没有现成统一的逐叶actual/expected与短路轨迹，unknown/fallback必须显式解释 |
| Trigger监听 | `src/engine/effect/trigger-system.ts` 的 register/withdraw/onEvent/getDefinitionsSnapshot | Definition快照与Registration不是同一对象；候选token、once和condition检查发生在运行路径，目前不形成完整机器轨迹 |
| 领域诊断 | `src/arona-clicker/services/milestone-adapter.ts`；`information-reveal-adapter.ts` | 局部unsupported/失败日志可复用；各领域观察能力不齐，不能包装成“全机制支持” |
| 手动推进 | `src/arona-clicker/runtime-game-instance.ts:331-370` 的 tick/start/stop；`src/engine/runtime/session-service.ts` | tick入口存在但Date.now/离线补算与自动循环仍需独立控制；停止tick不等于冻结浏览器 |
| 自动测试 | `vitest.config.ts:3-8`；`tests/setup.ts:1-14` | 默认Node，提供localStorage shim；某些UI测试以文件注释选happy-dom |
| 可复用场景模式 | `tests/ui/workspace-lifecycle.test.ts`、`tests/ui/chat-typing.test.ts`、`tests/engine/game-num-snapshot.test.ts`、`tests/engine/gacha-service.test.ts`、`tests/engine/story-test-fixtures.ts` | 已有节点/焦点/滚动断言、fake timers、合成fixture、seeded RNG、有界剧情推进；不需要起步就新造一套测试DSL |
| 浏览器验证入口 | `package.json` 的scripts与依赖中未登记专门E2E runner | 只能确认仓库登记面的缺口；不能推断用户没有外部浏览器流程，也不证明本机依赖已安装 |

## 三个需显式处理的可信性问题

1. **GameNum分解会触及缓存**：evaluateWithBreakdown先走this.evaluate，再独立生成无缓存贡献树。evaluateGameNum默认会写cached并清dirty。故“查询不写PlayerState”不足以证明诊断无扰动；观察缓存失效问题时，直接调用它可能改变待观察事实。
2. **解释语义已有边界差异**：game-num-eval.ts正常mul空children的reduce初值为1；breakdown空children分支返回0。此为静态代码差异，本轮未跑复现测试，也未证明生产内容可达；接入统一解释前需独立回归修复。不能以已有breakdown API推定所有边界一致。
3. **事件观察顺序不等于因果顺序**：event-bus.ts:47-80在非flushing时同步dispatch，先typed handlers再wildcard；父typed handler若emit子事件，onAny可能先观察子事件再观察父事件。真实因果需要dispatch入口身份/相位和parent关联，不能按日志时间戳猜父子，更不能为方便记录改成异步总线。

## 建议的证据包契约（待 Draft 裁定）

| 层 | 建议字段 / 语义 |
| --- | --- |
| 身份 | schemaVersion、runId、captureId、scenarioId/operationId；代码commit及dirty事实、内容摘要/revision、环境标识；无法取得时为unknown，不生成伪精确值 |
| 采集边界 | frame/采集序号、各层时刻、surface key/generation、clock模式；一致性取stable-boundary/mixed/unknown并解释依据 |
| 目标 | entity/definition/field path、workspace/Host/region、可定位DOM实例；定义与挂载实例身份分开 |
| 结果 | status、raw value与display value、unit/scope、source；outcome区分pass/fail/unknown/unsupported/not-captured |
| 切片 | parent/children或来源引用、before/after/diff、过滤器与深度/节点预算、实际返回量和omitted数量 |
| 轨迹 | sequence、phase、parentCause、实际输入/判断/拒绝/commit outcome、记录起止范围；observed与recomputed分离 |
| 完整性 | truncated、sampled、dropped、旧generation/源版本不匹配；分页续读绑定同一capture，不悄悄拼接不同运行时刻 |
| 验证 | 实际命令、exit code、用例与断言、expected/actual、未执行原因；测试/视觉/性能各自结论 |
| 产物 | summary.json、按需的slice.json/trace.ndjson、场景输入、截图和report；manifest指向实际存在的文件，避免stdout倾倒全部详情 |

G01不需要立即实现所有字段或产物。最小统一身份、证据类型、一致性和完整性先确定，后续Goal按需扩展；unsupported比伪造空快照可靠。版本字段只用于拒绝不匹配诊断包，不引入存档迁移或旧格式兼容层。

Live capture与sandbox execution必须显式区分。持续运行时不承诺跨游戏、UI和截图天然原子；需要在既有稳定边界采集，或报告各层时间与混合状态。日志/切片截断必须可见，不能由“未返回”推出业务上的“不存在”。

## 代表验收场景

| 场景 | 预期独立结果 | 证据与拒绝边界 |
| --- | --- | --- |
| S01 Spot升级后下一tick产出变化 | 费用/等级/资源结果正确，界面数字对应 | 前后状态、GameNum结果/来源、事件与DOM切片；同输入观测开关对照 |
| S02 资源不足或过期revision | 命令被拒绝且无部分提交 | 拒绝码、余额/统计/事件不变；Runtime Editor相关范围按后续准入 |
| S03 Condition AND/OR与fallback | 结果与正常求值一致，短路叶可辨 | actual/expected、未求值标签、空组/空乘法边界 |
| S04 资源事件→领域Watch→完成事实 | 可定位唤醒、复验、一次提交、撤出 | cause/Registration token/commit；未注册、已完成与日志缺失可区分 |
| S05 高频数字刷新与局部region更新 | 保留既有节点、焦点、滚动及无关hover | 节点identity、刷新计数/目标、实际DOM断言 |
| S06 路由切换后的旧更新 | stale-surface更新不落到新页面 | 前后generation、请求丢弃原因、新页面无污染 |
| S07 额外图层主题↔一般主题与多页面转场 | 正确图层生效/撤出，无旧浮层残留 | model→resolved→body/#app/host DOM/CSS→真实截图；关联Task-0158，当前尚未复现 |
| S08 同seed/clock场景重跑与生命周期重建 | 规范化结果一致，旧监听/缓存不串场 | 输入身份、随机源覆盖、reset/重建清理；未控源标nondeterministic |

初始调研曾建议G01抽取S01当前结果、S05 UI骨架和操作窗口日志；后续因浏览器连接不稳定，实施顺序调整为G01只交付操作后状态与现存DevLog。S05 UI骨架、stale surface、交互连续性和主题转场归入暂缓的G02/G05浏览器验收。完整S01–S08不是首期全部实施义务。

## 交付顺序与成本评价

- 新顺序：G01操作后状态结果切片 → G04隔离逻辑场景 → G03选定逻辑解释 → G05非浏览器证据包 → G02 DOM/theme最终渲染切片 → G05浏览器验收。
- G01：先对一个受支持操作提供操作前后状态、结果与有界DevLog；不要求Workspace/Host或DOM，也不以MCP包装为开工前提。
- G04/G03：先建立可重复的非浏览器逻辑场景，再对选定路径补充解释和因果证据。
- G02与G05浏览器部分：ChatGPT Desktop浏览器连接稳定后恢复；实际最终DOM/theme内容切片需真实浏览器证据，不能由headless逻辑状态替代。
- G05：先交付非浏览器场景命令与失败包，再补真实浏览器证据；只有重复失败模式值得长期固化为协议或工具。
- “快速”用实测衡量：首次拿到相关证据的时间、查询次数、输出字节/估计token、场景重跑耗时、Luna交接所需附加文件量；先采当前手工流程基线，不能虚构提升比例。
- 默认关闭连续详细trace；按操作窗口启用且有条数/字节/时间限制。测关闭、摘要和详细三档的业务等价性与开销，再定性能阈值。

## Luna 分工与核验记录

| 分题 | 实际工作 | 结论边界 |
| --- | --- | --- |
| ui_needs（Luna） | 阅读UI构成、刷新、Host、Surface、代表UI测试、callgraph与Task-0158 | 静态事实与规划建议；未打开浏览器、未改文件、未执行测试 |
| logic_needs（Luna） | 阅读DevLog、EventBus、GameNum、Condition/Value、Trigger与领域Adapter及代表测试 | 核实缓存触及/空mul差异/嵌套日志顺序；未运行复现或修复 |
| workflow_needs（Luna） | 阅读Vitest配置、setup、fixture/fake timer/RNG与工程协议 | 给出headless与真实浏览器证据差距；安装状态和当前测试通过率未知 |
| 主Agent | 复核关键源码、修正调试入口遗漏、合并需求和阶段验收 | main.ts确有__game/__ui；这不等于稳定只读Agent API。未把子报告的初步遗漏写成最终事实 |

AOCI：本轮完整交付41块、804条，Host交付已确认；严格Attestation提交遇到字段Schema错误而未完成，治理原本dirty/stale。索引仅作导航，上述结论绑定当前源码/测试阅读；不声称当前完整系统认知可靠。没有把AOCI成本或治理问题并入本Goal Set的施工范围。

本轮只对新增规划文档执行结构检查；游戏测试、类型检查、浏览器复现和性能基准均未执行，原因是没有修改业务实现。正式实施前按所选Goal的准入再次核对源码及环境。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/game-num]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/PROJECT-CONSTITUTION]] · [[docs/ai/goal-workflow]]
