# 06-wiki/10-application-runtime/pack-application — 启用包如何进入游戏

> 本文回答：包库里的哪些 Datapack 会被当前游戏使用，应用失败时如何恢复？

**Datapack** 是一组游戏内容定义，例如世界线、区域、角色和资源。`PackManager` 记录有哪些包、哪些被启用以及应用顺序；**Registry** 则是游戏内根据已装入定义构建的查询表。包库的选择与当前 Registry 内容是两件事。

## 一次包应用

```text
内置 / 导入 / 开发包
  → PackManager 保存包记录、启用选择和顺序
  → AronaClickerRuntime.applyEnabledPacks()
  → PackManager 生成并应用 Apply plan
  → Runtime target 校验并重载 GameInstance
  → Registry.load(Datapack) + 全部包合并后的引用核验
  → 清空旧图片并注册当前启用包的图片
```

运行时由 `AronaClickerRuntime.applyEnabledPacks()` 调用 `PackManager.applyEnabled(target)`。**Apply target** 是 Runtime 提供给 PackManager 的回调集合：可以验证 Datapack、保存当前运行快照、重载 Runtime、清理图片并注册新图片。PackManager 规划“应用哪些包”，Runtime 执行“怎样让游戏使用这些包”。

Runtime 重载时清 Registry 与机制缓存、重建状态和系统，再加载新内容。Apply target 在开始前捕获当前 Datapack 与存档快照；若重载或图片注册失败，会尝试恢复旧运行内容。包状态与策略快照由包存储保存，游戏进度则走 Runtime 的存档接口，两种数据不可混为一份。

## 哪些包会启用

- 正式 base 包是必需的，不能从启用集移除。
- Gameplay B Carousel 内容由独立 bundle `gameplay-b@1.0.0` 提供；13 地点 Strategy Park 测试样例由 `gameplay-b-strategy-park@1.0.0` 提供。新安装时两包默认启用，但各自保存的用户选择（例如明确停用）优先。
- 开发目录发现的普通态包只有在其来源唯一且没有相同 `modName` 冲突时才可能自动启用；已有停用选择会保留。
- 启用集无效时，Runtime 会逐个检查可选包；能安全排除的包会停用并保留在包库，再应用剩余启用集。无法恢复时仍向启动层报告失败。

这些策略可从 `src/arona-clicker/runtime.ts` 的构造、`restorePackManager()` 与 `applyEnabledPacks()`，以及 `src/data-services/datapack/pack-manager.ts` 的构造和 `reconcileDevelopmentPacks()` 核对。

## 代码与测试

- 包选择和应用计划：`src/data-services/datapack/pack-manager.ts`。
- 产品 Runtime 回调、校验和失败恢复：`src/arona-clicker/runtime.ts` 的 `applyEnabledPacks()`、`createPackApplyTarget()`。
- Registry 装载：`src/arona-clicker/runtime-game-instance.ts` 的 `init()`。
- 测试：`tests/data/pack-manager.test.ts` 核对首次默认包、保留停用选择、开发包唯一性与快照；`tests/engine/arona-runtime-pack.test.ts` 核对默认包装载、Lobby 状态和坏包自动停用。

解析包文件格式与 Registry 正文分别见 [[docs/docs-829/06-wiki/20-data-services/00-index]]、[[docs/docs-829/03-data-structures/registry]]；启动入口见 [[docs/docs-829/06-wiki/10-application-runtime/startup-and-composition]]。
