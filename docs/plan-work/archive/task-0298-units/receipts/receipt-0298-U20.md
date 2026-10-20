# Receipt 0298-U20

- 状态：实际 sCost 原费 / 减免 / 实扣展示完成。
- 变更：Runtime recentCommit 冻结投射 Owner 的 scostCost；Flow 的活动 / 持久两条回执适配共用费用文案，不重新计算。未新增 DOM、状态 Owner 或命令；无字段时沿用原行，PlayerCost 独立。
- 验证：`npx vitest run tests/ui/map-flow-adapter.test.ts tests/engine/gameplay-b-map-cards.test.ts --silent`，35 项通过；`npx tsc --noEmit`、`npm run check:architecture` 通过。覆盖完全 / 部分减免、纯投影冻结和持久入口一致。
- 浏览器：正常 Map Entry 进入协同演练，选择当前准备牌并显式提交后显示“sCost 原费 2 / 减免 1 / 实扣 1”，余额 6→5；截图 `C:/Users/15229/.codex/visualizations/2026/10/19/task-0298/card-scost-cost-detail.png`。临时视口已恢复。
- 扩大回归发现 vertical-slice 的旧布局 / 旧清除按钮 / 随机 Hand 断言失效，拆 U21 处理，不改费用结算以迎合测试。此前 5 文件 47 项通过、2 项失败，不声明该次全通过。
- 地图：Flow model / adapter 测试无直接 Evidence / maps_to。Runtime 已按 U17 复核；未写地图。
- 边界：卡牌历史命名、Flow 当前玩法卡与相对规则尚待后续。

- 阶段合并验证：8 文件 116 项通过，类型 / 架构通过，文档扫描 930 篇 0 errors，差异空白检查通过；完整文件列表与范围见主 Task。
