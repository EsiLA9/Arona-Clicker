# Receipt 0298-U19

- 状态：正式内容入口与卡牌目标桌面闭环验收完成。
- 变更：实际 Runtime 加载的 gameplayBMapDatapack 新增独立“卡牌协同演练”入口，白子筹划减免友方卡费用，芹香三种有实际 sCost 的射击；保留工作树原有双敌演练等其他修改。同步当前视觉与局部刷新机制边界。
- 自动化：`npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/data/spot-map-entry-label.test.ts tests/engine/gameplay-b-basic-map-p0-p3.test.ts --silent`，3 文件 41 项通过（Workspace 21、入口 6、基础 14）；`npx tsc --noEmit` 通过。
- 浏览器：普通 UI 从新世界线获取联络点 / 地图终端，进入协同演练并移动至遭遇。点选未执行精确射击，换用该牌后同一领域目标保持正确副本高亮；再点选牵制射击，以 CDP 真实 pointer 输入从筹划牌拖至精确射击牌，合法 drop 高亮，释放后切回精确射击。此时第 1 轮且费用未扣。独立点击提交后第 2 轮，芹香 sCost 6→5，靶 HP 6→4，回执显示 sCost -1。异常事件游标核对无异常、无剩余分页。临时桌面视口 1440×900，验收后恢复默认。
- 截图：`C:/Users/15229/.codex/visualizations/2026/10/19/task-0298/card-target-drag.png`、`card-scost-commit.png`。
- 复核：内容与 Workspace 测试均无直接地图 Evidence / maps_to；不刷新、不写 freshness。
- 边界：不宣称 Flow 独立玩法卡 / 全部相对规则或 P5 / P6 已完成；回执进一步显示卡牌费用明细在下一片。

- 阶段合并验证：8 文件 116 项通过，类型 / 架构通过，文档扫描 930 篇 0 errors，差异空白检查通过；完整文件列表与范围见主 Task。
