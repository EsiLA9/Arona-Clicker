# newPlan/15 — 用户自定主题背景图层管理器改造指导

> 本文回答：如何把用户自定主题编辑器中“目标内展开图层并直接编辑”的模式，收束为“目标总按钮 → 单目标图层管理器 → 单层编辑弹窗”，以及实现前必须遵守的当前代码边界。本文已转为 [[docs/plan-work/active/task-0049-user-theme-background-layer-manager]]，保留为方案来源记录，不替代 `src/`、`docs/docs-828/` 或既有 Roadmap 的事实源。

状态：✅ 已转为 [[docs/plan-work/active/task-0049-user-theme-background-layer-manager]]

核查基准：2026-09-13 当前工作树。设计输入为用户本轮需求与 Sol 的设计意见；若本文与源码不一致，以源码为准。

## 一、目标与边界

### 目标

将 `user-theme-inspector` 中的图层详细表单移出默认路径：

```text
User Theme Inspector
  目标摘要 + 图层总按钮
        ↓
Layer Manager
  单一 active target 的图层集合管理
        ↓
Layer Editor Dialog
  单层详细字段的 draft 编辑
```

最终交互必须满足：

- Inspector 对每个可编辑表现目标提供一个“管理图层”总按钮，不再默认展开具体图层字段；
- 页面同时最多存在一个 Layer Manager；
- Manager 同时只服务一个目标；点击其他目标的总按钮时，Manager 原地切换目标并刷新标题、状态和图层列表；
- Manager 只显示简单预览：颜色/视觉标识、图层类型、名称或稳定 ID，以及隐藏、排序、删除、编辑操作；
- 详细字段只在 Layer Editor Dialog 中编辑；
- 取消不产生正式主题修改；保存通过现有用户主题编辑会话提交；
- 一次图层操作只刷新主题预览、Manager 列表和对应 Inspector 摘要，不重建整个三栏 Workspace。

### 非目标

- 本草案不引入 `ThemeDef.parent`、Cluster detach 或新的 `ThemeApplication` 存储模型；
- 不把图层管理器改造成完整实时渲染画布；
- 不允许任意 CSS 属性、任意 CSS Selector、未经登记的图片 URL；
- 不在 UI 事件中直接写 `PlayerState`、直接改 CSS 作为正式主题状态；
- 不编写旧存档迁移兼容层；
- 不让一次 Manager 操作绕过 `UserThemeService.apply()` 与 `StateMutationService` 的现有保存边界。

## 二、源码核查后的当前事实

| 主题 | 当前事实 | 对本改造的影响 |
| --- | --- | --- |
| 编辑会话 | `UserThemeService.beginEdit()` 创建一个 `UserThemeEditSession`，保存时由 `apply()` 一次性校验并提交；编辑期间由 `ColorSystem.setUserThemePreview()` 预览 | Manager 和 Dialog 应编辑同一个会话 draft；“即时操作”只代表即时更新 preview，不代表立即写存档 |
| Inspector | `src/ui/components/user-theme-editor.ts` 当前在 `user-theme-inspector` 内渲染目标卡片和嵌套图层字段；`renderHostTargets()` 同时承载目标、状态、几何、装饰线和图层表单 | 改造是信息架构拆分与事件迁移，不是另起一套表现字段协议 |
| 全局背景 | 用户图层在 `draft.background`，顺序在 `draft.backgroundLayerOrder`；系统颜色层用固定 ID `system-color-background`，忽略开关是 `systemColorLayerIgnored` | 全局 Manager 要把系统层作为特殊只读行显示：可忽略/排序，不可删除；不要复制系统派生颜色 |
| 宿主背景 | 用户宿主图层在 `draft.presentation.hosts[].layers`，顺序在 `layerOrder`；状态图层在 `host.states[state].layers` 与 `layerOrder` | 目标引用必须区分 `global`、宿主 ID 和宿主状态，不能只保存数组索引 |
| 兼容字段 | `normalizePresentationDraft()` 会把旧 `presentation.layers/panels` 收束到 `presentation.hosts`；保存后用户主题不应继续生成旧字段 | 新 Manager 只写 `background` 与 `presentation.hosts`；旧字段仅作为读取/收束兼容路径 |
| 图层类型 | `BackgroundLayerDef.kind` 当前为 `empty / solid / gradient / image`，内容主要在 `value` 字符串中；渐变编辑器当前是两个色标和角度，保存为受控 `linear-gradient` | Dialog 应复用现有字段解析和安全约束；不能直接开放任意 CSS 字符串 |
| ID | `BackgroundLayerDef.id` 仍是可选；当前新增全局图层和宿主图层会生成 ID，但现有 Datapack/旧用户数据可能有匿名层 | Manager 管理的用户 draft 必须在进入管理器前完成稳定 ID 归一化；移动、编辑、删除都按 `target + state + layerId` 定位 |
| 隐藏 | 当前没有通用的图层隐藏字段；`empty` 是无视觉内容，`opacity: 0` 不是隐藏语义；系统层另有全局忽略开关 | 若要实现用户要求的隐藏，需新增明确字段并同步类型、Schema、校验、运行时 View、渲染与测试；不能用 `empty` 或透明度伪装 |
| 预览 | 当前输入事件直接改 session draft，随后刷新 preview；全局部分还会把 runtime background 克隆进 draft | 新设计必须取消“打开即克隆已解析背景”的副作用；只读查看 resolved layers，第一次真正修改时才 materialize 到用户 draft |
| 弹窗 | `ModalManager` 是单槽 body 级弹窗，重复 `open()` 会替换内容；当前用户主题编辑器已占用该槽 | Layer Editor 不能直接调用 `ctrl.modal.open()` 替换父级主题弹窗；首选在主题弹窗内挂载内部 dialog/overlay，或先扩展明确的 modal stack 协议 |
| 刷新 | `controller-modals.ts` 的当前图层事件大量调用 `refreshUserThemeEditor()`、`ctrl.refreshTheme()`，部分路径会重建整个编辑器或调用 `ctrl.render()` | 新 Manager 需要拥有独立 shell 和列表刷新入口；普通字段更新不得触发全局 `ctrl.render()` |

相关实现与测试：

- `src/ui/components/user-theme-editor.ts`
- `src/ui/controller-modals.ts`
- `src/arona-clicker/services/user-theme-service.ts`
- `src/arona-clicker/types/user-theme.ts`
- `src/engine/types/theme.ts`
- `src/ui/background-service.ts`
- `src/ui/presentation-service.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/presentation-targets.ts`
- `tests/ui/user-theme-editor-layer-order.test.ts`
- `tests/ui/user-theme-editor-decoration.test.ts`
- `tests/ui/user-theme-editor-overview.test.ts`
- `tests/engine/user-theme-service.test.ts`
- `tests/ui/presentation-service.test.ts`

## 三、方案裁定

### 3.1 Inspector 只负责目标选择和摘要

每个目标卡片只保留：

```text
目标名称 / 级别
当前有效图层数
来源：继承、用户覆盖或系统表现
[管理图层]
```

Inspector 不再直接渲染以下字段：类型、颜色/渐变/图片值、透明度、定位、尺寸、重复、附着、缩放、旋转、混合模式。

“管理图层”按钮携带稳定目标引用，不携带图层对象和数组索引。点击后调用概念上的：

```ts
openLayerManager(targetRef)
```

目标注册继续使用 `getPresentationTargets()` / `UI_HOST_REGISTRY`；不要在编辑器里再维护一套目标字符串表。

### 3.2 Manager 是单例、单目标、可切换的工具

Manager 状态属于编辑器临时 UI 状态，不写入 `UserThemeDraft`、`StoredCustomTheme` 或 `PlayerState`：

```ts
interface ThemeLayerTargetRef {
  kind: 'global' | 'host';
  hostId?: string;
  state?: 'default' | 'active' | 'inactive' | 'disabled';
}

interface LayerManagerUIState {
  open: boolean;
  activeTarget: ThemeLayerTargetRef | null;
}
```

`state` 是宿主目标的一部分。若目标不支持状态，使用 `default`；若支持状态，Manager 顶部提供状态切换，避免把 `header.button` 的默认层与激活层混为一组。

切换目标的语义是：

```text
activeTarget = nextTarget
resolve current session draft
refresh manager header/list
```

不是关闭旧 Manager 再创建第二个 Manager，也不是缓存旧的 `layers` 数组引用。

Manager 每行只显示：

```text
颜色或类型视觉标识 · 名称/ID
类型 · 简短摘要（如 #6eb5e8、2 色标、图片资源 ID）
[上移] [下移] [隐藏/显示] [编辑] [删除]
```

建议集中提供纯函数 `describeThemeLayer(layer, context)`，由 Manager 消费统一的 `typeLabel`、`summary`、`preview` 和 `isHidden`，避免列表组件散落 `kind` 分支。

Manager 不负责：

- 解析 CSS 或图片 URL；
- 直接改 DOM 的 `style.background`；
- 编辑详细字段；
- 管理其他目标的图层。

### 3.3 Dialog 是单层 draft 编辑器

点击一行的“编辑”后打开内部 Layer Editor Dialog：

```ts
interface LayerEditorUIState {
  open: boolean;
  target: ThemeLayerTargetRef | null;
  layerId: string | null;
  mode: 'create' | 'edit' | null;
  draft: BackgroundLayerDef | null;
  dirty: boolean;
}
```

打开时对单层做 `structuredClone()`；Dialog 内所有输入只改这个副本。保存流程为：

```text
draft
  → 类型/资源/数值校验
  → 按 target + state + layerId 写回 session draft
  → setUserThemePreview(session draft)
  → 仅刷新 Manager 行和对应目标预览
  → 关闭 Dialog
```

取消只丢弃 Dialog draft，不改 session draft。

当前 `ModalManager` 不能直接承载嵌套弹窗，因为 `open()` 会替换父级用户主题弹窗并触发其关闭清理。首版应在现有 `.user-theme-modal` 内实现带 `role="dialog"` 的内部 overlay，并保留父级会话；如果未来需要真正多层 body 弹窗，必须先为 `ModalManager` 增加 stack、焦点回收和关闭顺序测试。

### 3.4 Manager 操作与保存边界

Manager 的操作应通过只处理 draft 的集中操作模块，概念接口如下：

```ts
getTargetLayers(draft, targetRef)
addTargetLayer(draft, targetRef, layer)
updateTargetLayer(draft, targetRef, layerId, next)
removeTargetLayer(draft, targetRef, layerId)
moveTargetLayer(draft, targetRef, layerId, direction)
setTargetLayerEnabled(draft, targetRef, layerId, enabled)
```

这组函数首版可以是纯函数或只修改 session draft 的编辑器服务，不应直接成为 PlayerState 写入口。正式落账仍由：

```text
UserThemeService.apply()
  → StateMutationService.setUserTheme()
  → userThemeChanged
  → ColorSystem / UI controller
```

“即时隐藏/排序/删除”表示即时反映到当前 preview；点击主题弹窗的“保存并应用”才产生一次正式 mutation。删除可以在 Manager 内提供轻量确认；复杂 Undo 不属于本阶段。

### 3.5 继承与 materialize：按当前运行时模型解释

Sol 意见中的“不要在打开 Manager 时 materialize”方向正确，但当前项目没有已落地的通用 `ThemeDef.parent`。因此这里的“继承”只指：当前运行时主题层、父级 Host 回退以及用户主题覆盖的解析结果，不得写成已存在的 Parent Theme 机制。

规则如下：

- 仅打开目标总按钮或 Manager：读取当前 `runtimeTheme()` / `presentationView()` 的 resolved 结果，只读展示，不改 session draft，不产生 dirty；
- 第一次新增、删除、排序、隐藏或保存编辑时，若目标当前只有基底/父级结果，则将该目标需要继续保留的 resolved layers 克隆为用户目标覆盖，再执行本次操作；
- Manager 不得把整个主题或整个 Workspace 的解析结果复制进用户主题；只 materialize 当前目标、当前状态；
- 用户主题 draft 已有本地目标时，只在该目标的本地数组上操作；
- 删除用户目标配置应删除本地覆盖，让运行时回退到父级/系统表现，而不是把父级图层复制回来；
- 如果当前解析链无法区分“无本地配置”和“空的本地配置”，先补只读来源/覆盖状态，再施工 materialize，不要靠数组是否为空猜测继承。

特别注意：当前 `openUserThemeEditor()` 在缺少 `draft.background` 时会把 runtime global background 克隆进 draft。该行为与本方案的“查看不改变继承”要求冲突，必须在 Manager 改造前移除或改为只读 resolved view；对应回归测试要覆盖“打开后取消”和“打开后直接保存但未编辑”两种情况。

### 3.6 隐藏必须有正式数据语义

当前没有通用的隐藏字段。建议在 `BackgroundLayerDef` 增加：

```ts
enabled?: boolean // 缺省为 true
```

并统一规定：

- `enabled: false` 保留图层全部字段、ID 和排序位置，但不进入运行时绘制和代表色合成；
- Manager 仍展示隐藏行，并降低视觉强调；
- `empty` 继续表示没有内容，不代替隐藏；
- `opacity: 0` 仍表示透明度为零，不代替隐藏；
- 系统颜色层继续使用 `systemColorLayerIgnored`，不能被用户图层字段覆盖；
- 该字段属于引擎类型，修改后必须执行 `npm run gen:schema`，并更新 `UserThemeService` 校验、`background-service`、`presentation-service`、背景合成色服务和测试。

如果评审决定不扩展 `BackgroundLayerDef`，本阶段必须明确把“隐藏”降级为未实现，不能偷偷改成透明度或 `empty`。

### 3.7 稳定 ID 与排序语义

数据层统一按底到顶保存；管理器按视觉上的顶到底展示：

```text
存储顺序：bottom → top
Manager 展示：top → bottom
上移：提高视觉层级，等价于存储顺序后移
下移：降低视觉层级，等价于存储顺序前移
```

全局背景使用 `backgroundLayerOrder`；宿主默认态使用 `host.layerOrder`；宿主状态使用 `host.states[state].layerOrder`。Manager 的移动操作必须更新对应的 order 列表，而不是交换渲染后的临时数组。

进入用户主题编辑会话时，为所有将由用户 Manager 管理的匿名层补稳定 ID；ID 归一化应保证：

- 同一目标、同一状态内唯一；
- 不依赖当前视觉排序位置作为长期身份；
- 删除、移动、Dialog 保存和局部刷新均按 ID 定位；
- ID 改名时要同步更新对应 order 列表；
- 不能与 `system-color-background` 冲突。

## 四、建议的文件级施工路线

### P0：先补契约与事实测试

- 将全局目标与宿主/宿主状态目标统一为 `ThemeLayerTargetRef` 的内部表示；
- 抽出按目标读取 layers/order 的纯函数；
- 补匿名层 ID 归一化和重复 ID 校验；
- 决定并实现 `enabled` 字段，或在评审记录中明确暂不支持隐藏；
- 修正全局 runtime background 在编辑器打开时被克隆进 draft 的问题；
- 补“查看不 materialize、取消不修改、无编辑保存不复制基底”的测试。

### P1：建立 Manager 壳和目标总按钮

- Inspector 目标卡片改为摘要 + “管理图层”；
- 建立页面级唯一 Manager shell；
- Manager 切换目标不关闭、不创建第二实例；
- 目标不存在或主题切换后无可用目标时显示空状态，不引用旧 layer object；
- 先实现列表、上下移动、隐藏/显示、删除确认和编辑按钮；
- 保留现有 UserTheme modal/session，不改变正式保存入口。

### P2：迁移单层 Dialog

- 将 `renderBackgroundLayers()` 和 `renderHostTargets()` 中的详细字段 renderer 拆为共享的 Dialog 字段 renderer；
- 纯色使用 `input[type=color]`；渐变使用现有双色/角度受控编辑；图片只选择已登记 Pic ID；
- 按 `kind` 只显示相关字段；类型切换走集中 `normalizeLayerForKind()`，不在事件处理器里散落删除字段；
- Dialog Save/Cancel 与焦点回收、脏状态提示、键盘 Escape 语义固定；
- 不调用会替换父级主题弹窗的 `ctrl.modal.open()`。

### P3：局部刷新与清理

- `renderUserThemeEditor()` 只负责 Inspector 壳和摘要；
- 增加 `renderLayerManagerShell()`、`renderLayerManagerList()`、`renderLayerRow()`、`renderLayerEditorDialog()` 等职责清晰的渲染入口；
- Manager 切换目标只更新 header/list；单行隐藏只更新该行；排序只更新列表；Dialog 字段变化只更新内部预览和当前目标表现；
- 清理旧的内联图层字段事件绑定、重复的 legacy renderer 和基于 index 的定位；
- 保留必要的 `refreshTheme()`，但禁止以全局 `ctrl.render()` 作为默认图层输入响应。

### P4：验收与后续裁定

- 在当前 Edge 游戏页面验证全局背景、面板、按钮、Tab 和状态图层；
- 若发现“resolved layers → local override”仍无法表达真实来源，再另立 ADR 讨论 Parent/Cluster 继承，不在本任务中隐式扩展；
- 将评审通过后的实现切片转为 `docs/plan-work/active/task-*.md` 或独立 ADR，并更新 `docs/plan-work/00-index.md` 状态。

## 五、测试与验收口径

### 行为测试

- Inspector 的每个可配置目标显示总按钮，且不直接显示详细图层字段；
- 任意时刻只有一个 Manager；点击另一个目标后 Manager 原地切换；
- Manager 只列出当前目标的图层，不串出其他目标或其他状态；
- 全局系统颜色层不可删除，可按现有语义忽略/排序；
- 用户图层支持新增、编辑、上移、下移、隐藏/显示、删除；
- 稳定 ID 不因排序改变，删除和编辑不会误命中相邻图层；
- 隐藏图层仍存在于 draft/保存数据，但不参与绘制和代表色合成；
- Dialog Cancel 不改 session draft，Save 只写回当前目标的一层；
- Manager 打开、目标查看、主题切换和取消不会 materialize 基底图层；
- 已有本地覆盖时，操作只修改当前目标/状态；删除目标覆盖后正确回退。

### 刷新与交互测试

- 图层排序/隐藏不重建整个 `#app` 或三栏 Workspace；
- Manager 列表更新不丢失其滚动、目标状态和焦点；
- Dialog 打开时切换目标不会静默留下旧 draft；首版可禁用 Inspector 的目标按钮，或提示放弃未保存编辑后再切换；
- 关闭父级主题编辑器时，Manager/Dialog 一并清理；
- Theme 切换后 Manager 不持有旧 Theme 的图层对象引用；
- 窄屏下 Manager/Dialog 可操作，语义 `dialog`、`button`、`tablist` 和键盘 Escape 行为可验证。

### 工程验证

涉及 `src/engine/types/theme.ts` 时必须执行：

```text
npm run gen:schema
npx tsc --noEmit
npx vitest run tests/ui/user-theme-editor-layer-order.test.ts tests/ui/user-theme-editor-overview.test.ts tests/engine/user-theme-service.test.ts tests/ui/presentation-service.test.ts
npm run check:architecture
npm test
npm run build
```

编辑器布局改动还必须在当前 Edge 游戏页面完成视觉回归；未实际执行的验证项不得在文档中标记为完成。

## 六、对 Sol 设计意见的核查结论

| Sol 意见 | 核查结论 |
| --- | --- |
| Inspector / Manager / Editor 三层职责分离 | 采纳；与当前“大目标卡片 + 内联字段”问题直接对应 |
| Manager 单目标，点击其他目标原地切换 | 采纳；目标状态必须扩展为宿主 + state，不能只有 host ID |
| Manager 只显示语义预览 | 采纳；复用 `BackgroundLayerDef` 与集中 descriptor，不在 Manager 重建 CSS 渲染器 |
| 图层使用稳定 ID | 采纳；当前 ID 可选，需先做用户 draft 归一化和 order 同步 |
| 隐藏用 `enabled` | 方向采纳，但当前源码没有该字段；必须走类型、Schema、解析、渲染、合成色和测试完整链路 |
| 删除/排序/隐藏作为即时操作 | 部分采纳；即时只作用于 session preview，正式保存仍走一次 `UserThemeService.apply()` |
| 单层编辑使用 draft，Save/Cancel 分离 | 采纳；Dialog draft 应嵌套在现有 user-theme session draft 之上 |
| 打开 Manager 不 materialize 继承 | 采纳并修正术语；当前没有通用 Parent Theme，按 runtime/Host resolved result 与本地覆盖解释 |
| 新增 `ThemeLayerMutationService` 直接处理主题 | 不直接采纳；当前架构应先做 draft 层纯操作，正式状态写入仍集中在 `UserThemeService`/`StateMutationService` |
| 复用现有 ModalManager 打开二级弹窗 | 不采纳当前实现方式；单槽 ModalManager 会替换父弹窗，首选内部 dialog overlay 或先建立 modal stack |
| `ThemeBackgroundLayer` 使用 discriminated union | 作为后续类型收束方向记录；当前 `BackgroundLayerDef` 仍是 `kind + value` 共享结构，本任务先复用并集中规范化，不顺手扩大 Schema 重构 |

## 七、关联路由

- [[docs/plan-work/00-index]]
- [[docs/plan-work/active/task-0048-workspace-theme-restructure-and-editor]]
- [[docs/plan-work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[docs/plan-work/active/roadmap-0012-flat-presentation-targets]]
- [[docs/plan-work/active/roadmap-0013-presentation-editor-ux]]
- [[docs/plan-work/active/roadmap-0014-theme-editor-convergence]]
- [[docs/plan-work/active/adr-0006-ui-background-layering]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/05-conventions/testing]]
