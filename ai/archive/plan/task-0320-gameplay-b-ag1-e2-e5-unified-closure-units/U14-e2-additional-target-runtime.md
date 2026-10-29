# Unit 0320-U14：E2 additionalTarget Runtime 闭环

## Goal

把 U11/U11b 的 `GameplayMapActionDef.additionalTarget` 静态作者字段接入唯一 MapRun Owner：Party Prepared、PlayerCommand、Ability、Item 可显式选择一个 Party Character 或 Enemy；完整贯通 Draft、Preview、Commit、资源账本、Receipt、Save/Resume、scheduler v4 Restore 与游戏 UI。`additionalActor` 余额读取/写入和循环中的 `loopTargetActor` 写入进入同一受限 Planner / Owner 计划，不建立第二结算路径。

本 Unit 按下列顺序施工；各片共享 MapRun / Receipt 合同，不得在最终验证前把中间状态当成可交付功能：

1. **U14a Owner Draft/API**：追加目标持久化、public commands 和 Preview 只读投影。
2. **U14b 作者资源写账户**：增加 `additionalActor` / `loopTargetActor` `resourceChange` 合同与 Context/Registry/Schema 同步。
3. **U14c Planner/AG-1 Owner**：绑定来源实际目标身份；按队列顺序结算并回放追加目标与资源账本。
4. **U14d UI**：在现有 Workspace 增加第二个目标按钮组并验证真实 DOM 命令链。

U14c 与 U14a 均涉及 `map-run-service.ts`，必须串行；U14d 等 U14a 的 Runtime 投影/API 稳定后施工。作者 Schema 的 U14b 可与 U14a 并行，但最终统一复核。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 入口/架构 | `AGENTS.md`、production 与 ui-presentation context packs、`architecture-discipline.md`、`testing.md`、`schema-sync.md` | Runtime Owner、UI 命令边界、Schema 和行为验证 |
| 上游合同 | U08 §additionalTarget/资源账户、U11/U11b、U12b/U12c、U13a/U13b 及其 Receipt | 已冻结目标身份、来源时点、Loop 词法身份、scheduler v3 起点 |
| Runtime | `map-run.ts`、`runtime.ts`、`runtime-commands.ts`、`runtime-game-instance.ts`、`gameplay-b-action-preview-resolver.ts`、`map-effect-planner.ts`、`map-run-service.ts` | Draft merge、目标资格、source input、detached ledger 和 Restore |
| 作者端 | `gameplay-map-effects.ts`、E2 syntax/context/normalization/Registry、生成 Schema 与定向测试 | resourceChange 账户的作者闭合和来源/循环约束 |
| UI | `ui-style/00-index.md` 与 `patterns.md`、`frontend-design-project-overlay.md`、`map-workspace.ts`、`controller-actions-operation.ts`、Workspace DOM 测试 | 继承现有 target picker、刷新 owner 和 delegated commands |

## Frozen Contract

- 沿用 `additionalTarget: 'partyCharacter' | 'enemy'`；每个 Action 最多指定一个额外领域单位目标。它必须与单位 `primary` 并存；CardRef、self、none 主目标以及 Enemy natural source 不可使用。
- 运行时来源限 Party Prepared / PlayerCommand / Ability / Item。Enemy 自然来源若被配置为 `additionalTarget`，Registry/Preview/Commit 均拒绝。
- 有效候选是当前 MapRun、Encounter/Activity、Round 中存活且侧别匹配的实体。secondary 与 primary 不同；若来源是 Party Character 且 secondary 是 Party Character，还须不同于来源者。
- secondary 阵营只需匹配 Action 声明的 `additionalTarget`，与 primary 阵营无关；Party primary + Enemy secondary、Enemy primary + Party secondary 都合法。仅当 primary/secondary 是同一领域单位身份时拒绝；不得将主次目标强制同侧。
- 目标必须显式选择；即使候选恰好只有一个也不自动选择。存在合法候选但尚未选择时，Preview 标明等待选择且 Commit 拒绝。Party Prepared Action 若没有任何合法 secondary，沿现有 `noLegalTarget` 语义跳过该来源，不能静默省略次目标后照常运行；无候选的 Ability/Item 不能进入 Commit，玩家可清除该来源。选择不会自动 fallback。primary 变更后若与 secondary 冲突，则清空 secondary 并要求玩家再次选择；Action/来源变化、新 Round 或新 Encounter 清除不再适用的 secondary。
- Party `targetSelections` 按来源角色保存 primary 与 secondary 两项；Ability/Item draft 分别保存两项。Setter 必须按字段 merge，不能因设置 primary 覆盖 secondary，反之亦然。Draft token 严格绑定 run/node/activity/round/version。
- Preview/Commit/Restore 再验当前可选身份、secondary 与 Action 声明侧别相符、同侧 primary/secondary 身份不同、Party 来源者不重复；不能要求 secondary 与 primary 同侧。队列开始时身份锁定；若更快来源使目标倒地，后续来源仍使用同一身份，不换目标，目标侧本次操作结果为0；仍按 AG-1 规则支付来源成本。
- `resourceBalance` / `resourceAtLeast` 的 `additionalActor` 绑定锁定 secondary。`resourceChange` 增加 `additionalActor` 与仅循环体内可用的 `loopTargetActor`；写入按 Planner 语句顺序进入 detached Actor ledger，后续 AG-1 来源只能看见已兑现前序结果，同一来源不能拿自身奖励付成本。
- 倒地的额外目标不获得该来源的目标侧 HP/Status/Actor-resource 结果；对应操作 delta 为0且不得替换身份。与额外目标无关的 source/primary/team 操作照常执行。
- Receipt 的 scheduler start snapshot、Party/Ability/Item settlement 与 execution sequence 均记录所选 secondary identity，即使该 Action 没有 secondary writer。Restore 从起点重建目标选择、Planner 与资源账本并精确比较目标、Trace、结算和当前 Run；任何缺失/伪造/改侧/改身份都拒绝。
- 一次性把 AG-1 scheduler 格式 v3 升 v4；所有受影响 AG-1 测试 Map `resumeVersion` 升一版（v4→v5），拒绝旧版本且不迁移。E1 Map/Hand RNG 算法不变。独立 E1/legacy Receipt Validator 不改。
- 目标 UI 使用现有 Map Workspace 的显式 target-picker 按钮样式，不扩 map-relation 拖放或关系高亮，也不创建新视觉方向。必须有实际 Controller→GameCommands 的 DOM 自动化覆盖；实现后按项目 UI 路由尝试宽屏桌面交互/视觉验收。若当前环境无法执行，提供独立需求报告并明确标记未验收，DOM 自动化不能替代屏幕验收。

## Compact DOM / Refresh Sketch

- Party Prepared Action：保留现有 primary `role="group"` 和 `[data-map-target]` / `[data-map-target-enemy]`；当已选 Action 声明 secondary 时，在同一 Action 内容区添加第二个 sibling `role="group"`，标签为“额外目标”，按钮使用独立 `data-map-target-additional` / `data-map-target-enemy-additional`，focus key 包含 source 与 `additional` 角色。
- Ability / Item：复用 `renderSourceTargetPicker` 的既有来源卡片；主目标组之后仅在当前所选 Action 声明 `additionalTarget` 时挂载第二组，分别写入当前 Ability/Item draft。
- State 由 MapRun Draft/Preview projection 持有；点击经 `controller-actions-operation.ts` delegated handler 调对应 GameCommands，不在组件本地缓存目标。
- 点击后通过既有 workspace refresh 更新受影响 target-picker 所属区，保留源 Action 节点、其他来源卡片、滚动 owner、popover 生命周期和焦点；不触发全页 `UIController.render()`。CSS 沿用 `.map-workspace__target-picker` / `.map-workspace__target-choice`。

## Allowed Files by Serial Slice

### U14a Owner Draft/API

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/runtime/runtime-commands.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-runtime-integration.test.ts`

### U14b Author write accounts / Schema

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts` (only if projection requires a change)
- `src/data-services/registry/registry-validate.ts` (only if syntax/context do not close the author boundary)
- `tools/datapack-editor/schema/engine-defs.gen.json` (generator only)
- corresponding `tests/data/gameplay-b-effect-{syntax,normalization,registry}.test.ts` and `engine-schema.sync.test.ts`

### U14c Planner / AG-1 Owner

- `src/arona-clicker/contracts/map/map-run.ts` (settlement/sequence 的 secondary identity 字段；Restore 按类型重算闭合 Receipt)
- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts` (允许 additionalTarget 阵营独立于 primary 阵营，并验证双方单位身份)
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/services/map/map-effect-summary.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- `tests/engine/gameplay-b-effect-projection.test.ts`
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`

### U14d UI

- `src/ui/components/map/map-workspace.ts`
- `src/ui/controller/controller-actions-operation.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `ui-style/patterns.md`（仅补本次已核验的复用事实）

禁止扩展到关系拖放、独立 Card/Tag/成长 UI 或 U07 实屏验收。所有 slices 限改各自白名单，跨 slice 的同名文件串行编辑。

## Stop Conditions

若现有 Party/actorless Draft 无法无损保留主/次目标、来源身份无法在 AG-1 队列开始时唯一绑定、倒地 secondary 的目标结果不能在同一 detached 账本定义、Restore 必须改变白名单外独立 E1 Validator，或预计超出 U14 的 closed contract，则停下并交 Task Owner 证据与最小拆分，不回退为自动选人。

## Completion Criteria

- [ ] Party Prepared/PlayerCommand/Ability/Item 都能选 primary + 一个明确 secondary；Enemy natural 来源被拒。
- [ ] Preview/Commit 校验并显示次目标；次目标与其声明侧别匹配且可异于主目标阵营；无选择、身份冲突、声明侧别错配、Party 来源者本人、失效 token 与 Save/Restore 篡改被拒。
- [ ] `additionalActor` 读写与 `loopTargetActor` 循环写账本有序、原子；后续来源读取正确；倒地目标 identity 保留且目标侧结果0。
- [ ] Receipt/Save/Resume 使用 scheduler v4，从同一起点重算目标、效果、资源与结果；拒绝 v3/未知和 `resumeVersion:4` 存档。
- [ ] Party 与 Ability/Item 至少各有一条真实 DOM click→Controller→GameCommands 自动化流程；两项均证明 primary 保留、secondary 回显和 Preview/Commit 结果。
- [ ] 按项目 UI 路由完成宽屏桌面交互/视觉验收；若工具或应用环境无法执行，交付逐项需求报告并明确未通过/未执行。
- [ ] 定向作者/Planner/Commit/Restore/UI 测试、Schema sync、`npx tsc --noEmit`、`npm run check:docs`、`git --no-pager diff --check` 通过。

## Verification

按实际改动定向运行 E2 syntax/context/registry/Schema、Planner、MapRun、AG-1 Commit/Restore 与 Workspace DOM 测试；最终汇总独立验证各命令输出。UI 使用现有宽屏鼠标交互；实现后尝试桌面浏览器验收，无法执行时交付逐项需求报告，自动化 DOM 断言不表述为屏幕验收。
