# 主题色彩系统精细化与来源可视化 Roadmap

## 1. 文档目的

记录主题色彩系统从“主色变量映射”升级为“设计角色、组件状态、来源追踪与安全编辑”的路线，并规划主题编辑器打开时，玩家悬停游戏内容即可查看其实际色彩来源。

## 2. 当前基线

当前 `src/ui/theme-tree.ts` 通过 `THEME_NODES` 将主色和引擎 Token 展开为 CSS 变量：

```text
primary
  → cyan / primary-rgb / player-bubble / npc-bubble
panel / panel-light / canvas
  → ink-on-* / muted-on-*
ink / muted / line
lime / orange
```

全局主题由 `controller-theme.ts` 合并运行时层后注入 `:root`；设施可以通过 `buildThemeTree()` 生成局部 ThemeTree 并以内联样式作用域化。当前不足是：节点粒度偏粗、组件状态共用颜色、节点来源不可见、清空和继承语义需要进一步结构化。

## 3. 精细化目标

### 3.1 设计角色层

从单一 `line`、`cyan`、`muted` 发展为可解释的角色树：

```text
surface: canvas / panel / panelRaised / panelInset / panelDisabled
content: textPrimary / textSecondary / textMuted / textDisabled / textOnAccent
border: borderSubtle / borderDefault / borderStrong / borderActive / borderFocus
accent: primary-50 … primary-900
semantic: success / warning / danger / info
```

每个角色只承担一个视觉职责，组件不再直接争用同一个通用颜色。

### 3.2 组件状态层

为 button、card、tab、input、story gate 等组件提供 default、hover、active、selected、disabled、focus、locked、completed 状态槽位。

### 3.3 来源追踪层

CSS 输出继续保持扁平，但解析结果额外保留来源：

```ts
interface ResolvedThemeNode {
  value: string;
  source: 'default' | 'player' | 'user' | 'area' | 'student' | 'story' | 'local';
  inheritedFrom?: string;
  overridden?: boolean;
}
```

来源追踪必须是只读视图，不写入 PlayerState，不改变主题合并优先级。

### 3.4 背景感知层

对图片、SVG、渐变背景增加受控的 tint、overlay、vignette、contrastMode 等绑定，使图片背景上的文字、边框和操作按钮保持可读。任意图片地址、任意 CSS 和脚本仍然禁止进入渲染路径。

### 3.5 继承语义层

明确区分：

```text
inherit   当前层不声明，跟随上一层
override  当前层声明具体值
default   请求系统默认值
locked    不允许下层覆盖（仅系统/演出层使用）
```

编辑器中的“清空”只产生 `inherit`，不能混同为透明色或恢复默认。

## 4. 悬停显示实际色彩来源

### 4.1 用户体验

当用户自定主题编辑器打开时，玩家将鼠标悬停在顶部栏、中部信息栏、轮盘、背景、聊天气泡、设施卡或按钮上，界面显示轻量来源提示：

```text
当前节点：borderActive
实际颜色：#3b9eff
来源：Area 主题
覆盖链：默认 → 玩家主题 → Area 主题
可编辑：是 / 否
```

提示应是非阻塞 tooltip，不改变原元素尺寸，不拦截点击，不显示内部对象引用或未经转义的用户内容。

### 4.2 元素到节点的映射

优先采用渲染器输出的受控属性：

```html
data-theme-node="panel"
data-theme-role="surface"
data-theme-property="background"
```

不通过扫描任意 CSS 文本猜测来源，也不把用户输入拼接为 selector、HTML 或脚本。

对一处元素存在多个属性时，允许声明多个受控节点：

```html
data-theme-bindings="background:panel;color:ink-on-panel;border:line"
```

### 4.3 读取流程

```text
pointerenter
  → 找到受控 data-theme-bindings
  → ThemeInspector 查询解析后的 ThemeTree trace
  → 展示实际 CSS 计算值与来源层
pointermove / pointerleave
  → 更新或移除 tooltip
```

查询必须使用 UI 只读上下文，不直接访问可写状态。

### 4.4 局部 ThemeTree

对于设施卡、学生差分卡等局部 ThemeTree：

```text
全局节点：panel
局部节点：Spot 自定义 ThemeTree.panel
最终值：局部节点覆盖全局节点
```

tooltip 应显示“局部主题”以及其父级实体，而不是误报为全局玩家主题。

## 5. 分阶段路线

### Phase 0：基础修正

- 主题编辑浮窗使用 viewport-fixed 定位，拖动不受右栏网格限制；
- 删除编辑器中的宣传性预览内容；
- 保持颜色清空 = 当前层不声明 = 跟随上一层；
- 补充浮窗渲染和主题运行时回归测试。

### Phase 1：节点注册与映射

- 建立 `ThemeRole`、`ThemeState` 和 `ThemeProperty` 枚举；
- 为顶栏、三栏、资源条、Tab、聊天气泡、Spot 卡和剧情组件登记受控绑定；
- 将直接使用通用变量的关键 CSS 逐步迁移到角色节点；
- 保持旧变量作为兼容性回退，避免一次性改动全部 CSS。

### Phase 2：来源追踪

- 将主题合并从单纯 `Record<string,string>` 扩展为 values + trace 双视图；
- 记录来源层、覆盖节点、继承链和局部 ThemeTree 边界；
- 为用户主题编辑器提供当前值、上一层值和可清空状态；
- 增加来源链、层级覆盖和局部主题的引擎测试。

### Phase 3：Hover Inspector

- 在渲染器输出中加入受控 `data-theme-*` 标记；
- 实现只读 `ThemeInspectorService` 和非阻塞 tooltip；
- 编辑器打开时启用来源提示，关闭时移除提示监听；
- 颜色、边框、文字色分别展示，不把三者合并成模糊的“主题色”；
- 支持局部 ThemeTree 和背景/演出层的来源说明。

### Phase 4：语义色与可读性

- 引入 primary 色阶和 success/warning/danger/info 语义组；
- 增加对比度检查、背景感知文字色和透明叠加后的最终值检查；
- 为用户编辑器提供“可读性通过/需要调整”的即时反馈；
- 为背景图片和 SVG 增加受控 tint、overlay 与 contrastMode。

### Phase 5：完整视觉 Token

- 将圆角、阴影、密度、动效和字体层级拆为独立 Token 树；
- 颜色树只负责颜色和来源，不承担所有视觉属性；
- 编辑器按“颜色 / 状态 / 背景 / 来源检查”组织，而不是增加更多装饰性预览区域。

## 6. 安全边界

- 用户输入只进入白名单字段和受控枚举；
- 所有 HTML 文本经过 `escapeHtml`；
- 图片只能通过 PicService / 注册资源解析；
- 不执行任意 CSS、HTML、selector、脚本或事件处理器；
- 来源 tooltip 只读取系统生成的 trace，不回显未经转义的原始输入；
- 预览层、来源检查和 tooltip 都不写入正式 PlayerState。

## 7. 验收标准

- 浮窗可以移动到视口任意合法位置，不受右栏或顶部栏布局限制；
- 编辑器打开时，外部 UI 元素悬停能显示实际生效的颜色、边框和文字色来源；
- 显示来源层级、继承链和局部 ThemeTree 覆盖关系；
- 清空 Token 后来源正确回退到上一层；
- 剧情临时层、用户预览层和局部实体主题的优先级显示正确；
- tooltip 不改变页面布局，不阻塞原 UI 操作；
- 恶意输入无法进入可执行渲染路径；
- 全量测试、类型检查、架构检查和生产构建通过。

## 8. 当前状态

- Phase 0 的浮窗定位修正与编辑器内容收缩正在落地；
- Phase 1–5 为后续实施路线，尚未把来源追踪和 Hover Inspector 误认为已经完成。
