# docs-824 — 02b 初始化：init(datapacks) / reload

> 原文出处：`02-run-logic.md` 三章。初始化 = 数据落地 + 索引建立 + 默认世界线进入。

## init(datapacks)：启动唯一一次

`src/engine/game-instance.ts` `init(datapacks)` 顺序：

1. **组装 Registry**：全部 Datapack → 表 + 关系索引 + 名称解析器，完成时触发 `registry:built` 事件。
2. **建产出树**：`gameNumSystem.buildAll()` 构建 Gain 树 / Spot 子树 / zone 节点（依赖 registry 的 managerExtra/characterSystem），见 [[docs-824/04b-production]]。
3. **进入默认世界线**：`setActiveInit(activeInitId)` → 解锁 + 建 per-init 状态 + 挂载专属 Trigger（`mountInitTriggers`）+ 发 `init:mounted`。

## 状态初始化分层

- 新建状态：`createDefaultState()` → per-Init 快照统一结构（flag/extra/stat/resource/item/enh/spot 等级 8 类增量记录）。
- 读档：`load(data)` 直接替换 `this.state`，随后同步各子系统（statsService.setRunId / mutationService.setState / visibilityEngine.refresh）并 `rebuildRuntime`。
- 校验：`data.version` 与当前存档版本不符直接抛错（旧存档失效，见 AGENTS.md「不做存档迁移」）。

## reload()：仅读档后触发

```text
load() → this.state = parsed
       → syncSubsystems()         各系统持有新 state 引用
       → this.rebuildRuntime()    重算 visibility 快照 + tag 反向索引 + 统计游标
```

`rebuildRuntime`（`game-instance.ts`）：visibilityEngine.refresh + tagStatService.rebuildIndex + StatsService.runId 恢复（本次游玩统计继续累计）。

---

上一篇：[[docs-824/02a-assembly]] · 下一篇：[[docs-824/02c-tick-loop]]
