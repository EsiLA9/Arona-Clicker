# Receipt 0298-U18

- 状态：卡牌高亮、点选 / 拖拽草稿及实际 sCost 展示完成。
- 变更：当前牌、真实 Hand 展示、目标代理共享完整对象身份；未选 Command 不造实例。目标入口可选隐藏 / 叠放牌。进入编辑先关闭浮层，避免合法 opener 被误认为选中；新物理操作清理拖拽尾随点击抑制。余额与效果说明消费只读 DTO。
- 验证：`npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/map-relation-interaction.test.ts --silent`，34 项通过；`npx tsc --noEmit` 通过。真实 Controller 覆盖点选未执行 Hand 牌、拖到准备牌、无 Commit / 全页刷新、Frame / Flow 节点保留、独立提交原费 2 / 减免 1 / 实扣 1。浮层关闭误确认回归先复现再修复。
- 浏览器：U19 在正常入口完成点选、换牌及真实指针拖拽，释放确认的仍是第 1 轮草稿，显式提交才扣费 / 进入第 2 轮；无 SVG。截图见 U19 Receipt。
- 复核：直接 renderer / CSS / Workspace 测试为 unreferenced_path；Runtime / Controller 影响已在 U16—U17 分页检查。无地图写入。
- 边界：Flow 独立玩法牌、保留的相对规则与 P5 全范围 / P6 未完成。

- 阶段合并验证：8 文件 116 项通过，类型 / 架构通过，文档扫描 930 篇 0 errors，差异空白检查通过；完整文件列表与范围见主 Task。
