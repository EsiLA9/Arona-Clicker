# task-0053 — 图层编辑交互缺陷修复

状态：🟡 代码与测试已完成；Edge 验收待补（当前环境无法取得浏览器状态）

> 承接 [[docs/plan-work/active/task-0052-user-theme-layer-overlay-presentation]]。0051 恢复功能可用性、0052 处理表现层；本任务修复操作过程中暴露的三个交互缺陷，并裁定「删除最后一层」的回退语义。
>
> 核查基准：2026-09-13 当前工作树。

## 一、目标与完成定义

1. 保存图层后不再弹出「放弃当前图层修改吗？」；保存后的关闭不询问放弃；
2. 在无本地覆盖的回退视图中，系统颜色层显示在列表末尾（视觉最底）；
3. 删除最后一层后清除本地覆盖并回退到系统/父级表现，不再留下不可见内容的空覆盖；
4. 删除/隐藏后，被复用行的行级状态（隐藏弱化、隐藏/显示图标）与真实数据一致；
5. 打开目标编辑时不改变继承背景的可见结果：系统颜色层始终位于继承层之下，不再遮挡主题自带默认背景层；
6. Dialog 编辑实时预览，且不写入会话 draft，取消后恢复编辑前内容；
7. 主题浮窗「层级优先级」在无法使用拖拽的环境（触屏、远程桌面、自动化）也能调整顺序。

## 二、范围与非目标

### 包含

- `src/ui/controller-modals.ts` 的 `closeDialog` 确认语义、删除分支、行级 class 同步；
- `src/arona-clicker/services/user-theme-layer-service.ts` 新增 `clearTargetOverride()`；
- `src/ui/components/user-theme-layer-manager.ts` 回退视图的层排序；
- 定向测试新增。

### 不包含

- 目标引用协议统一（Task0050 P1-B）、resolver 重写；
- 其余 Task0050 未完成切片（P0-B / P0-C / P1-A 剩余 / P2）。

## 三、缺陷与根因

### 3.1 保存时误弹「放弃当前图层修改吗？」

`closeDialog()` 原先没有区分「保存完成」与「用户主动关闭」，只要 `ui.dirty` 为真就确认。修复后签名：

```554:560:src/ui/controller-modals.ts
  const closeDialog = (skipConfirm = false): void => {
    if (!skipConfirm && ui.dialogDraft && ui.dirty && !window.confirm('放弃当前图层修改吗？')) return;
```

而保存路径先写 draft 再调 `closeDialog()`，此时 `ui.dirty` 仍为 true，因此每次保存都会弹一次放弃确认；若用户点「取消」，`closeDialog` 提前 return，Dialog 不关闭且表单不清空（但数据已保存）。

同类问题还有两处**双重确认**：`openManager` 的目标切换与 Manager 关闭按钮已各自确认过一次，随后又调用带确认的 `closeDialog()`。

修复：`closeDialog(skipConfirm = false)`；保存、切换目标、关闭 Manager 三条路径显式传 `true`，`×`/取消/Escape 保持确认。

### 3.2 回退视图中系统颜色层位置错误

展示顺序为「顶 → 底」，实现依赖 `entries.reverse()`。两条分支对系统层的处理不一致，修复后（原先该分支使用 `push`）：

```40:44:src/ui/components/user-theme-layer-manager.ts
  if (!local) {
    const entries: LayerManagerEntry[] = layers.map((layer, sourceIndex) => ({ system: false, layer, sourceIndex }));
    if (target.kind === 'global') entries.unshift({ system: true });
    return entries.reverse();
  }
```

- 无本地覆盖（回退视图，原先用 `push`）：系统层经 `reverse()` 后落在展示索引 0，即**显示在最上方**；
- 有本地覆盖：`layerOrder` 中系统层被 `unshift` 到存储索引 0（最底），`reverse()` 后显示在最下方，正确。

修复：回退分支改用 `unshift`，与存储侧语义一致。系统层的展示索引随之变为末尾，其「上移/下移」按钮的 disabled 状态自动正确。

### 3.3 删除图层后「丢失图片/内容」

两条机制同时存在：

- **机制 A（主因）**：`removeTargetLayer` 删掉最后一层后留下 `layers: []`。按 Task0050 §3.3，`host.layers = []` 表示「用户明确建立了空的本地图层覆盖」，运行时因此不回退，`background-service` 用默认渐变兜底，用户已配置的图片/渐变背景整体消失。
- **机制 B（次因）**：`reconcileList` 复用节点时原先只同步 `innerHTML`，行级 `class`（`is-hidden`）不同步。修复后：

```526:531:src/ui/controller-modals.ts
      if (current !== node) list.insertBefore(node, current ?? null);
      if (node !== next) {
        if (node.className !== next.className) node.className = next.className;
        if (node.innerHTML !== next.innerHTML) node.innerHTML = next.innerHTML;
      }
```

因此删除或隐藏后，被复用行的「已隐藏」弱化与图标可能残留旧状态。

修复：机制 A 按 §四 的裁定处理；机制 B 增加 `className` 同步。

### 3.4 预览层遮蔽继承背景（加入目标后「默认图层不渲染」）

`setUserThemePreview` 在目标没有本地图层时，只推送系统颜色层、且**不提供顺序**：

```ts
      background: globalHost?.layers ? [systemColorBackground(), ...globalHost.layers] : [systemColorBackground()],
      backgroundLayerOrder: globalHost?.layerOrder?.length ? globalHost.layerOrder : [SYSTEM_COLOR_BACKGROUND_ID],
```

`theme-runtime` 的 `mergeBackground` 对**新 id 一律追加到数组末尾**，而数组顺序即绘制层级（后者更靠前）。系统颜色层又是不透明渐变（`linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)`）。因此加入「全局背景」目标后，预览层把自己的系统颜色层追加到最顶，**遮住主题自带的默认背景层**；手动编辑一次会触发 materialize，把默认层写进 draft 并带回 `layerOrder`，顺序才恢复——这就是「必须编辑一下才渲染」的原因。

修复：预览层始终提供顺序，无用户 order 时把系统颜色层钉在首位；`applyUserTheme` 同样兜底，避免「已保存但不含图层的用户主题」出现同一遮蔽。

### 3.5 Dialog 编辑缺少实时预览

`form` 的 `input` 处理只修改 `ui.dialogDraft` 并置 dirty，从不触发预览，只有保存时才 `preview()`。这与 Task0049 §5.10 的契约不符（应按 RAF 合并实时预览，且不污染 session draft）。

修复：新增 `withPreviewLayer(draft, target, layerId, layer)` 生成只读临时 draft，Dialog 输入经 RAF 合并后走预览通道；关闭/取消时取消挂起帧并恢复 session draft 的预览。

### 3.6 新建图层未 materialize，继承层在数据层丢失

controller 的编辑/删除/排序/隐藏路径都有首次 mutation 的 materialize，**只有新建路径没有**：

```ts
    if (ui.dialogLayerId) {
      if (!hasLocalTarget(session.draft, ui.dialogTarget)) materializeTargetLayers(session.draft, ui.dialogTarget, resolvedLayersForTarget(ctrl, ui.dialogTarget));
      updateTargetLayer(session.draft, ui.dialogTarget, ui.dialogLayerId, ui.dialogDraft);
    } else {
      if (!hasLocalTarget(session.draft, ui.dialogTarget)) materializeTargetLayers(session.draft, ui.dialogTarget, resolvedLayersForTarget(ctrl, ui.dialogTarget));
      addTargetLayer(session.draft, ui.dialogTarget, ui.dialogDraft);
    }
```

`addTargetLayer` 写入的是「本地层 + 新层」，而本地层此时为空，所以新建后 `host.layers = [新层]`——原先靠继承呈现的默认背景层**在数据层消失**，只剩新层与系统颜色层；删掉新层后 `clearTargetOverride` 触发回退，内容才回来。这违反 Task0049 §5.6 的 materialize 契约，新建路径一直是漏的。

### 3.7 global 回退来源在空数组上短路

```ts
  if (hostId === 'global') {
    const layers = runtime.presentation?.hosts?.find(item => item.id === 'global')?.layers;
    return layers?.length ? layers : runtime.background;
  }
```

原写法 `?.layers ?? runtime.background` 在 `layers` 为**空数组**时不会回退（`[]` 非空值），于是运行时 `hosts['global'].layers = []` 会让编辑器回退视图与 materialize 来源同时取到空集合，进一步放大 3.6 的症状。改为按长度判断，空数组回退到 `runtime.background`。

### 3.8 主题浮窗「层级优先级」只有拖拽入口

`renderLayerOrderSection()` 的排序完全依赖 HTML5 DnD（`dragstart` / `dragover` / `drop`），没有按钮或键盘替代。DnD 在触屏、远程桌面与自动化环境中无法可靠触发，实际表现就是「无法进行顺序调整」。

经核查，数据链路本身是通的：`setThemeLayerOrder` → `state.themeLayerOrder` → `syncPlayerThemeFromState` → `runtime.setLayerOrder`，拖拽与按钮走同一条落库路径。

修复：每行补上移/下移按钮（`data-theme-layer-order-move` + `-scope`），按展示索引设置边界 disabled，与拖拽等价。

同轮核查：图层 Manager 的上移/下移（`data-theme-layer-move`）链路正常，新增行为测试锁定，未做改动。

## 四、语义裁定：删除最后一层即回退

采用**方案 1**：删除某目标的最后一层后，自动清除该目标的本地覆盖（等价于点击「清除本地覆盖」），运行时回退到系统/父级表现。

- 与 Task0049 §5.12「删除最后一个本地图层后应说明已回退」的意图一致；
- `host.layers = []`「显式空覆盖」的语义保留在数据层，但不再由「删除最后一层」这条操作路径自动产生（仅 `materializeTargetLayers` 在回退层为空时可能写入）；
- 用户可见影响：删除最后一层的表现从「背景变为默认渐变」改为「回到继承表现」；
- 实现落在 service 的 `clearTargetOverride()`，controller 的「清除本地覆盖」按钮改为复用它，消除原先散落在 controller 的相同逻辑。

## 五、施工切片

### P0：确认语义与顺序

- [x] `closeDialog(skipConfirm)`；保存 / 切换目标 / 关闭 Manager 三处传 `true`，消除双重确认；
- [x] `×` 与「取消」改为 `() => closeDialog()` 以匹配 listener 签名；
- [x] 回退视图系统层 `push` → `unshift`。

### P1：删除回退与行状态

- [x] service 新增 `clearTargetOverride(draft, target)`（含 host 记录清理）；
- [x] 删除分支：仅在 `removeTargetLayer` 返回 true 且层数为 0 时清除覆盖，避免误删「已加入但未配置」的目标；
- [x] 「清除本地覆盖」按钮改用 `clearTargetOverride`；
- [x] `reconcileList` 同步行级 `className`。

### P2：测试

- [x] 保存不再触发确认（对 `confirm` 计数断言为 0）；
- [x] 删除最后一层后进入回退视图（出现回退提示、被删层消失）；
- [x] 回退视图中系统颜色层位于展示列表末尾；
- [x] 删除一层后复用行的 `is-hidden` 与 `data-theme-layer-next-enabled` 与模板一致。

### P3：预览顺序与实时预览

- [x] `setUserThemePreview` / `applyUserTheme` 的 `backgroundLayerOrder` 兜底，把系统颜色层钉在继承层之下；
- [x] service 新增 `withPreviewLayer()`：临时替换/追加单层，不写回会话 draft；
- [x] Dialog 输入经 `requestAnimationFrame` 合并后实时预览；关闭/取消取消挂起帧并恢复 session draft 预览；
- [x] 测试：`theme-runtime`（系统层固定在最底、含本地层时仍在自定义层之下）、`user-theme-layer-service`（`withPreviewLayer` 不写回、`clearTargetOverride`）、dialog（输入即时预览 + 取消恢复）。

### P4：新建图层与回退来源

- [x] 新建图层的保存路径补齐首次 materialize，继承层不再在数据层丢失；
- [x] `resolvedLayersForTarget` 的 global 分支按长度判断，空数组回退到 `runtime.background`；
- [x] 测试：新建后继承层仍在并列于新层；删除单层不丢失其余层；删除目标唯一层后清除本地覆盖；清除本地覆盖回到回退视图。

### P5：主题浮窗层级优先级的按钮入口

- [x] 层级优先级行增加上移/下移按钮与边界 disabled；
- [x] controller 绑定点击排序，与拖拽共用 `setThemeLayerOrder` 落库链路；
- [x] 按钮样式（20×20 小尺寸、禁用态）；
- [x] 测试：点击下移后展示序与 `state.themeLayerOrder` 同步变化；图层 Manager 上移/下移行为测试。

## 六、测试与验收

```text
npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts tests/ui/user-theme-editor-layer-order.test.ts
npx tsc --noEmit
npm run check:architecture
npm test
npm run build
```

### Edge 验收（未执行）

> 当前环境无法取得浏览器状态，本节全部项目保持未验收。

- 保存图层后 Dialog 直接关闭、无任何确认弹窗；
- 回退视图中系统颜色层位于列表底部，上移/下移按钮状态正确；
- 删除最后一层后页面背景回到继承表现，而不是默认渐变；
- 隐藏某层后删除其他层，被隐藏行的弱化与图标保持正确；
- 加入「全局背景」目标并打开 Manager 时，主题自带的默认背景层立即可见，无需先编辑一次；
- Dialog 中改颜色/透明度/缩放时页面背景实时变化，取消后回到编辑前表现；
- 新建图层后，原有的背景内容（继承层）仍在，且与新层同时渲染；删除新层后其余层不受影响；
- 主题浮窗「层级优先级」用 ↑↓ 按钮调整后，应用中的主题色与区域归属随优先级变化。

## 七、当前核验（2026-09-13）

实际执行：

- [x] `npx vitest run tests/engine/theme-runtime.test.ts tests/engine/user-theme-layer-service.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts`：3 文件 / 59 tests passed；
- [x] `npx tsc --noEmit`：通过（exit 0）；
- [x] `npm run check:architecture`：通过；
- [x] `npm test`：145 个测试文件、1348 个测试全部通过（施工前 1334）；
- [x] `npm run build`：通过。

未执行：

- [ ] Edge 视觉与交互验收（见上）。

## 八、剩余工作

**已核实：materialize 不存在「过滤结果固化导致丢层」的结构性风险。**

`colorSystem.runtimeTheme()` 返回 `ResolvedTheme`（`src/engine/core/theme-runtime.ts:109`），其 `presentation` 字段类型是 `PresentationDef`，`hosts` 为 `PresentationHostDef[]`（`src/engine/types/theme.ts:199`）——保存的是**原始图层定义**（含 `enabled` 与原始 `value`），不经过 `presentation-service` 的 `layerView` / `imageView` 过滤。

因此 `resolvedLayersForTarget` 作为 materialize 的来源不会丢层；`layerView` 对 `enabled === false` 与未解析图片层的过滤只作用于**渲染**，属设计意图。本文初稿曾把该路径记为数据级风险，经源码核实后更正。

本任务剩余仅为 Edge 视觉与交互验收（见 §六）。

## 九、相关路由

- [[docs/plan-work/active/task-0052-user-theme-layer-overlay-presentation]]
- [[docs/plan-work/active/task-0051-user-theme-layer-editor-functional-recovery]]
- [[docs/plan-work/active/task-0050-user-theme-layer-overlay-and-global-target-convergence]]
- [[docs/plan-work/active/task-0049-user-theme-background-layer-manager]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/plan-work/00-index]]
