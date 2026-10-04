# 上下文包：UI、主题与表现层

适用：游戏内 UI、Controller、Workspace、主题色、背景层、Presentation 和浏览器验收。

## Required Read Set

先读 [[docs/docs-829/02-modules/ui]]。按实际子题补充：

| 子题 | 再读 |
| --- | --- |
| 只读数据边界 / Controller 与 Runtime 协作 | [[docs/docs-829/06-wiki/50-ui/read-model-context]]、[[docs/docs-829/01-architecture/data-flow]]、[[docs/docs-829/05-conventions/architecture-discipline]] |
| 主题色 / 背景 / Presentation | [[docs/docs-829/06-wiki/50-ui/presentation-theme]] |
| DOM 刷新 / 交互连续性 | [[docs/docs-829/06-wiki/50-ui/refresh-update]]；使用 `frontend-design` skill 时叠加 [[docs/ai/frontend-design-project-overlay]] |

每次还要读取 `src/ui/` 的目标 controller、component 或 host 及相关测试；只定位实际受影响的文件。

## Optional Read Set

旧 `docs-828/07-audit/` 文档是历史核查记录，不是当前规则。调查相关问题时，以 [[docs/docs-829/06-wiki/50-ui/presentation-theme]]、当前源码与测试核对实现。

## 默认不读

- `tools/datapack-editor/**`，除非任务明确涉及独立编辑器或 Schema 编辑器
- 与当前 UI 区域无关的历史主题 Roadmap

## 最小验证

UI 定向测试、`npx tsc --noEmit`；涉及交互、布局或主题表现时补 Edge 验收。
