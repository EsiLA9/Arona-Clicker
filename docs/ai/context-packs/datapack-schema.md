# 上下文包：Datapack、Registry 与 Schema

适用：实体字段、枚举、Datapack 合并、Registry、Definition resolution 和编辑器协议。

## Required Read Set

- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/03-data-structures/declarative-dsl]]
- [[docs/docs-828/03-data-structures/registry]]
- 对应模块卡片与 `src/engine/types/` 目标类型
- 相关 Schema 同步测试

## Optional Read Set

- `tools/datapack-editor/schema/editor-extras.ts`
- [[docs/docs-828/03-data-structures/id-reference-semantics]]
- [[docs/docs-828/01-architecture/design-constraints]]

## 默认不读

- `tools/datapack-editor/` 的 UI 实现，除非任务明确涉及独立编辑器
- `docs/plan-work/archive/**` 的多包规划，除非任务恢复未决方向

## 最小验证

`npm run gen:schema`、Schema 定向测试、`npx tsc --noEmit`、`npm run check:docs`。
