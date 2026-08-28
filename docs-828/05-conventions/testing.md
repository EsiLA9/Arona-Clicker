# 05-conventions/testing — 测试规范

> 架构纪律 6：机制改动必须带 vitest 测试，`npm test` 通过才算完成。

## 命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | vitest 全量（= `vitest run`，非 watch） |
| `npm run test:watch` | watch 模式 |
| `npx vitest run tests/engine/game-num.test.ts` | 单文件定向 |
| `npx tsc --noEmit` | 类型检查（编译期守卫如 `PER_INIT_KEY_GUARD`、`EVENT_CATALOG` 穷尽也在此暴露） |

## 目录镜像

| 测试目录 | 对应源码 |
| --- | --- |
| `tests/engine/` | `src/engine/` 各子系统（按机制命名，如 `affector-reconcile.test.ts`、`game-num-invalidation.test.ts`） |
| `tests/engine/def-factory/` | `src/engine/def-factory/` builder 单测 |
| `tests/engine/game/` | `src/engine/game/` 门面服务 |
| `tests/data/` | `src/data/`（默认数据包加载、zip） |
| `tests/ui/` | `src/ui/`（渲染快照类） |

## 写测试的约定

- **机制改动 = 新测试**：新 Trigger kind / EffectOp / 状态字段至少覆盖「正路径 + 一个拒绝/边界」；
- **事件契约**：新增事件须登记 `EVENT_CATALOG`（编译期穷尽），有专属订阅方的补订阅行为测试；
- **默认数据**：默认加载的数据是 `src/data/base/*`（TypeScript），不是 `datapack/` 下 JSON——改默认行为/示例必须改 `src/data/base/` 并同步 `tests/data/`；
- **不留迁移测试**：不做存档迁移（纪律 7），旧结构测试直接改断言。

## 相关文档

[[docs-828/05-conventions/architecture-discipline]] · [[docs-828/05-conventions/refactoring]]
