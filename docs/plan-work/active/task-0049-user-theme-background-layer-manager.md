# task-0049 — 用户自定主题背景图层管理器

状态：🟡 代码施工与工程验收完成，待 Edge 视觉回归

> 本任务将 [[docs/plan-work/newPlan/15-user-theme-background-layer-manager]] 的方案草案转为可执行施工任务。目标是把用户主题 Inspector 中的图层内联展开编辑，改造成“目标总按钮 → 单目标 Layer Manager → 单层 Layer Editor Dialog”。具体主题解析、背景安全约束和 UI 刷新事实仍以源码与 `docs/docs-828/` 为准。

核查基准：2026-09-13 当前工作树。

## 一、目标与完成定义

### 目标

在不新增平行 Theme Schema、主题运行时或保存入口的前提下，完成用户自定主题背景图层编辑器的职责拆分：

```text
User Theme Inspector
  目标摘要 + 管理图层按钮
        ↓
Layer Manager
  单例、单目标的图层集合管理
        ↓
Layer Editor Dialog
  单层详细字段的 draft 编辑
```

### 完成定义

- `user-theme-inspector` 对每个可配置表现目标只显示摘要和“管理图层”总按钮，不再默认展开图层详细字段；
- 全局最多存在一个 Layer Manager；Manager 同时只服务一个目标；
- 点击另一个目标的总按钮时，Manager 原地切换目标，不创建第二实例、不保留旧图层对象引用；
- Manager 仅提供名称/ID、类型、颜色或简单视觉标识，以及新增、上移、下移、隐藏/显示、删除、编辑；
- 单层详细编辑只在 Layer Editor Dialog 中完成；
- Dialog 使用单层 draft，Cancel 不修改主题会话，Save 只写回当前目标的一层；
- 图层操作即时反映到当前编辑会话的 Preview，但正式保存仍只通过 `UserThemeService.apply()` → `StateMutationService`；
- 用户图层具备稳定 ID；排序、删除和编辑不依赖数组索引；
- 隐藏有明确数据语义，不以 `empty` 或 `opacity: 0` 代替；隐藏层保留数据但不参与渲染和代表色合成；
- 查看目标、打开 Manager、主题切换和取消不会无意 materialize 基底图层或改变继承/回退关系；
- 一次图层操作只刷新主题预览、Manager 列表和对应 Inspector 摘要，不重建整个三栏 Workspace；
- 编辑器的稳定 DOM 节点边界、Preview/Editor 刷新通道和输入提交时机符合本文契约；
- 相关测试、类型检查、架构检查、构建和 Edge 视觉回归按本文记录。

## 二、范围与非目标

### 包含

- Inspector 目标摘要与总按钮；
- 单目标 Layer Manager 的临时 UI 状态、目标切换和列表操作；
- 全局背景、宿主默认态和宿主四种状态图层的统一目标引用；
- 单层 Dialog 的 draft、类型字段切换、保存/取消、焦点和脏状态；
- 用户 draft 图层 ID 归一化、order 列表同步和目标级 materialize；
- 图层隐藏字段的类型、Schema、校验、运行时 View、渲染和代表色处理；
- 旧内联图层字段事件、重复 renderer 和基于 index 的定位清理；
- 专项测试、全量测试、架构检查、构建和浏览器验收。

### 不包含

- `ThemeDef.parent`、Cluster detach 或独立 `ThemeApplication` 数据模型；
- 完整实时预览画布、复杂 Undo/Redo 系统或通用 Modal stack；
- 任意 CSS Selector、任意 CSS 属性、未经登记的图片 URL；
- 不同表现目标共享图层数组；
- 直接修改 PlayerState、绕过 `UserThemeService.apply()` 的即时存档；
- 旧存档迁移或兼容迁移代码；
- 主题色派生算法、RuntimeThemeManager 层级算法的重写。

## 三、依据、依赖与不可破坏约束

### 依据文档

- [[docs/plan-work/newPlan/15-user-theme-background-layer-manager]]：已核查的设计草案；
- [[docs/plan-work/active/task-0048-workspace-theme-restructure-and-editor]]：当前 Workspace Theme 编辑器与来源模型收口；
- [[docs/plan-work/active/roadmap-0011-ui-component-layer-backgrounds]]：控件背景图层目标；
- [[docs/plan-work/active/roadmap-0012-flat-presentation-targets]]：平级表现目标与 Host 注册；
- [[docs/plan-work/active/roadmap-0013-presentation-editor-ux]]：统一图层字段与局部刷新基础；
- [[docs/plan-work/active/roadmap-0014-theme-editor-convergence]]：主题编辑器信息架构与可理解性；
- [[docs/plan-work/active/adr-0006-ui-background-layering]]：背景层类型、排序、安全与系统颜色层；
- [[docs/docs-828/05-conventions/architecture-discipline]]：只读 UI、单一写入口、Schema 同步和测试纪律；
- [[docs/docs-828/05-conventions/schema-sync]]：引擎类型变更后的生成协议；
- [[docs/docs-828/05-conventions/testing]]：专项测试与全量测试要求。

### 关键代码落点

| 职责 | 当前代码 | 本任务要求 |
| --- | --- | --- |
| 编辑器渲染 | `src/ui/components/user-theme-editor.ts` | 拆出 Inspector 摘要、Manager、单层 Dialog renderer；停止默认内联详细编辑 |
| 编辑器事件 | `src/ui/controller-modals.ts` | 从基于 index 的内联事件迁移到目标/ID 定位和局部刷新 |
| 编辑会话 | `src/arona-clicker/services/user-theme-service.ts` | 保留单一 session draft、校验和正式保存入口；增加必要的 draft 层操作/归一化 |
| 用户主题结构 | `src/arona-clicker/types/user-theme.ts` | 只保存用户覆盖和编辑会话相关数据，不写入 UI 状态 |
| 引擎图层结构 | `src/engine/types/theme.ts` | 如增加 `enabled?: boolean`，同步 Schema 与所有消费者 |
| 全局背景解析 | `src/ui/background-service.ts` | 隐藏层不生成绘制节点；系统颜色层仍由专用忽略开关控制 |
| 宿主背景解析 | `src/ui/presentation-service.ts` | 隐藏层不参与宿主绘制，保持状态与 order 语义 |
| 代表色合成 | `src/ui/background-color.ts` | 隐藏层不参与代表色和文字色判定 |
| 目标注册 | `src/ui/presentation-targets.ts`、`src/ui/ui-host-registry.ts` | 复用已有稳定目标，不新增编辑器私有目标表 |
| 运行时解析 | `src/engine/core/theme-runtime.ts` | 保持当前层级与目标过滤，不把编辑器 UI 状态写入运行时主题 |
| 弹窗母版 | `src/ui/modal.ts` | 不直接用单槽 `ModalManager.open()` 替换父级主题编辑器 |

### 不可破坏约束

1. UI 只消费只读 View、`UIContext` 和编辑会话 draft，不持有 PlayerState 写引用；
2. 正式状态变更继续走 `UserThemeService.apply()` 和 `StateMutationService`；
3. 引擎类型字段变更必须执行 `npm run gen:schema`；
4. 不做存档迁移；旧结构直接按当前类型、默认数据和测试更新；
5. 新 Manager 不直接修改 CSS，不自行解析图片或实现第二套背景合成；
6. 未知刷新范围不能借助 Game panel 或全量 `ctrl.render()` 偷渡；
7. 只有当前目标、当前宿主状态的图层可以被当前 Manager 操作。

## 四、当前事实与需要修正的问题

当前 `UserThemeService.beginEdit()` 返回一个主题级 `UserThemeEditSession`，主题弹窗内的输入事件修改 session draft，并通过 `ColorSystem.setUserThemePreview()` 显示预览。`ModalManager` 是 body 级单槽实现，重复 `open()` 会替换原弹窗。当前 `user-theme-editor.ts` 的 `renderHostTargets()` 同时渲染宿主目标、状态、几何、装饰线和图层详细字段；`controller-modals.ts` 的部分图层操作按数组索引写入并触发完整编辑器刷新。

当前数据粒度为：

```text
global background:
  draft.background + draft.backgroundLayerOrder

host default:
  draft.presentation.hosts[].layers + host.layerOrder

host state:
  host.states[state].layers + host.states[state].layerOrder
```

必须修正的事实风险：

- `BackgroundLayerDef.id` 可选，不能继续用 index 作为 Dialog 的长期身份；
- 当前没有通用隐藏字段；`empty` 和 `opacity: 0` 不具有隐藏语义；
- `openUserThemeEditor()` 在没有用户全局背景时会把 runtime background 克隆到 draft，这会把“查看”变成潜在的本地覆盖；
- 现有 `ModalManager` 不支持嵌套栈，Layer Editor 不能直接替换父级主题弹窗；
- 旧 `presentation.layers/panels` 仍可通过 normalize 读取，但新 Manager 只应写 `background` 和 `presentation.hosts`；
- 当前 `BackgroundLayerDef` 是共享的 `kind + value` 结构，不在本任务中顺手改成全量 discriminated union。

## 五、目标设计

### 5.1 目标引用

Manager 不保存图层对象或数组索引，只保存目标引用：

```ts
interface ThemeLayerTargetRef {
  kind: 'global' | 'host';
  hostId?: string;
  state?: 'default' | 'active' | 'inactive' | 'disabled';
}
```

`global` 表示外部全局背景；`host` 表示已由 `UI_HOST_REGISTRY` 登记的宿主。宿主目标的 `state` 必须进入引用，以区分默认态和状态态图层。

### 5.2 Inspector

目标卡片只显示：

```text
目标名称 / 级别
当前有效图层数
来源或回退信息
[管理图层]
```

以下字段移出 Inspector：图层类型、值、透明度、定位、尺寸、重复、附着、缩放、旋转、混合模式。总按钮只携带 `ThemeLayerTargetRef`。

### 5.3 Layer Manager

临时状态：

```ts
interface LayerManagerUIState {
  open: boolean;
  activeTarget: ThemeLayerTargetRef | null;
}
```

Manager 提供：新增、上移、下移、隐藏/显示、删除、编辑。列表行只显示名称/ID、类型、颜色或简单视觉标识和简短摘要。建议使用集中 `describeThemeLayer()` 生成展示信息。

全局系统颜色层是特殊行：可按现有 `systemColorLayerIgnored` 语义隐藏、可参与全局顺序调整，但不可删除，也不可被用户 `enabled` 字段覆盖。

### 5.4 Layer Editor Dialog

Dialog 使用：

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

打开时 clone 单层；输入只修改 Dialog draft。Save 时按 `target + state + layerId` 写回 session draft，并更新 preview；Cancel 只关闭 Dialog。首版在现有 `.user-theme-modal` 内挂载内部 `role="dialog"` overlay，不调用会替换父级的 `ctrl.modal.open()`。

### 5.5 Draft 操作与正式保存

新增集中 draft 操作，至少覆盖：

```ts
getTargetLayers(draft, targetRef)
addTargetLayer(draft, targetRef, layer)
updateTargetLayer(draft, targetRef, layerId, next)
removeTargetLayer(draft, targetRef, layerId)
moveTargetLayer(draft, targetRef, layerId, direction)
setTargetLayerEnabled(draft, targetRef, layerId, enabled)
```

它们只处理编辑会话 draft，不直接写 PlayerState。正式保存保持：

```text
UserThemeService.apply()
  → StateMutationService.setUserTheme()
  → userThemeChanged
  → ColorSystem / UI controller
```

Manager 的操作可即时更新当前 preview，但不等于立即落账。

### 5.6 Materialize 与回退

打开 Manager 或查看目标只读读取 resolved 结果，不 materialize。第一次对无本地覆盖的目标执行新增、删除、排序、隐藏或保存编辑时，只 materialize 当前目标、当前状态所需的 layers，再执行操作。

删除本地目标配置必须让运行时回退到父级/系统表现；不能把父级图层复制回来冒充“恢复继承”。当前没有通用 `ThemeDef.parent`，本文中的“继承”仅指运行时主题层、Host 回退和用户覆盖解析。

必须移除或改造全局 runtime background 在 `openUserThemeEditor()` 中直接克隆进 draft 的行为，并补“打开后取消”和“打开后未编辑直接保存”回归测试。

### 5.7 隐藏字段

按本任务目标，建议在 `BackgroundLayerDef` 增加：

```ts
enabled?: boolean // 缺省为 true
```

约定：

- `enabled: false` 保留所有图层数据、ID 和顺序，但不进入背景/宿主绘制和代表色合成；
- `empty` 继续表示没有内容；
- `opacity: 0` 继续表示完全透明；
- 系统颜色层仍由 `systemColorLayerIgnored` 控制；
- 类型、Schema、用户主题校验、背景服务、表现服务、背景合成色服务和测试必须同步。

若实现阶段经评审决定不增加该字段，必须在任务记录中明确“隐藏暂不支持”，不得用 `empty` 或透明度替代。

### 5.8 ID 与排序

用户 Manager 管理的匿名层在进入编辑会话时归一化为稳定 ID；同一目标/状态内唯一，且不依赖当前位置。ID 改名必须同步 order 列表，不能使用保留 ID `system-color-background`。

保存顺序为底到顶，Manager 展示顺序为顶到底：

```text
上移 = 提高视觉层级 = 存储顺序后移
下移 = 降低视觉层级 = 存储顺序前移
```

全局使用 `backgroundLayerOrder`，宿主默认态使用 `host.layerOrder`，宿主状态使用对应状态的 `layerOrder`。移动操作只更新对应 order 列表。

### 5.9 Editor DOM Identity / Refresh Contract

局部刷新不是“重新渲染后恰好看起来没闪烁”，而是必须有稳定的 DOM 身份边界。默认生命周期规定如下：

```text
UserThemeEditorRoot       = 整个主题编辑会话
InspectorRoot             = 整个主题编辑会话
LayerManagerShell         = Manager 首次打开 → 父级编辑器关闭
LayerManagerHeader        = Manager 生命周期内稳定，可 patch
LayerManagerList          = Manager 生命周期内稳定，可 keyed reconcile
LayerRow[layerId]         = 以 target + state + layerId 为 DOM identity
LayerEditorDialogShell    = Dialog 打开期间稳定
LayerEditorForm          = Dialog 打开期间稳定
LayerEditorFormField      = 普通输入期间稳定
```

必须禁止：

```text
Manager 操作 → user-theme-modal.innerHTML = ...
Manager 操作 → renderUserThemeEditor()
Dialog input  → renderLayerEditorDialog()
图层事件     → ctrl.render()
```

允许的最小更新：

```text
隐藏/显示          → patchLayerRow(layerId)
编辑保存名称/类型  → patchLayerRow(layerId)
排序               → 复用 LayerRow 节点，仅移动或 keyed reconcile 顺序
切换 target         → patch Header + reconcile List
打开/关闭 Dialog    → 切换 Dialog overlay，不重建父级 Manager
```

一次更新不得无故替换无关的 Inspector、Manager、LayerRow、Dialog form 或滚动容器。若某个结构变化确实需要 replace，必须说明替换边界、保存焦点/滚动状态的方式，并补节点 identity 测试。

### 5.10 Preview 与 Editor UI 必须是两条刷新通道

主题 Preview 的刷新不等于编辑器 DOM 的失效：

```text
session draft mutation
  ├─ scheduleThemePreview(targetRef)
  │    └─ Runtime theme / CSS / 目标表现刷新
  └─ invalidateThemeEditor(scope)  // 仅在界面确实需要变化时调用
       └─ Manager row / header / Inspector summary 的定向 patch
```

Preview renderer 不得反向触发 `renderUserThemeEditor()`。同一 animation frame 内多个输入只允许合并为一次 Preview apply；如果主题编译成本较高，可在 Preview 通道增加 50–100ms debounce，但 session draft 的字段值仍需同步更新。

输入提交规则：

| 输入 | Draft 更新 | Preview |
| --- | --- | --- |
| 名称/文本 | `input` | 不需要实时刷新；Dialog 保存时才更新 Manager 行 |
| Pic ID | `change` | 即时 |
| 颜色 | `input` | RAF 合并 |
| 透明度 slider | `input` | RAF 合并 |
| 数字文本 | `input` | 值合法时 debounce/RAF |
| select | `change` | 即时 |
| 渐变色标/角度 | `input` | RAF 合并 |

Dialog 普通输入期间不得刷新 Manager 行或 Inspector 摘要；只有 Dialog Save 才把单层结果写回 session draft 并 patch 相关摘要。

### 5.11 Manager 与 Dialog 的所有权和脏状态

Dialog 打开期间，正在编辑的 `target + state + layerId` 由 Dialog 独占：

- Manager 列表仍可见，但新增、删除、排序、隐藏/显示和其他集合 mutation 全部 disabled；
- Inspector 的目标总按钮 disabled；
- 主题切换、父级编辑器关闭和其他会丢弃 session 的动作进入 dirty guard；
- 若 Dialog 没有 dirty，可安全关闭或切换；若 dirty，必须提示“继续编辑”或“放弃并切换/关闭”；
- 不允许删除或移动正在编辑的图层后仍保留可提交的旧 Dialog draft。

首版可以锁住 Manager 与 Inspector 的相关操作，待有明确 modal stack/selection 协议后再放宽。任何放宽都必须保证 Dialog 的 `layerId` 不会静默变成悬空引用。

### 5.12 新增、删除和长列表 UX

新增图层不先把默认空层插入真实目标。推荐流程：

```text
[新增图层]
  → 选择纯色 / 渐变 / 图片
  → 创建带安全初值的 Dialog draft
  → Dialog Save 才 addTargetLayer()
```

Create Dialog 的 Cancel 必须无 mutation、无 materialize、无 order 变化。若直接在 Dialog 第一项选择类型，也必须保持相同语义。

Manager 空状态要区分：

```text
本目标没有本地图层，当前回退到父级/系统表现
本目标有本地图层，但当前全部隐藏
本目标不支持图层
```

删除最后一个本地图层后，不能只显示“暂无图层”；应说明当前已回退，并提供“添加自定义图层”。恢复继承的动作应删除本地目标覆盖，而不是复制父级层。

Manager 第一版可以继续使用上下按钮，不要求拖拽；但排序后必须保持被操作 Layer 在视口内。长列表可选支持 `Alt+↑/Alt+↓` 和 `Home/End`，不应通过重建列表把滚动位置推回顶部。

视觉约定：整行可点击选中，但显式“编辑”按钮才打开 Dialog；删除等危险操作优先收进 `⋮` 菜单；名称优先显示，ID 作为次要信息或无名称时的回退；来源/继承状态放在 Manager header；系统颜色层使用锁定标识；隐藏行弱化行背景和眼睛图标，但保留原始颜色 swatch 的可读性。

## 六、施工切片

### P0：契约、ID、隐藏和 materialize 基线

- [x] 建立 `ThemeLayerTargetRef` 与全局/宿主/宿主状态的读取纯函数；
- [x] 为用户 draft 中的匿名层补稳定 ID，并校验目标/状态内重复 ID；
- [x] 增加并接通 `enabled` 隐藏语义，或记录明确的暂不支持裁定；
- [x] 修正编辑器打开时克隆 runtime global background 的副作用；
- [x] 增加目标级 resolved/local 来源信息，支持首次 mutation materialize；
- [x] 补查看、取消、无编辑保存、状态隔离、order 同步的单元测试。

### P1：Inspector 总按钮与单目标 Manager

- [x] 将目标卡片改为摘要 + “管理图层”；
- [x] 建立页面级唯一 Manager shell 与临时 UI 状态；
- [x] 支持 Manager 原地切换目标，不创建第二实例；
- [x] 实现列表、简单预览、上移、下移、隐藏/显示、删除确认和编辑按钮；
- [x] 全局系统颜色层显示为不可删除的特殊行；
- [x] 目标不存在、无配置或主题切换后失效时显示空状态，不引用旧对象。

### P2：单层 Layer Editor Dialog

- [x] 将全局背景和宿主图层详细字段抽为共享 Dialog 字段 renderer；
- [x] 纯色复用原生 color picker；渐变复用双色/角度受控编辑；图片仅选择已登记 Pic ID；
- [x] 按 `kind` 显示相关字段，类型切换集中经过 `normalizeLayerForKind()`；
- [x] 新增流程先创建 Dialog draft，只有 Save 才 `addTargetLayer()`；Cancel 不产生 mutation 或 materialize；
- [x] 实现 Dialog draft、Save/Cancel、脏状态提示、焦点回收和 Escape 规则；
- [x] 首版使用主题弹窗内部 overlay，不替换父级 `ModalManager` 会话。

### P3：局部刷新与旧路径清理

- [x] 拆分 `renderLayerManagerShell()`、`renderLayerManagerList()`、`renderLayerRow()`、`renderLayerEditorDialog()`；
- [x] 目标切换只刷新 Manager header/list；单行隐藏只刷新当前行；排序只刷新列表；
- [x] Dialog 输入只刷新 Dialog 内部预览、对应目标表现和必要摘要；
- [x] 清理旧内联图层详细字段事件、重复 legacy renderer 和基于 index 的编辑定位；
- [x] 禁止图层输入默认调用全局 `ctrl.render()`。

### P3.5：Editor DOM 生命周期与刷新预算

- [x] `LayerManagerShell` 在主题编辑会话内保持稳定 DOM identity；
- [x] `LayerRow` 以 `target + state + layerId` 为 key，禁止以 index 作为 DOM identity；
- [x] 隐藏/显示和编辑保存只 patch 对应 `LayerRow`；
- [x] reorder 复用现有 `LayerRow` 节点，只调整排列；
- [x] target switch 保留 Manager shell，只 reconcile header/list；
- [x] Dialog 普通 input 不重建 form root、field 或 Manager；
- [x] Preview 更新不得触发 UserThemeEditor renderer；高频输入通过 RAF/debounce 合并 Preview apply；
- [x] 所有局部操作保持 activeElement、selection 和无关 scroll container；
- [x] 禁止从图层事件调用 `ctrl.render()`、完整 user-theme renderer 或 Workspace renderer。

### P4：集成验收与任务收口

- [ ] 完成全局背景、面板、按钮、Tab、卡片/气泡和状态图层的 Edge 视觉回归；
- [x] 完成跨目标、跨状态、主题切换、取消/保存、删除回退和隐藏合成色的代码级回归；
- [x] 未发现当前 resolved/local 模型不足；未在本任务中隐式扩展 Parent/Cluster；
- [x] 回写本任务验证结果；相关 Roadmap 状态和新策划草案无需改变生命周期。

## 七、验收标准

### 功能

1. Inspector 不再默认展示图层详细字段，每个可配置目标有总按钮；
2. 页面全局最多一个 Manager，且 Manager 同时只服务一个目标；
3. 点击其他目标时 Manager 原地切换；
4. Manager 行只显示简单预览、类型、名称/ID；
5. Manager 支持新增、上移、下移、隐藏/显示、删除和编辑；
6. 单层详细编辑只在 Dialog 完成；
7. Dialog Cancel 不改变 session draft，Save 只写回当前目标/状态/图层；
8. 系统颜色层不可删除，用户层删除后正确回退；
9. 隐藏图层保留数据和顺序但不渲染、不参与代表色合成；
10. 排序结果与实际视觉层级一致，稳定 ID 不随排序变化；
11. 打开 Manager 或查看目标不改变本地覆盖状态；首次实际修改才 materialize 当前目标；
12. 主题切换或目标切换后不持有旧 Theme 的 Layer 引用。

### 刷新与交互

1. 单次图层操作不重建整个 `#app` 或三栏 Workspace；
2. Manager 列表更新不丢失滚动、目标状态和焦点；
3. Dialog 打开时不能静默切换目标并留下旧 draft；
4. 关闭父级主题编辑器时 Manager/Dialog 一并清理；
5. 语义 `dialog`、`button`、`tablist`、Escape 和窄屏布局可用。

### DOM identity 与刷新不变量

1. 隐藏 Layer A 后，`LayerManagerShell`、`InspectorRoot` 和无关 `LayerRow B` 的节点 identity 不变；
2. 排序 A/B 后，A/B 的 `LayerRow` 节点被复用，仅顺序改变；
3. Dialog 修改 opacity 时，Dialog form、输入节点、`activeElement`、`selectionStart/selectionEnd` 不因 Preview 更新而改变；
4. 切换 Manager target 后，Manager shell 和 scroll container identity 不变，仅 header/list 内容 reconcile；
5. 普通 name input 的每次输入不 patch Manager row 或 Inspector summary；Save 后才更新；
6. Preview 更新不触发 UserThemeEditor renderer，也不重建父级 Modal。

## 八、测试与验证

### 必须新增或更新的测试方向

- `tests/ui/`：Inspector 总按钮、Manager 单例/目标切换、行摘要、Dialog Save/Cancel、局部刷新和焦点状态；
- `tests/ui/`：DOM identity 不变量、keyed row 复用、排序节点移动、Dialog selection 保留、Preview 与 Editor 刷新隔离、RAF/debounce 合并；
- `tests/engine/`：用户 draft ID 归一化、目标/状态定位、隐藏字段校验、materialize 与保存边界；
- 背景/表现服务测试：隐藏层不绘制、不参与代表色，order 与视觉顺序一致；
- 既有 `user-theme-editor-layer-order.test.ts`、`user-theme-editor-overview.test.ts`、`user-theme-editor-decoration.test.ts`、`user-theme-service.test.ts`、`presentation-service.test.ts` 按新契约更新。

### 工程命令

若修改 `src/engine/types/theme.ts`，必须执行：

```text
npm run gen:schema
npx tsc --noEmit
npx vitest run tests/ui/user-theme-editor-layer-order.test.ts tests/ui/user-theme-editor-overview.test.ts tests/engine/user-theme-service.test.ts tests/ui/presentation-service.test.ts
npm run check:architecture
npm test
npm run build
```

涉及编辑器布局时，另需在当前 Edge 游戏页面完成视觉回归。未实际执行的项目不得标记为完成。

## 九、当前核验与剩余工作

### 当前核验（2026-09-13）

- [x] 已阅读 `docs/docs-828/00-INDEX`、`docs/plan-work/00-index` 与 `docs/plan-work/newPlan/00-index`；
- [x] 已核对 `task-0048`、roadmap-0011/0012/0013/0014、roadmap-0010、roadmap-0006、ADR-0006；
- [x] 已核对 Inspector renderer、Controller 事件、UserThemeService、Theme 类型、背景/表现服务和相关测试；
- [x] 已核查 Sol 方案并记录采纳、修正和不直接采纳项；
- [x] 已执行文档改动的 `git diff --check`；
- [x] 代码施工已完成：新增目标引用/图层 draft 操作、稳定 ID、目标级 materialize、`enabled` 隐藏语义、单例 Manager 与单层 Dialog；
- [x] 专项测试通过：相关测试覆盖目标引用、materialize、重复 ID、系统层排序、隐藏语义和 Manager 摘要；
- [x] 全量测试通过：144 个测试文件、1324 个测试通过；
- [x] `npx tsc --noEmit` 通过；
- [x] `npm run check:architecture` 通过；
- [x] `npm run build` 通过；
- [ ] Edge 视觉回归未完成：当前 CUA 浏览器枚举在多次重试与重置后仍返回 `Browsers: nodeRepl.fetch request failed`，无法取得可验证的游戏页面状态。

### 剩余工作

剩余唯一验收项是 Edge 当前游戏页面的视觉回归；代码、测试、类型、架构和构建验收已完成。恢复 Edge 自动化通道后，应补做该项并将任务状态改为完成。

## 十、相关路由

- [[docs/plan-work/newPlan/15-user-theme-background-layer-manager]]
- [[docs/plan-work/active/task-0048-workspace-theme-restructure-and-editor]]
- [[docs/plan-work/active/roadmap-0010-presentation-layer-service]]
- [[docs/plan-work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[docs/plan-work/active/roadmap-0012-flat-presentation-targets]]
- [[docs/plan-work/active/roadmap-0013-presentation-editor-ux]]
- [[docs/plan-work/active/roadmap-0014-theme-editor-convergence]]
- [[docs/plan-work/active/adr-0006-ui-background-layering]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/05-conventions/testing]]
