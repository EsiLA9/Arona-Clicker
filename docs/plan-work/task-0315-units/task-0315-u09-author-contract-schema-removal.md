# Task 0315 Unit U09：旧 Action 作者合同与准入移除

状态：completed — U04、U06、U06b、U07、U07c、U08 内容与消费者迁移已完成。

## Goal

从 `GameplayMapActionDef`、输入归一化、上下文校验与 Registry 中彻底移除旧数组字段及 legacy mode 准入；Shop Offer `effects` 仍保留。

## Allowed Files

- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/index.ts`（移除旧 Action 专属类型的 barrel export）
- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/registry/registry-validate.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/services/map/map-card-effects.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`
- `tests/data/gameplay-b-map-registry.test.ts`（迁移有效测试基线以保持全局类型检查）
- `tests/engine/gameplay-b-map-run.test.ts`（收紧 Program fixture 字面量类型以通过全局类型检查）
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`（迁移仍使用旧 Action 字段的集成夹具）
- 本 Unit 与对应 Receipt

## Completion Criteria

- TypeScript 作者类型、normalizer 和 Registry 成功路径不再接受旧 Action arrays；旧原始 JSON 拒绝覆盖由 U10 验证。
- `effectProgram` 的新语法、Shop Offer `effects` 与其它独立合同照常可用。
- Schema 源输入已更新；生成 Schema 与原始输入拒绝测试由 U10 验证。

## Stop Conditions

- 若编辑器 Schema 实际存在无关共享字段或生成器会改动范围外大量条目，停下提交预览和差异影响，不手改生成产物。

## Validation

- `npx vitest run tests/data/gameplay-b-effect-normalization.test.ts`
- `npx tsc --noEmit`
- `git diff --check`

## Completion

- `GameplayMapActionDef` 不再声明旧 `effects` / `hpEffects` / `cardEffects`，旧专属 Action effect 类型及 barrel exports 已删除；Shop Offer `effects` 保留。
- normalizer 只读取 effectProgram；缺省 effectProgram 按空 Program 处理，旧 Action 字段作为未知输入拒绝。Normalized effect 仅保留 Program origin，不再有 legacy phase 或模式分支。
- Context / Registry 只校验 effectProgram、prepare、cost 等当前合同；MapRun、CardRef prepare 与 runtime source projection 不再检查 legacy mode。
- Registry 的有效 HP、资源、CardRef prepare、Enemy、Ability / Item fixtures 和 UI vertical-slice command 已迁到新原语。旧 Action 字段负例仍作为 raw unknown input，精确拒绝覆盖交 U10。
- 未改 effectProgram 语法、生成 Schema 或 U10 测试。
