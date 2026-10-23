# Receipt 0312-U15

| 项 | 内容 |
| --- | --- |
| 状态 | U15 Runtime ReadModel 接线与指定验证完成；不代表 U16/U18/U19 或完整 E1 发布验收完成。 |
| 实际修改 | 修改 `src/arona-clicker/contracts/runtime/runtime.ts`、`src/arona-clicker/contracts/map/map-run.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts` 及既有 `tests/engine/gameplay-b-effect-projection.test.ts`；新增本 Receipt。 |
| 未完成内容 | 本 Unit 无未完成项。U16 UI、U18 真实例图纵向/浏览器验收、U19 文档与 GALHCG 统一收尾仍待执行。 |
| 范围外变更 | 无；仅 U15 白名单。未改 Datapack schema 或生成协议。 |
| GALHCG 影响闭环 | 项目身份 `acprogram`；影响累计至 U19 统一只读复核。本 Unit 未编辑图、刷新或写 freshness。 |

## 实际接线

- `MapWorkspaceActionView` 与 Ability/Item `SourceOption` 为合法 E1 Program Action 附 U14 声明摘要；摘要按 `run/map/node/activity/round + source + primary` 生成并缓存，Hand 与已选目标分开，避免沿用仅按 actionId 的上下文错误。legacy costs/hpEffects/cardEffects 保持。
- Actorless source 选项继续检查无角色候选、合法目标，并排除 E1 source/sourceActor、Card、Action cost 与 prepare 用法；无效 Program 不生成声明摘要，Owner Commit Preview 的 diagnostics 原样保留。
- Commit Preview 只读透传 Owner settlements、E1 version/contract/scope/visits/plannedLocals/trace；readmodel 不自行执行 Guard 或安装计划。最近 Receipt 透传同一 E1 字段、Party/Enemy/Ability/Item 资源与 HP 结果、卡目标和来源 scope。
- 当前 Encounter 无本地 `lastCommit` 时，workspace recentCommit 使用 MapRun 顶层最近 Receipt，并保留其原 node/activity/round；跨 activity 后不把旧 Receipt 误归到新 Encounter。
- `currentEncounter.completion` 对条件完成提供条件声明与复制后的当前 locals，不计算完成真假；activityId 也进入查询结果。

## 行为覆盖与 ID 映射

| 映射 | 本 Unit 证据 |
| --- | --- |
| OLD01 / 旧 relation | 既有 Map relation 与 Runtime integration 回归保持通过；旧查询字段仍在。 |
| NEW01 | Action/Hand/PlayerCommand/Enemy/Ability/Item 摘要区分 source、primary 和 CardRef；声明 then/else 两支与 Owner Preview 实际选中的分支分开。 |
| NEW03 / NEW04 | Owner Preview/Receipt保留 Counter 实际 delta 0、planned locals 末值和同 Flag 的连续写入；当前条件查询提供条件与 local 值。 |
| EQ05 / D07-D08 的 ReadModel 部分 | E1 receipt visits/trace/scope 跨 Preview→Commit→recentCommit 完整透传；跨 activity 回执仍带原 activity scope。U12 validator 校验仍归 U12。 |
| PlayerCost / E1-COMPAT-1 | PlayerCommand 选项摘要带合法候选；草拟时 PlayerCost 未扣。prepare sCost 折扣仍对应真实 CardRef，未改 PlayerCost。 |

重复查询测试比较 ReadModel 前后的 Run、Hand、RNG、draft 和库存；全部不变。Item/Ability 实际资源变化与 Owner Receipt 一致，HP cap 后的 delta 0 未被过滤。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为 | `npx vitest run tests/engine/gameplay-b-effect-projection.test.ts tests/engine/gameplay-b-map-runtime-integration.test.ts tests/engine/gameplay-b-map-relations.test.ts --silent` | 通过，3 files / 19 tests，退出码 0。 | 新增投影行为 3 项；两组旧回归 13 项。 |
| 类型 | `npx tsc --noEmit` | 通过，退出码 0。 |  |
| 架构 | `npm run check:architecture` | 通过，退出码 0。 |  |
| 文档 | `npm run check:docs` | 通过，扫描 1133 份 Markdown，errors=0，退出码 0。 | Receipt 写入后复核。 |
| 范围 / 空白 | `git --no-pager diff --check`；`rg -n "[ \\t]+$"` 检查测试与本 Receipt | 通过，退出码 0；新增文件无尾随空白。 | Git 仅提示共享工作区既有 U12 trace 文档 CRLF→LF 规范化。 |

## 遇到问题

- 初始投影以 actionId 单独缓存会把已选目标摘要误用于 Hand/Command；改为将完整 source/primary/scope 纳入缓存键，并由重复查询行为用例验证。
- Owner 预览与 active Encounter Receipt 之外，MapRun 顶层还保留上一 activity 的 Receipt；workspace 现按当前 Encounter Receipt 优先、否则回退到顶层 Receipt，并暴露原 activity scope。

## 需上游确认项

- 无。

## 事实更新建议

- ReadModel 的条件完成数据是声明 + 当前 locals，Owner 仍是完成判定来源。U16 可据此渲染当前进度；不得将声明分支当作实际结算。
