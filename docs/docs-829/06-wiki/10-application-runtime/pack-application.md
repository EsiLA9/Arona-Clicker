# 06-wiki/10-application-runtime/pack-application — 启用包到运行时定义

> 本文回答：PackManager 管理的包选择如何形成 Runtime 使用的有效定义集。

## 协作流程

```text
包导入 / 内置默认包
  → PackManager 保存包记录与启用选择
  → AronaClickerRuntime.applyEnabledPacks()
  → PackManager apply plan 调用 Runtime target
  → GameInstance.init(datapacks)
  → Registry.load() + 全集后校验 + 派生系统重建
```

PackManager 保存包记录、身份、启用选择和应用计划；它不执行游戏机制。Runtime 负责提供 apply target、捕获/恢复当前运行快照、加载图片资源和触发 Runtime 重建。Registry 负责定义装载、单包检查、表合并和索引；部分引用在全部启用包加载后才校验。

可选包失效后的隔离与再次应用逻辑位于 `src/arona-clicker/runtime.ts`；Registry 本身不是包库策略管理器。包解析和 Registry 见 [[docs/docs-829/06-wiki/20-data-services/00-index]]。

## 源码与测试

源码：`src/data-services/datapack/pack-manager.ts`、`src/arona-clicker/runtime.ts`、`src/arona-clicker/runtime-game-instance.ts`、`src/data-services/registry/registry.ts`。测试：`tests/engine/arona-runtime-pack.test.ts`、`tests/data/pack-manager.test.ts`。
