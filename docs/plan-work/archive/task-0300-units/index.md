# Task 0300 Patch Unit 索引

状态：P0—P3 与 P6 产品切片已实施；P4 / P5 仍为后续阶段。桌面浏览器验收按负责人 2026-10-19 指示跳过（agent-浏览器链路断裂）。

| Unit | 阶段 | 内容 | 状态 |
| --- | --- | --- | --- |
| [[u1-interaction-options]] | P0 | `MapRelationInteraction` 迁移 Options，保留唯一 session 与现有命令语义 | 完成 |
| [[u2-card-host-binding]] | P1a | 新增卡牌 binding helper；Map 真实卡 / 替换候选分离三类身份 | 完成 |
| [[u3-instance-entry-gating]] | P1b | 按视觉实例收窄入口；禁止普通 Flow marks 伪造绑定 | 完成 |
| [[u4-flow-card-payload]] | P2a | Flow 当前真实玩法卡载荷与 Map 适配投影 | 完成 |
| [[u5-flow-card-render]] | P2a | Flow 只读卡面渲染与共用小卡面 helper | 完成 |
| [[u6-cross-host-lifecycle]] | P2b | Map → Flow 目标命中、高亮同步、回收与实例协调 | 完成 |
| U7 | P3 | 定向回归、类型 / 架构检查、桌面验收豁免与文档收尾 | 完成 |
| U8 | P6a | 地点对象身份与只读选择候选投影 | 完成 |
| U9 | P6b | 地点卡片面渲染与选中状态样式 | 完成 |
| U10 | P6c | 唯一交互会话选择地点、Workspace Click 提交与 Controller 复核 | 完成 |

Receipts 位于 `receipts/`。U7 的验证结果记录在活动 Task 的“实施记录”。

## 共同边界

- Owner 仍唯一持有真实卡牌、合法候选、草稿、费用、版本与 Commit。
- 视觉副本与替换 offer 不创建领域对象；`Object Key` 不是凭证。
- 不新增第二目录、第二合法性算法、宿主级 Hover 状态机或长期持久字段。
- 不使用浏览器验收替代行为测试；本 Task 的浏览器验收按负责人口头豁免。
