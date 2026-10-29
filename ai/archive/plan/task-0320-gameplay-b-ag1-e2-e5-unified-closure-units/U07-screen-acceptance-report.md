# 0320-U07：AG-1 执行序列屏幕验收需求单

状态：按用户指示跳过宽屏桌面浏览器验收。自动化定向测试已通过；本单只列人工可确认的可见结果，不代表屏幕验收已完成或通过。

## 验收范围

确认 Map Workspace 的 AG-1 Preview 与 Recent Commit Feed 都直接反映 Owner `executionSequence` 的实际顺序和结果；E1-COMPAT-1 继续显示旧分组摘要。范围限于现有宽屏桌面鼠标 UI，不要求窄屏或移动端验收。

## 操作与检查

1. 打开一个含 Party 行动、手牌外 PlayerCommand、Ability、Item 与 Enemy 行动的 AG-1 Encounter。确认 Preview 每行按编号展示来源、Action、目标和费用／资源／HP 结果；行顺序与 Owner 执行序列一致，不按 Party／Ability／Item／Enemy 旧分组重排。
2. 确认 PlayerCommand 能读作指令来源，Party 与 Enemy Actor 资源结果标识正确；费用不足或终局后跳过的来源显示对应原因，不显示未发生的效果或消费。
3. 使用一个 CardRef 目标场景。当前视图能解析时显示卡牌 Action 名称；无法解析历史卡牌时显示“卡牌目标”，不露出不透明实例 ID，也不误认其他轮次或地点的同 ID 卡牌。
4. 提交后确认 Feed 中的执行编号、来源、目标、skip 与结果和提交前 Preview 对应；滚动阅读上文时不因新回执刷新而跳动，处于 Feed 底部时按既有行为跟随新回执。
5. 检查无来源的 AG-1 序列显示“本轮没有已选执行来源”；缺失执行序列不得回退显示旧分组顺序。
6. 打开一个 E1-COMPAT-1 Map，对比 Preview 与 Recent Commit，确认仍使用现有 Effect 摘要和分组式 Feed，没有 AG-1 执行序列标题或顺序行。

## 通过条件与证据

- AG-1 Preview 与 Commit Feed 的编号和相对顺序完全一致，内容来自同一份 Owner 序列。
- 来源、目标、skip、实际支付／消费和 HP／资源变化可读且准确；未显示不透明 CardRef ID。
- Feed、Workspace Frame、列和滚动容器保持既有连续性；E1 显示不变。
- 建议留存 Preview 与提交后 Feed 截图；如发现差异，记录 Map、来源组合、步骤和预期／实际文本。

## 当前结果

- 自动化：通过。U06/U07 联合定向测试 100/100，TypeScript、架构、文档与差异检查通过。
- 浏览器屏幕验收：未执行，按用户指示跳过；本单作为需求报告留档，不阻塞阶段完成，也不记为验收通过。
