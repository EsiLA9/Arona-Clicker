# 06-wiki/50-ui/presentation-theme — 背景与实体表现

主题和实体表现把内容定义、运行时的当前选择、可用资源和 UI 宿主身份组合成可展示的数据。Arona Clicker 的 `ColorSystem` 提供当前 Runtime 主题；`EntityPresentationService` 提供具体实体的展示查询。**宿主（host）**是一个有稳定名称的界面区域，例如面板、按钮或具体实体卡片。

## 从定义到组件

```text
Runtime 主题 / 实体状态 / Registry 定义 / 图片资源
  → Controller 构造 BackgroundView 与 PresentationView
  → createUIContext() 暴露背景、宿主状态和表现查询
  → render* 组件按 hostId 查询并输出表现节点
  → CSS 与 DOM 呈现图层、装饰、主题色和实体内容
```

这是运行时数据流，不表示 UI 静态依赖全部领域实现。`controller-theme.ts` 调用 `buildBackgroundView()` / `buildPresentationView()`，再把视图交给 `createUIContext()`；`presentation-service.ts` 根据宿主、区域和状态解析图层、组件、形状和文字颜色等字段。组件不应自行从所有内容定义中拼出主题规则。

## 哪些状态会使表现改变

全局主题、实体主题和用户主题变化由 `controller-events.ts` 订阅并安排界面重建；单个实体的 `entityPresentationChanged` 会转给 `refreshEntityPresentation(entityKey)` 定向刷新。当前是否需要改整页，要看受影响的宿主结构是否变化；普通状态更新不应自动扩大为 `render()`。

宿主可以声明 default、active、inactive、disabled 等状态表现。`createUIContext()` 按该宿主当前配置解析背景与文字模式；颜色模式为 `auto` 时，宿主有自己的背景层便按合成底色判断深浅，没有自有背景时保留语义颜色。形状、图层、颜色和组件最终由 presentation/background service 解析，样式由 CSS 承载。

## 普通游戏页的主题选择

普通游戏页一次只应用一个主题来源。`activeTheme` 选择玩家已拥有的 ColorGroup 或独立用户主题；选择“当前场景”时，使用当前 Area 的主题，Area 的声明主题是默认项，玩家为该 Area 选择的主题槽可替代它。无当前 Area 或场景主题无效时回到系统默认色彩。玩家切换 ColorGroup / 自定义主题后，该主题完整替代 Area 主题；背景、颜色和 Presentation 不跨来源合并。学生差分主题仍可供实体自身表现使用，不构成全局游戏主题。

用户自定义主题目前只有一个保存记录，和其它主题选项平级。剧情换肤和临时工作区主题也以完整主题临时替换当前选择，结束后恢复所选主题。玩家界面不提供图层优先级排序。`RuntimeThemeManager` 的多层合并与排序算法保留为通用能力，但普通游戏页只读取单一选择运行时，不把场景、学生、玩家和用户主题交给该算法合并。

外部 Init 选择页继续通过 `projectSelectorTheme()` 独立投影聚焦 Init 的主题，不改写普通游戏页的选中主题。宿主背景回退仍由 `backgroundForHost()` 解析；当选中主题自己的宿主没有图层时，回退规则只在该主题上下文内工作。

主题的**内容编辑**和玩家**选择当前主题**是两条不同路径。`ThemeContentEditorService` 编辑 Datapack 中的一般主题定义：草稿 / 预览不写入运行状态，保存回写指定的 editing Pack 并由 PackManager 持久化；它不是玩家 UserTheme 的存储入口。实现见 `src/arona-clicker/services/theme-content-editor-service.ts`，预览、保存和内容冲突测试见 `tests/engine/theme-content-editor-service.test.ts`。

## 代码与测试

代码路径：`src/ui/controller-theme.ts` 组合当前运行时视图，`src/ui/presentation-service.ts` 构建表现读取视图并渲染宿主，`src/ui/context.ts` 为组件提供查询。实体表现数据查询来自 Runtime 的只读 `entityPresentation` 端口。主题 / 表现的定义字段及同步边界见 [[docs/docs-829/05-conventions/schema-sync]] 与 [[docs/docs-829/03-data-structures/datapack-contracts]]。

`tests/ui/presentation-service.test.ts` 覆盖图层顺序、资源 / 地址校验、属性转义和宿主状态；`tests/ui/context.test.ts` 覆盖状态回退、合成背景文字颜色和父子宿主边界；`tests/ui/controller-theme-cleanup.test.ts` 覆盖主题 CSS 变量清理。测试验证解析行为，不代表真实浏览器中的全部视觉结果。

读组件可用的数据面：[[docs/docs-829/06-wiki/50-ui/read-model-context]]。主题变化如何选择刷新范围：[[docs/docs-829/06-wiki/50-ui/refresh-update]]。返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
