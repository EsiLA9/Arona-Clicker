---
scope: ai-protocol
authority: project-overlay
read_when:
  - 设计或重塑游戏内 UI，使用 Agent 的 frontend-design skill
  - 审查风格复用、DOM 刷新、scroll / click 连续性或装饰性结构
avoid_when:
  - 独立数据包编辑器 tools/datapack-editor 的专用 UI 施工
related_modules:
  - ui
  - runtime-editor
  - presentation
---

# docs/ai/frontend-design-project-overlay — 游戏 UI 项目补充

> 本文回答：使用 Agent 的 `frontend-design` skill 时，ACProgram 游戏 UI 还需遵守哪些项目边界。

## 适用范围与权威

适用 `src/ui/` 游戏 UI，包含游戏内编辑界面；独立 `tools/datapack-editor/` 不默认套用本协议。

当前游戏内前端施工以桌面宽屏为目标；无需考虑窄屏或移动端适配，也不要求对这些视口做验收。仅当具体任务明确提出时再处理窄屏。

通用复用原则、风格目录维护、新视觉方向确认、装饰约束、结构草图和交互连续性要求统一由 Agent 的 `frontend-design` skill 维护，本文只补充项目约束。

项目视觉约定与复用入口见 [[ui-style/00-index]]；机制、架构和刷新事实归 `docs/docs-829/`，共享结构变化更新其中对应页。

## 数据与表现入口

- UI 数据读取遵守 [[docs/docs-829/06-wiki/50-ui/read-model-context]]，通过 `UIContext` / `GameView` / 只读查询取得内容；具体组件和格式化入口见 [[ui-style/patterns]]。
- 宿主与实体表现经已有 Presentation 入口处理，主题与背景层遵守 [[docs/docs-829/06-wiki/50-ui/presentation-theme]]；项目 token 与视觉角色见 [[ui-style/foundations]]。

## 刷新与施工约束

刷新模型见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]，请求类型以 `src/ui/update/ui-update-types.ts` 的 `behavior / element / region / structure` 为准；panel 刷新按既有控制器入口处理。

- scroll、hover、focus、普通 click 和单项选择默认不得触发全量 `UIController.render()`；普通 Tick 不触发 full render。
- 批量 mutation 提交完成后，通过已有更新机制合并为一个 UI 收敛点。
- DOM 替换经过统一 mutation range 生命周期：替换前关闭受影响范围内的 popover，替换后校验锚点连接状态；范围外浮层保持不受影响。

在 skill 要求的结构与更新说明中，非纯样式修正还需明确：

- 新增 wrapper / 节点数量及职责。
- 对应的项目刷新类型与目标；使用 `structure` 的触发条件，以及目标缺失时的回退范围。
- click 后必须保持 identity 的节点与受影响 popover 的生命周期处理入口。

无法确定稳定节点、刷新范围和回退条件的方案不能视为可施工设计。

## 项目验收入口

刷新证据使用已有 `data-ui-refresh-*` 诊断属性、`UIRefreshObservation`、`npm run ui:callgraph` 和相关 `tests/ui/`，核对实际范围、节点数量与刷新次数是否符合施工说明。

测试选择遵守 [[docs/docs-829/05-conventions/testing]]；UI 定向测试、类型检查与浏览器验收的任务路由见 [[docs/ai/context-packs/ui-presentation]]。
