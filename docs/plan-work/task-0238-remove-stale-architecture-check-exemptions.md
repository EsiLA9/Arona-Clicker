# Task 0238：移除架构检查中的失效兼容路径豁免

状态：proposed — 来自 Task 0235 的 P3 Code Review 发现；尚未修改架构检查脚本。

## 目标

移除架构检查脚本中指向已不存在文件的精确路径豁免，避免同路径未来重新出现时绕过 `src/engine` 的依赖边界检查。

## 设计边界

- 缺陷等级：P3。当前两个兼容路径在磁盘上均不存在；风险在于路径若被重新创建，检查器仍会对整文件跳过禁止依赖判断。
- 范围仅限废弃豁免与相应架构检查说明；不重做架构规则，不恢复兼容文件。
- 明确非目标：更改 `src/engine` 或 `src/data-services` 当前依赖；新增新的兼容例外；重构架构检查脚本。

## Patch Unit

### U01：删除失效豁免并核实检查器

**Allowed Files**

- `scripts/check-architecture-boundaries.mjs`
- `docs/docs-829/06-wiki/60-engineering-support/architecture-checks.md`
- `docs/plan-work/task-0238-remove-stale-architecture-check-exemptions.md`

**Completion Criteria**

- [ ] 已确认 src/engine/image/image-store.ts 与 src/engine/image/resolve.ts 均不存在，并从豁免集合中移除。
- [ ] `src/engine` 中每个现存 TypeScript 文件都继续接受当前禁止依赖规则检查。
- [ ] Wiki 准确说明检查器按当前文件扫描并说明其静态分析边界。
- [ ] Receipt 记录实际差异、检查结果与未覆盖的规则边界。

**Verification**

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 架构边界 | `npm run check:architecture` | 通过，现存 Engine / Data Services 文件符合规则 |
| 文档链接 | `npm run check:docs` | 通过 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 当前事实与证据

| 事实 | 依据 | 说明 |
| --- | --- | --- |
| 架构检查器的 `compatibilityShims` 仍含 src/engine/image/image-store.ts 与 src/engine/image/resolve.ts，精确命中的文件会跳过 forbidden-import 检查。 | `scripts/check-architecture-boundaries.mjs` 的 `compatibilityShims` 与 `checkBoundary()` | 此为整文件跳过条件。 |
| 两个豁免路径当前都不存在。 | `rg --files src/engine` | 当前文件树中无 `src/engine/image/`。 |

## 相关路由

[[archive/task-0235-newcomer-oriented-project-code-review]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/06-wiki/60-engineering-support/architecture-checks]]
