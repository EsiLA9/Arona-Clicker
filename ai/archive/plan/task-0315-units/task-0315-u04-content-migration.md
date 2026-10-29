# Task 0315 Unit U04：第一方 Action 内容迁移

状态：completed — 第一方内容与测试断言已改写；定向 Registry / Owner 测试与 U04 白名单空白检查通过。

## Goal

将第一方 Gameplay B Map Action 与 E1 作者示例从旧数组改写为新 effectProgram；不移除旧解析或 Registry 支持。

## Allowed Files

- `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`
- `src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tests/data/gameplay-b-effect-example.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 8 张内置 Map 的所有 Action 旧 HP / 资源 / cardEffects 均有逐条新 Program；Shop Offer `effects` 保持原样。
- 按本任务迁移矩阵将负 HP 转 damage、正 HP 转 heal、资源写入转 `resourceChange`、sCost 折扣转 prepare；旧相位差异明确记录。
- 每张内容被改写的 Map 将 `resumeVersion` 从 3 提升到 4；不改其他 Map 版本。
- 测试能通过真实 Registry 装载已迁移数据，Example 明确示范新语义。

## Stop Conditions

- 若任何活动内容不能用单个 primary + 常量表达，或映射需要变更玩法优先级，停止并报告证据；不得在内容文件内增加临时新原语。

## Validation

- `npx vitest run tests/data/gameplay-b-map-registry.test.ts tests/data/gameplay-b-effect-example.test.ts`
- `git --no-pager diff --check`
