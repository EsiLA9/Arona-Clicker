# Receipt 0241-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/arona-clicker/contracts/operation-content-resolver.ts`、`operation-participant.ts` 增加 detached 新定义载荷；`services/registry-operation-content-resolver.ts` 按 Event/Location/Profiles 收集 referenced CardPool/Strategy/Action；`services/operation-participant-admission.ts` 解析、核引用、过滤未选内容并冻结输出；`tests/engine/operation-participant-admission.test.ts` 覆盖 Registry 与 custom resolver 两路 |
| 未完成内容 | RunStart builder/Runtime owner 尚未消费 Admission 的池与策略数据；这是 U4+范围 |
| 范围外变更 | 无。`OperationAdmission` 载荷属性在 TypeScript DTO 中 optional 以兼容既有低层测试 fixture，但标准 admission 实现总会返回两个数组 |
| GALHCG 影响闭环 | E1 结束后对各实现/测试路径统一 review、Evidence refresh 与 maps_to 复核；目前未声称地图闭环完成 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-participant-admission.test.ts` | 通过 | 14 tests |
| 类型检查 | `npx tsc --noEmit` | 通过 |  |
| 空白检查 | `git diff --check` | 通过 | 只有工作树 CRLF 提示 |
| GALHCG | 延后 E1 收尾 | 未执行 | 依协议最终路径一并审查 |

## 遇到问题

- Registry Resolver 返回 Pool 的枚举顺序来自 Event→Location→Profile 的收集次序；测试按稳定 ID 集合核对，避免把数组排列误定为作者语义。
- 既有手写 `OperationAdmission` fixture 未提供新字段，因此公开输入 DTO 允许旧 fixture 省略；标准 `OperationParticipantAdmission.admit()` 仍生成 detached arrays。

## 需上游确认项

- 无。

## 事实更新建议

- Registry Operation Resolver 现在只解析本局引用的 Pool/Strategy，Action definitions 则包含 Pool entries 所引用的 Action；Admission 对标准 resolver 输出再次建离线快照并冻结。
