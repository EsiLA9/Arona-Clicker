# Workspace 刷新边界统一：Workspace Router 与增量失效草案

状态：🔵 待评审（事实核验完成，尚未形成 ADR 或施工任务）

> 本文核对 Sol 提供的 Workspace 统一结构草案，并把“工作区拥有自己的刷新域”整理为后续设计方向。本文不改写 docs/docs-828/ 机制正文，也不把尚未裁定的方案描述成当前实现。

## 一、本文结论

Sol 的核心判断成立：Workspace 不应只统一三栏几何，还应成为 UI 更新的边界。当前实现已经完成物理骨架统一，并为 Shop 建立了第一个工作区区域刷新路径；尚未完成的是**路由、工作区和区域失效的正式类型边界**。

但 Sol 草案中的若干“当前事实”来自较早代码基线，需要修正：

1. Shop 的 renderShopWorkspace() 在当前本地 main 已返回字符串并通过 renderWorkspaceFrame() 输出，app-shell 的接口错位不再是当前故障。
2. Settings、Inventory 和 Service 虽没有显式命名为 takeover guard，但 refreshPanels() 在当前非 Game DOM 中找不到 .workspace，会走完整 render()；现有测试已覆盖其 Workspace 根节点不被 Game renderer 吞掉。因此这是脆弱的实现方式，而不是已复现的半工作区覆盖 bug。
3. Inventory 仍保留 .left-panel、.center-panel、.right-panel 兼容 class。这是实际的身份混用风险，但当前 guard 会阻止它进入普通 Game 面板替换路径；应作为清理项和回归测试，而不是宣称已经发生破坏。
4. Reveal 指纹确实没有覆盖 Item 和 Shop Entry。Item 可见性已经由 VisibilityEngine 计算，Inventory 在展示未拥有物品时会消费该结果；Shop 则由 ShopService.availability() 直接计算商品的揭示/条件状态。这两类变化目前没有完整映射到对应 Workspace 的刷新域，是当前可确认的失效缺口。

因此，本草案的第一优先级不是“所有 Workspace 一律整页重建”，而是把刷新分层并让调用者明确声明目标：

~~~text
App invalidation
└─ Workspace invalidation
   └─ Region invalidation
      └─ Behavior / text patch
~~~

已知影响范围时执行最小更新；暂时无法表达影响范围时，退回当前 Workspace 的完整渲染；跨 Workspace 或路由变化才提升到 App Shell。

## 二、核验基线

本次核验以工作区本地 main 的 HEAD 82e018f 为准。当前本地分支比 origin/main f91115f 多出 dom/init updates，所以 Sol 草案中针对早期 Shop 版本的接口异常不能直接套用到当前源码；若后续要以远端 main 为最终基线，应同步后重新执行本文核验。

核对入口：

- src/ui/components/app-shell.ts
- src/ui/components/workspace-frame.ts
- src/ui/components/shop.ts
- src/ui/components/character-workspace.ts
- src/ui/components/inventory-workspace.ts
- src/ui/components/settings-workspace.ts
- src/ui/components/service-workspace.ts
- src/ui/controller.ts
- src/ui/controller-core.ts
- src/ui/update/ui-surface.ts
- src/ui/update/ui-update-dispatcher.ts
- src/engine/visibility/visibility-engine.ts
- src/engine/visibility/visibility-index.ts
- src/arona-clicker/services/shop-service.ts

## 三、当前 Workspace 事实

### 3.1 物理结构已经统一

Game、Character、Inventory、Settings、Service 和 Shop 都由 renderWorkspaceFrame() 输出三列，并由 renderWorkspaceColumn() 接入 renderUIHost()。列上已有 slot、role、hostId、themeScope、surface、scroll 等元数据；Frame 自身只负责布局，不理解商店、剧情、物品或服务业务。

当前 Host 与工作区大致如下：

| Workspace | 入口状态 | 三栏语义 | 当前刷新方式 | 判断 |
| --- | --- | --- | --- | --- |
| Game | service = game，无 workspace | area / chat / spot | refreshPanels() 局部替换 | 当前唯一允许使用 Game panel renderer 的工作区 |
| Character | workspace.type = character | contacts / story / progression | refreshPanels() 退回完整 render() | 结果安全，但 API 语义不准确 |
| Inventory | service = inventory | navigation / primary / inspector | 非 .workspace DOM 退回完整 render() | 旧 panel class 仍存在，需清理身份混用 |
| Settings | service = settings | navigation / primary / inspector | 非 .workspace DOM 退回完整 render() | 已有 Workspace，缺少显式路由分支 |
| Datapack / Saves / Records | 对应 service | navigation / main / inspector | 非 .workspace DOM 退回完整 render() | 现阶段完整刷新是安全回退 |
| Shop | workspace.type = shop | feed / catalog / settlement | 指定 Shop Host 的区域替换 | 当前已有 Workspace 级增量样板 |

其中，WorkspaceFrame 为 game 添加旧 .workspace class，其它工作区只添加各自 legacy class。refreshPanels() 目前先判断 Shop，再判断 panelState.workspace，最后用 root.querySelector('.workspace') 判断是否可以进入 Game 面板替换。这解释了为什么 Service/Settings/Inventory 当前没有实际把 Game 右栏注入自己的 DOM，同时也说明该安全性依赖了 DOM class，而不是路由契约。

### 3.2 Shop 的当前状态

当前 renderShopWorkspace()：

- 返回 string，与 renderConsoleFrame() 接口一致；
- 通过 renderWorkspaceFrame() 输出 data-workspace-frame="shop"；
- 使用 leftPanel.shop.feed、centerPanel.shop.catalog、rightPanel.shop.settlement 三个稳定 Host；
- 加入清单、撤销、结算失败及揭示变化可请求指定区域刷新；
- ShopWorkspaceView 在一次派生中读取商品、价格、库存、购物车和结算预览。

因此，“修 Shop 的三栏 builder / 修返回类型”应从当前施工项改为**回归保护**。后续真正要做的是把 Shop 专用区域刷新能力抽象为一般 Workspace Region 失效入口，而不是再次重写 Shop Frame。

## 四、Sol 草案逐条正确性核验

| Sol 判断 | 核验结果 | 处理结论 |
| --- | --- | --- |
| 所有正式页面应通过 WorkspaceFrame | ✅ 当前成立 | 保留为结构基线；新增页面不得另造三栏外壳 |
| Shop 当前返回对象且被当成 string | ❌ 当前已修复，属于早期基线 | 改为回归测试，不列为 P0 故障 |
| 只有 panelState.workspace 才被 takeover guard 识别 | ⚠️ 实现层成立，行为层不完整 | Service/Settings/Inventory 由 .workspace 探测保护；应改为显式 Game route 判定 |
| Inventory 旧 class 可能命中 Game panel selector | ✅ 潜在风险成立 | 移除身份兼容 class，刷新系统改用 route/Host，不用视觉 class 判断 renderer |
| Character 的 refreshPanels(['right']) 实际会完整重渲染 | ✅ 当前成立 | 保留安全 fallback，同时把调用语义改成 Workspace/Region 失效 |
| Reveal 变化现在只刷新 Game 左右栏 | ✅ 当前成立 | 增加 Item 与 Shop Entry 的失效范围；不同 Workspace 按消费者刷新 |
| 不应让所有 Workspace 永远整页 render | ✅ 设计判断成立 | 采用 behavior → region → workspace → app 的渐进回退 |
| refreshPanels() 的名称会误导跨 Workspace 调用者 | ✅ 当前成立 | 第一阶段保留兼容层，新增明确的 invalidate* 入口；稳定后再收窄命名 |

## 五、当前已确认的问题

### 5.1 刷新所有权由 DOM 形状决定，尚未由路由决定

当前实际逻辑近似为：

~~~text
Shop workspace → Shop Host 区域刷新
其它 takeover workspace → 完整 render
root 有 .workspace → Game panels 局部刷新
否则 → 完整 render
~~~

这在当前页面集合中能工作，但有两个问题：

- 新增 Workspace 若意外复用 .workspace，可能进入 Game renderer；Contacts / Story 已改为显式 Frame 与 Workspace owner，但其它迁移期页面仍需沿用同一收口方向；
- 业务调用者仍可写 refreshPanels(['right'])，却无法从调用点看出它在 Character/Inventory/Service 中会变成完整工作区刷新。

目标应改为：

~~~text
当前 route = game 且无 takeover
  → Game panel / region 更新
当前 route = 某个 Workspace
  → 该 Workspace 的 Region 或 Workspace 更新
route 改变 / Workspace 进入退出
  → App Shell 结构更新
~~~

### 5.2 Inventory 的兼容 class 仍把视觉身份与刷新身份混在一起

Inventory 三栏当前仍带 .left-panel、.center-panel、.right-panel，而 Game 的 refreshPanels() 正是通过这些 class 查找替换目标。当前由于 Inventory 页面没有 .workspace，安全 guard 会先触发完整 render；但 class 继续存在会让未来的局部刷新、通用行为补丁或第三方组件误把 Inventory 当成 Game。

稳定身份应来自：

- data-workspace-frame="inventory"；
- data-workspace-column="left|center|right"；
- data-theme-host-id="...inventory..."。

旧 class 若仍被业务 CSS 使用，应暂时保留为样式 alias，但不得再被刷新逻辑当作 renderer identity。

### 5.3 Reveal 失效范围不完整

computeRevealFingerprint() 当前覆盖 Spot、Enhancement、Init、Area 和 Story，但没有覆盖：

- VisibilityEngine 已计算的 visibility.items；
- 当前 Shop 的商品 ShopEntryDef.revealTriggers / condition 结果。

这会产生两个可复现的 stale view 场景：

1. Inventory 关闭“仅显示已拥有”后，某个 Item 的 existence 条件因资源、标记或统计变化而满足，列表不会由当前 Reveal 检查自动补入该物品。
2. Shop 当前页的商品从 hidden/locked 变为 available，或者反向失效时，若没有其它直接点击触发，商品目录不会按商品自身条件刷新。

这不是要让 UI 重复实现 VisibilityEngine 或条件依赖索引；应让可见性/可售性变化提供可消费的失效信号，或至少在 UI 层按当前 Workspace 的真实消费者生成范围明确的 fingerprint。

### 5.4 当前增量基础设施已有，但只对 Shop 开放 Region 应用

UISurfaceRuntime 已提供 key + generation + mounted，UIUpdateDispatcher 已提供 stale surface 丢弃、同一轮合并和 structure/region/behavior 优先级，UIBehaviorRegistry 已提供资源、增益和 Spot 产出文本补丁。

当前 UIController.applyUIUpdate() 对 region 只接受 Shop 的三个 Host；Contacts / Story 已登记独立的三栏 Host，但首期仍通过 Workspace 完整刷新。这个边界是安全的第一片段，但还不是统一 Workspace 更新模型：Character、Inventory、Settings 和 Service 仍只能完整回退，Game 的 refreshPanels() 也没有进入同一套 Host/Region API。

## 六、拟议目标结构

### 6.1 路由与渲染分离

短期不立即破坏 PanelState.service + PanelState.workspace，先增加一个只读的路由判定层：

~~~ts
type ActiveWorkspace =
  | { type: 'game' }
  | { type: 'service'; service: 'settings' | 'inventory' | 'datapack' | 'saves' | 'records' }
  | { type: 'shop'; spotId: string; shopId: string }
  | { type: 'character'; variantId: string }
  | { type: 'contacts'; selectedVariantId: string | null }
  | { type: 'story'; selectedEntryId: string | null; conversationOwner: string | null; mode: 'overview' | 'playing' };
~~~

该类型第一阶段只用于决定刷新所有权，不作为新的持久状态，也不要求马上替换 PanelState。后续若验证稳定，再按 [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]] 的 Router 阶段收敛为正式 WorkspaceRoute。

### 6.2 四级更新边界

~~~text
Behavior
  只修改已挂载目标的文本/状态

Region
  替换一个稳定 UI Host，保留其它列、滚动和焦点

Workspace
  重建当前 WorkspaceFrame，保留 App Shell 外层

App
  路由、Header、Workspace 类型或全局结构发生变化时重建 #app
~~~

约束：

- 业务命令仍只能通过 GameCommands / StateMutationService 改状态；更新层只安排 DOM 变化。
- Surface token 不进入 PlayerState、存档或玩法计算。
- 旧 Workspace 的异步更新必须因 token/generation 不一致而静默丢弃。
- 已知影响区间优先 Region；不知道影响范围时，当前 Workspace 完整重建；跨路由才 App 重建。
- Frame 和 Column 不读取业务状态，不新增 WorkspaceFrameState 超级状态。

### 6.3 更新 API 的迁移方向

第一阶段建议增加显式入口，不立即删除旧 API：

~~~ts
invalidateGamePanels(['left', 'right']);
invalidateWorkspace({ type: 'workspace', reason: 'character-progress-changed' });
invalidateRegion({ hostId: 'rightPanel.shop.settlement', reason: 'shop-checkout-failed' });
~~~

其中：

- invalidateGamePanels() 只在 active workspace 为 Game 时调用；非 Game 调用应转为当前 Workspace 的完整刷新或记录诊断；
- invalidateWorkspace() 只作用于当前 Workspace，不替换 Header、Toast 和其它 App Shell 宿主；
- invalidateRegion() 只接受当前 Workspace 已登记、且属于该 Workspace 的 Host；
- refreshPanels() 先保留为兼容层，并在开发诊断中记录调用者仍使用旧语义的情况。

Shop 的现有 requestShopWorkspaceRefresh() 可作为 invalidateRegion() 的第一实现，而不是继续在 refreshPanels() 内增加 if (workspace) ... 分支。

## 七、施工切片草案

### P0：把当前安全回退改成显式路由边界

- 增加 isGameWorkspaceActive() 或等价的纯路由判定，不再用 .workspace 是否存在决定 renderer 类型。
- 将 refreshPanels() 的 Game 局部替换逻辑收口到 invalidateGamePanels()；Character、Inventory、Settings、Service 的调用转为 Workspace fallback。
- 保留 Shop 的 Host 区域更新，但从 refreshPanels() 的特殊分支迁移到统一 Region 适配层。
- 增加回归测试：在 Inventory 中调用旧 refreshPanels(['right']) 不得调用 renderRightPanel()；在 Settings/Service/Character 中不得改变为 Game Frame。

### P1：清理 renderer identity

- 盘点 left-panel / center-panel / right-panel 的 CSS 使用点。
- Inventory 等 Workspace 去除这些 class 的 renderer 身份含义；若 CSS 仍需要，改为样式 alias 或追加在不参与查询的内部节点。
- 更新局部刷新、聊天、日志和主题目标查找：优先使用 Workspace/Host/Region 标识。
- 增加静态测试或源码约束，禁止非 Game Workspace 通过 Game panel selector 进行结构替换。

### P2：统一 Workspace / Region 失效入口

- 将 Shop 的三个 Host、Character 的三个 Host、Inventory/Settings/Service 的三个 Host 纳入 Workspace Region Registry 或等价的静态定义。
- UIUpdateDispatcher 对 Region 更新做当前 Workspace 所属校验；不支持的 Region 必须记录 unsupported，不能静默写入其它页面。
- 对 Character/Inventory 首期允许 Region 更新失败后退回 Workspace render，不要求第一阶段一次完成所有细粒度 renderer。
- 保持 UISurfaceRuntime 的 generation 规则，补齐 workspace route 改变、同一 route 重新 mount 和旧 callback 的测试。

### P3：补齐 Reveal / 可售性失效

- 最小修复：把 Item visibility 纳入 Reveal 消费范围，并为 Inventory 的 ownedOnly = false 增加“条件满足后出现”的回归测试。
- Shop 当前工作区增加商品状态失效：至少覆盖 hidden/locked/available/sold-out 的变化，且只刷新 catalog/settlement 受影响区域。
- 优先复用 VisibilityEngine / ConditionDepIndex 的事件依赖，不在 UI 另造一套通用条件反向索引。
- 若事件类型不足，新增一个只读的 visibility/availability revision 或明确的 UI invalidation 事件；不得把 UI fingerprint 变成第二套玩法真相源。

### P4：正式收窄旧 API 与验收

- 将业务调用从 refreshPanels() 迁移到 invalidateGamePanels / invalidateWorkspace / invalidateRegion。
- 旧 API 仅保留兼容期，完成调用点清零后删除或改名。
- 更新 docs/docs-828/02-modules/ui.md 的刷新双轨说明，并把稳定机制迁入对应架构/模块文档；本草案随后转为完成记录或被 ADR 取代。
- 在浏览器完成 Game、Character、Inventory、Settings、Service、Shop 的路由切换、滚动保留、主题刷新和窄屏回归。

## 八、验收标准

### 正确性

- 任一非 Game Workspace 的更新请求都不能调用 renderLeftPanel、renderCenterPanel 或 renderRightPanel 替换其列。
- 任一 Region 更新必须验证 Host 属于当前 Workspace；旧 Surface 的更新被丢弃。
- 进入、退出或替换 Workspace 时，旧列、旧主题临时层和旧异步更新不会污染新 Workspace。
- Shop 的商品揭示/锁定状态、购物车、结算失败和成功后的库存/资源显示保持一致。
- Inventory 在未拥有物品可见模式下能响应 Item visibility 变化；Game、Service、Character 的 Reveal 消费者不被额外刷新污染。

### 性能与体验

- 普通 Tick 不触发 App 或 Workspace 结构刷新，只执行 Behavior patch。
- Game 面板变化只替换受影响的 Game panel；聊天和日志保留现有 Region 级刷新。
- Shop 常规购买动作不重建 App Shell；其它 Workspace 首期允许 Workspace 级完整刷新，但不应重建 Header 外的无关宿主。
- Region/Workspace 刷新保留已定义的滚动责任；窄屏列顺序、键盘焦点和主题 Host 继承不回归。

### 结构

- 新 Workspace 只需声明 Frame、Column 和 Host，不得另建三栏外壳。
- Frame 不包含业务分支；刷新路由不依赖视觉 class。
- 不新增 PlayerState、存档迁移或跨层 UI 写入口。

## 九、测试与验证

### 已执行核验（2026-09-12）

- npx tsc --noEmit：通过。
- npm run check:architecture：通过。
- npx vite build --outDir "$env:TEMP\acprogram-workspace-audit-build"：通过；仅有既有 chunk size warning，未写入受保护产物目录。
- 首次执行 npm test -- --reporter=dot --silent 时为 140 个测试文件通过、1 个测试文件失败；1304 个测试通过、1 个测试失败。失败项是 tests/ui/shop-modal.test.ts 的字符串空格断言，与本草案的 Workspace 路由/刷新边界无关。
- 随后发现工作树中已有一处独立的 Shop 断言调整，本轮未编辑该测试；执行 npx vitest run tests/ui/shop-modal.test.ts --reporter=dot --silent 后为 1 个文件、5 个测试全部通过。
- WorkspaceFrame、Service、Inventory、Settings、Character、Shop 生命周期相关测试均通过；全量测试尚未在该独立测试调整后重新执行。

### 待补专项测试

- refreshPanels() 在每种非 Game Workspace 下的 renderer 隔离测试；
- Inventory 旧 class 清理与 Host/Region 身份测试；
- Item visibility 变化触发 Inventory 更新测试；
- Shop Entry hidden/locked/available 变化触发 catalog 更新测试；
- Workspace route 改变时 Surface generation 与旧 callback 丢弃测试；
- Region 更新的 Host 所属校验与 unsupported 诊断测试；
- 900px、640px、375px 附近的 Workspace 路由、滚动和焦点浏览器验收。

## 十、非目标与风险

### 非目标

- 不在本草案中统一所有业务内容的内部 CSS。
- 不把所有 Workspace 强制成同一套移动端交互。
- 不立即引入 Virtual DOM、通用 keyed diff 或 UI Condition Dependency Graph。
- 不修改 Shop 交易原子性、购买记录 scope、PlayerState 或 Datapack DSL。
- 不为旧存档增加迁移或兼容代码。

### 风险

| 风险 | 处理方式 |
| --- | --- |
| 旧 class 同时承担样式和查询 | 先盘点 CSS，再移除 renderer identity；用 Host/Region 取代 selector 查询 |
| 非 Game Workspace 首期没有细粒度 renderer | 允许退回当前 Workspace 完整渲染，先保证不跨 Workspace 污染 |
| Reveal 事件范围不足 | 优先补齐引擎侧 revision/事件契约，不在 UI 复制条件索引 |
| Shop 的局部替换遗漏事件绑定或主题 | 保持现有 Host 替换、重绑动作、滚动恢复和 applyTheme(false) 顺序，并补回归 |
| 旧 API 迁移扩大回归面 | 采用兼容层、逐调用点迁移，完成后再删除 |

## 十一、相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]
- [[docs/0x-plan&work/active/task-0045-ui-incremental-update-workspace-isolation]]
- [[docs/0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]
- [[docs/0x-plan&work/newPlan/14-contacts-story-workspace-ownership]]
- [[docs/0x-plan&work/active/task-0047-contacts-story-workspace-ownership]]
- src/ui/components/workspace-frame.ts
- src/ui/controller.ts
- src/ui/controller-core.ts
- src/ui/update/
- src/engine/visibility/
- src/arona-clicker/services/shop-service.ts
