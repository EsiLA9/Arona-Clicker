---
scope: ai-protocol
authority: project-overlay
read_when:
  - 使用 frontend-design skill 设计或重塑游戏内 UI
  - 审查 DOM 刷新、scroll / click 连续性或装饰性结构
avoid_when:
  - 独立数据包编辑器 tools/datapack-editor 的专用 UI 施工
related_modules:
  - ui
  - runtime-editor
  - presentation
---

# frontend-design 项目覆盖协议

> 本文覆盖通用 `frontend-design` skill 在 ACProgram 游戏内 UI（`src/ui/`）中的施工自由度。视觉方向仍由 brief 和 skill 决定，但不得突破项目当前的只读 UI、局部刷新和交互连续性边界。

## 1. 视觉设计与 DOM 更新分离

视觉签名优先通过既有节点、CSS token、pseudo-element、PresentationHost、主题背景层或 CSS variable 实现。新增 wrapper 必须承担真实的布局、语义、交互或可访问性职责；纯装饰 wrapper 默认不允许。

“独特设计”不等于更多 DOM。装饰线、切角、噪点、渐变、角标和氛围层，先尝试 CSS 或现有表现宿主；只有无法满足语义、布局或可访问性要求时才新增节点。

## 2. 刷新等级是硬边界

每个 UI 方案必须先声明刷新等级：

- **behavior**：只修改已有节点的文字、class、属性或 CSS variable；适用于 Tick、hover、选中、展开、进度等高频状态。
- **region**：只替换明确的 panel、chat、log、shop region 或元素组；适用于内容集合不变但输出结构变化的场景。
- **structure**：才允许重建 `#app` 或 Workspace；仅适用于集合、路由、Workspace owner、主题层级或语义节点归属发生变化。

scroll、hover、focus、普通 click 和单项选择默认只能触发 behavior 或 region，不得直接调用全量 `render()`。批量 mutation 必须在提交完成后合并成单一 UI 收敛点。

## 3. 设计计划必须包含 DOM budget

开始实现前，设计说明必须回答：

```text
DOM budget:
- 新增 wrapper / 节点数量：
- 可复用的稳定节点：
- behavior patch 范围：
- region 替换范围：
- 允许 full render 的唯一条件：

Interaction preservation:
- scroll 位置如何保留：
- focus 如何保留：
- hover / popover 如何保留或关闭：
- click 后哪些节点必须保持 identity：
```

如果无法给出稳定节点、刷新范围和降级条件，不能把该方案视为可施工设计。

## 4. 交互连续性不通过重建恢复

- scroll 只操作滚动容器自身，不通过父级 render 间接恢复位置。
- Tab / selector click 只更新目标 panel，未变化的列表和导航保持节点 identity。
- 展开 / 折叠优先切换 class、`hidden` 或属性，不重建父树。
- 事件委托优先绑定到稳定父节点，避免每次刷新重新注册整棵树。
- DOM 替换必须经过统一的 mutation range 生命周期：替换前关闭受影响范围内的 popover，替换后校验锚点连接状态；未受影响范围的 hover 不得被误伤。

## 5. 验收要求

UI 改动至少应能证明：普通 Tick 不触发 full render；scroll / click 不重建无关节点；局部替换不会残留断开锚点的 tooltip；批量提交不会为每个 mutation 重复刷新；新增结构数量和刷新次数符合设计说明。

应使用项目已有的 `data-ui-refresh-*` 诊断属性、`UIRefreshObservation`、`npm run ui:callgraph` 和对应 `tests/ui/` 回归测试；需要视觉或交互证据时补充真实浏览器验收，不以源码调用次数代替 DOM / 体验证据。

## 6. 与通用 skill 的关系

通用 skill 的 palette、typography、signature、motion 和 copy 规划仍然有效，但在本项目中必须经过本覆盖协议过滤：signature 不得以装饰性 DOM 膨胀为代价，motion 不得制造持续性刷新，结构设备必须表达真实信息关系，且每个元素只能承担一个清晰职责。
