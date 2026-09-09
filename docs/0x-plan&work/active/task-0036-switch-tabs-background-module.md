# Task：Switch Tabs 顶部区域独立背景模块

状态：✅ 已完成（浏览器验收交接至 task-0037，2026-09-09）

本文回答：如何将左栏与中栏的 `switch-tabs` 从“按钮一体排列 + 固定底部横线”升级为“顶部 Tabs 区域拥有独立主题背景模块，同时保留单个 Tab 的状态表现”。

## 目标

为以下顶部 Tab 区域增加独立的表现宿主：

- `ui-cluster ui-cluster--left-tabs switch-tabs`
- `ui-cluster ui-cluster--center-tabs switch-tabs`

目标不是给每个按钮扩大背景，而是让 Tabs 区域本身成为一个可配置的主题表现模块。区域背景、装饰线、形状和内边距由区域宿主负责；按钮的默认、active、inactive、hover 状态继续由单个 Tab 宿主负责。

## 背景

当前 `renderTabs()` 是左、中、右三栏共用的渲染入口：

- `src/ui/components/tabs.ts` 生成 `.switch-tabs` 容器；
- 容器内的每个按钮使用 `presentation-host-target`；
- 左栏调用 `renderTabs(ctx, 'left', ...)`；
- 中栏调用 `renderTabs(ctx, 'center', ...)`；
- 右栏也复用同一入口；
- 面板自身另有 `leftPanel.*`、`centerPanel.*`、`rightPanel.*` 区域宿主。

当前主题宿主注册表已经存在：

- `leftPanel.tab`
- `centerPanel.tab`
- `rightPanel.tab`

这些宿主表达的是“单个按钮”的状态，不表达 `.switch-tabs` 顶部区域的整体视觉。`initTheme()` 目前还只显式提供了 `centerPanel.tab` 的默认与 active 表现，左侧和右侧按钮依赖通用回退链。

## 当前问题

### 1. Tabs 区域没有独立表现边界

当前 DOM 语义上只有面板和按钮，没有“Tab 顶部模块”这一层。主题系统无法针对整个 Tabs 区域配置背景渐变、半透明面、内嵌装饰线或独立形状。

### 2. 横线由 CSS 固定绘制

`.switch-tabs` 直接使用：

- `margin-bottom`；
- `padding-bottom`；
- `border-bottom: 1px solid var(--line)`。

这条横线不属于任何表现宿主，不能参与主题来源、图层顺序、装饰线参数和用户主题编辑。

### 3. 区域背景与按钮背景职责混在一起

按钮已经具备 `leftPanel.tab` / `centerPanel.tab` 等状态宿主，但顶部 Tabs 区域没有自己的背景模块。若直接给 `.switch-tabs` 增加背景，会绕过 `presentation-service`，并使 CSS 固定值与主题表现系统形成第二套路径。

### 4. 共享渲染入口需要避免左右栏特殊分支

`renderTabs()` 同时服务三栏。只为左栏和中栏增加特殊 HTML，会让同一组件产生分支结构，增加 CSS 和测试维护成本。建议设计成通用 `*.tabs` 区域宿主，至少为左、中栏接入，并为右栏保留同构扩展点。

## 设计边界

### 区域宿主与按钮宿主分工

| 层级 | 建议宿主 | 负责内容 |
| --- | --- | --- |
| 面板 | `leftPanel` / `centerPanel` / `rightPanel` | 面板整体背景、面板边界和面板级装饰 |
| Tabs 区域 | `leftPanel.tabs` / `centerPanel.tabs` / `rightPanel.tabs` | 顶部区域背景、装饰线、形状、区域内边距 |
| 单个按钮 | `leftPanel.tab` / `centerPanel.tab` / `rightPanel.tab` | 单按钮默认、active、inactive、hover 及文字颜色 |
| 正文区域 | `leftPanel.<tab>` / `centerPanel.<tab>` / `rightPanel.<tab>` | 当前页面正文的区域表现 |

区域宿主不拥有当前 Tab 状态；单个按钮宿主也不负责整个 Tabs 区域的横线或背景。这样可以同时实现“区域统一底板”和“按钮独立选中态”。

### 推荐 DOM 结构

建议由 `renderTabs()` 生成以下结构，示意如下：

```text
div.switch-tabs.presentation-host-target[data-theme-host-id="leftPanel.tabs"]
├── div.presentation-host-background
└── div.switch-tabs-content[role="tablist"]
    ├── button.switch-tab.presentation-host-target[data-theme-host-id="leftPanel.tab"]
    └── button.switch-tab.presentation-host-target[data-theme-host-id="leftPanel.tab"]
```

关键点：

- 背景层必须是 Tabs 区域的直接子节点，便于复用通用背景层定位和 z-index 规则；
- 按钮继续保留各自的 `presentation-host-target`；
- `role="tablist"` 建议放在按钮列表内容容器上，避免表现背景节点成为可访问性树中的 Tab 列表成员；
- 背景层使用 `aria-hidden="true"` 的现有渲染约定；
- `data-tab="left:area"` 等事件委托属性继续保留在按钮上。

## 处理方案

### P0：新增 Tabs 区域宿主模型

在 `src/ui/ui-host-registry.ts` 中新增区域级宿主定义：

- `leftPanel.tabs`：父级 `leftPanel`，类型 `container`；
- `centerPanel.tabs`：父级 `centerPanel`，类型 `container`；
- 推荐同时新增 `rightPanel.tabs`，保持 `renderTabs()` 三栏同构。

层级应为 `region`，而不是 `control`。它是面板内部的独立 UI 模块，不是单个可交互按钮。

### P1：重构 `renderTabs()` 的容器结构

在 `src/ui/components/tabs.ts` 中：

1. 保留现有按钮生成逻辑以及 `*.tab` host id；
2. 将 Tabs 容器增加 `presentation-host-target`；
3. 将容器 host id 设为 `${panel}Panel.tabs`；
4. 写入默认态 `data-theme-state="default"` 和 `data-theme-text-mode`；
5. 调用 `renderPresentationHostBackground(ctx, `${panel}Panel.tabs`)`；
6. 将按钮放入 `.switch-tabs-content[role="tablist"]`。

区域容器不需要 active 状态。当前选中态属于按钮，不应因为切换 Tab 而替换整个顶部区域背景。

### P2：收敛 CSS 职责

在 `src/ui/css/chat.css` 中：

- `.switch-tabs` 只保留排列、间距和布局职责；
- 将固定 `border-bottom` 移除或改为仅用于无宿主背景时的兼容回退；
- 新增 `.switch-tabs-content` 的 flex 布局；
- 对 `.ui-cluster--left-tabs`、`.ui-cluster--center-tabs` 保持与面板宽度、溢出和圆角兼容；
- 确保区域背景不遮挡按钮，按钮内容保持在背景层上方；
- 不让 `.switch-tabs` 的区域背景影响 collection modal 等其他非面板用法。

推荐以 `presentation-host-target` 是否存在作为主题背景挂载边界，而不是用全局 `.switch-tabs` 背景硬编码覆盖所有使用场景。

### P3：为默认主题配置区域表现

在 `src/arona-clicker/content/inits.ts` 的 `initTheme()` 中配置区域宿主。推荐默认值：

- `leftPanel.tabs`：使用 `colors.surface` 的半透明实色或轻微渐变；
- `centerPanel.tabs`：使用同源 `colors.surface`，与中栏主体保持区分；
- `rightPanel.tabs`：使用同构默认值，避免右栏成为未覆盖特例；
- decoration：默认使用主色的细底线或内嵌边框；
- 不为区域宿主配置 active 状态；
- 形状沿用当前 Init 的 `colors.shape`。

若设计上希望 Tabs 背景模块只显示底部强调线，也应通过宿主 decoration 表达，而不是恢复 `.switch-tabs` 的固定 border。

### P4：主题编辑器与继承关系

新增宿主后，用户主题编辑器应自动发现并显示这些区域宿主。需要确认：

- `parent` 指向正确面板宿主；
- 宿主级别允许 `region` 挂在 `cluster` 下；
- 默认状态可以编辑背景层和 decoration；
- 未设置用户覆盖时继续继承 Init/ColorGroup 的默认主题；
- 删除区域宿主自定义表现后回退到父级或系统默认，不产生空白 Tabs；
- 区域宿主与按钮宿主的背景层刷新互不覆盖。

本任务不新增主题字段、不修改实体类型，也不涉及 Schema 生成。

## 兼容风险与处理

| 风险 | 影响 | 处理方式 |
| --- | --- | --- |
| `.switch-tabs` 仍被 collection modal、抽卡区域等复用 | 非面板区域意外出现主题背景 | 仅 `renderTabs()` 生成的面板 Tabs 接入区域宿主，或增加明确作用域类名 |
| 外层背景层使用 absolute 定位 | 背景覆盖按钮或影响点击 | 沿用 `.presentation-host-background` 的 z-index/pointer-events 规则 |
| 面板 `overflow: hidden` 与区域圆角冲突 | 背景模块边缘被裁切 | 先以内嵌模块为默认方案，再单独验收贴边视觉 |
| 删除固定横线后视觉分隔减弱 | Tabs 与正文不易区分 | 由区域 decoration 或模块底边提供主题化分隔 |
| 只新增 left/center，right 继续使用旧结构 | 共享组件出现不一致 | 推荐三栏同时注册 `*.tabs`，逐栏提供默认内容 |
| active 按钮背景与区域背景对比不足 | 当前 Tab 不明显 | 保留 `*.tab` active 状态，并在默认主题中提高主色/表面色对比 |
| 旧用户主题没有 `*.tabs` 配置 | 新宿主无背景 | 允许宿主无自定义层，回退为面板背景与 decoration，不阻断渲染 |

## 施工切片

### P0：注册与结构

- [x] 注册 `leftPanel.tabs`、`centerPanel.tabs`，并同步注册 `rightPanel.tabs`；
- [x] 修改 `renderTabs()` 生成区域宿主和 `.switch-tabs-content`；
- [x] 保留现有 `*.tab` 按钮宿主与事件属性；
- [x] 确认表现刷新逻辑能找到 Tabs 区域宿主。

### P1：样式职责收敛

- [x] 移除 Tabs 区域对固定 `border-bottom` 的依赖；
- [x] 增加区域背景层、内容层和按钮层的 z-index/布局回归；
- [x] 验证左栏、中栏和右栏不发生宽度、滚动或 padding 回归；
- [x] 验证 collection modal、Spot gacha scope 等其他 `.switch-tabs` 使用者不受影响。

### P2：默认主题与编辑器

- [x] 在 Init 默认主题中增加区域宿主表现；
- [x] 验证左、中、右栏主题切换后区域背景同步刷新；
- [x] 验证用户主题编辑器能打开并显示当前编辑权限；
- [x] 验证无 Tabs 用户覆盖时能正确回退；已将保存覆盖删除的专门端到端操作留给后续用户主题任务。

### P3：视觉验收

- [x] 左栏 Tabs 区域有独立背景模块，且与正文区分明确；
- [x] 中栏 Tabs 区域有独立背景模块，且聊天内容滚动不带走顶部模块；
- [x] active Tab 仍有独立高亮背景；
- [x] 主题形状为圆角平行四边形时，区域背景和 decoration 不出现错位；
- [x] 窄屏下按钮换行、溢出和正文滚动行为正常。

## 测试与验收

### 单元与结构测试

- `renderTabs()` 输出区域 `data-theme-host-id="leftPanel.tabs"` / `centerPanel.tabs`；
- 区域背景节点位于 Tabs 容器内；
- 按钮仍包含 `data-theme-host-id="*.tab"`、状态字段和 `data-tab`；
- `UIHostRegistry.validate()` 不报告缺失父级或层级错误；
- 无区域宿主表现配置时，渲染结果仍保留可用的按钮布局。

### CSS 契约测试

- `.switch-tabs` 不再承担主题化固定横线；
- `.switch-tabs-content` 能承载按钮排列；
- 区域背景层不影响按钮点击；
- 其他非面板 `.switch-tabs` 不被误接入区域背景规则。

### 命令验收

```text
npm test -- --run tests/ui/context.test.ts tests/ui/presentation-text-color-css.test.ts
npx tsc --noEmit
npm run build
```

浏览器验收待施工完成后执行；仅通过静态结构测试不能替代视觉验收。

## 最终预期

完成后，顶部 Tabs 的表现树应从：

```text
面板
└── switch-tabs
    └── 多个单按钮背景
```

变为：

```text
面板
├── Tabs 区域背景宿主（leftPanel.tabs / centerPanel.tabs）
│   └── 多个单按钮宿主（*.tab）
└── 正文区域
```

用户可以独立调整顶部区域的背景、装饰线、形状和透明度，同时继续调整每个 Tab 的 active/hover 表现。Tabs 与正文之间的视觉分隔将由主题系统控制，左栏和中栏不再依赖固定横线才能成立；右栏则通过同构宿主保持后续扩展能力。

## 当前核验（2026-09-09）

- 已核对 `src/ui/components/tabs.ts`、`rail.ts`、`center-panel.ts` 的实际构造链；
- 已确认 `leftPanel.tab` / `centerPanel.tab` 当前是单按钮宿主，而不是 Tabs 区域宿主；
- 已确认 `.switch-tabs` 当前通过 `border-bottom` 提供固定横线；
- 已确认 `presentation-service` 已具备可复用的背景宿主渲染能力；
- 已实施 `renderTabs()` 区域宿主、三栏 `*.tabs` 注册和 Init 默认表现；
- TypeScript 类型检查通过；
- 定向 UI 测试 68 项通过；
- `npm run build` 通过；
- `git diff --check` 通过；
- Edge 验收已完成：主题系统展示 Init、夏莱办公室、900px 两列与 600px 单列窄屏均通过；
- 已检查左栏区域/通讯录/故事、中栏聊天/日志、主题色切换、图鉴 Tabs、Spot gacha scope 与用户主题编辑器入口；
- task-0037 继续承担 panel section 结构化重构后的最终几何边界和滚动职责记录。

## 剩余工作

本目标已完成并由 task-0037 接续收敛几何边界；后续若扩展 header/toolbar/footer，应沿用 section 宿主分层，不恢复负边距横切方案。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[docs/0x-plan&work/active/roadmap-0012-flat-presentation-targets]]
- [[docs/0x-plan&work/active/roadmap-0016-cluster-region-context-overrides]]
- [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]]
