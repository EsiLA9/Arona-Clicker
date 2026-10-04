# Task：Registry 代码审查与 Wiki 参考页试点

状态：done — 审查与 Wiki 参考页已完成，审查问题已留档待后续裁定

## 目标

对 `src/data-services/registry/` 做一次只读 Code Review，并以多 Agent 协作产出一份 Wiki 风格的 Registry 参考页，验证它能否作为现有模块卡片的更易浏览的替代呈现。试点只覆盖 Registry，不启动全项目文档系统迁移。

## 设计边界

- 审查以可复现的代码路径、测试和当前机制文档为证据；问题分级并指出文件/符号，不直接修改代码。
- Wiki 页是文档内容试点，不能取代源码、测试或 `docs/docs-828/` 的权威边界。
- 保留 `02-modules/registry` 的稳定入口；试点若成功，可由该入口链接至新页或将其改写为 Wiki 风格，避免产生两份事实正文。
- 不迁移其他模块、不新增 Wiki 框架/工具、不改动 `docs-824/` 或生成文件。

## 当前事实与代码落点

- 文档唯一入口及模块路由：[[docs/docs-828/00-INDEX]]。
- Registry 模块卡片：`docs/docs-828/02-modules/registry.md`。
- Registry 实现位于 `src/data-services/registry/`，具体边界由执行时核对源码与相关测试确定。
- 文档写作及链接规则：[[docs/docs-828/05-conventions/doc-maintenance]]。

## 协作切片

1. **代码审查 Agent**：独立检查 Registry 的主要职责、边界和潜在缺陷，只提交带路径/符号及证据的发现；无发现也要说明覆盖范围。
2. **文档取材 Agent**：依据源码、测试及当前 Registry 文档整理概念、关系、关键流程、入口和待澄清点，不推断未证实机制。
3. **整合 Agent**：核对前两份结果，解决事实冲突或标记未决项，编写最终 Wiki 风格参考页并更新现有入口，确保只有一份正文事实。

各 Agent 独立提交可合并的报告/素材；整合阶段负责交叉核验，不把 Agent 的判断直接当作已确认事实。

## 验收

- Registry Code Review 给出有证据的问题清单，或明确记录未发现问题及审查覆盖面；每项结论可回到源码/测试复核。
- 交付一份结构清晰、Wiki 风格的 Registry 参考页，至少涵盖职责与边界、核心概念/关系、主要数据流或流程、重要源码与测试入口、相关文档路由。
- `02-modules/registry` 与总索引能到达新内容；不存在重复且互相漂移的 Registry 机制正文。
- 事实陈述标注代码或测试路径；推断和待确认项显式标记。
- `npm run check:docs` 通过，Task 涉及的已跟踪文档通过 `git --no-pager diff --check`；全仓检查的既有空行问题在执行结果中说明。
- Task 结尾记录多 Agent 分工、审查结论、实际验证和是否建议扩大试点；不据单个模块试点直接迁移整套参考文档系统。

## 执行结果

### 多 Agent 分工

- 代码审查 Agent：只读检查 Registry 的加载、合并、引用检查、热 CRUD 与相关测试入口。
- 文档取材 Agent：核对 Registry 源码、测试和现有机制文档，整理概念、数据流、边界与路由。
- 整合：交叉核对后编写 Wiki 参考页，并修正卡片、数据结构页、数据流页、架构概览和上下文卡中的过期只读表述。

### Code Review 发现

1. **中等：`Registry.load()` 失败不具原子性。** `load()` 在 `merge()` 前已记录 `_loadedModNames`；而 `tableSteps` 的 gacha pool step 仍可能因非法 `GachaMode` 抛错。前序表已合并时，调用会以异常退出但 Registry 留有部分内容，失败包也留在 loaded 名称集合中。证据：`src/data-services/registry/registry.ts` 的 gachaPools table step 与 `load()`；可通过包含有效早期表数据和非法 gacha mode 的 Datapack 复现。未修改代码，建议后续单独建立修复 Task。
2. **需确认预期：跨包 `Area.defaultSpots` 引用。** `validateDatapack()` 检查该字段时只搜索当前 Datapack 的 `dp.spots`，没有查询已加载 Registry 中的 Spot。先加载包 A 的 Spot、再加载包 B 的 Area 并将其列为默认 Spot，可能在 B 加载时被拒绝。源码证据：`src/data-services/registry/registry-validate.ts` 的 `Area.defaultSpots` 校验循环。需要先确认该关系是否要求同包声明；若允许跨包引用，再按引用语义处理。类似 StoryEntry → Story 校验未纳入已确认发现。

审查为定向检查，不覆盖每类 Def 的全部引用字段、所有调用方时序或 coordinator 的全部补偿事务语义；未运行测试。上述发现不因本 Task 的文档完成而自动视为已修复。

### 文档结果

- 新 Wiki 参考页：[[docs/docs-828/02-modules/registry-wiki]]。
- `02-modules/registry` 收敛为路由卡片；总入口仍经模块索引进入卡片与 Wiki 正文。
- 更新 `03-data-structures/registry`、`01-architecture/data-flow`、`01-architecture/overview`、`01-architecture/current-context-card` 中与当前热 CRUD 不符的只读表述。
- 本试点只覆盖 Registry；是否复制到其他模块尚未裁定。

## 当前核验（2026-09-28）

- `npm run check:docs`：通过（365 个 Markdown 文件，errors: 0）。
- `git --no-pager diff --check`：本 Task 涉及的已跟踪文档通过；仓库全量检查仍报告既有 `AGENTS.md` 与 `aoci.code.txt` 文件末尾空行，均不属于本 Task。本 Task 新增 Markdown 已检查无行尾空白。
- 自动化测试：未执行（本 Task 是只读代码审查与文档试点）。

## 剩余工作

代码修复、跨包默认 Spot 引用语义裁定，以及是否扩大 Wiki 试点均留待后续决定；本 Task 不预设全库迁移。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[docs/ai/task-read-set-routing]]
