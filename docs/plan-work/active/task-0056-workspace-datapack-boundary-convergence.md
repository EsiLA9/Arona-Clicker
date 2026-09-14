# Task-0056：Workspace / Datapack 边界收束

- **状态**：🟡 P0 / P1 / P2 / P3 已实施并验证；P4 的 ShopQuery 与 DefinitionRepository 接口裁定已完成，Editor 来源实现与 UI Context 待施工
- **目标**：在 Runtime + 内容平台 + Editor 并存的前提下，逐步解除 `app-shell.ts`、`service-workspace.ts` 和运行时 Datapack Editor 之间的职责粘连。
- **立项依据**：Sol 对最新 `main` 的结构审查意见（2026-09-14）。
- **本任务性质**：架构边界与 UI 应用层收束任务，不是按文件大小进行的机械拆分。

## 一、适合性判断

Sol 的核心判断成立：当前主要问题不是 Service 数量不足，而是状态、Datapack 规则、Workspace 路由和 UI 派生职责开始汇聚到同一批 UI 文件中。优先级应按“规则拥有者”和“状态拥有者”划分，而不是按文件行数划分。

本任务接受以下方向：

1. `service-workspace.ts` 不再拥有 Datapack 依赖、排序、能力和过滤规则；
2. `RuntimeDatapackEditorState` 不继续扩展为所有 Def 的页面级巨型草稿状态；
3. Workspace 路由与返回历史从业务 Workspace 状态中逐步抽离；
4. Runtime Registry 保留为运行时物化结果，Editor 通过独立的草稿/引用读取路径接入；
5. UI 逐步从 `game.registry` 和具体服务转向查询模型或只读应用端口；
6. Shop 保持当前相对健康的规模，只做查询/命令边界的渐进收束，不进行无必要的组件拆分。

以下内容不在首轮施工中：

- 不一次性创建巨大的 `DatapackService` 或 `WorkspaceService`；
- 不把所有 Workspace 业务状态合并成新的超级 `WorkspaceState`；
- 不把 `WorkspaceFrame` 改造成业务状态仓库；
- 不在本任务内实现正式 PackManager 持久化、ZIP 导出或完整 Editor；
- 不直接改写 `Registry` 的底层 Map 结构；
- 不为旧 PlayerState / Datapack 编写迁移兼容代码。

## 二、现状与边界问题

### 2.1 App Shell 状态聚合

`src/ui/components/app-shell.ts` 同时承载游戏面板状态、服务/商店/角色/通讯录/故事 Workspace 状态、Datapack Editor 草稿、路由分发和返回上下文。尤其是 `PanelState` 已经包含多个业务域的字段，导致页面级状态与业务 Workspace 的所有权不清晰。

当前必须遵守的既有裁定是：`WorkspaceFrame` 只负责三栏物理布局；统一 Frame 不等于统一业务状态。Contacts / Story 的独立所有权和 Task-0040 的 Frame 契约继续有效。

### 2.2 Service Workspace 解释 Datapack 规则

`src/ui/components/service-workspace.ts` 同时负责渲染和以下规则：

- 包排序与启用集过滤；
- duplicate `modName`；
- 缺失依赖与依赖顺序；
- pack capability 与是否可重排判断；
- 导航所需的 issue 汇总。

这些规则应由 Datapack 领域/应用查询层计算，UI 只消费一次派生的 Workspace View。

### 2.3 Runtime Editor 草稿继续向页面状态膨胀

Task-0055 已完成单 Mod、元信息和临时 Spot Overlay MVP，但当前编辑草稿仍是会话级 `PanelState` 数据。若继续按 Spot、Area、Character、Story、Theme 等页面字段追加，Editor 会重新形成巨型 Controller。

本任务只建立后续可演进的边界，不在首轮一次性实现所有 Def 的编辑器。

## 三、目标结构

目标依赖方向为：

```text
Definition / Datapack
          ↓
Runtime
          ↓
Application / Query
          ↓
UI Workspace

Editor Draft Repository ──→ Definition / Datapack
```

### 3.1 Datapack 服务簇

不创建超级 `DatapackService`，而是按职责形成可独立测试的服务入口：

```text
PackCatalog              事实：有哪些包、来源、manifest、能力、启用状态
PackPlan                 草案：enable / disable / move / reset / draft order
PackValidation           规则：重名、依赖、顺序、manifest、冲突
DatapackWorkspaceView    派生展示：sections / entries / selection / validation
```

首轮允许这些实现仍位于现有 `src/data-services/` 或 `src/arona-clicker/` 的合适边界内；目录搬迁不是验收条件，依赖方向和测试边界才是。

上述名称表达职责边界，不强制采用 class 或“一职责一文件”。纯规则优先保持纯函数，只有需要生命周期、缓存或依赖注入时才建立有状态 Service。`DatapackWorkspaceView` 是从事实状态、草案状态和当前 UI selection 每次派生出的只读结果，不拥有长期业务状态，也不形成第二套真源。

真源不变量如下：

```text
PackCatalog
= 当前 Runtime / 已加载 Datapack 的事实读模型

PackPlan
= 用户尚未 Apply 的启用/顺序草案

PackValidation
= 对 Catalog + Plan 的纯校验结果
```

未 Apply 前，`PackPlan` 不修改 `PackCatalog`；Apply 成功后由现有 Datapack 生命周期重新产生事实状态，UI 不手动同步 Catalog。

### 3.2 Workspace 路由与 Frame

后续目标是：

```ts
interface AppViewState {
  route: WorkspaceRoute;
  game: GameViewState;
  overlay: OverlayState;
}
```

但本任务不新增承载所有业务字段的 `WorkspaceFrameState`。`WorkspaceFrame`、`WorkspaceColumn` 继续只表达布局、Host、滚动和响应式结构；`WorkspaceRouter` 只负责当前位置，`WorkspaceHistory` 只负责进入来源和返回位置。

### 3.3 Editor 读取边界

后续目标是：

```ts
interface EditingWorkspace {
  targetPackId: string;
  selection: EditorSelection | null;
  draft: DraftLayer;
  references: readonly PackReference[];
}
```

`DraftLayer` 以 Def 为单位保存 patch / replacement / delete。正式 Runtime Registry 仍是运行时结果，不被 Editor 草稿直接改写。完整 `DefinitionRepository` 和 Draft Overlay 放在后续阶段，必须先以当前 Task-0055 的临时 Overlay 行为为基线。

## 四、施工切片

### P0：基线与契约冻结

- [x] 盘点 `app-shell.ts`、`service-workspace.ts`、Task-0055 编辑态和当前 Workspace Frame 的状态/规则/渲染调用点；
- [x] 建立并保存所有权表，至少明确以下项目的真源、可修改者和 UI 是否可解释：已加载 Pack、enabled/order 草案、dependency issue、selected pack、Editor Spot draft、当前 Workspace、返回位置和三栏布局；
- [x] 所有权表至少包含以下结论：Catalog/Runtime 是已加载事实，PackPlan 是未 Apply 草案，Validation 和 WorkspaceView 是派生结果，Editor Session 拥有 Editor 草稿，Router 拥有当前位置，Frame 拥有布局结构；
- [x] 确认 Task-0040、Task-0047、Task-0055 的现有行为和未完成项不被覆盖；
- [x] 为后续服务入口确定最小只读/命令接口，不提前承诺最终目录；
- [x] 记录当前工作树和现有测试基线。
- [x] **停止条件**：所有权表完成且 P0 基线可复核；未完成前不得开始 P1。

P0 的所有权表至少应落成如下形式，并按实际源码补充入口：

| 数据 / 行为 | 真源 | 可修改者 | UI 是否可解释 |
| --- | --- | --- | --- |
| 已加载 Pack | `PackCatalog` / Datapack lifecycle | Datapack lifecycle | 否 |
| enabled / order 草案 | `PackPlan` | Datapack Workspace 操作 | 否 |
| dependency issue | `PackValidation` | 纯派生 | 否 |
| selected pack | Workspace UI State | Datapack Workspace | 是 |
| Editor Spot draft | Editor Session | Editor 操作入口 | 否 |
| 当前 Workspace | `WorkspaceRoute` / Router | Navigation action | 是 |
| 返回位置 | `returnTo` / Navigation state | Router / navigation action | 是 |
| 三栏布局 | `WorkspaceFrame` | Layout renderer | 是 |

### P1：Datapack Domain Logic Extraction（首要施工）

- [x] **只迁移规则所有权，不重新设计规则语义。** 除非发现确定 bug，排序、过滤、错误分类、错误优先级、能力判断和展示信息均按当前基线保持；Renderer rule extraction 不等于 Datapack semantics redesign；
- [x] 将 `resolvePackIssues`、`orderPacks`、`filterPacks`、`dependencyState`、`packCapabilities`、`isReorderable` 从 UI Renderer 中移出；
- [x] 建立一次性派生的 `DatapackWorkspaceView`（或等价只读查询结果），统一返回 entries、sections、selection、issues、canApply；该对象不作为新的业务状态真源；
- [x] UI Renderer 只消费 `DatapackWorkspaceView` 并绑定用户操作，不重新计算 Datapack 规则；
- [x] 为重复 modName、缺失依赖、依赖顺序、过滤、排序和能力判断增加纯函数测试；
- [x] 保持现有选择、草案、校验、应用、失败恢复和离开拦截行为。
- [x] **停止条件**：Renderer 已不再拥有这些规则，行为基线测试通过；不顺手重构 Datapack lifecycle、错误模型或 PackManager。

## 当前施工记录

### P0：基线与所有权冻结

- 当前基线：`npx tsc --noEmit` 通过，`npm run check:architecture` 通过，全量测试为 146 个文件 / 1390 个测试通过；
- 已确认 `PanelState`、Datapack Workspace、Runtime Editor、Workspace Frame 和现有服务入口的当前所有权；该阶段按切片推进，后续已在本记录中补充 P2 / P3 的实施结果；
- 所有权表已按 P0 模板写入本任务，并以当前源码调用点为核对基准。

### P1：Datapack 规则所有权抽取

- 新增 `src/arona-clicker/services/datapack-workspace-view.ts`，承载纯规则、包能力/移动判断和 `buildDatapackWorkspaceView()`；
- `service-workspace.ts` 在一次渲染中构造 View，导航、列表和检查器复用同一派生结果；
- `controller-actions-topbar.ts` 复用同一包能力规则；测试改为直接覆盖 AronaClicker 规则模块，并新增 View 派生回归；
- 未改变排序、过滤、依赖问题、错误归属、核心包不可越过和现有应用流程语义。
- P1 专项验证：Datapack 工作区与服务工作区测试 16/16 通过；全量测试 146 个文件 / 1391 个测试通过；`npx tsc --noEmit` 与 `npm run check:architecture` 通过。

### P2：编辑态状态隔离

- 新增 `src/ui/workspace/datapack-workspace-state.ts`，集中承载 Datapack Workspace 类型、初始化/同步/重置、选择、草案启停/排序、反馈与变更查询；
- 新增 `src/ui/workspace/runtime-datapack-editor-state.ts`，集中承载 Runtime Editor 类型、初始化、字段归一化、Spot 草案、已加载草案回填、RuntimeModDraft 映射与错误/应用态清理；
- `app-shell.ts` 仅保留 `PanelState` 的 typed session 引用并维持原有类型导出兼容；`controller.ts` 与顶栏操作通过专属状态入口读写，不新增通用 DraftLayer，也未将 Editor 草稿写入 Runtime Registry 或游戏三栏状态；
- P2 专项测试覆盖状态初始化、同步、重置、选择、排序边界、反馈清理、Runtime 草案映射、回填及清理（6/6）；既有 Datapack / Task-0055 UI 回归继续通过（28/28）。
- P2 最终验证：全量测试 147 个文件 / 1397 个测试通过；`npx tsc --noEmit` 与 `npm run check:architecture` 通过。

- [x] 将 `DatapackWorkspaceState` 与 `RuntimeDatapackEditorState` 的**类型定义、初始化、局部 mutation/helper 及业务访问入口**从 `app-shell.ts` 移入 Datapack Workspace / Editor 专属状态模块；
- [x] 明确编辑会话状态与游戏三栏 `GameViewState` 的边界；
- [x] 新增 Spot/Area/后续 Def 字段时，禁止继续向 `PanelState` 追加业务草稿字段；
- [x] 保持 Task-0055 的单 Mod、临时 Spot、Overlay、保存/删除和 PlayerState 保留语义；
- [x] 允许首轮保留 `state.datapackWorkspace` 等 typed session 引用，但禁止在 App Shell 或其它页面散布 `state.datapackWorkspace.editor.spot.baseYield` 一类字段解释；
- [x] `PanelState` 的历史命名允许保留；只有业务字段实质迁出后，才另行决定是否重命名为 `AppViewState`；
- [x] 本阶段不实现通用 DraftLayer，只为其保留稳定的会话入口和选择模型。
- [x] **停止条件**：Editor state 的所有权和访问入口已移出 App Shell，且没有新增通用 Draft infrastructure；不顺手进行全仓状态重命名。

### P3：Workspace Router / History 收束

- [x] 把 `service`、`workspace`、`shop`、`contacts`、`story` 等入口收敛为互斥的 `WorkspaceRoute`；旧 `PanelState` 字段仅保留为兼容镜像，路由入口统一经过 Controller 的导航边界；
- [x] Route 只表示当前位置，可携带定位业务会话所需的轻量标识，例如 `shop.sessionId` 或 `story.sessionId`；不得携带购物车、故事 cursor、选中角色详情、Editor 草稿等业务状态；
- [x] 将 `WorkspaceReturnContext`、`ShopReturnContext` 等重复返回字段首轮收敛为 `WorkspaceLocation` + 单层 `returnTo`；当前产品没有多层嵌套需求时，不提前实现通用 history stack；
- [x] 让 `app-shell.ts` 只做应用壳装配，并由 `renderWorkspace(route, state)` 负责路由分发；
- [x] 不把 Shop、Story、Contacts 的业务状态搬入 Router；
- [x] 增加非法组合状态、进入、替换、返回和重启路径测试。
- [x] **停止条件**：Workspace 路由组合状态消失，返回上下文重复收束；不顺手统一所有 Workspace API。

### P3：Workspace Router / History 收束

- 新增 `src/ui/workspace/workspace-router.ts`，以判别联合表达 Game、Service、Shop、Character、Contacts、Story 的当前位置；`sessionId` / `variantId` 只承担轻量定位，不承载 Workspace 业务状态。
- 新增 `src/ui/workspace/workspace-renderer.ts`，将 `app-shell.ts` 收束为应用壳装配；路由与旧状态镜像不一致时，渲染层仍按旧状态派生安全回退，保证既有测试和临时入口兼容。
- `WorkspaceLocation` 统一原有返回上下文字段，`WorkspaceNavigationState.returnTo` 固定为单层返回位置；`enter` 会覆盖旧返回层，`replace` 只替换当前位置，`back` 消费返回层，不实现通用 history stack。
- Controller 的服务切换、Shop / Character / Contacts / Story 进入、替换、返回和会话重置均经过导航边界；Workspace 内部购物车、故事导航、Contacts 选择和 Editor 状态仍由各自业务状态持有。
- 新增 `tests/ui/workspace-router.test.ts`，并在 Workspace 生命周期与 Contacts / Story 回归中覆盖非法组合、进入、替换、返回和重启复位。
- P3 最终验证：路由专项与相关 Workspace 回归 16/16 通过；全量测试 148 个文件 / 1404 个测试通过；`npx tsc --noEmit` 与 `npm run check:architecture` 通过。

### P4：只读查询边界与 DefinitionRepository 接口裁定

- 新增 `src/arona-clicker/contracts/shop-query.ts`，将 Shop 的只读端口从交易实现文件中抽到 contracts；`ShopQueryPort` 现在统一提供 Shop 目录、资源展示配置、availability 与 preview。
- `ShopService` 实现该只读端口，但 checkout、购买记录和 StateMutationService 写入仍留在交易服务；未增加 `getWorkspaceView()`，也未把交易逻辑混入展示派生。
- Shop Renderer、Shop 入口和 Shop 交互绑定不再直接读取 `registry.shops`，改用 `ctx.game.shopService.getShop()`；结算余额仍来自 `GameView`，资源展示配置通过 query port 获取。
- 新增 [[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]，裁定最小 `get/list/has/resolve` 接口、Draft → Reference packs → 原始包 / 基础包的解析顺序，以及 Runtime fallback 必须显式允许且依赖 provenance；本阶段不伪造完整 Repository。
- P4 低风险专项验证：Shop Service 与 Shop Workspace 回归 15/15 通过；全量测试 148 个文件 / 1405 个测试通过；类型检查与架构边界检查通过。

### P4：查询边界与 Editor Overlay 预研

- [x] 评估并裁定 `DefinitionRepository` 的最小 `get/list/has/resolve` 接口；
- [x] 预研 Editor Definition Resolution：Draft → Reference packs → 原始目标包 / 基础 Definition source；不得默认把已经合并完成的 Runtime Registry 直接作为 Editor 的来源层；是否提供 Runtime fallback，由后续 ADR 根据 Registry provenance 能力裁定；
- [x] 将 Shop UI 的直接 `registry` 读取收束到 `ShopQuery` 或等价只读查询端口；`ShopQuery` 只读取商品、库存、余额、availability 和 preview，交易/Application 层负责 checkout 与 mutation；不得通过 `ShopService.getWorkspaceView()` 把交易逻辑和展示派生重新混回同一服务；
- [ ] 为新增 Workspace 规定收窄的 UI Context，禁止继续扩大 `ctx.game.xxxService`；
- [ ] 只有当 P1–P3 稳定后，才拆出通用 DraftLayer 和多 Def 编辑器基础设施。
- [x] 除 Shop Query 这种低风险实例外，Repository / Overlay 本阶段以接口裁定和 ADR 为主要产出，不以完整落地为 Task-0056 的强制完成条件。

## 五、验收标准

### 结构

- [x] `service-workspace.ts` 不再实现 Datapack 依赖/排序/能力/过滤规则；
- [x] `PanelState` 不再新增 Datapack Editor 具体 Def 字段；
- [x] Workspace Frame 没有业务分支，Router 不拥有业务 Workspace 内部状态；
- [x] 不新增超级 `DatapackService` 或 `WorkspaceService` 作为职责垃圾桶；
- [x] Runtime Registry 仍是运行时物化结果，未被改造成 Editor 数据库。
- [x] Datapack core/query 不 import `src/ui/**`；Workspace Router 不 import 具体 Shop/Story/Contacts domain state；Runtime 不 import Editor state；Editor draft 不直接 mutation Runtime Registry。

### 行为

- [x] 数据包列表、启用集、草案顺序、依赖问题和应用结果与基线一致；
- [x] Task-0055 的编辑态、临时 Overlay、Spot 编辑/删除和 PlayerState 语义不回归；
- [x] Game / Service / Shop / Contacts / Story 路由互斥，返回位置和 Session 生命周期正确；
- [ ] Shop 查询在同一 View 派生中保持商品、库存、余额和结算状态一致。

### 验证

每个已完成切片至少执行：

```text
npx tsc --noEmit
npm test
npm run check:architecture
```

涉及 UI 路由、Datapack 工作区或 Editor Overlay 的切片，还需在 Edge 中验证：数据包选择/校验/应用/离开、临时编辑、商店返回、Contacts/Story 入口和主题 Host 刷新。

P4 的 DefinitionRepository / Overlay 结果若超出接口裁定范围，应另行建立 ADR 或拆出后续任务，不以扩大 Task-0056 范围作为完成条件。

## 六、依赖、非目标与风险

### 依赖

- [[docs/plan-work/active/task-0040-unified-workspace-frame]]：Frame 只做物理布局的既有裁定；
- [[docs/plan-work/active/task-0047-contacts-story-workspace-ownership]]：Contacts / Story Workspace 所有权和路由迁移；
- [[docs/plan-work/active/task-0055-runtime-datapack-editor-mvp]]：当前临时 Editor Overlay 行为基线；
- [[docs/plan-work/active/adr-0004-datapack-management]]：Datapack 启用集、依赖和生命周期边界；
- [[docs/docs-828/01-architecture/module-dependency-baseline]]：当前模块依赖实况。

### 非目标

- 不修改 PlayerState、StateMutationService 或 Runtime 机制；
- 不编写存档/Datapack 迁移兼容层；
- 不在本任务中完成正式 Editor、导出 ZIP、PackManager 持久化或所有 Def 的编辑；
- 不进行纯粹为降低行数的文件拆分；
- 不把 `tools/datapack-editor/` 当作当前游戏内 UI 的默认修改目标。

### 主要风险

| 风险 | 处理方式 |
| --- | --- |
| 规则抽取改变包排序或失败信息 | 先锁定纯函数基线测试，再替换 Renderer 调用 |
| `PanelState` 拆分影响局部刷新 | P2 保持状态字段语义不变，先迁类型和读写入口 |
| Router 统一吞并业务状态 | 用判别联合只表达位置，Workspace 自持业务状态 |
| Editor Overlay 提前扩大范围 | P4 仅裁定接口，通用 DraftLayer 另行拆任务或 ADR |
| UI Context 继续变成 Service Locator | 新增 Workspace 只允许收窄端口，禁止新增任意 `game` 服务暴露 |

## 七、关联代码入口

- `src/ui/components/app-shell.ts`
- `src/ui/components/service-workspace.ts`
- `src/ui/components/shop.ts`
- `src/ui/components/workspace-frame.ts`
- `src/ui/context.ts`
- `src/ui/controller.ts`
- `src/arona-clicker/services/datapack-workspace-view.ts`
- `src/data-services/`
- `src/arona-clicker/`
- `tests/ui/`
