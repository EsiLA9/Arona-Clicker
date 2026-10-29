# Receipt 0320-U08

| 项 | 内容 |
| --- | --- |
| 状态 | completed |
| 实际修改 | U08 冻结 E2R 独立 Effect RNG 与随机顺序、受限嵌套 `forTargets`、资源余额 Value/Condition、单个显式额外单位目标、Run 生命周期 MapRun Facts；Fact 驱动 Edge、临时 Item 和跨 Map Pool 路由至 P5/E5。随机算法补充为完整 `counter-addressed-murmur3-fmix32-v1` 公式，含 seed 派生、counter 地址、游标耗尽与 rejection sampling；新增确切 AST 拼写、AG-1 准入、Fact D03 饱和写入和 scheduler v3 规则。源码复核进一步明确：五账户闭集适用于余额读取；`resourceChange` 暂沿用三账户并把额外/循环 Actor 写入留给后续 Runtime Planner Unit；资源声明范围与 Owner 物化规则一致；MapRun Fact Condition 仅可处于 Action Effect Program `when`（不扩到 Encounter completion）。更新 Task 0320 与 00-index P2/P5 路由。 |
| 未完成内容 | 无。本 Unit 不包含源码实现。 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 未改图、未刷新或写 freshness；直接范围在 Task 0320 工作节点收尾统一核对 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 文档链接/结构 | `npm run check:docs` | 通过，errors: 0 | scanned markdown: 1222 |
| 差异检查 | `git --no-pager diff --check` | 通过，退出码0 | 仅提示共享工作树已有文件的 CRLF→LF 转换，无 whitespace error |

## 遇到问题

- 源码审查识别了 Owner 资源物化与 Context 声明来源不一致、MapRun Fact completion 条件未冻结，以及新资源写账户依赖额外/循环身份 Runtime 接线。按 P2 来源级时序补充合同并把写账户扩展明确交后续 Runtime Unit；未改变最终玩法目标或生产代码事实。

## 需上游确认项

- 无。随机执行序、来源开始余额时点、五账户读取集合与单个额外目标按 Draft/Task 冻结；新 Actor 写账户需由后续 Runtime Planner Unit 接线。MapRun Facts completion 读取排除在 P2 外。

## 事实更新建议

- E2 合同现由 Task 0320-U08 约束；资源读取账户、Owner 物化来源、写账户接线顺序和 Fact Condition 上下文已根据源码边界补明。Draft 0312 的开放提案文字作为设计来源，最终交付时回写实现路由与结果。
