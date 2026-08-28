---
kind: frontend_style
name: 基于 CSS 变量与运行时主题树的 Arona Clicker UI 样式系统
category: frontend_style
scope:
    - '**'
source_files:
    - src/ui/css/variables.css
    - src/ui/css/layout.css
    - src/ui/css/entity-theme.css
    - src/ui/css/cards.css
    - src/ui/css/chat.css
    - src/ui/css/modal.css
    - src/ui/css/popover.css
    - src/ui/css/toast.css
    - src/ui/theme-tree.ts
    - src/ui/controller-theme.ts
    - src/ui/color-scheme.ts
    - vite.config.ts
---

## 1. 采用的体系/方法

- **纯 CSS + CSS Custom Properties（CSS 变量）**：项目不使用任何 CSS-in-JS、Tailwind、PostCSS 或 Sass，所有样式以原生 `.css` 文件组织在 `src/ui/css/`，按语义模块拆分（`layout.css`、`cards.css`、`chat.css`、`modal.css`、`popover.css`、`toast.css`、`entity-theme.css`、`variables.css` 等）。
- **设计令牌（Design Tokens）双轨制**：
  - 引擎层 token：通过 `engine/system/color-system` 解析 ColorGroup / ThemeDef，注入为 `--ac-*` 自定义属性（如 `--ac-primary`、`--ac-bg`、`--ac-panel`），作为“强制设色层”。
  - 界面语义 token：由 `src/ui/theme-tree.ts` 的 `THEME_NODES` 把一组语义名（`ink`、`panel`、`canvas`、`cyan`、`player-bubble`、`npc-bubble`、`muted`、`line`、`primary-rgb`、`lime`、`orange`）展开为 `--<name>` 变量，并自动派生对应的 `--ink-on-*`、`--muted-on-*` 文本对比色。
- **运行时主题树（Theme Tree）**：`controller-theme.ts` 在每次渲染前清空旧变量 → 合并玩家全局层 + Area 场景层 + 对话学生场景层 → 写入 `document.documentElement.style` 上的 `--ac-*` 与语义变量，再计算 `--hero-gradient`。主题切换是 O(1) 的变量覆写，无整页重绘。
- **构建工具**：Vite（`vite.config.ts`）提供 MPA 入口（`/game`、`/editor`、`portal`），CSS 直接由 Vite 原样打包；无 SCSS/Less/Tailwind 预处理链。

## 2. 关键文件

| 文件 | 职责 |
|---|---|
| `src/ui/css/variables.css` | 远程字体（DM Mono + Manrope）、`:root` 兜底主题变量、`box-sizing` reset、`body` 背景渐变 |
| `src/ui/css/layout.css` | 三栏布局（`.console-shell`、`.workspace` grid 230px/1fr/300px）、顶栏、资源条、面板、导航项 |
| `src/ui/css/entity-theme.css` | 角色聊天气泡、状态面板、颜色槽、Gacha 池等实体相关样式 |
| `src/ui/css/*.css` | 各功能域样式（`cards.css`、`chat.css`、`codex.css`、`contacts.css`、`conversation.css`、`equipment.css`、`modal.css`、`popover.css`、`selectors.css`、`story-nav.css`、`theme-panel.css`、`toast.css`、`chat-input.css`） |
| `src/ui/theme-tree.ts` | 色彩树定义（`THEME_NODES`）、`buildThemeVars` 生成 CSS 变量映射、`buildThemeTree`/`applyThemeTree` 作用域化主题、`heroGradient` |
| `src/ui/controller-theme.ts` | 运行时主题控制器：清理旧变量、合并场景层、注入 `--ac-*` 与语义变量 |
| `src/ui/color-scheme.ts` | 卡片强调色注册表与 `accentPalette` 派生器（独立于全局主题，输出内联 `--card-*` token） |
| `vite.config.ts` | Vite MPA 配置，定义 `/game`、`/editor`、`portal` 三个入口 |
| `tools/datapack-editor/ui/styles.css` | 数据编辑器工具的独立样式（与游戏 UI 分离） |

## 3. 架构与约定

### 3.1 三层颜色优先级
1. **覆盖层（overrides）**：调用 `buildThemeVars(primary, overrides)` 时传入的键值对最高优先，直接覆盖任意节点。
2. **引擎强制层（`--ac-*`）**：若节点声明了 `acRef`（如 `ink: { acRef: 'text' }`），则生成 `var(--ac-text, <derive>)`，让数据包作者可通过 ColorGroup 覆盖。
3. **自动衍生层（derive/constant）**：无 `acRef` 或 `acRef` 缺失时回退到 `derive(primary)` 或硬编码 `constant`（如 `lime`、`orange`、`panel` 默认白）。

### 3.2 背景感知文本色
所有标记 `isBg: true` 的节点（`panel`、`panel-light`、`canvas`、`cyan`、`player-bubble`、`npc-bubble`）会额外生成 `--ink-on-<name>` 与 `--muted-on-<name>`。`bgLightness` 用 WCAG 相对亮度 Y 阈值（0.30）判定：暗底 → 白字 `#ffffff`，亮底 → 深灰 `hsl(220 18% 12%)`。这保证无论主题如何变化，气泡、面板上的文字始终可读。

### 3.3 主题来源与作用域
- **全局主题**：由 `controller.applyTheme` 写入 `document.documentElement.style`，影响整个页面。
- **实体主题**：`buildThemeTree` + `applyThemeTree(el)` 可将主题树应用到任意容器元素，实现“某个区域/对话框使用不同配色”的作用域化。
- **场景栈**：`colorSystem.pushSceneTheme({ scope: 'area' | 'student', groupId, tokens })` 维护 Area 与学生对话两套场景层，运行时按优先级合并。

### 3.4 卡片强调色隔离
`color-scheme.ts` 的 `COLOR_SCHEME_REGISTRY` 是硬编码的安全约束：颜色值不来自 extra，仅从 tags/type 推导语义角色；`accentPalette` 基于 accent 色 HSL 派生完整 `--card-*` token 串，输出为内联 style，使强调卡视觉完全自洽、不受全局主题变量污染。

### 3.5 布局与响应式约定
- 主布局采用 CSS Grid：`.workspace { grid-template-columns: 230px minmax(0, 1fr) 300px; }` 固定左/右面板宽度，中间自适应。
- 字号使用 `clamp()` 做流体缩放（如 `h2 { font-size: clamp(28px, 4vw, 54px); }`）。
- 间距大量使用 `gap` 而非 margin，配合 `flex`/`grid` 保持紧凑。
- 字体统一为 `Manrope, sans-serif`，辅助信息使用 `'DM Mono', monospace`。

## 4. 约定与约束

- **禁止在 `variables.css` 中使用 `var(--ac-*, …)`**：注释明确说明该层仅为 JS 未注入时的兜底，运行时变量由 `theme-tree.ts` 注入，避免循环依赖。
- **颜色值安全约束**（见 `color-scheme.ts` 注释）：颜色值全部硬编码在注册表内，不从 `extra` 读取；调用方按实体固有属性决定语义角色；强调卡色板由单一 accent 色确定性派生，零主题变量引用。
- **背景明暗判定必须用 JS 计算**：注释指出 `color-contrast()` 跨浏览器支持不稳，因此 `--ink-on-*` 采用确定性 JS 计算后落静态色值，避免失效导致深底上出现深字。
- **主题变量命名规范**：语义变量统一为 `--<name>`（如 `--ink`、`--panel`、`--cyan`），引擎 token 统一为 `--ac-<key>`，二者通过 `var(--ac-*, derive)` 链组合。
- **组件样式模块化**：每个 UI 模块对应一个独立 `.css` 文件，集中管理该模块的类名与样式，避免单一大 CSS 文件。
- **构建产物隔离**：Vite 将 `web-dist` 作为构建输出目录，源码中的 `.css` 不经预处理直接打包，确保开发/预览产物一致。

## 5. 适用性判断

本仓库是一个前端 Web 应用（Arona Clicker 放置类 RPG），拥有完整的 CSS 样式体系、主题系统与可视化 UI，因此 `frontend_style` 类别完全适用。