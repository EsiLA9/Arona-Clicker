# Receipt 0298-U11

- 状态：卡牌领域身份基础完成；P0b 整体未完成。
- 实际修改：新增本轮 Hand / 实际 PlayerCommand / 敌方公开行为牌的只读领域目录；MapRun Owner 解析完整场景引用，Runtime 公开 getCards / resolveCardReference。所有视觉副本读取同一引用，未选中的命令候选不创建牌；敌方只有只读行为身份，不推断攻击目标。
- 生命周期：Hand 牌在本轮 Swap 前后保持身份和逻辑顺序，准备态独立；实际命令换下后引用失效；跨 Run / Map / Node / activity / round 不串引用，缺少 activity 字段的畸形引用也被拒绝。身份由持久领域快照决定，DOM 回收无影响；本片不改存档格式。
- 验证：新增三项公共 Runtime 集成测试通过，覆盖纯查询 / 替换预览零写入、Hand / Command 切换、保存加载与换轮失效；与 MapRun、关系、Workspace 合计 4 文件 60 项通过。`npx tsc --noEmit`、`npm run check:architecture` 通过；文档 / 差异检查按本阶段收尾执行。
- GALHCG：六个源码 / 测试路径只读复核；Runtime contract 2 / 2、Runtime 实例两页 7 / 7 owner 完整且 content_changed，其余无直接 Evidence / maps_to；不写图或 freshness。
- 尚缺：scost 卡牌效果、目标草稿 / 结算、Flow 独立玩法牌、对应 UI、P5 与 P6。没有把卡牌目录当作卡牌效果已可玩。
