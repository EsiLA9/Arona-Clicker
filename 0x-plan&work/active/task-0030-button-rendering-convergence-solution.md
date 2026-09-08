# 任务 0030：按钮主题渲染统一与形状参数编辑方案

状态：🟡 部分实施：游戏页顶部服务按钮与 Init/GlobalEnh 选择页顶栏按钮已统一到 `header.button` 宿主；其他按钮序列的统一仍待实施（2026-09-07）

## 2026-09-07 增量记录

- 新增 `renderHeaderButton` 作为顶栏普通按钮的共享渲染入口，统一宿主标识、状态、文字颜色模式与背景层。
- Init/GlobalEnh 选择页的 LOAD SAVE、翻面、返回游戏、主题、服务与帮助按钮复用 `header.button`，不再使用独立的裸按钮表现。
- 选择页将当前聚焦主题的 `presentation` 只读投影给顶栏，并在主题浮窗开合时刷新该投影；不会写入运行时主题。
- 主题展示数据补充 `header.button` 示例，覆盖按钮背景色、激活态与装饰线。

关联审查：[[task-0029-button-sequence-rendering-audit]]

## 1. 目标

在不强行抹平控件几何差异的前提下，让普通按钮序列共享一套主题表现机制：

- 默认态背景色
- hover 与 active 的主题色来源
- active/hover/inactive/disabled 的文字颜色判别
- disabled 背景与交互强度
- 用户自定义背景层、装饰线和形状参数

同时，为圆角矩形和圆角平行四边形提供游戏内 UI 编辑器中的圆角半径、X 轴倾斜角输入。

## 2. 总体方案

保留 `PresentationHost` 作为主题表现的单一运行时入口，把当前普通按钮逐步纳入 host registry。组件只负责：

1. 判断业务状态。
2. 写入稳定的 host ID 与标准状态。
3. 保留按钮自身的布局、尺寸和交互语义。

表现服务负责：

1. 根据 host 与状态取得背景层。
2. 对 hover 复用 active 同源背景与文字判别。
3. 根据最终背景决定文字模式。
4. 将用户自定义的系统颜色层、装饰线和形状参数渲染到按钮内层。

CSS 只负责背景节点的定位、裁剪、几何变换和过渡，不直接定义主题按钮的具体背景色。

## 3. 建议的 host 分类

新增 host 时应按稳定的 UI 语义命名，而不是按具体文案命名。建议增加：

| host ID | 用途 | 典型控件 |
| --- | --- | --- |
| `leftPanel.nav` | 左侧区域导航 | area nav、story nav |
| `centerPanel.action` | 中区普通操作 | 页面操作、主要提交 |
| `rightPanel.action` | 右区普通操作 | 使用物品、确认操作 |
| `service.nav` | 服务区导航 | 服务工作区内部导航 |
| `service.action` | 服务区普通操作 | 导入、应用、保存等 |
| `story.action` | 故事入口操作 | story trigger |
| `card.action` | 卡片内操作 | 已有 host，继续复用 |
| `button.primary` | 需要 primary 语义的普通按钮 | primary-button |

如果两个序列只在布局和尺寸上不同、主题语义相同，应复用同一个 host ID；如果用户需要独立编辑它们的背景、装饰线或状态颜色，再拆成独立 host。这样既能减少重复数据，也能保留用户自定义边界。

## 4. 数据结构调整

### 4.1 `PresentationHostDef`

建议在 `src/engine/types/theme.ts` 的 `PresentationHostDef` 增加两个可选字段：

```ts
cornerRadius?: number;
skewXDeg?: number;
```

字段语义：

| 字段 | 单位 | 默认值 | 作用域 | 说明 |
| --- | --- | --- | --- | --- |
| `cornerRadius` | px | `8` | host 级 | 圆角矩形及其他需要圆角的背景节点的半径 |
| `skewXDeg` | deg | 圆角矩形 `0`，平行四边形兼容默认 `-6` | host 级 | 背景节点的 `transform: skewX(...)` 参数 |

这两个字段放在 host 级，而不是 `PresentationHostStateDef` 中。原因是形状属于控件外观骨架；如果 hover、active 各自拥有不同几何，容易出现内容尺寸、装饰线和背景曲线不一致。未来确有状态形变需求时，再单独扩展状态级字段。

字段可选且只保存用户实际修改值：

- 未填写圆角半径时使用系统默认值。
- 圆角矩形未填写倾斜角时使用 `0deg`。
- 圆角平行四边形未填写倾斜角时使用当前兼容值 `-6deg`。
- 用户将值恢复为默认时，编辑器删除字段，而不是写入一份重复默认值。

项目遵守“不做存档迁移”规则；该字段加入后只需同步更新类型、schema、编辑器和测试，旧数据包不编写迁移代码。

### 4.2 安全边界

运行时和编辑器都应限制参数范围，避免倾斜后背景脱离按钮命中区域或圆角失真：

- `cornerRadius`：建议 `0–64px`，步长 `1px`。
- `skewXDeg`：建议 `-30–30deg`，步长 `0.5deg`。

超出范围的导入数据在表现层进行 clamp；编辑器显示 clamp 后的值，并提示用户范围。这个边界是渲染安全限制，不改变用户可自定义的主题数据模型。

## 5. 渲染机制调整

### 5.1 标准状态

普通按钮统一映射为：

| 业务状态 | PresentationHost 状态 | 主题来源 |
| --- | --- | --- |
| 可用且未选中 | `inactive` | 系统颜色层的基础按钮背景 |
| 鼠标悬停 | 视觉上使用 `active` 源 | active 背景与 active 文字判别 |
| 当前选中/点击保持 | `active` | active 系统颜色层或用户层 |
| 不可用 | `disabled` | disabled fallback，保留背景并降低交互强度 |

hover 不应新增一套独立的颜色判别。现有 `renderPresentationHostBackground` 已具备 inactive hover 取 active 背景的方向，普通按钮接入时应复用该能力。

### 5.2 组件职责

普通按钮组件应统一输出以下信息：

```html
<button
  class="ui-theme-button presentation-host-target"
  data-theme-host-id="service.action"
  data-theme-state="inactive"
  data-theme-text-mode="auto"
  data-theme-hover-text-mode="auto"
>
  ...
</button>
```

实际实现不要求每个组件手写这些属性；应提供共享的按钮/host 渲染辅助函数，减少漏写状态、漏挂背景节点和漏挂文字模式的风险。

组件 CSS 只保留：

- 尺寸、排列、间距
- 文本排版
- 图标位置
- disabled 的交互属性与必要的 opacity
- 背景节点的布局与裁剪钩子

移除或收敛组件 CSS 中直接决定主题背景、active/hover 文字颜色的规则，避免主题服务与 CSS 选择器互相覆盖。

### 5.3 专用控件边界

以下控件不应在第一阶段直接改造成普通按钮：

- `.send-button` / `.send-bubble`：包含 thinking、work 等复合动画。
- `.theme-swatch` 与 `.chip-x`：胶囊/小型选择语义。
- `.entity-design-option`、`.equipment-option`：选择器卡片语义。
- `.icon-button`：尺寸和图标命中区优先。

它们可以在后续复用文字颜色判别服务或增加专用 host，但不能因为统一颜色入口而丢失原有交互反馈。

## 6. 编辑器入口

在 `src/ui/components/user-theme-editor.ts` 的形状编辑区，保留现有形状选择，并增加两个直接输入项：

1. `圆角半径`：number 输入，单位 px，范围 `0–64`，步长 `1`。
2. `X 轴倾斜`：number 输入，单位 deg，范围 `-30–30`，步长 `0.5`。

建议显示如下说明：

- 圆角矩形的倾斜角默认为 `0deg`。
- 圆角平行四边形的兼容默认值为 `-6deg`。
- 正值向右倾斜，负值向左倾斜；修改的是背景与内层装饰线所在的形状目标。

编辑行为：

- 读取 host 当前值；没有字段时显示解析后的默认值。
- 输入合法值后写入 draft host，并刷新当前预览。
- 清空或恢复默认时删除对应可选字段。
- 编辑 active 状态时只改变该 host 的状态层颜色/装饰配置；形状参数仍从 host 级读取，避免 active 与 hover 几何分叉。

如果 `PresentationHostDef` 改动进入引擎类型，必须同步执行 `npm run gen:schema`，并按 schema-sync 规则更新编辑器 extras 与同步测试。

## 7. 实施顺序

### 阶段 A：抽取共享表现入口

- 提供普通主题按钮的共享渲染辅助函数。
- 明确 `inactive`、`active`、`disabled` 的状态映射。
- 统一默认背景与最终背景文字判别。
- 为普通按钮补齐 hover active 同源规则。

### 阶段 B：扩大 host 覆盖

按风险从低到高迁移：

1. 服务区内部导航和普通操作。
2. 管理入口、故事入口、左右区域导航。
3. 资源条和 primary 操作。
4. 需要独立视觉的选择器与专用按钮，逐项评估。

每迁移一组，删除该组 CSS 中与主题决策重复的背景/文字规则，只留下布局规则。

### 阶段 C：加入形状参数

- 扩展 `PresentationHostDef` 类型与 schema。
- 在表现视图中解析、clamp 并传递参数。
- 由背景节点消费 `cornerRadius` 与 `skewXDeg`。
- 在用户主题编辑器增加两个输入入口。
- 增加导入、预览、active/hover/inactive/disabled 的回归测试。

### 阶段 D：验证与收口

- 检查普通按钮序列在无用户编辑时的默认一致性。
- 检查 hover 与 active 的背景、文字颜色同源。
- 检查 disabled 不丢背景。
- 检查用户自定义系统颜色、装饰线和形状后，所有状态仍有背景节点。
- 执行 `npm test`、`npx tsc --noEmit`、`npm run check:architecture`。

## 8. 验收标准

### 默认主题

- 顶部、左右导航、服务区、卡片操作和普通操作按钮的默认态都显示各自系统颜色层提供的基本背景。
- 同一主题下，普通按钮的 active/hover 文字判别结果一致。
- active 不再依赖简单的外围 `border-color` 表现。
- disabled 仍有可识别背景，不因没有 host 或没有自定义层变成透明。

### 用户自定义主题

- 用户只改颜色时，所有普通按钮仍能显示背景。
- 用户只改装饰线时，装饰线位于背景内层，并跟随倾斜与圆角参数。
- 用户只改圆角半径或倾斜角时，背景与装饰线一起变化，不残留外部圆角包线。
- hover 与点击保持 active 不出现两套不同的背景/文字判别服务。

### 代码与数据

- 普通按钮不再各自复制主题颜色判别。
- 专用复合控件有明确的 opt-out 或专用 host 说明。
- 新增字段有类型、schema、编辑器、运行时和测试的完整链路。
- 不引入存档迁移代码，不修改禁止目录。

## 9. 方案取舍

本方案选择“统一主题表现服务，保留控件几何差异”，而不是把所有 `<button>` 强制替换成一个 CSS 类。这样可以解决用户关注的颜色、状态与自定义链路分叉，同时不破坏发送气泡、选择器和图标按钮的专用交互。

## 10. 本次实施记录

已按阶段 C 落地圆角半径与 X 轴倾斜编辑链路：

- `PresentationHostDef` 增加可选的 `cornerRadius` 与 `skewXDeg`，并已通过 `npm run gen:schema` 同步 Schema。
- 表现视图对两个参数做安全范围 clamp，并沿宿主父级链继承；参数位于 host 级，因此 default/hover/active/inactive/disabled 共用几何配置。
- 背景节点通过 CSS 自定义属性消费参数，未在 CSS 中写入任何具体主题背景色；内嵌装饰线与背景节点处于同一变换上下文。
- 游戏内用户主题编辑器增加形状、圆角半径、X 轴倾斜输入及恢复默认入口；恢复默认会删除可选字段。
- 已增加表现服务、只读上下文、背景标记和编辑器输出的回归测试。

阶段 A/B/D 的其他按钮序列仍按本方案保留为后续工作；本次增量已完成选择页顶栏这一组的统一与回归验收。
