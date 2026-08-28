# docs-824 — 03 数据结构（索引）

> 本文回答：**程序运行时持有哪些数据？PlayerState 长什么样？Registry 存什么？Character 实体系统如何设计？**
> 按主题拆分为 4 篇子文档，本篇保留表格导航。

## 四层数据关系

```text
Datapack 声明（JSON/TS 定义）
    ↓ Registry 编译态（表 + 关系索引 + 校验）
        ↓ PlayerState 运行时（三层：Global + per-Init 快照 + per-Init 增量）
            ↓ GameView 只读快照（UI 消费）
                                    ↑ StatsService 三层统计并行
```

## 阅读路径

| 子文档 | 主题 | 原章节 |
| --- | --- | --- |
| [[docs-824/03a-player-state]] | PlayerState 运行时状态结构 | 原二章 |
| [[docs-824/03b-registry]] | 注册表结构：表 + 关系索引 + 校验 | 原三章 |
| [[docs-824/03c-character-entities]] | Character 实体：差分/卡池/曲线/色彩 | 原四章 |
| [[docs-824/03d-stats-views]] | 三层统计 & UI 只读视图 | 原五、七章 |
| [[docs-824/03e-id-reference-semantics]] | 带 id 的 Def 条目与引用语义（真引用 / 意义引用） | 新增 |
| [[docs-824/03f-declarative-dsl]] | 声明式 DSL 枚举目录（ValueExpression / Condition / Effect / Funclet / Trigger / Extra / Reveal / 角色色彩抽卡） | 新增 ==new== |

---

下一步读 [[docs-824/04-core-algorithms]]（生产/抽卡/培养/色彩/事件联动的具体算法）。