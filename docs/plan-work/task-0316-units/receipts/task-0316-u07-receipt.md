# Task 0316 U07 Receipt：文档与收尾

状态：complete

## 文档交付

- 同步 `datapack-contracts.md`、Map Action E1/E2 作者示例与 Draft 0312 E2 路线，准确区分当前确定性子片和后续随机／通用语句体循环／资源 Value。
- 在 `docs/plan-work/00-index.md` 登记 Task 0316，并修订 Task 0315 / Draft 的当前实现索引，避免把已实现的确定性集合和 Value 仍写成完全未实现。
- 新增 U01–U07 Unit Receipts；不改 E1 浏览器验收豁免，也不声明全产品验收。

## 收尾验证

- `npm run gen:schema`：通过，Schema 由生成器更新。
- `npm run check:docs`：通过，扫描 1178 篇 Markdown，0 errors。
- `git diff --check`：通过；Git 仅报告既有 CRLF→LF 工作区提示。
- GALHCG project `acprogram` 的只读 `graph_health(check="changed", path="docs/docs-829/03-data-structures/datapack-contracts.md")` 完成；该现有 File 关联回报 `content_changed`／4 条旧 Evidence 已过期，并有 7 个 Owner（Owner 分页未全部展开）。对未关联的 Planner 源文件做定向检查返回 `unreferenced_path`。本 Task 未获授权改图、refresh 或写 freshness，因此只记录，不修改 Project Map。
- 全工作区 Changed 检查首屏为 20 条中的 8 个待关注项，主要落在此前已改过的 AGENTS / 文档路由；并非本 Task 的产品失败证据。此检查为只读、未写 freshness。
- Save/Resume 对仍活动且存在同 scope Owner checkpoint 的 Encounter 完整重放 E2 计划。遭遇已关闭、没有可信 Enemy HP snapshot 时，只保留 receipt 的结构、合法 roster、批次顺序、HP projection 与结算内部校验；不宣称能复核离场前的 Enemy 完整历史。
