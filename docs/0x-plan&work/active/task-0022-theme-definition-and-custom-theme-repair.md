# 主题定义、默认主题与自定义主题问题清单

> 状态：第一阶段已落地，后续实现中（2026-09-06 核验）
>
> 范围：颜色组、颜色装备、主题设计、Area / CharacterVariant 声明主题、运行时主题层、用户自定义主题，以及 Affector 提供的主题编辑能力。

> 设计原则：收敛“解析方式”，不强行收敛“内容来源”。主题系统应允许数据包扩展和玩家创作，但任何来源都必须能够被识别、继承、预览和撤销。全局来源单选与用户主题应用边界由 [[docs/0x-plan&work/active/task-0027-theme-switch-cleanup-and-user-theme-isolation]] 进一步收束。

## 当前核验状态

第一阶段已由当前代码落地：系统默认主题常量、用户主题独立存储、编辑会话/draft、校验、预览、应用/禁用、表现目标编辑和对应测试均已存在。本文后续章节仍保留原设计与剩余问题，不应再理解为“全部尚未实施”。

尚未完成：自定义主题管理 UI、完整实体挂靠操作、跨 Datapack 主题冲突来源提示，以及旧 `EntityThemeSlot.customTheme` 的最终收束。

## 1. 结论摘要

当前系统已经使用三段式实体 ID：

```text
modName:typeName:idName
base:colorgroup:schale-solid
base:colorequipment:schale-badge
base:themedesign:example
```

三段式 ID 的格式和同一 Datapack 内重复会被 Registry 校验。但“主题定义唯一”目前并未完全成立：主题既可以来自 ColorGroup，也可以来自 Area / CharacterVariant 声明、ColorEquipment、ThemeDesign、运行时层、剧情临时层和用户主题层。

此外，“默认”不是一个注册到 Registry 的主题实体，而是 UI 针对不同对象动态生成的虚拟选项。因此多个页面出现“默认”并不代表重复 ID，但其实际 fallback 色值存在多处来源，存在漂移风险。

Affector 提供的“自定义主题”也不应继续表现为直接修改其他主题或覆盖已有主题定义。它应当生成一份独立、可追踪、可撤销的特殊主题存储记录，并允许该记录挂靠到 `base` 或其他明确的主题宿主。

## 2. 问题列表

### P0-1：主题实体 ID 唯一，但主题来源不唯一

当前已有以下来源：

- `ColorGroupDef`：色彩组、头像构成和主题 token；
- `AreaDef.theme`：区域声明默认主题；
- `CharacterVariantDef.theme`：学生差分声明默认主题；
- `ColorEquipmentDef.theme`：装备主题；
- `ThemeDesignDef.theme`：可收集主题设计；
- Runtime player / init / area / student 层，以及独立 user / preview / ephemeral 层；
- 剧情 `setTheme` 临时层；
- 用户自定义主题层。

这意味着实体 ID 的唯一性并不能保证“一个对象最终只有一份主题定义”。多个来源可以同时对同一对象提供主题，最后由优先级和合并顺序决定结果。

#### 修复意见

建立统一的主题解析入口，但不要把所有来源硬编码成不可变的全局优先级。解析器应区分“同一实体的来源优先级”和“不同作用域的层级优先级”：

```text
resolveEffectiveTheme(entityKey, state, runtimeLayers)
  1. 解析 entityKey 当前挂靠的来源
  2. 在同一实体内按 custom > design > equipment > declared-default 合并
  3. 使用 ColorGroup / baseThemeRef 补齐未声明字段
  4. 按 player / init / area / student 的运行时层级合并，user / preview 独立插入
  5. ephemeral 始终作为临时最高层
```

所有 UI、主题预览、主题说明、运行时注入都必须调用这一入口，不允许分别实现自己的来源优先级。这样既保留现有 `themeLayerOrder` 的可配置性，也避免自定义主题无条件压过所有场景主题。

解析结果应包含来源链，至少能说明：

```ts
{
  entityKey,
  sourceKind,
  sourceId,
  baseThemeId,
  overriddenTokens,
  inheritedTokens,
}
```

### P0-2：默认主题没有单一事实源

当前存在多处默认色值或默认 token fallback：

- ColorSystem fallback：`#4a7dff`；
- ThemeTree fallback：`#3b9eff`；
- UI CSS fallback：`#3b9eff`；
- 默认 ColorGroup `base:colorgroup:schale-solid`：`#3b9eff`。

这些值目前大多数情况下看起来一致，但只要某一调用路径没有拿到 ColorGroup，就可能出现不同默认主题。

#### 修复意见

引入唯一的系统默认主题定义，例如：

```ts
export const SYSTEM_DEFAULT_THEME = {
  id: 'system:theme:default',
  primary: '#3b9eff',
  ...
} as const;
```

要求：

- ColorSystem、RuntimeThemeManager、ThemeTree、controller-theme、CSS 兼容 fallback 均从同一来源读取；
- 不再在多个文件中散落 `#3b9eff` / `#4a7dff`；
- `base:colorgroup:schale-solid` 是可拥有、可激活的正式颜色组，不等同于系统默认主题；
- `activeTheme.kind = 'system'` 时明确解析为系统默认主题，而不是隐式依赖空层；
- CSS 中的 fallback 只作为加载失败时的最后保险，不再承担业务默认值的定义职责。

### P1-1：“默认”选项的语义没有统一

当前至少有两种“默认”：

1. 顶部颜色组选择器中的全局默认主题；
2. 某个 Area / CharacterVariant 主题槽中的声明默认主题。

它们都显示为“默认”，但实际作用域、来源和回退行为不同。

#### 修复意见

根据作用域明确命名：

- 全局颜色选择器：`系统默认`；
- 实体主题槽：`声明默认`；
- 主题设计回退：`设计默认`（仅在确有该语义时使用）。

UI 应同时显示作用域和来源，避免用户误以为所有“默认”指向同一主题实体。对于普通玩家，可以只显示短文案；在详情、预览或调试面板中显示完整来源链。

### P1-2：跨 Datapack 的重复实体 ID防护依赖外围约束

Registry 的重复检查主要发生在单个 Datapack 内。运行时表使用 Map 按 ID 写入，后加载定义可能覆盖先加载定义。

当前 PackManager 通过 `modName` 冲突限制降低了同 ID 覆盖风险，但直接调用 Registry 或绕过 PackManager 的装载路径仍可能产生后加载覆盖语义。

#### 修复意见

- Registry 在组合多个 Datapack 时增加跨包 canonical ID 冲突检查；
- 对确实允许覆盖的表建立显式覆盖策略，不再让 `Map.set` 默认承担覆盖语义；
- 冲突错误中显示两个来源包、实体 ID 和覆盖表名；
- 主题相关表（ColorGroup、ColorEquipment、ThemeDesign）默认禁止跨包同 ID 覆盖。

### P1-3：ColorGroup、ThemeDef 与 ThemeDesign 的边界仍然模糊

目前 `ThemeDef` 可以通过 `colorGroupId` 打底并由 `tokens` 覆盖。这个机制本身合理，但同样的主题 token 可能被复制到多个地方，导致：

- 一个主题在 ColorGroup 中有一份定义；
- Area 或学生中再次复制一份；
- ThemeDesign 又保存一份局部或全量覆盖；
- UI 难以区分引用、继承和复制。

#### 修复意见

- 主题内容优先使用 `colorGroupId` / `themeDesignId` 引用，不复制完整 token；
- 仅允许局部覆盖，并在数据结构中明确 `baseThemeRef`；
- ThemeDesign 记录“继承自谁”和“覆盖哪些键”；
- UI 展示继承链与最终解析结果，而不是只展示最终颜色。

## 3. 自定义主题专项问题

### P0-3：Affector 自定义能力不应直接修改其他主题

当前 Affector 开放的用户自定义主题能力容易被理解为：

```text
修改某个已有主题
或覆盖某个 ColorGroup / ThemeDesign 的 token
```

这会产生几个问题：

- 自定义值与原主题定义混在一起，无法判断谁修改了谁；
- 主题设计和装备的原始内容可能被用户覆盖；
- 更换 ColorGroup 或切换场景后，自定义修改的归属不清楚；
- 存档中无法稳定表达“这是用户创建的主题”还是“系统主题被改写”；
- 取消自定义、恢复原主题、复制到其他对象都缺乏明确语义；
- 同一个自定义主题可能被不同页面以不同优先级解释。

### 3.1 目标模型：独立特殊存储 + 明确挂靠

Affector 提供的能力应生成一份独立的用户主题记录，而不是写回 ColorGroup、ColorEquipment 或 ThemeDesign。

建议模型。这里有意把“继承基底”和“应用挂靠”拆成两个关系：前者回答“颜色从哪里补齐”，后者回答“主题应用到哪里”。

```ts
interface StoredCustomTheme {
  id: string;                    // 例如 user:theme:custom-001
  name: string;
  baseThemeRef?: {               // 可选：继承基底，不修改基底
    kind: 'system' | 'color-group' | 'theme-design';
    id?: string;
  };
  tokens?: Partial<ThemeTokens>;
  palette?: string[];
  nodes?: ThemeDef['nodes'];
  scopes?: ThemeDef['scopes'];
  background?: ThemeDef['background'];
  presentation?: ThemeDef['presentation'];
  createdAt: number;
  updatedAt: number;
}
```

挂靠关系单独存储：

```ts
interface ThemeAttachment {
  target: 'base' | string;        // base = 玩家全局宿主；或 area:/variant: 等实体
  customThemeId: string;
  enabled: boolean;
}
```

### 3.2 “可以挂靠给 base”的具体含义

`base` 不应被解释为“修改 base 包中的某个主题定义”，而应解释为一个明确的玩家全局主题宿主。它与 `baseThemeRef` 的含义不同：

- 自定义主题可以 `baseThemeRef = { kind: 'color-group', id: 'base:colorgroup:schale-solid' }`；
- 自定义记录仍然保持自己的 `user:theme:*` ID；
- 原始 `base:colorgroup:schale-solid` 不被写入或改变；
- 用户可以将自定义主题挂靠到全局 `base` 宿主，作为玩家层主题；
- 也可以挂靠到 Area、学生或其他允许的实体；
- 删除挂靠只会移除应用关系，不删除原始 ColorGroup；
- 删除自定义主题前必须清理或阻止仍存在的挂靠。

### 3.3 自定义主题的优先级

同一实体内建议采用以下来源顺序：

```text
用户自定义覆盖
  > ThemeDesign
  > ColorEquipment
  > 实体声明默认
  > ColorGroup / 系统默认
```

这是“同一实体内”的来源顺序，不取代 player / init / area / student 的层级排序；user / preview 独立插入，剧情临时主题仍然是运行时的最高层。自定义主题只能覆盖自身声明的字段。未声明的 token 必须沿 `baseThemeRef` 或实体默认主题继承，不能复制一份静态全量主题后独立漂移。

### 3.3.1 推荐的用户操作流

把自定义主题设计成“基于当前主题的可撤销创作”，而不是一个危险的全局修改器：

1. 用户选择一个基底主题，例如系统默认或 `base:colorgroup:schale-solid`；
2. 点击“创建自定义主题”，生成 `user:theme:*` 记录；
3. 编辑器只保存用户实际改动的字段，并在预览中显示“继承 / 覆盖”；
4. 用户选择挂靠到“全局 base”或某个 Area / 学生；
5. 应用后可随时解除挂靠，立即回到原基底，不破坏原主题；
6. 删除自定义主题前展示受影响的挂靠目标，并要求先解除或转移。

这条路径把“复制”“修改”“应用”拆开，既保留创作自由，也让恢复操作天然可逆。

### 3.4 自定义主题的写入纪律

- 只能通过专门的 `CustomThemeService` 或等价 StateMutationService 入口写入；
- UI 编辑器只能提交 draft，不得直接修改 PlayerState；
- Affector 只负责开放能力和提供入口，不直接写颜色组定义；
- 保存前校验颜色格式、token 名称、背景层和 presentation 结构；
- 自定义主题变更应发出专门事件，例如 `customThemeChanged`；
- 主题解析、预览和恢复都使用同一份 `StoredCustomTheme` 数据。

## 4. 建议的实现顺序

1. 固化系统默认主题单一来源，移除业务层中的分散 fallback 常量；
2. 统一主题解析入口并返回来源链，同时保留运行时层级配置；
3. 区分“系统默认”和“声明默认”文案与类型；
4. 增加跨 Datapack 主题实体冲突检查；
5. 增加 `StoredCustomTheme` 与 `ThemeAttachment` 数据结构；
6. 将 Affector 自定义主题改为独立存储，不再修改其他主题定义；
7. 将主题编辑器、主题预览、主题切换统一迁移到新解析入口；
8. 增加存档往返、主题继承、挂靠/解除挂靠、删除保护和重复 ID 测试。

## 5. 验收标准

- 所有注册颜色实体均使用三段式唯一 ID；
- 重复主题实体 ID 能在装载期报出来源包和冲突实体；
- 系统默认主题只有一个事实来源；
- UI 中“系统默认”和“声明默认”不再混用同一语义；
- Area、学生、全局主题切换显示明确的来源链；
- Affector 自定义主题不会修改任何 ColorGroup、ColorEquipment 或 ThemeDesign 原始定义；
- 自定义主题可独立保存、预览、挂靠、解除挂靠和恢复；
- 自定义主题可以以 `base:colorgroup:*` 为基底，但保留自己的 `user:theme:*` 身份；
- 未声明的自定义 token 会正确继承基底主题；
- 删除或失效的自定义主题不会留下悬空挂靠；
- 全量测试、类型检查、架构检查和构建通过。

## 6. 设计审查：避免僵硬实现

本方案不要求把所有颜色都重构成一种实体，也不要求删除现有 ColorGroup / ThemeDesign / Equipment 分工。它只要求三件事：

1. 来源可识别：知道当前颜色来自哪一层、哪一个 ID；
2. 继承可解释：知道未覆盖字段从哪里来；
3. 修改可撤销：用户自定义不会破坏原始定义。

以下内容应保持可配置，而不是写死：

- player / init / area / student 的层级顺序；
- 数据包是否提供自己的 ColorGroup 或 ThemeDesign；
- 自定义主题的基底类型；
- 自定义主题可以挂靠的宿主范围；
- UI 是否展示完整来源链（普通视图简化，详情视图展开）。

以下内容应保持不可含糊：

- 三段式 ID 的格式；
- 系统默认主题的唯一来源；
- 原始数据包定义不可被用户主题回写；
- 自定义主题必须具有独立身份；
- 主题解析必须经过统一入口；
- 删除、解除挂靠和恢复默认必须是可预测且可逆的操作。

## 7. 当前相关代码与文档

- `src/data-services/registry/registry-validate.ts`：实体 ID 和 Datapack 静态校验；
- `src/data-services/registry/registry.ts`：ColorGroup / ColorEquipment / ThemeDesign 注册表；
- `src/arona-clicker/services/color-system.ts`：主题解析、默认来源和实体主题选项；
- `src/engine/core/theme-runtime.ts`：player / init / area / student / user / preview / ephemeral 运行时层；
- `src/ui/theme-tree.ts`：UI 主题树与 fallback；
- `src/ui/components/header.ts`：全局“默认”颜色选择器；
- `docs/docs-828/04-mechanisms/color-derivation.md`：主题派生和合并规则。

## 8. 第一阶段落地记录

- 增加 `SYSTEM_DEFAULT_PRIMARY`，业务层默认主题 fallback 统一从该常量读取；CSS 中的同值仅保留为最后保险；
- 顶部颜色选择器使用“系统默认”，实体主题选项使用“声明默认”；
- 增加 `StoredCustomTheme`、`ThemeAttachment` 与 `PlayerState.customThemes / themeAttachments`；
- 现有 Affector 编辑器保存时同步生成 `user:theme:default` 独立记录，并挂靠到 `base`；
- 禁用用户主题只关闭 `base` 挂靠，保留自定义主题记录；
- 实体主题解析增加来源链，并支持独立自定义主题以 ColorGroup 或 ThemeDesign 为基底；
- 后续由 task-0027 收束为 `customThemes` 唯一内容源与 `activeTheme` 全局来源；本条“保留 `userTheme.applied` 兼容投影”的阶段性方案已被替代。
- 增加独立存储、base 挂靠、禁用不删除、实体自定义不污染 ColorGroup 的测试。

后续仍需处理：自定义主题管理 UI、完整的实体挂靠操作、跨 Datapack 主题冲突的来源提示，以及旧 `EntityThemeSlot.customTheme` 向独立记录的逐步收束。

