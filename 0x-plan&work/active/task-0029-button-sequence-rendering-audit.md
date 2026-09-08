# 任务 0029：按钮序列表现链路对照审查

状态：✅ 调查完成（2026-09-07）

## 1. 调查目标

当前顶部按钮序列的默认、hover、active、disabled 与文字颜色已经接入主题表现目标，但左侧导航、服务区、卡片操作、故事入口、装备选择等区域仍然存在明显不同的按钮风格。本次审查回答两个问题：

1. 哪些按钮已经复用 `PresentationHost` 的主题判别服务。
2. 哪些按钮仍然通过组件 class 与局部 CSS 自己决定背景、边框和文字颜色，以及这些差异为何出现。

本次只做机制调查和方案输入，不修改按钮渲染代码。

## 2. 结论摘要

顶部按钮与非顶部按钮目前不是同一条渲染链路：

- 顶部按钮、面板 Tab、卡片操作按钮具有稳定的 host ID，经过 `renderPresentationHostBackground`、`backgroundForHost` 和文字颜色模式判别。
- 其他区域的大多数按钮没有 UI host 注册，也没有 `data-theme-host-id`，背景与文字颜色由 `layout.css`、`chat.css`、`cards.css`、`modal.css`、`story-nav.css`、`equipment.css` 和组件专用 CSS 分别处理。
- 因此即使这些按钮都叫“按钮”，它们的默认背景、hover 背景、active 背景、disabled 表现以及文字可读性判断并不共享同一个主题服务。
- 既有的按钮状态统一计划只完成了顶部、Tab 和卡片操作这一部分，UI Host Registry 的覆盖范围没有随着计划扩大。

## 3. 实际链路对照

| 按钮序列 | 主要入口 | 是否注册 UI host | 默认/hover/active 背景 | 文字颜色 | disabled | 当前判断 |
| --- | --- | --- | --- | --- | --- | --- |
| 顶部主题、服务、帮助按钮 | `src/ui/components/header.ts` | 是，`header.button` | `backgroundForHost`；hover 复用 active 背景 | `textColorModeForHost`，hover 有单独 active 同源判别 | 主要通过 host 状态 | 已统一，属于目标基线 |
| 左/中/右面板 Tab | `src/ui/components/tabs.ts` | 是，`leftPanel.tab`、`centerPanel.tab`、`rightPanel.tab` | host 状态背景，active 与 hover 可复用 | host 文字模式 | 可通过 host 状态表达 | 已统一，属于目标基线 |
| 卡片内操作按钮 | `src/ui/components/enhancements.ts`、`production.ts` | 是，`card.action` | host 状态背景 | host 文字模式 | host disabled 状态 | 部分统一，仍受卡片布局 CSS 影响 |
| 左侧区域导航 | `src/ui/components/rail.ts` | 否 | `.area-nav`、`.nav-item.active` 与局部 hover 规则 | 面板文字或局部颜色 | 主要依赖 class/原生 disabled | 未接入主题表现 host |
| 故事面包屑、故事入口 | `src/ui/components/rail.ts` | 否 | `.story-crumb`、`.story-trigger` 自己定义 | 常使用 cyan 或面板文字 | 没有统一 disabled 背景判别 | 未接入主题表现 host |
| 联系人列表与返回按钮 | `src/ui/components/contacts.ts`、`conversation.ts` | 否 | `.contact-row`、`.conversation-back` 局部定义 | 面板文字、cyan 等局部规则 | 各自处理 | 未接入主题表现 host |
| 服务工作区内部导航与操作 | `src/ui/components/service-workspace.ts` | 外层容器有 host，内部按钮没有 | `.service-nav-item`、`.pack-entry-select`、`.primary-button` 等各自定义 | 面板文字、primary 文字等各自定义 | 各自处理 | 外壳统一，按钮未统一 |
| 卡片管理入口 | `src/ui/components/enhancements.ts` | 否 | `.manager-entry` 自定义 panel 背景与 hover | 面板文字/cyan | class 或原生 disabled | 与卡片操作按钮分叉 |
| 资源条、主要操作 | `src/ui/components/header.ts`、`global-enhancement-select.ts` | 大多否 | `.primary-button` 或组件专用规则 | `ink-on-primary` 或硬编码白色语义 | 原生 disabled 或局部 opacity | 与顶部 host 不是同一来源 |
| 装备选项、实体外观选项 | `equipment.ts`、`entity-theme-options.ts` | 否 | 选择器自己的 active/locked 样式 | 局部面板/主题颜色 | locked/opacity | 属于专用选择控件，不能直接等同普通按钮 |
| 发送按钮 | `src/ui/components/center-panel.ts` | 否 | `.send-button` 内部 `.send-bubble`，含 thinking/work 等复合状态 | 气泡专用颜色 | disabled 有独立语义 | 属于复合交互，不建议直接套普通按钮 host |
| 图标按钮、主题色 swatch、chip | 多个组件 | 否 | 尺寸、胶囊、图标或删除 chip 的专用规则 | 由控件语义决定 | 各自处理 | 应分类为专用控件，按需接入而非强行合并 |

## 4. 逻辑不同的原因

### 4.1 UI Host Registry 只覆盖了早期统一范围

`src/ui/ui-host-registry.ts` 当前核心 host 主要是：

- `header.button`
- 三组 `*.Panel.tab`
- `card`
- `card.action`
- `bubble`

服务工作区注册的是容器 host，而不是其中的导航、选择和提交按钮。其他按钮没有稳定 host ID，自然无法调用相同的背景与文字判别服务。

### 4.2 渲染入口不同

已统一的按钮在 markup 中包含 `presentation-host-target`，由 `renderPresentationHostBackground` 生成背景节点，并把主题状态写入 `data-theme-state`。

未统一的按钮通常只是普通 `<button>`，组件通过 class 表达状态，页面最终依赖 CSS 选择器决定表现。它们没有经过 `backgroundForHost(hostId, state)`，也没有经过 `textColorModeForHost(hostId, state)`。

### 4.3 状态命名和状态载体不同

统一链路使用明确的 host 状态，例如 `inactive`、`active`、`disabled`，并能从父 host 或系统颜色层取得 fallback。

旧链路同时存在以下表达方式：

- `.active`、`.is-active`
- `.disabled`、`:disabled`
- `.locked`
- `.primary-button`
- `.send-button--thinking`、`.send-button--work`
- `aria-current` 或组件内部变量

这些状态不一定一一对应。同一个“不可用”语义，有的只降低 opacity，有的改变边框，有的没有背景；同一个“hover”语义，有的使用 `theme-node-highlight`，有的使用 `cyan`，有的只改变边框。

### 4.4 CSS 仍然承担了主题决策

`layout.css` 的普通按钮规则、`cards.css` 的卡片操作规则、`story-nav.css` 的故事入口规则等，直接决定了背景和文字颜色。这样会产生以下差异：

- 默认态可能使用 `--ui-button-bg`、`--panel`、透明背景或卡片专用 token。
- hover 可能使用 `theme-node-highlight`、cyan、active 背景，或者只有边框变化。
- active 有时使用 `--ui-button-bg-active`，有时使用 `rgba(var(--primary-rgb), .20)`，有时不存在。
- 文字可能使用 `--ink-on-active`、`--ink-on-highlight`、`--ink-on-panel`、卡片专用颜色或白色。
- disabled 没有一个统一的最终背景与文字颜色判定服务。

### 4.5 “按钮”中混入了不同的控件语义

发送气泡、胶囊 swatch、装备选项、实体外观选项和图标按钮虽然可能使用 `<button>`，但它们有独立的尺寸、布局、动画或选择语义。若直接把所有 `<button>` 替换成同一视觉，会破坏这些控件的交互表达。

因此需要统一的是“普通主题按钮”的状态判别与主题渲染，不是让所有按钮共享完全相同的几何尺寸和装饰。

## 5. 形状参数现状

当前 `PresentationHostDef.shape` 只区分：

- `rounded-rectangle`
- `rounded-parallelogram`

表现层对平行四边形使用固定的 `transform: skewX(-6deg)`，圆角则通过现有继承关系表现。编辑器目前只有形状选择，没有独立的圆角半径和倾斜角入口。这导致用户可以选择形状，却不能精确复用同一形状参数。

## 6. 期望效果

普通主题按钮在没有额外编辑时应满足：

1. 默认态都从同一套系统颜色 fallback 得到非透明的基本背景色。
2. hover 使用与 active 同源的背景和文字判别逻辑，只在交互强度或可见性上有必要差异。
3. active 的文字颜色根据最终 active 背景判别，不再依赖简单外围 `border-color` 或局部硬编码。
4. inactive、disabled 都有明确的主题状态；disabled 可以降低交互强度，但不应因为绕过主题服务而丢失背景。
5. 用户自定义 host 后，背景层、文字判别和形状参数仍沿用同一链路。
6. 圆角半径和 `skewX(deg)` 都能在游戏内 UI 编辑器直接调整，并且几何变化作用于背景与装饰线所在的同一个内层目标。

## 7. 调查后的方案边界

建议将控件分为两类：

### 普通主题按钮

包括区域导航、服务导航、管理入口、普通提交/主要操作、故事入口、卡片操作等。它们应获得稳定 host ID，统一接入状态、背景、文字和装饰线服务。

### 专用复合控件

包括发送气泡、主题 swatch、chip、图标按钮、装备/实体外观选择器等。它们保留自己的几何与交互语义，但可以复用统一的颜色判别服务，或在明确需要时接入专用 host 类型。

完整实施设计见 [[task-0030-button-rendering-convergence-solution]]。

