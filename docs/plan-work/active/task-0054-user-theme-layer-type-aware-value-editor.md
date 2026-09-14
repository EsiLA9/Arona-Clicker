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
