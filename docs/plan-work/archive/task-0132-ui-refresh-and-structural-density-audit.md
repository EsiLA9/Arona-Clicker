# Task：UI 刷新链与结构密度审计

状态：done — 2026-09-20 四个 Workstream 完成只读审计；后续修复边界已拆分建议，未修改实现

执行模式：`read-only audit`

## 目标

系统查询游戏内 UI 中由设计方案、事件订阅、scroll / click 交互或 Runtime Editor 操作引起的：

1. DOM 全量刷新、重复刷新和可避免的结构刷新；
2. scroll、focus、hover、Popover、选中项和查看栈被刷新打断的问题；
3. 过多描述性、装饰性 wrapper、重复 label、冗余状态节点和无真实语义的布局层；
4. `frontend-design` 生成式设计与本项目局部刷新、只读 UI、表现宿主边界之间的冲突。

本 Task 的产物只有可证据追踪的问题台账、优先级和后续实现 Task / Patch Unit 建议。源码、测试、配置、通用协议和现有任务正文均为只读；除本 Task 自身的审计记录、最终结论和必要的 `00-index.md` 状态同步外，不修改任何实现或规则。

## 当前事实与边界

- 当前 UI 事实以 `src/ui/`、`tests/ui/` 和 [[docs/docs-828/02-modules/ui]] 为准。
- 刷新链和既有修复基线见 [[docs/docs-828/07-audit/dom-refresh-chains]]；已完成的 Panel / Region / Popover 能力不能重复立项，必须区分回归、遗漏和新问题。
- UI 必须遵守 [[docs/docs-828/05-conventions/architecture-discipline]] 的只读纪律。
- 设计施工必须遵守 [[../ai/frontend-design-project-overlay]] 的 DOM budget、刷新等级和交互连续性要求。
- 本 Task 只调查游戏内 UI `src/ui/`；`tools/datapack-editor/` 不在范围内，除非后续另立独立 Task。

## 并行协作模型

各子 agent 只负责自己的 Workstream 和 Allowed Scope；所有 Allowed Scope 均为只读调查范围，不是可写文件清单。不得修改业务源码、测试、配置、协议或其他 Task，也不得互相覆盖结论。每个 Workstream 必须提交结构化问题记录，不提交修复代码。

### Workstream A：刷新调用链与 full render 入口

调查 `render()`、`innerHTML`、`outerHTML`、panel / region 替换、事件订阅、Tick fallback 和 Runtime Editor 批量提交。

重点回答：

- 哪些入口在 behavior 可覆盖时仍触发 region / structure；
- 哪些事件在一次用户动作中触发多次刷新；
- 是否存在 microtask / batch 合并缺口；
- 每条链的真实影响范围、频率和可观察证据。

Read-only Scope：`src/ui/controller*.ts`、`src/ui/update/**`、相关 Runtime Editor action / coordinator、对应 `tests/ui/**` 和诊断输出。只允许读取、运行检查和记录证据。

### Workstream B：交互连续性与 stale surface

调查 scroll、focus、hover、Popover、Tooltip、Modal、查看栈和异步过期请求在局部或全量替换后的状态连续性。

重点回答：

- 被替换范围是否精确关闭 Popover；
- 未被替换区域是否错误丢失 hover / focus / scroll；
- 旧 surface 是否可能向新 DOM 写回；
- 哪些问题需要浏览器级复现，哪些可以由单测证明。

Read-only Scope：`src/ui/popovers.ts`、`src/ui/modal*.ts`、`src/ui/update/**`、chat / log / shop / navigation 相关组件和 `tests/ui/**`。只允许读取、运行检查和记录证据。

### Workstream C：结构密度与装饰性 DOM 审计

调查组件模板、渲染器、CSS 和表现宿主中的无实际职责 wrapper、重复描述、仅为装饰存在的节点、过深嵌套和可以用 CSS 表达的结构。

重点回答：

- 每个疑似节点的唯一职责是什么；
- 删除或合并后是否影响布局、语义、ARIA、事件委托或主题宿主；
- 是否是视觉要求导致的结构膨胀，能否改为 CSS / token / 既有 host；
- 是否存在“同一信息由标题、label、helper text、badge 重复表达”的问题。

Read-only Scope：`src/ui/components/**`、`src/ui/renderers/**`、`src/ui/css/**`、PresentationHost / UI Host 相关文件、对应 UI 测试和渲染快照。只允许读取、运行检查和记录证据。

### Workstream D：frontend-design 施工协议与生成式反模式审计

调查当前 UI 设计任务、任务文档和组件实现中是否缺少 DOM budget、refresh scope、interaction preservation 等前置约束，并整理可被 skill / AGENTS / Task 模板直接消费的规则。

重点回答：

- 哪些通用设计建议在本项目中容易导致结构膨胀或刷新越级；
- 哪些约束应成为所有 UI Task 的必填字段；
- 哪些规则属于架构纪律，哪些只是建议，哪些应转成自动检查或测试；
- 是否需要为 `npm run ui:callgraph` 增加专项参数或报告字段。

Read-only Scope：`AGENTS.md`、`docs/ai/**`、`docs/plan-work/task-*.md` 中的 UI 任务、`package.json` 的 UI 检查脚本说明，以及必要的当前 UI 文档。只提出协议或 Task 模板变更，不直接写入；落地必须另立文档 Task。

## 协作交付格式

每个 Workstream 输出一份不超过 2 页的结果，使用以下字段：

```text
Finding ID:
Severity: P0 / P1 / P2 / P3
Location:
Trigger:
Observed DOM effect:
Interaction impact:
Evidence: callgraph / test / browser / code path
Expected refresh level: behavior / region / structure
Actual refresh level:
Likely cause:
Recommended next action:
Suggested follow-up Task or Patch Unit:
```

没有实际证据的问题标记为 `hypothesis`，不得写成已确认缺陷。历史审查记录只能作为线索，必须回到当前源码和测试核实。

## 主 agent 合并顺序

1. 先合并 A、B，建立刷新链与交互状态的共同事实；避免把同一条链重复计数。合并只写入本 Task 的审计台账。
2. 再合并 C，将结构密度问题映射到具体刷新范围和可访问性风险；删除纯装饰节点不能只按节点数量裁决。
3. 最后合并 D，把重复出现的根因抽象为协议、自动检查或后续 Task；不把一次性问题泛化成过度严格的规则。
4. 对每个 P0 / P1 问题提出唯一后续实现边界，明确 Allowed Files、Read Set、Completion Criteria 和浏览器验收证据；不在本 Task 内创建实现 Patch 或修改对应文件。

## 合并后的问题台账

### A：刷新调用链

| ID | 级别 | 当前结论 | 位置 | 证据与建议 |
|---|---|---|---|---|
| A-01 | P1 | 确认残留 | `src/ui/controller.ts:693-708` | 非 Shop Workspace 的 `refreshPanels()` 退化为 `render()`，重建 `#app`；`workspace-lifecycle.test.ts:64-73` 已验证 full render 增长。另立 Workspace-specific refresh scope 任务。 |
| A-02 | P1 | 确认残留 | `src/ui/runtime-editor/actions.ts:859-925`、`src/ui/controller-events.ts:14-44` | World Draft 多项 Area 事件逐项刷新，提交结束再次 `ctrl.render()`；需要事件收集 → 单次刷新收敛。 |
| A-03 | P2 | 确认残留 | `src/ui/controller-core.ts:83-100` | 待落账通知使 Tick 进入一次 full render fallback；应评估 chat region 收敛，并保留有证据的安全降级。 |
| A-04 | P2 | 确认残留 | `src/ui/runtime-editor/actions.ts:1021-1073` | Spot 批量提交虽已抑制逐项刷新，但结束成功/部分失败仍统一 full render；需要 refresh intent 分类和计数测试。 |

补充：当前没有重复确认历史上的“每个 Spot 事件立即 full render”问题；`beginContentRefreshBatch()` 已抑制该路径。

### B：交互连续性与 stale surface

| ID | 级别 | 当前结论 | 位置 | 证据与建议 |
|---|---|---|---|---|
| B-01 | P1 | 确认残留 | `src/ui/modal.ts:110-112` | `dismissable: false` 的 Modal 仍被全局 Escape handler 关闭；Runtime Editor 删除确认已使用该配置，但现有测试缺少生命周期断言。 |
| B-02 | P1 | 确认残留 | `src/ui/controller.ts:640-659`、`712-767`、`994-1048` | 局部 `outerHTML` 替换保存 scroll 但不保存 focus；应建立统一 focus continuity 协议并补刷新前后 activeElement 测试。 |
| B-03 | P1 | 确认残留 | `src/ui/controller.ts:702-704`、`802-832`；`src/ui/scroll.ts:118-132` | Workspace full fallback 未捕获 `.workspace-column__body`，可能丢失 Contacts / Story / Settings / Inventory 内部滚动位置。 |
| B-04 | P2 | 假设待验证 | `src/ui/ui-surface.ts:51-74` | 同一逻辑 Surface 重新挂载时 generation 不递增，可能允许旧 update 写回；需专门测试或浏览器复现。 |
| B-05 | P2 | 确认缺口 | `src/ui/popovers.ts:135-154`、`src/ui/css/popover.css:13` | Popover 仅处理 mouseover/mouseout，未接入 focusin/focusout；键盘 focus 与 `focus-within` 样式契约不一致。 |

已排除：按实际 mutation range 关闭 Popover、延迟 tooltip 的 generation / `isConnected` 保护、chat/log/Shop 局部替换和元素级 Spot/Enhancement/Area 刷新均已有回归覆盖；不重复立项。

### C：结构密度与描述性/装饰性结构

| ID | 级别 | 当前结论 | 位置 | 证据与建议 |
|---|---|---|---|---|
| C-001 | P3 | 确认问题 | `src/ui/components/story-gate.ts:95,113-115`、`src/ui/css/story-overlays.css:148-152` | 两个 typography-only `span` 无布局、事件、ARIA 或 Host 职责；后续验证是否可将样式移至父节点或 pseudo-element，同时保留可访问文本。 |
| C-002 | P2 | 确认问题 | `src/ui/components/collection-modal.ts:38-56`、`collection.ts:75-80,118-123` | 图鉴分类重复输出 heading、说明和近似 eyebrow；需明确标题所有权，保留必要计数。 |
| C-003 | P2 | 确认问题/可访问性风险 | `collection-modal.ts:25-31`、`shop.ts:47-52`、`tabs.ts:17-27` | 自定义 tab shell 未统一输出 tablist / selected 状态语义；后续应统一语义和事件边界，不直接删除宿主层。 |
| C-004 | P2 | 确认问题/可访问性风险 | `src/ui/components/story-gate.ts:86-101` | 视觉模态确认浮层缺少 dialog、aria-modal、标题关联和焦点契约；后续补语义，不通过增加装饰 wrapper 解决。 |
| C-005 | P3 | 假设待验证 | `contacts-workspace.ts:6-21`、`story-workspace.ts:8-21` | 空态的 eyebrow + h2 + p 可能过度描述，但三者尚未证明重复；需浏览器验收后再决定。 |

已排除：WorkspaceFrame 的滚动/布局节点、presentation-host-content、panel-tabs-region、selector-super-background、场景双缓冲节点以及 Contacts/Story 的列表与 inspector wrapper 均有真实职责。

### D：协议与验证门禁

| ID | 级别 | 当前结论 | 后续建议 |
|---|---|---|---|
| D-001 | P1 | 确认缺口 | 为 UI Task 模板增加 DOM Budget、Refresh Contract、Interaction Preservation、Verification Evidence 必填章节。 |
| D-002 | P1 | 确认缺口 | 将刷新级别明确为 `behavior → element → region → structure → full`，要求声明最大级别及 fallback 条件。 |
| D-003 | P1 hypothesis | 生成式反模式风险，未证明由 skill 直接造成现有缺陷 | signature 绑定稳定 Host；记录 wrapper 数量与职责；motion 声明 DOM/布局/刷新影响；描述性 copy 证明语义必要性。 |
| D-004 | P1 | 确认缺口 | 扩展 `ui:callgraph` 或相关测试辅助，覆盖 full-render 可达路径、刷新计数和 DOM identity；对 scroll/hover/click 设置门禁。 |
| D-005 | P1 | 已知架构行为，需显式声明 | 每个 Workspace UI Task 必须写出允许 full fallback、影响节点和 scroll/focus 恢复方案。 |
| D-006 | P2 | 确认缺口 | 按 behavior、region、structure、scroll/focus/popover、wrapper 分别规定最低证据组合。 |

### 统一基线

- `npm run ui:callgraph -- --hot`：110 个 UI 文件、2,283 个函数/方法/回调、212 个 DOM 写入点、242 个事件入口；`refreshPanels` 入度 35，`scheduleRender` 入度 25。
- Workstream A：相关测试 5 files / 45 tests 通过。
- Workstream B：相关测试 7 files / 51 tests 通过。
- Workstream D：定向 UI 回归 5 files / 44 tests 通过。
- 所有 Workstream 均确认未修改源码、测试、配置、协议或其他 Task。

## 后续 Task 边界

本审计不直接实施以下内容，建议拆为独立实现任务：

1. Workspace refresh scope 与 World Draft / Runtime Editor refresh intent 收敛（A-01、A-02、A-04）。
2. Notification fallback 的 chat region 收敛（A-03）。
3. Modal Escape、focus continuity、Workspace scroll continuity（B-01、B-02、B-03）。
4. Surface remount stale update 与键盘 Popover 生命周期验证/修复（B-04、B-05）。
5. Story overlay、Codex heading、Tab shell、Story gate dialog 的结构和语义修复（C-001 至 C-004）。
6. UI Task 模板、刷新等级协议和 UI refresh verification tooling（D-001、D-002、D-004、D-006）。

上述条目只是后续边界建议；当前 Task 不创建实现文件、不修改源码、不修改测试。

## 验收标准

- [ ] 完成四个 Workstream，所有 finding 均有当前源码、测试、callgraph 或浏览器证据。
- [ ] 建立 `full / structure / region / behavior` 刷新问题台账，能区分重复刷新和必要刷新。
- [ ] 建立 scroll / focus / hover / Popover / stale surface 交互连续性矩阵。
- [ ] 建立结构密度台账，区分语义节点、布局节点、交互节点和纯装饰节点。
- [ ] 为所有 P0 / P1 finding 指定唯一后续 Task 或 Patch Unit；无证据项只保留为待验证假设。
- [ ] 完成至少一轮 `npm run ui:callgraph -- --hot`、相关 `tests/ui/` 测试和必要的真实浏览器验收计划。
- [ ] 将最终结果回写到本 Task；完成后更新 `00-index.md`，再按文档维护规则归档。

## 严格只读边界

- [ ] 子 agent 未修改 `src/`、`tests/`、`package.json`、`AGENTS.md`、`docs/ai/**` 或其他 Task。
- [ ] 运行检查产生的报告、截图或临时输出不作为实现改动提交；如工具自动生成工作区文件，只记录结果并保持其原有归属。
- [ ] 任何修复、重构、协议落地、自动检查新增或测试补丁均已转成独立后续 Task / Patch Unit 建议。
- [ ] 本 Task 结束时仍只包含审计证据、问题台账和后续工作边界。

## 推荐 Read Set

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/docs-828/07-audit/dom-refresh-chains]]
- [[../ai/frontend-design-project-overlay]]
- [[../ai/task-read-set-routing]]

## 暂不纳入

- 不在本 Task 内实现组件重写、统一主题重构或独立编辑器改造。
- 不在本 Task 内修改任何源码、测试、配置、AGENTS、skill 覆盖协议或其他 Task 文档；协议和文档改进只提出建议。
- 不把“调用次数减少”直接等同于“真实 DOM / 布局 / 绘制减少”。
- 不新增存档迁移、状态兼容层或跨模块机制。
- 不依据 `docs/plan-work/archive/` 的历史状态判断当前实现。
