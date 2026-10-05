# 06-wiki/20-data-services/definition-authoring — 定义作者策略

本文回答通用内容编辑如何决定某个表和字段可否被编辑，以及编辑结果如何返回定义层。

`authoring/content-policies.ts` 声明受支持内容表的策略；策略列出可写字段、输入类型、必填性、默认值、编码、消费者及物化方式。调用方通过策略 API 查询支持范围、校验输入并构建 Def。未知表或字段不会被默认为可写。

编码器负责将作者输入转换为契约值，例如数值表达式包装或省略未设置的可选值。扩展输入由策略显式声明验证和编码方式。策略可指定局部 Registry mutation；没有 mutation 的策略需经 Runtime reload 物化，不能绕过该边界直接改表。

作者输入字段校验属于局部校验；涉及跨定义引用的整体合法性仍需在完整启用集执行目标校验。此处不推断未登记的 UI 编辑能力。表契约见 [[docs/docs-829/03-data-structures/datapack-contracts]]，Registry mutation 见 [[docs/docs-829/06-wiki/20-data-services/registry]]。

## Gameplay B Operation 内容

`operationEvents`、`operationLocations`、`operationActions` 和 `studentOperationProfiles` 是 `Datapack` / Registry 的正式表。作者直接修改正式 Datapack 定义；这些表没有登记为 `ContentAuthoringPolicy` CRUD，也不属于游戏内 Spot/Area/Init Runtime Editor。

应用包配置时，`AronaClickerRuntime.validatePackConfiguration()` 会按候选启用集建立临时 Registry 并逐包校验；校验通过后，`applyPackConfiguration()` 才交给 PackManager 应用并 reload Runtime。Operation 引用错误由 Registry 指向完整 Event/Location ID 与字段路径，例如 `operationEvents[...].locationIds`、`operationLocations[...].routeEdges[...].targetLocationId`。校验失败不会触发 Runtime reload；有效内容改动则在 reload 后由新 Run 从 Registry 读取。

事件作者对不兼容修改递增 Event 的 `resumeVersion`。旧 Run checkpoint 会被拒绝恢复，之后新启动的 Run 使用新定义。当前固定游乐园示例及其编辑/校验/重载验收位于 `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts` 与 `tests/engine/gameplay-b-authoring-workflow.test.ts`；v1 不增加 Operation 专用编辑器、CLI 或第二份示例事件。
