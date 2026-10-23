# Receipt 0320-U11

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | `src/data-services/contracts/gameplay-map.ts` 为 Action 增加可选 `additionalTarget?: 'partyCharacter' | 'enemy'`。`registry-validate.ts` 在 closed-field allowlist 接纳该字段，并拒绝非 AG-1、未知值/类型及 `none`/`card` 主目标。`gameplay-map-effect-context.ts` 即使 Action 没有 `effectProgram` 也校验字段；按每个真实 Encounter/Activity 来源拒绝 Enemy 直接、Pool-only 与 Party/Enemy 混合引用，允许 Party 与 Actorless Ability/Item。两份定向 Registry 测试覆盖字段与来源边界。 |
| 未完成内容 | Schema 尚未生成同步；额外目标 Draft、领域 ID 选择、Preview/Commit/Save/Receipt/Restore 与额外账户运行时均未实现。 |
| 范围外变更 | 无；仅触及 5 个 U11 实现白名单文件，没有 Schema、runtime、UI 或文档以外的修改。 |
| GALHCG 影响闭环 | 只读核对直接影响；未改图、未刷新或写 freshness。Task 0320 收尾统一核对直接影响范围。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Registry | `npx vitest run --silent tests/data/gameplay-b-map-registry.test.ts tests/data/gameplay-b-effect-registry.test.ts` | 通过，196/196 | 包含字段、无 Program、直接/Pool/混合/Ability 来源 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码 0 | U11 完成时全工作树 |
| 文档链接/结构 | `npm run check:docs` | 通过，扫描1235篇，errors: 0 | U11 Unit/Receipt/Task/index 同步后运行 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码 0 | 仅共享工作树既有 CRLF 提示 |

## 遇到问题

- 无；此前 Context 在无 `effectProgram` 时会提前跳过，已把额外目标字段校验提前到该分支之前。

## 需上游确认项

- 无；U08 已冻结字段形状与来源边界。

## 事实更新建议

- `additionalTarget` 仅有静态作者合同。下一步需用 `npm run gen:schema` 单独同步作者 Schema；运行态身份与额外账户需等 Draft/Preview/Commit/Save/Restore 接线。
