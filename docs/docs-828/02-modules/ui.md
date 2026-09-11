# 02-modules/ui — 前端 UI（只读消费）

> 一句话：`src/ui/` 是无框架 DOM UI，只消费 `getView()` / `createUIContext()`；controller 拆分为门面 + 职责模块，组件类型面统一使用 `GameReadModel`。

## 职责边界

- **管**：渲染、事件绑定与命令编排（controller 层）、主题变量落 CSS、聊天流打字机。
- **不管**：状态写入（只调引擎门面写方法，经 controller 层）、引擎逻辑。

## 结构

### 控制器（`src/ui/controller*.ts`）

| 文件 | 职责 |
| --- | --- |
| `controller.ts` | 门面：构造 / mount / render 编排（~686 行），委托下列模块 |
| `controller-core.ts` | 刷新策略/生命周期：reveal 指纹 / 轻量刷新 / destroy / 面板重置 / 聊天历史持久化 |
| `controller-modals.ts` | 弹层弹窗：Gacha / 强化管理 |
| `controller-panels.ts` | 面板桥接：Init 选择 / 详情 CTA / 读档按钮 |
| `controller-events.ts` | EventBus 订阅：揭示刷新 / 奖励排队 / 池 gate / 聊天流清理与演出文本 |
| `controller-theme.ts` | 主题注入：场景栈合并 + CSS 变量与背景层落 UI |
| `controller-save.ts` | 存档 / 读档 / 导入导出绑定 |
| `controller-actions-*.ts` | #app 内各域事件绑定：topbar / contacts / theme / story / inventory |

> controller 层持 AronaClicker Runtime 与 `GameCommands`（命令编排层）；**组件层**只持 `GameReadModel`（只读视图：state / registry / 查询结果，无写方法）。

### 组件（`src/ui/components/`，32 个）

| 组 | 文件 |
| --- | --- |
| 布局骨架 | `app-shell` / `header` / `rail` / `center-panel` / `right-panels` / `tabs` |
| 业务面板 | `production`（生产/设施，含招募按钮）/ `contacts`（通讯录 + 角色成长与学生故事）/ `character-workspace`（通讯录、学生故事、角色成长三栏工作区）/ `story`（剧情演出）/ `story-gate`（剧情入口确认浮层 + 开幕标题横幅）/ `collection`（图鉴）/ `enhancements` / `init-select` / `selector-page` / `global-enhancement-select` |
| tooltip 系 | `tooltip`（门面 `getTooltipContent` 路由）+ `tooltip-reveal`（揭示阶段计算）+ `tooltip-enhancement`（强化诊断）+ `tooltip-detail-*`（area/spot/enh/init/item/resource/codex 分实体渲染） |
| 其他 | `toast` / `errors` / `entity-theme-options` / `collection-modal` |

### 其他文件

| 文件 | 职责 |
| --- | --- |
| `context.ts` | `UIContext` / `GameReadModel` 类型面 |
| `theme-tree.ts` | 把引擎运行时主题 token 落成 CSS 变量（纯色彩树） |
| `background-service.ts` | 背景层解析、Pic URL 校验、回退与 DOM 层渲染；支持 Host 形状、内嵌装饰线和 hover 层 |
| `outer-background.ts` | `body` 直系最外层背景宿主的初始化与更新，不随 `#app` 重建 |
| `presentation-service.ts` | 将 `PresentationDef` 解析为 Host/状态只读 View；负责父级回退、系统颜色层和宿主背景渲染 |
| `ui-host-registry.ts` / `presentation-targets.ts` | 稳定 UI Host 注册表、父级层级校验、服务宿主发现与表现目标映射 |
| `color-scheme.ts` | 配色派生（背景感知文字色等） |
| `chat-stream.ts` | 聊天流打字机/滚动 + 开幕标题横幅状态（`showBanner` / `activeBanner`，记录 startedAt 供断点续播，3s 自动清除） |
| `selector-page.ts` | Lobby/Init 选择页交互：双轮盘装配、翻面/滑动、详情局部刷新；复用通用 Header 的服务、主题与帮助入口，并承载 Task-0025 的局部主题过渡 |
| `import-export.ts` | 存档导入/导出（含图片注册链） |
| `modal` / `popovers` / `scroll` / `player` | 弹窗 / 气泡 / 滚动 / 玩家视图 |
| `css/` | 18 个主题分区样式（variables/layout/chat/cards/selectors/codex/…，`story-overlays.css` = 剧情浮层两族组件，组件级 `--story-gate-*` / `--story-banner-*` 变量为 theme-tree 预留覆写点） |

### 剧情入口确认浮层与开幕横幅（2026-08-29 落地）

- **storyGate**（`PanelState.storyGate`，状态驱动）：`data-kizuna` / `data-start-story` / `data-replay-story` 三入口点击 → 只记状态 + render，`data-story-gate-confirm` 按 mode 分派 `startCardStory`（goto 重开，已完结亦可正常重新开始，浮层文案「重新开始」）/ `startActiveStory` / `replayStory`（故事栏重读，文案「重新观看」），`data-story-gate-cancel`（X / 取消 / 遮罩空白，卡片冒泡不关闭）关闭；换流（`data-select-variant` / `data-conversation-back`）清空。
- **开幕横幅**：`openingTitleShown` 事件（Talklet `showOpeningTitle` 效果呼出）→ `ChatStream.showBanner` 写当前活跃流 → render 时经 `PanelState.openingBanner` 渲染 `.chat-pane` 内横幅（非阻塞，CSS 动画模糊→清晰→淡出，JS 3s 计时清除）。机制详情见 [[docs/0x-plan&work/completed/affection-planning]] §3。

## 核心概念

### Lobby / Pre-Init UI

当 Runtime 已加载数据包但 `activeInit` 为空时，UI 处于 Lobby，而不是一般游戏三栏。Lobby 不启动 Tick、不提供依赖当前 Init 的生产/移动/剧情操作，但复用通用 Header 与服务工作区，提供 Init 选择、数据包、存档、记录/图鉴、主题和帮助入口。读取 Lobby 存档后仍留在 Lobby；读取带 `activeInit` 的存档才进入一般游戏界面并启动会话。

### UI Host Registry

UI 表现宿主由 `src/ui/ui-host-registry.ts` 统一登记。核心 UI 提供基础宿主，服务工作区通过 `UIServiceDefinition` 声明自己的宿主；用户主题编辑器、运行时表现刷新和预览使用同一份注册信息。新增数据包/存档服务时，应声明稳定的 Host ID，并通过 `renderUIHost` 接入，不要在主题编辑器内重复维护目标列表。

宿主未配置专属表现时按父级回退；Registry 只描述目标和层级，不保存用户主题值，也不开放任意 CSS/DOM 注入。

### 功能工作区

Shop、角色服务和完整背包等需要同时接管多个面板的功能，使用 `WorkspaceFrame`，而不是继续修改普通 `leftTab / centerTab / rightTab`。每个工作区声明固定的 `left / center / right` 列、布局 preset、响应式 profile、surface、语义 `role` 和稳定 Host ID；渲染器额外输出 `data-workspace-frame`、`data-workspace-column`、`data-workspace-role`、`data-workspace-surface`、`data-scroll` 与 `data-scroll-owner`，供主题编辑器和后续布局工具定位。Frame 统一承担三栏外层几何；`default`、`two-column`、`single-column` 只表达响应式骨架，页面内容仍可保留自己的高度和内部排列规则。

角色工作区的当前约定为：`leftPanel.character.contacts`（通讯录）、`centerPanel.character.story`（学生故事）、`rightPanel.character.progression`（角色成长）。选择学生或进入有学生归属的故事时接管三栏；退出后恢复进入前的普通游戏面板状态。无学生归属的全局故事仍使用普通游戏工作区。

三栏 panel 的顶部 Tabs 使用 `panel-tabs-region` 作为独立结构宿主：区域背景、主题装饰和底部分隔线挂在 `leftPanel.tabs` / `centerPanel.tabs` / `rightPanel.tabs`，`.switch-tabs` 仅负责 TabGroup 布局，单个按钮仍使用对应的 `*.tab` 宿主。Game 的既有 panel 继续独占外框、圆角、`overflow: hidden`，并由 `panel-body` 独占正文滚动与内容 padding；Service/Settings/Shop/Character/Inventory 的列级外框由 `WorkspaceColumn.surface = panel` 产生，正文通过 `workspace-column__body` 的 scroll owner 属性或页面明确的 List/Inspector Region 承担。普通弹窗、抽卡范围和主题编辑器内部的 `.switch-tabs` 不套用该结构。Workspace 外层 Panel 不进入旧内容 Panel 的 ScrollManager 序号快照。

### 主题与选择页表现

- 运行时可排序层为 `player → init → area → student`；`user`、`preview` 与 `ephemeral` 是独立插层，剧情临时层始终最高。
- `InitDef.theme` / `EnhancementDef.theme` 为选择页提供场景声明；一般游戏中的 Init 主题才进入运行时 `init` 层，选择页聚焦主题只做局部只读投影。
- Host 的 `default / active / inactive / disabled` 状态、形状与内嵌装饰线由 `PresentationView` 统一解析；编辑器和运行时共用 Host Registry。
- 选择页动态背景、条目局部主题和 Init 快照阶段由 [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] 管理；场景 current/next 双缓冲挂在 `.selector-super-background` 专用超级背景宿主内，`.selector-viewport` 只承载详情面，`.init-orb-disc.selector-disc` 只做圆盘装饰与定位参照，轮盘作为 shell 独立高层兄弟节点；未声明主题使用稳定回退，不改变游戏状态。

- **刷新双轨**：每帧 `refreshLight`（轻量数字）；揭示指纹变化 → `refreshRevealIfChanged` → 重建 DOM。
- **背景视觉层**：`ThemeDef.background` 沿用运行时主题层级；按 id 覆盖、匿名层追加，UI 通过 `body` 直系 `.console-background#ui-background-layer` 独立渲染，`#app` 只承载内容层与颜色继承，装饰层不接收指针事件。
- **只读纪律**（纪律 4）：组件无 `game.state` 写引用、无 `as never`（T2/T6 清零）。
- **聊天流通知次序**：`pendingTravelChats`（进入 Area「移动到了」通知）在 render 内**先于**剧情内容入流；`pendingRewardChats`（完结奖励/池解锁等）延迟 `REWARD_REVEAL_DELAY_MS`（0.8s）落账，且落账前校验活跃流演出已彻底结束（游标清空，如完结即推的尾巴播完）——未结束则顺延重试，存档前立即落账防丢。

## 测试入口

`tests/ui/`（组件、上下文、表现宿主、选择页与控制器回归；按文件分组）

## 相关文档

[[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]]（T2 执行记录）· [[docs/docs-828/02-modules/color]]（theme-tree 数据源）· [[docs/docs-828/07-audit/presentation-editor-consistency]]（编辑器/运行时一致性审计）
