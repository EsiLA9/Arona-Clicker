# task-0050 — 用户主题图层浮层生命周期与全局表现目标统一收口

状态：active — P0-A 结构已落地但 Dialog 与 global 图层入口功能不可用；P1 部分完成；P2 未收口。功能恢复转入 [[task-0051-user-theme-layer-editor-functional-recovery]]

> 本文承接 [[task-0049-user-theme-background-layer-manager]]。它不是对 Task0049 已完成基线的重复施工，而是针对首版实现暴露出的两个结构性问题建立的可执行修正任务：Layer Manager/Dialog 的挂载位置错误，以及 `global` 在用户主题数据、编辑器和运行时之间形成的双管线。执行必须按 P0 → P1 → P2 顺序推进；未完成前一阶段，不得提前扩展后一阶段。

核查基准：2026-09-13，`main` 当前提交 `53d628f (wrong-ui-editor-edition)`。

> 核查更正（2026-09-13，只读复核）：P0-A 只完成了 overlay 的 DOM 挂载拆分，Dialog 的保存/取消/关闭/标题与 global 图层入口在实际运行中不可用（根因见 [[task-0051-user-theme-layer-editor-functional-recovery]] §三）；§六 "P0 必测" 的 overlay 行为测试实际不存在，其勾选与验收不能作为功能可用依据。本任务的后续切片状态以下方更正后的勾选为准。

## 一、优先度裁定

| 优先级 | 裁定 | 原因 | 完成门槛 |
| --- | --- | --- | --- |
| P0 | 必须立即修复 | “浮窗”实际是 Inspector 的普通后代；父级编辑器刷新会销毁 Manager/Dialog，当前不能通过 Edge 视觉验收 | body-level overlay、独立生命周期、刷新不销毁、专项测试通过 |
| P1 | P0 后立即施工 | `global` 被硬编码为永远存在的背景分支，和已注册的 Presentation Host 概念冲突；用户无法用与其他目标一致的方式加入全局覆盖 | global 可显式加入、无默认用户 host、创建不写 `layers: []`、目标引用统一 |
| P2 | 高风险架构收口，需按闸门施工 | 彻底撤掉 UserThemeDraft 的全局背景存储并接入统一 resolver 会影响运行时合并、系统颜色层和重开编辑器 | 先完成 ADR/等价裁定与旧/新 fixture 对照，再改运行时和校验；不得凭猜测直接重写 |

优先级结论：P0 是当前 `Task0049` 的阻断性回归，不是普通 CSS 优化；P1 是紧随其后的编辑器语义问题；P2 是可独立回归的架构切片，不得为了“看起来统一”把 P0/P1 和完整 Runtime 重写混成一次大改。

## 二、核查结论与证据

### 2.1 Sol 修正意见中确认采纳的事实

| 结论 | 当前证据 | 判定 |
| --- | --- | --- |
| Manager 被直接渲染进 Inspector | `src/ui/components/user-theme-editor.ts:109` 输出 `.user-theme-inspector`，`renderTargetSummary()` 在 `:129-136` 返回 `cards + renderLayerManagerShell(...)` | 已确认；这是 P0 第一现场 |
| Dialog 是 Manager 的内部节点 | `src/ui/components/user-theme-layer-manager.ts:81-87` 在 Manager shell 内输出 `[data-theme-layer-editor-dialog]` | 已确认；它不是独立 overlay |
| Controller 把两者当父 modal 后代查找 | `src/ui/controller-modals.ts:478-485` 从 `modal` 查询 shell，再从 shell 查询 dialog | 已确认；必须迁移到 Overlay Host |
| 父级刷新会重建 Manager | `src/ui/controller-modals.ts:612-635` 对 `.modal-body` 执行 `innerHTML = renderUserThemeEditor(...)` | 已确认；Manager/Dialog 的 closure 和 DOM 都会失效 |
| `ModalManager` 是 body-level 但单槽 | `src/ui/modal.ts:67-74` 重复 `open()` 替换内容，`:90-94` 挂载 `.app-modal` 到 `document.body` | 已确认；不能用第二次 `ctrl.modal.open()` 伪造嵌套栈 |
| `global` 已在 UI Host Registry 中注册却不可编辑 | `src/ui/ui-host-registry.ts:97-106` 将 `global` 注册为 `level: 'global'`、`kind: 'background'`、`editable: false` | 已确认；Registry 与编辑器语义分叉 |
| `global` 仍走独立数据分支 | `src/arona-clicker/services/user-theme-layer-service.ts:54-91` 对 `kind === 'global'` 读写 `draft.background/backgroundLayerOrder`；宿主则读写 `presentation.hosts` | 已确认；这是 P1/P2 的第二现场 |
| normalize 会把 global host 搬回旧背景并删除 host | `src/arona-clicker/services/user-theme-service.ts:23-60` 的 `normalizePresentationDraft()` | 已确认；不能在统一模型中保留该迁出行为 |
| 编辑器默认永远显示全局卡片并排除 global 候选 | `src/ui/components/user-theme-editor.ts:109` 的固定全局卡片、`:140-147` 的 `configured = new Set(['global'])` 和 `target.id !== 'global'` | 已确认；与“显式加入全局目标”冲突 |
| 加入目标会立即 materialize 空图层 | `src/ui/controller-modals.ts:404-412` 执行 `hosts.push({ ..., layers: [] })` | 已确认；必须改为只建立目标记录，不写图层覆盖 |
| 背景 renderer 不需要删除 | `src/ui/background-service.ts` 提供 `buildBackgroundView/renderBackground`；`src/ui/presentation-service.ts` 复用背景层解析和渲染 | Sol 的“保留 background-service”建议采纳 |

### 2.2 已完成能力，不得在 Task0050 重做

Task0049 已完成并应直接复用：

- `BackgroundLayerDef.enabled` 隐藏语义及背景/代表色过滤；
- 匿名图层稳定 ID、目标内重复 ID 校验和 order 同步；
- 目标级 `materializeTargetLayers()` 与 Cancel/未编辑保存边界；
- Manager 行的 keyed reconcile、目标/状态/图层 ID 定位和首版 Dialog draft；
- `UserThemeService.apply()` → `StateMutationService` 的正式保存入口。

Task0050 只修复挂载、生命周期、global 目标模型和因此必须更新的消费者/测试；不得重新设计图层 kind、图片安全白名单、主题色派生算法或存档迁移。

## 三、目标架构

### 3.1 DOM 关系

最终结构必须是 body 级并列节点：

```text
body
├─ .app-modal
│  └─ User Theme Modal / Inspector
└─ [data-editor-overlay-root]
   ├─ [data-theme-layer-manager-overlay]
   │  └─ Layer Manager content
   └─ [data-theme-layer-editor-overlay]
      └─ Layer Editor Dialog content
```

以下结构禁止保留：

```text
User Theme Modal
└─ user-theme-inspector
   └─ Layer Manager
      └─ Layer Editor Dialog
```

Manager 和 Dialog 的逻辑关系仍然可以是 `Inspector → Manager → Editor`，但 DOM 所有权必须是 `UserThemeEditSession → EditorOverlayHost`。Dialog 不得继续作为 Manager 的内部 conditional panel。

### 3.2 目标引用

P1/P2 的目标引用终态统一为：

```ts
interface ThemeLayerTargetRef {
  hostId: string;
  state?: 'default' | 'active' | 'inactive' | 'disabled';
}
```

其中：

- `hostId: 'global'` 表示全局外部背景；
- `global` 是普通的顶级 Presentation Target，不代表 UserThemeDraft 中必须预先存在一条覆盖；
- 没有 `presentation.hosts[id='global']` 时，运行时仍使用系统主题/当前主题的默认背景；
- `state` 只对支持状态的宿主生效；global 首版不凭空增加状态分支；
- `targetRefKey()`、DOM key、事件 dataset 和 resolver 均使用 `hostId + state`，不再让 `kind: 'global' | 'host'` 作为第二套定位协议。

如果为降低一次提交风险需要短暂保留旧 discriminant，只允许把它限制在单一兼容边界，并在同一 P1 切片中完成所有 UI/service 调用方迁移；不得让新代码继续新增 `if (target.kind === 'global')` 分支。

### 3.3 global 的用户配置语义

必须分开表达“目标已加入编辑列表”和“目标已有图层覆盖”：

```text
host 不存在
= 用户未加入/未配置该目标

host 存在，layers 未定义
= 用户明确加入目标，但图层仍继承当前有效表现

host.layers = []
= 用户明确建立了空的本地图层覆盖

host.layers = [...]
= 用户的本地图层覆盖
```

因此：

1. Inspector 只渲染 `presentation.hosts` 中实际存在的目标，不再硬编码全局背景卡片；
2. “加入表现目标”候选器允许选择 `global`，且只在真正存在 global host 时隐藏它；
3. 选择 global 只写入 `{ id: 'global', parent: undefined }`，不得写入 `layers: []`；
4. 首次新增/删除/排序/隐藏/保存图层时才对当前目标执行 materialize；
5. 清除本地覆盖时删除 `layers/layerOrder`，若 host 没有其他用户配置则连 host 记录一起删除；
6. 系统默认背景始终存在于 runtime fallback，不因没有用户 global host 而出现空白页面。

### 3.4 系统颜色层

系统颜色层仍是 global 的虚拟层，不是用户保存的 `BackgroundLayerDef` 副本：

- `system-color-background` 仍不可删除，可参与 global 的视觉排序；
- `systemColorLayerIgnored` 的当前主题级语义先保留，不在本任务中发明每个 Host 的新忽略字段；
- global host 未配置时，Manager 不强行创建用户覆盖；global 被显式加入并打开 Manager 后，才显示系统虚拟行与当前有效用户层；
- global 的用户 order 必须能够表达系统虚拟层与用户层的相对位置，且系统层不进入用户 `layers` 数组；
- `background-service.ts` 继续是唯一背景 CSS 解析/渲染出口，renderer 不知道目标是 global 还是 button。

## 四、施工切片

### P0-A：Editor Overlay Host 与 renderer 拆分

- [x] 新增一个小型 `EditorOverlayHost`（落点 `src/ui/editor-overlay-host.ts`），只负责 body-level root、Manager overlay、Dialog overlay 的创建、打开、关闭和 session 清理；不改造 `ModalManager` 为 stack；
- [x] `renderUserThemeEditor()` 和 `renderTargetSummary()` 移除 `renderLayerManagerShell()` 拼接；Inspector 只输出目标摘要与“管理图层”按钮；
- [x] `user-theme-layer-manager.ts` 拆成纯内容 renderer：Manager header/list/row 与 Dialog shell/form 分开，renderer 不决定自己挂载到哪个父节点；
- [x] Manager 和 Dialog 作为 Overlay Host 的两个兄弟节点挂载到 `document.body` 下的专用 root；不得通过 `position: fixed` 掩盖错误的父子 DOM；
- [x] `controller-modals.ts` 不再从 `modal.querySelector()` 查找 Manager/Dialog；事件入口仍可来自主题编辑器按钮，但目标点击后必须调用 Overlay Host；
- [ ] 禁止通过第二次 `ctrl.modal.open()` 打开图层窗口，因为它会覆盖 User Theme Modal。

### P0-B：编辑会话所有权与刷新隔离

- [ ] 将 `target`、`dialogTarget`、`dialogLayerId`、`dialogDraft`、`dirty` 等临时状态绑定到当前 `UserThemeEditSession` 的 overlay controller，而不是绑定到一次 `bindUserThemeLayerManager()` 产生的 DOM closure；
- [ ] Overlay 节点带 `sessionId`，旧主题 session 的事件不得作用于新 session；
- [ ] `refreshUserThemeEditor()` 可以重建 Modal body，但不得重建、清空或失效当前 Manager/Dialog；
- [ ] 主题编辑器父级关闭、保存、取消和 session discard 前，统一先关闭并清理对应 overlay；不得留下 body 级孤儿节点或 document 级重复 keydown listener；
- [ ] Dialog 打开时继续锁住 Manager 集合 mutation 与 Inspector 目标切换；dirty 时关闭、切换和父级销毁必须经过放弃确认；
- [ ] Manager/Dialog 的关闭、Escape、焦点回收和父级关闭行为分别可验证，不能依赖父 modal 的 Escape listener 偶然兜底。

### P0-C：DOM/CSS 与局部刷新验收

- [ ] 为 overlay root、Manager panel、Dialog panel 建立明确 z-index、pointer-events、窄屏尺寸和滚动容器边界；主主题 Modal 仍可辨认，浮层不可被 Inspector 的 `overflow` 裁剪；
- [ ] Manager target switch 只 patch header/list；Dialog open/close 只切换 Dialog overlay；图层行使用 `targetRefKey + layerId` 复用；
- [ ] Preview 更新只能走 `ColorSystem.setUserThemePreview()` / `refreshTheme()` / 目标表现刷新通道，不得反向触发 `renderUserThemeEditor()`；
- [ ] 录入普通 name/ID 时不 patch Manager row 或 Inspector summary；Save 后才更新相关摘要；
- [ ] 同一 frame 的颜色/透明度输入合并 Preview apply，且不替换 Dialog form、输入节点、activeElement、selection 或无关滚动容器。

### P1-A：统一编辑器中的 global 目标语义

- [x] 将 `UI_HOST_REGISTRY` 的 global 能力解释为“允许用户创建本地覆盖目标”，取消 `editable: false` 对 global 的阻断；系统默认背景仍由 runtime fallback 提供；
- [x] 移除固定 global card、`configured = new Set(['global'])` 和 `target.id !== 'global'` 这类编辑器特判；已配置列表与候选列表均按实际 host 记录计算；
- [x] 目标选择器展示 global/簇/区域/控件时复用同一目标协议；加入 global 后只建立 host 记录，不建立空 `layers`；Cancel/关闭选择器不写 draft；
- [ ] 引入或明确区分 `hasConfiguredTarget()` 与 `hasLocalTarget()`：前者表示 host 是否存在，后者表示当前 state 是否有 `layers` 覆盖；现有 materialize 语义不得被混淆；
- [ ] global Manager 以虚拟系统层 + 用户层的方式展示，普通 Host 不显示 global 专用分支；保留 `systemColorLayerIgnored` 的兼容语义直到 P2 resolver 完成。

### P1-B：迁移目标引用与编辑器事件

- [ ] 统一 `readTargetFromElement()`、`themeLayerTargetLabel()`、`targetRefKey()`、Manager row key、Dialog Save/Cancel 和 preview 目标刷新为 `hostId + state`；
- [ ] 所有图层 mutation 仍只通过 `user-theme-layer-service.ts` 的 draft 操作，不能在 controller 中新增直接数组写入；
- [ ] 目标切换、状态切换、删除最后一层、恢复继承和主题切换必须清理旧 target/layer 引用；
- [ ] 不把 Parent/Cluster 继承算法扩展为新的 `ThemeApplication` 模型；本阶段只统一目标身份和编辑器入口。

### P2-A：global 存储与 runtime resolver（架构闸门）

开始本切片前必须在本任务或独立 ADR 中写明并通过评审：

1. `UserThemeDraft.presentation.hosts[id='global']` 是用户 global 覆盖的唯一新写入位置；
2. `UserThemeDraft.background/backgroundLayerOrder` 不再产生新写入；
3. `ThemeDef.background` 仍保留，它是系统/主题运行时的基础背景来源，不能误删；
4. 没有 global host 时使用 runtime fallback；有 global host 但 `layers` 未定义时仍回退；有 `layers` 时按既定 materialize 语义覆盖；
5. 系统颜色虚拟层、用户层顺序、忽略语义和旧 fixture 的视觉结果都有明确对应关系。

通过闸门后：

- [x] 停止 `normalizePresentationDraft()` 将 global host 搬到 `draft.background` 并删除 host；
- [ ] 将 global host 接入统一 `ThemeTargetResolver → ThemeLayerResolver → BackgroundView` 边界；
- [ ] 让全局页面背景和 Host 背景最终都通过同一 `BackgroundView/renderBackground()` 出口，但保留各自合法的 DOM 挂载点；
- [ ] 从 UserThemeDraft、校验器、ColorSystem preview 输入、Manager service 和测试中删除旧全局背景的新写入/新依赖；不编写旧存档迁移；
- [ ] 为等价旧 fixture 建立新模型回归：无 global host、有 global host 且未配置 layers、有用户 layers、系统层忽略、系统层排序、删除回退。

### P2-B：清理双头渲染与重复特判

- [ ] Generic layer service 不再通过 `if (target.kind === 'global')` 决定完全不同的存储路径；global 特殊性只保留在明确的 `GlobalBackgroundPolicy`/虚拟系统层边界；
- [ ] Controller 不再分别读取 `runtime.background` 与 `runtime.presentation.hosts` 来决定 Manager 数据；改为向统一 resolver 请求 resolved/local view；
- [ ] 不删除 `background-service.ts`，不新增第二个背景 renderer，不让 renderer 了解目标类型；
- [ ] 完成后更新 `roadmap-0010`、`roadmap-0012` 或对应 ADR 的状态，确保计划文档不再把已废弃的双管线写成当前目标模型。

## 五、非目标与禁止事项

- 不修改 `ModalManager` 的单槽语义，不实现通用 Modal stack；
- 不把 body-level overlay 退化成 Inspector 内的 `position: fixed`；
- 不重复施工 Task0049 已完成的 stable ID、`enabled`、materialize 和基础 Dialog 字段；
- 不改 `ThemeDef.parent`、Cluster detach、完整继承算法或独立 `ThemeApplication`；
- 不删除 `background-service.ts`，不建立第二套背景 CSS/代表色解析；
- 不新增任意 CSS Selector、任意 CSS 属性、未登记图片 URL；
- 不增加预览画布、拖拽排序、Undo/Redo 或其他与本任务无关的高级 UX；
- 不写存档迁移、版本兼容或旧字段自动迁移逻辑；结构变化直接同步类型、默认数据和测试；
- 不把未解决的 resolver 优先级用“先复制一份看起来能跑”的方式掩盖；遇到语义冲突必须停在 P2 闸门并补 ADR/任务裁定。

## 六、测试与验收

### P0 必测

- `tests/ui/`：`renderUserThemeEditor()` 不包含 Manager shell/Dialog；Manager/Dialog overlay renderer 输出 body-level 专用 root 所需节点；
- `tests/ui/`：Manager 与 Dialog 是 overlay root 的兄弟，不是 Inspector/Manager 后代；关闭父级 session 后两个 overlay 都被清理；
- `tests/ui/`：父 Modal body refresh 后 Manager shell、Dialog shell、list scroll container 和 open target 保持；无重复事件绑定；
- `tests/ui/`：target switch 复用 Manager shell，reorder 复用 row，Dialog input 不替换 form/field/focus/selection；
- `tests/ui/`：Escape、Cancel、dirty guard、Save、父级关闭的生命周期和焦点回收；
- Edge：主题编辑器、Manager、Dialog 的实际遮挡关系、overflow、z-index、窄屏、全局背景/面板/按钮/Tab/卡片/气泡/状态表现。

### P1 必测

- global 不存在于 draft 时编辑器无默认 global host 卡片，但运行时仍有默认背景；
- 目标候选器在 global 未配置时允许加入，加入后 host 存在但 `layers`/`layerOrder` 未定义；重复加入被屏蔽；
- 首次图层 mutation 才 materialize，Cancel/查看/打开 Manager/关闭选择器不 materialize；
- global、Host default、Host active/inactive/disabled 的 target key 不冲突，状态切换不复用旧层引用；
- 清除 global/Host 最后覆盖后正确回退，系统虚拟层不可删除，order 与视觉顺序一致。

### P2 必测

- 旧 UserThemeDraft 背景字段不再有新写入；新 global host 的 preview、保存、重开和运行时渲染结果闭环；
- `ThemeDef.background` 基础背景未被误删，global host 缺失/继承/覆盖三种结果可区分；
- 系统颜色层忽略只影响绘制与合成，不改变 token、文字判别和头像颜色；
- 全局背景与 Host 背景均使用相同安全解析与 `BackgroundView` renderer；
- `npx tsc --noEmit`、`npm run check:architecture`、专项 Vitest、`npm test`、`npm run build` 全部通过。

若修改 `src/engine/types/theme.ts` 或其他 Schema 来源，必须额外执行 `npm run gen:schema`，并检查生成产物；不得直接编辑生成文件。

建议专项命令：

```text
npx vitest run tests/ui/user-theme-editor-overview.test.ts tests/ui/user-theme-editor-layer-order.test.ts tests/ui/user-theme-editor-overlay.test.ts tests/engine/user-theme-layer-service.test.ts tests/engine/user-theme-service.test.ts tests/ui/presentation-service.test.ts tests/ui/background-service.test.ts
npx tsc --noEmit
npm run check:architecture
npm test
npm run build
```

命令中的新测试文件可以按实际拆分调整，但验收项不能删减；未实际执行的命令不得在文档中标记为通过。

## 七、Luna 执行协议

为避免低上下文执行错误，执行者必须遵循：

1. 先阅读本任务、Task0049、`docs/docs-828/00-INDEX`、`docs/docs-828/05-conventions/architecture-discipline`、`docs/docs-828/05-conventions/testing`，再开始改代码；
2. 先完成 P0-A/B/C 并运行 P0 专项测试；P0 未通过时不得修改 global runtime 存储；
3. 每个子切片只处理本文列出的文件职责；发现需要新模型、迁移或 Parent/Cluster 改造时停止并回写任务，不得自行扩 scope；
4. 任何 `renderUserThemeEditor()`、`ctrl.modal.open()`、`innerHTML` 变更都必须同步检查 DOM identity、事件重复绑定和 parent-close cleanup；
5. 任何 `ThemeLayerTargetRef`、`UserThemeDraft`、`ThemeDef` 字段变更都必须同步所有消费者、测试和 Schema 协议；
6. 不以“测试能过”替代 Edge 视觉验收；overlay 的真实父子关系、遮挡、滚动和焦点必须在浏览器中验证；
7. P2 resolver 优先级若无法从现有源码、ADR 和测试明确推出，保持阻断并请求裁定，不要猜测实现。

## 八、当前核验（2026-09-13）

- [x] 已阅读 `docs/docs-828/00-INDEX`、`docs/plan-work/00-index` 与 `docs/docs-828/05-conventions/doc-maintenance`；
- [x] 已核对 Task0049、roadmap-0010/0011/0012/0013/0014、ADR-0006 的现行边界；
- [x] 已对照 `main` 当前提交核查 Inspector renderer、Layer Manager renderer、Controller 绑定、ModalManager、UserThemeService、UserThemeLayerService、Theme Runtime、背景/表现服务和 UI Host Registry；
- [x] 已确认 Sol 修正中的 overlay 根因、Modal 单槽约束、global 双管线、global 默认卡片和 `layers: []` materialize 问题；
- [x] 已确认 Sol 建议中“保留 background-service”、复用已有 `enabled`/stable ID/materialize 基线的部分；
- [x] 已完成优先级裁定：P0 浮窗结构阻断，P1 编辑器 global 语义，P2 runtime/storage 统一且需架构闸门；
- [x] 已执行全量测试、类型检查、架构检查和构建；
- [ ] 专项 overlay 行为测试实际不存在（`tests/` 中无 `*overlay*` 测试文件，也无 dialog 选择器断言），字符串断言不能作为功能可用证据，详见 [[task-0051-user-theme-layer-editor-functional-recovery]] §三 根因 E。

## 九、剩余工作

代码施工、P0/P1、global runtime 接线和工程检查已完成；剩余仅为当前环境无法取得浏览器状态的 Edge 视觉回归。Task0049 的首轮实现和历史检查不作为本任务验收依据。

## 十、相关路由

- [[task-0049-user-theme-background-layer-manager]]
- [[task-0048-workspace-theme-restructure-and-editor]]
- [[roadmap-0010-presentation-layer-service]]
- [[roadmap-0011-ui-component-layer-backgrounds]]
- [[roadmap-0012-flat-presentation-targets]]
- [[roadmap-0013-presentation-editor-ux]]
- [[roadmap-0014-theme-editor-convergence]]
- [[adr-0006-ui-background-layering]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
