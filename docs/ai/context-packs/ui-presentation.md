# 上下文包：UI、主题与表现层

适用：游戏内 UI、Controller、Workspace、主题色、背景层、Presentation 和浏览器验收。

## 按子题选择

只读命中的一行；需要了解 UI 模块职责时再读 [[docs/docs-829/02-modules/ui]]。

| 子题 | 再读 |
| --- | --- |
| 只读数据边界 / Controller 与 Runtime 协作 | [[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/05-conventions/architecture-discipline]] |
| UI 布局 / 风格设计与复用 | Agent 的 `frontend-design` skill、[[docs/ai/frontend-design-project-overlay]]、[[ui-style/00-index]]，按风格索引读命中页面 |
| 主题色 / 背景 / Presentation | [[docs/docs-829/06-wiki/50-ui/presentation-theme]]；改视觉约定时补读 [[ui-style/foundations]] |
| DOM 刷新 / 交互连续性 | [[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/ai/frontend-design-project-overlay]] |

再核对 `src/ui/` 的目标 controller、component 或 host 及相关测试；只定位实际受影响的文件。

## Optional Read Set

旧 `docs-828/07-audit/` 文档是历史核查记录，不是当前规则。调查相关问题时，以 [[docs/docs-829/06-wiki/50-ui/presentation-theme]]、当前源码与测试核对实现。

## 默认不读

- `tools/datapack-editor/**`，除非任务明确涉及独立编辑器或 Schema 编辑器
- 与当前 UI 区域无关的历史主题 Roadmap

## 验证入口

行为改变时运行 UI 定向测试；契约改动时补类型检查，涉及交互、布局或主题表现时补浏览器验收。
