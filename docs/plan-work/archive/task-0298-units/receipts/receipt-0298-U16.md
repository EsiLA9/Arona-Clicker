# Receipt 0298-U16

- 状态：共享目标身份扩展完成，随后由 U17 / U18 接真实数据与 DOM。
- 变更：MapTargetRef 区分 MapUnitRef / MapRunCardRef；performer 保持单位；presentation / interaction 统一 object key，Controller 卡牌确认走正式草稿命令，actorless 不把卡牌硬转成单位。
- 验证：同 ID 单位 / 卡牌不串选、多视觉副本同步且删除其中一个不销毁目标；17 项呈现 / 交互测试通过，既有关系 7 项通过，类型检查通过。新测试曾使用当前 Vitest 不支持的 matcher，已改用现有匹配器，未改变断言范围。
- 复核：Controller 3 / 3 owner 完整，其余新路径无直接 Evidence / maps_to；只读，无地图写入。阶段文档检查 0 errors。
- 边界：无新布局、作用线或领域规则；不是 P5 全范围验收。
