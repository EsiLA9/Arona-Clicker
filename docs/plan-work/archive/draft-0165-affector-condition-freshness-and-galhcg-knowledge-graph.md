# Draft：Affector 条件新鲜度与 GALHCG 分层知识图

状态：draft — 首轮需求探索与重构后图谱补全完成；Affector 语义、图谱治理和后续施工边界待裁定

> 本文记录从确认 MCP 项目身份、建立项目图、沿图检索 Affector 性能需求，到发现图谱和 Agent 操作流程改进项的完整探索。本文是讨论与事实路由，不代表批准修改 Affector 或 GALHCG 服务。

## 目标与最终方向

探索一个需求：Affector 的部分内容应在依赖未变化时保持已知结果，避免不必要的高频 Tick 条件判断。探索同时检视 GALHCG 能否提供从系统概念、管理机制、底层机制到源码与测试的可追溯路径。

期望形成两类后续方向：

1. 在核实当前 Affector 条件依赖与 Tick 行为后，明确哪些计算可由事件失效、缓存或其他固化方式替代，哪些仍需保留逐 Tick 求值。
2. 让 GALHCG 表达有层级的概念分解、跨层关系、文件依据和可遍历路径，使未来的需求能从高层概念逐步缩小到可验证实现。

“固化”暂作为待定义词使用。它可能指运行期缓存条件结果、缓存有效 Entry 集、物化持续贡献，也可能被误解为持久化存档状态；本 Draft 不替用户裁定这些含义。

## 本次探索过程

| 阶段 | 实际行为与结果 | 暴露的问题 |
| --- | --- | --- |
| 确认项目身份 | 首次 MCP `status` 只返回 `default` → GALHCG；核对服务配置后再次查询，返回 `default` → GALHCG 与 `acprogram` → ACProgram。后续操作均显式传 `project_id`。 | 初次状态与后续状态不一致，变化原因未查明。Agent 必须以工具当前返回的根目录为准，出现冲突时重查并报告，不能按默认 ID 猜项目。 |
| 刷新清单 | GALHCG 刷新成功：23 文件、4 目录、335,998 元数据字节、扫描 4 ms。ACProgram 刷新成功：1,179 文件、114 目录、11,268,593 元数据字节、扫描 264 ms。 | 刷新结果需要保留项目身份、范围、状态、文件/目录数、字节量和耗时，不能只说“索引好了”。 |
| 构建试验图 | GALHCG 写入 5 个语义节点、13 条边；ACProgram 写入 9 个语义节点、50 条边。两次均按项目分别写入，并用 `search` / `context` 验证。 | ACProgram 图有 Project→Module→Concept/File，但三个 Concept 处于同一语义层，缺少概念内部的上下位关系。50 条边连接了大量文件，却仍不能表达管理机制如何分解为可单独检索的机制概念。 |
| 沿需求检索 | 在 ACProgram 图中搜索 `Affector`，得到 18 个文件名/路径命中；搜索 `Tick` 得到 Tick 文档、系统和测试。再以 `source` 搜索当前 `docs-829`、`src/engine`，最后预览 Affector Engine、ConditionDepIndex、TickSystem 和当前机制文档。 | `map` 搜索结果包含历史 `docs-828` 文件，也包含一般文件节点；它不等于 Affector 语义图，也不等于源码正文搜索。宽泛源码搜索可截断，需按目录和主题收窄。 |

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案/验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| Affector 是否每 Tick 全量重估？ | `src/engine/effect/affector-engine.ts` 的事件依赖索引会按命中事件对实例定向 `recheck`；`pollingInstances` 收纳 stat/未知依赖的保守轮询实例；`applyActiveEffects()` 每 Tick 重查该集合，并只对 Active Entry 执行显式 `perTickEffects`。当前正文见第 525–552 行附近。 | 需求应先量化剩余轮询范围，避免把已存在的事件驱动优化重复设计成新机制。 | 已核实；需继续对照完整调用链和测试 |
| 哪些依赖进入事件索引？ | `src/engine/expression/condition-deps.ts` 对 resource、affectionLevel、spotLevel、manager、flag、enhancement、tag、Extra 等依赖登记事件；stat/未知 target 会返回宽依赖。stat 也会对列举的宽事件失效，并保留 Tick 轮询。 | 需要决定要新增精确事件、将哪些结果缓存，或保留哪些无专属事件条件为轮询回退。 | 已核实；目标条件集合待裁定 |
| Tick 是否仅用于 Affector 条件判断？ | `src/engine/system/tick-system.ts` 每秒结算资源产出并发出 Tick；Affector 的显式 `perTickEffects` 与持续 flow 是独立行为。 | 条件重估、持续产出、逐 Tick 效果、资源结算应分别计量，验收不能用总 Tick 耗时替代细项。 | 已核实 |
| Affector 主体状态如何向消费者传播？ | `docs/docs-829/04-mechanisms/engine/effect-trigger.md` 说明 Latent/Active/Removed 生命周期；active flows、zoneModifiers、区域连接和服务能力是派生贡献，并在状态或 Entry 集变化时通知消费者。 | “固化内容”可能触及 AffectorEngine、GameNum/派生索引、事件失效和查询端，不可只改条件求值函数。 | 文档已核实；具体受影响函数与测试矩阵待核对 |
| 当前源码注释是否一致？ | `affector-engine.ts` 文件头称每 Tick 全量重估；同文件的依赖注册与 `applyActiveEffects()` 实现、当前机制文档均描述事件定向重估加局部轮询。 | 方案依据必须采用方法实现和当前机制文档，并处理陈旧注释；暂不据文件头概括当前行为。 | 已发现冲突；根因与注释修复待核对 |
| 现有测试覆盖在哪里？ | 搜索命中 `tests/engine/affector-engine.test.ts`、`affector-reconcile.test.ts`、`event-driven-reactor.test.ts`、`tag-stats.test.ts`、`tick-system.test.ts` 等。 | 后续需从目标条件和依赖失效路径选读具体断言；本次没有运行测试。 | 路径已定位；断言覆盖待核对 |

当前实施还存在一个性能历史记录 `task-0034-affector-performance-review`。该文件是归档快照，不作为现状依据；其中关于 ZoneModifier、flow 来源索引、事件合并和依赖索引成本的结论，必须逐项回到当前源码与测试重新检查，不能直接登记成当前未完成项。

## GALHCG 图谱结构核对

首轮探索时检视的旧版服务实现仅允许 Project/Module 到 Concept 的结构。本次（2026-09-29）针对已重构的本地 `project_preview` MCP 实际确认：节点仍为 `Project`、`Module`、`Concept`、`File`，关系为 `contains`、`maps_to`、`depends_on`、`related_to`；`contains` 已允许 Concept→Concept 并在写入预检时检查无环，`maps_to` 支持 `implementation` / `documentation` / `test` 角色，`update_map(dry_run=true)` 可预检后回滚，`resolve_paths` 可按路径解析 File ID，`traverse` 支持有界多跳结构遍历。`context` 可返回完整性与文件新鲜度信息。旧版能力描述只代表首轮探索时观察到的状态，不应再作为当前 schema 事实。

本次重构后更新的 ACProgram 图包含 6 个既有 Module、18 个 Concept；保留了原有 3 个 Concept，并新增 15 个有证据的 Concept。图中已表达运行时内容生命周期及其子概念、条件依赖索引到 Affector 条件新鲜度和 Visibility 刷新的交叉归属，以及 Affector 生命周期下的活跃贡献、条件新鲜度和显式逐 Tick 效果。概念目前总深度不超过 Project→Module→Concept→Concept；共享 Concept 形成 DAG。Affector 条件新鲜度可以通过 `search(map)` 命中，再用 `context` 读到实现、文档、测试映射及新鲜度；但从任意需求文本自动归纳检索路径、自动判断遗漏概念仍未实现。

建议讨论的概念分层样例：

```text
Engine 持续规则系统
└─ Affector 生命周期与条件新鲜度（管理概念）
   ├─ 事件依赖登记与定向失效
   ├─ stat / 未知依赖的轮询回退
   ├─ Active Entry 与一次性激活效果
   ├─ 显式 perTickEffects
   └─ flow / zoneModifier 等派生贡献
        ↔ 事件、Mutation、GameNum 和 UI 查询关系
        → 实现文件、机制文档与测试文件
```

此结构只是样例，不是已裁定的节点命名或 schema。目标是表达：上位概念可拆到管理概念，管理概念再拆到机制概念；概念层之间可有方向明确的因果、失效、消费或依赖链接；每个概念可以链接源码、文档和验证文件。结构边与横向语义边应分开，避免把 `contains` 当作所有关系的通用含义。

## 本次行为暴露的改进项

### 图谱模型与查询

- **Concept 层级能力可用，但只在真实分解时使用。** 新版 MCP 支持 Concept→Concept `contains` 并会校验 DAG；最新一次代码锚点重构检查后，ACProgram 图没有保留 Concept→Concept `contains`，因为现有子边描述的是机制行为或使用关系，不是稳定的整体—组成部分。概念间联系改用有证据的直接依赖或横向关联；不需要固定三层或 `level` 字段来制造结构。
- **区分结构和横向关系。** 评估失效于、触发、派生、消费、实现等有向关系类型；`related_to` 可保留作弱关系，不代替可验证的因果语义。
- **让路径查询穿过多层。** 扩展 `context` 或新增路径查询，支持指定深度、祖先、子孙和横向邻居；结果应显示关系类型与方向，并限制规模、截断和分页。
- **让概念绑定“可验证文件”。** 概念需能关联源码、当前机制文档和测试；可探索 File 节点角色或 evidence kind，区分“实现”“解释”“验证”，避免只靠文件名匹配。
- **补充文件正文检索与语义路由。** 当前 `map` 文件命中不能代替代码语义搜索；需让 Agent 从顶层概念沿图到管理概念、机制概念和文件，并能解释命中理由。
- **为大项目维持概念覆盖边界。** 不追求给每个源码文件造概念节点；按稳定职责分组，控制节点摘要、层级和关系密度，并能标示未建图区域。

### Agent / MCP 操作流程

- `status` 必须先确认 MCP 项目 ID 与根目录。首次状态与后续状态冲突时重查；不能根据 `default` 猜项目，也不能把两个项目的文件或节点混用。
- 明确区分 `search(map)`、`search(source)`、`list_files`、`preview` 与 `context` 的证据能力。宽查询出现截断时缩小目录；历史目录按 `AGENTS.md` 标记为历史来源，不用作现状结论。
- 写 `maps_to` 边前用 `resolve_paths` 按路径解析 File 节点 ID，避免手工抄错 ID；从 `preview` 取得确切版本令牌，并尽量在提交前立即刷新所有证据令牌。本次 54 个不同路径全部解析成功，59 个依据路径均取得预览令牌。
- 写入前计算整个 batch 的文件依据条目数。当前 `update_map` 单次最多校验 32 条依据，即使节点数和边数尚未达到上限也会拒绝超限批次。
- `dry_run` 是本次新增的有效防错环节：它拦截了 `status`（应为节点字段 `state`）误用，也提示批次引用了尚未创建的 Concept 端点；修正节点字段与批次依赖顺序后，预检通过再提交。工具会一次返回可判定错误，但 Agent 仍需依据 missing_endpoint 将尚未存在端点的层级边延后至后续批次。
- 更新后用语义搜索验证概念可发现，用 `context` 验证项目归属、层级、方向、文件依据和相邻关系；必要时再次检查另一项目，证明没有串图。
- 在输出中分别报告工具实测、源码事实、历史材料和推断。不要把一次 MCP 写入成功说成性能已优化，也不要在未运行测试时声称行为已经验证。

### 重构后 ACProgram 图补全记录（2026-09-29）

- 项目身份由 `status(project_id="acprogram")` 确认：根目录为 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`。最新完整清单刷新成功，1,180 个文件、114 个目录、11,283,158 元数据字节；扫描 277 ms、总耗时约 370 ms。
- 起始图保留 6 个 Module、3 个 Concept。没有删除或改名既有节点；更新既有 `maps_to` 依据与 `implementation` / `documentation` / `test` 角色，并给既有 7 条模块依赖补充架构文档证据。
- 新增 15 个 Concept，覆盖运行时内容加载与 Registry、定义来源层、作者化策略、PlayerState/Init 快照、状态写入与事件协调、UI 命令流、ConditionDepIndex、Affector 生命周期/条件新鲜度/活跃贡献/perTickEffects、Tick 资源结算及 Visibility 条件刷新。另给既有概念补充文件映射。以结构归属、概念分解和横向关系分别建边，没有把所有概念互相连接。
- 完成后 MCP status 实测为 6 Module、18 Concept、154 semantic edges：56 `contains`、81 `maps_to`、9 `depends_on`、8 `related_to`；70 个文件有依据关联，另有 1,110 个已索引文件尚无 semantic map 关联。关联数量不等同于理解覆盖率。
- 结构更新分 2 批（29、27 条依据引用）执行，每批 `dry_run` 返回 `valid=true` 后才实际提交；文件映射 70 条分为 25、25、20 条，全部先预检后提交。`resolve_paths` 对 54 个映射路径全部解析成功，59 个依据路径的 `preview` 全部返回版本令牌。
- 回读：15 个新增概念的 `context` 全部返回 `confirmed`、fresh、完整；`search(map, "Affector 条件新鲜度")` 命中目标 Concept。项目根 `contains` traverse 完整返回 25 个 Project/Module/Concept 节点及 34 条边，未截断。其后又将已存在的只读视图边界概念共享归属到 `module:game-ui`；该单边亦经 dry_run 与 context 验证。`dry_run` 的 contains DAG 校验均通过，因此本次结构更新未引入环。没有运行产品测试；验收仅针对图结构、依据新鲜度和 MCP 可读性。
- 本轮实际暴露的使用不便：一是节点的确认状态字段是 `state` 而不是 Agent 首次误用的 `status`；schema 错误直到 dry_run 才显现。二是将尚未创建的下游 Concept 同时纳入前置 batch 会触发 `missing_endpoint`，必须根据层级端点安排写入顺序。三是每次最多 32 条依据引用，节点与边数量限制不能代表证据预算；需分别计数并拆批。四是 `context` / `traverse` 返回较长的邻接和证据详情，验收摘要需要 Agent 主动提炼。五是 status 中 freshness 汇总是最近 context 观察而非全库实时哈希，应对关键节点逐一调用 context。
- 留下的证据缺口：1,110 个索引文件尚未关联语义图；本轮只优先覆盖对当前架构和 Affector 性能检索有用的子系统。Affector 文件头注释与当前实现描述存在不一致，图记录了实现/文档依据，但没有修复该源码文档债务。图结构可帮助定位与解释证据，不能单独证明性能收益或需求方案正确。

### 本次具体施工交互中的工具反馈

- 首轮探索（旧版工具）曾遇到依据超过 32 条、无效节点 ID、依据过期和手工复制 File ID 错误；这些是历史操作记录。本轮新版 MCP 中，首个 `dry_run` 拦截了两类 Agent 侧构造错误：节点 `state` 字段误写为 `status`，以及包含后续批次端点的过早层级边。预检没有写入副作用；调整后两批结构写入和三批文件映射写入均先预检通过再提交。
- 当前服务仍限制单次 32 条 evidence references。本次结构批次分别使用 29、27 条；70 条 `maps_to` 更新分为 25、25、20 条，避免超预算。54 条唯一映射路径由 `resolve_paths` 动态解析，预览令牌用于对应文件依据。
- 验收中 15 个新增 Concept 的 `context` 均显示 `confirmed`、fresh 且完整；地图搜索命中 Affector 条件新鲜度；项目根 `contains` 遍历完整返回且没有达到节点/边上限。两次结构 dry_run 的 DAG 校验通过，实际结构可读回。

这些结果说明新版 MCP 已提供足够的验证护栏，但批次切分仍需尊重证据预算和端点创建顺序。Agent 应先计划完整图，再按端点依赖排序批次；使用 dry_run 后再提交，并将状态字段、证据令牌、File ID 和 DAG 检查纳入自动验收。首轮旧版操作错误不应误记为本轮新版服务仍有相同缺陷。

### 后续代码锚点重构与文件覆盖审计（2026-09-29）

- 本轮通过重构后的 `project_preview` MCP 再次读取并调整语义图。改造前 status 为 6 Module、18 Concept、154 条边：56 `contains`、9 `depends_on`、81 `maps_to`、8 `related_to`；改造后为 6 Module、17 Concept、138 条边：46 `contains`、13 `depends_on`、71 `maps_to`、8 `related_to`。保留其余 17 个 Concept 的稳定 ID，将名称与摘要重新锚定到代码实体；删除重复的 Registry 校验 Concept，并把实现、测试、文档依据并入 `Registry`。本次写入各批均先通过 `dry_run`，17 个 Concept 与 6 个 Module 的 context 回读均为 fresh、完整。
- 概念主体改为 Coding Agent 可直接搜索的符号，例如 `PackManager`、`RuntimeContentCoordinator`、`Registry`、`resolveDefinition`、`PlayerState`、`StateMutationService`、`buildGameView`、`ConditionDepIndex`、`AffectorEngine`、`VisibilityEngine` 和 `TickSystem`。`InitSnapshot`、`PER_INIT_FIELD_SPECS` 作为 PlayerState 相关节点的别名和摘要入口。保留的跨实体机制摘要指出共同实现者；比如 Affector 条件新鲜度明确关联 `AffectorEngine` 与 `ConditionDepIndex`。Datapack 包管理、运行时 Spot 作者化协调和 Registry 定义查询分别有独立代码职责，因此保留为不同 Concept，并以调用证据表达联系。
- 重新核对了节点间的 8 条 Concept→Concept `contains`：它们表达的是 Affector/Visibility 客户端、条件索引使用方或流程前后关系，不是结构所有权，所以本轮移除。最新 `contains` 遍历完整返回 Project/Module/Concept 24 个节点和 24 条边；Concept 之间通过 `depends_on` / `related_to` 联系，不为 DAG 深度强建子节点。
- **未关联文件的内容并非都是 `.ts`。** 完整读取 MCP 的 1,180 条文件清单，并从 23 个 Module/Concept 的 `context` 汇总 `maps_to` 和 evidence 路径；这与 status 的服务口径吻合：69 个文件已关联，1,111 个尚未关联。未关联扩展名为 `.ts` 595 个（约 53.6%）、`.md` 422 个（约 38.0%）、`.json` 40 个、`.css` 22 个、`.mjs` 10 个，其他格式合计 22 个。未关联 `.ts` 分布为 `src/` 392、`tests/` 178、`tools/` 22、仓库根目录 3；422 个未关联 `.md` 中，419 个位于 `docs/`。因此索引缺口同时覆盖实现代码、测试、文档和数据/资源；不能简单地把 1,111 个文件批量建成代码 Concept。扩展名只说明文件形态，不能据此认定其职责或是否值得映射。
- 71 条 `maps_to` 连接到 59 个不同文件；status 的 69 个 associated file 还合并了关系和节点 evidence，因此 `mapped_file_count` 与 `associated_file_count` 并不相等。后续覆盖审计应分别报告“映射目标数”“有依据文件数”和“未关联文件数”，并按模块、角色及路径分区展示，避免把这些指标混为一谈。
- 本轮还遇到 `list_files(limit=250)` 因输出预算只返回 199–240 条并给出 `next_offset` 的情况。若按请求的 250 固定递增 offset，会跳过文件；本次审计改为严格跟随 MCP 返回的 `next_offset`，共取 6 页后得到完整 1,180 条。未来工具调用应把返回游标作为唯一分页依据，并在报告中标记清单是否完整。
- 本轮确实用新版 MCP 重构并验收了语义图；但“图是否能提升实际 Coding Agent 的代码入口命中率”尚未通过真实需求检索对照验证。下一步应选一个明确任务，从概念搜索走到实现/测试文件，记录命中和遗漏；同时优先建立模块级覆盖缺口视图，对 `.ts`、`.md`、Datapack JSON 与归档/生成文件采用不同纳入策略。历史 `docs/docs-828`、归档文档和生成文件不能只因未关联就自动纳入现状语义图。

### `.ts` / `.css` 全量映射任务立项（2026-09-29）

- 后续维护将 ACProgram 图补充到 6 个 Module、33 个 Concept、227 条关系。当前 `status` 为 104 个直接映射文件、114 个 Evidence/映射关联文件、1,066 个总体未关联文件；这些统计口径不同，必须分开报告。
- 用完整文件清单与所有 Concept 的 `map_view(view="files")` 直接对账：目标集合共 665 个文件（643 `.ts`、22 `.css`），已有 `maps_to` 覆盖 83 个 `.ts`、0 个 `.css`；仍缺少 560 个 `.ts` 和 22 个 `.css` 的直接映射。状态中的 Evidence 会额外关联 5 个只有 Evidence、没有 `maps_to` 的 `.ts`，因此 status 扩展名缺口不能替代直接映射对账。
- 用户要求制定全量覆盖 Task，已新建 [[task-0166-galhcg-typescript-css-full-file-coverage]]。该 Task 要求逐个目标路径进入适当 Concept 的 `maps_to`，按实现/测试/工具/样式职责标角色；复用稳定节点，不按文件建 Concept，并按每批最多 32 条 Evidence 引用 dry-run 后提交。
- Task 验收只要求 665 个 `.ts` / `.css` 路径直接映射完整，不要求把其他扩展名全部映射，也不将“关联文件数”冒充语义覆盖率。当前仍未通过真实需求检索验证图谱是否提升 Agent 导航命中率。

### GALHCG 全量映射执行记录（2026-09-30）

- 按 [[task-0166-galhcg-typescript-css-full-file-coverage]] 实际施工。MCP 确认项目根为 `C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`；完整清单仍有 1,180 个文件，其中 643 个 `.ts`、22 个 `.css`。起始直接映射 83/665，结束 665/665；唯一 `unspecified` 文件为 `bondDict.ts`，它是 Affection 阈值表，但全库源码搜索未发现当前 TypeScript 调用方，所以只作为 Affection 参考，不声称在运行时生效。
- 三个只读子 Agent 分别核对 AronaClicker、Engine/Data Services、UI/测试/工具/CSS；主 Agent 汇总 owner 并独占写图。最终图为 7 Module、68 Concept、1,026 条关系，`maps_to` 唯一文件 686 个；status 还报告 691 个 evidence/映射关联文件与 489 个未关联文件。新增的工程支持 Module 归纳根构建配置和测试环境，其余职责概念挂在实际所属 Module 下。
- 需求检索试例能沿概念到文件：Datapack Package I/O → ZIP/fragment parser、archive writer 与测试；AffectionSystem → 服务/内容/状态/测试；UI Presentation Layer → UI 实现、CSS 与测试；Datapack Editor UI → 独立 `tools/datapack-editor/` 实现与测试。`contains` 的语义遍历 76 节点、76 条边，没有环。以上证明 MCP 数据可查询，不等于真实 Coding Agent 入口命中率已提升；仍需在后续具体代码任务中记录首次命中、误命中和遗漏。

#### 本次操作中不顺手的地方

- **没有项目级 maps_to 清单。** `status` 将直接映射和 Evidence 关联分开统计，不能从总体 `associated_file_count` 得到目标扩展名覆盖率；`overview` 只展示结构边。为了对账，我完整读取清单后，对 68 个 Concept 分别调用 `map_view(view="files")` 并本地合并路径集合。
- **每个路径都要单独 preview 才有 version_token。** 582 个缺口要逐文件取令牌，没有批量 preview 接口；一次高并发请求返回 early EOF，改为每批 8 个文件后完成。`resolve_paths` 支持批量，但预览/令牌仍需逐路径收集和核对。
- **写入预算让同一语义更新要拆很多批。** `update_map` 每次最多 32 条 Evidence；最终主要施工拆成 4 个节点/结构批次和 27 个映射/联系批次，核实 owner 后又做 6 个小修正批次。初次 dry-run 还明确拒绝 Project→Concept 的 `contains`，需新建真实的 `module:engineering-support` 承接工程支持概念；工具也不允许同一批对同一关系同时 delete 与 upsert，只能先删后写。
- **context 不适合做大节点的文件覆盖验收。** 对 6 个较大的新 Concept，`context` 即使提高 `neighbor_limit`，仍返回 `source_section_incomplete`，文件段只显示部分列表；完整路径需改由 `map_view(files)` 分页核对。
- **代码搜索的默认范围混入历史资料。** 搜符号时历史文档和生成的 `aoci.code.txt` 会形成相似命中；对当前实现追引用需指定 `directory="src"`，再用 preview 检查调用点。只搜函数名也需要逐个 query。
- **CSS 清单不携带界面宿主。** 需读 `src/ui/main.ts` 的 CSS import、运行时组件/渲染器以及独立编辑器 HTML 的 `<link>`，才能判断某个样式属于通用主题、聊天、运行时编辑器还是独立 Datapack Editor。
- **测试共享 fixture 容易造成错误归属。** 很多测试会创建 `GameInstance` 或导入 `baseDatapack`；只有核对断言主体后才知道它实际验证的是 Registry、Affector、Story、UI 更新还是编辑器。多个子 Agent 的分区审计减少了重复浏览，但最终 owner 仍需主 Agent 合并并统一判断，不能直接把 import 清单批量写成关系。
- 所有最终 `update_map` 批次均先 dry-run 再提交；写入后对全部目标扩展名做了集合相等校验，并单独列出唯一未确认活跃调用的 `bondDict.ts`。代码测试没有运行，本次只验证语义图结构、关系和查询。
- **归档后清单变化（2026-09-30）：** 按项目规则将已完成 Task 0166 移入 `docs/plan-work/archive/` 后，只刷新该计划目录。MCP 文件清单因此从 1,180 增至 1,181，`unassociated_file_count` 从 489 增至 490；这是新增进入索引的归档 Markdown，不改变 665/665 个 `.ts` / `.css` 直接映射覆盖。

## 裁定记录

| 待裁定问题 | 建议 | 本项目决定 | 依据/待验证项 |
| --- | --- | --- | --- |
| “固化”要缓存或物化什么？ | 先分 condition truth、active Entry 集、flow/zone 派生值与持久化状态，不合并成一个笼统缓存。 | 待裁定 | 当前 AffectorInstance 为运行时派生状态；核对 `AffectorInstance` 生命周期与恢复路径。 |
| 哪些条件允许退出每 Tick 轮询？ | 只在依赖可追踪且所有写入路径都能发出对应失效事件时退出；保留未知依赖的保守回退。 | 待裁定 | 需要枚举 `ConditionDepIndex` 每种 target、事件写入点和宿主重建路径。 |
| 性能改进验收如何量化？ | 同时测量每 Tick 条件评估数、每次事件受影响实例数、状态翻转正确性和总 Tick 结算，不只比较墙钟时间。 | 待裁定 | 需选择代表性数据规模、Profiler/计数工具及可重复基准。 |
| GALHCG 如何表达上下位概念？ | 用有证据的 Concept→Concept `contains` 表示真实整体—部分分解，用共享节点表达 DAG 交叉归属；不为凑层级强加固定三层。 | 基础路径已由重构后的 MCP 验证；推荐层级深度与治理仍待裁定 | 两批结构 dry_run 通过 DAG 验证，遍历与 context 可读回。`level` 元数据、跨层因果关系是否扩展 relation 类型待讨论。 |
| 是否同一施工任务实现两类变化？ | 初步倾向分开验收 Affector 性能变化与 GALHCG schema / 查询变化；本 Draft 将它们作为同一探索中发现的两条方向记录。 | 待裁定 | 两者可独立交付，且分别涉及 Engine 与 MCP 服务边界。 |

## Draft → Task 准入

- [ ] “固化”的状态对象、生命周期和非目标已裁定
- [ ] 目标 Condition、事件覆盖矩阵及所有写入/恢复路径已核对
- [ ] Affector 性能验收指标、代表性规模与正确性测试已定义
- [ ] GALHCG 层级 schema、允许关系、遍历 API 与迁移/存量图行为已裁定
- [ ] 决定 Affector 与图谱改造是否拆成独立 Task，并写明依赖
- [ ] 为每个 Task 给出独立完成定义、最小 Read Set 与验证入口

## 下一步

1. 继续做只读事实核对：从 `ConditionDepIndex` 条件叶子映射追到每种事件写入点、Affector 重建路径与对应测试，形成“可精确失效 / 暂需轮询 / 需人工裁定”矩阵。
2. 为 GALHCG 画一版可执行 schema 草案，至少覆盖三层概念、横向关系、文件/测试依据、路径查询、无环约束和更新预算；先用 Affector 需求做查询验收样例。
3. 完成裁定后按责任边界另立实施 Task；本 Draft 继续记录语义和事实问题，不把方案建议当成已实现事实。

## 相关路由

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/01-architecture/dependency-map]]
- [[docs/docs-829/04-mechanisms/engine/effect-trigger]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[task-0034-affector-performance-review]]
