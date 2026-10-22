# Receipt 0312-U09

| 项 | 内容 |
| --- | --- |
| 状态 | U09 实施与定向行为验证完成，交负责人审查；新 program 仍被 U03 MapRun 过渡门拒绝 Commit，不代表 U10 已完成。 |
| 实际修改 | 修改 `src/arona-clicker/services/map-card-effects.ts`、`src/arona-clicker/services/gameplay-b-action-preview-resolver.ts`；新增 `tests/engine/gameplay-b-effect-card-prepare.test.ts` 与本 Receipt。 |
| 实际手写行数 | 服务文件增加53行、删除11行；测试255行、Receipt 41行；合计增加349行、删除11行，净增338行，低于500行常规预算。 |
| 未完成内容 | 无 U09 内剩余项；定向测试、全局类型、架构、空白与文档验证均已完成。 |
| 范围外变更 | 未修改 Task、Unit、U08 文件、其他服务或旧金样；未提交 Git。保留工作树中 U04–U08 已有并行改动。 |
| GALHCG 影响闭环 | 只读确认 `project_id=acprogram` 与根目录匹配，并定向查到两份目标服务路径。直接影响范围累积至 U19 统一只读复核；本 Unit 无图编辑、refresh 或 freshness 写入授权。 |

## 实际适配与元数据

- Party 与 Enemy 预览分支都改为调用 `normalizeMapActionEffects(action)`，要求 Action 使用 `target.kind === 'card'` 且规范化 `prepare` 非空。规范化器负责旧 `cardEffects` 与新 `effectProgram.prepare` 的叶子校验，也继续拒绝同一 Action 混填新旧效果。
- `resolveMapCardEffects` 复用同一规范化 prepare 叶计算折扣，保留当前 Encounter、CardRef 解析、完整 Scope、card 身份、Owner/阵营、Action 候选、side 与 actor `sCost` 验证。当前候选仍由 `catalogMapRunCards` 根据 MapRun Owner 的 prepared Hand、Hand 与 PlayerCommand 生成；预览选择按完整 `mapRunCardKey` 与当前合法目录匹配。
- 函数新增 `prepareMetadata: readonly MapCardPrepareMetadata[]`，每个实际 Card prepare 叶一条：`{ sourceKey, source: { kind, id }, actionId, effectPath, leaf: { op: 'discountSCost', amount, mode } }`。例如路径为 `actions.discount.effectProgram.prepare[0]`，`mode` 区分 `program` 与 `legacy`。数组、记录及叶子均冻结。返回值不含 budget、访问次数或 Owner，也不执行 resolve。
- U06 planner 对 program 要求外层 `visit` 入口，所以这次纯元数据查询传空 `instructions` 和空实现回调；`instructions` 为空，回调不发生，prepare 叶只被映射为元数据。U10 应在 `map-run-service.ts` 的 `resolveEncounterCommitPlan()` 实际 prepare 规划阶段读取 `cardPlan.prepareMetadata`，仅对 `leaf.mode === 'program'` 的叶调用 U10 单一整轮预算入口一次。U09 不创建计数器或去重状态。
- `resolveEncounterCommitPlan()` 中已有的 effectProgram/condition 过渡拒绝未修改；本次新 prepare 只使 Preview 可用，提交仍会被 effectProgram 过渡拒绝。Actorless 资格与 context helper 未改变。
- E1 折扣保持己方预处理、Enemy 只影响后续 Enemy；叠加截到原 actor sCost、未选 Hand 折扣不转移、PlayerCost 不减。未引入 AG 的双方统一准备、支付或排序。

## 用例与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| U09 与旧回归 | `npx vitest run tests/engine/gameplay-b-effect-card-prepare.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/data/gameplay-b-effect-registry.test.ts --silent` | 通过，退出码 0；3 files / 34 tests | U09 7 项含固定 seed `0x08000000` 的 Owner 真实 Hand/CardRef Party 与 Enemy 新 prepare、跨轮 Scope、伪造当前 Hand 引用、移除 PlayerCommand、混填、未选 Hand 不转移、无 card 目标及 U03 Commit 过渡拒绝；原 map-cards 18 项和 Registry 9 项通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 | 在 U08 两处并行类型修复落盘后复跑通过；U09 测试初稿的类型错误也已在本白名单修正。 |
| 范围与空白 | `git --no-pager diff --check -- <两份服务文件>`；新增测试/Receipt 尾随空白扫描 | 通过，退出码 0 | 服务 diff 无空白问题；两份新增文件无尾随空白。全范围文件清单另按 U09 白名单复核。 |
| 架构 | `npm run check:architecture` | 通过，退出码 0 | Engine 与 data-services 边界检查通过。 |
| 文档 | `npm run check:docs` | 通过，退出码 0 | Receipt 更新后复跑，扫描1116篇 Markdown，errors=0。 |

## 遇到问题

- 首轮全局 tsc 曾分别暴露 U09 测试自身与并行 U08 两处类型问题；U09 测试类型问题在本白名单修正，U08 修复由对应施工代理完成。最终整树 tsc 通过，没有修改或规避 U08 文件。

## 需上游确认项

- 无玩法或接口裁定项。U10 按上述元数据形状与实际 `resolveEncounterCommitPlan()` 调用点接入唯一 prepare 预算入口。

## 事实更新建议

- `resolveMapCardEffects()` 已导出纯 `prepareMetadata`；U10 消费其 `sourceKey`、`actionId`、`effectPath` 与 `leaf` 字段，不应从 Preview 查询计数或通过 resolve 访问器取得 prepare。
