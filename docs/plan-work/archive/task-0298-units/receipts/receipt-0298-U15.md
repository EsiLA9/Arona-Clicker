# Receipt 0298-U15

- 状态：scost 卡牌效果的 Owner 结算与回执完成；尚未接入卡牌 UI，不代表 P0b / P5 整体通过。
- 实际修改：新增纯卡牌效果计划器，结合本轮选定领域卡及实际执行行为汇总减免；Commit 的净费用校验 / 扣费 / 回执原子完成。sCost 仅影响 Actor 行动费用，不增加余额，不减少固定 PlayerCost。
- 规则：BigInt 汇总超大叠加并封顶原费，净费最低零；未执行 Hand 牌的减免不转给执行牌。回执 targetCard 区分选定卡牌，scostCost 分别记录 original / discount / paid，resourceChanges 记录实扣；下一轮不存减免状态。
- 保存：深冻结新回执字段，restore 用定义 / 场景 / 来源目标重算可应用减免与净费用，拒绝伪造数值 / 场景引用；保存恢复后 Commit retry 保持幂等。无迁移层。
- 实际验证：交接前再次运行卡牌 16 项、MapRun 31 项、来源事务 7 项、关系 7 项，共 4 文件 61 项，全部通过。覆盖真实扣费、未执行目标、超大叠加、固定费用、下一轮无继承、失败零写入、保存重试、伪造回执、来源换牌 / 恢复不继承目标。`npx tsc --noEmit` 已在最后一项新增回归后再次通过；`npm run check:architecture` 通过；交接文档检查 918 篇、0 errors，差异检查通过。
- GALHCG：直接 MapRun contract / Owner / catalog / preview / 新效果 / 卡牌测试均无直接 Evidence / maps_to；runtime-commands 2 / 2 owner 完整且 content_changed，Runtime 门面相关路径沿 U11 / U14 分页核对；无写图 / freshness。
- 余项：关系投影与共享高亮仍只接单位；卡面身份、卡牌目标按钮 / 点击 / 拖拽及实际 sCost 数值显示尚未施工。Flow 独立玩法牌、保留的相对单位规则、P5 完整验收与 P6 作用线尚未完成。见同目录交接文档。
