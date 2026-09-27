# Draft：Agent 观测工程 G01 — 操作后状态结果切片

状态：draft — G01 首个操作结果切片已形成 Task；更广查询能力继续留待后续阶段

## 目标与最终方向

为开发 Agent 建立一个有界的操作后结果入口：对一个受支持操作返回操作结果、操作前后状态差异、来源、采集身份和完整性；需要时再展开目标字段和相关现存运行日志。首期不采集 DOM/theme，也不依赖浏览器连接。

目标是快速判断“操作后变成什么、哪些状态发生变化、结果证据完整到哪里”。实际记录、操作结果、当前状态读取、静态源码资料和隔离重算必须各自注明来源，不拼成看似原子或完整的历史快照。

本阶段属于 Agent 观测工程的首个讨论切片；本 Draft 独立说明目标、范围与准入条件。阶段准入以本 Draft 与正式 Task 为准。

## 本阶段语义与边界

- 已裁定：首期限定受支持操作、目标字段和现存 DevLog。入口只接受明确操作/目标身份、投影模式、字段选择与预算；未知目标、过期身份、超预算和不支持来源返回结构化状态。
- 已裁定：结果是面向 Agent 的 JSON-safe 派生 DTO，不返回 `GameInstance`、完整 `GameReadModel`、可变 `PlayerState`、服务对象、任意命令或编辑 Draft。
- 已裁定：不把来源接口名的 `Query` / `ReadModel` 当成无副作用证明。GameNum 正常 evaluate 可修改缓存；GameView 也含嵌套引用例外。严格只读能力须复用已记录结果或在已隔离副本上验证，不得偷偷改变正在观察的业务状态。
- 已裁定：首期从 Runtime/操作结果与 DevLog 分源采集，再由受控适配层组装 envelope。采集时刻不同则逐层报告时刻与 `stable-boundary` / `mixed` / `unknown`；不建立跨运行时与浏览器 DOM 的全局锁。UI/DOM provider 延后到 G02。
- 已裁定：默认只输出有界摘要，展开采用绑定同一 capture 身份的分页或细节请求。每份结果报告源级容量、returned、omitted、truncated、dropped 与不确定原因。预算暂建议摘要 8 KiB、每页详情 64 KiB，待实测裁定。
- 明确暂缓：实时因果 Trace、任意 DSL 步骤树、时间旅行/回放、任意命令执行、网络/MCP控制服务、完整浏览器像素采集。后续阶段另立 Draft/Task。
- 明确暂缓：Workspace/Host 与 refresh ring 查询、DOM/theme 最终渲染切片、截图和浏览器验收。ChatGPT Desktop 浏览器连接稳定后恢复 G02；不以当前 View 或静态 Host 元数据代替最终渲染证据。
- 明确暂缓：直接修改 `GameReadModel` 或 AOCI；现有接口适合作为适配输入，但是否向调用方开放仍须通过窄 DTO 确定。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| Runtime 已有哪些查询入口？ | `src/arona-clicker/contracts/runtime.ts` 的 `GameReadModel` 暴露 `getView()`、`getDevLogs()`、`gameNumSystem`、`spot`、`runtimeContentBrowser` 等；`src/arona-clicker/runtime-game-instance.ts` 提供实际运行实现。`AronaClickerRuntime` 还承载包库读写与草稿能力。 | 可复用目标型查询，但不可将 `AronaClickerRuntime` 实例直接作为 Agent API。包库/编辑 Draft 与当前有效 Registry 必须分清。 | 已核实 |
| GameView 是否足以直接安全序列化？ | `src/arona-clicker/read-model/game-view-builder.ts` 复制多数 Map 化对象/数组；active Affector 的 `activeEntryIdSet` 未复制，`currentStory.page.kizuna` 可保留 Registry 嵌套引用；类型未冻结。 | 需要显式 DTO 投影、白名单字段和安全限额；禁止直接把原 View 暴露或 JSON.stringify。 | 已核实 |
| Spot/资源样例可以取什么？ | `src/engine/contracts/game-num-query.ts` 有资源/Spot收益查询；`src/arona-clicker/contracts/spot-query.ts` 可查询等级上限/支付选项；`tests/engine/game-num-snapshot.test.ts` 已有确定 fixture。 | 能构造 G01 第一个样例，但求值缓存影响必须裁定；展示结果需写 recomputed 或 recorded。 | 已核实，纯读性待核对 |
| 数值分解能否直接做证据？ | `src/engine/expression/game-num.ts` 的 `evaluateWithBreakdown` 先正常 `evaluate` 后展开；`game-num-eval.ts` 正常求值写 `cached/dirty`。空 mul 的正常求值和 breakdown 返回值不同，代表测试未覆盖该边界。 | 当前 breakdown 不满足无扰动查询门槛；先用已有 snapshot 结果或隔离计算方案。空 mul 差异另列定向修复与回归，不混入无证据“只读”承诺。 | 已核实，需单独验证可达性 |
| Workspace/Host 可以从 Runtime 图鉴得到吗？ | `src/data-services/contracts/runtime-content-browser.ts` 查询有效 Def/关系；`src/ui/ui-host-registry.ts` 提供静态 Host 元数据；`src/ui/controller.ts` 暴露刷新计数及最近最多200条刷新观察。 | 这部分不进入 G01。Runtime 图鉴不是 DOM，Host 实际挂载和最终 theme/content 渲染属于 G02，待浏览器连接稳定后施工与验收。 | 已核实；延期 |
| 日志和刷新观察代表什么？ | `src/engine/core/dev-log.ts` 默认最多80条，verbose默认最多20000条；`src/ui/controller.ts` refresh observation 环最多200条。DevLog 与 UI observation 没有共享 operation/capture ID。 | 首期只附现存 DevLog；只能叫“现存记录”，不能把时间接近当因果关联，也不能从缺失记录断言事件没发生。UI refresh observation 随 G02 延期。 | 已核实 |
| 多源采集是否原子？ | Runtime 快照、DevLog、UI refresh observation 分属独立对象；Surface generation 仅校验 UI 当前挂载，非全局锁。 | G01 envelope 逐源报告 frame/time 与一致性；无法证明稳定窗口时为 mixed/unknown。UI generation 留到 G02。 | 已核实 |
| 安全有界的对象展开可复用什么？ | `src/ui/runtime-editor/codex-details/field-tree.ts` 按字段树限制12层/2000节点、不调用 getter并标循环/访问器；它不限制单值字符串和最终JSON字节。 | 复用只读 descriptor / 截断理念，新增字段/字符串/总字节上限；Proxy trap 错误须捕获为诊断。 | 已核实 |
| 三类样例的测试底座如何？ | GameNum snapshot fixture、DevLog测试和 `tests/ui/workspace-lifecycle.test.ts` 分别覆盖数值、日志上限和部分UI局部刷新。 | 可复用，但测试存在不代表这次运行通过；UI Host切片没有通用查询；无项目登记的浏览器E2E runner。 | 已核实，安装/执行状态未知 |
| query组合层放在哪里？ | `GameReadModel` 面向 UI 读取且 Runtime 本体比契约更宽；UI Refresh 数据来自 `UIController`。二者不在同一层。 | 首期候选为应用层 adapter 消费受限 Runtime/操作结果和 DevLog；UI诊断端口延至 G02。确切路径/生命周期/公开契约还要架构复核，不能将UI类型下沉至Engine/Data Services。 | 待裁定 |
| 默认预算与一致性 fence 如何实现？ | 现有日志/对象数上限不等于JSON字节硬限额；runtime content browser revision 与UI generation作用域不同。 | 8 KiB摘要/64 KiB详情只是待校准目标；计数用UTF-8字节，不能假设已有共同revision。 | 待实测/裁定 |

## 建议的首期查询结果

请求指定受支持操作/目标、字段投影和预算，不接受任意表达式、条件、任意路径深遍历、任意函数或命令：

```json
{
  "target": { "kind": "spot", "id": "base:spot:credit_printer" },
  "operation": { "kind": "supported-operation", "id": "…" },
  "include": ["before-state", "operation-result", "after-state", "devlog"],
  "budget": { "maxBytes": 8192, "maxDepth": 4, "maxItems": 100 }
}
```

回应采用统一 envelope，但前后状态、操作结果和 DevLog 可有不同采集时刻与完整性：

```json
{
  "schemaVersion": 1,
  "captureId": "…",
  "target": { "kind": "spot", "id": "base:spot:credit_printer" },
  "sources": [{ "kind": "runtime-state", "revision": "unknown", "frame": 42, "status": "captured" }],
  "consistency": { "level": "unknown", "reason": "no-shared-capture-fence" },
  "completeness": { "truncated": false, "omitted": 0, "dropped": 0 },
  "result": {}
}
```

以上字段名是讨论形状，不是冻结协议。`frame`、source revision、operation/capture ID 无可靠证据时显式为 unknown/null 并带原因；不能按时间接近推断 DevLog 与操作有关。`result` 不含任意对象实例；Set/Map/函数/循环/访问器经白名单投影、稳定排序或报告unsupported。每次展开必须绑定captureId且不悄悄刷新不同快照。

## 首期及延期的 Input → Result

1. **操作后状态结果（首期）**：输入受支持操作和稳定目标 ID；输出操作结果、操作前后目标字段、差异、来源与 frame。读取不得重放操作；如果结果只能通过会更新缓存的 evaluate 得到，则标记 `unsupported-side-effect-risk` 或使用经验证的隔离副本。
2. **操作窗口内现存 DevLog（首期）**：输入窗口/记录标识与 limit；输出来源容量、保留范围、returned/omitted/dropped。无共享 operation ID 时关联字段为 `unlinked`，不推断因果。
3. **Workspace/Host 与最终 theme/DOM 内容（延期至 G02）**：浏览器连接稳定后，输入操作或 surface 身份；输出最终应用的 theme、实际内容切片及缺失/多出/旧内容残留。静态 Host 注册或 GameView 不作为最终渲染证据。

首期不记录新的全局 trace。G01 → G04 → G03 → G05（非浏览器证据）先行；G02 的最终 DOM/theme 切片及 G05 浏览器验收待 ChatGPT Desktop 浏览器连接稳定后恢复。

## 裁定记录

| 待裁定问题 | SolChat 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| 聚合层应放哪里、是否加公共GameReadModel接口？ | 未进行Sol讨论。Luna和本地核对建议在应用层窄适配，分源采集，不把宽Runtime对象公开。 | 首期只接操作结果/Runtime 与 DevLog；UI/DOM provider 延后。确切模块与合同待架构Read Set复核，先不写Runtime/Engine新公共API。 | UI与Runtime职责边界、引用事实；正式ADR非必要时不立。 |
| 8 KiB / 64 KiB预算是否为强门槛？ | 未讨论。研究报告建议将它们作为工程目标。 | 暂作为待测默认建议，不是验收硬门槛；以fixture测得摘要字节和截断行为后裁定。 | 字段规模、字符串上限、分页；没有实测性能结论。 |
| 是否允许计算GameNum以快速回答当前值？ | 未讨论。只读调查发现GameNum评估会写缓存。 | 不允许把当前路径称为严格只读。优先已记录/已算结果；需要重算须在可证明隔离环境执行并标明recomputed。 | 具体隔离方案和对照测试待核对。 |

## Draft → Task 准入

- [x] 本阶段终点、暂缓项和首期操作样例已有初稿。
- [x] 操作结果与Runtime/DevLog聚合层限定在 `GameCommands.upgradeSpot()` 命令边界；不等待Runtime/UI provider统一。
- [x] capture一致性定义为命令同步调用窗口；日志标记为窗口内观察项，无法确认共同来源时不声称逐项因果。
- [x] 首期使用固定字段操作 DTO，不序列化整个GameView/PlayerState；最终 JSON UTF-8 单条上限 8 KiB，超限显式截断。
- [x] 观察器只复制状态与读取已有返回/日志，不额外求值；GameNum重算不进入默认能力。
- [x] 首期样例指定为Spot升级成功、资源不足与NotFound拒绝；Read Set、定向测试命令和两Patch Unit已登记在Task-0160。
- [ ] 已说明完成G01后G04/G03/G05非浏览器部分仍未完成；G02与G05浏览器验收暂缓。

## 下一步

1. 将首期施工基线限定为“操作前后状态结果 + 现存 DevLog + 明确采集边界”，不加入 DOM/theme。
2. 只核验会改变该基线的源码路径和状态采集边界，不以全仓扫描代替问题核验。
3. 先解决或限定G01所需的GameNum只读语义；当前 `evaluateWithBreakdown`缓存副作用和空mul分解差异属于明确风险，但空mul是否运行时可达尚未核实。
4. G01首个实施Task为 [[task-0160-agent-operation-result-slice]]，只捕获经公开 `upgradeSpot` 命令的一个代表性操作。
5. 后续顺序为 G04 隔离逻辑场景 → G03 选定逻辑解释 → G05 非浏览器证据；浏览器连接稳定后恢复 G02，并补做 G05 浏览器验收。
6. 本次未修改业务实现、未运行测试/类型检查/浏览器；上文测试文件仅表示已有用例可供复用。G02恢复门槛是浏览器连接可以稳定执行目标转场并读取最终 DOM/theme 切片。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/game-num]] · [[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/ai/task-read-set-routing]] · [[docs/ai/PROJECT-CONSTITUTION]]
