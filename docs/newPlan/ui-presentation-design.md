# docs/newPlan/ui-presentation-design — UI 表现协议扩展设计

本文回答：如何在不破坏“数据包声明式、UI 只读消费、状态单一写入口”纪律的前提下，为 UI 提供更丰富且更易复用的视觉与交互设定。

## 1. 目标

当前项目已经具备主题、背景层、图片资源和运行时主题合并能力：

- `src/engine/types/theme.ts`：`ThemeDef` 与 `BackgroundLayerDef`；
- `src/engine/core/theme-runtime.ts`：player / area / student / ephemeral 层级合并；
- `src/ui/background-service.ts`：背景层解析、资源回退和 DOM 渲染；
- `src/data-services/assets/`：PicDef、图片资源登记与 PicId 解析；
- `src/ui/context.ts`：组件使用的只读 `UIContext`。

后续目标不是让数据包直接编写 HTML 或 CSS，而是让数据包能够声明：

1. 表现作用于哪个语义区域；
2. 使用哪些图片、颜色和装饰层；
3. 不同状态下如何显示；
4. 在不同屏幕和动效偏好下如何回退；
5. 编辑器如何安全地编辑和预览这些配置。

其中，组件或子图像的位置应支持相对于父组件 / 父区域的左上、右上、左下、右下和中心定位，不能要求数据包直接编写页面级 `left/top` 样式。

## 2. 设计原则

### 2.1 数据声明表现，组件负责解释

数据包只声明结构化表现数据。组件不接收 HTML、任意 CSS 选择器或 JavaScript 回调。

### 2.2 使用语义区域，不使用任意 z-index

背景和装饰应绑定 `centerPanel`、`story`、`header` 等语义区域。区域内部由运行时决定绘制顺序，数据包不直接操作任意 z-index。

### 2.3 所有资源经过现有 Pic 链

图片仍使用 `mod:type(pic):id` 引用。运行时只消费已解析 URL，失效资源跳过并使用安全回退。

### 2.4 表现数据不进入 PlayerState

主题、布局、图片和动效属于表现层。除非未来明确需要玩家保存自定义外观，否则不进入存档状态。

### 2.5 保留确定性回退

缺图、非法 CSS 值、未知表现类型、窄屏和 `prefers-reduced-motion` 都必须有默认行为，不得让整个 UI 失效。

### 2.6 表现数据必须经过安全管线

表现数据不是可执行模板，也不是可直接写入 DOM 的内容。任何来自数据包、存档或外部导入包的值，都必须经过以下管线：

```text
原始 JSON
  → schema / Registry 结构校验
  → 表现解析器与枚举白名单
  → PicId / CSS 值 / 条件 DSL 专项校验
  → 只读 PresentationView
  → HTML 属性与文本转义，或 DOM API 写入
  → UI 渲染
```

具体要求：

- 禁止数据包直接提供 HTML、SVG 文本、脚本、事件处理器、DOM 选择器或 CSS 代码；
- 图片只能通过 PicId 解析为已登记资源 URL，直接 URL 仅作为受控兼容入口；
- SVG 只能作为图片资源使用，不得将 SVG 字符串以内联方式插入 DOM；
- `kind`、`region`、`anchor`、`fit`、`motion`、`blendMode` 等字段只能接受协议枚举；
- 颜色、渐变、位置、尺寸、重复方式和混合模式必须经过独立白名单校验；
- 文本、标签、图片 URL、data-* 属性和 style 属性必须分别进行上下文相关转义；
- `visibleWhen` 只能使用现有 Condition DSL，由条件系统求值，不得使用 `eval` 或函数表达式；
- 组件渲染器不得把原始 Def 拼接为 HTML，只能接收已解析的只读 View；
- 非法值、缺失引用和循环父级必须被拒绝或跳过，并保留其余 UI 内容；
- 校验失败应输出结构化诊断信息，不能静默执行未验证内容。

“经过转义”不能替代“经过白名单校验”：转义负责避免上下文注入，协议校验负责限制数据的语义范围，两者都必须存在。

## 3. 表现区域

建议增加语义化区域枚举：

```ts
type PresentationRegion =
  | 'shell'
  | 'header'
  | 'leftPanel'
  | 'centerPanel'
  | 'rightPanel'
  | 'footer'
  | 'story'
  | 'modal';
```

当前 `ThemeDef.background` 可逐步演进为 `ThemeDef.presentation.layers`。迁移期间可以保留 `background` 作为兼容入口，由解析层转换为 `centerPanel` 或 `shell` 的默认区域。

```ts
interface PresentationLayerDef {
  id?: string;
  region: PresentationRegion;
  kind: 'solid' | 'gradient' | 'image';
  value: string;
  opacity?: number;
  position?: string;
  size?: string;
  repeat?: string;
  blendMode?: string;
  attachment?: 'scroll' | 'fixed' | 'local';
}
```

示例：

```ts
presentation: {
  layers: [
    {
      id: 'center-hoshino',
      region: 'centerPanel',
      kind: 'image',
      value: 'base:background(pic):hoshino',
      opacity: 0.32,
      position: '78% 50%',
      size: 'auto 92%',
    },
    {
      id: 'center-triangles',
      region: 'centerPanel',
      kind: 'image',
      value: 'base:overlay(pic):triangles',
      opacity: 0.4,
      position: 'right top',
      size: '36rem',
      blendMode: 'screen',
    },
  ],
}
```

合并规则沿用现有主题规则：低优先级先绘制，高优先级后绘制；同区域、同 `id` 覆盖；匿名层按声明顺序追加。合并时先按 `region` 分组，避免 shell 背景误绘制到中部面板。

## 4. 统一只读接口

在 `UIContext` 上增加表现查询面：

```ts
interface PresentationQuery {
  region(region: PresentationRegion): RegionView;
  asset(ref: string): ResolvedAssetView | undefined;
  token(name: string): string | undefined;
  motion(name: string): MotionView;
  prefersReducedMotion(): boolean;
}
```

```ts
interface RegionView {
  visible: boolean;
  layers: readonly BackgroundViewLayer[];
  classes: readonly string[];
  styleVars: Readonly<Record<string, string>>;
  density: 'compact' | 'comfortable' | 'spacious';
}
```

组件只依赖 `ctx.presentation.region('centerPanel')`，不直接理解 PicService、主题层栈或 CSS 白名单。`BackgroundService` 可以继续作为内部实现，但不应成为每个组件都要掌握的接口。`RegionView`、`ResolvedAssetView` 和 `MotionView` 必须是已校验、已归一化、只读的结果，不能暴露原始 Def 或未经检查的字符串。

## 5. 图片资源表现元数据

当前 `PicDef` 只有 `id`、`src` 和 `label`。建议增加可选表现元数据：

```ts
interface PicDef {
  id: string;
  src: string;
  label?: string;
  alt?: string;
  role?: 'avatar' | 'background' | 'overlay' | 'icon' | 'sticker' | 'banner';
  focalPoint?: { x: number; y: number };
  defaultFit?: 'cover' | 'contain' | 'natural';
  tintable?: boolean;
  preload?: boolean;
}
```

例如：

```ts
{
  id: 'base:background(pic):hoshino',
  src: hoshinoPicUrl,
  label: '星野场景图',
  alt: '星野',
  role: 'background',
  focalPoint: { x: 0.72, y: 0.5 },
  defaultFit: 'contain',
  preload: true,
}
```

`focalPoint` 和 `defaultFit` 可以让多个区域复用同一图片，而不必在每个区域重复硬编码定位参数。`alt` 主要服务可访问性；纯装饰层仍由渲染容器设置 `aria-hidden`。

## 6. 面板和状态表现

为了支持中部信息栏、空状态、锁定状态和剧情状态，建议增加语义化配置，而不是让数据包提供 HTML。

### 6.1 面板表现

```ts
interface PanelPresentationDef {
  region: PresentationRegion;
  layers?: PresentationLayerDef[];
  header?: {
    icon?: string;
    eyebrow?: string;
    accent?: string;
  };
  emptyState?: {
    icon?: string;
    title?: string;
    description?: string;
  };
}
```

### 6.2 信息项表现

```ts
interface InfoItemPresentationDef {
  id: string;
  label: string;
  valueSource: string;
  icon?: string;
  colorToken?: string;
  visibleWhen?: Condition;
  priority?: number;
}
```

### 6.3 状态外观

```ts
interface StateAppearanceDef {
  state: 'locked' | 'available' | 'active' | 'completed' | 'warning';
  label?: string;
  icon?: string;
  colorToken?: string;
  emphasis?: 'quiet' | 'normal' | 'strong';
}
```

这些接口可以统一处理 Area、Spot、Init、剧情入口和资源项的状态显示，避免状态文案和颜色逻辑散落在多个组件中。

## 7. 组件与子图像相对定位

背景层适合表达覆盖整个区域的视觉，但角色立绘、装饰图、徽章和局部插图需要在父区域内部独立定位。为此增加 `PresentationComponent`，其位置始终相对于 `parent` 计算。

```ts
type PlacementAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

interface ComponentPlacementDef {
  id: string;
  parent: string;
  asset?: string;
  anchor: PlacementAnchor;
  offset?: { x: number; y: number; unit: 'percent' | 'px' };
  size?: { width?: number; height?: number; unit: 'percent' | 'px' | 'auto' };
  fit?: 'contain' | 'cover' | 'natural';
  visibleWhen?: Condition;
}
```

数据包示例：

```ts
presentation: {
  components: [
    {
      id: 'center-student-portrait',
      parent: 'centerPanel',
      asset: 'base:background(pic):hoshino',
      anchor: 'bottom-right',
      offset: { x: 4, y: 2, unit: 'percent' },
      size: { height: 88, unit: 'percent' },
      fit: 'contain',
    },
    {
      id: 'center-triangle-decoration',
      parent: 'centerPanel',
      asset: 'base:overlay(pic):triangles',
      anchor: 'top-left',
      offset: { x: 3, y: 4, unit: 'percent' },
      size: { width: 40, unit: 'percent' },
      fit: 'contain',
    },
  ],
}
```

锚点语义：`top-left`、`top-right`、`bottom-left`、`bottom-right` 分别将子图像对应角贴近父区域角；`center` 将子图像中心与父区域中心对齐。`offset` 从锚点向父区域内部偏移，优先使用百分比以适应窗口缩放；`size` 与 `fit` 控制尺寸和图片适配方式，默认保持纵横比。

`parent` 可以指向表现区域、另一个 `PresentationComponent` 或未来定义的稳定 UI 插槽。运行时必须校验父级存在、禁止循环引用，并将组件树解析为只读 `ComponentView`。

组件定位不开放任意 DOM 选择器、页面级坐标或任意 z-index。装饰组件默认 `pointer-events: none`；交互组件仍由现有 UI 组件负责渲染。

## 8. 动效接口

动效使用有限的命名预设，不接受任意 CSS 动画：

```ts
type MotionPreset =
  | 'none'
  | 'fade'
  | 'fade-up'
  | 'soft-scale'
  | 'slide-in'
  | 'pulse';

interface MotionDef {
  enter?: MotionPreset;
  exit?: MotionPreset;
  hover?: MotionPreset;
  duration?: 'fast' | 'normal' | 'slow';
}
```

所有预设由 UI CSS 统一实现，并强制响应 `prefers-reduced-motion`。数据包只能选择预设，不能改变动画脚本。

## 9. 数据层级与优先级

建议的数据来源层级：

```text
Datapack
├─ ColorGroup
│  ├─ color tokens
│  └─ presentation defaults
├─ PicDef
│  └─ asset metadata
├─ Init
│  └─ worldline presentation
├─ Area
│  └─ area / panel presentation
├─ CharacterVariant
│  └─ student / conversation presentation
├─ Story / Talklet
│  └─ story presentation and motion
└─ UI defaults
   └─ engine fallback only
```

运行时优先级仍为：

```text
引擎默认 → 玩家主题 → 世界线 → 区域 → 学生对话 → 剧情临时层
```

颜色 token 和表现层可以共享优先级，但应在内部保持职责分离：颜色系统负责 token，PresentationService 负责区域、资源和动效。

## 10. 编辑器支持

编辑器应将复杂表现结构拆成易编辑的区块：

1. 区域选择：`shell / centerPanel / story`；
2. 图层列表：拖拽排序、启用/禁用、复制、删除；
3. 图片引用：只显示 Pic 表中的候选项；
4. CSS 属性：枚举和受限输入，不显示任意 CSS；
5. 预览：在固定比例的面板模拟器中显示图层；
6. 校验：缺失图片、重复 id、非法 opacity、不可用 blendMode 给出明确错误。

对于 `PresentationComponent`，编辑器应额外提供父级选择、五个锚点快捷按钮、X/Y 相对偏移、拖拽预览、宽高与纵横比锁定、图片适配方式和窄屏预览，并对父级循环、资源缺失和超出安全区给出警告。

预览应直接消费与运行时相同的 `PresentationView`，避免编辑器和正式 UI 各自实现一套解析逻辑。

编辑器预览同样必须走上述安全管线，不能为了预览而绕过 Registry、资源解析器、表现解析器或转义逻辑。

## 11. 分阶段实施

### P1：区域化表现层

- 引入 `PresentationRegion`；
- 将背景层增加 `region`；
- `ResolvedTheme` 返回按区域分组的背景；
- 中部面板只消费 `centerPanel` 层；
- 保留旧 `background` 字段兼容转换。

### P1.5：组件相对定位

- 引入 `PresentationComponent` 与 `PlacementAnchor`；
- 支持区域 / 组件作为父级；
- 实现百分比偏移、尺寸和 `contain / cover / natural`；
- 增加默认裁剪、装饰层指针穿透和父级循环校验；
- 增加窄屏和缺图回退。

### P2：图片表现元数据

- 扩展 `PicDef`：`role`、`alt`、`focalPoint`、`defaultFit`、`preload`；
- `PicService` 返回只读 `ResolvedAssetView`；
- 统一头像、背景、贴图和横幅的默认适配规则。

### P3：PresentationView

- 在 `UIContext` 增加 `presentation`；
- 组件通过 `region()`、`asset()`、`token()` 消费表现数据；
- 收拢背景解析、回退和区域样式逻辑。

### P4：状态与动效预设

- 增加面板、信息项、状态外观；
- 增加命名动效预设；
- 接入 reduced-motion 和窄屏回退。

### P5：编辑器预览

- 增加图层拖拽排序；
- 增加区域预览；
- 使用运行时同源解析器做预览和校验。

## 12. 明确暂不支持

暂不允许数据包声明：

- 任意 HTML；
- 任意 CSS 选择器；
- 任意 JavaScript 回调；
- 任意 z-index 数值；
- 自由 CSS 动画代码；
- 像素级绝对布局；
- 进入 PlayerState 的表现配置。

这些能力会让数据包变成第二套前端代码，增加安全风险、编辑器负担和跨版本维护成本。

组件定位虽然允许相对偏移，但仍不支持任意绝对页面坐标、任意 z-index、任意 DOM 选择器和自由 CSS transform。

## 13. 验收标准

- 同一图片可以安全复用于背景、头像、贴图等多个语义场景；
- Area、学生对话和剧情临时表现可以按区域独立叠加；
- 组件 / 子图像可以相对于父区域或父组件定位到左上、右上、左下、右下或中心；
- 百分比定位在窗口缩放和窄屏下保持稳定，异常情况有可预测回退；
- 子图像默认不遮挡操作控件，装饰层不拦截交互；
- 缺图或非法表现值不会导致 UI 空白；
- 组件不直接依赖资源存储和主题层栈内部结构；
- 任意表现值都经过 schema、语义白名单和上下文转义后才能进入 UI；
- 条件只由 Condition DSL 求值，不执行数据包提供的代码；
- SVG、图片 URL、HTML 文本和 style 属性均有独立的安全测试；
- 编辑器能编辑并预览所有已支持字段；
- 桌面、窄屏和 reduced-motion 环境有确定性回退；
- 表现数据不进入 PlayerState，不改变状态写入口纪律；
- 新增字段遵守 `src/engine/types/` → `gen:schema` → 编辑器映射同步流程。

## 14. 相关现状文件

- `src/engine/types/theme.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/background-service.ts`
- `src/ui/context.ts`
- `src/data-services/contracts/pic.ts`
- `src/data-services/assets/pic-service.ts`
- `tools/datapack-editor/schema/editor-extras.ts`
- `docs/docs-828/02-modules/ui.md`
- `docs/docs-828/02-modules/pics.md`
