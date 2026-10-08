# Unit 0235-U08：Data Services 功能 Wiki

## Goal

让新人能解释 Datapack 从来源到 Registry，再被编辑、资产和存储服务消费的路径。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `06-wiki/20-data-services/00-index.md`、`datapack-flow.md`、`registry.md`、`definition-authoring.md`、`persistence-assets.md` | 本 Unit 相关流程页 |
| 源码 | `src/data-services/contracts/datapack.ts`、`pack-manager.ts`、`registry/registry.ts`、authoring 与 storage/PicService 入口 | 核实装载、查询、编辑和资源范围 |
| 测试 | `tests/data/pack-manager.test.ts`、`tests/engine/registry.test.ts`、`tests/data/runtime-content-browser.test.ts` | 装载与 Registry 行为证据 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–35k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 主题页按装载/查询/作者限制/资产保存分开审查 |

## Optional Read Set

- 与作者策略相关的具体 Editor 调用，仅在模块边界不清时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`、全部正式内容 JSON 和生成的 Schema JSON。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Data Services Wiki 提供包流、Registry、作者策略、图片与保存四条入口。 | `06-wiki/20-data-services/00-index.md` | 按页面职责路由，不代表内容当前正确。 |
| 包管理按启用集顺序交付 Datapack；验证失败会在 Runtime reload 和图片登记前停止。 | `src/data-services/datapack/pack-manager.ts`：`applyRuntimePlan()`、`applyDatapacks()`；`tests/data/pack-manager.test.ts` | Runtime 回滚依赖目标提供 capture/restore。 |
| Registry 的定义表不负责读取包文件或选择启用项；定义编辑要服从显式作者策略。 | `src/data-services/registry/registry.ts`：`Registry.load()`；`src/data-services/authoring/content-policy.ts`：`requireContentPolicy()`、`buildAuthoringDef()`；`tests/data/content-policy.test.ts` | 未登记字段默认拒绝；作者输入校验不替代整体 Registry 校验。 |
| PicService、SaveSystem 与 ArchiveWriter 是分开的资源/存档/归档入口。 | `src/data-services/assets/pic-service.ts`：`PicService`；`src/data-services/persistence/storage.ts`：`SaveSystem`；`src/data-services/archive/archive-writer.ts`：`validateArchivePlan()` | 包记录快照另走 PackStorage，不能与 Player Save 混为一谈。 |

## Constraints

- 清楚区分 PackManager、Registry、authoring policy、Storage/Archive 和 PicService。
- 代码修改或实际保存不混写；图中标清定义流和资产流。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u08-wiki-data-services.md`（填写本 Unit Receipt）
- `docs/docs-829/06-wiki/20-data-services/00-index.md`
- `docs/docs-829/06-wiki/20-data-services/datapack-flow.md`
- `docs/docs-829/06-wiki/20-data-services/registry.md`
- `docs/docs-829/06-wiki/20-data-services/definition-authoring.md`
- `docs/docs-829/06-wiki/20-data-services/persistence-assets.md`

## Explicit Non-goals

- 不改 Datapack Schema、编辑器行为、资产格式、导入/导出代码。
- 不把 bundle 默认启用行为泛化成所有项目内容包规则。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；内容来源或存储责任有跨层歧义时暂停对应流程图。

## Completion Criteria

- [x] 每页都有 plain-language 摘要、角色边界、代码入口、验证点与前后向链接。
- [x] 从声明或文件来源可跟进到应用完整启用集、Registry 和消费者。
- [x] 作者、图片及持久化说明不重复 03/04 的字段/算法权威正文。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 流程核验 | 对照 Registry/PackManager/authoring/storage 源码与测试 | 参与者与顺序准确 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt 0235-U08

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 本 Unit 白名单内更新 `06-wiki/20-data-services/00-index.md`、`datapack-flow.md`、`registry.md`、`definition-authoring.md`、`persistence-assets.md`；补充入门阅读顺序、阶段职责、源码符号、测试证据与相关链接。本 Unit 文档增加 Confirmed Facts 与 Receipt。 |
| 未完成内容 | 未更改 Datapack Schema、作者 UI、存储格式或导入导出代码；未穷举所有内容表的编辑策略。 |
| 范围外变更 | 无。 |
| GALHCG 影响闭环 | `review_changes(directory="docs/docs-829/06-wiki/20-data-services")` 与本 Unit Unit-file 路径查询均 complete=true；刷新 Datapack/Registry、authoring、PicService、SaveSystem 与 Operation 文档关联的 10 条边 Evidence，并刷新 U08 Unit 文件的 `goal-workflow` 映射；本 Unit 11 条文档映射均 fresh。 |

### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | 源码与 `tests/data/pack-manager.test.ts`、`tests/engine/registry.test.ts`、`tests/data/runtime-content-browser.test.ts`、`tests/data/content-policy.test.ts`、`tests/engine/pics.test.ts`、`tests/data/storage-adapter.test.ts`、`tests/data/archive-writer.test.ts` 对照 | 未执行 | 仅用于审查证据，没有运行 Vitest。 |
| 文档链接 | `npm run check:docs` | 通过 | 最终复跑：681 Markdown，0 errors。Task 0238 的临时错误已由任务负责人修复。 |
| 差异检查 | `git diff --check`（跟踪中的 Wiki 页）+ `rg -n "[\t ]+$"`（3 个 Unit 文档） | 通过 | Wiki 无差异空白错误；Unit 文档无行尾空格命中。 |
| GALHCG | 本 Unit 相关文档目录与 Unit-file 路径 `review_changes`、`plan_map_updates`、`update_map`、`verify_freshness` | 通过 | 检查 complete=true；计划有效；Wiki 与 Unit 文件映射 Evidence 均 fresh。 |

### 遇到问题

- 本次 Data Services 源码/测试范围内未确认需要产品代码修复的 P0–P3 问题；发现的主要差距是原 Wiki 缺少新人词义和可追查的验证入口，已补齐。
- Task 0238 的临时链接检查错误由任务负责人修复；最终全局文档检查通过。

### 需上游确认项

- 无。

### 事实更新建议

- 无；Data Services 正文已链接到既有结构/机制权威页。
