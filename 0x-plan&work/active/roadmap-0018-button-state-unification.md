# 主题控件状态与表现层统一计划

## 目标

统一按钮及可交互控件的状态来源、表现层背景、文字颜色和交互反馈，消除 `active`、`is-active`、`data-theme-state` 与 CSS 伪类各自决定颜色造成的覆盖冲突。

## 状态契约

所有可配置控件统一使用 `default`、`active`、`inactive`、`disabled` 四种主题状态，并在 DOM 上明确写入 `data-theme-state`。未写入状态的控件只允许在渲染入口补齐为 `default`，不得推断为 `inactive`。

- `default`：普通可用状态。
- `active`：当前选中、打开或激活状态。
- `inactive`：可用但未选中状态。
- `disabled`：不可操作状态，须与原生 `disabled` 同步。

## 执行阶段

### P0：状态和刷新路径收束

- 检查顶部按钮、三栏 Tab、卡片操作按钮、编辑器 Switch 的状态写入。
- 统一 `renderPresentationHostBackground` 与 `refreshPresentationHostElements` 的状态传递。
- 修复局部刷新过程中缺省状态被误判的问题。
- 确保 `active/inactive/disabled` 的表现层不会互相继承或交叉复用。

### P1：CSS 表现路径统一

- 整理 `layout.css`、`chat.css`、`cards.css`、`background.css` 等重复按钮规则。
- 将用户自定义背景交由 `.presentation-host-background` 承担。
- 将 CSS 的 `active`、`hover`、`focus-visible`、`:active` 明确区分。
- 语义状态负责最终背景，hover 只提供边框、阴影或轻量叠加反馈。
- 统一按钮文字、Unicode 图标和 SVG 的 `currentColor` 传递。

### P1：文字颜色与禁用行为

- 由最终背景通过 `readableOn()` 判定前景色。
- 移除同一控件内互相竞争的 `--ink-on-*` 覆盖路径。
- 统一 disabled 的背景、文字、透明度和原生不可操作行为。
- 保留 `focus-visible` 作为键盘焦点反馈，不改变语义状态。

### P2：编辑器与测试

- 在主题编辑器中明确显示四种状态的实际生效来源。
- 增加 default/active/inactive/disabled 隔离测试。
- 增加局部刷新后状态保持测试。
- 增加 hover、focus、disabled 不覆盖用户表现层的测试。
- 使用 Edge 验证顶部按钮、Tab 和卡片按钮的四态及交互反馈。

## 目标优先级

最终优先关系为：

```text
disabled 语义状态
  > active / inactive / default 表现层
  > hover 交互反馈
  > focus-visible 可访问性反馈
```

CSS 的 `:active` 仅表示鼠标按下瞬间，不再与语义状态 `active` 混用。

## 验收标准

- 顶部按钮可分别呈现 default、active、inactive、disabled 配色。
- 修改或切换主题编辑器状态不会改变其他控件状态。
- 普通顶部按钮未标记状态时始终使用 default，而不是 inactive。
- hover 不会把用户配置的状态背景替换成另一套颜色。
- 文字和图标始终依据当前最终背景使用可读黑/白色。
- 全量 TypeScript、Vitest 和生产构建通过。
