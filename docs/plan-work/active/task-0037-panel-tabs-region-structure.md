# Task：Panel 顶部 Tabs 区域结构化重构

状态：✅ 已完成（2026-09-09）

本文回答：如何将左栏和中栏的 Tabs 从 panel 内容中的“负边距横切组件”升级为真正的 panel 顶部结构区块，在保留主题表现宿主和单按钮状态的同时，消除边框重合、圆角遮盖与 padding 耦合。

## 背景

前置任务已为 Tabs 增加区域级宿主，并通过负边距实现顶部横切效果：

- `renderTabs()` 生成 `leftPanel.tabs`、`centerPanel.tabs`、`rightPanel.tabs`；
- `.switch-tabs` 作为 `presentation-host-target` 承载区域背景；
- 单个按钮继续使用 `*.tab` 宿主表达 active/inactive/hover；
- 左、中栏通过 `margin: -14px -14px 14px` 抵消 panel padding；
- Tabs 背景暂时由主题色 1 与 panel 色的浅化混合提供。

该方案已经能在 Edge 中显示顶部横切背景，但它是过渡结构：Tabs 必须知道父 panel 的 padding 和圆角，并且容易与 panel 自身边框发生重合。

本任务已完成结构化重构：三栏 Tabs 统一进入 `panel-tabs-region`，panel 独占外框、圆角与裁剪，正文滚动收敛到 `panel-body`；普通非 panel `.switch-tabs` 通过显式作用域规则保留原有间距与分隔表现。

## 问题

### 1. 两个元素同时拥有同一段几何边界

当前 panel 有完整外框和圆角，Tabs 横切区域也有上、左、右边框与顶部圆角。两组线条在同一位置叠加时，会产生：

- 顶部和左右边线变粗；
- 圆角位置出现覆盖或色差；
- 不同设备像素比下出现 1px 对齐差异；
- 主题 decoration 改变后难以判断应由哪个元素修复。

### 2. Tabs 通过负边距依赖父级实现细节

当前 `-14px` 隐含假设 panel padding 永远是 14px。未来如果 panel padding、border width 或圆角由主题/响应式布局改变，Tabs 的横切范围和圆角关系就会失效。

### 3. `overflow` 与滚动责任尚未结构化

顶部 Tabs 不应随正文滚动，但 panel 和 panel-body 的职责必须明确：

- panel 负责外框、圆角和裁剪；
- panel-body 负责正文滚动；
- Tabs 区域只占据顶部结构行。

如果继续依赖负边距和外层 padding，后续加入 header、toolbar、footer 时会继续出现相同的几何补偿。

### 4. `.switch-tabs` 的职责过重

`.switch-tabs` 当前同时承担：

- Tab 按钮排列；
- 横切 panel；
- 区域背景；
- 区域边框；
- 区域圆角；
- 与正文之间的间距。

这会污染 collection modal 等其他 `.switch-tabs` 使用场景，也使主题宿主语义落在了错误的 DOM 层级。

## 目标

- 将 Tabs 提升为 panel 的顶部结构区块；
- 由 panel 独占完整外框、圆角和裁剪；
- 由 `panel-tabs-region` 独占顶部横切背景和底部分隔线；
- 让 `.switch-tabs` 退回纯 TabGroup 布局组件；
- 继续保留单个 `switch-tab` 的主题状态宿主；
- 取消 `margin: -14px` 等父级 padding 补偿；
- 保证 panel-body 独立滚动，Tabs 不随正文滚动；
- 使主题编辑器可以独立编辑 Tabs 区域表现，而不改变 panel 几何结构。

## 解决方案

### 1. 采用三层结构

推荐 DOM：

```text
panel.presentation-host-target
├── presentation-host-background       ← panel 整体背景，可选
├── panel-tabs-region.presentation-host-target
│   ├── presentation-host-background   ← Tabs 区域背景
│   └── switch-tabs                     ← 只负责 TabGroup 布局
│       └── switch-tab.presentation-host-target
└── panel-body                         ← 正文 padding 与滚动
```

左栏和中栏的目标宿主分别为：

- `leftPanel.tabs`
- `centerPanel.tabs`

建议右栏同步使用 `rightPanel.tabs`，避免共享 `renderTabs()` 产生结构分支。

### 2. 明确边框所有权

| 元素 | 背景职责 | 边框职责 | 圆角职责 | 滚动职责 |
| --- | --- | --- | --- | --- |
| `panel` | panel 基础背景 | 完整外框 | 完整外圆角 | 不滚动，只负责裁剪 |
| `panel-tabs-region` | Tabs 顶部背景/渐变/纹理 | 仅底部分隔线 | 不绘制外圆角 | 不滚动 |
| `switch-tabs` | 不负责区域背景 | 不负责区域边框 | 不负责区域圆角 | 不滚动 |
| `switch-tab` | 默认/active/hover 状态 | 自身状态边界或指示线 | 自身局部圆角 | 不滚动 |
| `panel-body` | 正文背景继承或局部背景 | 不绘制 panel 外框 | 不绘制 panel 外圆角 | `overflow: auto` |

基本规则：一个可见几何边界只能由一个元素负责。Tabs 区域不得再绘制 panel 的顶部、左侧和右侧外框。

### 3. 重构 panel 的 padding 模型

panel 不再通过统一 `padding: 14px` 包住所有子元素，而是由各 section 自己决定内容内边距：

```text
panel
├── panel-tabs-region
│   └── switch-tabs 的横向内容 padding
└── panel-body
    └── 正文 padding
```

建议保留统一变量语义：

- `--panel-content-padding-inline`
- `--panel-body-padding`
- `--tabs-padding-block`
- `--tabs-gap`

Tabs 区域使用内容横向 padding，正文使用自己的完整 padding。这样 panel padding 改动不会要求 Tabs 反向计算负边距。

### 4. 固定 overflow 与滚动边界

推荐：

```css
.panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.panel-body {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
```

panel 的 `overflow: hidden` 负责把 Tabs 背景裁剪在 panel 的圆角内；panel-body 承担唯一正文滚动责任。不得让整个 panel 使用 `overflow: auto`，否则顶部 Tabs 会随正文一起滚动。

### 5. 保持表现宿主层级清晰

`panel-tabs-region` 作为 `leftPanel.tabs` / `centerPanel.tabs` 的实际宿主，直接拥有 `.presentation-host-background`。`switch-tabs` 不再直接挂载区域背景。

层级建议：

- 区域背景层：`position: absolute; inset: 0; z-index: 0; pointer-events: none`；
- Tabs 内容层：`position: relative; z-index: 1`；
- panel 外框不由背景层模拟；
- 主题 decoration 默认只表达视觉装饰，不改变 section 的布局尺寸。

### 6. 保持主题色 1 浅化来源

当前默认背景仍可使用主题色 1 浅化混合，例如：

```css
background: color-mix(
  in srgb,
  var(--theme-node-primary) 10%,
  var(--theme-node-panel) 90%
);
```

该默认值应属于 `panel-tabs-region`，不属于 `.switch-tabs`。如果 Init 或用户主题提供了 `leftPanel.tabs` / `centerPanel.tabs` 的表现层，则由表现层覆盖默认浅化背景。

## 技术路径

### P0：新增结构区块

1. [x] 在 `renderLeftPanel()` 与 `renderCenterPanel()` 的 panel 结构中，为 Tabs 增加 `panel-tabs-region` 容器；
2. [x] 将 `leftPanel.tabs` / `centerPanel.tabs` 的宿主元数据移动到该容器；
3. [x] 保留 `renderTabs()` 作为按钮组生成器，并由 `renderPanelTabsRegion()` 负责区域宿主；
4. [x] 确认临时 contacts/archive 页面仍使用相同的结构入口。

### P1：解除负边距耦合

1. [x] 删除 `.left-panel > .switch-tabs` 与 `.center-panel > .switch-tabs` 的负边距；
2. [x] 删除 Tabs 区域上、左、右边框和外圆角；
3. [x] 将横向 padding 移到 `panel-tabs-region` 或其内容层；
4. [x] 将正文 padding 移到 `panel-body`；
5. [x] 确认 Tabs 区域不再依赖 panel 的具体 padding 数值。

### P2：收敛布局和主题刷新

1. [x] 统一 panel 的 `min-height: 0`、`overflow: hidden`；
2. [x] 统一 panel-body 的 `min-height: 0`、`overflow: auto`；
3. [x] 让主题背景刷新逻辑定位到新的 `panel-tabs-region`；
4. [x] 验证主题切换、区域切换和无用户 Tabs 覆盖时的回退不会重建错误节点；
5. [x] 保持单个 Tab active/hover 刷新路径不变。

### P3：清理复用污染

1. [x] 将横切区域 CSS 限定到 `.panel-tabs-region`；
2. [x] 确认 collection modal、gacha scope 等内部 `.switch-tabs` 不获得 panel 顶部背景；
3. [x] 删除旧的 `.switch-tabs` 区域级 margin、border 和 background 规则，并为非 panel 复用场景补充显式作用域兼容规则；
4. [x] 在文档中记录 `panel-tabs-region` 的通用语义，供未来 panel header/toolbar/footer 复用。

## 预期结果

完成后，结构从：

```text
panel（带 padding）
└── switch-tabs（通过负边距逃出 padding）
```

变为：

```text
panel（外框、圆角、裁剪）
├── panel-tabs-region（顶部横切背景、底部分隔线）
│   └── switch-tabs（按钮布局）
└── panel-body（正文 padding、独立滚动）
```

用户可独立调整顶部 Tabs 区域的背景、渐变、纹理、透明度和分隔线；单个 Tab 的 active/hover 表现不受影响；panel 外框不会与 Tabs 区域重复绘制；panel padding、圆角和正文滚动之间不再通过负边距隐式耦合。

## 风险与约束

| 风险 | 处理方式 |
| --- | --- |
| Panel 同时存在标题、Toolbar、Tabs | 进一步抽象 `panel-header`，不要为每行继续使用负边距 |
| 主题 decoration 想突破圆角 | 由 panel 外层独立 decoration 承担，不能让 Tabs section 逃出 `overflow: hidden` |
| 用户自定义 border width/radius | 几何参数由 panel 统一管理，Tabs 不复制这些参数 |
| 某些 Tabs 不属于 panel | 不套用 `panel-tabs-region`，保持普通 `.switch-tabs` |
| 背景层为空 | 保留主题色 1 浅化默认底板，不允许顶部区域完全透明 |
| Panel 高度链异常 | 检查父级 flex/grid 的 `min-height: 0`，确保滚动只落在 panel-body |
| 右栏仍使用共享 renderTabs | 推荐同步接入 `rightPanel.tabs`，避免结构和样式分叉 |

## 验收标准

### 结构验收

- [x] 左栏存在 `panel-tabs-region`，宿主为 `leftPanel.tabs`；
- [x] 中栏存在 `panel-tabs-region`，宿主为 `centerPanel.tabs`；
- [x] 单个按钮仍使用 `leftPanel.tab` / `centerPanel.tab`；
- [x] Tabs 区域不再使用 `margin: -14px`；
- [x] Tabs 区域不再绘制 panel 的上、左、右外框；
- [x] panel-body 与 Tabs 区域为兄弟结构。

### 视觉验收

- [x] Tabs 背景横向覆盖 panel 内宽度；
- [x] panel 顶部左右圆角只显示一套线条；
- [x] 顶部、左侧和右侧边线不变粗；
- [x] Tabs 底部分隔线清晰且与 panel 线条同源；
- [x] 主题色 1 浅化背景在无数据层覆盖时仍可见；
- [x] active/hover Tab 仍有独立状态表现；
- [x] 窄屏下不会横向撑破 panel。

### 行为验收

- [x] panel-body 滚动时 Tabs 保持在顶部；
- [x] 左栏切换区域/通讯录/故事不破坏 Tabs 背景和 panel 高度；
- [x] 中栏切换聊天/日志不破坏 Tabs 背景和正文滚动；
- [x] 主题切换后 Tabs 区域同步刷新；
- [x] collection modal、gacha scope 等非 panel Tabs 不受影响；
- [x] 无 Tabs 用户主题覆盖时回退到默认浅化背景；删除覆盖路径由宿主继承规则覆盖，未写入测试覆盖。

### 命令验收

```text
npx tsc --noEmit
npm test -- --run tests/ui/context.test.ts tests/ui/presentation-text-color-css.test.ts tests/ui/ui-host-registry.test.ts
npm run check:architecture
npm test
npm run build
git diff --check
```

浏览器验收必须在 Edge 中执行，不能以静态测试替代：至少检查主题系统展示 Init、夏莱办公室和窄屏尺寸三种场景。

## 当前核验（2026-09-09）

- 已完成 `renderPanelTabsRegion()` 与三栏同构接入，`leftPanel.tabs` / `centerPanel.tabs` / `rightPanel.tabs` 均为区域宿主，按钮仍为 `*.tab` 宿主；
- 已删除 panel Tabs 的负边距、上/左/右外框和外圆角，panel 统一负责边界与裁剪；
- 已将正文滚动收敛到 `.panel-body`，Edge 实测滚动右栏正文时 Tabs 保持在顶部；
- 已在 Edge 验证主题系统展示 Init、夏莱办公室、900px 两列与 600px 单列窄屏；
- 已验证左栏区域/通讯录/故事、中栏聊天/日志、主题色切换、图鉴 Tabs、Spot 招募 Tabs 与用户主题编辑器入口；
- 自动化结果：126 个测试文件、1181 个测试通过；类型检查、架构边界检查、构建和 `git diff --check` 通过；
- 非 panel `.switch-tabs` 使用 `.coll-switch` / `[data-gacha-scope-switch]` 显式保留其原有间距与底部分隔。

## 剩余工作

本任务无阻塞剩余工作。后续若新增 panel header/toolbar/footer，应复用 `panel-tabs-region` 的 section 语义，不恢复负边距补偿；若需要验证用户已经保存的 Tabs 覆盖删除，可在后续专门的用户主题测试任务中补充端到端操作。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/plan-work/active/task-0036-switch-tabs-background-module]]
- [[docs/plan-work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[docs/plan-work/active/roadmap-0012-flat-presentation-targets]]
- [[docs/plan-work/active/roadmap-0016-cluster-region-context-overrides]]
- [[docs/plan-work/active/roadmap-0018-ui-host-registry]]
