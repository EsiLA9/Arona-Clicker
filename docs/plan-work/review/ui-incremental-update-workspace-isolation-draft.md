# UI 增量更新 / Workspace 隔离重构草案

> 状态：🟡 草案，已完成源码事实核查，尚未形成 ADR 或施工任务
>
> 核验日期：2026-09-11
>
> 本文目的：汇总 Sol 提供的两份 UI 增量更新意见，并以当前仓库源码、现有计划和测试结果为依据，区分已证实事实、合理推断、尚待验证事项和需要修正的建议。

本文属于 `docs/plan-work/review/` 下的设计审查记录，不是机制正文，也不授权直接施工。稳定机制仍以 `docs/docs-828/` 为准；如果后续决定实施，应从本文拆出独立 Task，涉及路由或边界裁定时再建立 ADR。

## 一、输入材料与核验范围

### 输入材料

- Sol 现状分析：`C:/Users/15229/.codex/attachments/519131c1-9a2d-4d02-8472-2ed055f01e0a/pasted-text.txt`
- Sol 增量更新 / Workspace 隔离方案：`C:/Users/15229/.codex/attachments/4ff42488-b21b-4249-b411-80f1bafcad13/pasted-text.txt`

### 主要核验对象

| 范围 | 当前入口 |
| --- | --- |
| UI 控制器与刷新 | `src/ui/controller.ts`、`src/ui/controller-core.ts`、`src/ui/controller-events.ts` |
| Workspace 结构 | `src/ui/components/app-shell.ts`、`workspace-frame.ts`、`shop.ts`、`character-workspace.ts`、`service-workspace.ts` |
| Host / 表现层 | `src/ui/ui-host-registry.ts`、`src/ui/presentation-service.ts`、`src/ui/controller-theme.ts` |
| 领域事件与可见性 | `src/engine/effect/event-driven-reactor.ts`、`src/engine/visibility/`、`src/engine/expression/condition-deps.ts` |
| 既有规划 | `roadmap-0015-ui-dom-recalculation`、`task-0039-sol-review`、`task-0040-unified-workspace-frame`、`task-0044-ui-geometry-workspace-reshape` |
| 回归测试 | `tests/ui/workspace-lifecycle.test.ts`、`controller-tab-linkage.test.ts`、`workspace-frame.test.ts` 及全量测试 |

## 二、先给结论

Sol 的核心判断成立，但适用范围需要收窄：

> 当前 UI 的结构层已经完成相当程度的 Workspace 化；真正尚未收敛的是“状态变化如何映射到刷新范围”的控制器模型，尤其是功能 Workspace / Service Workspace 分支。

这不是“整个 UI 仍然只有 `state changed → render()`”。普通 Game 已经有轻量刷新、面板刷新、聊天区域刷新、日志区域刷新和刷新计数；真正的问题是，一旦进入 `panelState.workspace`，`refreshPanels()` 会直接退化为 `render()`，Service / Inventory / Settings 也缺少一个可保留顶层壳的局部 Workspace 更新出口。

因此建议：

1. 采纳“Behavior → Region → Workspace → Root”的更新分层。
2. 采纳 Surface Token / generation 作为异步更新的过期保护。
3. 采纳显式更新调度器和 dirty 合并，但先保留旧刷新接口作为兼容层。
4. 以 Shop 作为第一套完整的增量 Workspace 试点，但只处理同一 Workspace 内的更新；进入、退出、切换服务和 Lobby/Init 路由仍可使用结构刷新。
5. 保留字符串 renderer，不引入 Virtual DOM 或完整响应式框架。
6. 不把 `UIHostRegistry` 直接扩展成 DOM 运行时；它目前是表现宿主定义和父级关系注册表，应另建 UI Surface / Update Boundary 运行时层。
7. 不把“Condition Dependency Index 尚不存在”当作事实。引擎已经有共享的 `ConditionDepIndex` 和 `VisibilityEngine` 增量标脏链；后续要设计的是 UI 展示级 Reveal 的定向映射，而不是重新发明引擎级索引。

## 三、Sol 方案的完整设计摘要

### 3.1 核心原则

- 状态值变化不自动等于 DOM 结构变化。
- 字符串 renderer 继续负责首次生成和结构变化；稳定节点的数值、状态、属性变化优先使用 DOM patch。
- 更新操作必须表达语义目标，而不是继续让 Controller 到处调用 `refreshXXXPanel()`。
- 更新范围按实际影响从小到大升级：

```text
Behavior Patch
    ↓ 无法表达
Region Render
    ↓ 结构或集合发生变化
Workspace Render
    ↓ App 路由或根壳发生变化
Root Render
```

- Patch 不能因为目标节点不存在就直接升级成 Root Render。
- 所有延迟、异步、事件驱动更新都必须绑定当前 Surface 实例，旧 Workspace 的更新到达时应被丢弃。

### 3.2 目标更新模型

Sol 建议新增类似 `UIUpdateDispatcher` 的 UI 层调度器，统一接受三种更新：

```ts
type UIUpdate =
  | UIBehaviorUpdate
  | UIRegionUpdate
  | UIStructuralUpdate;

interface UIBehaviorUpdate {
  type: 'behavior';
  behavior: string;
  key?: string;
  payload?: unknown;
}

interface UIRegionUpdate {
  type: 'region';
  hostId: string;
  reason?: string;
}

interface UIStructuralUpdate {
  type: 'structure';
  scope: 'workspace' | 'app';
  reason?: string;
}
```

这组接口表达的是方向，不应原样作为最终合同使用。正式接口应补充：

- Surface Token；
- 更新目标的明确类型；
- 当前 Surface 的根元素或 Host 解析上下文；
- 行为所需的类型化参数，而不是大面积 `unknown`；
- 更新失败的诊断级别；
- 同一批更新的去重和覆盖关系。

Controller 的目标调用形式从：

```ts
this.refreshPanels(['left', 'right']);
```

逐渐变成：

```ts
this.updates.request({
  type: 'behavior',
  behavior: 'resource.value',
  key: resourceId,
});
```

或：

```ts
this.updates.request({
  type: 'region',
  hostId: 'shop.catalog',
});
```

真正改变工作区结构时才请求 Workspace 级结构更新。

### 3.3 Surface Token / Workspace 隔离

建议在 UI 层建立不可持久化的 Surface 身份：

```ts
interface UISurfaceToken {
  key: string;
  generation: number;
}
```

候选 key 包括：

```text
game
service:settings
service:inventory
service:datapack
shop:<spotId>:<shopId>
character:<variantId>
```

每次 Service / Workspace 的进入、退出、替换或实例切换递增 generation。更新真正操作 DOM 前检查：

```ts
if (!controller.isSurfaceCurrent(token)) return;
```

只比较 `workspace.type` 不够，因为 `Shop A → Shop B`、`Character A → Character B` 时类型可能相同。必须同时比较实例 key 和 generation。

Token 解决的是“旧回调不应修改新页面”的问题，但不能单独解决：

- 重复绑定的监听器；
- 忘记释放的主题或观察器；
- 错误的 Host 归属；
- 同一个当前节点被多个事件重复刷新。

因此 Token 必须与单一 dispose、更新权限和调度合并一起落地。

### 3.4 Workspace 作为刷新边界

当前已经存在一棵 Host 定义树。Sol 建议进一步让 Host 承担“谁可以更新这个区域”的边界职责：

```text
game.workspace
 ├── game.left
 ├── game.center
 └── game.right

shop.workspace
 ├── shop.messages
 ├── shop.catalog
 └── shop.checkout
```

刷新 `shop.checkout` 只能影响该 Host 及其 descendants，不能修改 `shop.catalog`、`game.right` 或 `app.header`。开发环境可提供 `assertHostOwnedByCurrentSurface(hostId)`。

这里建议使用独立的运行时边界对象，而不是直接改变现有 `UIHostRegistry` 的含义：

```ts
interface UISurfaceRuntime {
  token: UISurfaceToken;
  root: HTMLElement;
  resolveHost(hostId: string): HTMLElement | null;
  canUpdate(hostId: string): boolean;
}
```

`UIHostRegistry` 继续负责 Host 定义、父级、层级、服务归属和主题编辑器发现；运行时对象负责当前 DOM 实例和更新权限。

### 3.5 Behavior Patch

现有 `refreshLight()` 已经是 Behavior Patch 的原型，只是多个行为都集中在一个函数中。建议逐步拆出规则化行为，例如：

```text
resource.value
resource.gain
spot.yield
spot.available
button.enabled
condition.state
shop.stock
shop.selection
shop.total
character.level
character.affection
progress.value
badge.count
```

renderer 输出静态 DOM 合同，Behavior 负责更新合同：

```html
<span
  data-ui-behavior="resource.value"
  data-ui-key="credit"
></span>
```

迁移期可以保留现有专用属性：

```text
data-resource
data-gain
data-spot-yield
data-shop-select
```

不要要求一次性迁移所有标记。新协议至少应统一：

```text
data-ui-host
data-ui-behavior
data-ui-key
data-ui-role
```

行为处理器必须在当前 Surface 的根范围内查找节点，不能重新回到全局 `root.querySelector()` 造成同名节点串写。

### 3.6 Region Render 与 Keyed Collection

当数量、排序或内部结构变化时，不必做单节点 patch，可以重建自己的 Region：

- Shop 商品首次 Reveal；
- 角色列表增加条目；
- Inventory 筛选后的列表；
- 故事列表或强化列表结构变化；
- 购物车行增删。

第二阶段可加入轻量 keyed list reconcile：

```text
没有 → append
消失 → remove
顺序变化 → move
dirty → replace item
```

这不是第一阶段必需，也不等于引入 Virtual DOM。第一阶段先确保 Region 有稳定 Host、稳定边界和正确的事件重绑定。

### 3.7 Reveal 与事件映射

当前 UI 级 Reveal 指纹可以先从单一字符串拆为分类结果：

```ts
interface RevealFingerprint {
  spots: string;
  enhancements: string;
  inits: string;
  areas: string;
  stories: string;
}
```

分类变化只请求相关 Region，例如：

```text
Story Reveal → story region
Spot Reveal → area/spot region
Enhancement Reveal → enhancement region
```

后续如果仍有必要，再研究 UI 展示级 Condition Dependency Index。该索引不能与引擎已有的可见性依赖索引混为一谈，也不能因为 UI 优化把 DOM 或主题概念倒灌进基础引擎。

事件映射应逐渐从：

```text
EventBus.onAny
  → Reveal 全局检查
  → 日志刷新
```

转成显式映射：

```text
resourceChanged
  → resource.value / resource.gain

shopPurchased
  → shop.stock / shop.total / resource.value / log

characterProgressChanged
  → character.affection / badge

storyCompleted
  → story region / log / chat
```

`onAny` 不必立即删除，可以降级为兼容性安全网和开发诊断入口；但必须避免它继续偷偷发起同一批全局刷新。

### 3.8 DirtyScope 与批处理

一次结算可能同时改变资源、物品、库存、购物车、统计和日志。调度器可以在一次同步边界内收集更新，并用 `queueMicrotask(flush)` 合并：

```text
resource.value:credit
resource.value:credit
resource.value:credit
```

只执行一次。若同一 Host 已经被标记为 Region dirty，则其 descendants 的 Behavior 更新可以被丢弃。

推荐覆盖顺序：

```text
App structural
    覆盖全部

Workspace structural
    覆盖当前 Workspace 的 Region / Behavior

Region
    覆盖该 Region descendants 的 Behavior

Behavior
    最细粒度
```

批处理必须保持业务事件顺序和最终数据一致性，不能为了少刷 DOM 而改变聊天、奖励、交易收据或主题层的语义顺序。

### 3.9 Fallback 阶梯

建议将失败恢复定义成明确的阶梯：

```text
Patch
  ↓
Region
  ↓
Workspace
  ↓
App
```

更精确的处理规则：

| 情况 | 处理 |
| --- | --- |
| Token 已过期 | 静默丢弃，必要时记录调试统计 |
| 当前 Surface，但 Host 尚未挂载 | 丢弃或延迟到结构挂载，不立即 Root Render |
| 当前 Surface，Host 存在但 DOM 合同异常 | 开发环境 warning，并请求最小 Region 修复 |
| Host 本身不存在 | 请求 Workspace 级结构恢复 |
| App Shell / 路由无法确认 | 才允许 Root Render |

“目标节点不存在”不能作为 Patch 直接升级到 Root Render 的理由。

### 3.10 Root Render 的目标范围

最终希望 `render()` 在正常游戏过程中变成少数情况：

- 首次挂载；
- Lobby / Init 选择页与 Game 路由切换；
- Service 路由切换；
- Workspace 进入、退出或替换；
- App Shell 结构确实改变；
- 灾难恢复；
- 开发环境强制刷新。

但“Root Render 很少”只应作为正常游玩路径的目标，不能误读为全局绝对禁止。当前主题编辑器、选择页、部分弹窗流程仍使用完整 render；这些应单独计入结构刷新或编辑器刷新统计，不应与普通 Tick 混为一谈。

## 四、当前仓库事实核查

核查结论分为：

- **已证实**：源码和测试直接支持；
- **部分成立**：方向正确，但范围或实现描述不准确；
- **尚待验证**：需要浏览器性能测量、真实用户流程或进一步代码追踪；
- **不成立 / 需修正**：与当前源码或既有裁定冲突。

### 4.1 结构、刷新与路由

| Sol / 现状主张 | 结论 | 当前证据与修正 |
| --- | --- | --- |
| UI 已有局部更新雏形 | **已证实** | `UIController.refreshPanels()` 做普通 Game 的栏级替换；`refreshChatPanel()`、`refreshLogPanel()` 做更小区域替换；`refreshLight()` 做文本节点更新。 |
| Workspace Frame 已统一 | **已证实，但不是刷新系统** | `workspace-frame.ts` 统一 `WorkspaceFrameSpec`、三列、`surface`、`scroll`、`responsive` 与 `renderUIHost()` 接线。Task 0044 已将 Game、Service、Shop、Character、Inventory 纳入当前结构契约。 |
| `renderAppShell()` 是顶层工作区路由器 | **已证实** | `app-shell.ts` 按 `service` 分流 Settings / Inventory / Service，再按 `workspace` 分流 Shop / Character / Game。 |
| Workspace 激活后 `refreshPanels()` 回退到完整 render | **已证实** | `controller.ts:364-370` 明确在 `panelState.workspace` 存在时调用 `this.render()`。 |
| Service / Settings / Inventory 也缺少真正的栏级刷新 | **基本已证实** | `refreshPanels()` 只认可 `.workspace`；Service / Settings / Inventory 的 Frame 使用 `service-workspace`、`settings-workspace`、`inventory-workspace` 等类，而非普通 Game 的 `.workspace`，因此会落入 `!root.querySelector('.workspace')` 的完整 render 分支。现有测试主要验证结构保留，不是性能计数断言。 |
| `render()` 会重建整个 App Shell | **已证实** | `controller.ts:472` 执行 `root.innerHTML = renderAppShell(...)`，随后重新绑定 actions、恢复滚动、应用主题和恢复主题浮窗。 |
| 全量 render 会丢失旧 DOM 身份和节点级状态 | **已证实为 DOM 机制，影响范围需具体区分** | 旧 `#app` 子树确实被替换；节点级 listener、focus、selection、observer、动画和临时 DOM 状态需要重新绑定或恢复。事件委托、body 级 Modal / Popover 等部分状态有独立生命周期，不能笼统说“所有 UI 状态都丢失”。 |
| `scheduleRender()` 已有合并机制 | **已证实** | `controller.ts:353-360` 使用 `renderScheduled` + `queueMicrotask` 合并同一同步链中的 Root Render。它合并的是完整 render，不是通用的 Behavior / Region dirty 更新。 |
| 当前已有刷新计数 | **已证实** | `UIRefreshStats` 已统计 `fullRenders`、`panelRefreshes`、`lightRefreshes`、`themeApplications`，并写入 `#app` 的 `data-ui-refresh-*`。Sol 的 P0 统计建议可以扩展，但不是从零开始。 |

### 4.2 Host、Workspace 生命周期与 Shop

| Sol / 现状主张 | 结论 | 当前证据与修正 |
| --- | --- | --- |
| 已有 UI Host Registry 和 parent tree | **已证实** | `UIHostRegistry` 提供 `all()`、`get()`、`childrenOf()`、`descendantsOf()`、`resolveParent()`、`forService()`、`validate()`。 |
| Host Registry 已经是运行时刷新边界 | **不成立 / 需修正** | 当前 Registry 只保存 Host 定义、层级、kind、serviceId、状态和兼容区域信息；没有 `element`、Surface Token、generation、`resolve()` 或更新权限。 `renderUIHost()` 只生成 `data-theme-host-id` 等表现元数据。 |
| Workspace 已有独立 UI 生命周期 | **部分成立** | Controller 有 `disposeWorkspace()`；Shop 退出时清理 Session、释放 ephemeral theme 并恢复 ReturnContext，Character 也复用返回上下文。但 Workspace 状态没有 `mount()` / `dispose()` / `refresh()` 实例合同，也没有过期 Token 和独立监听器集合。 |
| 当前存在 Workspace 身份的双入口 | **已证实** | `PanelState` 同时有 `service` 和 `workspace`。这是 Task 0040 F5 计划后续收敛为 `WorkspaceRoute` 的已知问题，不应在本草案中未经裁定直接重写。 |
| Shop 是最适合作为试点的 Workspace | **合理且建议采纳** | Shop 有规则化商品、库存、购物车、成本和结算，但现有动作与 Workspace 渲染都仍以 `ctrl.render()` 为主，改造边界清晰。 |
| Shop 三栏已经有独立 Host | **已证实，但要区分“声明”和“更新能力”** | `service-definitions.ts` 已登记 `leftPanel.shop.feed`、`centerPanel.shop.catalog`、`rightPanel.shop.settlement`；`shop.ts` 也用这些 ID 渲染。它们还不是可直接调用的 Region Runtime。 |
| Shop 一次派生 View 已完成 | **部分成立** | `shop.ts` 的 `buildView()` 在一次 `renderShopWorkspace()` 中计算 `entries`、`feed`、`cart`、`costs` 和 `canCheckout`，三栏共享该结果。这已经满足上一轮 Shop 设计的主要意图，但还不是独立的 `ShopWorkspacePresenter`，且 `renderHoldings()` 仍直接读取当前 Game View。 |
| Shop 目前已有 stock / selection / total 的行为标记 | **不成立** | 当前可见标记主要是 `data-shop-select`；商品状态、库存、已选数量、价格和结算区域是字符串一起生成的，没有 `data-shop-stock`、`data-shop-selection`、`data-shop-total` 等稳定 Patch 合同。 |
| Shop 的同 Workspace 操作目前会重建 App Shell | **已证实** | 加入清单、撤销、结算成功和失败路径都调用 `ctrl.render()`；现有 `shop-modal.test.ts` 验证的是状态和主题生命周期，不是无 Root Render。 |
| Shop 失败不清空购物车、撤销只清购物车 | **已证实** | 当前失败分支追加 error Feed 后 render，未调用 `session.clear()`；成功才清 cart；撤销清 cart 但仍留在 Workspace。该语义与既有 `task-0039-sol-review` 一致。 |
| `refreshLight()` 已能覆盖所有高频数字 | **部分成立** | 它更新 frame、Credit、Pyroxene、两种 gain 和所有 `data-spot-yield`，但仅处理有限资源集合；资源值使用 `querySelector()` 而不是 `querySelectorAll()`，在 Header 与 Shop 结算区存在重复资源节点时只会命中第一个；Shop holding 也没有同样的轻量标记。待增量 Shop 设计时必须补充测试。 |

### 4.3 EventBus、Reveal 与依赖索引

| Sol / 现状主张 | 结论 | 当前证据与修正 |
| --- | --- | --- |
| UI 存在宽广播 `EventBus.onAny` 刷新入口 | **已证实** | `controller-events.ts:14-19` 对除 `tick` / `spotProduced` 外的事件统一调用 `refreshRevealIfChanged()` 和 `refreshLogPanel()`。 |
| 任意普通事件都可能触发 Reveal 全局检查 | **已证实，但有 200ms 节流** | `controller-core.ts:50-60` 用 `Date.now()` 做 200ms 节流，然后比较全局指纹。不是每个事件都无条件重建，但会进入检查入口。 |
| Reveal 指纹遍历 Spot / Enhancement / Init / Area / Story | **已证实** | `computeRevealFingerprint()` 逐类遍历并拼接字符串；Story 使用 active 与 passive story entries。 |
| Reveal 指纹改变后刷新 left + right | **已证实** | `refreshRevealIfChanged()` 请求 `refreshPanels(['left', 'right'])`；进入 Workspace 后又会按当前 fallback 重建整个 App。 |
| 当前没有任何 Condition Dependency Index | **不成立 / 需修正** | `src/engine/expression/condition-deps.ts` 已实现共享 `ConditionDepIndex`；`VisibilityEngine` 通过 `VisibilityIndex` 按事件对存在性揭示增量标脏，Affector / PassivePool 也复用该索引。尚未存在的是 UI Tooltip 级“展示阶段变化 → UI Region”映射。 |
| 引擎自身也依赖 `onAny` 做全局扫描 | **不成立 / 需修正** | `EventDrivenReactor` 明确使用按事件类型分桶订阅；`VisibilityEngine` 调用 `subscribeTo(CONDITION_DEP_EVENT_TYPES)`。宽 `onAny` 主要是 UI Controller 和 Runtime 的日志记录入口，不能把两者混为一谈。 |
| 第二阶段可以直接建立 Resource / Flag → UI 条目的依赖图 | **方向合理，接口尚待设计** | 需要先确认 UI Reveal 阶段和引擎 Visibility 快照的差异，再决定是消费既有受影响实体集合、扩展只读 ReadModel，还是建立 UI 专用映射；不能把 Tooltip 的 `nameKnown` / `conditionKnown` / `utilityKnown` 简化成单一 existence 状态。 |

### 4.4 DOM 协议与性能证据

| Sol / 现状主张 | 结论 | 当前证据与修正 |
| --- | --- | --- |
| 当前已有少量专用 DOM Patch 标记 | **已证实** | `data-resource`、`data-gain`、`data-spot-yield` 被 Header / Production renderer 输出并由 `refreshLight()` 消费。 |
| 已有统一 `data-ui-behavior` 协议 | **不成立** | 当前仍以业务专用属性和 CSS class 为主；统一行为协议属于新设计。 |
| DOM patch 是零散手写的 | **部分成立** | `refreshLight()`、主题 Host 背景刷新、选择页详情替换、聊天/日志局部替换均是明确的局部操作，但它们已有各自职责，不应直接合并成无边界的通用 DOM 工具箱。 |
| 当前已经证明存在严重的实际性能瓶颈 | **尚待验证** | 代码结构清楚显示 Workspace fallback 和宽 UI 广播会扩大 DOM 更新范围，但本轮没有采集每分钟 Root Render、单次操作耗时、布局/绘制成本或用户可感知闪烁数据。应把“过度刷新”作为高可信架构风险，而不是未经 profiler 证明的数值结论。 |
| DOM 写入规模较大 | **已盘点，但不是性能结论** | `npm run ui:callgraph` 报告 69 个 UI 文件、1220 个定义、1598 条可靠调用边、137 个 DOM 写入点（分布于 82 个函数）。这支持建立更新边界，但不能单独证明哪些写入最值得优化。 |

## 五、与既有计划的关系

### 5.1 `roadmap-0015-ui-dom-recalculation`

该路线已经完成当前范围的 P0 / P1 / P2：

- Tick 和资源产出走 `refreshLight()`；
- 常用 Game 动作和 Tab 使用局部刷新；
- 聊天、日志和揭示列表已有局部入口；
- 已有刷新统计和普通 Game 的浏览器验收。

因此本草案不应重新描述为“从零治理全量刷新”，也不应重复开启普通 Game 已完成的 P0。新工作应聚焦：

```text
普通 Game 已有的局部刷新
        ↓ 扩展
Workspace / Service 的局部刷新与隔离
```

### 5.2 Task 0040 / Task 0044

Task 0044 已完成 WorkspaceFrame、WorkspaceColumn、Host 接线、surface、scroll owner、响应式和多页面结构收敛。Task 0040 的后续未完成项仍包括：

- `service` 与 `workspace` 路由状态统一；
- Shop 的后续 Presenter / 一次派生 View 收口；
- `refreshPanels()` 不再依赖旧外层结构；
- Host Registry 与兼容 alias 的最终收尾。

因此，Surface Token 可以作为增量更新任务的 UI 层补强，但不应假设 `WorkspaceRouter` 已经存在，也不应在本任务里顺手完成 Task 0040 F5 的全部状态联合重构。

### 5.3 Task 0039 / Shop

Task 0039 及其 Sol 复审已经裁定：

- Shop Session 是临时意图状态，不是持久领域状态；
- ReturnContext 只保存导航身份；
- 价格、库存、余额和 affordability 必须按当前状态重新派生；
- 失败不清空购物车，撤销不释放 Workspace 主题；
- 事务成功后再清 Session、写 Feed、重新派生 View。

增量 UI 方案必须保持这些语义，不得为了 Behavior Patch 把价格、库存或 checkout 结果缓存成第二套状态系统。

## 六、经核查修订后的目标架构

### 6.1 分层关系

```text
GameReadModel / GameCommands / EventBus
                  │
                  ▼
        UI Update Planner / Event Mapping
                  │
                  ▼
          UIUpdateDispatcher
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   Behavior    Region    Structure
     Patch      Render     Render
        │         │         │
        └──── Surface Runtime ────┘
                  │
                  ▼
          Current DOM / Host Scope
```

边界职责：

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Event Mapping | 把领域事件映射成 UI 更新意图 | 修改 PlayerState、定义玩法联动 |
| Planner / Dispatcher | 去重、排序、Token 检查、升级 fallback | 自己求值所有领域规则 |
| Surface Runtime | 当前 Workspace 身份、根元素、Host 归属和权限 | 保存 PlayerState、替代 Host Registry 的主题定义 |
| Behavior | 稳定节点的 text/class/attr/progress 更新 | 生成不定长结构、跨 Surface 查找 |
| Region Renderer | 重建一个稳定 Host 内的结构 | 重建 App Shell、修改兄弟 Host |
| Workspace Renderer | 切换 Workspace 内容或整个三栏结构 | 偷偷扩大成 App 级更新 |
| Root Renderer | 首次挂载、路由/壳结构和灾难恢复 | 作为未知更新的默认兜底 |

### 6.2 建议的正式概念

```ts
interface UISurfaceToken {
  readonly key: string;
  readonly generation: number;
}

interface UIUpdateBase {
  readonly token: UISurfaceToken;
  readonly reason: string;
}

interface UIBehaviorUpdate extends UIUpdateBase {
  readonly type: 'behavior';
  readonly behavior: UIBehaviorId;
  readonly target: { readonly key: string };
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

这是概念合同。正式施工前还需裁定：

- `token` 是请求时捕获还是由异步生产者显式持有；
- Behavior 的 key 是资源/实体 ID，还是完整 DOM 目标 ID；
- Region 是否只能按 Host ID 更新，还是允许注册 Presenter；
- 更新失败是 drop、defer、warning 还是升级；
- 同一条领域事件是否只允许一个 Planner 产生 UI 更新。

### 6.3 更新权限规则

建议为每个可更新 Host 解析出当前 Surface 归属：

```text
当前 Surface
  └─ Workspace Host
       └─ Region Host
            └─ Behavior 节点
```

最低规则：

1. 更新目标必须属于请求 Token 的当前 Surface。
2. Region 只能替换自身的 Host 内容，不替换父级 Frame 或 sibling。
3. Behavior 只能访问自身 Host descendants。
4. App Header / Footer / Modal / Background 等跨 Workspace 对象必须单独声明，不得因 Workspace 更新顺带重建。
5. 开发环境记录越界、未登记 Host、重复 Host 和目标缺失。

### 6.4 不引入 Virtual DOM 的理由

保留字符串 renderer 是合理的：

- 当前页面本来就按结构区域生成 HTML；
- `renderWorkspaceFrame()` 已形成清晰的结构契约；
- 需要精细更新的内容主要是资源、库存、按钮状态、列表和聊天流；
- Virtual DOM 会引入额外的节点模型、diff 语义和生命周期，不会自动解决 Workspace 过期回调或错误刷新范围。

但“不引入 VDOM”不等于“到处手写 `querySelector`”。需要用 Host Scope、行为注册表、类型化目标和测试把局部 DOM 操作收口。

## 七、修订后的分阶段施工建议

建议把 Sol 原案的 P0–P5 改成以下切片。第一阶段只覆盖到 Shop 的同 Workspace 增量更新，不把 Reveal Dependency Graph 和 `WorkspaceRoute` 联合重构塞进同一个任务。

### P0：刷新基线与观测，不改变行为

目标：先确认哪些路径仍然 Root Render，并为后续回归提供预算。

工作项：

- 保留现有 `UIRefreshStats`，增加 `workspaceRenders`、`regionRenders`、`behaviorPatches` 或等价的 scope / reason 记录；
- 记录当前 Surface key、generation、更新来源和是否发生 fallback；
- 区分首次挂载、路由结构刷新、普通 Game panel、Shop 同 Workspace 操作、主题编辑器刷新；
- 为普通 Tick、普通 Game Tab、Shop 加入清单、Shop 撤销、Shop 结算失败/成功建立基线测试；
- 浏览器侧再测 Root Render 次数、脚本耗时和布局/绘制，不把 JS 计数冒充浏览器渲染成本。

验收：现有行为不变；普通 Tick 不增加 Root Render；测试能区分“允许的路由 Root Render”和“意外的同 Workspace Root Render”。

### P1：Surface Token / generation

目标：建立跨 Workspace 的过期更新防线。

工作项：

- 在 UIController 或独立 UI Runtime 中维护当前 Surface Token；
- `service` 切换、Shop / Character 进入、退出、替换和 Init 重启时更新 generation；
- Token 不进入 PlayerState、不进入存档、不参与玩法逻辑；
- 用 Shop A → Shop B、Shop → Character、Character A → Character B、Service → Game 测试旧更新被丢弃；
- 与 `disposeWorkspace()` 的主题释放和 Session 清理测试合并。

验收：旧 Token 永远不能修改当前 Surface；同类型不同实例也能隔离；重复调用 dispose 不重复恢复或释放。

### P2：Dispatcher 与兼容层

目标：统一更新入口，但不立即搬空现有 Controller。

工作项：

- 新增 `src/ui/update/`，最小包含更新类型、Dispatcher、Surface Runtime 和诊断能力；
- 将现有 `refreshPanels()`、`refreshChatPanel()`、`refreshLogPanel()`、`refreshLight()` 先作为兼容实现接入；
- 旧 `refreshPanels(['left'])` 暂时映射到 Game Region 更新；Workspace / Service 尚未支持的情况仍可明确请求结构刷新；
- 禁止新业务代码直接调用 `render()`，但暂时保留旧调用点并逐项迁移；
- 对每个更新请求记录 reason 和最终 scope，避免“Dispatcher 只是换名字”。

验收：旧测试全部通过；同一批同步事件可去重；未支持的更新只按明确 fallback 阶梯升级。

### P3：Behavior Registry 第一批

目标：把最稳定、最频繁的 DOM 改变从 renderer 中剥离。

首批只建议：

- `resource.value`；
- `resource.gain`；
- `spot.yield`；
- 必要时补 `button.enabled`。

工作项：

- 保留旧 `data-resource` / `data-gain` / `data-spot-yield`，新标记逐步增加；
- 所有查找限定在当前 Surface / Host Scope；
- 对重复资源节点使用明确的 `querySelectorAll()` 或目标 Host，而不是默认命中第一个节点；
- 目标缺失时按 Token / 当前 Surface / DOM 合同三层诊断，不直接 Root Render；
- 为资源节点、Spot yield 节点和 Shop 资源区补身份保留测试。

验收：普通 Tick 和资源变化只 patch 目标节点；非目标 Workspace 的同名节点不被更新；缺失节点不会引起整页刷新。

### P4：Shop 同 Workspace 增量试点

目标：证明一套真实 Workspace 可以在不重建 App Shell 的情况下完成交易操作。

建议的区域边界：

```text
leftPanel.shop.feed
centerPanel.shop.catalog
rightPanel.shop.settlement
```

建议映射：

| 操作 | 优先更新 | 允许的升级 |
| --- | --- | --- |
| 加入某商品 | 购物车 / 商品卡相关 Region 或 Behavior、settlement Region | 同 Workspace Region；不直接 Root |
| 撤销购物车 | `shop.settlement`、商品已选状态、Feed | 同 Workspace Region |
| 结算失败 | Feed、按钮状态、当前 settlement | 同 Workspace Region |
| 结算成功 | Feed、catalog 库存、settlement、资源 Behavior | 同 Workspace Region；若商品集合变化则 catalog Region |
| 条件导致商品首次出现 | catalog Region | Workspace 级结构，仍不必 Root |
| 离开 Shop | dispose + 返回 Game | Workspace / App 结构刷新均可接受 |
| 进入 Shop | 创建新 Surface + 生成 Shop 结构 | 当前可以保留 Root Render，直到稳定 Shell 挂载点完成 |

施工约束：

- 保留 `ShopSession` 的临时意图语义，不把派生库存或价格写回 Session；
- 保留 `buildView()` 一次派生、三栏共享的方向；若要拆 Region，抽出明确的 `ShopWorkspaceView` / Presenter，保证同一 flush 使用一致快照；
- 当前 Shop 没有 stock / total 等 Patch 标记，先补 DOM 合同和稳定容器，再写 Behavior；
- checkout 仍先由 ShopService 完成领域提交，UI 只消费成功/失败结果；
- 失败不清 cart，成功清 cart，撤销不释放主题；
- 对 Header、未受影响列、Modal、主题浮窗和滚动位置做节点身份回归。

### P5：Reveal 分类与显式 UI 事件映射

目标：切断 UI `onAny → 全局 Reveal 指纹 → left/right` 的宽路径。

第一步只做：

- 将 UI 指纹拆为 categories；
- 明确哪类变化对应哪些 UI Region；
- 继续使用当前求值语义，先不重写 Condition 系统；
- 让已知高频事件通过显式 UI Planner 产生更新；
- `onAny` 暂时保留为兼容性监测，并报告未分类事件。

第二步才评估 UI 专用依赖映射。应先对照已有 `VisibilityEngine` / `ConditionDepIndex` 的受影响集合，避免复制一套与引擎不一致的 Reveal 依赖语义。

### P6：Keyed Collection Reconcile（可选）

仅在 Region 重建仍成为可测量瓶颈时引入。先覆盖一个列表，验证键稳定性、顺序、事件绑定、滚动和焦点，再推广到角色、故事和 Inventory。

### P7：Root Shell / Route 最终收口

在 P1–P5 证明边界可靠后，再与 Task 0040 F5 对齐，评估：

- 是否将 `service` + `workspace` 收敛为 `WorkspaceRoute`；
- 是否把 `renderConsoleFrame()` 拆成稳定 Header / Workspace body / Footer 挂载点；
- 是否可以让 Game → Shop 只替换 Workspace body 而保留 App Shell；
- 是否删除旧 `refreshPanels()` 兼容层。

这一步不应作为 P0–P3 的隐含前置条件。

## 八、不可直接采纳的原案部分

### 8.1 不要把 Host Registry 变成万能运行时

现有 Host Registry 已承担表现编辑器和 Host 元数据共享职责。若直接在其中加入 DOM 元素、当前实例和更新权限，会把“静态定义”和“当前挂载实例”混在一起，也会让主题编辑器承担不必要的运行时责任。

建议拆成：

```text
UIHostRegistry       静态定义 / 父级 / 表现发现
UISurfaceRuntime     当前 Surface / DOM 根 / Token / 权限
UIUpdateDispatcher   更新排程 / 去重 / fallback
```

### 8.2 不要把 `payload: unknown` 作为最终更新合同

原案的 `payload?: unknown` 适合早期草图，不适合作为长期 API。行为 ID 一旦增多，未类型化 payload 会把错误推迟到运行时。可以先用判别联合，或让每个 Behavior 注册自己的参数类型。

### 8.3 不要把“节点缺失”一概静默吞掉

旧 Token 的更新静默丢弃是正确的；当前 Token 的 Host 缺失或 DOM 合同破坏则应在开发环境 warning，否则真正的 renderer 回归会变成无声数据不更新。三类情况必须分开：

```text
过期更新       → 丢弃
尚未挂载       → defer / 丢弃并记计数
当前结构异常   → warning + 最小恢复
```

### 8.4 不要立即重写所有 Reveal 依赖

引擎已经有事件分桶和依赖索引；UI 的全局 fingerprint 虽然粗，但它与 tooltip 级信息揭示不完全等同于 VisibilityEngine 的 existence 快照。先做分类 fingerprint 和显式 Region 映射，再用实际 profiler 决定是否需要 UI 专用索引。

### 8.5 不要把“Root Render 罕见”变成绝对禁令

Root Render 仍然适用于首次挂载、Lobby / Init 路由、Service 切换、Workspace 进入/退出、主题编辑器和灾难恢复。硬规则应限定为：

> 正常游戏状态变化不得请求比实际 DOM 影响范围更大的渲染；未知范围必须经过显式结构级理由，而不是默认调用 `render()`。

### 8.6 不要在 UI Controller 之外新增玩法联动

Event → UI 映射属于 `src/ui/` 的消费层。领域事件仍由引擎 / AronaClicker Runtime 负责，状态写入仍走 `StateMutationService` / `GameCommands`。Dispatcher 只能安排 UI 更新，不应成为新的游戏规则入口。

## 九、测试与验收设计

### 9.1 自动化测试

#### Surface 隔离

- Shop A 的延迟 Behavior 到达 Shop B 时不产生 DOM 写入；
- Character A 到 Character B 时，旧角色的 `character.affection` 更新被丢弃；
- 同一 `workspace.type` 的不同实例仍由 key/generation 区分；
- dispose 幂等，主题、Session、Feed 和返回上下文不重复处理。

#### 更新层级

- Behavior 只改目标节点，未受影响 Host 的节点身份不变；
- Region 只替换自己的 Host，兄弟 Host / Header / Footer 节点身份不变；
- Workspace 结构更新不默认替换 App Shell；
- Root Render 仅在显式结构原因或允许的路由操作中发生；
- Patch 目标缺失时不会自动 Root Render。

#### Shop

- 加入清单后同一 Shop 的 catalog / settlement / feed 正确更新；
- 失败不清空 cart；
- 成功清 cart，并使用成功后的新状态派生库存、资源和成本；
- 撤销只清 cart，不释放主题、不离开 Workspace；
- Shop A → 离开 → Shop B 不串用 Session、Feed、主题或旧 Region；
- 商品首次可见时 Region 更新，已有商品的节点身份按约定保留或明确替换。

#### Reveal / Event

- Story 类 Reveal 只使 Story Region dirty；
- Enhancement 类 Reveal 不刷新无关聊天和 Header；
- 已知事件只产生一组 UI 更新；
- 未分类事件进入诊断安全网，不偷偷 Root Render；
- 200ms 节流或新的 dirty 合并不改变最终可见语义。

### 9.2 浏览器验收

至少覆盖：

- 普通 Game Tick、资源变化和 Spot 产出；
- Game 三栏 Tab、聊天和日志滚动；
- Shop 加入、撤销、失败、成功、离开、重新进入另一个 Shop；
- Character 进入、切换学生、对话流和返回；
- Settings / Inventory / Datapack 等 Service Workspace 刷新；
- 主题浮窗、Popover、Modal、焦点和滚动保持；
- 1280、900、760、640、375 宽度；
- 使用 `getRefreshStats()`、DOM 节点身份和浏览器 Performance 面板同时记录证据。

### 9.3 工程门禁

每个代码切片至少通过：

```text
npx tsc --noEmit
npm test
npm run check:architecture
npm run build 或使用临时输出目录构建
```

如果修改 `src/engine/types/`，还必须执行 Schema 同步流程；本草案本身不修改引擎实体类型，因此当前不产生 `gen:schema` 义务。

## 十、开放问题与停止条件

### 需要在正式 Task 前裁定

1. Surface key 的规范：Service、Shop、Character 和普通 Game 是否统一为 `route + instance`。
2. generation 的递增边界：进入、退出、替换、重新 render 是否都递增，还是只在 Surface 身份变化时递增。
3. 当前 Shell 是否先拆成稳定挂载点，还是 P4 先接受 Shop 同 Workspace 之外的 Root Render。
4. Region Host 如何找到 renderer：Host ID 到 Presenter 的显式注册，还是 Controller 内部映射表。
5. `refreshLight()` 是否保留为专用 Tick 快速路径，还是改由 Dispatcher 统一调度但保留同等性能。
6. UI Reveal 是否直接消费 VisibilityEngine 的受影响实体，还是新增只读的展示级 Reveal 变更接口。
7. 是否需要把更新请求绑定到一次领域 commit / Event flush，而不是单纯按 microtask 合并。

### 停止条件

- Token 无法证明旧更新不会触达新 Surface；
- Region 替换导致聊天、主题浮窗、Popover、焦点或滚动回归；
- 同一结算产生跨 Region 的价格、库存、资源不一致；
- 为了增量更新而引入第二套 Shop 派生状态或绕过 `GameCommands`；
- 没有浏览器证据却继续扩大更新范围；
- 无法区分当前工作树既有变更和本任务新增变更。

## 十一、最终判断

### 建议采纳

- 保留字符串 renderer；
- 建立 Behavior / Region / Workspace / Root 分层；
- 建立 Surface Token + generation；
- 建立 Dispatcher 和 dirty 合并；
- 以 Shop 作为同 Workspace 增量更新模板；
- 让 `onAny` 从主更新路径逐步降级为兼容性诊断；
- 将“状态变化不得扩大到无关 DOM 范围”写入 UI 约束和代码审查清单。

### 建议修正后再采纳

- Host 更新权限：用 `UISurfaceRuntime` 承担，不直接改造 `UIHostRegistry`；
- Reveal Dependency Index：先消费或对接引擎现有依赖索引，再决定 UI 专用层；
- Root Render 罕见：限定在正常游戏路径，保留合法的路由、编辑器和恢复场景；
- 更新类型：从 `payload: unknown` 收敛为类型化判别联合；
- fallback：区分过期、未挂载和结构异常，不把所有缺失节点都静默吞掉。

### 暂不纳入第一份施工任务

- Virtual DOM；
- 全量 keyed reconcile；
- 立即完成 `WorkspaceRoute` 联合重构；
- UI Condition Dependency Graph；
- 直接删除 `onAny`；
- 以“每分钟减少多少毫秒”作为未测量的硬目标。

### 推荐的第一份正式 Task 范围

```text
P0 刷新观测
P1 Surface Token / generation
P2 UIUpdateDispatcher 兼容层
P3 Resource / Spot Behavior Registry
P4 Shop 同 Workspace 增量更新试点
```

但正式 Task 应明确：Shop 的进入/退出仍可使用 Workspace / App 结构刷新；本轮只要求 Shop 内部的加入、撤销、结算和资源变化不再无条件重建 App Shell。Reveal 分类、`WorkspaceRoute`、Keyed Collection 和 Root Shell 拆分作为后续任务。

## 十二、核验记录

本次核验执行结果：

| 项目 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过 |
| `npm run check:architecture` | 通过 |
| `npm test -- --reporter=dot --silent` | 139 个测试文件、1291 项测试通过 |
| `npm run ui:callgraph` | 69 个 UI 文件、1220 个定义、1598 条可靠调用边、137 个 DOM 写入点 |
| `npx vite build --outDir <临时目录>` | 通过；仅有既有 chunk size warning |
| 工作树状态 | 核验前无未提交变更；本文新增一份 review 草案 |

这些结果证明当前代码基线可构建、可测试、架构边界通过，也证明现有 Workspace fallback 是测试可观察的行为；它们不等于已经证明增量更新会带来确定的用户端性能收益。收益需要在实施后用节点身份、刷新计数和浏览器 Performance 数据共同验收。

## 相关文档

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/plan-work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/plan-work/active/task-0039-sol-review]]
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]
- [[docs/plan-work/completed/task-0044-ui-geometry-workspace-reshape]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
