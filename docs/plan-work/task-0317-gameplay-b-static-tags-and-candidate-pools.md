# Task 0317：Gameplay B 静态 Tag 与候选池

状态：completed — Registry／Schema、MapRun 来源解析、正式示例与作者文档均已完成，并通过本 Task 记录的定向验证。

## 目标

让一个 Map 的 Character / Enemy 候选可以由直接候选和有限候选池共同提供。按 Action 身份合并权重后，只执行现有资格／费用／目标过滤、Tendency 调整和 Owner RNG 抽取。Action Tag 只提供静态分类与匹配，不触发效果。

## 冻结合同

- 仅属于 Gameplay B MapRun；不接入旧 Operation/EventRun 的 `OperationCardPool`，不创建额外 Hand、库存或运行时注入。
- Map Action 可声明 `tags?: TagRef[]`。每项必须是完整 TagRef，不提供裸路径默认 namespace；TagDef 声明只补充展示与层级信息，不作为引用前置条件。Pool 的 Tag 选择沿用 `matchesTag()` 的同 namespace 层级前缀语义。
- `GameplayMapDef.candidatePools` 是 Map-local、有序、有限的定义；每池由有序 `entries` 组成，入口类型为 Action、Tag 或另一候选池，并带正安全整数 weight。池引用按 weight 乘算子池贡献；未知引用和引用环由 Registry 拒绝。
- Character / Enemy 保留现有 `actions` 候选，并新增有序 `candidatePoolIds`。先按直接候选顺序，再按 poolIds 顺序展开；Pool 按 entry 顺序展开，Tag 按 Map Action 定义顺序匹配。相同 Action 的各来源权重累加，保留其首次出现位置；重复的直接候选与重复 poolIds 仍视为作者错误。
- 展开后每个 Action 的累计基础权重不得超过 `Number.MAX_SAFE_INTEGER`；超限拒绝。合并先于资格／费用／目标过滤与 Tendency；Pool-only 来源里对当前 Actor 不可用的 Action 被过滤，现有直接候选里的非法资格／目标配置仍作为作者错误拒绝。现有角色／敌人顺序、Hand 上限、无放回抽取、RNG 算法与 Save/Resume 语义保持不变。
- 仅静态 Map 内容进入本 Task。动态 Tag、角色成长注入、临时 Pool、相对卡选择、效果修正均不在范围内。

## 已核实事实

- Map Action 当前无 Tag，Map 定义无候选池；Character / Enemy 在 Encounter 内直接列 `{actionId, tendencyWeight}`。
- `drawGameplayBHands()` 位于 `src/arona-clicker/services/map/gameplay-b-hand-resolver.ts`；MapRun 开局与存档恢复均通过它重新解析 Hand，必须共用新来源合并路径。
- MapRun 的提交与 Receipt 校验也会重验 Hand Action 身份；这些路径必须认可 Pool-only 来源，不能只放开抽取和 Restore。
- `src/engine/core/tag.ts` 已提供完整 TagRef 与层级 `matchesTag()`；旧 Operation 有独立 CardPool resolver，不是 MapRun 的实现入口。

## 验收

- Registry 和生成 Schema 接受合法 Tag / Pool，拒绝非法 TagRef、未知 Action / Pool 引用、池环、重复 ID、非法权重和累计权重溢出。
- Map Action 可由直接来源、Action Tag 选择和嵌套候选池提供；同一 Action 合并为一个候选并稳定累加权重，资格、资源费用、目标与 Tendency 只在合并后处理。
- 同输入与同 Hand RNG seed 得到一致 Hand；抽取仍无重复，MapRun 开局与 Save/Resume 重算一致；Pool 不持有或安装 Hand 状态。
- 正式示例与作者文档展现 Tag 分类和两个来源汇入同一候选；同步 `docs/plan-work/00-index.md` 与 Draft 0312 的 E3 实施状态。

## 施工单元

### U01 — 合同、Registry 与 Schema

Allowed Files：

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/validation/gameplay-map-candidate-pools.ts`（新文件）
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由生成器更新）

完成条件：新增闭合合同与静态池展开／引用验证；Registry 覆盖 TagRef、池引用、循环和权重边界；按 Schema 同步规范生成协议。

### U02 — Hand 候选解析与 MapRun 接线

Allowed Files：

- `src/arona-clicker/services/map/gameplay-b-hand-resolver.ts`
- `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`
- `src/arona-clicker/services/map/map-card-effects.ts`
- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts`（允许静态 Action Tag 扩展，不改变 Effect Program 归一化语义）
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`

完成条件：Registry Effect Context、开局、Hand／PlayerCommand 预览、卡牌修正目标、资格重验、Commit / Receipt 和 Restore 共用候选合并路径；在既有资格与抽取算法前按冻结合同合并来源，不增加 Owner 状态、不改变 RNG 消耗规则。

### U03 — 正式样例与作者文档

Allowed Files：

- `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/examples/gameplay-b-card-tags-and-pools.md`（新文件）
- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/00-index.md`

完成条件：完整 Map 示例以两个来源共同提供一个带 Tag 的 Action；作者合同说明 Map-local Pool、权重累加、Tag 匹配与非目标，并同步阶段索引。

## 验证计划

- E3 行为定向测试：Map Registry 与 MapRun Hand / 恢复用例。
- `npm run gen:schema` 后运行 Schema 同步定向测试；运行 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check`。
- 收尾时只读复核直接影响范围；不执行 GALHCG graph edit、refresh 或 freshness 写入。

## 执行结果（2026-10-22）

- U01 完成 Gameplay Map `tags`、`candidatePools` 与 Encounter `candidatePoolIds` 合同；新增池展开／验证器并接入 Registry，拒绝非法 TagRef、未知引用、循环、重复定义／直接引用和权重越界；生成 Schema 已同步。
- U02 将有序候选展开和身份合并接入 Hand 抽取、Character／Enemy 预览、CardRef 目标资格、提交、Receipt、Effect Context 与 Save/Resume。Pool-only 普通 Action 的提交后恢复也已覆盖；恢复校验按是否存在 Effect Program Receipt 字段选择对应的程序 Receipt 验证路径。
- U03 为正式 Map 提供 Tag 与候选池内容，补充作者契约和完整示例。静态 Tag 仅分类／筛选，不执行效果；旧 Operation `CardPool` 未复用。
- 验证：`npm run gen:schema` 成功且生成文件未变化；10 个定向测试文件共 **308/308** 通过（Map Registry 141、Schema 同步 14、MapRun 47、Runtime integration 6、Effect Registry 13、Effect normalization 6、Effect Receipt 43、Map Cards 18、Receipt Boundaries 5、Effect Planner 15）。`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（1187 篇 Markdown，0 errors）及 `git --no-pager diff --check` 均通过。
- E3 不含动态 Tag、临时／成长注入、Prepared 来源选择、相对 Card 选择或效果修正；这些仍属后续独立方向。

## 剩余范围

Task 完成后仍留在后续方向的 E2–E5 能力已统一归并到 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]；本 Task 的静态 Tag 与候选池交付保持完成状态。
