# 06-wiki/20-data-services/definition-authoring — 定义作者策略

本文回答通用内容编辑如何决定某个表和字段可否被编辑，以及编辑结果如何返回定义层。

作者策略是运行时定义编辑 API 的“允许清单和翻译器”：它说明哪些表、哪些字段可以编辑，怎样检查输入、怎样编码成正式 Def，以及变更通过局部 Registry 操作还是整包 reload 生效。没有列在清单里的内容默认不能经这个通用通道写入；这不表示该定义无法由源 Datapack 提供。

`authoring/content-policies.ts` 声明受支持内容表的策略；策略列出可写字段、输入类型、必填性、默认值、编码、消费者及物化方式。调用方通过策略 API 查询支持范围、校验输入并构建 Def。未知表或字段不会被默认为可写。

编码器负责将作者输入转换为契约值，例如数值表达式包装或省略未设置的可选值。扩展输入由策略显式声明验证和编码方式。策略可指定局部 Registry mutation；没有 mutation 的策略需经 Runtime reload 物化，不能绕过该边界直接改表。

作者输入字段校验属于局部校验；涉及跨定义引用的整体合法性仍需在完整启用集执行目标校验。此处不推断未登记的 UI 编辑能力。表契约见 [[docs/docs-829/03-data-structures/datapack-contracts]]，Registry mutation 见 [[docs/docs-829/06-wiki/20-data-services/registry]]。

阅读具体字段时，先看 `CONTENT_POLICIES`，再看 `getContentPolicy()`、`validateAuthoringInput()` 和 `buildAuthoringDef()`：它们分别回答“是否登记”“输入是否符合字段策略”“如何生成定义”。若要判断写入怎样让其他系统刷新，继续查该策略的 `materialization` 台账及消费者，而不要只看字段名。

## Gameplay B Operation 内容

`operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles`、`operationStrategyProfiles` 和 `operationCardPools` 是 `Datapack` / Registry 的正式表。它们可在独立 Datapack Editor 中编辑，但没有登记为 `ContentAuthoringPolicy` CRUD，也不属于游戏内 Spot/Area/Init Runtime Editor。Action 的嵌套 `target` union 在生成 Schema 中保留为通用 JSON 字段；PB-23 目标规则由 `OperationActionDef.target` 源契约和 Registry 校验约束，不由 Editor 或游戏 UI 另算候选。

应用包配置时，`AronaClickerRuntime.validatePackConfiguration()` 会按候选启用集建立临时 Registry 并逐包校验；校验通过后，`applyPackConfiguration()` 才交给 PackManager 应用并 reload Runtime。Operation 引用错误由 Registry 指向完整 Event/Location ID 与字段路径，例如 `operationEvents[...].locationIds`、`operationLocations[...].routeEdges[...].targetLocationId`。校验失败不会触发 Runtime reload；有效内容改动则在 reload 后由新 Run 从 Registry 读取。

事件作者对不兼容修改递增 Event 的 `resumeVersion`。旧 Run checkpoint 会被拒绝恢复，之后新启动的 Run 使用新定义。Gameplay B 当前采用 Map-only bundle，定义位于 `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`，并由 `src/arona-clicker/runtime/runtime.ts` 注册；旧的 Gameplay B Operation 样例已退役，不代表当前产品内容结构。Operation 表在 Datapack Editor 中的编辑、导入导出及 Runtime reload 闭环由 PB-25 验收；通用作者策略 API 仍不提供 Operation 表的局部 CRUD。

## 从哪里核对

- `src/data-services/authoring/content-policies.ts` 定义策略清单；`src/data-services/authoring/content-policy.ts` 提供授权查询、字段校验、Def 编码及 `applyAuthoringMutation()`。
- `tests/data/content-policy.test.ts` 覆盖未登记字段拒绝、字段值校验、`buildAuthoringDef()` 编码和 Registry mutation receipt。Spot 局部 mutation 是已登记的具体路径，不能推广为所有内容表都能局部编辑。
- Operation 表仍是 Datapack / Registry 的正式结构，但不在通用策略清单。`tests/engine/gameplay-b-editor-authoring-workflow.test.ts` 覆盖编辑器作者的 Scene 内容经打包解析、Runtime Apply / Reload 后启动；当前 Map-only Gameplay B 的 Registry 与 Runtime 集成分别由 `tests/data/gameplay-b-map-registry.test.ts` 和 `tests/engine/gameplay-b-map-runtime-integration.test.ts` 覆盖。这些测试不表示旧 Operation 样例或候选启用集校验流程仍存在。
