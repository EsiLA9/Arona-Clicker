# Task：Spot 资源产出统一收敛至 Affector

状态：done — 已完成并归档（2026-09-15）

## 目标

移除 Spot 上旧的资源获取设计，使 Spot 的持续资源产出统一由挂载到 Spot 的 Affector flow 表达，并保留多资源、不同额、按 Spot 等级线性增长的能力。

本任务同时清理默认 Datapack、测试/示例 JSON、Runtime Editor / authoring 面与运行时求值路径，避免旧字段继续生成、导入、编辑或参与 GameNum 求值。

## 设计边界

- 保留 Spot 的购买成本、升级成本、容量、等级上限与升级时一次性效果。
- 保留 `levelUpgrades[].effects` 作为升级动作的一次性状态效果；它不改造成持续 flow。
- 持续产出统一使用 Spot `flow` / `linearYield` 功能生成 Affector flow，或使用显式 Affector pack 的多条 `flows`。
- 每条持续产出独立声明资源与数值；按 Spot 等级的表达式以该功能所属的 `spotId` 求值。
- Spot 生成的主产出 flow 进入 Spot / Area / Init 的乘区链；普通 Affector flow 保持额外加算语义。
- 不新增存档迁移或旧字段兼容逻辑；PlayerState / Datapack 结构允许破坏性变更。
- 不重做 Affector / GameNum 的层级模型、缓存失效模型或资源 UI 总体架构。

## 影响清单与代码落点

| 范围 | 完成内容 | 主要落点 |
| --- | --- | --- |
| 合约 | 移除 Spot 旧直接产出字段；增加 `flow`、`amount`、`startLevel` 与 Spot 产出查询 | `src/data-services/contracts/world.ts`、`src/engine/contracts/` |
| Affector | Spot 的 `flow` / `linearYield` 转译为带 `mountEntityId=spotId` 的派生 Affector；支持热替换与状态对账 | `src/engine/effect/affector-engine.ts` |
| GameNum | 按资源建立 Spot 子树；主产出/普通 flow 分流；支持 `evaluateSpotYields` 与资源定向失效 | `src/engine/expression/` |
| 内容 | 默认 Spot 与 Showcase 内容改为 flow；generic upgrade 改为 Affector linear flow | `src/arona-clicker/content/` |
| 数据包 | 更新源 JSON 与四个现有 ZIP 数据包；移除旧字段及 `levelLinear` | `datapack/` |
| Runtime Editor | 删除旧字段的 draft、表单状态、materialization 与 authoring 入口；复杂 functionalities 仍由 Datapack/Affector 声明 | `src/arona-clicker/contracts/`、`src/data-services/authoring/`、`src/ui/workspace/` |
| UI | Spot / Area / 生产卡片展示多资源明细；移除旧单一产出与倍率行 | `src/ui/components/`、`src/ui/update/` |
| Schema | 由引擎类型重新生成编辑器 Schema，并同步 editor extras | `tools/datapack-editor/schema/` |

## 施工切片与执行结果

### P0：完成字段与数据包影响清单

已完成。清点了源码类型、Builder、GameNum、UI、authoring policy、Runtime Editor、默认 Datapack、测试夹具、源 JSON、ZIP 与生成 Schema；确认 `engine-defs.gen.json` 只能通过 `npm run gen:schema` 更新。

### P1：移除旧 Spot 产出字段

已完成。运行时合约、GameNum 构建/求值、Runtime authoring 与默认数据不再消费或声明旧的 Spot 直接产出字段；旧 `levelLinear` 节点已移除。

### P2：收敛 Builder 与默认内容

已完成。Builder 改用 `.flow()` 与 `.linearYield()`；默认 Spot 的持续产出改为 Affector-backed functionality。`genericUpgrade` 的可选等级产出改为 `linearYield`，起始等级为 1 时保留原有按已解锁等级的线性语义。

### P3：Runtime Editor、Schema 与 JSON

已完成。Runtime Editor 仅保留基础 Spot 属性；复杂持续功能由 Datapack/Affector 声明。源 JSON、四个 ZIP 数据包与 Schema 已同步，且未加入存档迁移或旧字段兼容读取。

### P4：测试、UI 与文档收敛

已完成。增加一 Spot 多资源、不同额、按等级线性增长的回归测试；补齐跨资源树、升级刷新、热替换、authoring 拒绝旧字段与 UI 多资源展示覆盖；更新当前机制文档与 DSL 说明。

## 机制结论

- Spot 本身不再拥有独立的旧资源获取字段。
- Spot 的 `flow` / `linearYield` 在 Affector 引擎中生成自己的派生 Affector，并携带所属 Spot 的 `mountEntityId` 进入求值树；等级表达式读取对应 Spot 的 `spotLevel`。
- 同一 Spot 可声明多条 flow，分别产出不同资源与不同数值；`linearYield` 可通过 `amountPerLevel`、`startLevel` 表达按等级增长。
- 升级时一次性 `addResource` 奖励仍由 Spot service 执行，与持续产出分离。
- Runtime Editor 新建 Spot 若未配套 Datapack/Affector functionality，不会凭旧字段自动产生持续资源。

## 执行回执（2026-09-15）

- `npm run gen:schema`：通过，生成 Schema 与引擎类型同步。
- `npx tsc --noEmit`：通过。
- `npm test`：通过，160 个测试文件、1491 个测试全部通过。
- 定向测试：Spot functionality、runtime hot content、tooltip 与 UI dispatcher 通过；数据包、authoring policy、registry、ZIP loader、Schema/editor model/validate 通过。
- 四个现有 ZIP 数据包均可解析；JSON 条目共 23 / 1 / 6 / 6 个，均不含旧直接产出字段或 `levelLinear`。
- 当前源码、Datapack、编辑器 Schema 与 `docs/docs-828/` 的旧字段检索无命中；负向测试中的旧字段字符串仅用于验证拒绝行为。
- `npm run check:docs`：通过，扫描 202 个 Markdown 文件，错误数为 0。
- `git --no-pager diff --check`：通过；仅报告工作区换行符规范提示，无差异错误。

## 剩余工作

无。本任务已完成；若未来要让 Runtime Editor 直接编辑复杂 Spot functionalities，应另立任务，不重新引入 Spot 旧直接产出字段。

## 相关路由

[[docs/docs-828/00-INDEX]]
[[docs/docs-828/02-modules/affector]]
[[docs/docs-828/02-modules/game-num]]
[[docs/docs-828/02-modules/world]]
[[docs/docs-828/04-mechanisms/production]]
[[docs/docs-828/04-mechanisms/trigger-effect]]
[[docs/docs-828/05-conventions/schema-sync]]
[[docs/docs-828/05-conventions/testing]]
[[task-0073-spot-field-authoring-ladder]]
