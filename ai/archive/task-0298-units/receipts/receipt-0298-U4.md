# Receipt 0298-U4

- 状态：代码与自动化验收完成；P1 浏览器角色验收待 U5 接入实际 Hover / Focus 后补齐，不宣告 P1 全部完成。
- 修改：新增 `map-relation-presentation.ts` 与 DOM 测试；Map renderer 增加来源 / 对象身份与可聚焦单位；CSS 增加发起外缘 / 抬升、目标包围 / 角标、弱虚线候选与双角色标记。敌方明确“目标尚未确定 · 结算时决定”。
- 范围外变更：无；不增加领域对象、命令或连接线。
- 测试：新 DOM 3 项 + Workspace 18 项，共 21 项通过；类型检查通过；文档检查 894 篇、0 errors。差异检查首次发现脚本写文件多出 EOF 空行，已修正并重查通过。
- 地图：4 个直接源码 / 测试路径均 `unreferenced_path`，没有可核验的直接 Evidence / maps_to；未写图、刷新或 freshness。
- 审查：角色适配只改已挂载节点属性；selected target 与 effectRecipients 不混用；无目标 / 未知不产生受用框。多个视觉副本不产生新的领域卡。
- 尚需：U5 提供真实交互消费者后完成桌面视觉验收；F1 / F2 产品裁定问题已异步提交，独立单位工作继续。
