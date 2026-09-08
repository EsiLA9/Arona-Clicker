# 07-audit/presentation-editor-consistency — 主题表现编辑器一致性审查

> 本文回答：主题表现编辑器、运行时背景解析和 hover/active 状态之间为什么会出现视觉不一致，以及修复后应遵守什么契约。

## 问题总览

| 问题 | 原因 | 期望效果 | 建议 |
| --- | --- | --- | --- |
| active 图层在编辑器中不可见或与实际不一致 | 运行时把默认图层与 active 覆盖按 ID 合并；编辑器只读取当前状态数组 | 编辑器展示的有效图层应与运行时完全一致，同时区分“继承”与“状态覆盖” | 编辑器构造 effective layer list；继承层只读，状态层可编辑，排序和系统层序位按实际解析结果展示 |
| 父级 active 状态回退不稳定 | 背景解析已经向父级回退，但 active fallback 判定仍依据最初请求的子宿主 | 子宿主未覆盖时，应完整继承父级 active 表现；只有整条回退链都没有覆盖时才使用默认主题色 | 在同一条解析链上同时确定 effective host、effective state 和 fallback，不再混用 requested host 与 effective host |
| 区域面板形状不生效 | 控件使用 `.presentation-host-background`，区域面板使用 `.console-panel-background`；形状 CSS 只匹配前者 | 所有表现宿主，无论控件还是区域，都使用同一套形状、裁切、图层和刷新语义 | 统一背景节点契约，或让形状选择器同时覆盖两种节点；优先收敛到统一渲染入口 |
| hover 与 active 产生不同背景 | workspace 通用 hover 规则直接给 `switch-tab`、`mini-action` 等宿主写入背景色，绕过用户图层 | hover 和 active 都保留用户自定义背景，只允许状态表现改变边框、文字或阴影等非背景属性 | 所有 `presentation-host-target` 排除通用背景 hover 规则；背景只由背景服务和用户主题数据提供 |

## 约束

- 背景不得在通用 CSS 中内置图片、渐变或状态底色；CSS 只负责承载背景节点、形状变换和内容层级。
- active/inactive/disabled 的状态解析必须复用同一套父级回退和图层合并规则。
- `shape` 是宿主表现属性，默认 `rounded-rectangle`；`rounded-parallelogram` 使用低幅度 `transform: skewX(...)`，内容层反向倾斜以保持文字正常。
- 编辑器中的“系统颜色层”必须与运行时插入、忽略和排序后的结果一致。

## 验收口径

1. 默认态添加图层后切换 active，active 仍显示默认图层；active 新增同 ID 图层时只替换对应默认层。
2. 子宿主无状态覆盖、父宿主有状态覆盖时，子宿主显示父宿主覆盖；整条链无覆盖时才使用状态回退色。
3. 控件和区域面板配置相同形状时，均有圆角和平行四边形倾斜效果。
4. hover 与点击保持 active 时，不再出现一个有背景、另一个丢背景的情况。
5. 相关单元测试、类型检查通过。

## 关联实现

- `src/ui/context.ts`：宿主、状态、父级回退和图层合并。
- `src/ui/components/user-theme-editor.ts`：编辑器有效图层与状态视图。
- `src/ui/presentation-service.ts`：统一表现宿主背景渲染。
- `src/ui/background-service.ts`：背景层解析与 DOM 节点输出。
- `src/ui/css/background.css`、`src/ui/css/layout.css`：形状与状态承载样式。

## 当前核验（2026-09-07）

最新 UI 实现已将 `UIContext`、`PresentationView`、`background-service.ts` 与 `ui-host-registry.ts` 收敛到同一套宿主、状态继承、形状和装饰线契约；编辑器与运行时的系统层、父级回退和 active 合并规则已有专项测试覆盖。选择页的 Init / GlobalEnh 动态主题属于局部只读投影：它在 `.selector-super-background` 的整页背景双缓冲和条目样式中消费主题，不把轮盘聚焦写回运行时场景栈，因此不改变游戏状态或主界面主题。

本审查后续只保留两类验收：编辑器专用的背景层可视化预览，以及不同窗口尺寸下的浏览器视觉回归。具体选择页动态主题由 [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] 跟踪。
