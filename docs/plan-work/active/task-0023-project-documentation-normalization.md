# Task-0023：项目文档与机制资料整理

> 目标：在不破坏现有代码、历史决策和 Obsidian 链接的前提下，建立稳定的文档分区、机制事实源和逐篇校验流程。
> 本任务只管理整理工作；机制正文仍以 `docs/docs-828/` 中的当前文档为准。

## 任务目标表

| 编号 | 目标 | 当前问题 | 目标产物 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D1 | 建立文档职责边界 | 架构、模块、算法、机制、计划之间存在交叉 | `docs/docs-828/` 分区说明 + `docs/plan-work/` 工作入口 | 每类内容只有一个当前事实源 | ✅ 已完成第一轮 |
| D2 | 设立机制文件夹 | 当前机制说明集中在 `04-algorithms`，名称不能覆盖全部机制 | `docs/docs-828/04-mechanisms/00-index.md` | 明确机制正文、算法推导、模块卡片的边界 | ✅ 入口已建立 |
| D3 | 迁移机制正文 | 生产、抽卡、培养、色彩、触发等文档原在旧目录 | `docs/docs-828/04-mechanisms/` 正式正文 | 迁移后全库链接可解析，旧目录不再承载当前机制正文 | ✅ 已完成 |
| D4 | 完成技术文档逐篇核验 | 部分模块卡片、数据结构和审计文档只做过关键词扫描 | 核验记录与修订后的文档 | 每篇记录代码路径、测试证据、核验日期 | ✅ 第一轮完成 |
| D5 | 收敛计划与路线图 | active、docs/newPlan、registry&saves 存在交叉和状态漂移 | 更新后的 `docs/plan-work/00-index.md` 与主题入口 | 每个活跃主题有唯一状态入口 | ✅ 第一轮完成 |
| D6 | 区分当前事实与历史记录 | completed 文档可能被误读为当前实现规范 | 历史文档标记与当前入口链接 | 不改写历史决策正文，只补充状态和导航 | ✅ 第一轮完成 |
| D7 | 建立文档维护协议 | 文档更新与代码改动容易脱节 | 文档变更检查表 | 机制/类型/路径变更均有对应更新动作 | ✅ 已有并纳入任务规则 |
| D8 | 清理失效链接与旧路径 | 重构后仍可能保留旧目录、旧入口和旧命令 | 链接/路径审计结果 | WikiLink 目标检查无缺失；当前文档无旧机制路径 | ✅ 第一轮完成 |
| D9 | 建立最终验证闭环 | 文档修订后缺少统一验证记录 | 文档核验报告 | 类型检查、架构检查、测试结果与文档状态一致 | ✅ 已完成 |

## 目录职责

| 目录 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| `docs/docs-828/01-architecture` | 系统边界、启动、运行时序、状态分层、数据流 | 具体玩法公式、未来计划 |
| `docs/docs-828/02-modules` | 子系统职责、入口、依赖、生命周期 | 跨模块算法的完整推导 |
| `docs/docs-828/03-data-structures` | 状态、实体、引用语义、DSL 数据结构 | 任务状态和历史决策 |
| `docs/docs-828/04-mechanisms` | 当前可执行机制、规则、结算管道、联动算法 | 仅描述模块职责的卡片 |
| `docs/docs-828/05-conventions` | 架构纪律、测试、Schema、重构、文档维护 | 具体机制设计 |
| `docs/docs-828/07-audit` | 审查发现、风险、整改记录 | 取代当前规范的长期事实源 |
| `docs/plan-work/active` | 当前 ADR、Roadmap、Task 和状态 | 复制机制正文 |
| `docs/plan-work/completed` | 已完成决策和历史施工记录 | 继续追踪当前实现 |
| `docs/plan-work/docs/newPlan` | 尚未裁定的方案草稿 | 当作已批准机制 |

## 执行顺序

1. 完成 `docs/docs-828/04-mechanisms/` 的索引和机制正文迁移。
2. 逐篇核验尚未完整检查的模块、数据结构和审计文档。
3. 迁移机制正文并批量修复内部链接；迁移前后不得保留两份当前正文。
4. 核验 `docs/plan-work` 的 active/docs/newPlan/completed 状态和入口。
5. 执行失效路径、Obsidian 链接、类型、架构和测试检查。
6. 在本文任务表中记录每个目标的完成证据。

## 当前未完整核验清单

- `docs/docs-828/02-modules/affector.md`
- `docs/docs-828/02-modules/game-num.md`
- `docs/docs-828/02-modules/pics.md`
- `docs/docs-828/02-modules/state-mutation.md`
- `docs/docs-828/02-modules/story.md`
- `docs/docs-828/03-data-structures/character-entities.md`
- `docs/docs-828/03-data-structures/id-reference-semantics.md`
- `docs/docs-828/03-data-structures/type-boundary-audit.md`
- `docs/docs-828/07-audit/00-overview.md`
- `docs/docs-828/07-audit/dual-track-state.md`
- `docs/docs-828/07-audit/presentation-fallbacks.md`
- `docs/docs-828/07-audit/sync-burden.md`

## 记录规则

- 文档正文中的代码路径、字段、枚举、测试命令必须以当前源码为证据。
- 未来设计写入 `active` 或 `docs/newPlan`，不得混入 `docs/docs-828` 当前机制正文。
- 历史决策保留原文；若已失效，只在文首和索引中标明历史状态并链接当前事实源。
- 机制正文已统一位于 `docs/docs-828/04-mechanisms`；`docs/docs-828/04-algorithms` 只保留迁移说明。

## 已完成核验记录

### 2026-09-06：计划入口与活动任务第一轮

- 核验 `registry&saves/00-index`：包库快照恢复已接线；导入包不删除游戏存档；跨包统一 dry-run、文件夹/单文件 Source、惰性存档和通用残留管理仍未完成。
- 核验 `roadmap-0020-service-workspaces`：工作区壳、UI Host、包库草案/校验/应用和基础包保护已落地；存档、统计、完整图鉴与完整失败恢复仍待实施。
- 核验 `task-0021-datapack-workspace-repair`：保留修复前问题作为历史快照，新增当前状态说明。
- 核验 `task-0022-theme-definition-and-custom-theme-repair`：第一阶段主题默认值、用户主题 draft/校验/应用/预览已落地，标题状态已更新。
- `git diff --check` 已通过；本轮仅修改文档，未改变运行时代码。
- 机制正文七篇已从 `docs/docs-828/04-algorithms` 移至 `docs/docs-828/04-mechanisms`，旧目录保留 README 迁移说明；全库 WikiLink 检查无缺失目标。
- `docs/plan-work/00-index` 已增加“已完成但待归档的活动路线”区分，避免把已完成的 roadmap 与未实施方案混为一类。

