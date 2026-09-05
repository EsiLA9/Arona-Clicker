# roadmap-0017 — 按钮状态表现与稳定语义色存储

> 本文规划主题编辑器对按钮状态的细分，以及将稳定语义色从 HTML 实例复制中收束到主题运行时。表现层字段、解析规则和编辑器行为以本文为施工目标，具体实现以源码为准。

## 背景

当前控件已经能够通过 `PresentationHost` 挂载背景图层，但同一控件宿主的默认态和 active 态仍共享一套图层。与此同时，主题节点最终会通过多个 HTML 实例、局部样式和组件变量反复表现，导致：

- active 按钮无法独立编辑；
- 卡片本体与卡片操作按钮的语义边界不清；
- 稳定的 warning、danger、success、text 等颜色不应随每个节点复制；
- 主题更新容易触发不必要的 DOM 重建；
- 编辑器保存了过多“继承后的结果”，而不是用户真正的覆盖意图。

## 目标

1. 为按钮类控件提供默认态、active 态、inactive 态和 disabled 态表现层。
2. 让 active 状态使用明确的状态来源，不通过脆弱的 class 推断表现层内容。
3. 将稳定语义色集中解析为运行时主题变量，并由 CSS 统一消费。
4. 只保存用户明确修改的主题覆盖，不保存逐级展开后的重复值。
5. 保持系统颜色层、父级继承、透明背景和用户图层顺序语义不变。
6. 状态切换或颜色变化优先更新 CSS 变量和局部背景节点，避免整页重建。

## 非目标

- 暂不开放 hover 作为用户可编辑表现目标；hover 继续由交互 CSS 处理。
- 暂不为旧存档编写迁移逻辑，按项目约定允许破坏性调整数据结构。
- 不把每一个按钮实例都登记为一个主题宿主。
- 不把任意 CSS 属性开放给主题编辑器。
- 不把 warning/danger 等稳定语义色复制到每个 HTML 元素的 inline style。

## 目标宿主划分

| 视觉对象 | 默认态 | active 态 | 说明 |
| --- | --- | --- | --- |
| 顶部栏按钮 | `header.button` | `header.button.active` | active 表示当前打开或选中的顶部功能 |
| 左侧栏 Tab | `leftPanel.tab` | `leftPanel.tab.active` | 对应 `switch-tab active` |
| 中央栏 Tab | `centerPanel.tab` | `centerPanel.tab.active` | 对应中心区域选中 Tab |
| 右侧栏 Tab | `rightPanel.tab` | `rightPanel.tab.active` | 对应右侧区域选中 Tab |
| 卡片本体 | `card` | 不适用 | 卡片 hover/选中不与按钮层混用 |
| 卡片操作按钮 | `card.action` | `card.action.active` | 从卡片本体中拆出独立目标 |
| 聊天气泡 | `bubble` | 不适用 | 继续按玩家/非玩家语义处理 |

数据上优先采用一个宿主下的状态分支，而不是增加大量平行目标：

```ts
interface PresentationHostDef {
  id: string;
  parent?: string;
  layers?: BackgroundLayerDef[];
  states?: {
    default?: PresentationHostStateDef;
    active?: PresentationHostStateDef;
    inactive?: PresentationHostStateDef;
    disabled?: PresentationHostStateDef;
  };
}
```

`hover` 仅保留运行时接口，不进入首版编辑器。状态值由 TypeScript 根据控件语义明确传递，例如 `data-theme-state="active"`，不依赖编辑器重新查询完整 DOM。

## 状态解析回退链

```text
当前状态的用户图层
  ↓ 无覆盖
宿主默认态用户图层
  ↓ 无覆盖
父级宿主 / 簇的对应状态
  ↓ 无覆盖
系统颜色层
  ↓ 被忽略或不存在
透明背景
```

对于 active 态，不能因为缺少 active 专属图层就直接回到原始主题颜色；应先继承宿主默认态，再进入父级和系统层回退。文本颜色仍由统一 readableOn 判别器和状态语义变量处理。

## 稳定语义色的存储分层

### 持久化层：只保存用户意图

`UserThemeDraft` 只保存以下内容：

- 主题色及其启用/失能状态；
- 用户明确指定的 token、语义节点和作用域覆盖；
- 宿主默认表现层与状态表现层的明确覆盖；
- 图片资源和图层定位参数。

没有被用户覆盖的 warning、danger、success、text、muted 等内容不在各个作用域重复保存。

### 运行时层：集中保存解析结果

增加或明确一个只读的运行时结果结构：

```text
ResolvedTheme
  ├─ resolvedTokens
  ├─ resolvedNodes
  ├─ resolvedScopes
  ├─ resolvedHostDefaults
  └─ resolvedHostStates
```

该结构由主题版本变化触发计算，不进入存档。解析结果再统一写入根节点 CSS 变量，例如：

```css
:root {
  --theme-warning: ...;
  --theme-danger: ...;
  --theme-text: ...;
  --theme-muted: ...;
  --ui-button-bg: ...;
  --ui-button-bg-active: ...;
  --ui-button-text: ...;
  --ui-button-text-active: ...;
}
```

HTML 只保留结构类名与状态标记：

```html
<button class="ui-control ui-control--tab" data-theme-state="default">...</button>
<button class="ui-control ui-control--tab ui-control--active" data-theme-state="active">...</button>
```

组件 CSS 负责将稳定语义变量映射到按钮、警告、危险提示等具体样式。实例级动态颜色（例如实体头像色、卡片专属 accent）仍可暂时保留为局部变量，但不得与稳定语义色混为一谈。

## 编辑器行为

1. 按语义筛选器选择“按钮”后，先显示按钮族，再显示默认态、active 态和 disabled 态入口。
2. 默认态和 active 态使用同一套图层编辑器；区别只在状态上下文。
3. 未创建状态覆盖时显示“继承默认态/父级/系统层”的来源，而不是伪造默认颜色。
4. active 态允许单独插入纯色、渐变或图片图层。
5. 删除状态覆盖后恢复继承，不生成透明的冗余图层。
6. 卡片本体和卡片操作按钮分别编辑，避免用户误以为修改卡片会改变按钮。
7. 编辑输入只更新当前目标卡片和预览背景，不切换回颜色 Token，也不刷新整个 modal。

## 施工优先级

### P0：表现模型与解析

- 增加宿主状态分支类型和 `default/active/disabled` 解析入口。
- 明确精确状态 → 默认态 → 父级 → 系统层 → 透明的回退链。
- 将 `card.action` 从 `card` 中独立登记。
- 保证系统颜色层在各状态下都具有统一的启用、忽略、排序语义。

### P1：渲染与编辑器接入

- 为按钮和 Tab 输出稳定的状态标记。
- 让背景宿主渲染器读取状态上下文。
- 编辑器按按钮族和状态显示同一套图层工具。
- 增加状态解析、状态回退、图层顺序和局部刷新测试。

### P1：稳定语义色收束

- 集中生成语义 CSS 变量和按钮状态变量。
- 将稳定颜色从按钮 HTML inline style 和重复作用域值中移除。
- 作用域只保存差异，编辑器显示计算值与来源。
- 颜色变化只更新主题变量和必要的宿主背景节点。

### P2：清理与视觉验证

- 清理已被语义变量替代的旧别名和重复 CSS。
- 在 Edge 检查默认/active 按钮、卡片按钮、透明背景、系统层关闭和继承链。
- 验证顶部 SVG 与文字使用同一状态前景色。
- 记录仍需保留的实例级动态颜色。

## 验收标准

- 默认按钮和 active 按钮可以分别添加、排序、忽略和删除用户图层。
- 未配置 active 覆盖时，active 能正确继承默认态而不是回到原始硬编码颜色。
- `card` 与 `card.action` 的编辑互不影响。
- warning、danger 等稳定语义色在运行时只解析和注入一次，不随每个 HTML 实例重复写入。
- 清空覆盖后能显示真实来源，不再显示“跟随上一层”这种无法追溯的笼统文案。
- 主题输入和按钮状态变化不触发整页 DOM 重建。
- `npx tsc --noEmit`、`npm test`、`npm run build` 通过，并完成 Edge 视觉检查。

## 状态

- 文档：已创建
- P0：已完成首版状态契约、解析回退链和状态测试
- P1：已完成状态选择器、状态图层编辑、Tab/顶部按钮/卡片操作按钮接入，以及按钮语义 CSS 变量出口；实例级动态主题色仍按非稳定色保留
- P2：待执行
