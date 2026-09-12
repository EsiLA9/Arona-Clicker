# Task 004x：通讯录 / 故事独立 Workspace 所有权草案

状态：🔵 待评审（源码核验完成，尚未形成 ADR 或 active Task）

> 本文审阅 Sol 提供的“通讯录 / 故事独立 Workspace 重构”草案，确认当前事实、修正过时判断，并定义第一阶段只解决 Workspace 所有权、路由、状态归属和安全刷新边界的方案。通讯录与故事的中栏、右栏最终玩法仍不在本文裁定范围内。

## 一、审阅结论

草案的核心原则成立：

- 通讯录不能继续只是 Game Workspace 的左栏内容；
- 故事不能继续由 Game 左栏、Game 中栏和进入前的右栏拼接；
- 进入通讯录或故事时，左、中、右三栏必须立即归同一个 Workspace；
- 尚未设计的区域可以使用正式的 Workspace 占位页；
- Story owner 只能表达执行沙盒，不应单独决定 UI Workspace 类型。

但需要把目标分成两步：

1. 先建立 ContactsWorkspace / StoryWorkspace 的路由和三栏所有权，允许内容复用现有 renderer；
2. 再迁移 CharacterWorkspace、Story playback 和旧 Game Tab 状态，避免在一次改动中同时重写角色成长和 Story UI。

本任务不是要让所有内容马上拥有最终信息架构，也不是要取消共享 renderer。正确边界是：

~~~text
Workspace identity
  决定三栏属于谁、使用哪组 Host、如何刷新、如何返回

Shared renderer
  只提供可复用的内容片段，不决定页面身份和路由
~~~

## 二、当前核验基线

本次核验以工作区本地 main 的 HEAD 82e018f 为准。当前源码已经有 Game、Character、Inventory、Settings、Service 和 Shop 的 WorkspaceFrame，但还没有 ContactsWorkspace 或 StoryWorkspace 路由。

关键代码事实：

| 主题 | 当前实现 | 核验结论 |
| --- | --- | --- |
| Game 左栏 | renderLeftPanel() 由 panelState.leftTab 选择 area / contacts / story | 通讯录和故事仍是 Game 左栏内容 |
| 通讯录入口 | 左 Tab contacts → leftTab = contacts、centerTab = contacts-draft | 只替换 Game 左栏和中栏，右栏保留进入前内容 |
| 角色入口 | data-select-variant → openCharacterWorkspace(variantId) | 只有选中学生后才建立 Character Workspace |
| Character Workspace | 固定 variantId，三栏为 contacts / story / progression | 已有独立 Frame，但当前同时承担通讯录、学生故事和成长 |
| 故事导航 | panelState.storyNavPath，渲染在 Game 左栏 | Story 导航状态仍属于通用 PanelState |
| 故事播放 | 有 owner 时 openCharacterWorkspace(owner)，无 owner 时留在 Game | Story owner 当前参与了 UI 路由 |
| 故事档案 | data-story-archive → centerTab = archive-draft | 仍是 Game 中栏临时页；其最终归属需要单独裁定 |
| 应用路由 | app-shell 只识别 service、shop 和 character | 尚无 contacts / story Workspace 分支 |
| 增量刷新 | refreshPanels() 只对 Game 局部替换，Shop 有独立 Host 区域刷新 | 新 Workspace 不能继续依赖 Game panel API |
| Surface 身份 | UISurfaceRuntime 识别 game、service、shop、character | 需要增加 contacts / story 的 Surface key |

现有测试也明确锁定了旧行为：tests/ui/controller-tab-linkage.test.ts 期望点击 contacts 后得到 contacts-draft，点击 Story 的档案入口后得到 archive-draft。迁移时必须更新这些测试，而不是把新行为误判为回归。

## 三、Sol 草案逐条核验

| Sol 判断 | 核验结果 | 审阅处理 |
| --- | --- | --- |
| 通讯录当前首先是 Game 左栏 Tab | ✅ 成立 | ContactsWorkspace 需要成为正式路由 |
| 点击通讯录后只改变左栏和中栏，右栏残留 Game 内容 | ✅ 成立 | 作为 P0 回归场景，禁止保留混合三栏 |
| Character Workspace 只有选学生后才出现 | ✅ 成立 | 迁移为 ContactsWorkspace 的 selectedVariant 分支 |
| Character 状态不能表达未选学生 | ✅ 成立 | ContactsWorkspace.selectedVariantId 允许 null |
| Story 当前依附 Game 左栏、可能复用 Game Center | ✅ 成立 | StoryWorkspace 自己持有三栏，内容可复用但不得复用 Game panel 身份 |
| Story owner 决定是否进入 Character Workspace | ✅ 当前代码成立 | 目标改为 owner 只作为 conversation sandbox key |
| storyNavPath 应归 Story Workspace | ✅ 成立 | 迁移并清理 Game PanelState 的长期归属 |
| selectedVariantId 应归 Contacts Workspace | ✅ 方向成立 | 迁移期允许只读兼容投影，但必须只有一个写入源 |
| archive-draft 可继续留在 Story 方案之外 | ⚠️ 需要补充路由裁定 | 推荐迁移 Records Service；若保留在 Story 内，必须建模为 Story 子路由，不能继续使用 Game centerTab |
| 可以暂时复用角色 / 对话 renderer | ✅ 成立 | renderer 复用与 Workspace identity 分离 |
| 进入通讯录 / 故事时优先保证 ownership 而非细粒度刷新 | ✅ 成立 | 首期允许 Workspace 级完整刷新 |
| 退出可以继续依靠旧三栏状态拼回 | ❌ 不足 | 至少保存带 route 类型的 returnContext，不能只保存 left/center/right |

## 四、目标模型

### 4.1 顶层 Workspace

正式建立：

~~~text
GameWorkspace
ContactsWorkspace
StoryWorkspace
CharacterWorkspace 迁移期保留，稳定后降为 ContactsWorkspace 内部状态
ShopWorkspace
InventoryWorkspace
Settings / Service Workspaces
~~~

Contacts 和 Story 是页面级 Workspace，不是 Game 的子面板。进入后，Frame 的三个 Column、Host、主题作用域、滚动责任和刷新域都属于当前 Workspace。

### 4.2 Game 中的视觉入口

第一阶段不要求立即改变视觉位置，但必须改变状态语义：

~~~text
Game 中的“通讯录”入口
  → openContactsWorkspace()

Game 中的“故事”入口
  → openStoryWorkspace()

当前 route = game 时，Game 的 leftTab 只能表达 Game 自身内容；
通讯录和故事的按钮可以继续复用 Tab 外观，但不能再把 contacts/story 写成 Game leftTab 的页面状态。
~~~

因此不能简单保留当前 data-tab = left:contacts / left:story 的行为，再在 refreshPanels() 内打补丁。应使用明确的 Workspace route action；视觉上的 Tab 与路由动作可以共享样式，但不能共享 renderer identity。

### 4.3 正式占位页

未设计区域使用 Contacts / Story 自己的 renderer：

~~~text
ContactsWorkspace
├─ left  当前通讯录列表 / 导航
├─ center 正在规划中的通讯录主页
└─ right  正在规划中的通讯录右栏

StoryWorkspace
├─ left  当前故事导航
├─ center 正在规划中的故事主页
└─ right  正在规划中的故事右栏
~~~

占位页必须经过 renderWorkspaceFrame()，并具备：

- 独立 WorkspaceFrame id；
- 独立 Column / Host；
- Presentation Host 和主题继承；
- 明确的 scroll contract；
- responsive layout；
- 可替换的稳定内容入口。

占位页不能通过 renderCenterPanel() 继续生成 Game center-panel，也不能让 Game right-panel 作为右栏默认内容。

## 五、状态归属方案

### 5.1 ContactsWorkspaceState

第一阶段只放已经被当前 UI 使用的必要状态：

~~~ts
interface ContactsWorkspaceState {
  type: 'contacts';
  selectedVariantId: string | null;
  conversationVariantId: string | null;
  returnContext: WorkspaceReturnContext;
}
~~~

selectedVariantId = null 是合法且必须测试的状态。选择学生后，仍然处于 ContactsWorkspace，不得再创建新的 CharacterWorkspace 路由。

当前角色 renderer 的迁移方式：

~~~text
ContactsWorkspace.selectedVariantId = null
  → 通讯录列表 + 两个占位页

ContactsWorkspace.selectedVariantId = variantId
  → 通讯录列表 + 现有角色详情/成长内容的共享 renderer
~~~

这允许先复用 renderCharacterPanel()，但 renderCharacterWorkspace() 不应继续作为新的顶层 Workspace 身份。

### 5.2 StoryWorkspaceState

第一阶段只放导航、选择和播放所需字段：

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

需要注意：

- conversationOwner = null 代表全局聊天沙盒，不代表回到 Game Workspace；
- conversationOwner = variantId 代表学生对话沙盒，不代表进入 Character Workspace；
- Story cursor、chat history 和 owner 的引擎语义仍由 Story Service 负责；
- storyGate、sendGate、openingBanner 等演出瞬态应与当前 Workspace 的活跃对话区域绑定，不能继续用 Game centerTab 是否为 chat 作为唯一判断；
- selectedEntryId 不应提前扩展成 detail、archive、inspector、statistics 等超级状态。

### 5.3 状态迁移约束

| 当前字段 | 目标归属 | 迁移注意 |
| --- | --- | --- |
| storyNavPath | StoryWorkspaceState.navPath | 新建 / 离开 Init 时清理；不能残留上一次 Story 路径 |
| selectedVariantId | ContactsWorkspaceState.selectedVariantId | 迁移期只保留只读兼容投影，禁止双向写入 |
| conversationVariantId | 当前拥有对话的 Workspace / Story conversation state | 作为 sandbox key，不再作为 Workspace route discriminator |
| centerTab = contacts-draft | 删除 | 由 ContactsWorkspace.center renderer 负责 |
| centerTab = archive-draft | 删除或迁移 Records | 不再作为 Game Center 状态 |
| leftTab = story / contacts | 删除其页面语义 | 可保留视觉导航事件，但不能成为 Game Workspace 的持久页面状态 |

当前 resetSessionPanel() 尚未清理 storyNavPath，这也应在迁移中一并修正。

### 5.4 返回上下文

旧 ShopReturnContext 只保存三栏 Tab 和选择项，不足以表达 Contacts / Story 之间的返回关系。建议抽取为带 route 的兼容结构：

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

第一阶段可以保留 legacyPanels，但退出不能只依赖它。验收必须覆盖：

~~~text
Game → Contacts → Story(owner) → 返回 Contacts
Game → Story(global) → 返回 Game
Contacts(selected student) → Story → 返回 Contacts(selected student)
~~~

## 六、Story owner 解耦

当前 controller-actions-story.ts 在启动和重读故事前执行：

~~~text
owner 存在 → openCharacterWorkspace(owner)
owner 不存在 → 留在 Game
~~~

目标改为：

~~~text
openStoryWorkspace({
  selectedEntryId: storyId,
  conversationOwner: owner ?? null,
  mode: 'overview'
})
  ↓
Story Workspace 自己渲染左 / 中 / 右
  ↓
确认后调用 GameCommands.startActiveStory / replayStory / startCardStory
  ↓
Story Service 使用 owner 选择对应 cursor / sandbox
~~~

这项改造不改变 Story Service 的 owner 参数，也不改变故事数据的归属；只移除 UI 层的 owner → CharacterWorkspace 路由副作用。

对于有 owner 的故事：

~~~text
Workspace = StoryWorkspace
conversationOwner = variantId
~~~

对于无 owner 的故事：

~~~text
Workspace = StoryWorkspace
conversationOwner = null
~~~

Story 播放可以继续复用 renderConversationBody()、renderChat 等共享内容 renderer，但必须由 renderStoryWorkspace() 组装 center；不能通过 centerTab = chat 让 Game Center Panel 代替 Story Workspace.center。

## 七、Renderer 与 Host 方案

### 7.1 Renderer

建议新增：

~~~text
src/ui/components/contacts-workspace.ts
src/ui/components/story-workspace.ts
~~~

分别提供：

~~~ts
renderContactsWorkspace(...)
renderStoryWorkspace(...)
~~~

两者直接返回 renderWorkspaceFrame() 结果。共享内容 renderer 只能作为内部片段：

~~~text
Contacts Workspace
  ├─ renderContactsTab()
  ├─ renderCharacterPanel()
  └─ placeholder renderer

Story Workspace
  ├─ renderStoryTab() 的导航内容迁移或抽取
  ├─ renderConversationBody() / renderChat()
  └─ placeholder renderer
~~~

不得通过 renderLeftPanel()、renderCenterPanel()、renderRightPanel() 拼装 Contacts / Story 的三栏。旧 renderer 逐步收窄为 GameWorkspace-specific。

### 7.2 Host

新 Workspace 必须登记三栏 Host，并遵循物理列优先的命名原则。具体 ID 在施工前需要核对现有 Registry，不能直接复用已有的：

- leftPanel.contacts；
- centerPanel.contacts.*；
- centerPanel.archive.*；
- Game 的 leftPanel.* / centerPanel.* / rightPanel.*。

这些 ID 当前分别承担 Game 或旧 Service 语义。建议先为 Contacts / Story 设计带 Workspace 限定的唯一 Host 集，再由 Registry 校验 parent、level、serviceId 和主题编辑器发现结果。

验收要求：

- Contacts 三栏 Host 的父级分别属于 leftPanel / centerPanel / rightPanel；
- Story 三栏 Host 的父级分别属于 leftPanel / centerPanel / rightPanel；
- Placeholder 和真实内容使用同一 Host；
- UIController 的 Region 更新只能命中当前 Workspace 的 Host；
- 不靠 .left-panel、.center-panel、.right-panel 判断 Workspace identity。

## 八、刷新边界

本任务第一阶段优先保证 ownership：

~~~text
进入 / 离开 Contacts 或 Story
  → App Shell / 当前 Workspace 结构刷新

Contacts 选择学生、切换占位页或角色内容
  → 首期允许 ContactsWorkspace 整体刷新

Story 导航、选择 Entry、确认播放、owner 切换
  → 首期允许 StoryWorkspace 整体刷新

聊天演出稳定后
  → 再把 Story conversation 收敛为 Region 刷新
~~~

禁止：

- ContactsWorkspace 调用 refreshPanels() 并让 Game renderer 猜测目标；
- StoryWorkspace 调用 refreshPanels(['left', 'center']) 作为默认刷新；
- refreshChatPanel() 在 Story Workspace 中无条件查询 Game .center-panel；
- 旧 Story callback 在 Workspace 切换后写入新页面。

与统一刷新草案的关系：

- Surface key 必须能区分 contacts 与 story；
- Workspace 级刷新必须使旧 generation 失效；
- Region 级刷新只有在 Host 所属校验完成后开放；
- 未知影响范围可以退回当前 Workspace render，但不得退回 Game panel render。

## 九、迁移切片

### P0：入口与现状基线

- 完整搜索并分类 leftTab = contacts、leftTab = story、contacts-draft、archive-draft、openCharacterWorkspace、selectedVariantId、conversationVariantId、storyNavPath 和 owner routing。
- 新增路由/所有权测试，先固定 Contacts / Story 进入后不残留 Game 右栏。
- 更新现有 controller-tab-linkage.test.ts：旧的 contacts-draft / archive-draft 断言改为新的 WorkspaceFrame 断言。
- 先不删除共享 renderer，确保迁移有可回退内容源。

### P1：ContactsWorkspace

- 新增 ContactsWorkspaceState，允许 selectedVariantId = null。
- 新增 openContactsWorkspace() 与 renderContactsWorkspace()。
- app-shell 增加 contacts Workspace 分支。
- 三栏通过 WorkspaceFrame 输出；中栏、右栏使用正式占位页。
- Game 的通讯录入口改为 Workspace route action，不再写 centerTab = contacts-draft。
- openCharacterWorkspace() 迁移为 ContactsWorkspace 内的 selectedVariant 更新适配层。

### P2：Contacts 角色选择迁移

- 选择学生后保持 data-workspace-frame = contacts。
- 将角色详情 / 成长 renderer 作为 Contacts 内部内容复用。
- 将相关装备、经验、突破和已读操作从 Game panel 刷新改为 Contacts Workspace fallback。
- 清理 CharacterWorkspace 作为顶层路由的新增入口；保留旧 renderer 和兼容测试，待 P5 删除。

### P3：StoryWorkspace

- 新增 StoryWorkspaceState、openStoryWorkspace() 与 renderStoryWorkspace()。
- 迁移 Story navigation 内容；navPath 进入 StoryWorkspaceState。
- 中栏、右栏先使用 Story 自己的占位页。
- Game 的故事入口改为 Workspace route action，不再只写 leftTab = story。
- Story 的档案入口不能继续写 archive-draft；按 Records Service 方案或独立 Story 子路由完成明确迁移。

### P4：Story owner 解耦与播放迁移

- 移除 owner → openCharacterWorkspace() 的 UI 路由。
- owner 只传给 Story Commands / Story Service 作为 conversation sandbox key。
- 确认浮层、聊天门控、开幕标题和演出文本绑定 Story Workspace 的 active conversation。
- Story playback 首期允许完整刷新 StoryWorkspace；稳定后再开放 Story center Region 更新。
- 更新 refreshChatPanel()、controller-actions-story.ts 和 controller-events.ts 的 Workspace 分支。

### P5：返回、Surface 与刷新收口

- 用带 route 的 WorkspaceReturnContext 替代只保存三栏 Tab 的返回语义。
- UISurfaceRuntime 增加 contacts / story key，并覆盖 route 改变、重新 mount、旧 callback 丢弃。
- refreshPanels() 收窄为 Game 兼容 API；Contacts / Story 使用 invalidateWorkspace 或等价入口。
- Reveal、主题变化、日志和奖励通知按当前 Workspace 消费者刷新。
- 不再通过旧 panel class 查找 Contacts / Story 的结构节点。

### P6：清理旧 Game 页面身份

- 删除 contacts-draft、archive-draft 作为 Game centerTab 的分支。
- 删除 Game leftPanel 内 contacts/story 的页面渲染分支；若保留视觉入口，改为路由控制。
- CharacterWorkspace 降为 ContactsWorkspace 内部已选择角色状态，或在确认无调用点后删除。
- 更新 docs/docs-828/02-modules/ui.md 与统一刷新草案的稳定机制说明。

## 十、验收标准

### Workspace ownership

- 从 Game 点击通讯录后立即出现 data-workspace-frame = contacts。
- Contacts 未选择学生时仍能完整渲染三栏。
- 从 Game 点击故事后立即出现 data-workspace-frame = story。
- Contacts / Story 的三栏都不显示进入前的 Game Spot、学生或强化面板。
- 选择学生后 Workspace identity 仍是 contacts。
- 有 owner 和无 owner 的 Story 播放都保持 story Workspace。
- Story owner 变化只改变 conversation sandbox，不改变 Workspace type。

### 状态

- storyNavPath 不再以通用 PanelState 作为 Story 的唯一事实源。
- selectedVariantId 不再由 Game 右栏和 Contacts 同时写入。
- contacts-draft、archive-draft 不再作为 Game centerTab 页面状态。
- 新会话 / 切换 Init 后 Story 导航和 Workspace 瞬态不会残留。
- 返回依赖显式 route context；不能只靠旧 left/center/right Tab 恢复。

### 刷新与表现

- Contacts / Story 更新不会调用 Game panel renderer 替换其列。
- WorkspaceFrame、Column、Host、Theme、scroll 和 responsive contract 全部成立。
- 旧 Surface 更新在切换 Workspace 后被丢弃。
- Story Chat/Conversation 的共享 renderer 不会生成 Game Center Panel identity。
- 窄屏和键盘顺序不因三栏迁移回归。

### 内容范围

- 未设计的中栏和右栏有明确的 Contacts / Story 占位页。
- 占位页和未来真实内容使用相同 Host 与 Workspace Frame。
- 本任务不要求完成通讯录详情、Story Archive、Story Inspector 或角色成长的信息架构。

## 十一、测试与验证

### 已执行核验（2026-09-12）

- 已核对 app-shell、controller、controller-actions-topbar、controller-actions-contacts、controller-actions-story、rail、center-panel、character-workspace、workspace-frame 和 UI Surface 代码。
- 已确认现有测试仍锁定旧 contacts-draft / archive-draft 行为；迁移时必须改写为 Workspace route 验收。
- 已确认现有 WorkspaceFrame、Service、Inventory、Settings、Character、Shop 生命周期专项测试通过。
- 类型检查、架构检查和临时目录构建已通过；首次全量测试只剩既存 Shop 文本空格断言失败。随后工作树中该测试已有独立调整，本轮未编辑；Shop 专项测试现为 5/5，通过情况与完整记录见 [[docs/plan-work/newPlan/13-unified-workspace-refresh-boundaries]]。

### 待补专项测试

- contacts route 进入、未选择学生、选择学生和返回；
- story route 进入、navPath、无 owner 播放、有 owner 播放和返回；
- owner 变化不改变 Workspace type；
- Contacts / Story 三栏不残留 Game panel；
- contacts / story Surface generation 与 stale callback；
- refreshChatPanel() 在 Story Workspace 中不查询或替换 Game center-panel；
- Story archive route 与 Records Service 的最终归属；
- 新 Host 的 Registry parent / serviceId / 主题编辑器发现；
- 900px、640px、375px 的三栏堆叠、滚动、键盘焦点和返回路径。

## 十二、未决问题与风险

### 未决问题

1. Story Archive 最终归属：推荐 Records Service；若保留在 Story 内，需作为明确的 Story 子路由，而不是 archive-draft。
2. Contacts 选中学生后的中栏 / 右栏内容：首期允许复用角色 renderer，但需决定何时拆成 Contacts 专属内容。
3. Game 中通讯录 / 故事入口的视觉位置：本任务只要求 route action 语义正确，不裁定最终导航 UI。
4. Story playback 是否始终进入 Story Workspace：本草案按“是”处理；若产品希望在 Contacts 内播放，必须另行裁定，不可让 owner 隐式决定。
5. Contacts / Story Host 的具体 ID：施工前必须核对现有 Registry，避免与旧 Game / Service Host 重名。

### 风险

| 风险 | 处理方式 |
| --- | --- |
| 角色成长 renderer 与 CharacterWorkspace 绑定过深 | 先作为内部共享 renderer 复用，后续拆 Presenter，不在 P1 重写玩法 |
| Story Chat 依赖 Game center-panel selector | 先允许 Story Workspace 完整刷新，再迁移到明确的 conversation Region |
| 双写 selectedVariantId / storyNavPath | 迁移期只设一个写入源，兼容字段只读 |
| 返回路径丢失 | 使用带 route 的 returnContext，并覆盖 Contacts ↔ Story 往返测试 |
| Archive 归属不清造成重复页面 | 在 P3 前裁定 Records Service 或 Story 子路由，禁止继续扩展 archive-draft |
| 新 Host 与旧 Host 继承关系漂移 | 先登记、校验 parent/level/serviceId，再接入主题编辑器和运行时 |

## 十三、非目标

本任务不包含：

- 通讯录中栏和右栏最终玩法设计；
- Story Detail、Archive、Inspector、奖励摘要和统计的最终信息架构；
- Story Engine、StoryEntry、Story、Talklet 或 PassiveStory 重写；
- 角色成长机制和跨 Init 记忆系统重写；
- 所有 Workspace 的细粒度 DOM 优化；
- 最终美术、排版和动效；
- PlayerState、存档结构、存档迁移或 StateMutationService 规则变更。

## 十四、相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/plan-work/newPlan/13-unified-workspace-refresh-boundaries]]
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]
- [[docs/plan-work/active/task-0042-character-workspace-ui-convergence]]
- [[docs/plan-work/active/task-0043-topbar-settings-workspace]]
- [[docs/plan-work/active/task-0045-ui-incremental-update-workspace-isolation]]
- [[docs/plan-work/active/roadmap-0015-ui-dom-recalculation]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
- [[docs/plan-work/active/roadmap-0020-service-workspaces]]
- [[docs/plan-work/active/task-0047-contacts-story-workspace-ownership]]
- src/ui/components/app-shell.ts
- src/ui/components/rail.ts
- src/ui/components/center-panel.ts
- src/ui/components/character-workspace.ts
- src/ui/controller.ts
- src/ui/controller-actions-contacts.ts
- src/ui/controller-actions-story.ts
- src/ui/controller-actions-topbar.ts
- src/ui/update/ui-surface.ts
