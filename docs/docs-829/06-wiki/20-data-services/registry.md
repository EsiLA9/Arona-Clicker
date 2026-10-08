# 06-wiki/20-data-services/registry — Registry 协作

本文回答 Registry 如何把多个包的声明变为查询面，以及上游和下游各自负责什么。

可以把 Registry 当成 Runtime 的“有效定义目录”：它只接收已经选好的包，不从磁盘找文件，也不替玩家保存进度。服务查询角色、Spot、剧情等定义时会从这里读取。Datapack 与 Registry 这两层的结构差异见 [[docs/docs-829/03-data-structures/datapack-contracts]] 和 [[docs/docs-829/03-data-structures/registry]]。

包解析提供 Datapack，PackManager 决定候选启用列表与顺序，Registry 按表清单载入定义并建立关系索引。重复定义 ID 在合并时由后载入值覆盖；若顺序不同，结果可能不同。Registry 不负责读取包文件或选择启用项。

Runtime、Engine 和领域服务从 Registry 查询各自需要的定义；UI 通常经领域读模型消费结果。局部内容作者通过授权策略把输入编码成 Def，并委派 Registry mutation 或请求 Runtime reload；mutation receipt 维护相关索引和回滚边界。契约形状见 [[docs/docs-829/03-data-structures/datapack-contracts]]，表与索引细节见 [[docs/docs-829/03-data-structures/registry]]。

Registry 校验包内重复和引用；部分引用可从之前已加载的包解析，但 `Area.defaultSpots` 当前要求目标 Spot 出现在同一 Datapack。完整启用集校验需在候选上下文执行，仍遵循字段自己的引用范围。合并顺序决定冲突覆盖，也决定哪些先载入定义可供后载包校验；它不替代 manifest 依赖校验。包流程见 [[docs/docs-829/06-wiki/20-data-services/datapack-flow]]。

## 从哪里核对

- `src/data-services/datapack/pack-manager.ts` 的 `applyRuntimePlan()` 把有序包列表交给目标校验和 Runtime。
- `src/data-services/registry/registry.ts`：`Registry.load()` 执行验证；`merge()` 依表登记，重复 ID 由后加载值覆盖；`tableSteps` 提供合并和清理共用的表清单。
- `tests/engine/registry.test.ts` 的“should merge multiple datapacks”“should build relationship indices”验证合并与父子查询；“should reject broken references”验证缺失目标会被拒绝。
- `tests/data/registry-spot-mutation.test.ts` 验证 Spot 受控变更维护索引；`tests/data/runtime-content-browser.test.ts` 验证内容浏览查询返回安全克隆。
