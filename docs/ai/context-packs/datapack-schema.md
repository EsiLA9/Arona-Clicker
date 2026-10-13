# 上下文包：Datapack、Registry 与 Schema

适用：实体字段、枚举、Datapack 合并、Registry、Definition resolution 和编辑器协议。


## 按子题选择

| 子题 | 先读 |
| --- | --- |
| Engine 实体字段 / 枚举 / Schema 生成 | [[docs/docs-829/05-conventions/schema-sync]]、目标 `src/engine/types/` 契约与相关同步测试；字段语义不明时补 [[docs/docs-829/03-data-structures/engine-contracts]] |
| Datapack 包结构 / 默认内容 / 导入 | [[docs/docs-829/03-data-structures/datapack-contracts]]；装载流程不明时补 [[docs/docs-829/04-mechanisms/data-services/pack-loading]]。正式 base 从 `src/arona-clicker/content/default-datapack.ts` 进入；Gameplay B 样例是 Runtime 装配的可选 `gameplay-b@1.0.0` bundle；`src/data/test-datapack.ts` 是测试 / 示例内容 |
| Registry / Definition resolution | [[docs/docs-829/03-data-structures/registry]]，再核对目标 registry、resolver 与测试 |
| 独立 Datapack Editor / Schema Editor | [[docs/docs-829/02-modules/datapack-editor]]；编辑器协议或复杂表元数据时补 [[docs/docs-829/05-conventions/schema-sync]] |

只读命中的行；改变依赖边界时补 [[docs/docs-829/05-conventions/architecture-discipline]]。跨子题时合并，目标源码及相关测试按实际影响读取。

## Optional Read Set

- `tools/datapack-editor/schema/editor-extras.ts`
- [[docs/docs-829/06-wiki/20-data-services/registry]]
- [[docs/docs-829/01-architecture/data-flow]]

## 默认不读

- `tools/datapack-editor/` 的 UI 实现，除非任务明确涉及独立编辑器
- `docs/plan-work/archive/**` 的多包规划，除非任务恢复未决方向

## 验证入口

字段或枚举变化时运行 `npm run gen:schema` 与相关同步测试；契约变化时补类型检查。只改文档时运行 `npm run check:docs`。
