# 建立 0x-plan&work 分区（长期目标/路线图）

## 决策（已与你确认）
- **位置**：docs-828 第 8 个编号分区，与 07-audit 同构（00-overview + 分篇目标文档）。
- **称谓**：`08-roadmap/`（路线图）；每篇目标文档称 goal 篇，文件名 `0001-<topic>.md` 编号递增；卡片首行沿用 `# 分区/文件名 — 标题` 格式。
- **首篇**：由 `handoff2.md`（Datapack 多包管理 S1 交接）+ [[0x-plan&work/active/adr-0004-datapack-management]] §8 构造。
- **单一事实源分工**：ADR 0004 仍是设计权威（背景/裁定/实现记录）；roadmap 篇只承载**目标陈述、里程碑切片、状态追踪、验收口径、操作备忘**，不重复设计内容，用 wikilink 回指。

## 变更清单

### 1. 新建 `0x-plan&work/00-index.md`
- 分区定位：长期目标与里程碑追踪；与 ADR（设计权威）/07-audit（问题清单）的分工。
- 目标索引表（编号 / 主题 / 状态 / 链接）。
- 工作模式（沿用 handoff2 的协议）：切片逐个 review → 实现 → `npm test` + `npx tsc --noEmit` 全绿 → 汇报 → 下一片。

### 2. 新建 `0x-plan&work/active/roadmap-0001-datapack-management.md`
从 handoff2.md 构造，结构：
- 目标陈述：引擎支持多 Datapack 并存（三段式 id / 包库 / 启停 / 惰性存档 / mod 管理）。
- 里程碑切片表（S1a 语义组归位+校验基建 ✅ → S1b Story entry id 拆分 ✅ → S1c Character/VariantId 命名空间化（待 review，含现状/目标/建议做法）→ S2 Source 适配器 → S3 manifest → S4 PackManager → S5 惰性存档 → S6 连带 → S7 mod 管理 UI，均未开始）。
- 用户已裁定关键决策 6 条速记（引用 ADR §8 防漂移）。
- 验收口径：每切片 `npm test` 全绿 + `npx tsc --noEmit` 通过 + 用户逐片 review。
- 操作备忘（gen:schema 触发条件、zip 重打包命令、codemod 用完即删等）。
- 进度记录（append-only，首条记录 2026-08-30 S1a/S1b 完成、995 测试全绿）。

### 3. 更新 `docs-828/00-INDEX.md`
- 新增 `## 08-roadmap` 分区表；在「我想理解/我想改」路由表各加一行（长期目标 / 里程碑进度 → 00-overview）。

### 4. 更新 `docs-828/05-conventions/doc-maintenance.md`
- 结构约定表加 `08-roadmap/` 行：长期目标与里程碑追踪（设计权威在对应 ADR，本区只管进度）；每目标 1 篇 + 总览。

### 5. 更新 `AGENTS.md`
- 快速上手路由表加一行：长期目标 / roadmap / 里程碑进度 → [[0x-plan&work/00-index]]。

### 6. 处理 `handoff2.md`
- 内容迁移到 0001 篇后**删除该文件**（会话交接稿，防双源漂移；git 中本就未跟踪，删除即消失）。

## 不做的事
- 不动 ADR 0004 正文（设计权威不变）。
- 不写任何代码、不跑构建；纯文档变更。
- 不提交 git（遵循"用户未要求不提交"）。