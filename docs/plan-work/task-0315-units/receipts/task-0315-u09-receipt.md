# Task 0315 U09 Receipt：旧 Action 作者合同与准入移除

状态：completed。

## 修改

- 删除 `GameplayMapActionDef` 的 `effects` / `hpEffects` / `cardEffects` 字段及 Action 专属旧 effect 类型；从 `src/data-services/index.ts` 移除旧 HP/resource 类型导出。Shop Offer 自身的 `effects` 合同和 Registry 校验保留。
- 重建 `gameplay-map-effect-program.ts` 为 Program-only normalizer：旧 Action 字段不在白名单内；无 effectProgram 的无效果 Action 归一化为空 Program；Normalized Action effects 只保留 Program budget 和 AST，legacy mode/phase 类型与转换逻辑删除。
- Registry / effect context 移除旧数组验证与 actorless legacy admission；卡牌 target 仅接受 `effectProgram.prepare`。MapRun、CardRef prepare 和 Runtime source-option 检查已同步去掉 legacy mode 分支。
- `gameplay-b-map-registry.test.ts` 的有效旧数组基线迁移为 damage / heal / resourceChange / prepare 原语；旧字段拒绝输入保留 raw unknown 形态。`gameplay-b-map-vertical-slice.test.ts` 的 PlayerCommand 改用 `sourceTeam` Program。
- `gameplay-b-map-run.test.ts` 的 BATTLE_ACTIONS 添加明确动作合同类型，动态 Program fixture 用 `as const` 保持字面量类型；无行为断言变更。
- 语法、生成 Schema 与 U10 原始输入精确拒绝测试未改。

## 验证

- `npx vitest run tests/data/gameplay-b-effect-normalization.test.ts --silent`：**1 file / 5 tests passed**。
- `npx tsc --noEmit`：通过。
- `git diff --check`：通过；共享工作树其他 CRLF 文件有 Git 行尾提示，但无 whitespace error。
