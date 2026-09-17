# Task 0083：数据包加载策略持久化与启动自动恢复

状态：已完成

## 背景

数据包包库、启用集与排序已由 `PackManager` 管理，并通过 IndexedDB 保存快照。当前启动流程会等待快照恢复后调用 `applyEnabledPacks()`，但运行时层的异步保存责任并不完整：`applyPackConfiguration()` 成功调用 `PackManager.applyConfiguration()` 后，没有明确把最新策略写回异步快照存储。

因此用户在数据包工作区应用启用集后，当前会话可能正确加载，但重新启动时恢复到旧策略，表现为必须再次手动启用或应用数据包。

## 目标

1. 用户成功应用数据包启用集后，最新启用状态与排序可靠持久化。
2. 启动完成包库恢复后，自动按已保存策略加载所有已启用数据包。
3. 首次启动、没有快照或快照需要补正时，仍能建立可恢复的基础策略。
4. 非 `base` 数据包失效时继续自动停用并保存停用结果；`base` 失效仍然显式失败。
5. 所有包库策略变更入口遵守一致的持久化责任，不出现只改内存的路径。

## 范围

### 包含

- `AronaClickerRuntime.applyPackConfiguration()` 的成功持久化。
- 启动恢复、基础包补入和启用集自动应用时序。
- 包库导入、启用/停用、排序、应用配置和失效包自动停用的持久化核对。
- IndexedDB 异步存储失败时的日志与可观察错误处理。
- Runtime / PackManager 回归测试。

### 不包含

- PlayerState 存档迁移。
- 包格式或 `Datapack` 实体字段变更。
- 新的数据包 UI 设计。
- 已导入包内容的自动修复。

## 设计约束

- 包库快照保存的是包记录、启用集和排序；加载策略不另设第二份状态。
- `PackManager` 保持同步纯逻辑；异步 IndexedDB 生命周期由 `AronaClickerRuntime` 组合层负责。
- 启动不得绕过 `PackManager` 直接加载默认包。
- 应用启用集必须先完成 Registry 校验，再重载运行时；失败不得持久化失败策略。
- 非 `base` 内容校验失败时只自动停用可选包并保留包库记录。

## 实施切片

1. 梳理所有 `PackManagerSnapshot` 写入入口，明确运行时层的统一保存点。
2. 修复启用集应用成功后的异步快照保存，并避免失败配置覆盖已保存策略。
3. 补强启动恢复：恢复快照、自动应用启用集、必要时保存补正后的策略。
4. 增加首次启动、刷新恢复、应用策略后刷新、失效包自动停用等测试。
5. 运行类型检查、架构检查、文档检查及相关测试。

## 验收标准

- 在数据包工作区启用并应用一个可选包后，重新创建运行时或刷新页面，包仍自动加载。
- 启动时无需用户再次点击“启用”“应用”或手动启动数据包。
- 包库中未启用的包不会因启动恢复被加载。
- 包的排序在重启后保持一致。
- 失效可选包被自动停用后，刷新不会再次自动启用它。
- 保存失败不会将错误状态显示为已持久化成功，并且有 DevLog 记录。
- `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与相关 Vitest 测试通过。

## 关联

- 前置：[[adr-0004-datapack-management]]
- 机制入口：[[docs/docs-828/01-architecture/run-logic]]
- 数据包管理实现：`src/data-services/datapack/pack-manager.ts`、`src/data-services/datapack/pack-storage.ts`
- 运行时启动实现：`src/ui/main.ts`、`src/app/runtime-bootstrap.ts`、`src/arona-clicker/runtime.ts`

## 执行记录

- 2026-09-16：创建任务；确认主要缺口位于 `applyPackConfiguration()` 成功后未调用异步包库快照保存。
- 2026-09-16：在 `applyPackConfiguration()` 成功后补写异步快照；启动应用启用集后也保存补正结果；新增异步恢复、应用后持久化、下一次启动自动加载回归测试。
- 2026-09-16：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与包管理回归测试通过。
