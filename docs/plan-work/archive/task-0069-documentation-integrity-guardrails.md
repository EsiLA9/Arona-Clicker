# Task-0069：文档完整性与链接稳定性护栏

状态：done — 2026-09-15 施工完成；其中活跃层相关规则已随计划层冻结而退役（见文末更正）

> 本文承接 [[task-0064-project-documentation-exit-governance]]：准出规则已经成立，但它们依赖人工自觉。本文把三条最易腐化的规则改造成**可机械检查**的护栏——状态单点化与封闭词表、plan-work 链接按身份、`npm run check:docs` 静态检查。

## 目标

1. **状态单点化 + 封闭词表**：每份计划文档恰有一处 `状态：` 行，取值来自固定词表，可被检查器断言；索引、机制聚合页与 `docs-828` 只做链接，不再各自维护状态。
2. **链接按身份而非位置**：引用 `docs/plan-work/{active,completed,newPlan}/` 下的文档一律使用裸文件名；目录迁移不再产生连锁改名。
3. **静态检查落地**：`npm run check:docs` 在本地与提交前挡住结构性腐化，不引入元数据体系。

## 非目标

- 不引入 YAML frontmatter、文档数据库或自动状态同步；
- 不批量重写历史正文；已失效的历史描述只加「更正（日期）」标注；
- 不做语义过期判断（不判断机制是否覆盖源码），只做可机械核实的结构检查；
- 不重排 `docs-828` 分区，不改 `docs-828` 的链接写法（其目录稳定）。

## 设计边界

### 状态词表

固定五个取值，写在 `状态：` 行首，其后可跟自由说明：

| 取值 | 含义 | 典型目录 |
| --- | --- | --- |
| `draft` | 未裁定的设计草案 | `newPlan/` |
| `proposed` | 已裁定或已核验，等待开工/授权/评审 | `active/` |
| `active` | 有明确施工或验收在推进 | `active/` |
| `closing` | 主范围已完成，仅剩准出必需事项 | `active/` |
| `done` | 已达四项准出条件并归档 | `completed/` |

### 链接策略

| 目标 | 写法 | 理由 |
| --- | --- | --- |
| `docs/plan-work/{active,completed,newPlan}/**` | 裸文件名，如 `[[task-0064-project-documentation-exit-governance]]` | 生命周期目录会移动，路径不能进身份 |
| `docs/docs-828/**`、`plan-work/mechanisms/**`、`plan-work/archive/**`、`plan-work/archive/**` | 全路径 | 目录稳定，路径可读性更高 |
| 任何名为 `00-index` 的导航文件 | 全路径 | 该名字在多个目录重复，裸名会歧义 |

配套唯一性约束：`plan-work` 生命周期目录下的文件名必须全局唯一，否则裸名链接无定义。

### 历史失效的标注规则

历史正文不改写。已失效的描述在文末加：

```markdown
- 更正（YYYY-MM-DD）：
  - 本文 §X 的「……」已失效；当前源码/事实为 ……。以源码为准，不再改写本文历史正文。
```

## 当前事实与代码落点

- 文档库入口：[[docs/docs-828/00-INDEX]]；维护规则：[[docs/docs-828/05-conventions/doc-maintenance]]。
- 计划区：`docs/plan-work/archive/`、`completed/`、`newPlan/`。
- 检查脚本：`scripts/check-docs.mjs`；命令登记在 `package.json`。
- 既有同类脚本：`scripts/check-architecture-boundaries.mjs`、`scripts/gen-engine-schema.mjs`。

## 施工切片

### G0：规则固化

- [x] 在 [[docs/docs-828/05-conventions/doc-maintenance]] 写入状态词表、链接策略、更正规则、拆 Task 判据与静态检查范围；
- [x] 在 [[docs/plan-work/00-index]] 声明状态唯一来源与词表出处；
- [x] 在 `AGENTS.md` 命令表登记 `npm run check:docs`。

### G1：链接迁移

- [x] 把指向 `plan-work/{active,completed,newPlan}/` 的链接改为裸文件名（727 处）；
- [x] 校验 `plan-work` 生命周期目录内无重名文件（0 处冲突）。

### G2：状态统一

- [x] 按词表归一 `active/`（57 份：31 改写 + 26 新增）、`newPlan/`（8 份新增）、`completed/`（40 份：32 改写 + 8 新增）的状态行，保留原有说明文字。

### G3：check:docs

- [x] 实现七项检查并接入 `npm run check:docs`（规则 1–6 为阻断项；另含 `newPlan` 草案登记检查）。

## 检查项（check:docs 范围）

1. WikiLink 目标存在（裸名按文件名解析，全路径按路径解析）；
2. 指向 `plan-work/{active,completed,newPlan}/` 的链接不得使用路径写法；
3. `plan-work` 生命周期目录内文件名全局唯一；
4. 文档引用的源码路径存在（历史「已删除文件」语境豁免）；
5. 每份计划文档恰有一处 `状态：` 行，且取值在词表内；
6. `completed/` 文档出现「待施工 / 尚未实现 / TODO」时，必须有 `归档结果` 段解释。

## 测试与验收

```text
npm run check:docs
npx tsc --noEmit
npm test
```

- `npm run check:docs` 对当前文档库全绿（189 份 Markdown，0 error）；
- **归档演练**：以 `roadmap-0024-lobby-pre-init-runtime` 实测，仅移动文件、不改任何引用，`check:docs` 报出的唯一问题是被移动文档自身的状态与目录不符；把状态行改为 `done` 后即全绿，**引用方零改动**。这正是本任务的核心验收口径；
- 本轮不修改运行时代码。

## 当前核验（2026-09-15）

- 归一前基线：57 份 `active/` 中有 27 份**完全没有状态行**，其余为自由散文 + emoji，无法被检查器断言；
- 链接迁移 727 处，跳过 0 处（说明生命周期目录文件名全局唯一成立）；
- `check:docs` 首次运行抓出 11 项，其中 2 项为检查器自身缺陷（导航文件豁免用 `00-index.md` 与无扩展名基线比较、根目录 `AGENTS.md` 未进索引），6 项为模板占位符误报，均已修正；修正后 0 error；
- 归档演练见上；演练文件已还原到 `active/` 并恢复 `closing` 状态。

## 剩余工作

- 无阻塞项。本任务的护栏价值取决于**是否被真实执行**：`check:docs` 需要在文档改动后运行（可与 `npm test`、`npm run check:architecture` 并列）。

## 相关路由

- [[task-0064-project-documentation-exit-governance]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/plan-work/00-index]]
- `scripts/check-docs.mjs`、`package.json`

## 更正（2026-09-15）

本任务建立的护栏在当时成立，但**当天稍后计划层被整体冻结**（`active/`、`completed/`、`newPlan/`、`review/` 合并为 `plan-work/archive/`），因此其中一部分已失去意义：

- **仍然有效**：
  - 裸文件名链接策略——冻结后的批量搬迁正是靠它做到引用方零改动；
  - `docs/plan-work/` 内文件名唯一约束；
  - 每份文档文首单一 `状态：` 行（现作为**阅读图例**，不再强制）。
- **已退役**（无活跃层可断言，保留规则文本供将来重新启用计划层时参考）：
  - 状态取值与目录一致性校验；
  - `completed/` 未完成表述必须有 `归档结果` 段的校验；
  - `newPlan/` 草案必须登记的校验。

`npm run check:docs` 已相应简化为三项：链接目标存在、`plan-work` 内文件名唯一、引用的源码路径存在。详见 [[docs/docs-828/05-conventions/doc-maintenance]] 的「静态检查」。

## 相关路由

- [[task-0064-project-documentation-exit-governance]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/plan-work/00-index]]
