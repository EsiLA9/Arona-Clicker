# Receipt 0312-U19

后续维护提示（2026-10-22）：本 Receipt 记录 U19 当时的文档结项；作者合同页与示例后来随 Task 0315 更新为只支持 Map Action `effectProgram`，并移除了旧 Action 数组路由。当前合同见 [[docs/docs-829/03-data-structures/datapack-contracts]]、[[docs/examples/gameplay-b-effect-program-e1]] 和 [[docs/plan-work/task-0315-gameplay-b-legacy-action-migration-and-removal]]。本 Receipt 中的 U18 豁免及“未通过完整 E1 产品验收”结论仍然有效。

| 项 | 内容 |
| --- | --- |
| 状态 | U19 文档与阶段记录收尾完成；U18 验收按用户明确指示豁免。该豁免不代表完整 E1 产品验收通过。 |
| 实际修改 | 更新 `docs/docs-829/03-data-structures/datapack-contracts.md`、`docs/docs-829/06-wiki/50-ui/refresh-update.md`、`docs/plan-work/task-0312-gameplay-b-effect-program-v1.md` 与 `docs/plan-work/00-index.md`；新增本 Receipt。 |
| 未完成 / 豁免 | 未创建 U18 Receipt、纵向集成测试或截图；未操作浏览器。原 U18 宽屏实机与完整纵向验收仍无实测证据，不能宣称通过。未执行 AG-1 或 E2–E5。 |
| 范围 | 仅限 U19 白名单内文档与本 Receipt；未改产品代码、测试、Schema、旧八图或其他 Unit。保留共享工作树原有未提交改动；未提交 Git、未移动归档文件。 |
| GALHCG | 项目身份为 `acprogram`。`datapack-contracts.md` 的 7 个 owner 分两页、`refresh-update.md` 的 2 个 owner 一页、`00-index.md` 的 9 个 owner 分两页均已读完；相关 node / edge Evidence 页完整。changed 显示三份已映射文档分别有 4、1、6 条旧 Evidence 版本未与当前文件同步；Task 与本 Receipt 为 `unreferenced_path`。按权限仅记录，不改图、refresh 或写 freshness。 |

## 文档收尾

- Datapack 契约页新增 `Datapack.maps`、`GameplayMapDef.resumeVersion`、有限 E1 `effectProgram`、Encounter locals / condition completion、Registry 上下文校验与 MapRun Owner / Preview / Commit / Save 边界，并链接可装载例图作者指南。
- UI 刷新页记录 E1 声明摘要、Counter / Flag 当前进度、Owner Preview 与实际 Receipt 的消费边界、零变化呈现及已有 Map DOM / Flow 局部更新证据。明确自动化 DOM 证据不替代浏览器验收。
- Task 与索引现反映 U01–U17 实际 Receipt、U18 按用户请求跳过、U19 文档收尾完成。阶段施工流按用户豁免结项；完整 E1 验收未被证明，AG-1 不因本 Receipt 自动开始。较早 handoff 中“下一步 U12C”作为当时停点，不再作为当前状态。

## 验证与未执行项

| 检查 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 文档链接与结构 | `npm run check:docs` | 通过；扫描 1136 份 Markdown，errors=0，退出码 0。 |
| 差异空白 | `git --no-pager diff --check`；`rg -n '[ \t]+$' docs/plan-work/task-0312-units/receipts/task-0312-u19-receipt.md` | diff 检查退出码 0，仅有共享工作树既有 CRLF→LF 提示；Receipt 尾随空白扫描退出码 1、无匹配。 |
| GALHCG changed | 对 5 个直接影响路径逐项只读检查，并分页读取全部 owners / Evidence | 5/5 路径已检查；三份映射文档 owner 与 Evidence 分页 complete；Task 和 Receipt 未映射。`freshness_written=false`。 |
| 产品测试 / 浏览器 | 按用户“跳过验收”的指示未运行。U01–U17 的历史验证只引用各自 Receipt；本次未重跑。 | 未执行；不构成通过声明。 |

## OLD / EQ / NEW 与剩余风险

U01–U17 的用例映射和真实验证结果分别保留在其 Receipt；U19 未修改金样或删改旧期望。U18 未执行，故本 Receipt 不补写 EQ05 / NEW05 的完整纵向、宽屏交互或 Save/Load 实机证据。E1 产品完整验收与发布准入仍未由测试证据成立。
