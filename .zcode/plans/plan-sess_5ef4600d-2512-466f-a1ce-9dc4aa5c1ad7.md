# src/ui 大文件拆分与职责优化计划

## 目标与依据

按 `docs-824/06-refactoring-guide.md` 规范（>400 行考虑拆、瘦身门面模式、re-export 兼容层、`import type` 防循环依赖），把本轮检查发现的三个超限文件拆到单文件 <400 行、职责单一。**纯移动代码，零行为变化**，不改公共 API、不新增依赖、不动 `src/ui/dist`。

| 文件 | 现状 | 目标 |
| --- | --- | --- |
| `src/ui/controller.ts` | 996 行 | ~350 行门面 |
| `src/ui/components/tooltip.ts` | 544 行 | ~90 行门面 + 7 个 detail 文件 |
| `src/ui/styles.css` | 3785 行 | 14 个按主题分区的 CSS 文件（每个 <410 行） |

## 阶段一：tooltip.ts 按实体类型拆分（独立，先做）

沿用已拆出的 tooltip-reveal / tooltip-enhancement 模式（re-export 兼容层保持 `./components/tooltip` 导入路径不变，消费方 controller-core / popovers 无需改动）。

1. **前置**：共享基础 `OBFUSCATED` / `REVEAL_TARGET_LABEL` / `renderRevealTriggers`（现 15-56 行）移入 `tooltip-reveal.ts` 并 re-export，避免新模块与 tooltip.ts 互引成环。
2. **拆出 7 个 detail 文件**（各 30~110 行，自带头部类型 import）：
   - `tooltip-detail-spot.ts` — `renderSpotDetail`（115-215，102 行，最大）
   - `tooltip-detail-area.ts` — `renderAreaDetail`（59-112）
   - `tooltip-detail-enh.ts` — `renderEnhancementDetail`（245-314）
   - `tooltip-detail-init.ts` — `renderInitDetail`（317-379）
   - `tooltip-detail-item.ts` — `renderItemDetail`（382-424）
   - `tooltip-detail-resource.ts` — `renderResourceDetail`（218-242）
   - `tooltip-detail-codex.ts` — `renderPoolDetail` + `renderPassiveEntryDetail` + `summarizeEffects`（476-544，图鉴域自成一组）
3. **tooltip.ts 瘦身为门面**：保留 re-export 兼容层（8-13 行）+ `getTooltipContent` 路由（426-473）+ 各 render* 一行 re-export，约 90 行。

## 阶段二：controller.ts 按职责域拆分（996 → ~350 行）

遵循现有 controller-core/modals/panels 模式：**自由函数 + `ctrl: UIController` 参数 + `import type` 反向依赖（无运行时环）**，controller.ts 保留一行委托壳；需跨模块访问的私有字段（如 `themeFloatOpen`）改 `@internal` public（已有 `refreshTimer`/`panelState` 先例）。

1. **`controller-events.ts`（~110 行）**：mount() 内 EventBus 订阅块（136-234）——onAny 揭示刷新、storyRewarded 奖励排队、poolGateChanged、storyAreaTraveled、聊天流清理、story 完成/触发、chatTextShown。导出 `bindEvents(ctrl)`。
2. **`controller-theme.ts`（~115 行）**：`restoreThemeFloat`（296-309）+ `applyTheme`（315-401，场景栈合并 + CSS 变量注入的运行时逻辑，与 theme-tree.ts 纯色树区分）+ `themeFloatOpen`/`themeFloatPos` 字段（92-93）。
3. **`controller-save.ts`（~50 行）**：收敛散落在 bindActions 608-631（#save-game/#load-game）与 controller-panels 154-165（#load-game-init）的存/读档逻辑，统一 SaveSystem.load → game.load → restoreHistories 流程。
4. **`controller-actions-*.ts`（5 个域模块）**：bindActions() 主体（520-1006，约 486 行）按现有注释分组拆出，每模块导出 `bind<域>Actions(ctrl)`，render() 依次调用：
   - `controller-actions-topbar.ts` — 顶栏/全局工具条 + Tab 切换（521-652，约 130 行）
   - `controller-actions-contacts.ts` — 通讯录/角色 + Gacha 入口 + 角色成长（654-781，约 65 行）
   - `controller-actions-theme.ts` — 主题交互 data-* 事件绑定（696-758，约 65 行；注意与 controller-theme.ts 的"应用 CSS 变量"区分）
   - `controller-actions-story.ts` — 剧情全域（783-891，约 110 行）
   - `controller-actions-inventory.ts` — 背包/区域/强化/升级/重启（893-1005，约 115 行）
5. **controller.ts 保留**：构造函数 + mount 壳（含存档分流、定时器、快捷键）+ render 编排 + startNewGame/resumeInit + 各模块委托壳，约 350 行。

## 阶段三：styles.css 按主题分区拆分（3785 → 14 文件）

`main.ts` 改为 14 行 css import（vite 打包合并，零运行时差异）。**引入顺序严格保持原文件顺序**（variables 最前；远程字体 `@import` 仅保留在 variables.css 顶部——CSS 规范要求 @import 必须位于样式之前，拆后其他文件不能带 @import）：

| 新文件 | 原行范围 | 职责 |
| --- | --- | --- |
| `variables.css` | 1-53 | 远程字体 + :root 兜底主题变量 |
| `layout.css` | 54-400 | console-shell 布局/顶栏/资源条/三栏骨架 |
| `story-nav.css` | 401-738 | 故事条目 + 层级导航 |
| `chat.css` | 738-1121 | tabs/中栏/对话气泡/旁白/回复卡片 |
| `chat-input.css` | 1122-1302 + 2766-2865 | Send 输入区 + 演出文本覆盖层 |
| `cards.css` | 1303-1664 | mini 卡片/卡片 token/旧按钮兼容/按钮容器 |
| `toast.css` | 1665-1728 | Toast 通知层 |
| `selectors.css` | 1729-2060 | Init 选择屏轮盘 + 镜像面 + 动画 |
| `popover.css` | 2061-2259 | 悬浮提示层 |
| `modal.css` | 2260-2487 | 弹窗母版 |
| `codex.css` | 2488-2765 + 3736-3785 | 图鉴 collection/分区色彩/调色板 + 装备图鉴卡片 |
| `contacts.css` | 2866-3091 + 3492-3658 | 通讯录 + 对话空间顶栏 + 羁绊卡片 |
| `theme-panel.css` | 3090-3250 | 主题设置浮窗 + 层级分组 |
| `entity-theme.css` | 3251-3491 | 实体主题来源选择 |
| `equipment.css` | 3659-3735 | 色彩装备 |

（14 个文件，每个 <410 行，职责单一。）

## 验证与收尾（每阶段后执行）

1. `npx tsc --noEmit` 零错误（严格保证 import 面完整）
2. `npm test` 全部通过（行为零变化；ui 层无单测，主要靠 tsc + 手工冒烟）
3. `npm run dev:game` 手工冒烟：提示面板各实体类型、通讯录/招募、剧情、主题浮窗、Init 轮盘、存档/读档
4. 文档同步（项目纪律）：更新 `docs-824/01-file-composition.md` 的 src/ui 映射表、`docs-824/05-architecture-review.md` 大文件清单（标注三大文件已拆完）

## 明确不做

- 不改任何引擎代码、不改公共 API 签名、不新增依赖/框架
- 不拆 `tools/datapack-editor/ui`（本次范围外）
- 不拆 engine 剩余文件（game-num-eval 418 行按基线保持不动）
- 不动 `src/ui/dist/`（git 忽略的旧构建产物）