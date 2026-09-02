# 02-modules/ui — 前端 UI（只读消费）

> 一句话：`src/ui/` 是无框架 DOM UI，只消费 `getView()` / `createUIContext()`；controller 拆分为门面 + 职责模块，组件类型面统一使用 `GameReadModel`。

## 职责边界

- **管**：渲染、事件绑定与命令编排（controller 层）、主题变量落 CSS、聊天流打字机。
- **不管**：状态写入（只调引擎门面写方法，经 controller 层）、引擎逻辑。

## 结构

### 控制器（`src/ui/controller*.ts`）

| 文件 | 职责 |
| --- | --- |
| `controller.ts` | 门面：构造 / mount / render 编排（~540 行），委托下列模块 |
| `controller-core.ts` | 刷新策略/生命周期：reveal 指纹 / 轻量刷新 / destroy / 面板重置 / 聊天历史持久化 |
| `controller-modals.ts` | 弹层弹窗：Gacha / 强化管理 |
| `controller-panels.ts` | 面板桥接：Init 选择 / 详情 CTA / 读档按钮 |
| `controller-events.ts` | EventBus 订阅：揭示刷新 / 奖励排队 / 池 gate / 聊天流清理与演出文本 |
| `controller-theme.ts` | 主题注入：场景栈合并 + CSS 变量落 `:root` |
| `controller-save.ts` | 存档 / 读档 / 导入导出绑定 |
| `controller-actions-*.ts` | #app 内各域事件绑定：topbar / contacts / theme / story / inventory |

> controller 层持 AronaClicker Runtime 与 `GameCommands`（命令编排层）；**组件层**只持 `GameReadModel`（只读视图：state / registry / 查询结果，无写方法）。

### 组件（`src/ui/components/`，28 个）

| 组 | 文件 |
| --- | --- |
| 布局骨架 | `app-shell` / `header` / `rail` / `center-panel` / `right-panels` / `tabs` |
| 业务面板 | `production`（生产/设施，含招募按钮）/ `contacts`（通讯录 + 招募弹窗）/ `story`（剧情演出）/ `story-gate`（剧情入口确认浮层 + 开幕标题横幅）/ `collection`（图鉴）/ `enhancements` / `init-select` / `selector-page` / `global-enhancement-select` |
| tooltip 系 | `tooltip`（门面 `getTooltipContent` 路由）+ `tooltip-reveal`（揭示阶段计算）+ `tooltip-enhancement`（强化诊断）+ `tooltip-detail-*`（area/spot/enh/init/item/resource/codex 分实体渲染） |
| 其他 | `toast` / `errors` / `entity-theme-options` / `collection-modal` |

### 其他文件

| 文件 | 职责 |
| --- | --- |
| `context.ts` | `UIContext` / `GameReadModel` 类型面 |
| `theme-tree.ts` | 把引擎运行时主题 token 落成 CSS 变量（纯色彩树） |
| `color-scheme.ts` | 配色派生（背景感知文字色等） |
| `chat-stream.ts` | 聊天流打字机/滚动 + 开幕标题横幅状态（`showBanner` / `activeBanner`，记录 startedAt 供断点续播，3s 自动清除） |
| `selector-page.ts` | 选择页交互：双轮盘装配、翻面/滑动、详情局部刷新 |
| `import-export.ts` | 存档导入/导出（含图片注册链） |
| `modal` / `popovers` / `scroll` / `player` | 弹窗 / 气泡 / 滚动 / 玩家视图 |
| `css/` | 17 个主题分区样式（variables/layout/chat/cards/selectors/codex/…，`story-overlays.css` = 剧情浮层两族组件，组件级 `--story-gate-*` / `--story-banner-*` 变量为 theme-tree 预留覆写点） |

### 剧情入口确认浮层与开幕横幅（2026-08-29 落地）

- **storyGate**（`PanelState.storyGate`，状态驱动）：`data-kizuna` / `data-start-story` / `data-replay-story` 三入口点击 → 只记状态 + render，`data-story-gate-confirm` 按 mode 分派 `startCardStory`（goto 重开，已完结亦可正常重新开始，浮层文案「重新开始」）/ `startActiveStory` / `replayStory`（故事栏重读，文案「重新观看」），`data-story-gate-cancel`（X / 取消 / 遮罩空白，卡片冒泡不关闭）关闭；换流（`data-select-variant` / `data-conversation-back`）清空。
- **开幕横幅**：`openingTitleShown` 事件（Talklet `showOpeningTitle` 效果呼出）→ `ChatStream.showBanner` 写当前活跃流 → render 时经 `PanelState.openingBanner` 渲染 `.chat-pane` 内横幅（非阻塞，CSS 动画模糊→清晰→淡出，JS 3s 计时清除）。机制详情见 [[0x-plan&work/completed/affection-planning]] §3。

## 核心概念

- **刷新双轨**：每帧 `refreshLight`（轻量数字）；揭示指纹变化 → `refreshRevealIfChanged` → 重建 DOM。
- **只读纪律**（纪律 4）：组件无 `game.state` 写引用、无 `as never`（T2/T6 清零）。
- **聊天流通知次序**：`pendingTravelChats`（进入 Area「移动到了」通知）在 render 内**先于**剧情内容入流；`pendingRewardChats`（完结奖励/池解锁等）延迟 `REWARD_REVEAL_DELAY_MS`（0.8s）落账，且落账前校验活跃流演出已彻底结束（游标清空，如完结即推的尾巴播完）——未结束则顺延重试，存档前立即落账防丢。

## 测试入口

`tests/ui/`（5 个 + 子目录）

## 相关文档

[[0x-plan&work/completed/adr-0001-architecture-consolidation]]（T2 执行记录）· [[docs-828/02-modules/color]]（theme-tree 数据源）
