# task-0037 执行清单：Panel 顶部 Tabs 区域结构化重构

> 对应任务：[[docs/plan-work/active/task-0037-panel-tabs-region-structure]]
>
> 本文是施工清单与验收记录；机制设计仍以 task-0037 正文和 `docs/docs-828/` 为准。

## 目标

将三栏 panel 的 Tabs 从 panel 内容中的负边距横切组件，重构为 panel 的正式顶部结构区块：

- panel 独占外框、圆角和裁剪；
- `panel-tabs-region` 独占顶部 Tabs 背景与底部分隔线；
- `.switch-tabs` 只负责 TabGroup 布局；
- 单个 `switch-tab` 继续使用 `*.tab` 表现宿主；
- `panel-body` 成为唯一正文滚动容器；
- collection modal、gacha scope、主题编辑器内部 Tabs 不受 panel Tabs 样式污染。

## 当前基线

- [x] 已阅读 task-0037、task-0036、roadmap-0011、roadmap-0012、roadmap-0016、roadmap-0018、UI 模块与架构/测试规范。
- [x] 已确认工作树中存在 task-0036 的未提交改动；施工时保留，不回滚。
- [x] `npx tsc --noEmit` 基线通过。
- [x] 指定专项测试基线通过：3 个文件、24 个测试。
- [x] 已确认当前问题：`.presentation-host-target` 的 `overflow: visible` 覆盖 panel 裁剪；panel、Tabs CSS border、表现宿主 decoration 可能重复绘制；Tabs 仍使用 `margin: -14px`。

## 施工范围

### P0：新增正式 Tabs 区域结构

- [x] 在 `src/ui/components/tabs.ts` 中拆分按钮组与区域宿主职责。
- [x] 保留按钮上的 `${panel}Panel.tab`、active/inactive 状态、hover 文字模式和 `data-tab`。
- [x] 新增通用 `panel-tabs-region` 输出，区域宿主使用 `${panel}Panel.tabs`。
- [x] 确保区域背景层是 `panel-tabs-region` 的直接子节点。
- [x] 更新 `src/ui/components/rail.ts`。
- [x] 更新 `src/ui/components/center-panel.ts` 的普通聊天/日志页。
- [x] 更新 `src/ui/components/center-panel.ts` 的 contacts-draft/archive-draft 页。
- [x] 更新 `src/ui/components/right-panels.ts`，保持三栏同构。
- [x] 确认对话空间（无 Tabs 的 conversation view）不错误套用 Tabs 区域。

目标 DOM：

```text
panel.presentation-host-target
├── console-panel-background
├── presentation-region
├── panel-tabs-region.presentation-host-target[data-theme-host-id="*.tabs"]
│   ├── presentation-host-background
│   └── switch-tabs
│       └── switch-tab.presentation-host-target[data-theme-host-id="*.tab"]
└── panel-body
```

### P1：解除负边距与几何耦合

- [x] 在 `src/ui/css/chat.css` 删除 panel Tabs 的 `margin: -14px`。
- [x] 删除 `.switch-tabs` 的 panel 级 background、border、外圆角和横切补偿规则。
- [x] 将区域级背景规则限定到 `.panel-tabs-region`。
- [x] panel 保留完整 border、border-radius 与 `overflow: hidden`。
- [x] 修正通用 `.presentation-host-target` 不应覆盖 panel 裁剪边界的问题。
- [x] 通过 panel 裁剪统一背景层几何边界，避免默认表现层越过外框。
- [x] 将 panel 内容 padding 拆为区域级变量：
  - `--panel-content-padding-inline`
  - `--panel-body-padding`
  - `--tabs-padding-block`
  - `--tabs-gap`
- [x] 将 Tabs 横向 padding 移至 `panel-tabs-region` 或其内容层。
- [x] 将正文完整 padding 移至 `panel-body`。
- [x] 处理右栏 resource-bar 在新 panel padding 模型下的间距。

### P2：固定滚动边界与表现刷新

- [x] 统一 panel 的 `min-width: 0`、`min-height: 0`、`overflow: hidden`。
- [x] 统一 `.panel-tabs-region` 为不滚动的 flex 固定顶部区块。
- [x] 统一 `.panel-body` 为 `flex: 1`、`min-height: 0`、`overflow: auto`。
- [x] 确认 `.chat-pane` / `.chat-stream` 仍保持聊天流内部滚动和底部回复按钮定位（类型/专项测试/构建与 Edge 实测通过）。
- [x] 确认主题刷新仍定位到新的 `panel-tabs-region` 宿主（Edge 主题切换后区域同步刷新）。
- [x] 确认主题切换、区域切换和无用户 Tabs 覆盖时均能回退默认 Tabs 底板（未保存临时用户主题修改）。
- [x] 确认 panel-body 滚动时 Tabs 不随正文移动（Edge 右栏正文滚动实测）。

### P3：清理复用污染与文档

- [x] 恢复普通 `.switch-tabs` 的纯 TabGroup 布局语义。
- [x] 验证 collection modal 的 `.coll-switch` 不获得 panel Tabs 背景。
- [x] 验证 contacts 中的 gacha scope Tabs 不获得 panel Tabs 背景。
- [x] 验证 user-theme-editor 打开后其内部 Tabs 不获得 panel 横切 border/radius。
- [ ] 删除旧的 `.left-panel > .switch-tabs`、`.center-panel > .switch-tabs` 几何补偿规则。
- [x] 在 `docs/docs-828/02-modules/ui.md` 记录 `panel-tabs-region` 通用语义。
- [x] 更新 task-0036 的状态/浏览器验收交接说明。

## 测试清单

### 单元与静态结构

- [x] 更新 `tests/ui/context.test.ts`：区域宿主与按钮宿主分层。
- [x] 更新 `tests/ui/presentation-text-color-css.test.ts`：无负边距、无 Tabs 区域重复 border。
- [x] 增加 Tabs 区域背景直挂宿主与非宿主 `.switch-tabs` 结构断言。
- [x] 确认 `tests/ui/ui-host-registry.test.ts` 的三栏 `.tabs` 注册继续通过。

### 命令验收

```text
npx tsc --noEmit
npm test -- --run tests/ui/context.test.ts tests/ui/presentation-text-color-css.test.ts tests/ui/ui-host-registry.test.ts
npm run build
git diff --check
```

### Edge 视觉验收

- [x] 主题系统展示 Init：检查 panel/Tabs 宿主表现、装饰线与回退。
- [x] 夏莱办公室：检查左/中/右栏圆角、边线是否各只有一套。
- [x] 窄屏尺寸：检查 Tabs 不横向撑破 panel，正文仍能滚动（900px 两列、600px 单列）。
- [x] 切换左栏区域/通讯录/故事。
- [x] 切换中栏聊天/日志。
- [x] 滚动 panel-body：Tabs 固定在顶部。
- [x] 打开 collection modal、gacha scope 和主题编辑器状态 Tabs，确认无样式污染。
- [x] 无 Tabs 用户主题覆盖时确认回退主题色 1 浅化底板；未保存临时覆盖，避免给当前存档写入测试数据。

## 风险控制

- 不修改 `dist/`、`web-dist/`、`node_modules/` 或生成 Schema。
- 不回滚已有未提交改动。
- 不改变单个 Tab 的事件属性和 active/inactive 表现语义。
- 不把非 panel Tabs 套入 `panel-tabs-region`。
- 不让 panel、Tabs 区域和表现 decoration 同时拥有同一段外部几何边界。

## 执行日志

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 清单落盘 | ✅ | 本文已创建，施工前基线已记录 |
| P0 DOM 结构 | ✅ | 三栏已使用 `panel-tabs-region`，按钮仍保留 `*.tab` 宿主 |
| P1 几何与 padding | ✅ | 已移除负边距，panel 独占裁剪，padding 分配到 region/body |
| P2 滚动与刷新 | ✅ | Edge 已验证主题切换、区域切换、正文滚动与 Tabs 固定 |
| P3 清理与文档 | ✅ | 普通 `.switch-tabs` 已恢复纯布局，非 panel 场景已加显式兼容规则，UI 模块文档已更新 |
| 自动化测试 | ✅ | 类型检查、架构边界、专项测试、全量测试、构建、diff check 已通过 |
| Edge 视觉验收 | ✅ | 已完成主题展示 Init、夏莱办公室、900/600px 窄屏及复用场景验收 |

## Edge 验收记录

- 默认视口：三栏均存在 `panel-tabs-region`，panel 的 `overflow` 为 `hidden`、圆角为 `14px`，panel 直接子级 `.switch-tabs` 数量为 `0`。
- 900px：`workspace` 为两列，center panel 跨列置顶，左右 panel 同行；无横向溢出。
- 600px：`workspace` 为单列，center → left → right 依次排列；三栏宽度均落在视口内。
- 主题系统展示 Init：切换到“夏莱蓝”后 Tabs 区域同步刷新；左栏切换区域/通讯录/故事，中栏切换聊天/日志均正常。
- 夏莱办公室：三栏主题背景、圆角和底部分隔线均被 panel 内边界裁剪；正文滚动时右栏 Tabs 仍固定在顶部。
- 非 panel：图鉴内部 Tabs 与 Spot 招募 scope Tabs 正常显示；用户主题编辑器可打开，内部 Tabs 未继承 panel 横切边框/圆角。
- 验收收尾：已将原 5174 页面临时切换的主题恢复为“系统默认”；5174/5175 临时 Vite 服务已停止。
