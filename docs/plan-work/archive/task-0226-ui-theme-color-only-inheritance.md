# Task：UI 父子宿主只传递主题色，不传递背景图层

状态：complete — U1 已由任务负责人独立验收，代码、测试、机制文档和 GALHCG 闭环完成。

## 目标

调整 UI 表现宿主的父子回退：高级宿主的背景图层内容不能因子宿主缺少状态配置而被子宿主复用。父子作用域继续传递主题语义色；子宿主拿到作用域主题色后，按自身状态和默认表现规则处理。完成后，父宿主的自定义图层不会改变子宿主的背景栈。

## 设计边界

- 本 Task 包含：修正状态图层向子宿主回退复用的行为；明确缺少子级状态表现时使用子级自身默认表现；保持主题节点色作用域继承；补充定向测试并更新当前表现机制文档。
- 明确非目标：改变根级全局背景的页面底层用途；重做主题色派生算法、用户主题编辑器、Datapack Schema、状态写入或 DOM 刷新策略；禁止子宿主使用自己显式配置的背景图层。
- 已裁定：跨父子节点传递的是主题语义色，子节点依自身规则派生/处理；不得传递父级背景图层内容。依据：用户在本 Task 前明确裁定。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `data-theme-scope` 依据点分层解析父作用域；子级覆盖优先，未覆盖节点沿用父级解析色值。 | `src/ui/controller-theme.ts:205` `applyThemeScopes`；`src/ui/theme-palette.ts:178` `resolveScopedThemeNodes` | 保留主题颜色继承链，不把背景层混入该链。 |
| `backgroundForHost()` 在非默认状态没有本级状态配置时沿宿主 ID 查找父宿主，并将父宿主设为有效宿主；之后可能返回父级的状态层、默认层及装饰。 | `src/ui/context.ts:176` `backgroundForHost` | 这是要收敛的父子图层传递路径。 |
| 本级状态层与本级默认层按 layer ID 合并，同 ID 由状态层覆盖。 | `src/ui/context.ts:194` `mergeStateLayers`；`tests/ui/context.test.ts:184` | 保留本宿主内部的状态叠加规则。 |
| 现有测试确认子宿主缺少 active 配置时会得到父宿主 active 图层。 | `tests/ui/context.test.ts:198` | 更新该用例为“父图层不泄漏，子宿主使用自身默认/派生表现”。 |
| 主题表现文档目前概括为“缺少精确状态时可继承宿主默认值或父级设置”。 | `docs/docs-829/06-wiki/50-ui/presentation-theme.md` | 将表述改准确，说明父宿主图层不向子宿主回退复用。 |

## 施工切片

### P0：隔离父级图层并保留主题色继承

#### Unit 0226-U1

## Goal

子宿主状态缺省时不再复用父宿主 PresentationHost 的背景图层/装饰；按子宿主自己的默认图层和状态默认行为生成表现，并继续在子级作用域使用继承后的 `themeNode` 颜色。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/06-wiki/50-ui/presentation-theme.md` | 当前表现、主题及图层文档事实 |
| 文档 | `docs/ai/context-packs/ui-presentation.md` | UI 主题任务路由 |
| 源码 | `src/ui/context.ts:createUIContext` / `backgroundForHost` | 父子宿主状态与图层解析 |
| 源码 | `src/ui/controller-theme.ts:applyThemeScopes` | 确认主题节点颜色作用域继承保持不变 |
| 源码 | `src/ui/theme-palette.ts:resolveScopedThemeNodes` | 确认主题色继承语义 |
| 测试 | `tests/ui/context.test.ts` | 更新父子图层行为并覆盖回归 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇；其他文档仅在 Read Set 不足时读取 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 停止并上报，由任务负责人拆分或调整范围 |

## Optional Read Set

- `tests/ui/presentation-service.test.ts`：仅在定向上下文测试不足以解释渲染输出时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`
- 与 UI 主题/PresentationHost 无关的领域源码或测试

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 父子 `themeNode` scope 传递解析后的主题节点颜色，不传递背景图层对象。 | `src/ui/controller-theme.ts:205`；`src/ui/theme-palette.ts:178` | 必须保留。 |
| 当前状态缺省回退循环会把父宿主当作有效宿主，可能向子宿主带入父状态层、父默认层和父装饰。 | `src/ui/context.ts:176-205` | 本 Unit 的代码修改目标。 |
| 当前定向测试依赖父 active 图层向子宿主回退。 | `tests/ui/context.test.ts:198-206` | 测试预期应随裁定更新。 |

## Constraints

- 遵守 `AGENTS.md`、`docs/ai/PROJECT-CONSTITUTION.md` 与 `docs/ai/galhcg-project-map.md`。
- 局部宿主的显式图层配置继续有效；本宿主默认层与本宿主状态层按既有 ID 合并规则处理。
- 状态缺省时不得再将父宿主图层/装饰当作子宿主结果；使用本宿主已有配置和既定主题色派生的本地默认表现。
- 保留根级全局背景作为独立页面底层的现有职责。`inheritGlobal` 的既有调用语义不得被误改成父宿主背景继承。
- 不改变 `resolveTextColorMode` 的文字模式父级回退，除非实现发现其必然复用背景图层；若确有耦合，停止并上报，不扩大本 Unit。

## Allowed Files

- `src/ui/context.ts`
- `tests/ui/context.test.ts`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `docs/plan-work/task-0226-ui-theme-color-only-inheritance.md`（仅填写 Receipt 与实际核验结果）

## Explicit Non-goals

- 不改 `controller-theme.ts`、`theme-palette.ts` 的主题颜色作用域继承。
- 不改变页面全局背景、局部宿主显式层、同宿主状态层合并、颜色合成及文字明暗算法。
- 不新增 Schema、迁移或存档兼容逻辑。
- 不触及本 Unit 白名单之外的文件。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条执行；本 Unit 额外规定：若“子节点按默认行为处理”无法由当前子宿主默认图层与既有状态回退语义明确实现，停止上报，不自行发明新的 UI 状态视觉规则。

## Completion Criteria

- [x] 子宿主缺少状态层时，不返回父宿主的状态背景层、默认背景层或装饰。
- [x] 子宿主在缺少状态层时，保留并按既有规则使用自身默认图层；没有自有图层时使用既有基于主题色的默认表现。
- [x] 本宿主默认层和本宿主状态层的同 ID 覆盖行为仍成立。
- [x] 主题节点色仍从父作用域继承；改动未触及 `controller-theme.ts` / `theme-palette.ts`，测试以子级 `var(--theme-node-panel)` 图层确认颜色 token 引用仍可用。
- [x] 当前表现机制文档不再将父宿主图层描述为子宿主的状态回退来源。
- [x] 定向 Vitest 与 `npx tsc --noEmit` 通过；Receipt 记录实际命令与结果。
- [x] 按 GALHCG 协议对改动路径完成 `review_changes`，并在 Receipt 记录涉及概念与映射处理结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/context.test.ts` | 通过，覆盖子级不继承父级图层及同宿主状态合并 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 文档检查 | `npm run check:docs` | 通过 |
| GALHCG | 按项目协议执行 `review_changes` 与必要的地图核对 | 记录准确路径和完整结果 |

## 当前核验（2026-10-04）

- 实施工前按 U1 Read Set 核对 `ui-presentation.md`、`presentation-theme.md`、`context.ts`、`controller-theme.ts`、`theme-palette.ts` 与 `context.test.ts`；确认仅 `context.ts` 的状态背景解析执行父宿主图层回退，主题节点色沿 scope 解析不依赖该路径。
- GALHCG 已用本次工作目录解析为 `project_id=acprogram`，返回 `workspace_path` / `root_path` 与项目根目录一致；按 `UI 表现`、`主题`、`PresentationHost`、`backgroundForHost` 等候选查询后回到源码核对。最初 `PresentationHost` 字面搜索为 0 命中，后续 `UI 表现` 命中 `concept:ui-presentation-layer`，源码搜索定位到 `src/ui/context.ts`。
- 定向测试、类型检查、文档检查及地图维护结果详见下方 U1 Receipt。

## GALHCG 影响闭环

- 发现路径：已按 `docs/ai/galhcg-project-map.md` 解析并确认项目 `acprogram`；检索命中 `concept:ui-presentation-layer`。地图摘要只作导航，具体行为按 U1 Read Set 的源码与测试确认。
- 变更审查：源码、测试、机制文档的精确路径均已 `review_changes` 到完整结果；`src/ui/context.ts` 与 `tests/ui/context.test.ts` 各 1 路径完整，机制文档 owner 分两页读取完 6 个直接 owner。Receipt 写入后审查 Task 路径返回 `unreferenced_path`（规划文件没有直接 Evidence 或 `maps_to` 关系），无 Task 路径地图 owner 可更新。
- 地图维护：刷新 `module:game-ui` 的证据 token；更新现有 `player-state-read-model-boundary` 到 context / test、`color-system` / `entity-presentation-service` 到表现文档的直接 Evidence；新增 `ui-presentation-layer` 到 context / test / 表现文档的 `maps_to`（角色分别为 implementation / test / documentation）。写前 `plan_map_updates` 完整；节点与边分别 dry-run `valid=true` 后正式提交。写后逐路径复核，三条路径均 `unchanged` 且 stale Evidence count 为 0；owner 分页完整。`search(mode="map")` 可发现 UI Presentation Layer，`traverse` 的 maps_to 结果完整并包含三条新关系。

## Unit 0226-U1 Receipt（2026-10-04）

### 实际修改

- `src/ui/context.ts`：状态查询不再沿宿主 ID 向父级搜索缺失状态；子宿主状态仅合成本宿主默认层和状态层。active 缺少本地状态时，有本地默认层就保留该层；没有本地层时使用既有主题色 active 默认层。页面全局层查询语义、同宿主状态层合并与文字模式父级回退保留。
- `tests/ui/context.test.ts`：覆盖子宿主 active 缺省不复用父状态图层、父默认图层或装饰；验证本地主题色 token 引用、本地默认层及无本地图层时的主题色 active 回退；更新 active 缺省使用本宿主默认层的断言。既有同 ID 状态覆盖测试保持通过。
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`：明确父宿主背景层/装饰不作为子状态回退来源，并记录本宿主默认层、主题色 fallback、全局层及同宿主合并规则。

### 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/context.test.ts`（首次） | 18 通过、1 失败；旧断言要求本地默认层存在时 active 仍退回主题色，与本 Task 的本地默认行为冲突，随后更新断言。 |
| `npx vitest run tests/ui/context.test.ts`（修正后） | 通过，19 tests。 |
| `npx tsc --noEmit` | 通过，exit 0。 |
| `npm run check:docs` | 通过，598 篇 Markdown，0 errors。 |

### GALHCG 与状态

- `review_changes` 的源码、测试、机制文档路径查询均完整；机制文档 6 个 owner 跨两页续读，未见其他直接 owner 路径遗漏。
- 地图更新已通过计划检查；`module:game-ui` 节点证据及 7 条相关 `maps_to` 边分两批完成 dry-run（均 `valid=true`）和正式提交。UI Presentation Layer 现有概念得到实现、测试及文档直接映射。主题颜色 scope 源码未改，地图与测试均确认保留语义色引用。
- Task 路径 `review_changes` 返回 `unreferenced_path`：没有该路径的直接 Evidence / `maps_to`，按协议记录为无地图关系可维护，不新增仅为规划文档服务的概念映射。
- U1 实施与定向验证完成；任务负责人复跑定向测试、类型检查、文档检查并审阅差异后接受。归档时本 Task 不承诺重做整体 UI PresentationHost 架构。

## 相关路由

- `docs/ai/goal-workflow.md`
- `docs/ai/PROJECT-CONSTITUTION.md`
- `docs/ai/context-packs/ui-presentation.md`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
