# 02-modules/ui — 前端 UI（只读消费）

> 一句话：`src/ui/` 是无框架 DOM UI，只消费 `getView()` / `createUIContext()`；controller 拆分为门面 + 6 个职责模块，组件类型面收窄为 `UIFacingGame`（T2）。

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

> controller 层持完整 `GameInstance`（命令编排层）；**组件层**只持 `UIFacingGame`（18 个只读成员：state / registry / 查询系统 / 子门面，无写方法，T2）。

### 组件（`src/ui/components/`，28 个）

| 组 | 文件 |
| --- | --- |
| 布局骨架 | `app-shell` / `header` / `rail` / `center-panel` / `right-panels` / `tabs` |
| 业务面板 | `production`（生产/设施，含招募按钮）/ `contacts`（通讯录 + 招募弹窗）/ `story`（剧情演出）/ `collection`（图鉴）/ `enhancements` / `init-select` / `selector-page` / `global-enhancement-select` |
| tooltip 系 | `tooltip`（门面 `getTooltipContent` 路由）+ `tooltip-reveal`（揭示阶段计算）+ `tooltip-enhancement`（强化诊断）+ `tooltip-detail-*`（area/spot/enh/init/item/resource/codex 分实体渲染） |
| 其他 | `toast` / `errors` / `entity-theme-options` / `collection-modal` |

### 其他文件

| 文件 | 职责 |
| --- | --- |
| `context.ts` | `UIContext` / `UIFacingGame` 类型面 |
| `theme-tree.ts` | 把引擎运行时主题 token 落成 CSS 变量（纯色彩树） |
| `color-scheme.ts` | 配色派生（背景感知文字色等） |
| `chat-stream.ts` | 聊天流打字机/滚动 |
| `selector-page.ts` | 选择页交互：双轮盘装配、翻面/滑动、详情局部刷新 |
| `import-export.ts` | 存档导入/导出（含图片注册链） |
| `modal` / `popovers` / `scroll` / `player` | 弹窗 / 气泡 / 滚动 / 玩家视图 |
| `css/` | 16 个主题分区样式（variables/layout/chat/cards/selectors/codex/…） |

## 核心概念

- **刷新双轨**：每帧 `refreshLight`（轻量数字）；揭示指纹变化 → `refreshRevealIfChanged` → 重建 DOM。
- **只读纪律**（纪律 4）：组件无 `game.state` 写引用、无 `as never`（T2/T6 清零）。

## 测试入口

`tests/ui/`（5 个 + 子目录）

## 相关文档

[[docs-828/06-adr/0001-architecture-consolidation]]（T2 执行记录）· [[docs-828/02-modules/color]]（theme-tree 数据源）
