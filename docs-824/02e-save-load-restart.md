# docs-824 — 02e 存档 / 读档 / 重置 / 重启路径

> 原文出处：`02-run-logic.md` 六、七章。项目不做存档迁移（AGENTS.md 纪律 7），结构可破坏性变更。

## 存档（save()）

```text
save() → 深拷贝 this.state（含三层统计与聊天历史 UI 态）
       → 返回 SaveData（version + PlayerState + stats + chatHistories）
UI：SaveSystem.save(withHistories(game.save()))
```

- 存档含**全部跨世界线数据**：Global 资源/解锁/统计 + per-Init 快照 + 当前 per-init 增量；
- 聊天历史由 UI 层 `withHistories` 注入（不污染引擎状态）。

## 读档（load(data)）

```text
load(data) → 校验 version（不匹配抛错）
           → this.state = parsed
           → syncSubsystems()（各系统换引用）
           → rebuildRuntime()（visibility + tag 索引 + runId）
```

- 读档后 UI 调 `restoreHistories` 恢复聊天沙盒。

## 重置路径（三条 + 彻底重置）

| 路径 | 触发 | 保留 | 清空 |
| --- | --- | --- | --- |
| 保存式重启 `restartInit` | 软重启按钮 | Global 进度/统计 + 当前 Init 快照 | 当前 per-init 运行时 |
| 不保存式重启 `resetInitProgress` | 重启按钮（有警示） | Global 进度/统计 | 当前 Init 全部（含快照） |
| 切回世界线 `travelToInit` | 世界线切换 | 各 Init 快照 | — |
| 彻底重置 `reset()` + 删存档 | 「彻底重置」按钮 | 无 | 全部 + 本地存档 |

- `restartInit`：先存快照再清，保证可恢复；`resetInitProgress`：直接清，不可恢复（UI 有 confirm）。
- 三条路径都会回到世界线选择页（`resetSessionPanel`）。

---

上一篇：[[docs-824/02d-biz-operations]] · 返回 [[docs-824/02-run-logic]]
