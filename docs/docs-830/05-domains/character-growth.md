# docs-830/05-domains/character-growth — 角色培养

角色长期进度与 Gameplay B 构筑是不同过程；转译预览、确认和训练入口见 [[variant-translation-and-training]]。

本文回答：角色进度如何计算、提交，并供 roster 查询使用。

## 培养流程

```text
培养命令 → 校验角色与消耗 → 计算进度变化 → StateMutationService 提交
                                      → 角色进度事件 → Roster 查询视图
```

角色差分的等级曲线、等级上限和突破条件由培养机制解析；好感、装备、颜色装备等进度各有相应服务和状态字段。写入后，`RosterSystem` 根据当前 Registry 定义与玩家状态生成查询信息，例如等级、经验和可突破条件。界面读取这些查询结果，Controller 命令负责发起培养操作。

`CharacterSystem` 读取角色原型和 Profile 定义；`RosterSystem` 读取玩家持有的 Variant 进度并生成只读培养视图。定义查询和持有状态是两个不同来源。

等级经验按曲线逐级扣除，达到有效等级上限后剩余经验截断。有效等级上限取曲线最大等级与账号等级上限中的较低值。星级突破按当前星级读取下一档碎片成本，碎片按 Variant 分开计数；`RosterSystem.cultivationOf()` 将等级、经验、好感、星级、碎片、突破成本和可操作状态合成为 `CharacterCultivationView`。

好感等级采用单独的经验配置和上限规则；装备、颜色装备与 Gear 也有各自的定义和服务。它们共享角色进度状态与 Roster 查询入口，但不共享同一条培养公式。

`AffectionSystem` 和培养曲线函数负责纯计算，返回新的经验/等级结果，由宿主调用状态写入服务提交。`GearSystem` 从 Registry 与角色进度生成槽位只读视图，并计算成本、等级及装备效果声明；它查询到效果不等于立即应用效果。颜色装备也按解锁/装备状态提供效果声明，由消费它们的领域系统在对应时机应用。

`ColorUnlockReactor` 监听角色获得与旗标变化，重新检查颜色组、设计和颜色装备解锁；具体条件由 Color 服务评估，持有结果仍交给写入服务记录。它把内容声明转成玩家可获得的选项，不负责渲染最终主题。

源码入口：`src/arona-clicker/services/progression/cultivate-system.ts`、`src/arona-clicker/services/character/roster-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`，以及 `src/arona-clicker/services/character/`、`services/progression/` 下的进度服务。

相关测试见 `tests/engine/character/cultivate-system.test.ts`、`tests/engine/character/affection-system.test.ts`、`tests/engine/progression/gear-system.test.ts`。角色定义与获取见 [[character-and-gacha]]。

## 几条进度线不能混为一谈

| 进度 | 输入与归属 | 达上限或失败时 |
| --- | --- | --- |
| 角色等级 / 经验 | 已持有 Variant 的等级曲线、当前经验和账号上限 | 达有效上限时截断溢出经验；未拥有的 Variant 不能培养。 |
| 星级 | 当前 Variant 的星级与该 Variant 的碎片 | 不足、已达上限等条件会拒绝；其他 Variant 的碎片不能代付。 |
| 好感 | 单独的好感经验配置、等级上限及星级限制 | 达 cap 时截断；解锁更高上限不等于自动获得经验。 |
| Gear | 角色的装备槽、类型线、材料与当前 tier / level | 装配、升级和升阶各有准入；查询效果声明本身不是应用效果。 |

这些状态都可能由 Roster 视图汇总，但展示在同一面板不代表共用一套规则。`CharacterSystem` 查询内容定义，`RosterSystem` 组合定义和已拥有进度，实际变化经领域写入口提交。

## 示例：分次经验和差分碎片

`tests/engine/character/cultivate-system.test.ts` 覆盖：已有经验与新增经验合并，达到本级需求时升级并将余量带到下一级；达到有效上限后溢出截断。另一组测试为不同 Variant 分别准备碎片，突破 A 只消耗 A 的碎片，B 的碎片不能替代。

好感也会逐级累积，但采用自己的配置和上限；`tests/engine/character/affection-system.test.ts` 覆盖跨级、星级锁及存档恢复。装备示例见 `tests/engine/progression/gear-system.test.ts`：材料不足或已装配时拒绝装配，满级并具备图纸时才可升 tier。

修改培养规则时，应同时核对计算结果、写入端口、`characterProgressChanged` 事件和 Roster 视图；只看面板数值不足以证明存档或下游反应正确。
