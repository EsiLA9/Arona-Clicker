# Receipt 0298-U17

- 状态：卡牌关系与 Workspace 目录投影完成。
- 变更：直接投射 Owner 的 targetCard / legalTargetCards；cardCost 效果是提交前声明，与实际 scostCost 回执分离；Workspace cards 与 Owner 目录一致。关系 key 加入 mapId，避免跨 Map 同名对象串状态。
- 验证：卡牌 17、关系 7、交互 13、呈现 4，共 41 项通过；类型检查通过。Runtime 测试覆盖待选 / 已选关系与 Commit 后实际减免的对比、重复查询零写入、冻结引用。
- 复核：Runtime contract 2 / 2、Runtime 实例分页 7 / 7 owner 完整且 content_changed，其余无直接 Evidence / maps_to。无写图 / freshness；文档检查 0 errors。
- 边界：UI 与正常内容入口在 U18 / U19 后续验收；Flow 独立玩法牌和 P5 / P6 仍未完成。
