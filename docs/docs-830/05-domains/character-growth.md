# docs-830/05-domains/character-growth — 角色培养

本文回答：角色进度如何计算、提交，并供 roster 查询使用。

## 培养流程

```text
培养命令 → 校验角色与消耗 → 计算进度变化 → StateMutationService 提交
                                      → 角色进度事件 → Roster 查询视图
```

角色差分的等级曲线、等级上限和突破条件由培养机制解析；好感、装备、颜色装备等进度各有相应服务和状态字段。写入后，`RosterSystem` 根据当前 Registry 定义与玩家状态生成查询信息，例如等级、经验和可突破条件。界面读取这些查询结果，Controller 命令负责发起培养操作。

等级经验按曲线逐级扣除，达到有效等级上限后剩余经验截断。有效等级上限取曲线最大等级与账号等级上限中的较低值。星级突破按当前星级读取下一档碎片成本，碎片按 Variant 分开计数；`RosterSystem.cultivationOf()` 将等级、经验、好感、星级、碎片、突破成本和可操作状态合成为 `CharacterCultivationView`。

好感等级采用单独的经验配置和上限规则；装备、颜色装备与 Gear 也有各自的定义和服务。它们共享角色进度状态与 Roster 查询入口，但不共享同一条培养公式。

源码入口：`src/arona-clicker/services/progression/cultivate-system.ts`、`src/arona-clicker/services/character/roster-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`，以及 `src/arona-clicker/services/character/`、`services/progression/` 下的进度服务。

相关测试见 `tests/engine/cultivate-system.test.ts`、`tests/engine/affection-system.test.ts`、`tests/engine/gear-system.test.ts`。角色定义与获取见 [[docs/docs-830/05-domains/character-and-gacha]]。
