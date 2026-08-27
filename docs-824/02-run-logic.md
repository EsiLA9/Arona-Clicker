# docs-824 — 02 运行逻辑与顺序（索引）

> 本文回答：**程序从启动到运行的主干时序，子系统如何被装配，每帧发生什么。**
> 按主题拆分为 5 篇子文档，本篇保留总体调用链与导航。

## 总体调用链

```text
main.ts（UI 启动）
  └─ new GameInstance()            组装全部子系统（构造器内依赖注入 + 事件接线）
       └─ init(datapacks)          加载数据包 → 校验 → 建索引 → 建产出树 → 进入默认 Init
            └─ start()             启动会话循环（1 tick/秒）
                 └─ tick()         每帧：生产结算 → Affector 生效 → Effect 同步 → 阻断复检 → 统计
                      │
                      ├─ getView()            UI 只读拉取快照
                      ├─ save() / load()      存档导出 / 恢复
                      ├─ travelToArea()       区域移动（可达性门槛链）
                      └─ ...                  各业务门面（升级/招募/培养/剧情…）
```

## 阅读路径

| 子文档 | 主题 | 原章节 |
| --- | --- | --- |
| [[docs-824/02a-assembly]] | 构造器：子系统装配顺序 + 事件接线 | 原二章 |
| [[docs-824/02b-init-sequence]] | 初始化 `init(datapacks)` / `reload` | 原三章 |
| [[docs-824/02c-tick-loop]] | 运行循环：`start`/`tick`/`recheckStudentBlocks` | 原四章 |
| [[docs-824/02d-biz-operations]] | 业务门面操作与 UI 只读消费 | 原五、八章 |
| [[docs-824/02e-save-load-restart]] | 存档 / 读档 / 重置 / 三条重启路径 | 原六、七章 |

## 推荐阅读顺序

按程序实际执行顺序读：**构造装配（02a）→ 初始化（02b）→ 运行循环（02c）→ 业务操作（02d）→ 存档重启（02e）**。

---

下一步读 [[docs-824/03-data-structures]]（这些运行时持有的 `PlayerState` / `GameView` 长什么样）。
