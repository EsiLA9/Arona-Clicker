# Task 0239：Base 免费领取阿比多斯三名学生的 Spot

状态：in progress — U0 实现、定向测试、类型检查与 GALHCG 收口已完成；唯一验证待办是修复并行 `first-read.md` 的范围外 R1 后重跑 `check:docs`。本 Task 不修改该文件。

## 目标

在 Base 的夏莱主厅增加一张免费、可手动领取的一次性 Spot。领取成功后立即将星野（`Hoshino`）、芹香（`Serika`）和白子（`Shiroko`）加入玩家角色名册。

这是一条确定性内容奖励，不使用随机 Gacha：已有常规卡池每抽需要 120 青辉石且只随机获得一名，无法表达“领取后立即获得三人”。玩家若已持有其中某人，沿用现有 `grantCharacter` 重复获得语义（默认返还该差分 1 片段并递增获得次数）；本 Task 不新增“仅未拥有时发放”的通用机制。

Spot 挂在 `base:area:schale_main`，不加入该 Area 的 `defaultSpots`，因此进入夏莱时不会自动领取。Spot 使用全局持有，正常切换、重启或重置世界线后仍保持已领取，避免再次免费领取；不为编辑器删除或直接篡改内容增加新的全局领取账本。

## 已核实事实

| 事实 | 源码 / 测试依据 | 对方案的影响 |
| --- | --- | --- |
| `SpotBuilder` 默认购买方案已是 `id=free`、`label=免费`、无成本；默认无 Reveal 条件的 Spot 可见。 | `src/arona-clicker/content/def-factory/spot.ts`；`src/engine/visibility/visibility-eval.ts`。 | 新 Spot 不需要 `.cost(0)` 或新支付类型。 |
| 当前区域设施列表由 `Registry.spotsOfArea(areaId)` 投影所有属于该 Area 的 Spot；`Area.defaultSpots` 表示进入 Init/Area 时自动设为 Lv.1 的设施。 | `src/data-services/registry/registry.ts:spotsOfArea`；`src/ui/components/production.ts`；`src/arona-clicker/services/init-service.ts`。 | 将 Spot 定义到夏莱主厅即可显示；不得加进 `areas.ts` 的默认设施列表。 |
| `SpotService.unlockSpot()` 成功后以原子 Spot 交易写入 Lv.1，并产生 `spotLevelChanged`。 | `src/arona-clicker/services/spot-service.ts:unlockSpot`；`src/arona-clicker/state/state-mutation-service.ts:commitSpotTransaction`。 | 可用按 Spot ID 过滤的一次性 `onSpotLevel(spotId)` Trigger 同步发放角色。 |
| `grantCharacter` 通过 `EffectOps` 委托同一个 `StateMutationService.acquireCharacter(variantId, 'story')`；默认差分 ID 为 `Hoshino`、`Serika`、`Shiroko`。 | `src/arona-clicker/state/effect-ops.ts`；`src/arona-clicker/state/state-mutation-service.ts:acquireCharacter`；`src/arona-clicker/content/character-variants.ts`。 | 只需声明式 Base Trigger，不新增角色写入口或存档字段。 |
| Base 正式内容由 `base-datapack-source.ts` 聚合 TypeScript 内容模块；运行时 `default-datapack.ts` 导入 `base-pack/content.json`。Base 文件夹导出脚本不会回写运行时 bundle。 | `src/arona-clicker/content/base-datapack-source.ts`、`default-datapack.ts`；`scripts/export-base-datapack.mjs`；`tests/data/base-datapack-folder-export.test.ts`、`bundled-base-pack.test.ts`。 | Spot/Trigger 源码与运行时 Base JSON 必须同步；验证两边投影一致。 |

## Patch Unit U0：免费 Spot 与一次性三人奖励

**Allowed Files**

- `src/arona-clicker/content/spots.ts`
- `src/arona-clicker/content/triggers.ts`
- `src/arona-clicker/content/base-pack/content.json`（由 Base 内容投影生成并同步，不手工改散落字段）
- `tests/engine/base-onboarding-spot.test.ts`（新增）
- 本 Task 与 `docs/plan-work/00-index.md`

**实现约束**

- 新 Spot 使用 `base:` 命名空间、所属区域为 `base:area:schale_main`、无 Reveal gate、默认免费、`.global()` 且最多 Lv.1；不声明 Gacha 功能。
- 不改 Area 的 `defaultSpots`，不改角色、Gacha、TriggerSystem、StateMutation 或 Schema 契约。
- 用 Spot ID 精确过滤 `spotLevel` Trigger；Trigger 一次性授予三个默认 Variant。正常 Spot 解锁后奖励在同一同步事件链中完成。
- Base JSON 与 TypeScript 内容源一致；不得手改 `tools/datapack-editor/schema/engine-defs.gen.json`。

**验收标准**

- 新 Spot 在夏莱主厅可见、开始时未拥有且免费；成功领取后达到 Lv.1、资源余额不变，三个 Variant 均在 roster 中。
- 再次解锁被 `AlreadyOwned` 拒绝且不重复发奖；正常硬重开/切换后 global Spot 仍已拥有。
- 领取和奖励走现有 Spot / Trigger / StateMutation 路径；不调用随机 Gacha，不增加专用运行时机制或状态字段。
- Base TypeScript 投影、运行时 JSON 与导出包解析测试一致。

**最小 Read Set 与验证**

- `docs/ai/context-packs/character.md`、`world-lifecycle.md`；`docs/docs-829/04-mechanisms/arona-clicker/{world-lifecycle,state-mutation,gacha-cultivation}.md`。
- `src/arona-clicker/content/{spots,triggers,areas,base-datapack-source}.ts`、`src/arona-clicker/content/def-factory/spot.ts`、`src/arona-clicker/services/spot-service.ts`、`src/arona-clicker/state/{effect-ops,state-mutation-service}.ts`、TriggerSystem 与状态归属源码。
- `tests/engine/{spot-payment,trigger-system,trigger-kind,roster-system}.test.ts`、`tests/data/{base-datapack-folder-export,bundled-base-pack}.test.ts`。
- 定向 Vitest、`npx tsc --noEmit`、`npm run check:docs`、`git --no-pager diff --check`；完成后按 GALHCG 协议维护新增/变更路径。

## Receipt

### Patch Unit U0 Receipt（2026-10-05）

状态：源码施工、定向验证与 GALHCG 映射写后核验完成；仍待范围外 `first-read.md` R1 修复后重跑 `check:docs`。

**实际修改**

- `src/arona-clicker/content/spots.ts`：新增 `base:spot:abydos_student_recruitment`，属于夏莱主厅、无 Reveal gate、沿用 SpotBuilder 默认免费支付、`global=true`、`maxLevel=1`。没有把它加入 `Area.defaultSpots`，因此不会在进入 Init 时自动领取；未声明 Gacha 或其他功能。
- `src/arona-clicker/content/triggers.ts`：新增按该 Spot ID 精确匹配的 `once=true` Trigger，以现有 `grantCharacter` 效果顺序授予 `Hoshino`、`Serika`、`Shiroko`。
- `tests/engine/base-onboarding-spot.test.ts`：在 `startNewGame()` 完成初始默认 Spot 事件后、手动解锁前，断言三名学生均未持有且该奖励 Trigger 尚未完成；另覆盖主厅可见、免费解锁、资源余额不变、同步入队、二次解锁拒绝、Trigger 单次性、已持有星野时的默认 +1 碎片补偿，以及 Init 切换和硬重启后 global Spot / roster 保留。
- `src/arona-clicker/content/base-pack/content.json`：从 `baseDatapackSource` 用临时 Vite SSR 内容投影生成并同步。投影保留运行时本地图片 URL，并带 `modName: "base"`；该字段是必要的，因为 Pack parser 从 Base manifest 填入 `modName`，运行时 bundle / 文件夹导出一致性测试要求两侧相等。

**验证**

- `npx vitest run tests/engine/base-onboarding-spot.test.ts tests/data/base-datapack-folder-export.test.ts tests/data/bundled-base-pack.test.ts --reporter=dot --silent`：3 个文件、6 项测试通过；首个端到端测试显式确认初始 Spot 事件没有提前发奖。
- `npx tsc --noEmit`：通过。
- `npm run check:docs`：Receipt 更新前曾通过（682 篇 Markdown、0 错误）；最终复跑出现 1 个范围外 R1，见下方。
- `git --no-pager diff --check`：通过；仅报告其他预先修改文件的 CRLF 提示。

**待处理验证阻塞**

- 最终 `npm run check:docs` 指向不在 U0 Allowed Files 的 `docs/docs-829/01-architecture/first-read.md`：裸链接 `[[state-mutation]]` 命中 docs-828 两个历史页及当前 `docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`，产生 R1 链接歧义。本 Unit 未修改该并行文件；修复后需重跑 `npm run check:docs`。

**GALHCG Receipt（2026-10-05）**

- 项目身份经 `resolve_project` 核验为 `project_id=acprogram`，根目录与本工作树一致；`project_info` 显示无自定义 map/source scopes。按当前源码和测试复核后只复用既有 `concept:spot-service`、`concept:trigger-system`、`concept:character-roster-and-acquisition`、`concept:default-datapack` 与 `concept:goal-workflow`，未新增 Concept。
- 对六条直接路径完成 `review_changes` 和预览：`spots.ts` 原有 SpotService/defaultDatapack 两条边、`triggers.ts` 原有 TriggerSystem/defaultDatapack 两条边、`00-index.md` 的 planning-records 节点 Evidence、Project→planning-records contains 与 Goal Workflow→index maps_to Evidence 均因内容变化待刷新。`base-pack/content.json`、新增 E2E 测试和本 Task 首次不在已保存清单；按精确 include 分别刷新三个目录，各新增目标文件 1 个、移除 0 个；随后 `resolve_paths` 确认六条路径均已索引。
- 写入 11 个现有/新增 Evidence 引用，计划分两批并逐批 dry-run、提交：先刷新 planning-records 节点 Evidence，再刷新 Project→planning-records contains、上述 source/index 映射，并新增 defaultDatapack→Base JSON、SpotService/TriggerSystem/Roster→E2E 测试（角色证据支持双映射）。全部 `dry_run` 返回 `valid=true`、完整且无错误；Task 文档稳定后，再以最终版本 token 映射到 SpotService、Roster and Character Acquisition、defaultDatapack 和 Goal Workflow，角色/Spot/Base/工作流映射均使用现有 Concept。
- 写后 `verify_freshness` 对当前 source、Base JSON、E2E test、index 的 11 个 Evidence owner 均返回 `fresh`、`complete=true`。`review_changes` 对 spots、triggers、Base JSON、测试、index 的直接 owners 已分页复核；源、bundle、test、index 无 stale Evidence。路径检索命中全部 5 个预期文件，概念检索命中上述 5 个既有节点；Concept→File 定向 `traverse` 均为 complete、未截断并到达目标映射。`map_inventory` 显示 Base bundle 目录的目标 JSON 1/1 已映射且有 Evidence，Test 目录 127/127 文件均有关联、unassociated 为 0；Spot、角色与 Trigger 的测试 Concept 盘点均完整。
- `npm run check:docs` 仍有已知的范围外 R1，指向并行 `docs/docs-829/01-architecture/first-read.md` 中的裸 `[[state-mutation]]` 歧义；本 Task 未修改该文件，也未将此检查写成通过。本文最终版本写入后，其 Goal Workflow、SpotService、角色获取与 Base 内容四条文档映射使用该版本令牌提交，并完成 freshness、search、traverse 与 Concept 范围 inventory 核验。
