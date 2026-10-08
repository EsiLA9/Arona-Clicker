# Receipt 0241-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/operation.ts` 增加 Profile Strategy snapshot、RunStart 内容与 Hand diagnostic DTO；`services/student-operation-profile-resolver.ts` 冻结 Strategy biases / personal pools 并校验 RunStart/resume；`services/operation-tactical-rng.ts` 增加与 tacticalCursor 分离的 actor/beat 派生手牌 word；新增 `services/operation-card-candidate-resolver.ts`；新增 `tests/engine/operation-card-candidate-resolver.test.ts` |
| 未完成内容 | Hand 尚未接入 PreparedBeat 和 EventRun 生命周期；由 U5/U7 完成 |
| 范围外变更 | 无；未改现有 Carousel 数据 |
| GALHCG 影响闭环 | E1 收尾时对源码/测试精确路径统一 review 和更新 Evidence/maps_to；现阶段不报已闭环 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Candidate/Runtime/Resume 定向测试 | `npx vitest run tests/engine/operation-card-candidate-resolver.test.ts tests/engine/gameplay-b-save-resume.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/engine/gameplay-b-operation-sample.test.ts` | 通过 | 5 files / 59 tests |
| 类型检查 | `npx tsc --noEmit` | 通过 | |
| 空白检查 | `git diff --check` | 通过 | 工作树报告 CRLF 提示，无空白错误 |
| GALHCG | 延后 E1 收尾 | 未执行 | 尚有 Runtime/Commit/View 路径将继续变化 |

## 遇到问题

- Hand 的纯 weighted draw 需复用现有 splitmix64 算法但不能推进 tactical skill 的 committed cursor；新增 actor/beat 派生的 `charhand` stream，由 seed、actor ID、beatIndex 和临时 wordCursor 纯计算。
- 多个命中 Strategy bias 使用每个 Action 的去重 tag 集合后加总 BPS 调整；测试覆盖重复 Action tag 只计一次，并覆盖相同条件下保护/进攻倾向的确定性 Hand 分布。

## 需上游确认项

- 无；当前实现保持在 U4 白名单内。

## 事实更新建议

- 标准 RunStart 现在会携带 Pool/Strategy 冻结定义，学生 Profile snapshot 冻结对应 bias 与个人 Pool refs；下一阶段需由 EventRun owner 保存抽出的 Hand 与诊断结果。
