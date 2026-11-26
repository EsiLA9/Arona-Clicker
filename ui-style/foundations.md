# 共享视觉基础

**已采用。** 游戏界面和共用创作工具从宿主主题继承视觉角色。具体值以源码和运行时主题为准。检索工具的局部角色见 [[ui-style/visual-languages/content-tools/profile|内容检索工具]]。

| 项 | 已有实现 / 来源 | 复用用法与边界 |
| --- | --- | --- |
| 底色与表面 | `src/ui/css/variables.css` 提供 `--canvas`、`--panel`、`--panel-light`、`--line` 兜底。`src/ui/presentation/theme-tree.ts` 注入运行时主题变量 | 按画布、面板、次级表面角色使用，不新定页面专属浅蓝或白色体系 |
| 内容与弱化文本 | `--ink-on-panel`、`--ink-on-panel-light`、`--muted-on-panel` 等背景感知变量 | 选择与实际宿主背景对应的角色，不将正文或禁用态固定成某种灰色 |
| 宿主颜色与状态 | `src/ui/css/layout.css` 消费 `--theme-node-*`、`--ui-button-*`。`src/ui/components/shared/tabs.ts` 输出 host/state 元数据 | 沿用对应宿主的普通、active、hover、disabled 表现。主题可变化，不另建状态配色 |
| 字体 | `variables.css` 的 body 使用 Manrope / sans-serif。`layout.css` 的工具按钮和标题等存在 DM Mono 与中文字体角色 | 优先继承目标组件排版，必要时参考同类页面。现状没有全局统一字号表，不新增字体制造页面差异 |
| 面板节奏 | `--panel-radius`、`--panel-shadow`、`--panel-content-padding`、`--panel-region-gap` | 继承面板 token 和共享标题区域。局部内容间距按相邻组件处理，不编造全局尺寸表 |
| 卡片表面 | `src/ui/css/cards.css` 的 `.mini-card` 消费 `--card-*` 变量 | 同类卡片保持同一套规则，通过 token 表达确需的强调。不强套到业务不同的牌面 |

## 状态与焦点入口

- 复用约定：普通按钮、主要动作、选中和禁用沿用适用共享规则。顶部/返回与兼容 `story-trigger` 的共享入口位于 `workspace-controls.css`，危险动作由公共按钮变体承担。状态还应有文本或语义属性，不能只依赖颜色。已有参考：Tabs 的 `aria-selected` / `aria-pressed`。
- 已有实现：`layout.css` 的 inventory 控件有 `:focus-visible` 示例。该示例只覆盖相应控件。

已有默认外观以浅色表面和蓝色等主题强调为起点，用户主题与宿主背景会改变结果。保持角色、控件和层级一致，不能把默认十六进制值固定到所有页面。CSS 中现存硬编码和局部修正仅是实现事实，新增代码优先使用适用 token。

主题机制见 [[story-chat-and-theme-presentation]]。组件入口见 [[ui-style/patterns]]。
