# task-0051 — 用户主题图层编辑器功能恢复

状态：🟡 代码与自动化测试已完成；Edge 视觉/交互验收待补（当前环境无法取得浏览器状态）

> 本文承接 [[docs/plan-work/active/task-0050-user-theme-layer-overlay-and-global-target-convergence]]。Task0050 的 P0-A 结构（body-level overlay）已落地，但只读核查确认：Layer Editor Dialog 的保存/取消/关闭按钮、标题更新与 global 图层入口在当前工作树中不可用，Task0050 §六 的 overlay 行为测试实际不存在。
>
> 本文只做**功能恢复**：修查询根、接上已算出的初值、恢复 global 入口、补行为测试。不改 overlay 架构、不做目标引用统一、不进入 P2 resolver。
>
> 核查基准：2026-09-13 当前工作树（Task0050 P0-A 部分完成后）。

## 一、目标与完成定义

### 目标

恢复「主题 Inspector → Layer Manager → Layer Editor Dialog → session draft → Preview」的最小可用闭环，使 Task0050 P0-A 已建立的 body-level overlay 真正可操作。

### 完成定义

1. Layer Editor Dialog 的「保存图层」「取消」「×」和标题随 `create`/`edit` 更新均可用；
2. 点击 Manager 行的「编辑」后，Dialog 显示的是该行对应的 `target + layerId` 的层数据；
3. Dialog 保存后，改动写入当前 session draft 的对应 `target/state/layerId`，并触发 Preview 与 Manager 行刷新；
4. Manager 打开时能看到当前目标的**当前有效图层**（有本地覆盖显示本地层，无覆盖显示 resolved 回退层），不再默认显示"当前没有本地图层"；
5. global 目标在 Inspector 中有可用的「管理图层」入口，且不混入宿主专属控件（状态切换、形状、装饰线、文字颜色）；
6. 新增的行为测试覆盖第 1–3 条；字符串断言不再作为 overlay 可用性的证据。

## 二、范围与非目标

### 包含

- `controller-modals.ts` 中 Dialog 相关节点的查询根修正；
- `renderLayerManagerShell` 的初值/回退层传递；
- `renderTargetSummary` 死代码的接上或删除；
- `stripLegacyGlobalCard` 的移除与 global 入口的正常渲染；
- global 在 `resolvedLayersForTarget` 中的回退一致性；
- 上述 4 项的 jsdom 行为测试。

### 不包含（见 §六 禁止事项）

- `ThemeLayerTargetRef` 从 `kind: 'global' | 'host'` 统一为 `hostId + state`（属 Task0050 P1-B，未完成）；
- `UserThemeDraft.background/backgroundLayerOrder` 撤销与统一 resolver（属 Task0050 P2，有架构闸门）；
- `ModalManager` stack 化、overlay 退回 Inspector 内、`background-service.ts` 替换；
- Task0049 已完成的 stable ID、`enabled`、materialize、order 语义。

## 三、故障调用链（只读核查结论）

### 3.1 症状 → 根因对照

| 用户可见症状 | 根因 | 代码位置 |
| --- | --- | --- |
|「保存图层」点了没反应，图层存不进去 | A | `src/ui/controller-modals.ts:605` |
|「取消」「×」点了没反应，只能按 Escape | A | `src/ui/controller-modals.ts:582-583` |
| Dialog 标题永远是「编辑图层」，不显示新增/编辑 | A | `src/ui/controller-modals.ts:543` |
| Manager 打开后显示"当前没有本地图层"，看不到当前生效层 | B | `src/ui/components/user-theme-layer-manager.ts:85` |
| Manager 初始标题是"选择表现目标" | B | `editor-overlay-host.ts:8-10` + `controller-modals.ts:481` |
| 全局背景没有「管理图层」按钮 | C | `src/ui/components/user-theme-editor.ts:113-117` |
| 全局目标出现状态/形状/装饰/文字颜色等宿主控件 | D | `src/ui/components/user-theme-editor.ts:181-190` |
| 同一 global 目标经两个入口得到不同的"当前层" | D | `src/ui/controller-modals.ts:462-467` |

### 3.2 根因 A：Dialog 存在，但按钮与标题从未被绑定

Task0050 P0-A 把 Dialog 从 Manager 的内部节点改为 body 级**兄弟节点**：

```14:16:src/ui/editor-overlay-host.ts
  root.dataset.sessionId = sessionId;
  root.innerHTML = `${renderLayerManagerShell(ctx, draft, active, initialTarget)}${renderLayerEditorDialogShell(active)}`;
  document.body.appendChild(root);
```

但 controller 中四处查询根仍是 `shell`，而 `[data-theme-layer-editor-dialog]` 不在 shell 内：

| 行号 | 当前代码 | 结果 |
| --- | --- | --- |
| `controller-modals.ts:543` | `shell.querySelector('[data-theme-layer-dialog-title]')` | `null`，标题不更新 |
| `controller-modals.ts:582` | `shell.querySelector('[data-theme-layer-dialog-close]')` | `null`，关闭无事件 |
| `controller-modals.ts:583` | `shell.querySelector('[data-theme-layer-dialog-cancel]')` | `null`，取消无事件 |
| `controller-modals.ts:605` | `shell.querySelector('[data-theme-layer-dialog-save]')` | `null`，保存无事件 |

对照：`form` 用的是 `overlay.querySelector`（`controller-modals.ts:488`），因此表单输入、`ui.dirty`、焦点均正常——表现为"输入能改、保存无效"。四处均使用 `?.` 可选链，失败静默，运行时不报错。

Manager 行的「编辑」按钮链路**本身正确**，已显式传参：

```560:562:src/ui/controller-modals.ts
    if (ui.dialogDraft && ui.dirty) return;
    const layers = hasLocalTarget(session.draft, ui.target) ? getTargetLayers(session.draft, ui.target) : resolvedLayersForTarget(ctrl, ui.target);
    if (button.dataset.themeLayerEdit) { openDialog(ui.target, id, 'edit'); return; }
```

`openDialog` 也已正确写入 `ui.dialogTarget / ui.dialogLayerId`（`controller-modals.ts:537-546`）。**断裂点在 Dialog 自身的节点查询，不在 target 传递。**

### 3.3 根因 B：Manager 首屏恒空，且 `initialTarget` 契约从未被接上

`renderLayerManagerShell` 的初始 list 传参是恒空表达式，resolved 回退层永远不渲染：

```85:85:src/ui/components/user-theme-layer-manager.ts
    <div class="theme-layer-manager-list" data-theme-layer-manager-list>${renderLayerManagerList(ctx, draft, initialTarget, active, initialTarget ? [] : [])}</div>
```

上游算出了初值却整段丢弃（`initialTarget` 为死代码）：

```134:142:src/ui/components/user-theme-editor.ts
function renderTargetSummary(ctx: UIContext, draft: UserThemeDraft, presentation: NonNullable<UserThemeDraft['presentation']>): string {
  const configured = presentation.hosts ?? [];
  const cards = configured.length ? renderHostTargets(ctx, presentation, true) : '<p class="modal-empty">暂无已配置的个性化表现目标。可从下方加入目标。</p>';
  const firstHost = configured[0];
  const initialTarget: ThemeLayerTargetRef = firstHost
    ? { kind: 'host', hostId: firstHost.id, state: hostStateForRender.get(firstHost.id) ?? 'default' }
    : { kind: 'global' };
  return cards;
}
```

唯一调用点不传该参数：

```481:481:src/ui/controller-modals.ts
  const overlay = ensureUserThemeLayerOverlay(createUIContext(ctrl.game), session.id, session.draft, active);
```

而 overlay root 按 session 复用，创建后不再接受新初值：

```9:10:src/ui/editor-overlay-host.ts
  const existing = roots.get(sessionId);
  if (existing?.isConnected) return existing;
```

叠加效果：Manager 初始标题为"选择表现目标"、列表为"选择一个表现目标开始管理图层。"，`ui.target` 只能靠点击卡片按钮设置，否则所有行操作被 `controller-modals.ts:556` 的 `!ui.target` 短路。

### 3.4 根因 C：global 入口被字符串后处理删除

`renderUserThemeEditor` 的返回表达式被包在字符串后处理里（调用点 `src/ui/components/user-theme-editor.ts:103`），该处理对整个 HTML 做渲染后正则删除：

```113:117:src/ui/components/user-theme-editor.ts
function stripLegacyGlobalCard(html: string): string {
  return html
    .replace(/<details class="user-theme-target-card user-theme-global-card"[\s\S]*?<\/details>/, '')
    .replace('<div class="user-theme-target-levels">', '<div class="user-theme-target-levels"><button type="button" class="user-theme-token-clear" data-theme-editor-target-level="global" data-user-theme-target-level="global">全局</button>');
}
```

被删除的块内包含 global 的**唯一**入口：

```130:132:src/ui/components/user-theme-editor.ts
function renderBackgroundLayers(ctx: UIContext, layers: readonly BackgroundLayerDef[], active: boolean): string {
  return `<button type="button" class="user-theme-token-clear user-theme-layer-manager-open" data-theme-layer-manager-target-kind="global" ${active ? '' : 'disabled'}>管理图层 <span>${layers.length} 层</span></button>`;
}
```

全仓库仅两处产出 `data-theme-layer-manager-target-kind`（`user-theme-editor.ts:131` 的 global、`:190` 的 host），前者被删除后 `renderBackgroundLayers()` 成为死代码；「全局」level 按钮是字符串注入而非渲染产物。

结论：Task0050 P1-A 勾选的"移除固定 global card"**并未真正移除代码**，而是用渲染后正则删除伪装；这一处必须作为反面模式记录，不得再用同类补丁。

### 3.5 根因 D：global 语义错位（本任务只修回退一致性，不做协议统一）

从 host 卡片进入的 global 目标是 `{ kind: 'host', hostId: 'global' }`，不进 `runtime.background` 回退：

```462:467:src/ui/controller-modals.ts
function resolvedLayersForTarget(ctrl: UIController, target: ThemeLayerTargetRef): readonly BackgroundLayerDef[] {
  const runtime = ctrl.game.colorSystem.runtimeTheme();
  if (target.kind === 'global') return runtime.presentation?.hosts?.find(item => item.id === 'global')?.layers ?? runtime.background;
  const host = runtime.presentation?.hosts?.find(item => item.id === target.hostId);
  if (!host) return [];
```

同时 global 作为普通 host 会走 `renderHostSummary`，混入状态切换、形状、装饰线、文字颜色等宿主专属控件（`user-theme-editor.ts:181-190`）。

### 3.6 根因 F：Inspector「管理图层」入口在父级重建后失去绑定（施工中新增发现）

`bindUserThemeLayerManager` 原先把 Inspector 卡片按钮的绑定放在 `layerManagerBound` 短路之后。父级 `refreshUserThemeEditor()` 每次都会重建 Inspector DOM，新生成的按钮不再有监听，而 shell 的短路标记已置位，函数会直接返回。

后果：首次打开编辑器时目标列表为空，第一次绑定相当于空绑定；用户加入目标后卡片按钮出现，但点击没有任何反应。这解释了"按钮渲染出来却点不动"，是 Task0050 P0-A 遗留的第二个结构性缺陷，也说明只修查询根不足以恢复功能。

修复方式：`ui` 状态改为按 overlay 缓存的单例（`WeakMap`），modal 级卡片按钮绑定移出 shell 短路、每次重渲染都重新绑定；shell 内部绑定仍只执行一次。

### 3.7 根因 E：测试缺口（为什么"专项测试通过"仍不可用）

- `tests/` 下不存在任何 `*overlay*` 测试文件；
- `theme-layer-dialog-save`、`theme-layer-dialog-title`、`theme-layer-dialog-cancel`、`editor-overlay-host`、`theme-layer-manager-target-kind` 在 `tests/` 中检索结果为 0；
- 现有 `tests/ui/user-theme-editor-layer-order.test.ts` 全部为字符串断言（如 `expect(html).not.toContain('data-theme-layer-manager-shell')`），对"事件是否绑定到正确节点"无感知；
- `stripLegacyGlobalCard` 的字符串后处理恰好让上述断言通过。

因此 Task0050 §八 "已施工并执行专项测试" 不能作为功能可用证据；本任务必须补行为级测试。

## 四、最小补丁

范围：3 个源文件 + 1 个测试文件。按 P0 → P1 → P2 顺序执行；P0 可单独作为一个 Unit 先行验证恢复。

### P0：恢复 Dialog（阻断项）

- [x] `src/ui/controller-modals.ts` 的 Dialog 标题查询根 `shell` → `dialog`；
- [x] 同文件关闭、取消查询根 `shell` → `dialog`；
- [x] 同文件保存查询根 `shell` → `dialog`；`:488` 的 `form` 查询根保持 `overlay`（原本正确）；
- [x] 额外修复根因 F：`ui` 状态改为按 overlay 缓存的单例（`WeakMap`），Inspector 卡片按钮绑定移出 shell 短路、每次重渲染重新绑定；
- [x] 补行为测试 `tests/ui/user-theme-layer-editor-dialog.test.ts`：标题随模式更新、取消不写入、保存写入并刷新列表、编辑回填、重建后入口仍可点击。

验收：`npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts`（新文件，名称可调整）通过；Edge 中保存图层后 Manager 行与 Inspector 摘要同步更新。

### P1：恢复 Manager 信息

- [x] `renderLayerManagerShell` 增加 `resolvedLayers` 参数并透传，删除 `initialTarget ? [] : []` 恒空表达式；
- [x] controller 在 bind 时自行计算首个目标，并把它与 resolved 层一起传入 overlay；`renderTargetSummary` 的死代码删除；
- [x] `resolvedLayersForTarget` 统一 `hostId === 'global'` 走 `runtime.background` 回退，消除同目标两结果。

验收：无本地覆盖的目标打开 Manager 后能看到回退层与提示文案；有本地覆盖时显示本地层。

### P2：恢复 global 入口

- [x] 删除 `stripLegacyGlobalCard` 与其调用点、hardcode global card 与已死的 `renderBackgroundLayers`；
- [x] 新增 `TARGET_LEVELS` / `TARGET_LEVEL_LABELS`，「全局」level 按钮改为正常渲染，不再字符串注入；
- [x] global 经目标摘要统一提供「管理图层」入口，按钮输出 `data-theme-layer-manager-target-kind="global"`；
- [x] `renderHostSummary` 对 `host.id === 'global'` 使用 `{ kind: 'global' }` 引用，并跳过状态切换、形状、装饰线、文字颜色等宿主专属控件（最小特判，未做协议统一）。

验收：Inspector 存在可用的 global 入口；global 卡片不出现宿主专属控件；从该入口进入 Manager 后回退层读取与 `kind: 'global'` 一致。

## 五、禁止顺手重构项

1. **不统一目标引用协议**：`ThemeLayerTargetRef` 的 `kind: 'global' | 'host'` 与 `hostId + state` 终态统一属 Task0050 P1-B，涉及 `targetRefKey`、DOM key、事件 dataset、resolver 与全部调用方，必须独立切片；
2. **不进入 P2 架构闸门**：不改 `normalizePresentationDraft()` 的 global 迁出行为，不动 `UserThemeDraft.background/backgroundLayerOrder`，不建统一 `ThemeTargetResolver`；
3. **不改造 Modal 体系**：不改 `ModalManager` 单槽语义，不实现通用 Modal stack，不把 overlay 退回 Inspector 内或改用 `position: fixed` 掩盖父子关系；
4. **不替换背景渲染**：不删除 `background-service.ts`，不新增第二套背景 CSS/代表色解析；
5. **不再使用渲染后字符串补丁**：禁止用正则删除/注入 renderer 输出绕过结构问题（`stripLegacyGlobalCard` 即此类反例）；结构问题必须在 renderer 内条件渲染解决；
6. **不放宽验收证据**：不得用字符串断言替代 overlay 行为断言，不得在未实际执行的情况下勾选本任务的测试项；
7. **不重复施工 Task0049 已完成项**：stable ID、`enabled` 隐藏语义、目标级 materialize、order 同步、基础 Dialog 字段均按现状复用。

## 六、测试与验收

### 必测（新增行为测试）

已交付 `tests/ui/user-theme-layer-editor-dialog.test.ts`（7 个用例），覆盖下表中的标题、保存、取消、Manager 初值、global 入口，以及根因 F 的"重建后入口仍可点击"。"回退一致性"未单独断言（`resolvedLayersForTarget` 为模块私有），由 Manager 打开后的列表内容间接覆盖。

| 项 | 断言 |
| --- | --- |
| Dialog 标题 | `edit` 与 `create` 两种模式的标题文本不同且被实际更新 |
| Dialog 保存 | 点击 `[data-theme-layer-dialog-save]` 后，`session.draft` 对应 `target/state/layerId` 被写入；新增模式走 `addTargetLayer` 语义 |
| Dialog 取消/关闭 | 点击 cancel 与 × 后 dialog 隐藏，draft 无变化；dirty 时按既有确认逻辑处理 |
| Manager 初值 | 无本地覆盖目标打开 Manager 后列表非空（显示回退层），标题为对应 target label |
| global 入口 | Inspector 中存在 global 的「管理图层」入口；global 卡片不含状态/形状/装饰/文字颜色控件 |
| 回退一致性 | `{ kind: 'global' }` 与 `{ kind: 'host', hostId: 'global' }` 在无本地覆盖时返回相同 resolved 层 |

### 工程命令

```text
npx vitest run tests/ui/ tests/engine/user-theme-layer-service.test.ts tests/engine/user-theme-service.test.ts
npx tsc --noEmit
npm run check:architecture
npm test
npm run build
```

### Edge 验收（必须实际执行）

> 未执行：当前环境无法取得浏览器状态。本节全部项目保持未验收，不得标记为通过。

- `.editor-overlay-root > .theme-layer-manager` 与 `.editor-overlay-root > .theme-layer-editor-dialog` 为 body 级并列节点；
- 打开 Dialog、修改图层、保存后 Manager 行与 Inspector 摘要立即反映结果；
- 关闭父级主题弹窗后 overlay 节点与事件监听被清理；
- 未实际执行的项不得标记为通过。

## 七、当前事实与代码落点

| 职责 | 文件 | 施工前现状 | 施工结果 |
| --- | --- | --- | --- |
| Overlay 挂载 | `src/ui/editor-overlay-host.ts` | Manager/Dialog 已是 body 级并列节点，初值参数从未被传入 | 增加 `resolvedLayers` 参数并透传 |
| Dialog 事件 | `src/ui/controller-modals.ts` | 四处查询根错误，保存/取消/关闭/标题失效 | 四处查询根改为 `dialog` |
| Manager 初值 | `src/ui/components/user-theme-layer-manager.ts` | 初始 list 恒空（`initialTarget ? [] : []`） | 透传 resolved 层，恒空表达式删除 |
| Inspector 目标渲染 | `src/ui/components/user-theme-editor.ts` | 含 `stripLegacyGlobalCard` 字符串补丁与死代码 | 补丁、死代码与 hardcode global card 删除；global 条件渲染 |
| 回退读取 | `src/ui/controller-modals.ts` | global 双入口结果不一致 | `hostId === 'global'` 同样回退 |
| 卡片按钮绑定 | `src/ui/controller-modals.ts` | 重建 Inspector 后按钮失去监听（根因 F） | `ui` 改为 overlay 级单例，按钮每次重渲染重绑定 |
| 目标注册 | `src/ui/ui-host-registry.ts` | global 已可加入（无 `editable: false`） | 未改动 |
| 图层 draft 操作 | `src/arona-clicker/services/user-theme-layer-service.ts` | 已具备 materialize/ID/order/enabled 能力 | 未改动 |

## 八、当前核验（2026-09-13）

只读核查（已完成）：

- [x] 阅读 Task0050、Task0049 与 `docs/plan-work/00-index`；
- [x] 逐行核对 `editor-overlay-host.ts`、`user-theme-layer-manager.ts`、`user-theme-editor.ts`、`controller-modals.ts`、`ui-host-registry.ts`、`user-theme-layer-service.ts`、`css/background.css`；
- [x] 确认根因 A/B/C/D/E 与证据行号；
- [x] 确认 `tests/` 中不存在 overlay/对话框行为测试，字符串断言无法覆盖事件绑定。

施工与验证（实际执行）：

- [x] `src/ui/controller-modals.ts`：Dialog 四处查询根修正、`resolvedLayersForTarget` 回退统一、初值接入、`ui` 单例化与卡片按钮重绑定（根因 F）；
- [x] `src/ui/editor-overlay-host.ts`、`src/ui/components/user-theme-layer-manager.ts`：`resolvedLayers` 参数透传；
- [x] `src/ui/components/user-theme-editor.ts`：删除 `stripLegacyGlobalCard`、`renderBackgroundLayers`、hardcode global card 与死代码；global 条件渲染与最小特判；
- [x] 新增 `tests/ui/user-theme-layer-editor-dialog.test.ts`（7 个用例）；
- [x] 用户主题相关定向测试：6 个文件，5 passed / 22 tests passed（新文件 7 passed）；
- [x] `npx tsc --noEmit`：通过（exit 0）；
- [x] `npm run check:architecture`：通过；
- [x] `npm test`：145 个测试文件、1331 个测试全部通过（施工前为 144 / 1324）；
- [x] `npm run build`：通过。

未执行（不得视为通过）：

- [ ] Edge 视觉与交互验收（当前环境无法取得浏览器状态）；
- [ ] Task0050 其余切片（见 §九）。

## 九、剩余工作

本任务的代码与自动化验收已完成；剩余为 Edge 视觉/交互验收，以及 Task0050 自身仍未完成的切片：`P0-A` 最后一项（禁止二次 `ctrl.modal.open()`）、`P0-B`（编辑会话所有权与刷新隔离，根因 F 的 sessionId 隔离部分仍待做）、`P0-C`（DOM/CSS 与局部刷新验收）、`P1-A` 剩余两项、`P1-B` 全部、`P2-A` 剩余项、`P2-B` 全部。Task0051 只负责把 P0-A 的结构从"存在但不可用"变为"实际可用"，未改变 Task0050 的架构目标。

Task0050 文首状态与 §八 勾选项已在本次施工开始时同步修正。

## 十、相关路由

- [[docs/plan-work/active/task-0050-user-theme-layer-overlay-and-global-target-convergence]]
- [[docs/plan-work/active/task-0049-user-theme-background-layer-manager]]
- [[docs/plan-work/active/task-0048-workspace-theme-restructure-and-editor]]
- [[docs/plan-work/active/adr-0006-ui-background-layering]]
- [[docs/plan-work/active/roadmap-0012-flat-presentation-targets]]
- [[docs/plan-work/active/roadmap-0013-presentation-editor-ux]]
- [[docs/plan-work/active/roadmap-0014-theme-editor-convergence]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/plan-work/00-index]]
