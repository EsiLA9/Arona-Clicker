# 机制：装备（Gear）成长

> 与「色彩装备 `ColorEquipment`」是两套独立系统：命名（`Gear` / `GearId` vs `EquipmentId`）、状态与 UI 全部分家。设计裁定见 [[docs/0x-plan&work/newPlan/11-gear-equipment-system]]。

## 1. 概念与数据

- 每个 Variant 声明三固定槽 `progression.gearSlots`：`[{ slot:'attack' }, { slot:'defense' }, { slot:'special' }]`，每槽绑定**唯一类型线**，玩家不能换类别（对齐蔚蓝档案：攻击槽可能有帽子/鞋子/手套，但该学生只能装其中一种）。
- 类型线 `GearDef`（Datapack 表 `gears`）：`{ id, name, slot, tiers[] }`。
- 层级 `GearTierDef`：`{ tier, levelCap, baseLevel?, expPerLevel, upgradeCost?: GearCostDef[], baseEffects?, perLevelEffects? }`。
- 全局配置 `GearConfigDef`（Datapack 字段 `gearConfig`）：`expItems`（经验材料 itemId → 提供的装备经验）、`levelCost?`。
- 运行时状态：`VariantProgress.gear?: [GearProgress?, GearProgress?, GearProgress?]`，`GearProgress { tier, level, exp }`；缺省项 = 未装配。
- 图纸与经验材料是普通 `Item`，走 `state.inventory`；**不发明第二套库存**。
- 跨线记忆：`VariantMemory.maxGearTier`（只增不减，随 `roster` 归属，当前 `global`）。

## 2. 等级与 tier

- **等级跨 tier 累计**：`levelCap` 由当前 tier 给出（示例 T1=10、T2=20，实际由数据包声明）。
- 装配：空槽 + 消耗 T1 图纸 ×1 → `{ tier: 1, level: 1, exp: 0 }`。
- 升级经验：消耗经验材料，按 `expItems` 换算累加 `exp`；`exp >= expPerLevel` 时 `level+1` 并扣除阈值，可连续进位；到达 `levelCap` 后 `exp` 归零。
- 升级 tier：需 `level === levelCap`，消耗目标 tier 的 `upgradeCost`（图纸 ×N）；成功后 `tier+1`，**等级与经验保留**；已到最高 tier 返回 `max-tier`。
- **不提供取下**（对齐蔚蓝档案本体）。

## 3. 效果模型

```text
gearEffects(tier, level) = tier.baseEffects + tier.perLevelEffects × max(0, level - baseLevel)
```

- `baseLevel` 缺省 = 上一 tier 的 `levelCap`（T1 为 1）。因此刚升到新 tier 时级差为 0，只吃新 tier 的基础效果。
- **升 tier 时新 tier 效果整体替换旧 tier，不跨 tier 叠加。**
- `perLevelEffects` 只应放线性加法类 op（数值按级差缩放）；乘算 / 条件 / 集合类只能放 `baseEffects`。
- `GearSystem.effectsOf()` 已实现解析，但**当前无运行时消费方**；消费统一留给 B 段 `ProgressionEffectResolver`。

## 4. 写入口与事件

| 写入口 | 校验顺序（任一步失败即整体拒绝） |
| --- | --- |
| `equipGear(variantId, slotIndex)` | 差分/槽存在 → 槽为空 → T1 tier 存在 → 图纸足够 |
| `feedGearExp(variantId, slotIndex, itemId, count)` | 已装配 → tier 存在 → 未满级 → 材料合法 → 库存足够 |
| `upgradeGearTier(variantId, slotIndex)` | 已装配 → tier 存在 → 已满级 → 存在下一 tier → 图纸足够 |

- 三者都**先完整校验、再一次性扣款写入**；失败不扣除任何材料。
- 统一发伞事件 `characterProgressChanged { domain: 'gear', source }`，`source` ∈ `equipGear` / `feedGearExp` / `upgradeGearTier`；不新增 per-slot 碎片事件。
- 端口：`GearQueryPort`（只读）+ `UiMutationPort` / `GameCommands` 写入口；`GearSystem` 在 `runtime-wiring` 装配。

## 5. UI

- 角色面板右栏「装备」区块渲染三张槽卡片（空槽 / 已装配 / 满级三态），显示类别、类型线名、`T{tier}`、`Lv.{level}/{cap}`、经验条与消耗预览。
- UI 只消费只读 `GearQueryPort.viewOf()`（`GearSlotView`），不持有写引用；写操作由 controller 经 `GameCommands` 发起。
- 样式 `src/ui/css/gear.css`，命名空间 `gear-*`。

## 6. 当前实现限制

- tier 效果只声明、不消费（B 段）。
- 图纸暂无掉落 / 商店来源，只能由背包或测试直接发放。
- 无装备图鉴页；无 per-variant 数值 override。
- 消耗用专用 `GearCostDef`（物品 × 数量），未复用 `ProgressionCostDef`（后者 amount 为 `ValueExpression`，MVP 无收益）。

## 7. 测试与核验

- `tests/engine/gear-system.test.ts`（13 例：装配、经验进位与上限、升阶、拒绝路径、tier 效果替换、只读视图、跨线记忆、伞事件、base 内容回归）
- 最后核验：2026-09-11（`npm test` 138 文件 / 1277 测试通过）
