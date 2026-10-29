# Receipt 0278-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | src/arona-clicker/services/operation-resolution-planner.ts；src/arona-clicker/services/operation-runtime-service.ts；src/arona-clicker/contracts/operation-scene-action.ts；tests/engine/operation-scene-actions.test.ts |
| 未完成内容 | OperationView remaining 字段与 Workspace 显示由 U3 处理 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | U7 已对 Runtime / Resolution 变更路径 review_changes 并维护直接语义映射 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run --silent --reporter=dot tests/engine/operation-runtime-service.test.ts tests/engine/operation-scene-actions.test.ts` | 通过 | 2 个文件，60 项通过；包含缺省上限 Combat 连续逐次 Commit、末名启用 opponent 击倒后 Location / Event 完成 |
| 类型检查 | 未执行 | 延后 | U3–U5 完成后统一运行 |
| 浏览器验收 | 未执行 | 不需要 | 本 Unit 是 Runtime / Engine 合同变更 |
| GALHCG | 已完成 | U7 | Run Runtime / Operation Planning 相关路径审查并更新 Evidence |

## 遇到问题

- U1 已把无上限 Combat 的敌方清场认定为结构性出口，但第一次对照 Runtime 源码时发现提交后仅评估作者 Location 谓词和 maxBeats，没有清场成功分支；因此补入 Runtime 通用判定和多 Beat 行为测试。无 Carousel / Event ID 特例。
- 最终聚合验证发现 Beat / Scene Commit 返回的 Resolution 不是冻结快照；现改为冻结后返回和存入 Run。当前手牌经过资格筛选后没有可行动作时，Wait 是可直接提交的无进展计划，不触发自动胜利。

## 需上游确认项

- 无。

## 事实更新建议

- 缺省 SceneAction 上限时，Run 仍逐批持久计数；只要计数保持安全整数，批次可持续提交。显式上限的 planner 检查和存档上限校验保持不变。Resolution history 保留最近 32 条并可恢复后继续递增。没有 Location result predicate 的无上限 Combat 在末名当前启用 opponent 倒下后以普通 Location success 完成；作者显式结果谓词仍优先。
