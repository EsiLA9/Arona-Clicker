# 09-roadmap/0009-theme-control-backgrounds — 主题控件背景层与定位

> 本文规划主题编辑器对按钮、Tab、开关、输入框等 UI 控件背景的支持。主题色节点与作用域继承沿用 [[0x-plan&work/active/roadmap-0008-theme-color-system-refactor]]；页面、面板和区域背景层沿用 [[0x-plan&work/active/roadmap-0006-ui-background-layering]]。

## 状态

**🔵 规划中**

当前主题编辑器已经支持主题色、语义节点、界面簇透明度和区域图层透明度；控件背景尚未建立独立的数据模型与编辑入口。

## 目标

使按钮与控件具备与页面/面板背景一致的能力：

- 支持多背景层；
- 支持颜色、渐变和受控图片资源；
- 支持透明度、定位、尺寸、重复和混合模式；
- 按控件语义和交互状态继承；
- 背景透明度不影响文字、SVG 和交互命中；
- 由 TypeScript 解析最终值，CSS 只消费安全变量或安全内联样式。

## 边界

### 第一阶段支持

```text
button
tab
toggle
input
select
icon-button
```

状态包括：

```text
normal / hover / active / selected / focus / disabled
```

背景层支持：

```text
color
linear-gradient
radial-gradient
注册图片资源
opacity
position
size
repeat
blend-mode
attachment
```

### 暂不支持

- 任意 CSS 选择器注入；
- 任意外部图片 URL；
- 单个文字或 SVG 子节点的背景层编辑；
- 复杂动画时间线和逐帧背景；
- 用户自定义任意新控件类型；
- 让控件背景反向修改引擎状态。

## 数据模型

控件背景层应复用现有背景层的安全解析约束，但拥有独立挂载目标：

```ts
interface ThemeBackgroundLayer {
  id?: string;
  kind: 'color' | 'gradient' | 'image';
  value: string;
  opacity?: number;
  position?: string;
  size?: string;
  repeat?: string;
  blendMode?: string;
  attachment?: 'scroll' | 'fixed' | 'local';
}

interface ThemeControlStyle {
  backgrounds?: ThemeBackgroundLayer[];
  text?: string;
  border?: string;
  icon?: string;
}

interface ThemeControlState {
  normal?: ThemeControlStyle;
  hover?: ThemeControlStyle;
  active?: ThemeControlStyle;
  selected?: ThemeControlStyle;
  focus?: ThemeControlStyle;
  disabled?: ThemeControlStyle;
}
```

透明度应限制在 `0..1`。`backgrounds` 的数组顺序决定绘制顺序，数组后面的图层位于上方。

## 控件语义与颜色节点

控件只声明语义，不自行选择主题色位置：

```text
tab.active.background
button.hover.background
toggle.selected.background
```

自动背景来源按以下顺序解析：

```text
具体作用域 + 控件 + 状态
    > 作用域控件 + 状态
    > 全局控件 + 状态
    > 对应语义主题节点
    > 主题色列表自动分配
    > 系统兜底
```

背景、文字、边框和 SVG 图标应作为同一状态的关联结果解析，以便统一使用 `ink-on-*` 判别结果。

## 作用域继承

控件背景沿用现有 UI 构成树：

```text
root
└─ header
└─ left
   ├─ left.area
   ├─ left.contacts
   └─ left.story
└─ center
└─ right
```

示例：

```text
left.contacts.tab.active
    → left.tab.active
    → tab.active
    → highlight / active
    → 主题色列表回退
```

子作用域默认继承完整图层数组。使用相同 `id` 的图层时覆盖该层；新增不同 `id` 的图层时追加到继承结果。

## 渲染结构

每个可配置控件使用独立背景容器：

```text
.ui-control
├─ .ui-control__background
│  └─ .ui-control__background-layer × N
└─ .ui-control__content
   ├─ text
   └─ svg
```

要求：

```css
.ui-control {
  position: relative;
  isolation: isolate;
}

.ui-control__background,
.ui-control__background-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ui-control__background {
  overflow: hidden;
  border-radius: inherit;
}

.ui-control__content {
  position: relative;
  z-index: 1;
}
```

不能给整个控件使用 `opacity` 实现背景透明，否则文本、SVG 和命中区域都会同步变淡或受影响。

## 编辑器规划

主题编辑器新增“控件系统”分区，保持当前左导航、右编辑区布局：

```text
左侧：控件类型
  按钮
  Tab
  开关
  输入框
  选择框
  图标按钮

右侧：交互状态
  常态
  悬停
  激活
  选中
  聚焦
  禁用
```

每个状态显示：

```text
背景层列表
文字节点
边框节点
图标节点
继承来源
实时预览
```

背景层编辑项显示：

```text
类型 / 值 / 透明度 / 定位 / 尺寸 / 重复 / 混合模式 / 附着方式
```

## 实现切片

| 切片 | 内容 | 状态 |
| --- | --- | --- |
| K0 | 接入蔚蓝档案透明三角形 SVG/PNG 资源，作为主题实验室背景与顶部按钮/Tab 的初版装饰试验 | ✅ 初版 |
| K1 | 盘点现有按钮、Tab、输入框和 SVG 的背景/状态 CSS | 🔵 |
| K2 | 抽取通用 `ThemeBackgroundLayer` 安全解析与校验 | 🔵 |
| K3 | 增加控件语义、状态和作用域数据结构 | 🔵 |
| K4 | 实现控件背景层的父子继承与同 ID 覆盖 | 🔵 |
| K5 | 增加 `.ui-control__background` 渲染容器 | 🔵 |
| K6 | 迁移顶部按钮、三栏 Tab、开关和主要输入控件 | 🔵 |
| K7 | 接入文字、边框和 SVG 的统一 `ink-on-*` 判别 | 🔵 |
| K8 | 在主题编辑器增加控件系统面板与实时预览 | 🔵 |
| K9 | 增加解析、继承、安全校验和状态渲染测试 | 🔵 |
| K10 | 更新主题色、UI 模块和背景层文档 | 🔵 |
| K11 | 将编辑入口统一为表现层，支持全局/区域层排序、系统颜色层忽略和中文选项 | ✅ 初版 |

## 验收标准

- 未配置控件背景时，现有主题色自动分配结果保持不变；
- 配置多个背景层时，层顺序、透明度和混合模式稳定；
- 定位值只影响对应控件，不溢出到相邻控件；
- 背景透明度变化不会改变文字和 SVG 的不透明度；
- hover、active、selected、disabled 状态可以分别继承和覆盖；
- 左栏、顶部栏和中部 Tab 使用同一套语义控件逻辑；
- 非法颜色、图片资源和定位值被拒绝或回退到安全默认值；
- `npm test`、`npx tsc --noEmit` 和架构检查通过。

## 关键裁定待定

1. 控件背景是否与外部 `PresentationLayerDef` 共用完全相同的字段类型。
2. 同 ID 图层覆盖时，是替换整层还是只覆盖已填写字段。
3. hover 与 focus 是否允许只添加状态图层，而不复制 normal 图层。
4. 控件背景图片是否只允许已注册图片资源。
5. 是否将 `modal`、`card`、`popover` 也纳入同一套控件背景语义。
