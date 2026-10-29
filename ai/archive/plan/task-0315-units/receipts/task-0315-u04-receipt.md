# Task 0315 U04 Receipt：第一方 Action 内容迁移

状态：completed — 第一方内容迁移及 Unit 验证完成。

## 结果

- `gameplay-b-map-datapack.ts` 内 8 张第一方 Map 的 Action 旧字段已迁移：25 个旧 HP 变化映射为新 `damage` / `heal`，15 个 Action 资源数组映射为 `resourceChange`，2 个 sCost 卡牌折扣映射到 `prepare.discountSCost`。Shop Offer 的 `effects` 未改。
- 8 张 Map 的 `resumeVersion` 均从 3 提升到 4。E1 作者示例也提升到 4，移除了旧式数组演示行动，以 `damage` / `heal` 展示新原语；旧式对照 activity 改为 `opening-shot` 并复用新格式 `precision-shot`。
- `gameplay-b-map-registry.test.ts` 遍历内置 Datapack 中全部 Map，核对版本、新 Action 不含旧字段且逐 Map 经 Registry 装载；`gameplay-b-effect-example.test.ts` 对齐新 activity 名称与版本。
- 没有移除旧合同、归一化、Registry 或 Runtime 兼容分支；这些属于后续 Unit。
- U01–U03 的新语法接线后，定向 Registry / Owner 测试最终通过。初次运行发现旧数据依赖未声明 Actor/Team 余额默认为0；Map Program 的新上下文要求资源显式声明，因此在本 Task Allowed Files 内显式补了 `focus:0`（两名角色）和 `clues:0`（Team），与既有未声明余额的默认0一致。

## 逐 Action 迁移矩阵

记号：`D(n)` = `{op:'damage',target:'primary',amount:n}`；`H(n)` = `{op:'heal',target:'primary',amount:n}`；`R(a,id,n)` = `{op:'resourceChange',account:a,resourceId:id,delta:n}`；`P(n)` = `{op:'discountSCost',amount:n}`。`sourceActor` 对应旧 Actor 默认受用者，`primaryActor` 对应旧 `recipient:'target'`，`sourceTeam` 对应旧 Team。费用与 Action Target 保留原值。

| Map | Action | 旧字段 | 新 Program | 语义差异 / 证据 | U04 测试 |
| --- | --- | --- | --- | --- | --- |
| field-investigation | inspect-site | `effects: team clues +1` | `resolve:[R(sourceTeam,clues,+1)]` | 为满足新原语的静态声明，Map 显式声明起始 `clues:0`；保持旧默认余额与执行结果。 | 全 Map Registry 装载 |
| field-investigation | steady-equipment | `effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | `focus` 对两名队员显式声明为0，等同旧未声明账户默认0；`costs` 保持。 | 全 Map Registry 装载 |
| field-investigation | assist-teammate | `effects: actor focus +1, recipient=target` | `resolve:[R(primaryActor,focus,+1)]` | 两名队员的 `focus` 均显式声明为0，保留已解析队友身份；费用不变。 | 全 Map Registry 装载 |
| minimal-battle | attack | `hpEffects: -2` | `resolve:[D(2)]` | 负 HP 变化变为正伤害量；primary 与 HP 下限语义保留。 | 全 Map Registry 装载 |
| minimal-battle | robot-counterattack | `hpEffects: -2` | `resolve:[D(2)]` | 自动选择的 primary 不变。 | 全 Map Registry 装载 |
| linear-battle | standard-shot | `hpEffects: -2` | `resolve:[D(2)]` | 新伤害原语。 | 全 Map Registry 装载 |
| linear-battle | focused-shot | `hpEffects: -4` | `resolve:[D(4)]` | 原 focus 费用保留。 | 全 Map Registry 装载 |
| linear-battle | take-cover | `effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| linear-battle | signal-position | `effects: team clues +1` | `resolve:[R(sourceTeam,clues,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| linear-battle | patrol-counterattack | `hpEffects: -2` | `resolve:[D(2)]` | 自动 primary 不变。 | 全 Map Registry 装载 |
| activity-hall | standard-shot | `hpEffects: -2` | `resolve:[D(2)]` | 新伤害原语。 | 全 Map Registry 装载 |
| activity-hall | focused-shot | `hpEffects: -4` | `resolve:[D(4)]` | 原 focus 费用保留。 | 全 Map Registry 装载 |
| activity-hall | take-cover | `effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| activity-hall | catch-breath | `hpEffects: +2` | `resolve:[H(2)]` | 正向变化成为治疗；不复活。 | 全 Map Registry 装载 |
| activity-hall | tidy-supplies | `effects: team supplies +1` | `resolve:[R(sourceTeam,supplies,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| activity-hall | treat-teammate | `costs: team supplies 1; hpEffects: +3` | `resolve:[H(3)]` | 费用字段保持不变；治疗不复活。 | 全 Map Registry 装载 |
| activity-hall | hall-robot-counterattack | `hpEffects: -2` | `resolve:[D(2)]` | 自动 primary 不变。 | 全 Map Registry 装载 |
| forked-route | standard-shot | `effects: team clues +1; hpEffects: -2` | `resolve:[D(2),R(sourceTeam,clues,+1)]` | 新序列显式采用 HP 后资源顺序，与旧 Party Action HP 先于资源阶段一致。 | 全 Map Registry 装载 |
| forked-route | focused-shot | `hpEffects: -4` | `resolve:[D(4)]` | 原 focus 费用保留。 | 全 Map Registry 装载 |
| forked-route | take-cover | `effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| forked-route | collect-intel | `effects: team clues +1` | `resolve:[R(sourceTeam,clues,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| forked-route | guard-counterattack | `hpEffects: -2` | `resolve:[D(2)]` | 自动 primary 不变。 | 全 Map Registry 装载 |
| continuous-conditional | standard-shot | `hpEffects: -2` | `resolve:[D(2)]` | 新伤害原语。 | 全 Map Registry 装载 |
| continuous-conditional | focused-shot | `hpEffects: -4` | `resolve:[D(4)]` | 原 focus 费用保留。 | 全 Map Registry 装载 |
| continuous-conditional | take-cover | `effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| continuous-conditional | search-terminal | `effects: team pass +1` | `resolve:[R(sourceTeam,pass,+1)]` | Actorless 来源仍只写 sourceTeam；PlayerCost 保持独立。 | 全 Map Registry 装载 |
| continuous-conditional | catch-breath | `hpEffects: +2` | `resolve:[H(2)]` | 正向变化成为治疗；不复活。 | 全 Map Registry 装载 |
| continuous-conditional | tidy-supplies | `effects: team supplies +1` | `resolve:[R(sourceTeam,supplies,+1)]` | 资源账本语义保留。 | 全 Map Registry 装载 |
| continuous-conditional | treat-teammate | `costs: team supplies 1; hpEffects: +3` | `resolve:[H(3)]` | 费用字段保持不变；治疗不复活。 | 全 Map Registry 装载 |
| continuous-conditional | continuous-guard-counterattack | `hpEffects: -2` | `resolve:[D(2)]` | 自动 primary 不变。 | 全 Map Registry 装载 |
| scost-training | planning | `cardEffects: scostDiscount 1` | `prepare:[P(1)]` | 仍要求真实 CardRef；仅减少受用卡 Actor sCost。 | 全 Map Registry 装载 |
| scost-training | coordinated-planning | `cardEffects: scostDiscount 2` | `prepare:[P(2)]` | 同上；叠加与截零由 prepare Owner 保持。 | 全 Map Registry 装载 |
| scost-training | rifle-shot | `costs: actor sCost 2; hpEffects: -2` | `resolve:[D(2)]` | 成本与新伤害保持分离。 | 全 Map Registry 装载 |
| scost-training | burst-shot | `costs: actor sCost 3; hpEffects: -3` | `resolve:[D(3)]` | 成本与新伤害保持分离。 | 全 Map Registry 装载 |
| scost-training | cover-shot | `costs: actor sCost 2; hpEffects: -1` | `resolve:[D(1)]` | 成本与新伤害保持分离。 | 全 Map Registry 装载 |
| scost-training | training-target-counterattack | `hpEffects: -1` | `resolve:[D(1)]` | 自动 primary 不变。 | 全 Map Registry 装载 |
| autonomous-target-battle | autonomous-standard-shot | `effects: team clues +1; hpEffects: -2` | `resolve:[D(2),R(sourceTeam,clues,+1)]` | 显式 HP 后资源顺序，对齐旧 Party Action HP 先行阶段。 | 全 Map Registry 装载 |
| autonomous-target-battle | autonomous-take-cover | `costs: actor focus 1; effects: actor focus +1` | `resolve:[R(sourceActor,focus,+1)]` | 费用仍由原 `costs` 预检，不能用本轮收益付本轮费用。 | 全 Map Registry 装载 |
| autonomous-target-battle | autonomous-aid-teammate | `hpEffects: +2` | `resolve:[H(2)]` | 新治疗原语；自动 primary 仍按原 missing-HP preference 解析，不复活。 | 全 Map Registry 装载 |
| autonomous-target-battle | robot-counterattack | `hpEffects: -3` | `resolve:[D(3)]` | 自动 primary 不变。 | 全 Map Registry 装载 |

旧数组归一化为 `mode:'legacy'` 且给 HP / 资源安排不同历史 phase。现有内容中的两条混合 Action 均为 Party Action，迁移顺序明确为 damage 后 resourceChange；纯资源或纯 HP Action 没有同一 Action 内的跨通道先后差异。Enemy Action 不含混合资源效果。Shop 的两条交易 `effects` 不属于 Action，不在迁移矩阵中。

## E1 作者示例迁移

| 示例 | 旧 / 当前写法 | 新写法 | 差异与验证位置 |
| --- | --- | --- | --- |
| `precision-shot-legacy` / `legacy-range` | 旧数组 HP -3，独立展示旧模式 | 删除旧 Action；用 `precision-shot` 的 `resolve:[D(3)]` 作为 `opening-shot` | 移除作者示例中的旧系统入口；第一段仍消耗原 1 点 sCost 并造成 3 点伤害。Owner 流程由 `gameplay-b-effect-example.test.ts` 覆盖。 |
| `prepare-shot` | `prepare:[discountSCost 1]` | 保持 | 现有新 Program，无迁移变化；CardRef 绑定不变。 |
| `precision-shot` | `hpChange(primary,-3)` | `resolve:[D(3)]` | 新伤害语义；同目标与数量。 |
| `covering-shot` | `hpChange(primary,-2)` 后 `resourceChange(sourceActor,ammo,+1)` | `resolve:[D(2),R(sourceActor,ammo,+1)]` | 仍先扣 ammo cost，再造成伤害并记资源收益；不能用本轮收益支付本轮成本。 |
| `conditional-bandage` | 条件资源变化，后 `hpChange(source,+3)` | 原 when 顺序不变，后接 `heal(primary,3)`；该 Action 的 `target` 为 `self` | 治疗当前解析出的本人；不复活；条件仍在治疗前读取 HP。 |
| `negotiate` | Counter / Flag / Team resource Program | 保持 | 无旧 Action 字段，无迁移变化。 |

## 文件与验证

- 内容：`src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`、`src/arona-clicker/content/gameplay-b/gameplay-b-effect-program-example.ts`。
- 测试：`tests/data/gameplay-b-map-registry.test.ts` 增加全部内置 Map 的 Registry 加载、版本与 Action 旧字段断言；`tests/data/gameplay-b-effect-example.test.ts` 改用 `opening-shot` 和版本4。
- `rg` 核对确认 Map 内容 Action 中无 `hpEffects` / `cardEffects` / 旧 `effects`，保留的两处 `effects` 均属于 Shop Offer。八张 Map 的版本均为4。
- 实际执行 `npx vitest run tests/data/gameplay-b-map-registry.test.ts tests/data/gameplay-b-effect-example.test.ts`：**2 files / 136 tests passed**。
- 实际执行 U04 白名单 `git --no-pager diff --check`；tracked 文件检查通过。对未跟踪的 Example、示例测试、Unit 和 Receipt 运行尾随空白检查，无命中。

## 未完成 / 风险

- U04 验收完成。旧相位与新显式顺序的全量行为回归仍由 U05 和 U10 覆盖；本 Receipt 不替代后续系统移除验收。
