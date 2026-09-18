# Task：实体表现内容单元与玩家选择

状态：complete — ✅ P0–P6 已完成；实现、测试、机制文档与计划收束完成

## 目标

为 `name + description + theme` 建立统一的实体表现内容语义单元，使 `Init / Area / Spot / Enhancement / CharacterVariant` 能够声明一个默认内容和一组附加内容，并支持：

- 剧情、事件、Trigger、Effect 或其他运行时原因使实体切换描述与主题；
- 玩家在可用内容中自主选择当前使用的描述与主题；
- 描述与主题作为同一个内容选择处理，避免两套独立选择器产生不合理组合；
- 最终表现仍由只读 Resolver / GameView / UIContext 派生，不把最终字符串或最终主题写入 PlayerState；
- 继续复用现有 `ThemeDef`、ColorSystem、Reveal、Condition DSL 和 StateMutationService 边界。

本 Task 先固定规划与验收边界，再按施工切片落地实现；已完成切片的源码与测试是当前实现事实。

## 设计边界

### 1. 表现内容是三字段语义单元

当前实体分别持有 `name`、`description` 与 `theme`，其中颜色实际由 `ThemeDef`、`ColorGroup` 和 ColorSystem 派生，不是单一 hex 字段。本 Task 将它们视为一个最终表现单元：

```text
EntityPresentationValue
  ├─ name
  ├─ description
  └─ theme
```

Datapack 侧建议新增嵌套定义，而不是新增顶层 Registry 表：

```ts
interface EntityPresentationDef {
  default: EntityPresentationValue;
  additions?: EntityPresentationOption[];
}

interface EntityPresentationOption {
  id: string;
  label: string;
  override: Partial<EntityPresentationValue>;
  availableWhen?: Condition | ConditionGroup;
}
```

语义约定：

- `default` 是实体的基础内容，不等于玩家当前选择；
- `additions` 的每一项使用局部覆盖，未提供的字段从 `default` 继承；
- Resolver 输出时一定得到完整的 `name + description + theme` 结果；
- `theme` 继续使用现有 `ThemeDef`，支持色板、语义节点、背景和 Presentation，不新增平行颜色 Schema；
- `availableWhen` 只表示该内容当前是否可被选择，不自动覆盖玩家选择；
- 如果未来需要“已获得但暂时不可用”，另立拥有/解锁语义，不把它混入 `availableWhen`。

### 2. 初始目标实体与 Chara 粒度

统一契约可覆盖 `Init / Area / Spot / Enhancement / CharacterVariant`。本 Task 的首批玩家选择对象为：

| 对象 | 选择 Key | 说明 |
| --- | --- | --- |
| Area | `area:<id>` | 区域卡片、区域详情与区域相关 Tooltip 共用 |
| Spot | `spot:<id>` | 设施卡片、设施详情与 Spot Tooltip 共用 |
| Enhancement | `enhancement:<id>` | 强化卡片、选择页与强化 Tooltip 共用 |
| Chara | `variant:<id>` | 角色差分是实际展示与主题作用对象 |

`CharacterData` 继续作为原型聚合与图鉴回退来源；`CharaProfile` 继续负责名称/头像档案及玩家覆盖，不在本 Task 中替代 `CharacterVariantDef` 的表现内容。

`Init` 使用同一契约，但是否在首批 UI 暴露选择入口，留到施工切片裁定；不能因此复制一套 Init 专用模型。

### 3. 玩家选择与运行时原因分轨

玩家选择和外部原因不能共用一份不可解释的“当前值”。建议分为两条通道：

#### 持久的玩家选择

```ts
entityPresentationSelections?: Record<EntityPresentationKey, string>;
```

- 只保存被选中的 addition `id`，不保存最终 `name`、`description` 或 `ThemeDef`；
- 缺少记录表示使用 `default`；
- 玩家恢复选择为 default 时删除记录；
- 作为偏好属于 Global，不进入 `InitSnapshot`；
- 所有写入经 `StateMutationService`，不允许 UI 直接改 PlayerState。

#### 临时或系统覆盖

剧情、事件或其他原因如需强制切换，使用独立的运行时覆盖层：

```text
runtime presentation override
  entityKey + optionId + owner + lifetime
```

- 临时覆盖不写入 PlayerState；
- 必须带 owner，支持剧情结束、区域切换、异常中断时定向清理；
- 优先级高于玩家选择，但清理后恢复玩家选择；
- 外部系统优先选择已声明的 option，不直接注入任意描述或任意 CSS；
- 需要永久改变时才通过 StateMutationService 写入持久选择。

建议最终解析优先级为：

```text
temporary runtime override
  > persistent player selection
  > entity presentation default
  > legacy field fallback
```

### 4. 与现有颜色系统的关系

当前 `entityThemeSlots`、`ThemeDesignDef`、ColorEquipment 和用户自定义主题已有独立来源，不能在第一步直接删除。建议分阶段收敛：

1. 新表现选项的 `override.theme` 接入 ColorSystem，作为明确选项的主题覆盖；
2. 未提供 `theme` 时继续使用现有 `resolveEntityTheme()` 回退；
3. 将 equipment、design、custom 等既有来源投影成统一的只读表现选项；
4. 统一当前选择入口，避免 `entityPresentationSelections` 与 `entityThemeSlots` 产生两个互相竞争的当前主题；
5. 待兼容桥移除后，再评估删除或收窄旧实体主题槽字段。

首版不得把旧主题系统整体重写成新的颜色系统，也不得把主题最终值复制到玩家状态。

### 5. Reveal 与信息安全

附加内容必须服从现有 Reveal 阶梯：

- 实体存在性未满足时不返回附加内容；
- 名称、描述和主题信息按当前已知级别门控；
- 未达到 `utility` 或对应可用阶段时，不得通过选项列表泄露额外描述、色彩或主题信息；
- 锁定选项可以显示“存在但不可用”的诊断时，必须遵守当前 Tooltip 的遮罩规则；
- 当前选项失效、被撤回或缺失时，Resolver 安全回退到 default，并返回可诊断的 source / fallback 信息。

### 6. P0 裁定记录（2026-09-18）

- `EntityPresentationValue.name` 表示最终面向玩家显示的名称。Area、Spot、Enhancement 使用现有 `name`；CharacterVariant 使用 `displayName`，缺失时回退到 `name`。实体标识仍由 Registry 的实体 ID 负责，不把显示名称当作 Key。
- `EntityPresentationValue.theme` 保持可选。缺少主题覆盖时，Resolver 委托现有 ColorSystem 解析默认主题、装备、设计和自定义主题，不创建第二套颜色解析器。
- `EntityPresentationDef.default` 是规范化后的必有基线；迁移期间允许输入侧继续使用旧字段，由 Registry/Resolver 形成 default，旧字段不与新字段并行竞争当前值。
- `additions` 是实体内的附加内容列表；每项 `id` 只需在所属实体内唯一，外部引用使用 `EntityPresentationKey + optionId`，不允许跨实体共享含义不明的裸 ID。
- `EntityPresentationKey` 首批固定为 `area:<id>`、`spot:<id>`、`enhancement:<id>`、`variant:<id>`；`init:<id>` 复用同一契约，但本阶段不承诺提供 Init 选择 UI。
- 玩家选择属于 Global 偏好，只持久化 `optionId`；运行时强制内容属于带 owner/lifetime 的临时覆盖，不写入 PlayerState。解析优先级固定为：临时覆盖 > 玩家选择 > default > 旧字段回退。
- `availableWhen` 只决定是否允许玩家选择；条件变化不会静默改写持久选择。当前选择失效时读取回退 default，条件恢复后可再次生效。

P0 的停点是：不在本阶段新增代码或状态字段；P1 必须据此落定共享契约、Registry 校验、Schema 生成与迁移期旧字段适配。

## 当前事实与代码落点

以下是本 Task 的立项基线，当前事实仍以源码和测试为准：

| 事实 | 当前落点 |
| --- | --- |
| Area / Spot 持有名称、描述与主题字段 | `src/data-services/contracts/world.ts` 的 `AreaDef`、`SpotDef` |
| Enhancement 持有名称、描述与主题字段 | `src/data-services/contracts/enhancement.ts` 的 `EnhancementDef` |
| Character 原型与 Variant 都持有描述，Variant 持有主题/色组 | `src/data-services/contracts/character-data.ts`、`src/data-services/contracts/character-variant.ts` |
| Theme 是颜色、Token、背景和 UI 表现的综合声明 | `src/engine/types/theme.ts` 的 `ThemeDef` |
| ColorSystem 已解析实体默认、装备、设计、自定义主题 | `src/arona-clicker/services/color-system.ts` 的 `resolveEntityTheme`、`entityThemeOptions` |
| 玩家已有实体主题槽与主题挂靠状态 | `src/arona-clicker/types/state.ts` 的 `entityThemeSlots`、`themeAttachments` |
| CharaProfile 负责名称/头像解析，不负责 Variant 描述 | `src/arona-clicker/services/chara-profile-resolver.ts` |
| 所有 PlayerState 写入必须经过单一入口 | `src/arona-clicker/state/state-mutation-service.ts` |
| UI 通过只读 View / Context 消费实体内容 | `src/arona-clicker/contracts/view.ts`、`src/ui/context.ts`、`src/ui/components/` |
| Runtime Editor 当前有 Spot 与 Init/Area 的不同范围，Enhancement 不在当前完整热 CRUD 范围 | `src/data-services/authoring/`、`src/arona-clicker/contracts/runtime-content.ts`、现行 Runtime Editor Task |

## 施工切片

### P0：语义裁定与 Key 规范

- [x] 固定 `EntityPresentationValue` 的三字段语义和 addition 局部覆盖规则。
- [x] 固定 `EntityPresentationKey` 的目标类型与命名空间，优先复用 `area:<id>`、`spot:<id>`、`enhancement:<id>`、`variant:<id>`。
- [x] 裁定 `availableWhen` 只做可用性门控，不做自动选中。
- [x] 裁定持久玩家选择为 Global，临时外部原因进入运行时 override。
- [x] 裁定首批 UI 目标为 Area、Spot、Enhancement、Variant；Init 只先接入契约与 Resolver。

### P1：Datapack 契约、Registry 校验与 Schema

- [x] 新增共享表现契约并接入世界、强化、角色 Variant 定义。
- [x] 规定 addition `id` 在实体内部唯一、格式稳定，`label` 仅用于选择 UI。
- [x] 校验 option 引用的 Theme / ColorGroup / Condition；未知 option 不得静默替换。
- [x] 为字段补齐 TSDoc、`@label`、必要的 `@ref`，执行 `npm run gen:schema`。
- [x] 更新 `engine-schema.sync.test.ts` 所覆盖的编辑器 Schema / `editor-extras.ts`；禁止手改生成产物。

### P2：只读 Resolver 与 View

- [x] 新增 `EntityPresentationResolver` 或等价服务，统一 default、addition、legacy fallback 与 source 诊断。
- [x] Resolver 只读输入为 Registry、PlayerState、Reveal 查询和 Condition 查询，不拥有 PlayerState 写引用。
- [x] 将 `name + description + theme` 的最终值加入适合的 `GameReadModel / UIContext` 查询面。
- [x] 在 `production`、`enhancements`、`contacts`、Tooltip 相关组件中替换直接读取字段的路径。
- [x] 保持没有 additions 时与现状完全一致。

### P3：玩家选择状态与写入口

- [x] 在 `PlayerState` 增加可选的 Global selection map，并在 `state-factory` 提供空默认值。
- [x] 增加只读 `options` / `resolve` 查询。
- [x] 增加 `setEntityPresentationSelection` / `clearEntityPresentationSelection` 命令。
- [x] 写入、校验、回退和失败结果全部经 `StateMutationService`。
- [x] 新增 `entityPresentationChanged` 事件并登记到 `EVENT_CATALOG`，驱动 UI 定向刷新。
- [x] 不新增 `PER_INIT_FIELD_SPECS` 项；该偏好不进入 Init 快照。

### P4：外部原因与临时覆盖

- [x] 建立 owner/lifetime 的 runtime override 容器，明确剧情结束、Area 切换、Init 切换和异常清理点。
- [x] 增加最小的 `setEntityPresentation` / `clearEntityPresentation` Effect 与请求事件，并沿用 P2/P3 的 Resolver 和事件边界。
- [x] 外部原因只引用已声明的 option；不允许效果层直接传入任意描述、主题 CSS 或 DOM 内容。
- [x] 覆盖清理后恢复玩家选择，并补充 owner 冲突、重复覆盖和失效 option 的诊断测试。

### P5：玩家选择 UI

- [x] 为 Area、Spot、Enhancement、CharacterVariant 提供统一的表现选项只读投影。
- [x] 选项显示 label、描述摘要、主题色板/代表色、当前态、可用态和来源。
- [x] 选择操作只发 GameCommand，不由组件直接写状态。
- [x] 与现有 `entity-theme-options` 建立明确适配层：表现内容选择同时切换名称/描述/主题，配色设计入口继续只负责颜色来源。
- [x] Reveal 未知时沿用现有遮罩；不可用 option 不读取其 value，UI 只显示占位。

### P6：默认内容、Runtime Editor 与文档收束

- [x] 正式默认 Datapack 在 `default-datapack.ts` 组合入口将当前 `name / description / theme`（`colorGroupId` 仍由既有 ColorSystem 回退）映射到 `presentation.default`。
- [x] 保留兼容桥期间，确定 `presentation.default` 优先、缺省时 legacy fallback 的确定性优先级；未引入存档迁移代码。
- [x] Runtime Editor 边界已固定：不扩大现有 Spot / Init / Area 热 CRUD；实体表现新增字段由 Datapack Schema 编辑器承载，Enhancement 不因本 Task 自动获得完整热 CRUD。
- [x] 完成默认 Datapack、测试 Datapack、authoring policy、Schema、UI 文案和机制文档同步。
- [x] 已将稳定语义蒸馏回 `docs/docs-828/`；本 Task 保留为实现记录，后续按文档维护规则归档。

## 测试与验收

### 契约与 Registry

- [x] default 始终可解析，空 additions 等价于当前行为。
- [x] duplicate option id、非法 Key、非法 Condition、非法 Theme 引用被拒绝。
- [x] `availableWhen` 未满足时选项不可选，且不会泄露受 Reveal 保护的内容。
- [x] 旧字段兼容输入与新 `presentation.default` 的优先级有明确测试。

### Resolver 与状态

- [x] addition 可只覆盖 name、description 或 theme，未覆盖字段正确回退。
- [x] 玩家选择只保存 option id，不保存最终文本或主题对象。
- [x] 选择、清除、未知 option、失效 option、重复选择均有结构化结果。
- [x] 选择变更经 StateMutationService 后正确更新事件、统计/缓存失效与 UI View。
- [x] Global 选择不随 Init 切换清除；旧存档按项目规则直接失效或由缺省字段安全构建，不新增迁移代码。

### 外部原因

- [x] 临时 override 优先于玩家选择。
- [x] Story / Area / Init 生命周期结束后能够按 owner 清理。
- [x] 清理后恢复玩家选择，异常中断不会残留主题或描述。
- [x] 外部 Effect 不能注入任意 CSS、HTML 或未声明文本。

### UI 与验证命令

- [x] Area、Spot、Enhancement、CharacterVariant 的卡片、Tooltip、详情页使用统一 Resolver。
- [x] 主题色、背景、Presentation 与描述切换不互相污染。
- [x] 运行 `npm run gen:schema`、Schema 同步测试、定向 Vitest、`npx tsc --noEmit`。
- [x] 机制完成前运行 `npm test` 与 `npm run check:architecture`。
- [x] 完成本地浏览器烟测：页面加载、区域解锁与进入世界线流程正常；选择器的可用/锁定/运行时覆盖行为由 UI 专项测试覆盖。

## 当前核验（2026-09-18）

- 已读取并核对：`docs/docs-828/00-INDEX.md`、架构上下文卡、状态分层、数据流、世界 / 色彩 / 角色模块卡、色彩派生、声明式 DSL、Schema 同步、架构纪律与文档维护规范。
- 已核对源码入口：`world.ts`、`enhancement.ts`、`character-data.ts`、`character-variant.ts`、`chara-profile.ts`、`theme.ts`、`color.ts`、`color-system.ts`、`chara-profile-resolver.ts`、`state.ts`、Runtime / View / UI 相关契约。
- P0 语义裁定已写入本 Task：显示名称映射、Key 命名空间、Global 选择、临时覆盖优先级与 `availableWhen` 行为已固定。
- P1 已完成：新增共享表现契约，接入 Init / Area / Spot / Enhancement / CharacterVariant，补充 Registry 静态与跨表主题引用校验，生成并同步编辑器 Schema。
- P1 核验通过：表现契约测试、Registry 回归测试、Schema 同步测试、Datapack Schema 测试、`npx tsc --noEmit` 与 `npm run check:architecture`。
- P2 已完成：新增只读 EntityPresentationService，接入 Visibility / Condition / ColorSystem，并将主要卡片、通讯录与 Tooltip 的名称和描述读取切换到 Resolver。
- P2 核验通过：Resolver、契约、Registry、生产 / 强化 / 通讯录 / Tooltip 定向测试与 `npx tsc --noEmit`。
- P3 已完成：Global 选择 map、StateMutationService 写入口、GameCommands、`entityPresentationChanged` 事件和 UI 刷新订阅已接通；状态只保存 optionId。
- P3 核验通过：实体表现服务、Trigger / StateMutation 定向测试、`npx tsc --noEmit` 与 `npm run check:architecture`。
- P4 已完成：运行时覆盖支持 owner/lifetime，Effect 只引用声明的 option；story、area、init 生命周期清理后恢复持久选择。
- P4 核验通过：实体表现服务与 EffectEngine 25 项定向测试、`npx tsc --noEmit` 与 `npm run check:architecture`。
- P5 已完成：统一选项选择器接入 Area、Spot、Enhancement、CharacterVariant；选择入口经 GameCommands，运行时覆盖时入口锁定，锁定 option 不展示描述内容。
- P5 核验通过：实体表现 UI 2 项专项测试、通讯录 UI 回归、`npx tsc --noEmit`。
- P6 已完成：正式默认 Datapack 组合入口已生成规范 `presentation.default`，并补充默认映射测试；Schema 重新生成并通过同步测试。
- P6 已完成：Runtime Editor 边界、默认 / 测试 Datapack、authoring policy、Schema、UI 文案和机制文档均已同步。
- 最终核验通过：`npm test`（172 个 Test Files、1600 个 Tests）、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、Schema 同步测试、Vite 临时生产构建。
- 本地浏览器烟测通过：应用可加载，区域可解锁并进入世界线，未出现可见运行时异常。
- 当前工作区已有其他未提交 UI 修改，本 Task 未触碰这些修改。

## 剩余工作

- [x] P0 语义裁定、P1–P6 实施切片、验收命令与实现边界均已记录。
- [x] Init 已纳入统一语义单元；现有 equipment / design / custom 主题来源仍由既有 ColorSystem 边界负责，未擅自投影为表现 option。
- [x] 当前机制文档、测试清单与计划文档已更新；AOCI 维护在最终工作区状态稳定后执行。

## 相关路由

- 当前机制入口：[[docs/docs-828/00-INDEX]]
- 架构纪律：[[docs/docs-828/05-conventions/architecture-discipline]]
- Schema 同步：[[docs/docs-828/05-conventions/schema-sync]]
- 状态分层：[[docs/docs-828/01-architecture/state-layers]]
- 数据流：[[docs/docs-828/01-architecture/data-flow]]
- 世界模块：[[docs/docs-828/02-modules/world]]
- 色彩模块：[[docs/docs-828/02-modules/color]]
- 角色模块：[[docs/docs-828/02-modules/character]]
- 色彩派生：[[docs/docs-828/04-mechanisms/color-derivation]]
- 声明式 DSL：[[docs/docs-828/03-data-structures/declarative-dsl]]
- 现有 Runtime Editor 统一服务：[[task-0076-unified-def-editor-service]]
- Init / Area 热 CRUD：[[task-0088-init-area-hot-crud-and-location-fallback]]
- Manager 旧语义退役：[[task-0079-chara-spot-link-retirement-and-redesign]]
