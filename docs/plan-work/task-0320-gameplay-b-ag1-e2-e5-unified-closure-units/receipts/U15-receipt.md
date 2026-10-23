# Receipt 0320-U15

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | A：增加闭合 Counter/Flag Pool gate；候选解析器区分 `allPotentialSources` 静态作者展开与 `runtime` 冻结 Facts 求值；Effect Context 校验所有潜在来源；Registry 校验 gate、AG-1、Fact ID/类型和值域；Schema、作者文档与样例同步。B：仅对 gated Map 保存 version 1 `candidateSourceSnapshot`；新 Node/Activity/Encounter 从当前 MapRun Facts 采样，同一 Encounter 后续 Round 沿用；Hand、Preview、CardRef、Status、Commit 与 Restore 使用冻结快照；scheduler v4 升至 v5，新增正式示例 Map 使用 `resumeVersion: 6`。 |
| 未完成内容 | 无 U15 施工项。Prepared-source filter、成长/临时候选来源、动态 Action Tag、跨 Map Pool 仍按冻结合同延期/不纳入。 |
| 白名单调整 | Task Owner 施工中将 `tests/data/gameplay-b-map-registry.test.ts` 加入 U15-B 白名单，仅允许更新本 Unit 新增正式示例的固定 Map ID/resumeVersion 清单；新增示例触发该既有清单测试。 |
| 范围外变更 | 无；没有修改独立 E1/legacy `map-effect-receipt-validator.ts`。AG-1 Restore 在对应分支直接重放 scheduler；gate Map 被 Registry 限定为 AG-1。 |
| GALHCG 影响闭环 | 只读核对项目 `acprogram`；未改图、未刷新或写 freshness。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Map Registry / Schema / MapRun / AG-1 Commit / Restore / gated pools | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-ag1-commit.test.ts tests/engine/gameplay-b-map-ag1-restore.test.ts tests/engine/gameplay-b-maprun-fact-gated-pools.test.ts` | 325/325 passed | Task Owner 独立复核；覆盖 gate/nested Pool、跨 Round 固定、下一 Encounter 采样、Save/Resume、快照篡改、scheduler v4 拒绝、CardRef 与 Status 资格 |
| Schema 生成 | `npm run gen:schema` | 通过 | `engine-defs.gen.json` 由生成器同步 |
| 类型检查 | `npx tsc --noEmit --pretty false` | 通过 | Task Owner 全 Unit 复核 |
| 架构检查 | `npm run check:architecture` | 通过 | Task Owner 全 Unit 复核 |
| 文档检查 | `npm run check:docs` | 通过（1256篇，0 errors） | Task Owner 全 Unit 复核 |
| 差异检查 | `git --no-pager diff --check` | 通过 | 仅共享工作树既有 CRLF/LF 行尾提示 |

## 遇到问题

- Map Registry 测试固定列出正式示例 Map ID 与版本；Task Owner 将该文件加入 U15-B 白名单，仅允许更新新增示例清单。
- 曾检查独立 `map-effect-receipt-validator.ts` 是否是 AG-1 gated Restore 旁路；确认 `restoreEncounterCommitReceipt` 对 AG-1 先分支返回 scheduler replay，Validator 仅服务 E1/legacy，因此无需修改该文件。

## 需上游确认项

- 无；MapRun Facts、Map-local Pool、冻结候选输入与每轮 Hand 重抽语义依据 U09/U12、Task 0317 和本 Unit 已冻结。

## 事实更新建议

- Task Owner 已同步 Task 0320、`docs/plan-work/00-index.md` 与 Draft 0312 路由；当前作者字段规则和示例见 `docs/docs-829/03-data-structures/datapack-contracts.md` 与 `docs/examples/gameplay-b-maprun-fact-gated-pools.md`。P7 保留延期项和依赖，不将它们写成已交付。
