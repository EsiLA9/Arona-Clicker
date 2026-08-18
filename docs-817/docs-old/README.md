# AronaClicker 设计文档

> 基于 Blue Archive 同人设定的放置经营 + 剧情探索游戏。
> TS + HTML 纯前端，数据包驱动内容，轻量引擎。
> 本文档在 AronaClicker 早期多次设计基础上重新整合收敛而成。

## 文档索引

| 文档 | 内容 |
|------|------|
| [[01-core-concept]] | 游戏核心概念、类型定位、竞品分析、克制原则 |
| [[02-gameplay-loop]] | 核心玩法循环、双轨产出体系、放置/主动阶段划分、剧情与奖励结构 |
| [[03-data-structures]] | 所有实体定义（字段级类型标注）、运行时状态、存档结构、关键约束 |
| [[04-systems-modules]] | 11 个核心模块定义、Deep Dive（接口签名/错误模型/边界情况）、模块间通信模式 |
| [[05-engine-requirements]] | 引擎能力清单、非目标、性能指标、扩展点、TS 模块结构建议 |
| [[06-player-flow]] | 首次进入/日常流程、阶段体验目标、Init 切换、无压力设计原则 |
| [[07-data-flow]] | 配置数据流、Tick 循环、操作数据流、剧情数据流、存档管线 |
| [[08-dev-roadmap]] | MVP 范围、4 阶段迭代计划、技术风险、在现有代码基础上的开发建议 |
| [[09-affector-system]] | Affector 效果体系统：统一的生效效果管理（条目/包装/实例/引擎 + 操作权/可见度/流程控制） |
| [[10-implementation-roadmap]] | 基于当前旧 `src` 原型的实现迁移路线、阶段目标、验收标准与下一步任务 |
| [[11-info-reveal-system]] | 信息可知系统：实体可见性与数值揭示度分层、`???` 遮挡机制与 Hover 详情联动 |
| [[12-chat-advance-system]] | 聊天推进系统：将"聊天回复点击"与剧情演出结合（发送按钮 / 点击次数推进 / 随机被动闲聊） |
| [[13-extra-data-system]] | Extra 额外数据体系：类 NBT 树形数据（数据包常量表 / Def 附加字段 / 运行时持久化 + Value/Condition/Effect DSL 联动） |

## 核心设计原则

- **克制引擎，丰富内容** — 引擎不做重量级技术功能（无热加载、无模组补丁系统），内容通过数据包驱动
- **放置为主，剧情为辅** — 核心循环全自动运行，剧情是增值层而非必要层
- **无压力体验** — 无体力、无每日次数、无强制进度、无惩罚机制
- **数据包驱动** — 所有游戏内容以 `Datapack` 容器组织的 TS 模块定义，`modId:type:id` 三段式索引

## 术语表

| 术语           | 定义                                                 | 出处                                          |
| ------------ | -------------------------------------------------- | ------------------------------------------- |
| Init         | 世界线/开局。独立的游玩单元，不同的 Init 有不同的剧情、Area、Spot 和资源体系     | [[03-data-structures#Init 定义]]              |
| Area         | 地理区域。玩家在 Area 间移动，每个 Area 持有 Spot 和 PassiveStory 池 | [[03-data-structures#Area 定义]]              |
| Spot         | 生产设施。放置经营的核心，购买后持续产出资源，可升级                         | [[03-data-structures#Spot 定义]]              |
| Enhancement  | 跨设施的加成效果。提供倍率/加算型修饰                                | [[03-data-structures#Enhancement 定义]]       |
| Character    | 可解锁角色。持有后提供全局效果加成                                  | [[03-data-structures#角色定义]]                 |
| ActiveStory  | 主线剧情，满足条件后手动进入                                     | [[03-data-structures#ActiveStoryEntry 定义]]  |
| PassiveStory | 聊天触发的随机剧情，按权重抽选                                    | [[03-data-structures#PassiveStoryEntry 定义]] |
| Talklet      | 剧情最小演出单元（对话/旁白/分支/动作）                              | [[03-data-structures#Talklet]]              |
| Value        | 动态数值表达式系统                                          | [[03-data-structures#数值系统]]                 |
| Condition    | 条件表达式系统                                            | [[03-data-structures#条件系统]]                 |
| Funclet      | 状态修改原子操作                                           | [[03-data-structures#函数操作]]                 |
| Effect       | 效果定义（乘/加/设/解锁）                                     | [[03-data-structures#效果定义]]                 |
| Datapack     | 数据包容器，组织所有游戏内容定义                                   | [[03-data-structures#数据包容器结构]]              |
| Item         | 可持有物品（消耗品/剧情道具/素材/礼物），支持分类和堆叠                      | [[03-data-structures#物品定义]]                 |
| DropTable    | 掉落表，加权随机奖励池                                        | [[03-data-structures#掉落表定义]]                |
| Inventory    | 玩家背包，Map<itemId, count>，每物品受 maxStack 约束           | [[03-data-structures#玩家状态]]                 |
| Registry | 注册表，存储所有定义并提供查询（含按类别/标签增强） | [[04-systems-modules#Registry]] |
| EventBus | 数据反射总线，游戏数据/数值变更的反射服务，仅供派生系统重算 | [[04-systems-modules#EventBus]] |
| LootSystem | 掉落系统，执行 DropTable 加权抽选 | [[04-systems-modules#LootSystem]] |
| AffectorEngine | 效果体引擎，统一管理生效效果的生命周期与四类派生（数值/操作权/可见度/流程） | [[04-systems-modules#AffectorEngine]] |
| Affector | 效果体，统一管理生效效果（条目/包装/实例/引擎） | [[09-affector-system]] |
| OperationRight | 操作权声明，控制实体操作的允许/禁止 | [[09-affector-system#1 OperationRight]] |
