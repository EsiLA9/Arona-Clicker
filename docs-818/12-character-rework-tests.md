# 12-character-rework-tests — Character 重构测试规格

> 配套设计：[[1-项目/ACProgram/docs-818/12-character-rework]]（玩法与数据结构策划）
> 本文是重构的**测试验收规格**：列出必须实现的 vitest 套件、用例与边界情况。全部通过（`npm test`）才算重构完成。

## 0. 测试总则

| 项 | 约定 |
|---|---|
| 框架 | vitest（`npm test`） |
| 位置 | `tests/engine/`（引擎）、`tests/ui/`（只读消费）、`tools/datapack-editor/schema/`（Schema 同步） |
| 命名 | 与被测源文件同名：`src/engine/roster-system.ts` → `tests/engine/roster-system.test.ts` |
| 夹具 | 沿用 [[tests/engine/character-system.test.ts]] 的 `emptyState(overrides)` 模式 + 精简测试数据包常量 |
| 架构断言 | 每个写操作用例必须**经由 StateMutationService 公共方法**发起，禁止直接改 PlayerState 后断言 |
| 事件断言 | 写操作用例必须同时断言发出的事件（`characterAcquired` / `cultivated` / `equipped` / `colorUnlocked` / `gachaResolved`） |
| 存档迁移 | **不存在迁移套件**。项目处于长期开发阶段，存档结构破坏性变更直接清档重来（见 AGENTS.md），禁止编写迁移代码 |

### 旧套件处置

- [[tests/engine/character-system.test.ts]]：`getBonus`（CharacterBonusTable）、`getAssignable`、flag 解锁相关用例**随重构删除**；`getTagBonus` / 筛选 / 加载用例迁移到新的变体查询服务套件
- [[tests/engine/tick-system.test.ts]]：删除"manager 加成参与产出"的用例，新增"manager 存在但不产生效果"的反向断言

---

## 1. roster-system — 获得与通讯录

**文件**：`tests/engine/roster-system.test.ts`

### 1.1 获得（acquireCharacter）

| ID | 用例 | 前置 | 期望 |
|---|---|---|---|
| R-01 | 首次获得变体 | roster 为空 | 新建 `RosterEntry`：level=1、exp=0、stars=初始星级、equipped 全空；发出 `characterAcquired` |
| R-02 | 重复获得 → 转该**变体**碎片 | 该变体已在 roster | **不新建/不改培养**；`fragments[variantId]` 增加**该变体自己的**碎片（Hoshino / HoshinoSwimsuit / HoshinoArmed 的碎片互不相通）；发出 `characterAcquired`（`via: 'dup'`） |
| R-03 | 重复奖励由卡池决定 | 经由卡池抽取重复获得 | 返还物按该池 `dupRewards` 配置执行（碎片数量 / 附加其他资源均可配置）；非卡池来源（story/event）走全局默认 `dupRewardsDefault` |
| R-04 | 未知 variantId | Datapack 未定义 | 抛错（或 devLog error + 拒绝写入），state 不变 |
| R-05 | 获得来源标记 | `via: 'gacha' / 'story' / 'event'` | `acquiredVia` 正确记录；重复获得不覆盖首次来源 |
| R-06 | 同原型多变体独立 | 已有 Hoshino，获得 HoshinoSwimsuit | 各自独立 entry、**各自独立碎片余额** |

### 1.2 通讯录查询（只读）

| ID | 用例 | 期望 |
|---|---|---|
| R-10 | 按学校分组 | 返回分组结构，组内按 rarity 降序 |
| R-11 | 未获得变体 | 不出现在通讯录列表，但在图鉴结构中显示为未获得占位 |
| R-12 | `getOwned(variantId)` | 拥有 → entry；未拥有 → undefined |

---

## 2. cultivate — 培养四轨

**文件**：`tests/engine/cultivate-system.test.ts`

### 2.1 经验-等级

| ID | 用例 | 期望 |
|---|---|---|
| C-01 | 加经验不跨级 | exp 增加，level 不变 |
| C-02 | 加经验跨级 | level +1，exp 扣除本级需求（余量进下级） |
| C-03 | 连续跨多级 | 一次大额经验连升多级，逐级扣减 |
| C-04 | 达到曲线上限 | 经验溢出被截断（或按配置保留），level 封顶于 `CultivateCurveDef.maxLevel` |
| C-05 | 星级提升上限 | 突破后上限按 `StarDef.levelCapBonus` 扩展，可继续升级 |
| C-06 | 未拥有变体培养 | 拒绝，state 不变 |

### 2.2 星级（碎片突破）

| ID | 用例 | 期望 |
|---|---|---|
| C-10 | 碎片足够 → 突破 | stars +1，`fragments[variantId]` 扣除 `StarDef.cost[stars]`，发出 `cultivated(kind:'star')` |
| C-11 | 碎片不足 | 拒绝，碎片与星级均不变 |
| C-12 | 达到星级上限 | 拒绝 |
| C-13 | 碎片按变体隔离 | 变体 A 突破**只消耗变体 A 自己的碎片**；同原型变体 B 的碎片不可替代（含专属装备解锁等一切碎片消费点） |

---

## 3. equip — 装备系统

**文件**：`tests/engine/equip-system.test.ts`

### 3.1 通用装备（BA 式库存）

| ID | 用例 | 期望 |
|---|---|---|
| E-01 | 入库 | 获得 EquipInstance（defId + level），进 `equips` 背包 |
| E-02 | 装备到合法槽位 | `equipped.general[slot]` 指向该实例；发出 `equipped` |
| E-03 | 槽位类型不匹配 | 拒绝（帽类装备不可入手套槽） |
| E-04 | 槽位已占用 | 原装备**退回背包**，新装备入槽（原子替换，不丢失） |
| E-05 | 已被他人装备的实例 | 同一 EquipInstance 不可同时装备两个变体；重复装备先从原变体卸下 |
| E-06 | 卸下 | 退回背包 |
| E-07 | 品质层级 | Tn 装备效果按 `EquipDef.effects` 声明生效，效果求值走 Effect 引擎 |

### 3.2 专属装备（固有武器式）

| ID | 用例 | 期望 |
|---|---|---|
| E-10 | 解锁条件 | 按 `ExclusiveWeaponDef.unlockCost` 配置（默认该变体碎片 + 材料）满足 → 生成该变体专属实例并自动入专属槽 |
| E-11 | 变体绑定 | 专属装备不可装备到其他变体（含同原型其他差分） |
| E-12 | 升级 | 消耗材料，level +1，效果随 level 重算 |

### 3.3 效果接入

| ID | 用例 | 期望 |
|---|---|---|
| E-20 | 装备效果求值 | 通过现有 Effect/Affector 体系求值；卸下后效果消失（无残留） |
| E-21 | 装备组合 | 多件装备效果按现有效果叠加语义累乘/累加，与 Enhancement 效果无冲突 |

---

## 4. color — 色彩系统

**文件**：`tests/engine/color-system.test.ts`

### 4.1 获得与装备

| ID | 用例 | 期望 |
|---|---|---|
| CL-01 | 解锁条件满足 → 获得 | `unlock` Condition 通过（引用 protoStats / story flag）→ 色彩入库存；发出 `colorUnlocked` |
| CL-02 | 条件不满足 → 不可获得 | 拒绝 |
| CL-03 | 重复获得 | 幂等：不重复入库存、不重复发事件 |
| CL-04 | 装备到色彩槽 | 受 `equipped.colors` 槽位数上限约束；效果生效 |
| CL-05 | 激活主题 | `activeColor` 全局单选；切换只改 `activeColor`，不影响装备槽 |
| CL-06 | 激活未拥有色彩 | 拒绝 |
| CL-07 | 轻数值效果 | 经 Effect 体系求值，量级为轻量加成（tagMultiplier / 资源加成） |
| CL-08 | 解锁条件引用 protoStats | protoStats 更新后（Trigger 派生）条件即时可判定 |

### 4.2 主题派生

| ID | 用例 | 期望 |
|---|---|---|
| CT-01 | 仅首选颜色 → HSL 自动派生 | `ColorDef.theme` 只给 `primary` 时，UI 其余组件色由 primary 按 HSL 明度/饱和度深浅规则自动生成（深/浅两套背景、文字对比色等），派生结果确定性（同输入同输出） |
| CT-02 | 显式多色配置覆盖派生 | `theme` 给出更多 token 时，显式值优先，未给出的仍走 HSL 派生 |
| CT-03 | 全量自定义 | 提供近乎全量 token 集 → UI 完全按配置渲染，无任何派生介入 |
| CT-04 | 对比度防呆 | 派生的前景/背景对对比度低于阈值时自动翻转深浅选择（或 devLog 提示） |

---

## 5. gacha — 抽取模式与卡池

**文件**：`tests/engine/gacha-system.test.ts`

> **抽取模式（GachaMode）是代码定义的**（如 `ba-classic` 蔚蓝档案经典、后续其他 neta 模式），**不提供数据包可插拔**。数据包只负责声明池参数（费用/概率/UP/dupRewards/可及性），模式实现决定 roll 流程语义。

| ID | 用例 | 期望 |
|---|---|---|
| G-00 | 模式注册表 | 引擎内 GachaMode 注册表存在；未知 mode 的池加载期报错 |
| G-01 | 正常抽取（ba-classic） | 扣除 `currency × costPerPull`；按 `rates` 权重落稀有度，再在稀有度内选变体；`pulls` +1 |
| G-02 | 资源不足 | 拒绝，state 不变，无事件 |
| G-03 | 硬保底（天井） | `pity` 达 `guaranteedAt` → 必出 `featured`（或该池保底规则），pity 归零 |
| G-04 | pity 计数 | 未出货时 pity +1；出高稀有度时按配置归零（或保留，按 `pity.keepOnHit`） |
| G-05 | UP 池命中分布 | featured 变体在其稀有度内按 `featured` 权重选中 |
| G-06 | 重复出货 | 走 [[#1.1 获得（acquireCharacter）|R-02/R-03]]：返还**该变体**碎片 + 池配置的附加资源 |
| G-07 | 池未定义 / 空概率表 / 未知 mode | 拒绝并报错 |
| G-08 | 结果确定性 | 注入 seeded RNG 后可复现整段抽取序列（测试用 rng 注入口） |
| G-09 | 单抽与十连 | 十连 = 10 次独立 roll，逐次扣费、逐次结算 pity，中途资源不足则中止并返回已完成部分 |
| G-10 | 多模式共存 | 两个不同 mode 的池同时可用，各自 roll 流程互不影响（为未来 neta 模式预留的结构性验证） |

---

## 6. availability — 角色可及性管理

**文件**：`tests/engine/character-availability.test.ts`

> 两个简单概念：**限定卡池**（仅在该池活动期间可获得）与**世界 Pool**（事件结束 / 指定卡池结束后，角色进入常驻世界池，可从常驻渠道获得）。可及性由 **Pool Def 自身声明**。

| ID | 用例 | 期望 |
|---|---|---|
| A-01 | 限定池独占 | 角色仅声明于限定池 → 只能经该池获得；story/event 显式授予不受限（grantCharacter 直发） |
| A-02 | 进入世界 Pool | 池关闭条件触发（事件完成 / 指定池结束）→ 角色进入世界 Pool，常驻池可抽到 |
| A-03 | 世界 Pool 查询 | `getWorldPool(state)` 返回当前已入常驻的全部变体 |
| A-04 | 未入任何池 | 既不在活动限定池也不在世界 Pool → 任何池均抽不到 |
| A-05 | 池 Def 声明完整性 | Pool Def 引用的 variantId 未定义 → 加载期报错 |
| A-06 | 可及性与 UI | UI 池详情页展示的可及角色集合与引擎判定一致（只读 view 消费） |

---

## 7. proto-stats — 原型聚合统计

**文件**：`tests/engine/proto-stats.test.ts`

> protoStats 是**原型层的追溯统计**（图鉴/色彩解锁条件用），与碎片无关——碎片按变体隔离（见 C-13 / R-06）。

| ID | 用例 | 期望 |
|---|---|---|
| P-01 | 获得驱动 | `characterAcquired` → `protoStats[proto].acquiredTotal` +1（含重复获得） |
| P-02 | 培养驱动 | 升级/突破 → `cultTotal` 按消耗累计 |
| P-03 | 派生不持久 | protoStats 为派生视图：清空后由 roster/事件日志重算结果一致（重放幂等） |
| P-04 | 多变体聚合 | 同原型多变体的获得/培养均归并到原型 |
| P-05 | 色彩条件消费 | CL-08 联动：protoStats 变化后色彩解锁判定更新 |

---

## 8. persist-config — 三层状态归属

**文件**：`tests/engine/character-persist.test.ts`

| ID | 用例 | 期望 |
|---|---|---|
| PS-01 | 默认归属 | 未配置时：roster/gacha/equips → global；chatRead → init（软重启清空） |
| PS-02 | 声明 global | 软重启后 `roster` 等容器原样保留（对照 [[src/engine/game/init-service.ts]] global Spot 保留路径） |
| PS-03 | 声明 init | 软重启后该容器重置为空初始值 |
| PS-04 | 快照往返 | 存档 → 读档后各容器内容一致（含 EquipInstanceId 稳定性） |
| PS-05 | 非法配置值 | `persist: 'foo'` → 加载期报错（fail-fast），不静默降级 |
| PS-06 | 软重启不影响 global 保底 | gacha 声明 global 时，软重启后 pity/pulls 保留，可继续累计 |

---

## 9. 冻结与回归 — 旧机制失效

**文件**：`tests/engine/tick-system.test.ts`（改写）+ `tests/engine/game-instance.test.ts`（追加）

| ID | 用例 | 期望 |
|---|---|---|
| F-01 | tick 不再吃 manager 加成 | `spotManagers` 有值时产出与空值时**完全一致** |
| F-02 | characterBonuses 废弃 | Datapack 携带 `characterBonuses` → 加载期忽略 + devLog 警告 |
| F-03 | 表达式兼容 | `managerCount` ValueSource 仍可求值（字段未删），但角色产出加成路径不存在 |
| F-04 | tag-stats 对齐 | [[src/engine/tag-stats.ts]] 删除复刻的解锁判定后，角色统计改为消费 roster（单一真相来源），与 roster-system 查询结果一致 |

---

## 10. Schema 协议同步

**文件**：`tools/datapack-editor/schema/engine-schema.sync.test.ts`（既有三向一致测试自动覆盖）

| ID | 用例 | 期望 |
|---|---|---|
| S-01 | 新实体进协议 | `CharacterVariantDef` / `EquipDef` / `ColorDef`（theme token 结构）/ `GachaPoolDef`（mode/rates/dupRewards/availability）/ `ChatMessageDef` / `CultivateCurveDef` / `CharacterPersistConfig` 全部出现在 `engine-defs.gen.json` |
| S-02 | 字段标注 | 带 `@label` / `@enum` / `@ref` 的字段在编辑器 schema 中有中文标签与引用；GachaPoolDef.mode 为代码定义枚举（非可插拔） |
| S-03 | 复杂字段兜底 | Condition/Effect 类字段经 `editor-extras.ts` overrides 进编辑器 |
| S-04 | 未同步即失败 | 故意在引擎删一个已发布字段 → sync 测试 error（守护回归） |

---

## 11. UI 只读消费

**文件**：`tests/ui/`（追加）

| ID | 用例 | 期望 |
|---|---|---|
| U-01 | 通讯录渲染 | 左侧栏分组来自 `getView()` 派生数据；未获得角色显示占位 |
| U-02 | 选中联动 | 选中角色 → 右栏培养面板、中栏聊天流均来自只读 view，无写引用 |
| U-03 | 聊天已读 | 标记已读走 StateMutationService；`chatRead` 按 persist 配置归属层重置 |
| U-04 | 主题切换 | `activeColor` 变更 → UI CSS token 更新；仅配 primary 时走 CT-01 派生链路 |
| U-05 | 池界面可及性 | 卡池详情展示的可及角色来自 availability 只读 view（联动 A-06） |

---

## 12. 验收标准

1. `npm test` 全绿；上述套件全部存在且非空
2. `npx tsc --noEmit` 通过
3. `npm run gen:schema` 后 `engine-defs.gen.json` 与引擎字段零漂移（S 组测试守护）
4. 无任何存档迁移代码（M 类需求一律拒绝，见 AGENTS.md）
5. 旧 `character-system.test.ts` 中被删除的用例均有对应新套件替代（本文档 ID 可追溯）
