# Task：玩法 B 十二节点游乐园巡查 Demo

状态：complete — Task 0190 U1–U4 与 0191-U1–U7 均已完成最终核验与交接；十二节点游乐园巡查 Demo 可通过固定 seed 完整复现。

## 总目标

交付从西门到东出口的一整局可玩原型：固定十二节点路线、六名角色、两处营地、三场遭遇、确定性敌方意图、按序事件文本和可重放的通关/失败/平局验收。玩家只通过 Click 推进；路线、角色、战斗和日志由原型自身 Runtime 管理，不接入 AC。

## 开工门槛与规则状态

- Task 0190 的 U1–U4 与 0191-U1–U7 已完成最终复核、更新 Receipt 并交接。准备、结算、敌人配置、意图周期、十二节点活动/入队内容、文本引用、纯路线校验、正式入口、只读 View、入口冒烟、胜败平回归和完整路线浏览器走局均已验收。
- 每个后续 Unit 开工前按其 Read Set 核对 0187–0190 最终 Receipt 和实际文件；计划路径不构成接口事实。Route/Battle Runtime、准备/结算、内容、入口和只读 View 的真实签名以源码与最终 Receipt 为准。
- R07 的同 Click 净值 HP 结算与活动后全队 HP=0 立即结束为用户确认边界；三种基础配方输出为用户确认内容。
- R06、R10 与未决 R09 子规则沿用 0186 授权的原型暂定默认，不得写成用户逐项裁定。节点 6 开场 +1、节点 10 第二轮起回复 +1 等 camp 数值仍为原型候选；用户可在 2026-10-04 验收时修订。
- R08 为导演内容候选/原型暂定（按授权可实施、2026-10-04 可修订）：烟花手奇数轮攻击、偶数轮 reload；临时领头受伤后下轮优先冲锋；Boss 每三轮攻击存活前排全体及一名最低 HP 存活后排。意图循环的确定性是实现属性，不代表 R08 内容已由用户裁定；敌人目标和意图不额外消耗 RNG。
- C1 要求超过 3 个 Unit 时，规格和 Receipt 外置到本 Task 对应目录；本计划为 7 个 Unit。各 Unit 最多 3 个实现/测试文件，加 Unit spec 与 Receipt，总数不超过 5；通常净改动目标约 300–450 行，硬上限 500 行。U1 准备契约、U2 结算/Runtime 接线、U3 静态敌人内容、U5 纯路线 validator、U6 复用 Runtime/UI 骨架的入口与只读 View 接线、U7 复用已交付机制的整局验收与实测说明均是窄切片，为避免人为扩大或跨 Unit 重复实现，分别按 120–220、160–260、120–240、160–280、160–280、200–280 行目标预算施工；仍遵守 5 文件/500 行上限。根 Task 仅维护总目标、门槛、状态、总验收和 Unit 链接。

## Unit 链接与状态

| Unit | 范围 | Spec | Receipt | 状态 |
| --- | --- | --- | --- | --- |
| 0191-U1 | Battle prepare target/effect/no-op contract | [0191-U1](task-0191-gameplay-b-complete-park-demo-units/0191-u1.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u1-receipt.md) | complete；准备契约与 15 项定向测试已交接 |
| 0191-U2 | resolve 与上一轮实际受伤记忆 | [0191-U2](task-0191-gameplay-b-complete-park-demo-units/0191-u2.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u2-receipt.md) | complete；实际 HP Delta 与下一轮记忆交接 |
| 0191-U3 | 敌人模板与意图配置 | [0191-U3](task-0191-gameplay-b-complete-park-demo-units/0191-u3.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u3-receipt.md) | complete；三场敌人内容与意图周期已交接 |
| 0191-U4 | 十二节点路线、文本与内容引用 | [0191-U4](task-0191-gameplay-b-complete-park-demo-units/0191-u4.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u4-receipt.md) | complete；十二节点、活动、入队与文本触发已交接 |
| 0191-U5 | 内容引用及固定路线校验 | [0191-U5](task-0191-gameplay-b-complete-park-demo-units/0191-u5.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u5-receipt.md) | complete；纯校验和边界诊断已交接 |
| 0191-U6 | 正式入口、只读 View 与入口冒烟回归 | [0191-U6](task-0191-gameplay-b-complete-park-demo-units/0191-u6.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u6-receipt.md) | complete；校验路线、Click 边界与首战 View 冒烟已交接 |
| 0191-U7 | 整局可重放测试、README 实测记录与最终核验 | [0191-U7](task-0191-gameplay-b-complete-park-demo-units/0191-u7.md) | [Receipt](task-0191-gameplay-b-complete-park-demo-units/receipts/0191-u7-receipt.md) | complete；固定 seed、26 次 Click、胜败平夹具及浏览器完整通关已交接 |

## Task 总验收

- 十二节点按 0182 固定顺序存在；三场战斗在节点 5、9、11；九个非战斗节点活动度合计 11；节点 6/10 活动前分别加入千世/玲奈。
- 按 R08 导演内容候选/原型暂定（按授权可实施、2026-10-04 可修订）实施：敌方预告与结算一致；Boss 混合目标只含存活前排全体及一名最低 HP 存活后排，每个目标固定受伤 1；烟花手偶数轮 reload/no-op 无目标、无伤害；领头受实际 HP 伤害后只在下一轮一次性优先冲锋且基础序列不重置。确定性只描述循环实现，不表示内容来源已裁定。
- 活动、战斗和自动转场遵守 0190 最终交接；新节点只进入/准备，不在旧节点的 Click 内再结算行为；Route View 只读，终态重复输入不再改变状态或日志。
- 至少记录一个从节点 1 通关到 12 的可重放 seed，以及失败和平局夹具；整局 Click 数按 11 次非战斗活动 Click 加三场战斗实际结算轮数核对，无额外移动、入队或终局 Click。
- 类型、独立构建、定向测试和浏览器验收均在原型包完成并记录实际命令/环境；无 AC import、存档、迁移、分支或其他未授权系统。
- 全部临时规则及 camp 数值候选继续标为原型暂定；用户确认项不被降为候选，临时规则不被升级为用户确认。

