# Task 0033：控件系统颜色层职责收敛与重复背景清理

状态：🟡 规划完成，待施工（2026-09-07）

> 本文回答：控件表现目标中的“应用系统颜色层”为什么会同时影响背景、状态回退、父级继承和面板 CSS，以及如何把它收敛为单纯的合成图层开关。

## 1. 目标

将“系统颜色层”恢复为表现层语义：它只表示一层由颜色系统生成的简单背景，并提供该层是否绘制的开关。

本任务完成后应满足：

- 系统颜色层只有一个明确的绘制所有者，不再由全局背景、控件解析器和旧 CSS 各自提供一份同义背景；
- 关闭系统颜色层只影响这一层的绘制，不改变主题 token、palette、节点颜色、文字颜色、头像颜色或游戏状态；
- 控件的父级继承、active/inactive/disabled 状态和默认背景回退独立于系统颜色层开关；
- 面板、按钮、Tab、卡片等表现宿主的背景由统一背景节点负责，组件 CSS 只负责结构、裁切、几何与内容层级；
- 编辑器只在真正拥有系统颜色层的目标上展示该层，不为每个控件伪造同名系统层；
- `layerOrder` 仍然能够稳定保存和恢复，关闭系统层不会破坏用户层顺序。

## 2. 立项结论

当前问题不是单纯的“背景有多层”这么简单，而是同一语义被放入了多个责任边界：

1. 全局 `ColorSystem` 注入 `system-color-background`；
2. `UIContext.backgroundForHost()` 在控件有本地图层时再次生成同名系统层；
3. 面板宿主仍通过 `background` CSS 绘制一份容器底色；
4. 部分控件自身仍有 `background`，同时内部还渲染表现背景节点；
5. `systemColorLayerIgnored` 又被用来决定继承、状态 fallback 和旧 CSS 回退。

这些机制在部分情况下是嵌套层级上的正常叠加，但在当前实现中缺乏明确的所有权，导致开关的可见效果和实际职责不一致。

本任务采用以下方向作为目标架构：

> 全局目标保留唯一的合成系统颜色层；控件目标不自动复制全局系统层。控件需要自己的背景时使用普通的纯色、渐变或图片图层；控件没有本地图层时按既有父级/全局规则继承或使用独立的状态默认回退。

如果未来确实需要某个控件拥有特殊的主题色底，应新增明确的控件默认表面机制或普通用户图层，不重新复用 `systemColorLayerIgnored`。

## 3. 当前事实与代码落点

### 3.1 全局系统层

`src/arona-clicker/services/color-system.ts` 中的 `systemColorBackground()` 生成稳定 ID 为 `system-color-background` 的渐变：

- 使用 `var(--bg)` 和 `var(--bg-alt)`；
- 作为用户主题全局背景的合成层加入运行时；
- 编辑器允许它参与全局 `backgroundLayerOrder` 排序，但不允许删除；
- 忽略时当前实现通过 `opacity: 0` 让该层仍留在运行时数组中。

当前的 `syncUserThemeFromState()` 与 `setUserThemePreview()` 还把全局 `systemColorLayerIgnored` 当作颜色覆盖开关：关闭时省略 `tokens`、`palette`、`nodeOverrides` 和 `scopeNodeOverrides`。这与系统层只控制背景绘制的目标不一致。

代码落点：

- `src/arona-clicker/services/color-system.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/components/user-theme-editor.ts`

### 3.2 控件宿主系统层

`src/ui/context.ts` 的 `backgroundForHost()` 当前会：

- 在控件存在本地图层时，插入一层新的 `system-color-background`；
- 控件没有本地图层时，根据 `inheritGlobal` 返回全局背景；
- 系统层被忽略时，返回控件图层或透明空层；
- active 且没有状态配置时，使用 palette fallback；
- inactive/disabled 等状态使用另一套基础 fallback；
- 同时参与父级状态回退和图层合并判断。

因此控件级开关不是单纯的“系统背景层显隐”，而是背景解析策略的一部分。

代码落点：

- `src/ui/context.ts`
- `src/ui/presentation-service.ts`
- `src/ui/background-service.ts`

### 3.3 编辑器中的重复展示

控件目标编辑器当前会为每个宿主构造：

```text
[system-color-background, host.layers...]
```

因此全局背景和每个控件卡片都显示一个“系统颜色层”。这与 `roadmap-0012` 中“全局背景保留系统颜色层；其他目标不复制系统颜色层”的既定方向不一致。

代码落点：

- `src/ui/components/user-theme-editor.ts`
- `0x-plan&work/active/roadmap-0012-flat-presentation-targets.md`

### 3.4 CSS 与组件背景的第二个所有者

统一背景节点已经由 `renderPresentationHostBackground()` / `renderBackground()` 输出，但旧 CSS 仍然可能直接绘制背景：

- 三栏面板宿主有 `background: var(--theme-cluster-background, color-mix(...))`；
- `controller-theme.ts` 根据 `panelHost.systemColorLayerIgnored` 写入或移除 `--theme-cluster-background`；
- `.mini-action` 自身仍有 `background: var(--ui-button-bg, transparent)`；
- 顶部按钮和 Tab 已部分通过透明背景及 `:not(.presentation-host-target)` 规则规避，但不代表所有控件都已收敛。

代码落点：

- `src/ui/controller-theme.ts`
- `src/ui/css/layout.css`
- `src/ui/css/cards.css`
- `src/ui/css/chat.css`
- `src/ui/css/background.css`

### 3.5 现有文档契约

现有规划已经给出本任务应恢复的边界：

- 全局背景保留系统颜色层，其他目标不复制；
- 只有全局目标注入系统颜色层；
- 空目标不应产生额外视觉内容；
- 系统层被忽略后，颜色 token、文字判别和头像颜色仍应正常。

相关文档：

- `0x-plan&work/active/roadmap-0010-presentation-layer-service.md`
- `0x-plan&work/active/roadmap-0012-flat-presentation-targets.md`
- `docs-828/07-audit/presentation-editor-consistency.md`

## 4. 目标职责模型

### 4.1 系统颜色层

系统颜色层是一个只读的合成 `BackgroundLayerDef`，职责仅限于：

- 提供主题色驱动的简单背景；
- 参与全局背景层排序；
- 响应全局“应用系统颜色层”开关；
- 在编辑器中展示来源、序位和当前启用状态。

它不负责：

- 控件父级继承；
- active/inactive/disabled 状态选择；
- 默认按钮颜色 fallback；
- 文字颜色模式；
- 主题 token 和 palette 的注入；
- 面板旧式 CSS 背景；
- 任何游戏状态变化。

### 4.2 控件图层

控件目标只保存显式的用户表现层：

- `empty`；
- `solid`；
- `gradient`；
- `image`。

控件没有显式图层时，按以下顺序解析：

```text
当前状态显式层
    ↓ 无覆盖
控件默认层
    ↓ 无配置
父级宿主 / 全局背景
    ↓ 仍无可用层
独立的状态默认 fallback（如确有必要）
```

这个过程不再插入名为 `system-color-background` 的隐式控件层。

### 4.3 开关

本任务收敛后，系统层开关的有效语义应等价于：

```text
enabled  → 把全局合成系统层交给背景渲染器
ignored  → 不绘制全局合成系统层，但保留顺序信息
```

开关变化不应触发颜色来源重置，也不应改变宿主状态解析结果。

控件和状态级的 `systemColorLayerIgnored` 将不再作为控件默认模型的一部分。旧数据中如果存在该字段，运行时可自然忽略，不增加存档迁移逻辑；项目现阶段允许结构破坏性调整。

## 5. 目标渲染管线

```text
ColorSystem
  └─ 仅为全局目标生成 system-color-background
       ↓
RuntimeThemeManager
  └─ 合并全局 / 用户 / 场景背景及顺序
       ↓
UIContext
  └─ 解析控件显式层、状态层、父级继承和独立 fallback
       ↓
renderBackground
  └─ 只创建一个背景节点并按层序绘制
       ↓
presentation-host-content
  └─ 内容位于背景之上
```

每个实际 DOM 宿主仍可以有自己的背景节点，这是控件和面板边界的正常隔离；但同一个宿主不能同时由背景节点、宿主自身 CSS 和旧面板变量提供同义底色。

## 6. 施工切片

### P0：冻结契约与回归矩阵

先补充测试输入和验收矩阵，不改变行为：

- 全局系统层启用/忽略；
- 全局层位于用户层下方、中间和上方；
- 控件无配置、只有空层、只有显式层、状态有覆盖；
- 父级有配置、子级无配置；
- inactive hover 使用 active 视觉；
- 面板、顶部按钮、Tab、卡片按钮各自的背景所有权；
- 忽略全局系统层后 token、palette、文字模式和头像相关变量保持不变。

验收重点是区分：

- 同一 `BackgroundView` 中的图层叠加；
- 父子 DOM 宿主之间的正常嵌套；
- 同一宿主上背景节点与 CSS 背景的重复绘制。

### P1：拆分全局开关与颜色来源

修改 `ColorSystem`：

- `systemColorLayerIgnored` 只决定是否绘制系统背景层；
- 即使系统层被忽略，也继续传递 `tokens`、`palette`、`nodeOverrides` 和 `scopeNodeOverrides`；
- 应用主题和编辑器预览使用完全相同的语义；
- 不再用“省略整个 colorLayer”表达“忽略背景层”；
- 保留 `backgroundLayerOrder`，确保重新打开编辑器后序位不丢失。

建议将系统层的忽略处理集中在一个背景解析入口，不再同时使用“opacity 为 0”“省略颜色来源”“宿主透明 fallback”三种表达。

### P2：取消控件自动注入系统层

修改 `UIContext.backgroundForHost()`：

- 删除控件级 `system-color-background` 的自动插入；
- 删除控件级系统开关对继承路径的影响；
- 删除仅为表示忽略状态而生成的透明空层；
- 保留当前状态层与父级状态回退，但让它们只依据状态配置本身判断；
- 控件没有显式层时继续按父级/全局规则继承；
- 必须保留现有按钮在 active/inactive/disabled 下的默认可读背景，但该 fallback 不得再叫系统颜色层，也不得受全局系统层开关控制；
- `layerOrder` 只排序真正存在的显式控件层。

如果仍需控件级主题色底，使用普通 `solid`/`gradient` 层或新增独立的 `controlSurfaceFallback` 机制，不能重新使用 `systemColorLayerIgnored`。

### P3：收敛背景绘制所有权

修改组件 CSS 与刷新链：

- 统一由 `.presentation-host-background` 或 `.console-panel-background` 绘制主题背景；
- `presentation-host-target` 的宿主自身背景默认为透明，避免与内部背景节点重叠；
- 清理 `.mini-action` 等已接入宿主的控件背景声明；
- 保留未接入表现宿主的传统控件样式，直到其接入任务完成；
- 面板的 `--theme-cluster-background` 不再读取 `systemColorLayerIgnored`；
- 如果旧 CSS fallback 仍需保留，应依据“是否存在背景节点/是否有显式表现目标”判断，而不是依据系统层开关；
- `controller-theme.ts` 只负责刷新背景节点、主题变量和必要的局部 DOM，不再额外控制同一背景颜色。

需要特别验证 `leftPanel`、`centerPanel`、`rightPanel`、`service-column` 和卡片操作按钮，因为它们分别代表面板 CSS、服务工作区 CSS 和卡片按钮 CSS 三种历史路径。

### P4：清理编辑器模型

修改 `user-theme-editor.ts` 与相关事件：

- 全局背景编辑器保留系统颜色层固定项、忽略开关和排序按钮；
- 控件目标编辑器只展示显式控件图层，不再人为添加系统层项；
- 删除控件级“应用系统颜色层”复选框及其上下移动处理；
- 控件图层的上下移动只处理实际用户图层；
- 删除控件时不再清理或写入系统层序位；
- 保留状态层、继承层和文字颜色编辑功能，但明确它们与系统层无关；
- 清理旧的 `system-color-layer` 兼容展示逻辑，避免编辑器同时出现两个系统层名称。

编辑器显示应与运行时有效图层一致：未配置控件不应因为编辑器主动插入一个系统层而看起来已经有本地背景。

### P5：类型、数据校验与测试同步

根据 P2/P4 的最终模型同步：

- `src/engine/types/theme.ts` 中的 `PresentationHostDef` 与 `PresentationHostStateDef`；
- 用户主题草稿类型与编辑器字段；
- `presentation-service.ts` 的只读视图；
- 用户主题校验与默认内容；
- 相关 schema 生成产物（如本切片改动了引擎实体字段，必须执行 `npm run gen:schema`）；
- 不编写存档迁移或兼容层，旧字段按项目当前破坏性调整政策自然失效/忽略。

### P6：Edge 视觉回归

在 Edge 中逐项确认：

1. 全局系统层开启时，页面有且只有预期的一层主题基础背景；
2. 全局系统层关闭时，主题 token、文字色和控件状态颜色仍保持；
3. 控件无本地背景时显示父级/全局背景，不出现额外同义渐变；
4. 控件有纯色、渐变或图片层时，背景节点独立覆盖，不再叠加旧 CSS 底色；
5. 面板与按钮的圆角、装饰线、hover/active 切换不被背景清理破坏；
6. 不同状态下关闭背景不会改变文字颜色模式的解析来源；
7. 编辑器保存、关闭、重新打开后，全局层顺序和控件用户层顺序均保持；
8. 选择页的 `.selector-super-background` 与游戏页的 body/outer background 不发生回归。

## 7. 测试计划

### 单元测试

- `tests/engine/theme-runtime.test.ts`
  - 全局系统层注入、排序与忽略；
  - 忽略系统层不影响主题 token 和 palette；
  - 用户层和场景层仍按既定优先级合并。

- `tests/ui/context.test.ts`
  - 控件不再自动获得 `system-color-background`；
  - 显式控件层、状态层和父级继承保持；
  - active/inactive/disabled fallback 不依赖系统层开关；
  - 不再生成无意义透明空层。

- `tests/ui/background-service.test.ts`
  - 全局忽略层不产生可见 DOM 背景；
  - 真正的用户层仍按顺序、透明度和安全值输出。

- `tests/ui/presentation-service.test.ts`
  - `PresentationView` 不再把控件系统层当作独立用户层；
  - 状态、形状、装饰线和文字模式字段保持独立。

- 新增或修订 CSS/组件测试：
  - 已接入表现宿主的元素不再同时使用旧背景声明；
  - 非表现宿主仍保留原有默认背景。

### 检查命令

施工完成后至少执行：

```text
npx vitest run tests/engine/theme-runtime.test.ts tests/ui/context.test.ts tests/ui/background-service.test.ts tests/ui/presentation-service.test.ts
npx tsc --noEmit
npm run check:architecture
npm test
```

如修改 `src/engine/types/` 的字段或枚举，再执行：

```text
npm run gen:schema
```

## 8. 非目标

本任务不负责：

- 重新设计主题色派生算法；
- 修改 `--bg`、`--bg-alt` 的颜色来源；
- 重做所有未接入 `PresentationHost` 的旧控件；
- 改变文字颜色 `light/dark/auto` 的独立语义；
- 改变 Init/GlobalEnh 选择页的动态主题玩法；
- 修改游戏状态、存档结构或数据包机制；
- 增加逐帧动画、图片资源格式或新的背景图层类型。

## 9. 风险与处理

| 风险 | 表现 | 处理 |
| --- | --- | --- |
| 删除控件系统层后按钮变透明 | 控件原先依赖隐式渐变 | 先保留独立状态 fallback，并为需要定制的控件补普通显式层 |
| 清理 CSS 后面板失去底色 | 面板原先依赖 `theme-cluster-background` | 用统一背景节点或明确的结构 fallback 替代，不把开关重新接回 CSS |
| 状态 fallback 与继承关系变化 | active/inactive 出现颜色跳变 | 先补 `context.test.ts` 状态矩阵，再做解析器调整 |
| 编辑器顺序与运行时不一致 | 系统项删除后用户层序位错位 | 全局保留 order entry；控件 order 只保存真实用户层；增加保存/重开测试 |
| 旧主题中仍存在控件系统字段 | 编辑器出现历史开关或运行时误判 | 按当前项目政策直接忽略旧字段，不新增迁移；清理读取和展示入口 |
| 选择页背景回归 | 外层背景和选择页专用背景互相遮挡 | P6 单独检查 `.selector-super-background`、`body` 和 `console-shell` 层级 |

## 10. 当前核验（2026-09-07）

已完成静态核验：

- 读取 `docs-828/00-INDEX.md` 确认 UI/主题文档路由；
- 对照 `roadmap-0010`、`roadmap-0012` 与表现层一致性审查；
- 检查 `color-system.ts`、`theme-runtime.ts`、`context.ts`、`presentation-service.ts`、`background-service.ts`、`controller-theme.ts`、编辑器和 CSS 的当前落点；
- 确认全局系统层、控件隐式系统层、面板 CSS fallback 和部分控件自身背景存在多处责任交叉；
- 尚未修改本任务涉及的运行时代码；
- 专项测试、类型检查、全量测试和 Edge 视觉回归均待施工阶段执行。

## 11. 完成定义

满足以下条件才可将本任务标记为完成：

- 运行时只有全局目标拥有 `system-color-background` 合成层；
- 控件不再自动复制或展示系统颜色层；
- 全局忽略开关不影响主题颜色来源；
- 同一表现宿主只有一个背景绘制所有者；
- 父级继承、状态 fallback、文字颜色和装饰线测试通过；
- 编辑器保存/重开后全局顺序和控件用户层顺序稳定；
- `npx tsc --noEmit`、专项测试、`npm run check:architecture` 和 `npm test` 通过；
- Edge 完成面板、按钮、Tab、卡片、选择页和不同状态的视觉回归。

## 12. 相关路由

- [[docs-828/02-modules/color]]
- [[docs-828/02-modules/ui]]
- [[docs-828/04-mechanisms/color-derivation]]
- [[docs-828/07-audit/presentation-editor-consistency]]
- [[0x-plan&work/active/roadmap-0010-presentation-layer-service]]
- [[0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]]
- [[0x-plan&work/active/roadmap-0012-flat-presentation-targets]]
- [[0x-plan&work/active/roadmap-0014-theme-editor-convergence]]
- [[0x-plan&work/active/roadmap-0015-ui-dom-recalculation]]
- [[0x-plan&work/mechanisms/theme-presentation-ui]]
