# 07-audit/condition-presentation — 条件判断渲染建议核验

本文回答：来自 Sol 的“Condition Presentation Tree”建议，哪些判断符合当前源码，哪些方案可直接落地，哪些需要先扩展条件机制。

## 逐条结论

| 编号 | 建议 | 真实性 | 可行性 | 当前结论 |
| --- | --- | --- | --- | --- |
| 1 | UI 把条件树压成字符串 | 已证实 | 高 | 当前 `describeCondition()` 递归拼接 `且/或`；复杂条件可读性明显下降 |
| 2 | 该字符串被多个 UI 直接放进 span | 已证实 | 高 | Enhancement、Reveal、Spot、Area、Story、Contacts 等落点均存在；但 Affector 文本保留纯文本是合理的 |
| 3 | 引入 `ConditionPresentationTree` 中间层 | 已证实需求 | 高 | 推荐；分离语义描述、状态和 HTML/纯文本渲染 |
| 4 | 增加 AND/OR/COUNT 三类组展示 | 部分成立 | 中 | AND/OR 可直接支持；COUNT 当前不存在于 `ConditionGroup` 类型和求值器，必须另立机制任务 |
| 5 | 使用 DOM/CSS 缩进和左边界，不生成空格或 `<pre>` | 方案可行 | 高 | 与现有 HTML 字符串渲染和 tooltip CSS 兼容，需补 escape/accessibility 约束 |
| 6 | 叶节点和组节点展示 met 状态 | 部分成立 | 高 | 求值能力已有；需处理揭示阶梯，未揭示条件不能泄露文本 |
| 7 | normalize：同类 AND/OR 直接子组扁平化 | 方案可行 | 高 | 可减少无意义缩进；COUNT/未知组不得套用 |
| 8 | 单条件保持 inline，单子组可 unwrap | 方案可行 | 高 | 只影响展示，不改变原始条件树和求值 |
| 9 | 将通用条件展示从 `tooltip-enhancement.ts` 抽出 | 已证实需要 | 高 | 当前命名和复用已越界，且 Contacts 存在重复实现；建议集中到 `src/ui/condition-presentation.ts` |
| 10 | UI comparator 改为 `≥/≤/=` 并格式化数字 | 已证实可改善 | 高 | 纯展示变换；需同步更新现有字符串测试，不能影响日志/引擎文本 |

## 边界与风险

- 当前 `ConditionGroup` 只有 `AND | OR`，新增 COUNT 不是渲染任务的隐含内容；需先确定数据结构、Schema 同步、ConditionSystem 求值、依赖失效和编辑器协议。
- Reveal 的 `conditionKnown`、`nameKnown` 和 `utilityKnown` 是信息揭示边界。presentation tree 可以携带 met，但 renderer 必须在未知阶段输出 `???` 或隐藏子树，不能因树形化而提前暴露 leaf 文本。
- `describeCondition()` 仍应保留为纯文本 fallback，供 Affector sentence、debug、日志和非 HTML 场景使用；不能把它改成 HTML。
- 现有渲染体系通过模板字符串写入 `innerHTML`，因此叶节点文字、组标题和 data 属性必须继续经过 `escapeHtml`；不能直接拼接玩家可控名称。

完整执行切片见 [[docs/0x-plan&work/active/task-0035-condition-presentation-tree]]。
