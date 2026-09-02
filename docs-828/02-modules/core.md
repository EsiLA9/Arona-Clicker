# 02-modules/core — 横切基础（事件总线 / Tag / 主题运行时）

> 一句话：`src/engine/core/` 提供无领域逻辑的横切基础设施——事件总线、Tag 匹配、运行时主题、ID 工厂、开发日志。

## 职责边界

- **管**：事件广播通道、标签前缀匹配、临时主题层管理、实体/资源 ID 常量、显示名解析、开发日志。
- **不管**：任何领域规则（结算/条件/效果都在上层系统）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `event-bus.ts` | 全局事件总线：`on / onAny / off / emit / flush / clear`；mutation 写状态后广播的通道，也是增量缓存失效的入口。派发先特定后通配；`flush` 期间 `emit` 入队（重入保护） |
| `tag.ts` | Tag 匹配（`matchesTag`，按 id 前缀），供强化反向索引、产出查询、条件系统使用 |
| `theme-runtime.ts` | `RuntimeThemeManager`：临时演出层恒最高；player/area/student 相对优先级玩家可自定义（`setLayerOrder`，落 `state.themeLayerOrder`） |
| `entity-id.ts` / `anonymous-id.ts` | 实体 ID 工厂 / 匿名实体确定性派生 id（`anon:` 前缀） |
| `resource.ts` | 资源 ID 常量（含 `GLOBAL_RESOURCE_IDS`，青辉石为唯一跨世界线全局资源） |
| `display-name.ts` | 显示名解析（角色显示名等） |
| `chara-profile.ts` | 通用角色显示/ID 辅助；产品角色档案服务位于 `src/arona-clicker/services/` |
| `dev-log.ts` | `DevLog`：循环 tick 记录，供调试面板消费（`game.getDevLogs()`） |

## 核心概念

- **事件对象统一携带 `stats?: StatsContext`**（当前 AronaClicker `GameEvent` 联合末尾 `& { stats?: StatsContext }`）；基础 `EventBus` 支持泛型事件，产品事件目录位于 `src/arona-clicker/contracts/event-catalog.ts`。
- **Tag 是纯语义标记**：匹配按 id 前缀（`hasTag` / `countTags` / zoneModifiers），`TagDef` 的 name/description 仅 UI 展示。

## 测试入口

`tests/engine/event-bus.test.ts`、`tests/engine/dev-log.test.ts`、`tests/engine/entity-theme.test.ts`

## 相关文档

[[docs-828/04-algorithms/trigger-effect]]（GameEvent 事件目录）· [[docs-828/04-algorithms/color-derivation]]（主题分层）
