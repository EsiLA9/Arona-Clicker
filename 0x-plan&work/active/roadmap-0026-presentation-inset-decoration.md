# roadmap-0026 — 表现宿主内嵌装饰线

> 本文规划将表现按钮的外部默认包线替换为主题数据驱动的内嵌装饰线。实现时以本文为施工边界；表现宿主的状态合并与编辑器一致性继续遵循 [[docs-828/07-audit/presentation-editor-consistency]]。

## 一、目标

表现按钮不再依赖宿主元素自身的 `border`、`border-radius` 或 hover/active 外框。按钮的轮廓装饰由表现数据包声明，并渲染在背景层内部，与背景形状共享同一套变换和裁切。

首期目标覆盖 `rounded-rectangle` 与 `rounded-parallelogram`；未来增加其他形状时，装饰线不需要新增一套按钮 CSS。

## 二、问题与原因

| 现象 | 原因 | 影响 |
| --- | --- | --- |
| 倾斜背景外仍有圆角矩形包线 | `toolbar-button`、`switch-tab`、`mini-action` 等基础样式仍设置宿主边框 | 视觉上出现两个不同几何体，形状配置无法完整控制按钮外观 |
| hover/active 的边缘与背景形状不一致 | 状态规则在宿主上设置 `border-color` / `box-shadow`，绕过背景层 | 状态切换后包线、光晕和背景分别变化 |
| 用户只能配置背景，不能配置轮廓装饰 | `PresentationHostDef` 只有 `shape`、`layers` 和状态层，没有装饰线字段 | 用户只能接受 CSS 默认包线或通过背景图片模拟轮廓 |
| 编辑器无法预览同一条装饰线 | 编辑器只编辑图层，运行时另有宿主 CSS | 编辑结果与游戏中的最终几何表现可能不一致 |

## 三、设计原则

1. **表现数据驱动**：颜色、粗细、内缩、透明度和线型由 Datapack 的 `PresentationHost` 声明；通用 CSS 不写死装饰色或背景。
2. **几何单一来源**：装饰线必须位于已经应用形状变换的背景表现层内部，不能继续绘制在外部宿主包线上。
3. **状态路径统一**：default、hover、active、disabled 通过相同的 Host 状态解析和装饰线渲染入口生成。
4. **继承可解释**：状态未定义某个装饰字段时继承 default；Host 未定义时继续按现有父级 Host、Init、Area、Student、Player 顺序回退。
5. **无配置即无装饰**：没有 `decoration` 时不生成装饰节点，也不恢复隐藏的 CSS 默认边框。
6. **只读 UI**：组件只消费 `UIContext` 的解析结果；编辑器修改 draft，保存仍通过既有主题服务和状态写入口完成。
7. **安全字段**：颜色和数值沿用背景服务的安全解析、夹取和 CSS 属性白名单，不开放任意 CSS 字符串。

## 四、数据结构

### 4.1 新增装饰线定义

在 `src/engine/types/theme.ts` 新增 `PresentationDecorationDef`：

| 字段 | 类型 | 语义 | 建议边界 |
| --- | --- | --- | --- |
| `color` | `string` | 装饰线颜色、主题 token 或安全 CSS 颜色 | 由运行时安全解析 |
| `width` | `number` | 线宽，单位为 CSS px | `0–12`，默认未配置 |
| `inset` | `number` | 从背景形状边缘向内缩进；缺省为 `0`，即装饰线贴合宿主形状边缘 | `0–24`，单位为 CSS px |
| `opacity` | `number` | 装饰线透明度 | `0–1` |
| `style` | `'solid' \| 'dashed' \| 'dotted'` | 线型 | 首期至少支持 `solid` |

建议结构：

```text
PresentationHostDef
├─ shape?
├─ decoration?: PresentationDecorationDef
├─ layers
└─ states?: PresentationHostStateDef[]
   └─ decoration?: Partial<PresentationDecorationDef>
```

`PresentationHostStateDef.decoration` 使用 `Partial`，表示状态只覆盖需要变化的字段。空对象不应制造视觉节点。

### 4.2 运行时只读视图

在 `BackgroundView` / `PresentationHostView` 中增加解析后的 `decoration` 视图，避免 UI 直接读取 Datapack 原始对象：

```text
ResolvedDecoration
├─ color: string
├─ width: number
├─ inset: number
├─ opacity: number
└─ style: supported enum
```

解析结果需标明是否存在有效装饰配置，防止错误值被当成默认装饰线显示。

### 4.3 默认与状态合并

解析顺序保持现有 Host 状态解析：

```text
请求 host/state
→ 找到 effective host
→ 解析父级与 Init/Area/Student/Player 继承
→ 合并 host.default decoration
→ 合并当前 state decoration
→ 生成 BackgroundView / PresentationHostStateResult
```

字段级规则：

- state 有字段：使用 state 值；
- state 缺字段：使用 Host default 值；
- Host 没有值：继续使用现有父级回退结果；
- 整条回退链都没有值：返回 `undefined`，不渲染装饰线；
- active 没有专属装饰时，不得因为 active fallback 而重新生成 CSS 默认包线。

## 五、DOM 与 CSS 方案

### 5.1 目标 DOM

表现按钮统一保持如下层次：

```text
presentation-host-target
├─ presentation-host-background
│  ├─ console-background-layer × N
│  └─ presentation-host-decoration（有配置时才生成）
└─ presentation-host-content
```

装饰线放在已变形的背景节点内部，避免将 `border` 设置在 `presentation-host-target` 上。背景节点承担：

- 形状变换；
- 圆角与 overflow 裁切；
- 背景图层；
- 内嵌装饰线。

### 5.2 线型实现

- `solid`：优先使用背景节点内部的 inset 轮廓实现，确保圆角和 skew 后的边界完全一致。
- `dashed` / `dotted`：必要时生成内部装饰节点，通过受控 `border` 和内缩值绘制；该节点仍必须是背景节点的子元素，不能回到宿主外框。
- 不使用 `outline`，因为 `outline` 天然绘制在元素外部，无法满足内嵌要求。
- 不用固定颜色、固定宽度或固定渐变作为装饰线兜底。

### 5.3 基础 CSS 收敛

修改范围：

- `src/ui/css/layout.css`
- `src/ui/css/chat.css`
- `src/ui/css/cards.css`
- `src/ui/css/background.css`

处理要求：

- `button.presentation-host-target` 不再显示基础 `border`；
- 顶部工具按钮、Tab、卡片操作按钮的 hover/active 不再给表现宿主写 `border-color` 或外部 `box-shadow`；
- 非表现宿主继续保留原有边框和状态样式；
- CSS 只提供定位、层级、裁切、变换承载，不提供装饰线颜色和背景色；
- 形状变化只改变背景表现节点，内容保持正常方向和布局。

面板宿主的结构性边框需单独判断：按钮外框必须删除；面板若仍需要容器边界，应迁移为 Host decoration 或保留明确的 panel layout 边界，不能让按钮规则重新污染表现宿主。

## 六、编辑器方案

修改范围：

- `src/ui/components/user-theme-editor.ts`
- `src/ui/controller-modals.ts`
- 如有必要，补充 `src/ui/presentation-service.ts` 的编辑预览调用。

在每个表现目标的 default、active、disabled 状态编辑区增加“内嵌装饰线”：

| 控件 | 交互 |
| --- | --- |
| 启用/清除装饰线 | 创建或删除当前状态的 `decoration` 对象 |
| 颜色 | 原生颜色输入，支持清空并回到继承 |
| 粗细 | 数值输入，显示 px，限制在安全范围 |
| 边缘间距 | 数值输入，显示 px，默认 `0`；增大后装饰线向内缩 |
| 透明度 | 数值或滑块，限制 `0–1` |
| 线型 | solid / dashed / dotted |
| 继承状态 | 显示当前字段来自 default、父级还是当前状态 |

编辑器预览必须复用运行时解析后的 `BackgroundView`，不能在编辑器内另写一套装饰线 CSS 计算。

当用户在 active 状态新增装饰线时：

- active 只覆盖当前状态的装饰字段；
- default 背景和未覆盖的装饰字段仍保持可见；
- 清除 active 装饰后恢复 default/父级装饰；
- 不得出现 active 背景消失或编辑器与游戏显示不一致。

## 七、实现阶段

### D0：契约与 Schema

- 新增 `PresentationDecorationDef` 及状态字段；
- 添加中文标签、枚举说明和数值约束；
- 运行 `npm run gen:schema`；
- 更新 Schema 三向一致测试。

### D1：运行时解析

- 为 Host 视图和 BackgroundView 增加解析后的 decoration；
- 实现 default/state/父级字段级合并；
- 添加颜色安全过滤、数值夹取和线型白名单；
- 确保空配置不输出 DOM。

### D2：统一 DOM 与样式

- 在背景节点内部输出装饰线；
- 删除表现按钮外部默认包线；
- 清理 hover/active 宿主级边框和外部阴影；
- 验证圆角矩形、圆角平行四边形都由同一节点承载。

### D3：编辑器接线

- 增加装饰线字段编辑；
- 支持 default/active/disabled 的继承、覆盖和清除；
- 编辑器实时预览与运行时共享解析结果；
- 避免重复事件绑定和整页刷新造成状态丢失。

### D4：默认内容与验证

- 视需要为 Init 主题添加少量示例装饰线，验证不同形状和配色；
- 不新增重复图片资源，装饰线优先使用结构化字段；
- 执行专项测试、类型检查、全量测试；
- 在 Edge 游戏页面与内置 UI 编辑器中验收 default/hover/active/disabled。

## 八、非目标

- 本计划不处理外部光晕曲度问题；当前光晕问题暂按用户决定保留现状。
- 不在 CSS 中新增固定背景、渐变或图片。
- 不开放任意 CSS 属性或任意 CSS 字符串。
- 不改变主题色派生算法和 PlayerState 三层归属。
- 不编写旧存档迁移；结构变化按项目规则直接更新类型、默认数据和测试。
- 不让不同表现目标共享同一份图层或装饰对象。

## 九、验收标准

1. 表现按钮外部不再出现圆角矩形默认包线。
2. 配置为圆角平行四边形时，背景和内嵌装饰线同步倾斜；切回圆角矩形时同步恢复。
3. 装饰线不影响内容布局、文字方向、点击区域和键盘焦点。
4. default、hover、active、disabled 通过同一套装饰线解析和渲染入口工作。
5. 非表现宿主原有边框不受影响。
6. 用户可以配置装饰线颜色、粗细、内缩、透明度和线型；清除后回到继承或无装饰。
7. active 新增图层或装饰线时，default 背景不会消失。
8. 编辑器预览与游戏页面最终 DOM 表现一致。
9. `npm run gen:schema`、`npx tsc --noEmit` 和相关 vitest 测试通过；全量测试中的既存失败必须单独记录，不得归因给本计划。

## 十、涉及文件

| 类别 | 文件 |
| --- | --- |
| 类型与 Schema | `src/engine/types/theme.ts`、`tools/datapack-editor/schema/editor-extras.ts`、生成的 `engine-defs.gen.json` |
| 运行时解析 | `src/ui/context.ts`、`src/ui/background-service.ts`、`src/ui/presentation-service.ts` |
| 编辑器 | `src/ui/components/user-theme-editor.ts`、`src/ui/controller-modals.ts` |
| 样式 | `src/ui/css/background.css`、`src/ui/css/layout.css`、`src/ui/css/chat.css`、`src/ui/css/cards.css` |
| 默认内容 | `src/arona-clicker/content/inits.ts`（仅用于验收示例） |
| 测试 | `tests/ui/`、`tests/engine/`、`tools/datapack-editor/schema/` |

## 状态

- D0：✅ 已实施（类型、Schema 生成、字段安全校验与契约测试已完成）
- D1：✅ 已实施（Host default/state 装饰线解析、字段级继承与安全夹取已完成）
- D2：✅ 已实施（背景节点内嵌装饰线、形状变换承载与表现按钮外框收敛已完成）
- D3：✅ 已实施（default/active/disabled 装饰线编辑、继承、覆盖与清除已接入）
- D4：✅ 已实施（Init 示例、重复图片引用控制、专项测试、类型检查与构建已完成）

## 十一、实施结果

- 新增 `PresentationDecorationDef`，支持 `color`、`width`、`inset`、`opacity`、`style`；状态装饰线使用字段级 partial 覆盖，未覆盖字段继承 default。
- 装饰线只在存在有效配置时生成，并作为 `.presentation-host-decoration` 放置在已经承担形状变换的背景节点内部；表现按钮宿主保留透明占位边框以避免布局抖动，但不再绘制外部可见包线。
- 装饰线默认 `inset: 0`，与宿主背景的圆角/平行四边形边缘重合；主题仍可显式设置 `inset`，以获得向内缩进的装饰效果。
- 游戏内主题编辑器已提供启用/清除、颜色、粗细、边缘间距、透明度和线型编辑，并显示当前值是否来自 default 或状态覆盖。
- Init 示例分别覆盖主色、次色、active 局部覆盖和 disabled 透明度，未新增重复图片资源。
- 验证结果：`npm run check:architecture`、`npm run gen:schema`、`npx tsc --noEmit`、`npm run build` 通过；相关 6 个测试文件共 49 项通过。
- 全量测试共 122 个测试文件、1146 项测试，其中 121 个文件 / 1145 项通过；剩余既有失败为 `inits.theme` 引用未登记编辑器表 `colorGroups`，不属于本计划改动。
- 外部光晕曲度仍按本计划非目标保留现状。
