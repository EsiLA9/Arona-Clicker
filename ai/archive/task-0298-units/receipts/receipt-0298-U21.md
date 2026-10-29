# Receipt 0298-U21

- 状态：正常入口陈旧断言与随机依赖已修正。
- 变更：仅改 vertical-slice 测试；地图改从显式 Flow overview 核验当前地点，恢复自然行为使用实际候选；替换数量扣除单独展示的当前牌，Focus key 使用现行语义。没有 Ability / Item 的 fixture 明确断言不存在 options，保留真实 Frame / 列 / Flow / 滚动 identity 证明。
- 随机性：测试固定 Math.random 初始化种子并在 afterEach 恢复；领域 RNG 已有独立测试。单主操作区优先提交，手动完成在草稿未就绪时出现，因此显式换为待选的协助队友牌后完成；不依赖随机自然牌恰好待选，不修改产品或内容规则。
- 验证：`npx vitest run tests/ui/gameplay-b-map-vertical-slice.test.ts --silent`，3 项通过；原有双敌演练完整保留。阶段合并回归另记录于主 Task。
- 地图：测试与 Unit 无直接 Evidence / maps_to，不刷新 / 写图。
- 边界：只覆盖正常入口及既有单位交互，不代表 Flow 玩法牌或 P5 全验收。

- 阶段合并验证：8 文件 116 项通过，类型 / 架构通过，文档扫描 930 篇 0 errors，差异空白检查通过；完整文件列表与范围见主 Task。
