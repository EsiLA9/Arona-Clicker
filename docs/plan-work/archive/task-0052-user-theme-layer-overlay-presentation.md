# task-0052 — 用户主题图层浮层的尺寸、拖拽与行内信息优化

状态：closing — 代码与测试已完成；Edge 视觉验收待补（当前环境无法取得浏览器状态）

> 本文承接 [[task-0051-user-theme-layer-editor-functional-recovery]]。Task0051 解决了浮层"存在但不可操作"的功能阻断；本任务处理其表现层：样式类名漂移、控件尺寸、浮层拖拽与 LayerManager 行内信息常显。
>
> 只改 UI 渲染与样式，不改状态分层、service 语义、目标引用协议或 resolver。
>
> 核查基准：2026-09-13 当前工作树（Task0051 完成后）。

## 一、目标与完成定义

1. LayerManager、LayerEditorDialog、目标选择器三类浮层整体尺寸收紧，浮层内按钮为小尺寸控件；
2. 三类浮层支持标题栏拖拽，位置只在当前会话内保持；
3. LayerManager 每行**持续显示**名称、描述、视觉标识与全部操作按钮，取消"点击才展开"的二级菜单；
4. 视觉标识按类型区分：图片用 emoji，纯色与渐变用小方块直接展示颜色；
5. 样式表与实际 DOM 类名一致，清除随重构产生的死样式；
6. 行为测试覆盖行常显、视觉标识与拖拽。

## 二、范围与非目标

### 包含

- `src/ui/css/background.css` 的 overlay / Manager / Dialog / 目标选择器样式区块重建与死样式清理；
- `src/ui/components/user-theme-layer-manager.ts` 的行结构、shell 结构与 `describeThemeLayer()` 扩展；
- 新增 `src/ui/overlay-drag.ts` 并在 controller 中接入三类浮层；
- 定向测试更新与新增。

### 不包含

- `ThemeLayerTargetRef` 协议统一（Task0050 P1-B）；
- P2 runtime/storage 统一与统一 resolver；
- `ModalManager` stack 化、overlay 挂回 Inspector；
- 拖拽位置持久化（localStorage / 存档）；
- 图层 kind、图片安全白名单、主题色派生算法、materialize 语义。

## 三、施工前事实（样式层根因）

`background.css` 的样式与 renderer 输出**大面积类名错配**，这是"控件看起来没样式/尺寸异常"的表现层根因：

| 实际 DOM 使用的类 | 施工前 CSS | 后果 |
| --- | --- | --- |
| `.theme-layer-manager-header` / `-toolbar` / `-heading` | 无 | Manager 头部与工具条吃浏览器默认样式 |
| `.theme-layer-editor-dialog-head` / `-form` / `-foot` | 无 | Dialog 骨架无布局，保存按钮主题色样式失效 |
| `.theme-layer-row-preview` / `-state` / `.theme-layer-empty` | 无 | 行内预览与空状态无排版 |
| `.theme-layer-manager-summary`、`.theme-layer-manager-dialog*`、`.theme-layer-row-main/info` | 有样式但 DOM 已不再使用 | 死样式，误导后续维护 |

第二处问题：`renderLayerRow` 与系统层行使用 `<details>/<summary>`，名称在 summary、描述与按钮在展开区，与"持续显示"要求相反；`renderLayerManagerList` 的纯字符串断言也依赖该结构。

## 四、施工切片

### P0：样式与结构

- [x] 重建 overlay 区块：Manager `min(330px, …)`、Dialog `min(340px, …)`、目标选择器 `min(300px, …)`；padding 9–10px、按钮高 22px、次要文字 9px；
- [x] 清除死样式（`theme-layer-manager-summary`、`theme-layer-manager-dialog*`、`user-theme-target-summary .theme-layer-manager`）；
- [x] `renderLayerRow`：`<details>` → `<div>`，结构为 `[视觉标识][名称 + 描述][按钮组]`，名称与按钮常显；
- [x] 按钮图标化并保留 `title` / `aria-label`：编辑 `✎`、隐藏/显示、上移 `↑`、下移 `↓`、删除 `🗑`；
- [x] 系统颜色层行同步改为常显 `[🎨][名称 + 不可删除说明 + 忽略状态][忽略/上移/下移]`；
- [x] `describeThemeLayer()` 增加 `gradient` / `image` 信息，供 `renderSwatch()` 统一生成视觉标识；
- [x] toggle 语义从 `textContent === '显示'` 改为 `data-theme-layer-next-enabled`，避免图标化后语义丢失。

### P1：拖拽

- [x] 新增 `src/ui/overlay-drag.ts`：`bindOverlayDrag(panel, handle)`，pointerdown/move/up + 视口 clamp，`transform` 与 `right/bottom` 复位为 `left/top`；
- [x] Manager 绑 `[data-theme-layer-manager-header]`，Dialog 绑 `[data-theme-layer-dialog-handle]`，目标选择器绑 `.user-theme-target-picker-head`；
- [x] 拖拽绑定对「shell 只创建一次」的浮层做一次性去重，对每次重渲染的选择器按钮复用既有去重标记；
- [x] 无布局尺寸时不做边界压缩，避免测试环境或未渲染状态下拖动被锁死。

### P2：测试

- [x] 更新 `tests/ui/user-theme-editor-layer-order.test.ts`：断言从 `<summary>` 改为 `.theme-layer-row-name`，移动按钮断言放宽为不依赖属性结尾；
- [x] 扩展 `tests/ui/user-theme-layer-editor-dialog.test.ts`：行常显（`DIV` + 无 `summary` + 5 个按钮）、纯色色块、图片 emoji 与渐变方块、拖拽后 `left/top` 与 `transform` 复位。

## 五、禁止顺手重构项

1. 不改事件 dataset 契约（`data-theme-layer-row` / `-key` / `-id` / `-edit|toggle|move|remove` / `data-theme-layer-manager-*` / `data-theme-layer-dialog-*`），它们是 controller 委托与 `reconcileList` keyed 复用的依赖；
2. 不引入拖拽位置持久化或跨会话记忆；
3. 不统一目标引用协议、不进入 P2 resolver（属 Task0050）；
4. 不新增第二套背景/代表色渲染，不改 `background-service.ts`；
5. 不把图标按钮改为无语义符号：每个按钮必须保留 `title` 与 `aria-label`。

## 六、测试与验收

| 项 | 断言 | 结果 |
| --- | --- | --- |
| 行常显 | 行为 `DIV`、无 `summary`、名称/描述常显、5 个操作按钮存在 | 已覆盖 |
| 视觉标识 | 纯色行有 `background:#hex`；图片行含 `🖼️`；渐变行含 `linear-gradient(...)` | 已覆盖 |
| 拖拽 | pointerdown/move/up 后 `left`/`top` 按偏移更新、`transform` 复位为 `none` | 已覆盖 |
| 排序契约 | 系统层位于用户层之间时移动按钮仍按完整堆栈启用 | 已覆盖（既有用例更新） |

```text
npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts tests/ui/user-theme-editor-layer-order.test.ts
npx tsc --noEmit
npm run check:architecture
npm test
npm run build
```

### Edge 验收（未执行）

> 当前环境无法取得浏览器状态，本节全部项目保持未验收。

- 三类浮层的实际尺寸、圆角、阴影与窄屏表现；
- 拖拽手感、边界 clamp、拖动后与主题弹窗的遮挡关系；
- 行内 emoji / 色块在不同主题色下的可读性；
- 图标按钮的可点击面积与 `title` 提示是否够用。

## 七、当前核验（2026-09-13）

实际执行：

- [x] `npx vitest run tests/ui/user-theme-editor-layer-order.test.ts`：3 passed；
- [x] `npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts`：10 passed；
- [x] `npx tsc --noEmit`：通过（exit 0）；
- [x] `npm run check:architecture`：通过；
- [x] `npm test`：145 个测试文件、1334 个测试全部通过（施工前 1331）；
- [x] `npm run build`：通过。

未执行：

- [ ] Edge 视觉与交互验收（见上）。

## 八、剩余工作

Edge 视觉验收，以及 Task0050 仍未完成的切片：`P0-B`（编辑会话所有权与刷新隔离）、`P0-C`（DOM/CSS 与局部刷新验收）、`P1-A` 剩余项、`P1-B` 全部、`P2-A` 剩余项、`P2-B` 全部。本任务未改变这些切片的边界。

## 九、相关路由

- [[task-0051-user-theme-layer-editor-functional-recovery]]
- [[task-0050-user-theme-layer-overlay-and-global-target-convergence]]
- [[task-0049-user-theme-background-layer-manager]]
- [[roadmap-0013-presentation-editor-ux]]
- [[roadmap-0014-theme-editor-convergence]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/plan-work/00-index]]
