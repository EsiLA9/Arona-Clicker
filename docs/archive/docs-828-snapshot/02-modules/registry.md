# 02-modules/registry — 数据包 Registry 模块卡片

> 一句话：`Registry` 装载、合并并校验 Datapack 定义，维护查询索引，也承载受控的 Init / Area / Spot 热内容变更。模块细节见 [[docs/archive/docs-828-snapshot/02-modules/registry-wiki]]。

## 快速路由

- Wiki 参考页：[[docs/archive/docs-828-snapshot/02-modules/registry-wiki]]。
- 表、索引与加载期校验：[[docs/archive/docs-828-snapshot/03-data-structures/registry]]。
- 数据包契约与类型：`src/data-services/contracts/datapack.ts`。
- Def builder：`src/engine/def-factory/` 与 `src/arona-clicker/content/def-factory/`。
- 字段或枚举变更遵循 [[docs/archive/docs-828-snapshot/05-conventions/schema-sync]]。

## 关键实现与测试

| 文件 | 职责 |
| --- | --- |
| `src/data-services/registry/registry.ts` | 表、加载/合并、查询、关系索引及受控热 CRUD |
| `src/data-services/registry/registry-validate.ts` | Datapack 结构、ID、引用与字段规则校验 |
| `src/data-services/registry/registry-spot-mutation.ts` | Spot 变更操作与可回滚 receipt 类型 |
| `src/data-services/registry/registry-world-mutation.ts` | Init / Area 变更操作与 receipt 类型 |
| `tests/engine/registry.test.ts` | Registry 加载、合并、查询、校验与清理测试 |
| `tests/data/registry-spot-mutation.test.ts`、`tests/engine/runtime-world-hot-crud.test.ts` | 热内容操作覆盖 |
