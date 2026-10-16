# UI 基础样式 — 角色与来源

> 本文回答：已有界面的颜色、字体、布局和表面从哪里继承。范围为 ACProgram 游戏 UI；下表的实现事实已核对源码，复用用法属于本项目采用的约定。实际值以当前源码和运行时主题为准。

## 基础角色

| 项 | 已有实现 / 来源 | 复用用法与边界 |
| --- | --- | --- |
| 底色与表面 | `src/ui/css/variables.css` 提供 `--canvas`、`--panel`、`--panel-light`、`--line` 兜底；`src/ui/theme-tree.ts` 注入运行时主题变量 | 按画布、面板、次级表面角色使用，不新定页面专属浅蓝或白色体系 |
| 内容与弱化文本 | `--ink-on-panel`、`--ink-on-panel-light`、`--muted-on-panel` 等背景感知变量 | 选择与实际宿主背景对应的角色，不将正文或禁用态固定成某种灰色 |
| 宿主颜色与状态 | `src/ui/css/layout.css` 消费 `--theme-node-*`、`--ui-button-*`；`src/ui/components/tabs.ts` 输出 host/state 元数据 | 沿用对应宿主的普通、active、hover、disabled 表现；主题可变化，不另建状态配色 |
| 字体 | `variables.css` 的 body 使用 Manrope / sans-serif；`layout.css` 的工具按钮和标题等存在 DM Mono 与中文字体角色 | 优先继承目标组件排版，必要时参考同类页面；现状没有全局统一字号表，不新增字体制造页面差异 |
| 工作区几何 | `--workspace-gap`、`--workspace-left-width`、`--workspace-center-width`、`--workspace-right-width` | 使用共享 Frame 的 preset / composition / responsive，避免复制三栏几何 |
| 面板节奏 | `--panel-radius`、`--panel-shadow`、`--panel-content-padding`、`--panel-region-gap` | 继承面板 token 和共享标题区域；局部内容间距按相邻组件处理，不编造全局尺寸表 |
| 卡片表面 | `src/ui/css/cards.css` 的 `.mini-card` 消费 `--card-*` 变量 | 同类卡片保持同一套规则，通过 token 表达确需的强调；不强套到业务不同的牌面 |

## 状态与焦点入口

- 复用约定：普通按钮、主要动作、选中和禁用沿用适用共享规则。状态还应有文本或语义属性，不能只依赖颜色。已有参考：Tabs 的 `aria-selected` / `aria-pressed`。
- 已有实现：`layout.css` 的 inventory 控件有 `:focus-visible` 示例；这不能证明所有旧控件已覆盖焦点样式。

## 主题与特例

已有默认外观以浅色表面和蓝色等主题强调为起点，用户主题与宿主背景会改变结果。保持角色、控件和层级一致，不能把默认十六进制值固定到所有页面。CSS 中现存硬编码和局部修正仅是实现事实，新增代码优先使用适用 token。

超级图鉴沿用 body 级 Runtime Editor 的独立工具外观：`src/ui/runtime-editor/codex/codex.css` 在 `.runtime-editor-codex` 内定义局部 `--codex-*`，承载表面、文本、边框与强调；编辑表单继续使用 `src/ui/css/runtime-editor.css` 的 `--re-*`。共享 Frame 只复用网格几何，`.runtime-editor-codex__grid.workspace-frame` 规则重置 Frame 的 margin、gap 与 height；内容工具的纯布局入口不生成游戏 Presentation host。`tests/ui/workspace-frame.test.ts` 验证的是输出结构与 Host 隔离，不等同实际浏览器视觉验收。这是当前已实现并采用的工具范围例外，不能据此为其它页面新建固定配色。

主题机制见 [[docs/docs-829/06-wiki/50-ui/presentation-theme]]；组件入口见 [[ui-style/patterns]]。
