# 07-audit/sync-burden — 同步义务与流程负担

> 本文回答：**「改一处要同步 N 处」的义务链哪些可砍、哪些靠机器化，含两处已发生的漂移实证。** 本文记录的是审查时点的问题，不把建议误读为已完成改造。
> `gen:schema` 与 `EVENT_CATALOG` 是多 Datapack 前提（[[docs-828/07-audit/00-overview]]）下的核心资产，**保留**；要砍的是义务链中无机器校验的重复人肉部分。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | 文档手写计数已漂移（同文件 4 vs 5）；loot 描述两处矛盾 | 见下 | 高（实证） |
| 2 | 一次「新增实体字段」义务链 6-7 处，人工项与机器项混排 | 见下 | 中 |
| 3 | schema 字段元信息最多散布 4 处 + overrides 兜底层 | 见下 | 中 |
| 4 | 默认数据双载体三处一致义务 | 见下 | 中 |
| 5 | re-export 兼容层 / 拆前 LSP 分析 / 「不改公共 API」承诺 | 见下 | 低 |

### 1. 漂移实证（防漂移协议自身在漂移）

- **实证一**：`04-mechanisms/trigger-effect.md:15`「聊天流族 **4 种**」 vs `:107`「聊天流族 **5 种**」——同一文件自相矛盾，发生在号称「编译期强制同步」的事件域。
- **实证二**：`trigger-effect.md:16` 称 `loot`「no-op 预留、未接线」，`02-modules/world.md:50` 却写「掉落池结算（`loot` effect → giveItem）」。
- **原因**：速览表手写、无机器校验；`EVENT_CATALOG` 编译期穷尽只管代码不管文档。
- **方案组**：
  - **A（推荐）**：文档规则改为「写语义不写数目」——删一切「N 种」类计数（见 [[docs-828/05-conventions/doc-maintenance]] 写作规则），速览表只列名称与用途，以 `EVENT_CATALOG` 为唯一权威。
  - B：脚本从 `EVENT_CATALOG` 生成速览表（根治，但引入生成步骤）。

### 2. 新增字段义务链

- **位置**：`05-conventions/doc-maintenance.md:24-32`（维护触发器表）+ `05-conventions/schema-sync.md:7-15`（5 步流程）+ `05-conventions/testing.md:27-28`（事件登记 / 双数据源）——合计一次改动 6-7 处同步，其中文档部分纯靠自觉。
- **方案组**：
  - **A（推荐）**：义务链收敛为一页 checklist（按变动类型分行，每条标 ✅ 机器校验 / ⚠️ 人工），人工项压缩为「同步两篇文档」。
  - B：维持三篇分散（现状）。

### 3. schema 元信息 4 处 + overrides 兜底

- **位置**：`05-conventions/schema-sync.md:9-14`（TSDoc 注解 + 生成 JSON + `editor-extras.ts` `TABLE_META.overrides` 兜底 + 三向 sync test）。
- **原因**：一个字段的完整定义最多出现在 4 处；overrides 兜底层的存在说明自动映射覆盖不全——防漂移协议自身成为最大漂移面。
- **方案组**：
  - **A（渐进，推荐）**：把 overrides 高频场景注解化（`@optionsFrom` / `@collapsible` / `@section` 进自动映射），目标「简单字段 0 兜底」；每次触碰某表时顺手迁移，不专项整改。
  - B：保留（三向 sync test 已机器化兜住漏改，实际负担是初写成本）。

### 4. 默认数据双载体

- **位置**：`05-conventions/testing.md`（正式默认行为改 `src/arona-clicker/content/default-datapack.ts`，测试/示例包改 `src/data/test-datapack.ts`；`datapack/` 为可选导入资产）。
- **原因**：同一套默认内容存在 TS 与 JSON 两种载体，外加测试同步断言——一处改动三处对齐。
- **方案组**：
  - **A（推荐）**：明确定位——`datapack/` = 编辑器导出示例包（多包前提下的样例资产），**不要求**与 base 同步，写进 testing.md。
  - B：脚本从 base 生成 JSON（消除双载体，引入生成步骤）。

### 5. 重构过程保险

- **位置**：`05-conventions/refactoring.md:16`（拆前 LSP 全量调用点分析）、`:22,57-63`（re-export 兼容层）、`:68`（不改公共 API 签名）。
- **原因**：三项保险防的是「拆分时改坏」；本项目的主要消费者是 AI 协作者而非人类下游，保留成本已付且低。
- **方案组**：
  - **A（推荐）**：保留 re-export 与拆后验证；「不改公共 API」条款收窄为「不改事件类型与存档结构」（其余签名允许随重构调整）。
  - B：全保留（若 AI 协作回归风险高）。
