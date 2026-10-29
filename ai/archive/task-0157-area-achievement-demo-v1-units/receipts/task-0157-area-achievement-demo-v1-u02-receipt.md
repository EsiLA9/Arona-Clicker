# Execution Receipt：Task 0157 U02

日期：2026-09-26

## 结果

- 在 `src/engine/core/entity-id.ts` 登记 `milestone-listener` 与 `achievement` 两种实体类型；在 Registry 增加 Listener / Achievement 表、表驱动 merge / clear 步骤和只读 Map 查询。
- 加载校验覆盖两个声明的 ID 格式与 typeName、包内重复 ID、Listener → Milestone / Area、Achievement → Listener 引用，以及最终合并视图中的一对一关系。引用可指向当前 Datapack 或此前已加载定义；同 ID 覆盖按 Registry 最终表语义参与关系校验。
- Listener `then` 运行时检查必须是数组，且每项 `op` 必须在明确的可执行白名单中。未知 op、`loot`、`travelToArea`、`setSpotMaxLevel` 与 `removeSpotMaxLevel` 均在加载期以 Listener ID 报错。
- 扩展 Registry 测试，覆盖表查询与清理、ID、引用、一对一关系、当前包 / 已加载包关系、运行时 JSON 非法 op 和旧 Milestone 独立加载。改动文件均在 U02 Allowed Files 内；未修改 U01 内容或其他声明、运行时、UI、Schema 与示范包。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/registry.test.ts` | 通过；1 个文件、40 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:architecture` | 通过；未发现 `src/engine` / `src/data-services` 禁止的向外依赖 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 308 |
| `git diff --check` | 通过 |

## 治理与后续

- 按上游交接，本会话此前的 AOCI Whole-Index 传输因 Host 输出截断停止；未重试。仓库已有孤儿路径治理问题保持未处理，也未扩大本 Unit 文件范围。
- 主 Task 仍有后续 Unit；AOCI 增量维护留到主 Task 的受管理对象达到最终稳定状态后统一处理。
- U02 加载期 Registry 条件已满足；Milestone Listener 的运行时生命周期仍由后续 Unit 负责。
