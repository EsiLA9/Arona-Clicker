# Task 0047：通讯录 / 故事独立 Workspace 所有权与路由迁移

状态：🟢 Contacts / Story 核心迁移完成；通用 Region 扩展与 Character 顶层兼容清理保留为后续收口项

> 本任务把 [[docs/0x-plan&work/newPlan/14-contacts-story-workspace-ownership]] 的源码核验与设计草案转为可执行施工任务。它只处理 Workspace 所有权、路由、状态归属、Host 注册和刷新边界，不把通讯录 / 故事的最终内容信息架构伪装成已裁定方案。

## 一、目标与完成定义

将通讯录和故事从 Game Workspace 的左栏 / 中栏拼接状态，迁移为拥有完整三栏的正式页面级 Workspace：

~~~text
GameWorkspace
ContactsWorkspace
StoryWorkspace
~~~ 

完成本任务后：

- 从 Game 进入通讯录，立即挂载 data-workspace-frame = contacts；
- 从 Game 进入故事，立即挂载 data-workspace-frame = story；
- Contacts / Story 的 left、center、right 均由自身 WorkspaceFrame、Column、Host 和主题作用域负责；
- 尚未设计的区域使用正式占位页，不复用进入前的 Game 右栏；
- 选择学生后仍停留在 ContactsWorkspace，角色详情 / 成长内容可复用共享 renderer；
- Story owner 只表达对话 sandbox key，不再决定是否进入 CharacterWorkspace；
- Contacts / Story 不再以 Game 的 refreshPanels() 或 centerTab / leftTab 作为页面身份；
- Workspace 切换后旧 Surface generation、异步回调和局部更新不会写入新页面。

完成标准不是“一次性重写所有内容”，而是先建立稳定的页面边界，再在该边界内渐进迁移通讯录角色内容、故事播放和细粒度刷新。

## 二、范围

### 包含

- ContactsWorkspace / StoryWorkspace 的 route identity 与入口动作；
- ContactsWorkspaceState / StoryWorkspaceState 的最小状态模型；
- app-shell、Controller、Actions、Renderer、Surface、Host Registry 的接线；
- Contacts / Story 三栏正式占位页；
- CharacterWorkspace 向 ContactsWorkspace.selectedVariantId 的迁移适配；
- Story owner 与 UI route 的解耦；
- Story navigation、返回上下文和会话瞬态的归属收口；
- Workspace 级刷新、Surface generation 和 stale callback 隔离；
- 旧 contacts-draft / archive-draft Game 状态的删除或明确迁移；
- 单元 / 集成 / 浏览器验收与文档同步。

### 不包含

- 通讯录详情、故事档案、故事 Inspector 的最终信息架构；
- Story Engine、Story Service、cursor、故事数据归属或播放规则的机制重写；
- 角色成长、装备、经验、突破数值规则的重设计；
- PlayerState、Datapack Schema、存档迁移或版本兼容；
- 一次性清理所有旧 CSS 或实现通用 Virtual DOM / keyed diff；
- 将所有 Workspace 强制成相同的移动端交互；
- 以本任务替代正式 ADR。若 Archive 归属或状态模型形成架构级裁定，应另建 ADR 并从本任务链接。

## 三、依据、依赖与约束

### 依据文档

- [[docs/0x-plan&work/newPlan/14-contacts-story-workspace-ownership]]
- [[docs/0x-plan&work/newPlan/13-unified-workspace-refresh-boundaries]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]

### 依赖任务

- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]：三栏物理骨架与 WorkspaceFrame 契约；
- [[docs/0x-plan&work/active/task-0045-ui-incremental-update-workspace-isolation]]：Surface、Host 和增量更新隔离；
- [[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]]：角色 Workspace 现有内容与视觉接线；
- [[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]]：统一 Workspace 入口和返回习惯；
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]：Host Registry 与宿主发现；
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]：Records Service / Archive 归属候选。

### Workspace 前置任务与纳入方式

此前有关 Workspace 的任务不再作为孤立背景，而是纳入本任务的联合施工序列。原任务文档仍保留各自的设计事实、实施记录和验收口径；Task-0047 只承接与 Contacts / Story 路由直接相关的未完成部分，避免重复施工。

| 优先级 | 原任务 | 已完成部分 | 本任务纳入的剩余工作 | 关系 |
| --- | --- | --- | --- | --- |
| WS-P0 | [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]] | F0–F4 已完成主要 Frame / Column 接线 | F5 Router 状态、F6 响应式 / 视觉清理、F7 Host Registry 收尾中与 Contacts / Story 相关的部分 | Contacts / Story 施工前优先收口 |
| WS-P0 | [[docs/0x-plan&work/active/task-0045-ui-incremental-update-workspace-isolation]] | P0–P4 已完成 Surface、Dispatcher、Behavior 和 Shop 增量试点 | P7 WorkspaceRoute / Shell seam 评估；P5 Reveal 分类与显式事件映射按新 Workspace 刷新需要前置或并行 | 路由切换和 stale callback 的基础 |
| WS-P0 | [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]] | H0–H2 已完成，H3 / H4 部分完成 | 核对并补齐 Contacts / Story 三栏 Host、父级、serviceId、主题编辑器发现和联合验收 | 新 Workspace Host 的注册基础 |
| WS-P1 | [[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]] | 已完成角色 Workspace 的 Frame / 视觉收敛 | 不重复实施；直接复用角色内容 renderer 和视觉契约，作为 Contacts selectedVariant 分支基线 | Contacts 角色迁移输入 |
| WS-P1 | [[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]] | 已完成顶栏、设置和服务入口统一 | 不重复实施；复用 Workspace route action、返回、主题和服务导航约定 | 新入口与返回语义基线 |
| WS-P2 | [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]] | S0 已完成，S1 / S2 部分完成 | 仅在 P0 将 Archive 裁定为 Records Service 时纳入 S4；否则建立显式 Story 子路由 | Archive 的条件依赖 |

纳入原则：

1. WS-P0 必须先于本任务 P1 / P3 的正式路由施工完成最小闭环：显式 WorkspaceRoute、独立 Surface generation、可校验 Host 集和稳定的 Frame / responsive contract；
2. 已完成的 task-0042、task-0043 只作为实现基线，不复制其代码或重新开启已完成切片；
3. task-0045 P6 Keyed Collection Reconcile 不是本任务阻塞项，只有测量证明完整刷新或 Region 重建成为瓶颈时才纳入；
4. task-0040 F6 的视觉清理可以与 P1 并行，但在浏览器验收前必须完成受影响 Workspace 的 responsive、焦点和滚动回归；
5. 每个前置切片完成后，必须把结果回写原任务和本任务的实施记录，才能进入下一优先级。

### Sol 追加施工指示与阶段门禁

以下指示作为本任务的实施约束，优先级高于“顺手优化”或“提前清理”的局部实现选择：

1. **先完成 Workspace 身份闭环，再优化局部刷新。** Contacts / Story 首期允许完整 Workspace 刷新；在 ownership、Host ownership、Surface generation 和 stale callback 隔离通过前，不引入新的 invalidateRegion、局部 DOM patch 或 Keyed Collection Reconcile。
2. **CharacterWorkspace 不得简单改名为 ContactsWorkspace。** Contacts 必须在 selectedVariantId = null 时成立；选择学生只是 Contacts 内部状态变化。原 Character renderer 可以拆出并复用内容片段，但不得继续承担页面级 routing。
3. **占位页必须是真正的 Workspace 内容。** Contacts / Story 的 center、right 即使只有一句规划中提示，也必须经由自己的 WorkspaceFrame + Column + Host 挂载；不得借用 contacts-draft、archive-draft、Game right panel 或嵌套完整 CharacterWorkspace。
4. **Story owner 与 UI route 彻底解耦。** 实现前搜索所有 owner → openCharacterWorkspace、owner → panel 切换和 owner → workspace 切换路径；owner 只能决定 Story sandbox / cursor。无 owner 与有 owner 都必须留在 StoryWorkspace。
5. **leftTab / centerTab / rightTab 不能继续充当隐藏路由。** 新 route identity 必须来自显式 Workspace 状态；legacyPanels 只能辅助兼容和返回，不能成为当前页面事实源。
6. **旧回调失效必须随 P1 / P3 首次进入一起成立。** 虽然统一 Surface 收口在 P5，但 Contacts / Story 第一次可进入时就必须至少完成 coarse-grained invalidation，确保旧 Game panel callback 不会在新 Workspace 第一帧之后回写页面。
7. **Host ID 必须先经 Registry 核对再命名。** 不复制 Game Host 名，不用 CSS class 推断归属；Host definition 必须能校验 workspace owner、parent、level 和 serviceId。
8. **Archive 决策不能阻塞主体结构。** P0 需要记录 Records Service 或 Story 子路由的选择；若裁定尚未成熟，先使用显式、可替换的 Story 子路由，禁止继续保留 archive-draft 作为 Game centerTab。
9. **旧 Character route 延后清理。** P6 前保留迁移兼容层；只有所有调用点、角色入口、Story card 和调试入口完成盘点并迁移后，才允许删除或降级顶层 Character route。
10. **每个切片必须执行 DOM 身份检查。** 除了页面视觉，还要记录 data-workspace-frame、三列 Host owner、Surface key、Game panel identity 是否仍存在，以及是否仍有通过 .left-panel / .center-panel / .right-panel 推断归属的查询路径。

额外约束：

- P2 的角色内容复用必须是片段级复用，结构只能是 ContactsWorkspace → 内容片段，不得形成 ContactsWorkspace → CharacterWorkspace 的 Workspace 套娃；
- Story 播放态第一阶段只使用 StoryWorkspaceState.mode = overview / playing，不新增 StoryPlaybackWorkspace route；只有发现独立生命周期、返回栈或 Surface owner 的实际需求并形成裁定后，才可重新评估；
- 总原则是：宁可暂时整 Workspace 刷新、内容先占位，也不能用旧 Game panel、Character route 或 CSS selector 偷渡页面身份。

### 不可破坏的项目约束

1. UI 只消费 UIFacingGame / getView() / createUIContext()，不持有 PlayerState 写引用；
2. 所有状态变更走既有 StateMutationService / GameCommands；
3. 新增联动优先沿用事件和 Trigger / Affector 边界，不把机制塞进 Controller；
4. 不编写旧存档迁移；状态结构变更同步更新测试和文档即可；
5. 新 Workspace 首期允许完整重渲染，但不得回退为 Game panel renderer；
6. 共享 renderer 可以复用内容片段，但不能决定 Workspace identity；
7. 新 Host 必须使用唯一、可发现、与物理列匹配的身份，不以旧 CSS class 推断 Workspace。

## 四、当前基线与问题

本任务以工作区本地 main 的 HEAD 82e018f 为核验基线。当前已经存在 Game、Character、Inventory、Settings、Service、Shop 的 WorkspaceFrame，但尚无 ContactsWorkspace 或 StoryWorkspace 路由。

| 当前位置 | 当前行为 | 施工要求 |
| --- | --- | --- |
| Game 左栏 | renderLeftPanel() 通过 panelState.leftTab 渲染 area / contacts / story | contacts / story 入口改为 Workspace route action |
| 通讯录入口 | 写入 leftTab = contacts、centerTab = contacts-draft，右栏可能保留进入前内容 | 进入后立即完整挂载 ContactsWorkspace 三栏 |
| 学生选择 | data-select-variant 调用 openCharacterWorkspace(variantId) | 改为 ContactsWorkspace.selectedVariantId 更新 |
| Character Workspace | 三栏为 contacts / story / progression，承担角色详情与成长 | 迁移期复用内容，逐步降为 Contacts 内部 selected 状态 |
| 故事导航 | storyNavPath 位于通用 PanelState 并渲染在 Game 左栏 | 迁移到 StoryWorkspaceState.navPath |
| 故事播放 | 有 owner 时进入 CharacterWorkspace，无 owner 时留在 Game | owner 只作为 Story conversation sandbox key |
| 故事档案 | data-story-archive 写入 archive-draft | 迁移 Records Service 或显式 Story 子路由；不得继续做 Game centerTab |
| 应用路由 | app-shell 目前识别 service / shop / character 等分支 | 增加 contacts / story 分支 |
| Surface | UISurfaceRuntime 识别 game / service / shop / character | 增加 contacts / story，切换时使旧 generation 失效 |
| 增量刷新 | refreshPanels() 主要服务 Game，Shop 有独立刷新域 | Contacts / Story 使用 Workspace / Region 所属明确的失效入口 |

现有 tests/ui/controller-tab-linkage.test.ts 仍锁定 contacts-draft 与 archive-draft 的旧断言。迁移时应改写测试契约，而不是为保留旧行为继续向 Game PanelState 增加兼容分支。

## 五、目标设计

### 5.1 Workspace identity

推荐使用显式的活动 Workspace 判别，不让 renderer 通过 DOM class 猜测当前页面：

~~~ts
type ActiveWorkspace =
  | { type: 'game' }
  | { type: 'contacts'; state: ContactsWorkspaceState }
  | { type: 'story'; state: StoryWorkspaceState }
  | { type: 'shop'; state: ShopWorkspaceState }
  | { type: 'service'; service: string }
  | { type: 'character'; variantId: string };
~~~

具体类型名可按现有路由结构调整，但必须满足：

- Contacts / Story 是独立 route identity；
- route identity 决定三栏 renderer、Host 集、Surface key、刷新域和返回语义；
- renderer 不通过 leftTab / centerTab 推测 route；
- 迁移期可保留 Character route 的读取兼容，但不新增从 Contacts 进入 Character 的顶层跳转。

### 5.2 ContactsWorkspace

最小状态：

~~~ts
interface ContactsWorkspaceState {
  type: 'contacts';
  selectedVariantId: string | null;
  conversationVariantId: string | null;
  returnContext: WorkspaceReturnContext;
}
~~~

行为：

- selectedVariantId = null 是合法首页状态，三栏必须完整渲染；
- 选择学生只改变 Contacts 内部状态，不改变 Workspace type；
- 角色详情、成长、装备等内容可先复用 renderCharacterPanel() 等共享片段；
- Contacts 的 center / right 未设计部分必须使用自身占位 renderer；
- 不能再以 CharacterWorkspace.renderCharacterWorkspace() 作为新的页面级组装入口。

### 5.3 StoryWorkspace

最小状态：

~~~ts
interface StoryWorkspaceState {
  type: 'story';
  navPath: string[];
  selectedEntryId: string | null;
  conversationOwner: string | null;
  mode: 'overview' | 'playing';
  returnContext: WorkspaceReturnContext;
}
~~~

行为：

- conversationOwner = null 表示全局故事对话 sandbox，仍属于 StoryWorkspace；
- conversationOwner = variantId 表示学生对话 sandbox，仍属于 StoryWorkspace；
- Story Service 继续负责 cursor、chat history 和 owner 语义；
- storyGate、sendGate、openingBanner 等演出瞬态必须绑定 Story 的 active conversation；
- selectedEntryId 不提前膨胀成 detail / archive / inspector / statistics 超级状态；
- Story 的 center / right 未设计部分使用 Story 自身占位 renderer；
- renderConversationBody() / renderChat() 可以复用，但不得生成 Game center-panel identity。

### 5.4 返回上下文

旧 ShopReturnContext 只保存 left / center / right Tab，不足以表达新路由。应抽取或扩展为：

~~~ts
interface WorkspaceReturnContext {
  route: 'game' | 'contacts' | 'story' | 'shop' | 'service';
  selectedVariantId?: string | null;
  conversationOwner?: string | null;
  service?: string;
  legacyPanels?: {
    leftTab: string;
    centerTab: string;
    rightTab: string;
  };
}
~~~

迁移期可以保留 legacyPanels 作为只读兼容信息，但返回动作不能只依赖它。至少覆盖：

~~~text
Game → Contacts → Story(owner) → 返回 Contacts
Game → Story(global) → 返回 Game
Contacts(selected student) → Story → 返回 Contacts(selected student)
~~~

### 5.5 Renderer、Frame 与 Host

新增或抽取：

~~~text
src/ui/components/contacts-workspace.ts
src/ui/components/story-workspace.ts
~~~

分别提供 Contacts / Story 的页面级组装函数，并直接返回 renderWorkspaceFrame() 结果。允许复用的只是内容片段：

~~~text
ContactsWorkspace
  ├─ 通讯录列表 renderer
  ├─ 角色详情 / 成长共享 renderer
  └─ Contacts placeholder renderer

StoryWorkspace
  ├─ 故事导航 renderer
  ├─ conversation / chat 共享 renderer
  └─ Story placeholder renderer
~~~

禁止新页面继续通过 renderLeftPanel()、renderCenterPanel()、renderRightPanel() 拼装三栏。

Host 施工要求：

- 先盘点 UI Host Registry，再确定 Contacts / Story 的唯一 Host ID；
- 不直接复用 leftPanel.contacts、centerPanel.contacts.*、centerPanel.archive.*；
- 不直接复用 Game 的 leftPanel.*、centerPanel.*、rightPanel.* 作为新 Workspace identity；
- Contacts / Story 的三栏 Host 物理父级分别对应 leftPanel / centerPanel / rightPanel；
- placeholder 与未来真实内容使用同一 Host；
- UIController 的 Region 更新必须通过当前 Workspace 的 Host 所属校验；
- 不依靠 .left-panel、.center-panel、.right-panel 查询来决定 Workspace identity；
- Host 的 parent、level、serviceId、主题编辑器发现结果必须有测试覆盖。

### 5.6 刷新边界

首期优先 ownership，允许以下完整刷新：

| 变化 | 首期入口 |
| --- | --- |
| 进入 / 离开 Contacts 或 Story | App Shell / 当前 Workspace 结构刷新 |
| Contacts 选择学生、切换占位页、展示角色内容 | Contacts Workspace 完整刷新 |
| Story 导航、选择 Entry、owner 切换、确认播放 | Story Workspace 完整刷新 |
| 稳定后的聊天演出 | 再收敛为 Story conversation Region 更新 |

禁止：

- ContactsWorkspace 调用 refreshPanels() 让 Game renderer 猜测目标；
- StoryWorkspace 默认调用 refreshPanels(['left', 'center'])；
- refreshChatPanel() 在 Story Workspace 中无条件查询或替换 Game .center-panel；
- Workspace 切换后旧 Story callback、异步命令或 Surface 更新写入新页面；
- 未知影响范围回退到 Game panel。未知范围只能回退到当前 Workspace 的完整 render。

与统一刷新草案的接口关系：

~~~text
Behavior
  → Region
  → Workspace
  → App invalidation
~~~

Contacts / Story 的 Surface key、generation、Workspace owner 和 Region Host 必须能沿这条边界追踪；细粒度 invalidateRegion 只有在 Host 所属校验完成后开放。

## 六、施工切片

### 联合施工优先级

本任务按以下顺序实施，优先完成此前 Workspace 任务的未完成基础，再进入通讯录 / 故事内容迁移：

~~~text
WS-P0 统一基础收口
  task-0040 F5/F6/F7 相关部分
  task-0045 P7；P5 按刷新需要前置或并行
  roadmap-0018 H3/H4 中的 Contacts / Story Host 与联合验收
      ↓
P0  Contacts / Story 路由契约与 Archive / playback 裁定
      ↓
P1–P2  ContactsWorkspace 三栏骨架与角色选择迁移
      ↓
P3–P4  StoryWorkspace 三栏骨架、owner 解耦与播放接线
      ↓
P5  返回、Surface、Host 与刷新收口
      ↓
P6  旧 Game 页面身份清理、文档同步与浏览器验收
~~~

WS-P0 的目标是“基础可用且可验证”，不是等待所有旧 Workspace 任务完全归档。若某个前置任务的非阻塞增强不影响 route、Host、Surface 或三栏契约，可记录为并行遗留，不得扩大本任务范围。

### P0：基线、路由契约与设计收口

目标：建立可测试的 route / ownership 契约，不改变最终内容。

- [x] 搜索并分类 leftTab = contacts、leftTab = story、contacts-draft、archive-draft、openCharacterWorkspace、selectedVariantId、conversationVariantId、storyNavPath 和 owner routing 的全部调用点；
- [x] 盘点 app-shell、rail、center-panel、character-workspace、controller、controller-core、controller-actions-*、ui-surface 和 ui-host-registry 的当前职责；
- [x] 定义 ActiveWorkspace 或等价 route helper；
- [x] 新增 Contacts / Story 进入后不残留 Game 右栏的测试骨架；
- [x] 更新 tests/ui/controller-tab-linkage.test.ts 的迁移契约；
- [x] 逐一搜索 owner → openCharacterWorkspace、owner → panel / workspace 切换和旧 CSS selector 查询；
- [x] 在实现相关切片前裁定：
  1. Archive 是否迁移到 Records Service；
  2. 若暂留 Story，是否作为显式 Story 子路由；
  3. Story 播放 overview / playing 是否需要独立 route，还是只作为 WorkspaceState.mode；
  4. 当前项目实际可用的 Contacts / Story Host ID 集；
- [x] 不删除共享 renderer，保证每个切片可验证。

P0 完成条件：WS-P0 已具备最小可用基础；路由类型、Host 命名、Archive 归属和 playback 形状有明确记录，且测试能够分辨 Game、Contacts、Story 的 Workspace identity。

#### P0 裁定记录（2026-09-12）

- Archive 首期保留为 StoryWorkspace 的显式 `subroute = archive`，使用 Story 自有 Frame / Column / Host 挂载正式占位；后续若 Records Service 形成稳定归属，再单独迁移，不恢复 `archive-draft` Game centerTab。
- Story 播放态首期使用 `StoryWorkspaceState.mode = overview | playing`，没有新增 `StoryPlaybackWorkspace` route。
- Contacts / Story 使用 `leftPanel.service.<workspace>.navigation`、`centerPanel.service.<workspace>.main`、`rightPanel.service.<workspace>.inspector` Host 集，并以 `workspaceOwner` 校验归属；旧 `centerPanel.contacts.*` / `centerPanel.archive.*` 不作为新 Workspace 身份。

### P1：ContactsWorkspace 三栏骨架

目标：先让通讯录成为没有混合列的正式 Workspace。

- [x] 新增 ContactsWorkspaceState，selectedVariantId 允许 null；
- [x] 新增 openContactsWorkspace() 与 renderContactsWorkspace()；
- [x] app-shell 增加 contacts Workspace 分支；
- [x] 通过 WorkspaceFrame 输出 left / center / right；
- [x] 中栏、右栏接入 Contacts 自身的正式占位页；
- [x] Game 通讯录入口改为 route action，不再写 centerTab = contacts-draft；
- [x] 进入 Contacts 后清理或隔离 Game 旧 panel callback；
- [x] 建立 Contacts 的 Surface key、Host 集和主题 / scroll / responsive contract。
- [x] 首次进入 Contacts 时完成旧 Game panel callback 的粗粒度失效。

P1 完成条件：点击通讯录后第一帧就是 ContactsWorkspace，三栏完整、右栏无进入前的 Game 内容，selectedVariantId = null 可正常返回；旧 Game callback 不会在此后回写；并完成一次 data-workspace-frame、Host owner、Surface key 和 Game panel identity 检查。

### P2：角色选择迁移到 Contacts 内部

目标：保留既有角色内容，同时消除“选择学生才进入独立 Character 页面”的身份混淆。

- [x] data-select-variant 改为更新 ContactsWorkspace.selectedVariantId；
- [x] 选择学生后 data-workspace-frame 仍为 contacts；
- [x] 复用 renderCharacterPanel() 等内容 renderer，不再由 CharacterWorkspace 重新决定页面三栏；
- [x] 将装备、经验、突破、已读操作等相关更新改为 Contacts Workspace 的完整刷新或明确 Region 更新；
- 保留旧 Character renderer 作为迁移期兼容源，但禁止新增 Contacts → Character 顶层 route；
- 角色内容只能作为 Contacts 内部片段复用，不得把完整 CharacterWorkspace 嵌入 Contacts；
- [x] 检查返回时 selectedVariantId 的保留和清理语义。

P2 完成条件：未选择学生、选择学生、切换学生三种状态都保持 Contacts Workspace identity，角色操作不会刷新 Game 的列，且 DOM 中不存在嵌套 CharacterWorkspace Frame。

### P3：StoryWorkspace 三栏骨架与导航迁移

目标：让故事入口和导航脱离 Game 左栏 / 中栏身份。

- [x] 新增 StoryWorkspaceState、openStoryWorkspace() 与 renderStoryWorkspace()；
- [x] 将 storyNavPath 迁移为 StoryWorkspaceState.navPath；
- [x] Game 故事入口改为 route action，不再只写 leftTab = story；
- [x] 中栏、右栏接入 Story 自身占位页；
- [x] Story 导航、Entry 选择和返回由 Story route 状态驱动；
- [x] Story 首次进入即完成旧 Game callback 的粗粒度失效；
- [x] data-story-archive 不得继续写 archive-draft；
- [x] 按 P0 裁定完成 Records Service 迁移或显式 Story 子路由；
- [x] 检查 resetSessionPanel()、新建 Init、离开 Init 时 Story nav 和 Workspace 瞬态清理。

P3 完成条件：故事入口第一帧就是 StoryWorkspace；有无 owner 均可进入；导航不依赖 Game leftTab；旧 Game callback 不会回写；Archive 有明确 route owner；不产生 StoryPlaybackWorkspace 新 route。

### P4：Story owner 解耦与播放接线

目标：移除 owner → CharacterWorkspace 的 UI 路由副作用。

- [x] controller-actions-story.ts 的启动、重读和卡片故事入口统一调用 openStoryWorkspace()；
- [x] owner 只传给 GameCommands.startActiveStory / replayStory / startCardStory 或 Story Service 作为 sandbox key；
- [x] 有 owner 和无 owner 的播放均保持 StoryWorkspace；
- [x] 确认浮层、聊天门控、开幕标题和演出文本绑定 Story Workspace 的 active conversation；
- [x] 更新 refreshChatPanel()、controller-events.ts 和相关 Story 分支，避免查询 Game center-panel；
- [x] 首期允许完整刷新 StoryWorkspace；稳定后再开放 Story center Region 更新；
- [x] 覆盖 Workspace 切换后旧 playback callback 被丢弃。

P4 完成条件：owner 变化只改变 conversation sandbox，不改变 Workspace type；故事播放不会将用户带入 CharacterWorkspace 或写入 Game panel；播放态仍由 StoryWorkspace.mode 表达。

### P5：返回、Surface、Host 与刷新收口

目标：把新页面接入统一的生命周期和增量更新边界。

- [x] 使用带 route 的 WorkspaceReturnContext；
- [x] UISurfaceRuntime 增加 contacts / story Surface key；
- [x] 覆盖 route 改变、重新 mount、旧 generation 和 stale callback；
- [x] refreshPanels() 收窄为 Game 兼容 API；
- [x] Contacts / Story 使用 refreshWorkspace() 等价入口；
- [x] Reveal、主题变化、日志、奖励通知按当前 Workspace 消费者刷新；
- [x] Region 更新增加 Host 所属校验和 unsupported 诊断基础；
- [x] 删除 Contacts / Story 对旧 panel class 的结构查询依赖。
- 在 ownership、Host owner 和 Surface generation 尚未通过阶段验收前，不开放新的细粒度 invalidateRegion 或 keyed reconcile。

P5 完成条件：切换 Workspace 后旧更新全部失效；当前 Workspace 可独立完整刷新；允许开放的 Region 更新只能命中当前 Workspace Host。

### P6：清理、同步文档与浏览器验收

目标：删除旧页面身份并把稳定边界回写机制文档。

- [x] 删除 contacts-draft、archive-draft 作为 Game centerTab 的页面分支；
- [x] 删除 Game leftPanel 内 contacts / story 的页面渲染分支；若保留视觉入口，只保留 route action；
- 当无调用点后，删除或降级 CharacterWorkspace 顶层 route；
- [x] 更新 docs/docs-828/02-modules/ui 与统一刷新边界文档；
- [x] 完成主题、滚动、900 / 640 / 375 响应式和返回路径的主要浏览器验收；键盘顺序沿用可聚焦按钮语义，专门焦点恢复细化留作后续视觉收口；
- [x] 将所有切片的测试、验证结果和未完成风险回写本任务。

P6 完成条件：旧 Game 页面身份不再承担 Contacts / Story；机制文档与代码实现一致；浏览器验收覆盖主要路由路径。

## 七、验收标准

### Workspace ownership

- Game → Contacts 后立即出现 data-workspace-frame = contacts；
- Contacts 未选学生仍能完整渲染三栏；
- Game → Story 后立即出现 data-workspace-frame = story；
- Contacts / Story 不显示进入前残留的 Game Spot、学生或强化面板；
- 选择学生后 Workspace identity 仍是 contacts；
- 有 owner / 无 owner 的 Story 播放都保持 story；
- owner 变化只改变 conversation sandbox，不改变 Workspace type。

### 状态与返回

- storyNavPath 不再是通用 PanelState 中 Story 的唯一事实源；
- selectedVariantId 不由 Game 右栏与 Contacts 双向写入；
- contacts-draft、archive-draft 不再作为 Game centerTab 页面状态；
- 新会话 / 切换 Init 后 Story 导航和 Workspace 瞬态不残留；
- 返回依赖显式 route context，而非仅靠旧 left / center / right Tab；
- 至少通过 Game → Contacts → Story(owner) → Contacts、Game → Story(global) → Game、Contacts(selected) → Story → Contacts(selected)。

### 刷新、Surface 与表现

- Contacts / Story 更新不会调用 Game panel renderer 替换其列；
- WorkspaceFrame、Column、Host、Theme、scroll、responsive contract 全部成立；
- 旧 Surface 更新在 Workspace 切换后被丢弃；
- Story Chat / Conversation 共享 renderer 不生成 Game Center Panel identity；
- 窄屏、键盘顺序、焦点恢复和滚动位置不因迁移回归；
- Host Registry 能报告错误 parent、level、serviceId 和未知 Workspace owner。

### 内容边界

- 未设计的中栏和右栏有明确 Contacts / Story 占位页；
- 占位页与未来真实内容使用同一 Host 和 Frame；
- 本任务不以“完成通讯录详情、Story Archive、Story Inspector 或角色成长信息架构”作为通过条件。

## 八、测试计划

### 必须新增或改写

- route action：Game → Contacts / Story；
- Contacts：未选学生、选择学生、切换学生、返回；
- Story：navPath、Entry、无 owner 播放、有 owner 播放、返回；
- owner 变化不改变 Workspace type；
- 三栏不残留 Game panel；
- contacts / story Surface generation 与 stale callback；
- refreshChatPanel() 在 Story 中不查询或替换 Game center-panel；
- Archive route owner；
- Host Registry parent / serviceId / 主题编辑器发现；
- 900px、640px、375px 附近的三栏堆叠、滚动、键盘焦点和返回路径。

### 迁移期间持续验证

- npx tsc --noEmit
- npm test
- npm run check:architecture
- npm run build

构建如需避免写入受保护目录，使用临时输出目录并记录结果。实现完成前不得把当前草案阶段的检查结果写成“任务已验证”。

## 九、当前已知验证基线

截至 2026-09-12：

- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- `npm test -- --reporter=basic --silent`：通过，142 个测试文件、1312 个测试；
- 临时目录构建：通过，仅有既有 chunk size warning，未写入受保护产物目录；
- `npm run ui:callgraph -- --chains --dom --reverse --forward --hot`：通过，完成 owner → route、刷新入口和 DOM 写入点盘点；
- Contacts / Story 专项测试：通过，覆盖入口、三栏 ownership、角色选择、owner 解耦、Archive 子路由、Surface stale、返回 Contacts 和 Host owner 校验；
- 浏览器冒烟：Game → Contacts、Contacts → Game、Game → Story、Story → Archive；900 / 640 / 375 宽度均保持三列 Host 且无横向溢出；页面错误日志为空。

## Goal 实施记录（2026-09-12）

### 已完成

- `WorkspaceFrame` / `WorkspaceColumn` 增加显式 `workspaceOwner` DOM 元数据；Contacts / Story 注册独立三栏 Host，校验物理列 parent、serviceId 和 Workspace owner。
- 新增 `ContactsWorkspace` 与 `StoryWorkspace` 页面级 renderer；未设计的中栏 / 右栏使用自身占位内容；共享角色和聊天 renderer 只作为内容片段复用。
- `PanelState.workspace` 增加 Contacts / Story 状态，`WorkspaceReturnContext` 增加 route；`selectedVariantId = null` 的 Contacts 首页合法，Story owner 不再触发 Character route。
- Story 导航写入 `StoryWorkspaceState.navPath`；Archive 改为显式 Story 子路由；播放态使用 `overview / playing`，没有新增播放 Workspace。
- Game 通讯录 / 故事入口改为 route action；删除 `contacts-draft`、`archive-draft` 页面分支和 Game 左栏对应的页面 renderer；保留 Character 顶层兼容入口以避免未迁移调用点回归。
- Contacts / Story 的聊天刷新走当前 Workspace 完整 render；Surface key / generation 变化会使旧异步更新失效，避免旧 Game panel callback 回写新页面。
- 对 `UIController.refreshWorkspace()`、Story gate、返回链和 Host Registry 增加回归覆盖；未开放 Contacts / Story 的局部 Region patch 或 keyed reconcile。

### 遗留与边界

- Records Service 是否最终承接 Archive 尚未形成独立 ADR；本任务使用可替换的 Story 子路由作为首期落点。
- CharacterWorkspace 顶层 route 仍保留为迁移兼容层，待所有角色入口、Story card 和调试入口完成盘点后再由独立清理任务降级或删除。
- Contacts / Story 暂以 Workspace 完整刷新为安全阀；通用 Region Registry、细粒度 invalidateRegion 和专门焦点恢复细化不在本次 Goal 中提前扩展。

## 十、风险与处理

| 风险 | 处理 |
| --- | --- |
| 旧 CSS class 同时承担样式和查询 | 先盘点查询点；用 Workspace / Host / Region 身份替代结构猜测 |
| 首期没有细粒度 renderer | 允许当前 Workspace 完整刷新，先保证 ownership 隔离 |
| Story 播放 callback 跨页写入 | 以 Surface generation / route token 丢弃旧 callback |
| Archive 归属悬置导致双重模型 | P0 前裁定 Records Service 或 Story 子路由，禁止继续扩展 archive-draft |
| Character 内容迁移扩大回归面 | 保留共享 renderer，按 P1 → P2 逐步替换入口 |
| Host ID 与旧服务语义冲突 | P0 读取 Registry 后再命名，补 parent / level / serviceId 测试 |
| 旧 API 迁移范围过大 | 先加 route / ownership 兼容层，逐调用点迁移，最后清理旧分支 |
| 任务被误解为内容重做 | 在 PR / 提交说明中明确本任务先做边界，不要求最终信息架构 |

## 十一、实施交付物

- ContactsWorkspace / StoryWorkspace route 与 renderer；
- 最小 Workspace state、返回上下文和迁移兼容层；
- Contacts / Story 三栏 Host 注册与 Surface key；
- Story owner 解耦后的播放入口；
- 更新后的 controller / app-shell / refresh / lifecycle 测试；
- 浏览器验收记录；
- 同步后的 docs/docs-828/02-modules/ui 与刷新边界文档；
- 若 P0 形成架构级裁定，补充 ADR 并在本任务中回链。

## 十二、相关路由

- [[docs/0x-plan&work/newPlan/14-contacts-story-workspace-ownership]]
- [[docs/0x-plan&work/newPlan/13-unified-workspace-refresh-boundaries]]
- [[docs/0x-plan&work/active/task-0040-unified-workspace-frame]]
- [[docs/0x-plan&work/active/task-0045-ui-incremental-update-workspace-isolation]]
- [[docs/0x-plan&work/active/task-0042-character-workspace-ui-convergence]]
- [[docs/0x-plan&work/active/task-0043-topbar-settings-workspace]]
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]
- [[docs/0x-plan&work/active/roadmap-0020-service-workspaces]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]

### 主要代码入口

- src/ui/components/app-shell.ts
- src/ui/components/rail.ts
- src/ui/components/center-panel.ts
- src/ui/components/contacts-workspace.ts
- src/ui/components/story-workspace.ts
- src/ui/components/character-workspace.ts
- src/ui/components/workspace-frame.ts
- src/ui/controller.ts
- src/ui/controller-core.ts
- src/ui/controller-actions-topbar.ts
- src/ui/controller-actions-contacts.ts
- src/ui/controller-actions-story.ts
- src/ui/update/ui-surface.ts
- src/ui/update/ui-host-registry.ts
- tests/ui/controller-tab-linkage.test.ts
