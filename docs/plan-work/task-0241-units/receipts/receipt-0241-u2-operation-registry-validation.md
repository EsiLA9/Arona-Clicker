# Receipt 0241-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（Task Owner 2026-10-06 批准最小 `ENTITY_TYPES` 词汇扩展） |
| 实际修改 | `src/engine/core/entity-id.ts` 新增两种 Operation content typeName；`src/data-services/registry/registry.ts` 接入两张新表；`src/data-services/registry/registry-validate.ts` 检查表项身份；`src/data-services/registry/operation-content-validation.ts` 校验 selector、bias、weight、引用及 Event facts；`tests/engine/registry.test.ts` 补正反向 Registry 行为断言 |
| 未完成内容 | E1 后续 Runtime 仍须消费已注册内容；本 Unit Registry 范围完成 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 源码路径与新类型关系会在 E1 收尾统一 review/update Evidence；当前尚未声称图更新完成 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Registry 测试 | `npx vitest run tests/engine/registry.test.ts` | 通过 | 44 tests |
| 类型检查 | `npx tsc --noEmit` | 通过 | |
| 空白检查 | `git diff --check` | 通过 | 工作树有 CRLF 提示，无 whitespace error |
| GALHCG | 延后 E1 收尾 | 未执行 | 本 Unit 未留下源码变化 |

## 遇到问题

- 实施工前发现需要扩充通用实体 typeName 词汇；Task Owner 核验后批准仅新增两个字符串，不改 parser/validator 算法。其批准已同步到 Task 设计边界和 Unit 白名单。

## 需上游确认项

- 无。

## 事实更新建议

- 新顶层 Operation definitions 采用稳定三段式 ID，新增 typeName 与对应 Datapack Registry 表同名对齐。
