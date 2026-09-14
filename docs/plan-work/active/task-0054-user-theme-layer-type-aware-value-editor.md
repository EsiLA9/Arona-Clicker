# task-0054 — 用户主题图层类型化参数与解析机制

状态：🟡 代码、自动化验证已完成；浏览器验收仍待收口

> 承接 [[docs/plan-work/active/task-0053-user-theme-layer-interaction-fixes]]。本任务处理「表现类型选择值」与编辑器参数面板、CSS 解析、预览和保存之间的契约。重点解决 `theme-showcase-glow` 等径向渐变在初次编辑时默认值错误、无法实时预览以及保存后颜色丢失的问题。
>
> 核查基准：2026-09-14 当前工作树。

## 一、目标与完成定义

1. 用户选择不同 `kind` 后，只显示该类型适用的参数，不再用线性渐变参数解释径向渐变；
2. 预设图层首次打开编辑时，面板值与实际 CSS 值一致；
3. 编辑、实时预览、保存、取消使用同一份规范化表现数据，不丢失颜色、透明色标、位置或中间色标；
4. 无法结构化解析的 CSS 值仍可通过原始 CSS 文本保留和安全校验；
5. 纯色、线性渐变、径向渐变、重复渐变均有明确的测试和浏览器验收矩阵。

## 二、当前问题基线

当前运行时允许 `linear-gradient`、`radial-gradient`、`repeating-linear-gradient`、`repeating-radial-gradient`，但编辑器的渐变控件统一使用「角度 / 起始色 / 结束色」。这会导致：

- 径向渐变没有角度，首次编辑时出现伪造的默认角度；
- `transparent` 不被颜色提取器当作结束色；
- 中间色标及色标位置无法被独立保存；
- 修改控件后可能按线性渐变方式重写原始径向 CSS；
- 表单初值、预览值和保存值可能来自不同层级，造成“必须编辑并保存一次才恢复”的假修复。

## 三、类型 → 参数 → 解析机制任务表

| 类型选择值 | 用户界面可选参数 | 解析 / 序列化机制 | 预览与保存验收 |
|---|---|---|---|
| `empty` | 无视觉值；可选“参与渲染” | 不解析 CSS；统一生成 `transparent`，保留 `enabled` 语义 | 初次打开不显示颜色控件；保存后仍为空层，不生成默认渐变 |
| `solid` | 颜色值；透明度；缩放；位置；尺寸；重复；混合；附着；旋转；启用 | 颜色 token 解析器支持 `#RGB/#RGBA/#RRGGBB/#RRGGBBAA`、`rgb(a)`、`hsl(a)`、`var(--name)`；原始值作为兜底 | 预设颜色首次打开与实际值一致；修改颜色立即预览；取消不写入；保存不丢失 alpha 或变量值 |
| `gradient / linear` | 方向角或方向关键词；任意数量色标；每个色标的颜色与位置；通用图层参数 | 解析 `linear-gradient(direction, stops...)`；色标顺序、颜色、位置结构化保存，再生成 CSS；保留原始 CSS 作为 fallback | 2/3/多色标均可往返；角度、色标位置、`transparent` 保存后不变；实时预览顺序与保存结果一致 |
| `gradient / radial` | 形状 `circle/ellipse`；尺寸；中心 X/Y；任意数量色标；通用图层参数 | 解析 `radial-gradient(shape size at position, stops...)`；中心、形状、尺寸、色标独立保存；禁止套用线性角度解析 | `theme-showcase-glow` 初次打开显示 `circle`、`78% 18%`、`#fff`、`transparent 46%`；只改任一项即可实时显示；保存后颜色不丢失 |
| `gradient / repeating-linear` | 线性渐变全部参数；重复周期由最后色标位置表达 | 解析 `repeating-linear-gradient(...)`；不能降级成普通线性渐变 | 修改周期或色标后仍保持 repeating 类型；刷新后 CSS 类型不变 |
| `gradient / repeating-radial` | 径向渐变全部参数；重复周期由色标范围表达 | 解析 `repeating-radial-gradient(...)`；不能降级成普通径向渐变 | 修改中心、色标或周期后仍保持 repeating 类型；刷新后不丢失 `transparent` |
| `image` | 图片资源；透明度；位置；尺寸；重复；混合；附着；缩放；旋转；启用 | 不走颜色/渐变解析器；通过 Pic 资源 ID 解析为安全 URL | 切换类型不会残留颜色控件值；预览和保存使用同一图片 ID |

## 四、通用参数面板

以下参数属于所有可渲染背景类型，不应由渐变解析器重复处理：

| 参数 | 建议 UI 控件 | 规范化规则 |
|---|---|---|
| `opacity` | 数字输入 / 滑杆 | 限制在 `0–1` |
| `position` | 文本输入 + 常用预设 | 保留如 `center`、`78% 18%` |
| `size` | 文本输入 + `cover/contain` 预设 | 保留如 `cover`、`auto 92%` |
| `repeat` | 下拉框 | `repeat`、`repeat-x`、`repeat-y`、`no-repeat`、`space`、`round` |
| `blendMode` | 下拉框 | 补齐 `color-dodge`、`color-burn` |
| `attachment` | 下拉框 | `scroll`、`fixed`、`local` |
| `scale` | 数字输入 | 限制在 `0.05–8` |
| `rotation` | 数字输入 | 运行时归一化到 `0–359`；图片或整体层变换使用 |
| `enabled` | 开关 | `false` 只隐藏，不删除数据 |

## 五、建议的数据结构

将 `value: string` 的渐变语义提升为可编辑结构，同时保留 CSS 输出：

```ts
type GradientValue = {
  type: 'linear' | 'radial' | 'repeating-linear' | 'repeating-radial';
  angle?: number;
  shape?: 'circle' | 'ellipse';
  size?: string;
  center?: { x: string; y: string };
  stops: Array<{ color: string; position?: number }>;
  raw?: string;
};
```

施工时需要明确：

- `transparent` 是合法色标，不是颜色拾取器的默认蓝色；
- 未识别的 CSS 片段不得静默替换成默认值；
- 结构化数据无法完整表达时，使用 `raw` 原文并提示“高级 CSS 值”；
- CSS 生成器是唯一的输出入口，预览和保存都调用同一生成器；
- 不编写旧存档迁移，结构变更同步更新测试与默认内容。

## 六、施工切片

### P0：参数契约与类型路由

- [x] 渐变类型先由 CSS 函数识别，不再把径向渐变按线性角度解析；
- [x] 定义纯色 token、透明色标、渐变方向和色标的首轮合法集合；
- [x] 暂不增加 `gradientType` 数据字段，以 CSS 函数名作为兼容的内部类型判别；
- [x] 补齐 `attachment`、`rotation`、完整 blend mode 的 UI 映射。

### P1：解析与序列化

- [x] 新增线性渐变解析器；
- [x] 新增径向渐变解析器；
- [x] 支持多个色标和 `transparent`；
- [x] 增加解析失败时的 raw CSS 兜底，并在面板中提示仅保留原文；
- [ ] 统一运行时安全校验与编辑器校验，避免“表单接受但保存拒绝”。

### P2：类型化编辑面板

- [x] `solid` 保留原始 CSS 颜色值并显示颜色控件；
- [x] `linear` 初步按方向和首尾色标显示；
- [x] `radial` 显示形状、中心点和可表达 `transparent` 的文本色标；
- [x] 完整显示任意数量色标及其位置；
- [x] repeating 类型复用对应的线性/径向参数并保持 repeating 类型；
- [x] image 不显示颜色/渐变控件；
- [x] 保留高级 CSS 原始值编辑入口。

### P3：预览与保存一致性

- [x] 表单初值从解析值读取，不再为径向渐变伪造角度和默认结束色；
- [x] 输入事件只更新 Dialog draft，按 RAF 合并实时预览；
- [x] 取消恢复编辑前的有效层；
- [x] 保存使用与预览相同的更新结果；
- [x] 复用已有继承层、系统颜色层和本地图层顺序测试，类型编辑不直接改写层级数据。

### P4：测试与浏览器验收

- [x] 单元测试覆盖线性、径向、重复径向的首轮解析和值更新；
- [x] 往返测试覆盖 `parse → serialize`；
- [x] Dialog 测试覆盖径向首次编辑参数与既有实时预览/取消/保存链路；
- [ ] Edge 验收覆盖 `theme-showcase-glow` 首次编辑和保存后的颜色持久化；
- [ ] 验收预设图层未编辑时的 swatch、面板初值和实际渲染一致。

## 七、验收矩阵

| 场景 | 预期结果 |
|---|---|
| 打开纯色预设 | 文本值、颜色控件、swatch、页面背景一致 |
| 打开线性三色渐变 | 三个色标及位置完整显示 |
| 打开 `theme-showcase-glow` | 径向形状、中心位置、白色起点和透明终点完整显示 |
| 只修改径向渐变中心点 | 页面立即移动光晕，颜色和透明度不变 |
| 只修改 `transparent` 前的颜色 | 页面立即更新，保存后仍保留透明终点 |
| 从预设直接保存 | 未改参数不发生规范化丢失 |
| 从预设取消 | 页面恢复编辑前的完整图层组合 |
| 切换 `solid → radial` | 只出现径向参数，不残留纯色/线性角度值 |
| 输入无法解析的高级 CSS | 原文保留或明确报错，不静默改成默认值 |

## 八、相关代码与文档

- `src/engine/types/theme.ts`
- `src/ui/background-service.ts`
- `src/ui/presentation-service.ts`
- `src/ui/components/user-theme-layer-manager.ts`
- `src/ui/controller-modals.ts`
- `src/arona-clicker/content/theme-showcase.ts`
- [[docs/plan-work/active/task-0053-user-theme-layer-interaction-fixes]]

## 九、当前核验（2026-09-14）

- [x] `npx tsc --noEmit`
- [x] `npx vitest run tests/ui/theme-layer-value.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts tests/engine/user-theme-layer-service.test.ts`：3 文件 / 38 tests passed
- [x] `npm run check:architecture`
- [x] `npm run build`（仅有既存 chunk size warning）
- [ ] Edge 首次编辑、实时预览、保存后重开验收：当前浏览器状态接口返回 `nodeRepl.fetch request failed`，未取得可操作页面，因此不得视为通过
- [x] `npm test`：146 文件 / 1360 tests passed
- [x] `npm run build`：构建通过；保留既存 chunk size warning

## 十、面板信息架构重排（2026-09-14 追加）

> 承接 Task0053 的 Edge 反馈：弹窗内容混排、窗口过窄导致折叠；主面板直接暴露 CSS 值编辑，用户看不出可填什么；渐变模式缺少颜色入口。本节只调整编辑面板的信息架构与控件形态，不改解析器语义、状态分层与保存链路。

### 10.1 症状与根因

1. 表单是**一列平铺的 `<label>`**，`视觉值` 又被塞进 `user-theme-gradient-colors` 的 3 列网格 —— 原始 CSS 值、方向、色标、位置互相穿插，340px 宽的弹窗里叠在一起；
2. `定位`、`尺寸`、`方向` 是无提示的裸文本输入；径向渐变的尺寸（`closest-side` 等）**没有入口**，只能改原始 CSS；
3. 渐变色标只有文本色值输入，没有颜色拾取器，相比纯色面板看起来「丢了颜色」；
4. `gradientAngle` 写回逻辑是「非 `deg` 结尾就补 `deg`」，`to bottom` 会被拼成 `to bottomdeg`；
5. 切换表现类型时只在值为空才写默认值，`solid → image` 会把旧类型的值带进新类型。

### 10.2 面板结构

改为 4 个分区（`data-theme-layer-form-section` = `basic` / `value` / `geometry` / `render`），每区带标题与一行说明：

| 分区 | 内容 | 控件形态 |
|---|---|---|
| 基本信息 | 名称 / ID、表现类型 | 文本 + 下拉 |
| 视觉值 | 纯色拾取器 / 渐变类型 + 方向或径向参数 + 色标行 / 图片资源 / 空层说明 | 按 `kind` 路由 |
| 尺寸与位置 | 透明度、缩放、定位、尺寸 | 数字 + 预设输入 |
| 混合与附着 | 重复、混合、附着、旋转、参与渲染 | 下拉 + 数字 + 开关 |

- 开放取值（定位、尺寸、方向、径向中心）用 `<input list>` + `<datalist>`：既有枚举候选，也保留直接填写；
- 封闭取值（表现类型、渐变类型、径向形状与尺寸、重复、混合、附着、图片资源）改下拉，选项带中文标签；
- 色标行 `[颜色拾取器][文本色值][位置][删除]`；`＋ 添加色标` 复制末色追加，色标少于 3 个时删除按钮禁用；
- 原始 CSS 值收进 `<details class="theme-layer-advanced">高级：原始 CSS 值`，默认折叠，仅在面板无法表达时使用；
- 弹窗宽度 `340px → 430px`。

### 10.3 行为修正

- 方向写回：纯数字补 `deg`，`to ...` 关键词原样保留；
- 类型切换：`kind` 变化时按新类型写入合法默认值，不带入旧类型值；
- 渐变类型切换：`linear ↔ radial` 经 `convertGradientType()` 保留色标并补齐方向或中心，且切换后重绘表单；
- 面板改写 `value` 后同步回「高级」输入框，避免折叠区与实际值不一致。

### 10.4 切片

- [x] `renderLayerEditorForm` 分区重排 + `renderGradientStopRow()` 色标行；
- [x] `theme-layer-value.ts` 新增 `addGradientStop` / `removeGradientStop` / `convertGradientType`；
- [x] controller 新增 `gradientType` / `gradientSize` / `gradientStopPick` 键与 `data-theme-layer-stop-add|remove` 点击分支；
- [x] CSS 分区、色标行、渐变预览条、高级区块样式；清理死样式 `user-theme-gradient-colors`；
- [x] 测试：分区与预设枚举、色标增删、方向关键词、径向参数切换、类型重置，以及三个新解析函数的单元测试。

### 10.5 核验（2026-09-14）

- [x] `npx tsc --noEmit`
- [x] `npm run check:architecture`
- [x] `npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts tests/ui/theme-layer-value.test.ts tests/ui/user-theme-editor-layer-order.test.ts`：3 文件 / 39 tests passed
- [x] `npm test`：146 文件 / 1369 tests passed（施工前 1360）
- [x] `npm run build`：通过（仅既存 chunk size warning）
- [ ] Edge 视觉与交互验收（分区排版、datalist 候选、色标增删、高级折叠区）

## 十一、首次编辑预览顺序与新增流程调整（2026-09-14 追加）

### 11.1 `theme-showcase-glow` 首次编辑仍无法预览（根因）

`withPreviewLayer()` 在目标**还没有本地覆盖**时用回退层集合构造预览 draft，但写入的 `layerOrder` 只有被编辑的那一层（存储侧 `layerOrder` 为空，只补了 `previewId`）。

`theme-runtime` 的 `mergeBackground()` 末尾按 `backgroundLayerOrder` 排序，**不在顺序表里的层 rank 取 `Number.MAX_SAFE_INTEGER`**。于是 `theme-showcase-atmosphere`（不透明线性渐变）被排到被编辑的 `theme-showcase-glow` 之后，成为最顶层把光晕整体盖住 —— 表现就是「改中心点/颜色看不到任何变化」。保存一次会 materialize 写出完整顺序，所以症状只在**首次编辑**出现（与 Task0053 §3.4「编辑一下才渲染」同源）。

修复：`withPreviewLayer()` 用带入层的实际堆叠顺序补齐所有缺失 id（回退层集合本身就是自底向上的绘制顺序），再补 `previewId`，最后按 global 规则补系统层：

```ts
// src/arona-clicker/services/user-theme-layer-service.ts
for (const item of layers) if (item.id && !order.includes(item.id)) order.push(item.id);
```

回归测试：`user-theme-layer-service`（首次预览补齐顺序、draft 不被写回）与 `theme-runtime`（端到端：被编辑层仍在其余回退层之上）。

### 11.2 新增图层流程裁定（取代 Task0049 §5.12 的「先弹 Dialog」）

裁定：**[＋ 新增] 立即建立一个普通图层（默认纯色 `#6b8cff`）并入 draft，不再打开编辑弹窗**；参数修改由用户随后点该行 ✎ 进入编辑弹窗完成。

- 原先「新增 → 立刻进入编辑-预览」把「建立」和「编辑」耦合，连续加多层必须先确认一轮；
- 新建即写入让列表即时可见、行为可预期，编辑弹窗职责收敛为「编辑已有图层」；
- 与 Task0053 §四「删除最后一层即回退」对称：新增即产生数据，删除即消除数据。

连带变化：

- `openDialog(target, layerId, mode)` → `openDialog(target, layerId)`，弹窗标题固定「编辑图层」，表单不再承担创建初值；
- controller 抽出 `commitLayer(layer, layerId)`：首次写入先 materialize 继承层，新建与保存共用一条落库路径；
- `refreshList()` 同步刷新「本地覆盖 / 回退」来源说明，避免首次修改后文案仍显示回退。

> 说明：原用例「删除目标唯一图层后清除本地覆盖」此前断言的是 `openManager` 时写入、之后不再更新的来源文案（过期文本）。来源说明改为随列表刷新后暴露了这一点，用例已按真实语义重写为「删除目标最后一层后清除本地覆盖并回到回退视图」，并显式删掉 materialize 固化的继承层。

### 11.3 核验（2026-09-14 追加）

- [x] `npx tsc --noEmit`
- [x] `npm run check:architecture`
- [x] `npx vitest run tests/engine/user-theme-layer-service.test.ts tests/engine/theme-runtime.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts tests/ui/theme-layer-value.test.ts`：4 文件 / 85 tests passed
- [x] `npm test`：146 文件 / 1372 tests passed（本轮追加前 1369）
- [x] `npm run build`：通过（仅既存 chunk size warning）
- [ ] Edge 验收：`theme-showcase-glow` 首次编辑即可实时预览；[＋ 新增] 只建层不开弹窗，点 ✎ 才进入编辑

## 十二、渐变输入安全（2026-09-14 追加）

### 12.1 症状

把某个色标的颜色或位置清空（或写入未识别内容）后，构建出的 CSS 会变成 `linear-gradient(135deg, #a, , #c)` 这类 **含空条目的非法声明**：浏览器直接丢弃整条 `background`，图层视觉内容整体消失；再次解析时 `splitTopLevel` 的 `filter(Boolean)` 又会悄悄吃掉空条目，于是色标数量变化、后续编辑不再落回原来那一层 —— 表现为「修改目标丢失」。

### 12.2 根因

1. `updateGradient()` 对 `stopColor` 只判断 `!== undefined`，空串会被直接写进色标（`startColor` / `endColor` 因为有 falsy 判断反而安全）；
2. `serializeGradient()` 用 `filter(Boolean)` 拼接条目，空颜色就产出 `, ,`；
3. `stopPosition`、方向、径向尺寸与中心没有任何取值校验，写坏的片段同样会让整条声明不可解析；
4. 表单把未校验的原始输入直接写进 draft，没有「拒绝非法输入」这一层。

### 12.3 修复（校验集中到解析器，UI 只负责提示）

`src/ui/theme-layer-value.ts`：

- 新增合法集合判定：`isGradientColorToken` / `isGradientStopPosition` / `isGradientDirection` / `isGradientCenterToken`；
- `updateGradient()` 拒绝会让 CSS 失效的输入：空或未识别的色标颜色**忽略**（保留原色）、非法位置与尺寸**忽略**（保留原值）、位置显式清空才回落到自动分布、方向显式清空才移除方向；
- 写回前做一次「序列化 → 再解析」往返校验，不合法就返回原值；
- `serializeGradient()` 丢弃空颜色条目，**永不产出空色标**。

`src/ui/controller-modals.ts`：

- 渐变字段的输入命中拒绝规则时不写入 draft，并给该字段加 `data-theme-layer-field-invalid="1"`（红框提示该次输入未生效），合法输入清除标记；
- 原始 CSS 值入口（`solid` / `gradient`）不再接受空内容：清空会让图层失去视觉值，要清空请显式切换为空层。

CSS：`.theme-layer-editor-form [data-theme-layer-field-invalid="1"]` 用 danger 色描边。

**设计取舍**：**拒绝而非替换默认值**。task-0054 §5 已裁定「未识别的 CSS 片段不得静默替换成默认值」，所以这里保留上一个合法值并提示，而不是把空色标补成 `#6b8cff` 或 `transparent`；也不在输入非法时立刻回写输入框（会与正在输入的内容互相打架），只在重渲染或重开弹窗时以模型值回填。

### 12.4 核验（2026-09-14 追加）

- [x] `npx tsc --noEmit`
- [x] `npx vitest run tests/ui/theme-layer-value.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts`：2 文件 / 43 tests passed
- [x] `npm test`：146 文件 / 1378 tests passed（本轮前 1372）
- [ ] Edge 验收：清空色标颜色不会让背景消失、字段红框提示；原始 CSS 清空不会把图层清空

## 十三、图层编辑器非法值处理审计（2026-09-14 追加）

### 13.1 审计结论

| 位置 | 原有非法值处理 | 结论 |
| --- | --- | --- |
| 渲染端 `background-service` / `presentation-service` | 值、定位、尺寸、重复、混合、附着全部经白名单 + `safeCss` 回退；非法值让该层整层丢弃 | 渲染是安全的，但**没有任何反馈**：面板显示的值与实际渲染不一致 |
| `theme-layer-value.ts` | 空色标会拼出 `, ,` 让整条声明失效 | 已在 §十二 修复 |
| `controller-modals.ts` 数值字段 | `opacity` 空或非数字 → `0`（图层直接变透明）；`scale` 非数字 → `1`；`rotation` 非数字 → `0` | **静默销毁用户数据**，本轮修复 |
| `controller-modals.ts` 定位/尺寸 | 完全没有校验 | 面板显示错值、渲染静默回退到 `center` / `cover`，本轮修复 |
| `controller-modals.ts` 图层 ID | 非法字符或重名由 `normalizedId` 静默改成机器 ID | **静默改名**，本轮修复 |
| `validateDraft`（保存并应用） | 校验 id、值长度、危险片段、图片引用 | 只在最终「保存并应用」时报错，离编辑现场太远，本轮把同类规则前移到编辑输入 |

### 13.2 顺带发现的既有漂移

`SAFE_VALUE` / `SAFE_POSITION` / `SAFE_SIZE` / `SAFE_REPEAT` / `SAFE_BLEND` 在 `background-service.ts` 与 `presentation-service.ts` **各写一份**，并且 `presentation-service` 的 `SAFE_BLEND` 少了 `color-dodge` / `color-burn`：同一份 `blendMode: 'color-dodge'` 在全局背景正确渲染，在区域 / 宿主图层被静默降级为 `normal`。

修复：抽出 `src/ui/layer-css-safety.ts` 作为唯一来源（含 `LAYER_*_PATTERN`、`LAYER_ID_PATTERN`、`safeCss`、`isRenderableLayerValue`、`isUsableLayerId`），两个渲染服务与图层编辑器共用；区域图层现在也能使用 `color-dodge` / `color-burn`。

### 13.3 编辑器侧修复（统一规则：非法输入不生效 + 标红）

| 字段 | 新行为 |
| --- | --- |
| `opacity` / `scale` / `rotation` | 空串或非数字**不写入**（保留原值）并标红；合法值按各自区间夹紧 |
| `position` / `size` | 必须匹配渲染端同规则 `^[a-z0-9% .-]+$`；空或非法不写入并标红 |
| `id` | 复用 `[a-zA-Z0-9_-]{1,64}`、排除系统保留 ID、同目标内不重名；不合法只提示，不再静默改名 |
| `value`（原始 CSS） | 必须能被渲染端采用（`isRenderableLayerValue`）且长度 ≤ 256；图片要求带命名空间的资源引用；不合法不写入并标红 |
| 渐变各字段 | 沿用 §十二 的解析器侧规则 |

统一提示：`data-theme-layer-field-invalid="1"` + `aria-invalid="true"`（danger 色描边），修正输入或重新渲染后自动清除。纯色的「高级」提示删掉了渲染端并不接受的 `transparent`，避免引导用户写出会被整层丢弃的值。

### 13.4 核验（2026-09-14 追加）

- [x] `npx tsc --noEmit`
- [x] `npm run check:architecture`
- [x] `npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts tests/ui/presentation-service.test.ts tests/ui/background-service.test.ts tests/ui/theme-layer-value.test.ts`：4 文件 / 71 tests passed
- [x] `npm test`：146 文件 / 1383 tests passed（本轮前 1378）
- [x] `npm run build`：通过（仅既存 chunk size warning）
- [ ] Edge 验收：数值/定位/ID 写非法值时红框提示且图层表现不变；`color-dodge` 在区域图层也不再被降级

## 十四、渐变色标位置参数兜底核验（2026-09-14 追加）

四类输入的实测行为（编辑器端到端 + 解析器单测均覆盖）：

| 输入 | 行为 | 结论 |
| --- | --- | --- |
| 普通值 `42%` / `.5%` / `+5px` / `0` | 写入对应色标 | ✅ 值即时更新、预览同步 |
| 越界值 `150%` / `-20%` | 照常写入（CSS 合法，语义是色带被截断） | ✅ 既不拦截，也不静默夹紧 |
| 非法值 `abc` / `10vw` / `50% 60%` / `calc(1px)` | 保留上一合法值 | ✅ 不写入 + 字段标红 |
| 无单位数字 `50` | 保留上一合法值 | ✅ 本轮收紧：非零长度必须带单位 |
| 留空 | 移除该色标的位置（回到自动分布） | ✅ 值仍合法、色标数量与颜色不变，不标红 |

其余色标不受影响，保存后回读仍是三个色标、颜色与位置与编辑时一致。

### 14.1 本轮发现并修掉的真实漏洞：无单位数字

`STOP_POSITION_RE` 原本允许 `-?\d+(\.\d+)?(?:%|px|em|rem)?` —— **`50` 这种无单位数字会被当成合法位置写进 CSS**。而色标位置在 CSS 里必须是 `<length-percentage>`，无单位非零数字会让整条 `linear-gradient(...)` 非法、浏览器丢弃整条 `background`，图层视觉整体消失。这与 §十二 的空色标是同一类「写坏整条声明」的漏洞，只是入口不同。

修复（`src/ui/theme-layer-value.ts`）：抽出长度字面量语法，**编辑端严格**（非零必须带单位，无单位 `0` 合法），**解析端保持宽松**（历史数据里的无单位值仍能读出，避免整条渐变退化成「无法解析」而彻底不可编辑）；同一规则同时应用到径向中心与径向尺寸。

```ts
const LENGTH_LITERAL = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:%|px|em|rem)';
const ZERO_LITERAL = '[-+]?0(?:\\.0+)?';
const LENGTH_LITERAL_OR_ZERO = `(?:${LENGTH_LITERAL}|${ZERO_LITERAL})`;          // 编辑端
const LENGTH_LITERAL_LOOSE = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:%|px|em|rem)?'; // 解析端
```

顺带把 `+.5turn` / `.5%` 这类省略写法纳入接受范围（此前会被误判为非法），并给位置输入补上 `留空=自动` 占位与语法 `title`。

### 14.2 已知边界（有意不放开）

- 单位白名单只有 `% / px / em / rem`：`vw` / `vh` / `calc()` / `var()` 作为位置判为非法并保留原值 —— 解析器无法往返这些写法，放开会让「序列化 → 再解析」校验必然回退。
- 「留空」按**回到自动分布**处理，与「清空方向 = 移除方向」「清空径向尺寸 = 移除尺寸」保持一致：它是显式清除而非丢失，结果仍是合法 CSS。若要求「留空也维持上一合法值」，去掉 `updateGradient` 中的 `if (!position)` 分支即可。

### 14.3 核验（2026-09-14 追加）

- [x] `npx tsc --noEmit`
- [x] `npm run check:architecture`
- [x] `npx vitest run tests/ui/theme-layer-value.test.ts tests/ui/user-theme-layer-editor-dialog.test.ts`：2 文件 / 47 tests passed
- [x] `npm test`：146 文件 / 1384 tests passed（本轮前 1383）
- [x] `npm run build`：通过（仅既存 chunk size warning）
- [ ] Edge 验收：填写 `abc` / `50` 时位置字段标红且渐变不变；填写 `150%`、`.5%` 正常生效；留空后色标回到自动分布

## 十五、兜底机制推广到图层编辑的其余字段（2026-09-14 追加）

§十二 ~ §十四 建立的三条规则，本轮推广到编辑弹窗里剩下的全部可编辑内容：

> 1. 只接受渲染端认得的写法；2. 非法输入**不写入**（保留上一合法值）并标红；3. 面板显示的值必须等于真正保存的值。

| 字段 | 本轮补齐的机制 |
| --- | --- |
| `repeat` / `blendMode` / `attachment` | 下拉选项改由 `LAYER_*_VALUES`（与渲染端白名单同一份）生成，控制器再按 `LAYER_*_PATTERN` 校验一次；非白名单值不写入并标红 |
| 上述下拉的**当前值** | 存储值不在白名单时（历史数据或人工注入），下拉补一条 `<当前值>（当前值不可用）` 并保持选中 —— 面板不再把非标准值伪装成第一个默认项 |
| 图片资源 | 引用的 Pic 已不存在时，下拉补一条 `<ref>（资源不存在）` 并保持选中 |
| 径向尺寸 | 同上：非预设值回显 `<值>（当前值）` |
| `opacity` / `scale` / `rotation` | 越界值仍按区间夹紧（渲染端同样夹紧，语义一致），但**提交（change/blur）时把夹紧后的值写回输入框**，面板显示即保存值；非数字仍不写入并标红 |
| 数值 / 位置 / 尺寸 | 输入框补 `title` 范围与语法提示（`0 - 1`、`0.05 - 8`、`-360 - 360`、`留空=自动` 等） |

配套调整：`src/ui/layer-css-safety.ts` 现在同时导出取值表与由它生成的校验正则，枚举型字段的「选项集合」与「白名单」不可能再漂移（§十三 的 `color-dodge` 漂移就是这么产生的）。

未纳入本轮（有意保留，避免过度拦截）：

- `kind` 与 `value` 的语义一致性（例如 `kind: 'gradient'` 却写了一个纯色十六进制值）：渲染端认这个值，只按纯色绘制，面板会提示「无法结构化解析」；是否额外约束留给后续裁定。
- `empty` 层不渲染任何内容，因此不提供视觉值控件。

### 15.1 核验（2026-09-14 追加）

- [x] `npx tsc --noEmit`
- [x] `npm run check:architecture`
- [x] `npx vitest run tests/ui/user-theme-layer-editor-dialog.test.ts`：1 文件 / 39 tests passed
- [x] `npm test`：146 文件 / 1388 tests passed（本轮前 1384）
- [x] `npm run build`：通过（仅既存 chunk size warning）
- [ ] Edge 验收：非标准 `repeat` / `blendMode` / 缺失图片时下拉如实回显；数值越界失焦后输入框回显夹紧值
