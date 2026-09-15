# 上下文包：UI、主题与表现层

适用：游戏内 UI、Controller、Workspace、主题色、背景层、Presentation 和浏览器验收。

## Required Read Set

- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/02-modules/color]]
- [[docs/docs-828/01-architecture/data-flow]]
- `src/ui/` 目标 controller / component / host 与测试

## Optional Read Set

- [[docs/docs-828/07-audit/presentation-fallbacks]]
- [[docs/docs-828/07-audit/presentation-editor-consistency]]
- [[docs/docs-828/07-audit/condition-presentation]]

## 默认不读

- `tools/datapack-editor/**`，除非任务明确涉及独立编辑器或 Schema 编辑器
- 与当前 UI 区域无关的历史主题 Roadmap

## 最小验证

UI 定向测试、`npx tsc --noEmit`；涉及交互、布局或主题表现时补 Edge 验收。
