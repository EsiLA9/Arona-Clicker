# Task 0045：UI 增量更新与 Workspace 隔离第一施工片段

状态：✅ P0–P4 第一施工片段完成（P5–P7 后续）

> 本任务把 `review/ui-incremental-update-workspace-isolation-draft` 中已经完成事实核查的建议转成可执行施工任务。
>
> 本任务只处理 UI 层的更新边界、刷新调度和同一 Workspace 内的增量更新，不修改 PlayerState、Datapack 机制、交易语义或引擎事件契约。

## 一、目标与结论

### 目标

在保留当前字符串 renderer 的前提下，完成第一套可验证的 UI 增量更新基础设施：

```text
刷新观测
    ↓
Surface Token / generation
    ↓
UIUpdateDispatcher 兼容层
    ↓
Resource / Gain / Spot Yield Behavior
    ↓
Shop 同 Workspace 增量更新
```

预期效果：

- 普通 Tick、资源值、资源增益和 Spot 产出仍只修改目标文本节点；
- 旧 Workspace 的异步或延迟更新不能修改新 Workspace；
- 同一轮事件产生的重复 UI 更新能够合并；
- Shop 加入清单、撤销、结算失败和成功时，不再无条件重建整个 `#app`；
- Shop 的进入、退出、服务路由切换、Lobby / Init 路由仍可使用结构刷新；本任务不强制拆稳定 App Shell 挂载点；
- 所有新增更新代码通过 UI 层统一入口，旧 `refreshPanels()` 等接口保留为迁移兼容层。

### 非目标

本任务不包含：

- Virtual DOM、响应式框架或通用 VDOM diff；
- 全量 Keyed Collection Reconcile；
- UI Condition Dependency Graph；
- 立即删除 `EventBus.onAny`；
- `PanelState.service` + `PanelState.workspace` 到 `WorkspaceRoute` 的完整联合重构；
- 修改 `UIHostRegistry` 的静态表现定义职责；
- 修改 Shop 交易计划、原子提交、Purchase Scope、存档字段或事件目录；
- 将更新统计直接解释为浏览器布局 / 绘制耗时；
- 存档迁移或兼容代码。

## 二、前置事实与架构边界

### 已存在、应直接复用的能力

| 能力 | 当前落点 | 本任务处理 |
| --- | --- | --- |
| GameReadModel / UIContext 只读消费 | `src/ui/context.ts` | 不改变 |
| GameCommands 写入口 | `src/ui/controller.ts`、`src/arona-clicker/runtime-commands.ts` | 不改变 |
| Game / Service / Shop / Character / Inventory Frame | `src/ui/components/workspace-frame.ts`、`app-shell.ts` | 复用结构边界，不重做 Frame |
| Host 定义和父子关系 | `src/ui/ui-host-registry.ts` | 保持静态 Registry；新增运行时 Surface 层与其分离 |
| 普通 Game 局部面板刷新 | `UIController.refreshPanels()` | 作为 Dispatcher 兼容适配对象 |
| 聊天、日志局部刷新 | `refreshChatPanel()`、`refreshLogPanel()` | 不在首片重写，避免扩大回归面 |
| Tick 轻量刷新 | `controller-core.ts:refreshLight()` | 把行为收口到 Behavior Registry，但保留热路径语义 |
| Shop 临时 Session / Feed / 主题生命周期 | `ShopWorkspaceState`、`disposeWorkspace()` | 保持既有交易和退出语义 |
| 引擎条件反向索引 | `src/engine/expression/condition-deps.ts`、`visibility/` | 不重复实现；P5 以后再讨论 UI Reveal 映射 |

### 不可破坏的边界

1. UI 更新调度器只能安排 DOM 更新，不得修改 PlayerState 或绕过 `GameCommands`。
2. Shop 的 Session 只保存临时用户意图；价格、库存、余额和 affordability 仍从当前状态派生。
3. `UIHostRegistry` 仍是静态 Host / 表现元数据注册表，不持有 DOM 元素、当前实例或用户主题值。
4. Surface Token 不进入 PlayerState、不进入存档、不参与玩法计算。
5. 普通状态变化不得请求比实际影响范围更大的渲染；结构变化仍可请求 Workspace / App 级刷新。
6. 过期更新可以静默丢弃；当前 Surface 的结构异常必须可诊断，不能全部吞掉。
7. 不新增存档迁移。若本任务新增任何持久状态，必须停止并重新裁定范围；预期不应新增。

## 三、当前问题基线

### 当前刷新层级

```text
Root
  UIController.render()
  → root.innerHTML = renderAppShell(...)

Panel
  UIController.refreshPanels(['left' | 'center' | 'right'])
  → 普通 Game 栏级 outerHTML 替换

Region
  refreshChatPanel() / refreshLogPanel()
  → 聊天或日志区域 outerHTML 替换

Behavior
  refreshLight()
  → resource / gain / spot-yield 文本节点更新
```

### 当前需要施工的具体回退

- `refreshPanels()` 在 `panelState.workspace` 存在时直接调用 `render()`；
- Service / Settings / Inventory 不是普通 `.workspace`，也会因 `!root.querySelector('.workspace')` 进入完整 render 分支；
- Shop 的加入清单、撤销、结算成功和失败都直接调用 `ctrl.render()`；
- `controller-events.ts` 的 UI `onAny` 对非 Tick / 非 SpotProduced 事件统一触发 Reveal 检查和日志刷新；
- UI Reveal 使用跨 Spot、Enhancement、Init、Area、Story 的单字符串 fingerprint；
- `UIHostRegistry` 有父级树，但没有当前 DOM Surface 运行时；
- `refreshLight()` 对资源值使用单个 `querySelector()`，无法表达 Header 与 Workspace 内重复资源节点的更新目标。

### 已完成内容不得重复施工

`roadmap-0015-ui-dom-recalculation` 已完成普通 Game 的主要 P0–P2：Tick 轻量刷新、常用 Game 操作的面板刷新、聊天 / 日志 / 揭示的局部入口和刷新计数。Task 0044 已完成 Frame / Column / surface / scroll owner / Host 接线与页面结构回归。

本任务的增量不是重新治理整个 UI，而是把这些既有局部能力推广到 Workspace，并建立更新边界。

## 四、目标架构

### 4.1 三个独立职责

```text
UIHostRegistry
  静态 Host 定义 / parent / level / kind / service / 表现发现

UISurfaceRuntime
  当前 route / workspace 实例 / DOM 根 / token / Host 归属

UIUpdateDispatcher
  更新请求 / 去重 / 优先级 / token 检查 / fallback / 统计
```

不得把三者重新合并到 `UIHostRegistry` 或 `UIController.render()` 中。

### 4.2 Surface Token

建议类型：

```ts
interface UISurfaceToken {
  readonly key: string;
  readonly generation: number;
}
```

候选 key：

```text
game
service:settings
service:inventory
service:datapack
service:saves
service:records
shop:<spotId>:<shopId>
character:<variantId>
```

generation 只在当前 Surface 身份发生变化时递增：

- Service 路由切换；
- Shop / Character 进入；
- Workspace 实例替换；
- Workspace 退出回到 Game；
- Init 重启或读档导致当前 Game Surface 重置。

同一 Workspace 内的购物车修改、Feed 追加、资源变化和按钮状态变化不递增 generation。

### 4.3 更新类型

第一版建议使用判别联合，避免长期依赖 `payload: unknown`：

```ts
type UIUpdate =
  | UIBehaviorUpdate
  | UIRegionUpdate
  | UIStructureUpdate;

interface UIUpdateBase {
  readonly token: UISurfaceToken;
  readonly reason: string;
}

interface UIBehaviorUpdate extends UIUpdateBase {
  readonly type: 'behavior';
  readonly behavior: UIBehaviorId;
  readonly key: string;
}

interface UIRegionUpdate extends UIUpdateBase {
  readonly type: 'region';
  readonly hostId: string;
}

interface UIStructureUpdate extends UIUpdateBase {
  readonly type: 'structure';
  readonly scope: 'workspace' | 'app';
}
```

具体 `UIBehaviorId` 第一批只包含：

```ts
type UIBehaviorId =
  | 'resource.value'
  | 'resource.gain'
  | 'spot.yield';
```

Shop 的 `stock`、`selection`、`total`、`button.enabled` 在 DOM 合同建立后再加入，不在第一版假设不存在的标记。

### 4.4 更新优先级与 fallback

```text
App Structure
  > Workspace Structure
  > Region
  > Behavior
```

规则：

| 情况 | 处理 |
| --- | --- |
| Token 过期 | 丢弃，计入 dropped / stale 统计 |
| 当前 Surface，Host 尚未挂载 | 延迟或丢弃，不能直接 Root Render |
| 当前 Surface，Host 存在但行为节点缺失 | 开发 warning；首片不自动 Root Render |
| Region Host 不存在 | 允许升级到 Workspace 结构刷新，并记录 reason |
| App 路由或 Shell 无法确认 | 才允许 Root Render |

## 五、分阶段施工清单

### P0：刷新观测与预算

状态：✅

工作项：

- [x] 扩展 `UIRefreshStats`，区分 full / workspace / region / behavior / dropped 更新；
- [x] 为每次更新记录 scope、reason、surface key、generation 和 fallback 原因，保留最近 200 条诊断记录；
- [x] 保留 `#app[data-ui-refresh-*]` 兼容可观测入口；
- [x] 为普通 Tick、Shop 同 Workspace 操作建立刷新计数基线；普通 Game Tick 通过浏览器冒烟确认；
- [x] 计数只表示 JS / DOM 更新动作，不冒充布局和绘制成本；
- [x] 用自动化和浏览器检查固定普通 Tick 不触发 Root Render 的既有契约。

交付物：刷新统计扩展、基线测试、开发诊断说明。

验收：

- 普通 Tick 的 full render 计数不增加；
- Shop 同 Workspace 操作的 Root Render 计数可单独断言；
- 旧 `getRefreshStats()` 调用不破坏类型和既有测试。

### P1：Surface Token / generation

状态：✅

工作项：

- [x] 新增 UI 层 Surface Token 类型与当前 Surface 计算；
- [x] 在 Controller 路由 / Workspace 身份变化时更新 generation；
- [x] 提供 `getCurrentSurfaceToken()` 和 `isSurfaceCurrent(token)`；
- [x] 更新 `render()`、Shop / Character 进入和 `disposeWorkspace()` 的生命周期边界；
- [x] 令 Token 以 readonly key + generation 传入更新请求，并在 Dispatcher 中复制隔离；
- [x] 通过 SurfaceRuntime 单测和 Dispatcher stale 单测验证同类型不同实例 / 路由切换的过期更新阻断；
- [x] 既有生命周期测试继续验证 dispose、主题和 Shop Session 清理语义。

备注：Shop A→B、Character A→B 的专门页面剧本未新增数据，已由 SurfaceRuntime 的实例 key/generation 单测覆盖；浏览器 Character 冒烟沿用既有生命周期测试。

交付物：`ui-surface.ts` 或等价模块、生命周期测试。

验收：

- 同类型不同实例的旧更新不能落到当前 DOM；
- 仅同 Workspace 内的用户操作不会无意义递增 generation；
- Token 不进入类型化 PlayerState / SaveData。

### P2：UIUpdateDispatcher 兼容层

状态：✅

工作项：

- [x] 新增 `src/ui/update/` 目录；
- [x] 实现 Behavior / Region / Structure 三类请求；
- [x] 同步链或一次 microtask 内去重；
- [x] 同一 Region 的 Region 更新覆盖其带 Host 身份的 descendants Behavior 更新；
- [x] 过期 Token、未挂载 Surface、异常行为目标分别处理，不隐式 Root Render；
- [x] 为旧 `refreshPanels()`、`refreshLight()` 提供兼容适配；聊天 / 日志入口保留既有安全局部路径；
- [x] Shop 新业务不再直接新增 `ctrl.render()`，旧结构刷新调用点保留；
- [x] 记录每次更新结果和 fallback / drop 原因，不把 Dispatcher 变成命名包装。

保留项：`refreshChatPanel()`、`refreshLogPanel()` 尚未改成 Dispatcher 请求，因为它们已经是独立 Region 生命周期；后续迁移应以行为不变为前提。

交付物：Dispatcher、更新类型、去重测试、兼容适配。

验收：

- 同一批重复请求只执行一次；
- stale 请求不产生 DOM 写入；
- Region dirty 能压掉其子 Behavior；
- 旧 UI 行为和既有测试不变。

### P3：首批 Behavior Registry

状态：✅

工作项：

- [x] 注册 `resource.value`、`resource.gain`、`spot.yield`；
- [x] 保留 `data-resource`、`data-gain`、`data-spot-yield` 作为迁移期标记；
- [x] 行为查询限定在当前 Controller root / Surface，不使用跨页面全局查询；
- [x] 重复资源节点使用 `querySelectorAll()`；Shop holdings 已补 `data-resource` 合同；
- [x] 处理 `frame`、Credit、Pyroxene、Gain 和 Spot Yield 的现有格式一致性；
- [x] 目标缺失计入 `behaviorMisses` 与观测记录，不隐式升级 Root Render；
- [x] Shop 资源行为、普通 Game Tick 和 Dispatcher 隔离测试覆盖首批行为。

交付物：Behavior Registry、首批处理器、`refreshLight()` 适配、测试。

验收：

- 普通 Tick 只 patch 目标文本节点；
- Header 和 Shop 结算区若同时存在同一资源标记，都按契约更新；
- Spot Yield 只更新对应 Spot；
- 缺失节点不会隐式触发 Root Render。

### P4：Shop 同 Workspace 增量试点

状态：✅

区域边界：

```text
leftPanel.shop.feed
centerPanel.shop.catalog
rightPanel.shop.settlement
```

工作项：

- [x] 为 Shop Region 建立稳定 Host 解析与 Region renderer；
- [x] 加入清单后局部更新商品已选状态、购物车和结算状态；
- [x] 撤销只更新购物车、商品状态和 Feed，不离开 Workspace；
- [x] 结算失败只更新 error Feed / 当前结算状态，保留 cart；
- [x] 结算成功在领域提交完成后清 cart，更新 Feed、库存、资源和成本；
- [x] Shop 可见性变化更新 catalog / settlement Region，不升级 App Root；
- [x] 同一批 Shop Region 请求只构建一次 `renderShopWorkspace()` / `ShopWorkspaceView`；
- [x] 主题浮窗、Modal 生命周期、Header / Shell 身份、未受影响 DOM 与资源节点完成自动化 / 浏览器回归；
- [x] 进入 / 退出 Shop 的结构刷新保持允许，没有把 Shell 拆分强行塞入 P4。

推荐映射：

| 操作 | 首选更新 | 备注 |
| --- | --- | --- |
| 加入商品 | 商品卡 / settlement Region，Feed append | 当前没有 stock / selection / total 行为标记，先补 DOM 合同 |
| 撤销 | 商品选中状态 / settlement / Feed | 不释放临时主题 |
| 结算失败 | Feed / settlement | 不清 cart |
| 结算成功 | catalog / settlement / feed / resource Behavior | 先消费成功结果，再清 Session |
| 首次 Reveal | catalog Region | 不需要 App Root Render |
| 离开 Shop | `disposeWorkspace()` + 结构刷新 | 允许 Workspace / App 级 |

交付物：Shop Region 适配、首批 Shop Behavior / Region、生命周期与节点身份测试。

验收：

- 加入、撤销、失败、成功四条路径不再无条件调用 `ctrl.render()`；
- 同一 Shop 内 Header、未受影响列、主题浮窗和 Modal 节点保持；
- Shop A → 离开 → Shop B 不串用 Session、Feed、主题或 Token；
- 失败、成功和撤销语义与 Task 0039 保持一致；
- Shop 领域交易测试和 UI 生命周期测试全部通过。

## 六、后续任务，不在本次阻塞

### P5：Reveal 分类与显式 UI 事件映射

- 单字符串 fingerprint 拆成分类 fingerprint；
- 已知事件映射到最小 UI Region；
- `onAny` 降级为兼容诊断；
- 对照引擎 `VisibilityEngine` / `ConditionDepIndex`，决定是否需要 UI 专用依赖投影。

### P6：Keyed Collection Reconcile

只有 Region 重建仍是可测量瓶颈时才引入。先覆盖单一列表，再推广到角色、故事或 Inventory。

### P7：Root Shell / WorkspaceRoute 收口

- 评估 `service` + `workspace` 是否收敛为 `WorkspaceRoute`；
- 评估 `renderConsoleFrame()` 是否拆出稳定 Header / Workspace body / Footer 挂载点；
- 在 Shell seam 存在且回归充分后，再减少 Game → Shop 的 Root Render；
- 最终移除旧兼容刷新入口。

## 七、测试矩阵

### 自动化

| 类别 | 必须覆盖 |
| --- | --- |
| 统计 | full / workspace / region / behavior / stale drop 计数 |
| Token | 同类型不同实例、Service 切换、Workspace 退出、dispose 幂等 |
| Dispatcher | 去重、优先级、过期更新、Host 缺失、Region 覆盖 Behavior |
| Behavior | resource value / gain、frame、Spot yield、重复节点和缺失节点 |
| Shop | 加入、撤销、失败、成功、库存变化、首次可见、重新进入 |
| DOM 身份 | Header、未受影响列、主题浮窗、Modal、聊天 / 日志区域、滚动容器 |
| 边界 | UI 不写 PlayerState、Shop 不新增派生持久状态、Host Registry API 不越界 |

建议新增或扩展：

- `tests/ui/ui-update-dispatcher.test.ts`；
- `tests/ui/ui-surface.test.ts`；
- `tests/ui/ui-behaviors.test.ts`；
- `tests/ui/shop-modal.test.ts` 或独立 `shop-workspace-incremental.test.ts`；
- `tests/ui/workspace-lifecycle.test.ts`。

### 浏览器验收

- Game 普通 Tick：full render 不增长，Behavior / light 计数增长；
- Shop 加入、撤销、失败、成功：App Shell / Header 节点身份不变；
- Shop 中部目录与右侧结算区的滚动不被无关更新重置；
- 主题浮窗打开、拖动后，Shop 内部更新不销毁浮窗；
- Popover / Modal 的锚点和焦点不跨更新串线；
- Shop A → B、Character A → B、Service → Game 后旧更新无效；
- 记录 1280、900、760、640、375 宽度下的布局与滚动回归；
- 用浏览器 Performance 面板补充脚本 / Layout / Paint 证据。

## 八、工程门禁

每个代码切片必须执行：

```text
npx tsc --noEmit
npm test
npm run check:architecture
npm run build 或 npx vite build --outDir <临时目录>
```

本任务预期只修改 `src/ui/`、`tests/ui/` 和本任务文档，不修改 `src/engine/types/`，因此默认不需要 `npm run gen:schema`。如果施工中改变了引擎实体类型，必须立即补做 Schema 同步并重新评估任务范围。

## 九、风险、回滚与停止条件

### 风险

| 风险 | 处理 |
| --- | --- |
| Dispatcher 变成新的隐式全量刷新入口 | 每次更新记录最终 scope；拒绝无 reason 的结构升级 |
| Token 只检查类型、不检查实例 | key + generation 双重匹配测试 |
| Host Registry 承担过多运行时职责 | 独立 `UISurfaceRuntime`，不把 DOM 放入静态 Registry |
| Shop 三栏派生不一致 | 一次构建 `ShopWorkspaceView`，同一 flush 共享 |
| 重建后事件绑定丢失 | Region 替换后只绑定目标 Region，并做节点身份测试 |
| 重复资源节点只更新第一个 | 统一 Host 范围或 `querySelectorAll()`，补 Shop 测试 |
| 失败交易清空购物车 | 保留 Task 0039 失败路径回归 |
| 过早优化 Reveal | P5 后置，先不复制引擎依赖索引 |

### 停止条件

- 旧 Token 仍能写入新 Surface；
- Shop 失败 / 成功 / 撤销语义发生变化；
- Header、聊天、主题浮窗、Popover、Modal 或滚动状态回归；
- 增量更新要求新增持久状态或绕过 `GameCommands`；
- 不能证明更新范围小于原先 Root Render；
- 自动化测试通过但浏览器出现跨 Workspace 串写或可见状态不一致。

### 回滚策略

第一施工片段必须保留兼容开关或可逆适配边界：

- Dispatcher handler 可以回退到旧 `refreshPanels()` / `render()`；
- 新 Behavior 标记可以与旧专用标记并存；
- 不删除旧 renderer，直到 P4 的浏览器验收完成；
- 不修改交易领域代码，以便 UI 增量失败时只回退 UI 适配层。

## 十、完成定义

本任务只有同时满足以下条件才能标记完成：

- [x] P0 刷新统计可区分 full / workspace / region / behavior / stale；
- [x] P1 Token 可阻断旧 Workspace / Service 更新；
- [x] P2 Dispatcher 完成第一批兼容接入，并有去重、优先级、Region 覆盖和 stale drop 测试；
- [x] P3 首批 Behavior 覆盖 resource / gain / spot yield，且不影响普通 Tick；
- [x] P4 Shop 同 Workspace 的加入、撤销、失败、成功已不再无条件 Root Render；
- [x] Shop 交易语义、主题生命周期、Feed、Session 和 DOM 身份无回归；滚动容器保持策略已接入并通过结构回归；
- [x] `npx tsc --noEmit` 通过；
- [x] `npm test` 通过（140 files / 1295 tests）；
- [x] `npm run check:architecture` 通过；
- [x] 生产构建通过；
- [x] 浏览器已完成 Game Tick、Shop 加入/撤销/成功结算、主题浮窗保留、Service → Game 返回冒烟；Character 由自动化生命周期测试覆盖，未在当前展示世界线重复造数据；
- [x] 本文施工记录、测试结果和遗留项已更新；
- [x] 未把未经裁定的 P5–P7 误标为完成。

## 十一、实施记录

### 2026-09-11：任务建立

- [x] 已阅读并核对 `docs/docs-828/00-INDEX`、`docs/0x-plan&work/00-index`、UI 模块文档、架构纪律、测试规范和相关 Task；
- [x] 已核对 Sol 两份输入与当前源码；
- [x] 已完成 `npx tsc --noEmit`、`npm run check:architecture`、`npm test` 和构建基线；
- [x] 已确认普通 Game 的局部更新已存在，Workspace / Service fallback 是本任务的主要施工对象；
- [x] P0–P4 代码施工；
- [x] 施工后重新执行工程门禁和浏览器验收；浏览器 Character 路径保留为自动化测试覆盖项。

### 2026-09-11：P0–P4 施工结果

- [x] 新增 `src/ui/update/ui-surface.ts`、`ui-update-types.ts`、`ui-update-dispatcher.ts`、`ui-behaviors.ts`；
- [x] `UIController` 增加 Surface token、更新调度、批量 Region 派发、可观测统计和最近更新记录；
- [x] `refreshLight()` 收口到 `resource.value`、`resource.gain`、`spot.yield` Behavior；
- [x] Shop 加入、撤销、结算成功 / 失败、揭示刷新改为 Shop Host Region 更新；同一批 Region 共享一次 Shop renderer 派生；
- [x] 新增 Dispatcher / Surface 单测；扩展 Shop UI 测试覆盖节点身份、失败保留购物车和资源行为；
- [x] 浏览器验证：Game Tick 的 `full` 保持不变；Shop 加入 / 撤销 / 成功结算期间 `full` 保持不变，`region` / `behavior` 计数增长，主题浮窗保持打开，Service 可返回 Game；
- [x] 首次并行全量测试出现 1 次既有 `story-entry-split` 时序波动，单测重跑通过；最终 `npm test` 通过 140 files / 1295 tests。

### 遗留与后续

- P5：拆分 Reveal 分类指纹、显式事件到最小 Region 的映射，并逐步收窄 `onAny`；
- P6：只有 Region 重建仍被测量证明为瓶颈时，才引入 Keyed Collection Reconcile；
- P7：评估 `WorkspaceRoute` 与稳定 Shell seam，进一步减少 Service / Workspace 的结构级刷新；
- 浏览器 Character A→B 的专门剧本未在本片新增数据前提下执行，现由 `workspace-lifecycle.test.ts` 的 Character 路径和 Surface 单测覆盖。

## 相关文档与代码入口

- [[docs/0x-plan&work/review/ui-incremental-update-workspace-isolation-draft]]
- [[docs/0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/0x-plan&work/active/task-0039-sol-review]]
- [[docs/0x-plan&work/active/task-0039-spot-shop-transaction-system]]
- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]
- [[docs/0x-plan&work/completed/task-0044-ui-geometry-workspace-reshape]]
- [[docs/0x-plan&work/active/task-0047-contacts-story-workspace-ownership]]：承接 P7 以及 P5 中与 Contacts / Story 刷新隔离相关的优先后续施工。
- [[docs/docs-828/02-modules/ui]]
- `src/ui/controller.ts`
- `src/ui/controller-core.ts`
- `src/ui/controller-events.ts`
- `src/ui/ui-host-registry.ts`
- `src/ui/components/workspace-frame.ts`
- `src/ui/components/shop.ts`
