# Talklet 演出表现升级草案

状态：设计草案（2026-09-09）

> 本文合并 Sol 的建议与当前 ACProgram 主题运行时、Talklet、Area、Presentation Host 现状，目标是从“玩法作者如何表达演出意图”出发，规划一套可叠加、可局部覆盖、可自动恢复的表现系统。

## 1. 目标与非目标

### Lite 落地边界

在完整的 Theme / Layout / Content / Effect 演出系统确定前，建议先提供一个 Talklet-Theme Lite 版本，作为最小可用的主题临时覆盖能力。Lite 只解决四件事：

- 通过稳定的生效 ID 管理一组临时主题配置；
- 指定使用哪个主题；
- 指定主题保持多久；
- 指定主题影响哪些表现元件范围。

Lite 不预设 DSL 语法，不扩展完整的布局、立绘、特效和交互协议，也不要求一次性建立完整的 Presentation Resolver。它应能作为后续完整表现系统的一个兼容子集。

### 目标

- 允许 Talklet 在演出过程中临时改变主题氛围、布局状态、立绘内容、UI 交互与一次性特效；
- 允许 Area 提供默认场景表现，并被 Talklet 局部覆盖；
- Talklet 结束、跳过、跳转、异常中断或切换 Area 后，临时表现自动恢复；
- 让数据包作者描述“危险、聚焦、角色登场”等演出意图，而不是写 CSS 变量、DOM 选择器或像素值；
- 保持现有 `presentation-host-target`、`panel-tabs-region` 和 Panel 边界契约可复用。

### 非目标

- 不把所有表现内容合并为一个巨大 `setTheme()` 对象；
- 不让剧情脚本直接操作 DOM、CSS selector 或任意 CSS 属性；
- 不在第一阶段实现完整 VN 编辑器、粒子引擎或音频编排系统；
- 不改变现有玩家持久化主题、Area 主题槽和 ColorGroup 的基本语义。

## 2. 从玩法出发的核心模型

最终 UI 表现由多个来源按字段合并得到：

```text
基础 UI
  + 玩家全局主题
  + Init 默认表现
  + Area 默认表现
  + Spot / 功能界面表现
  + 当前学生或对话表现
  + Talklet 持续覆盖
  + Talklet 单次特效
```

核心原则：

1. 后层只覆盖自己声明的字段，不替换整个前层；
2. 持续状态与一次性事件分离；
3. 所有临时状态绑定 StoryEntry execution 生命周期，并通过统一 disposal 路径清理；
4. 表现层只消费只读解析结果，UI 不持有剧情写引用。

Lite 模型只引入一个临时主题配置记录：

```text
生效 ID + 主题 + 生效时期 + 作用元件范围
```

同一个生效 ID 再次设定时，直接重写该 ID 当前对应的配置，不额外叠加新的匿名层。这样可以让玩法逻辑反复更新同一个演出状态，而不需要先清除旧配置。

Lite 的生效时期包括：

| 生效时期 | 语义 | 结束条件 |
| --- | --- | --- |
| `fulltime` | 在所属 StoryEntry execution Owner 内持续有效 | 定向撤回、Owner 全部撤回或 execution disposal |
| `areatime` | 在所属 Owner 内且绑定指定 Area | 定向撤回、离开绑定 Area 或 execution disposal；离开后不自动恢复 |
| `seconds` | 从设定时刻起维持指定秒数 | 到期自动撤回 |
| `step` | 维持指定数量的后续实际完成 Talklet | 从设置后的下一次 Talklet completion 开始递减，达到零时自动撤回；隐藏的配置 Talklet 也计入步数 |

`step` 统计的是 Talklet 数量，而不是屏幕上可见的消息数量。设置主题的 Talklet 不消耗自己的 step；被 Jump 跳过的 Talklet 不计数；`goto`、`insert` 和 `insert return` 不改变 Owner、不重置计数；Skip 不模拟剩余 Talklet，而是直接清理 Owner。

Lite 的“作用元件范围”应引用稳定的语义元件或 Presentation Host，而不是 CSS selector。范围可以覆盖主题宿主、区域背景、对话区域或后续登记的演出元件，但不直接规定具体 DOM 结构。

Lite 的运行时配置隐式绑定一次 `StoryEntry` execution Owner，而不是绑定 `StoryDef`。`goto`、`insert` 和 `insert return` 只改变同一执行上下文中的流转；只有显式撤回、生命周期到期、Area 离开或统一的 execution disposal 才会清理对应临时主题。

## 3. Theme 与 Presentation 的边界

“主题”不应继续承担所有表现职责。建议拆成四类，但允许由同一个 Talklet 指令统一声明：

| 子系统 | 负责内容 | 示例 |
| --- | --- | --- |
| `ThemePresentation` | 色彩、纹理、字体、surface、radius、装饰 | 危险红、夜景、玻璃面板 |
| `LayoutPresentation` | 区域尺寸、显隐、折叠、排列、聚焦 | 左栏收起、中栏扩大、右栏进入立绘模式 |
| `ContentPresentation` | 立绘、背景、头像、舞台素材 | Noa 立绘、表情、背景前景层 |
| `EffectPresentation` | 闪白、震动、滤镜、淡入淡出、粒子 | 红色柔闪、屏幕震动、转场 |

统一入口可以是：

```ts
interface PresentationPatch {
  theme?: ThemePatch;
  layout?: LayoutPatch;
  content?: ContentPatch;
  interaction?: InteractionPatch;
  effects?: PresentationEffect[];
}
```

这不是要求底层只保留一个服务，而是要求 Talklet 作者有一个易用的演出入口。

## 4. 表现层级与字段合并

建议采用语义层级，而不是简单的“整层替换”：

```ts
enum PresentationLayer {
  Base = 0,
  Init = 100,
  Area = 200,
  Spot = 300,
  Function = 400,
  Story = 500,
  Effect = 600,
  Debug = 1000,
}
```

当前项目已有 `player / init / area / student / ephemeral` 主题层。建议兼容保留，并把新系统映射为：

| 草案概念 | 当前实现对应 |
| --- | --- |
| 玩家全局主题 | `player` / `user` |
| Init 默认表现 | `scene(init)` |
| Area 默认表现 | `scene(area)` |
| 学生表现 | `scene(student)` |
| Talklet 持续覆盖 | `ephemeral` 或新增带目标的 Story Layer |
| Talklet 单次特效 | 独立 Effect Player |

合并必须是字段级的：

```text
Area:   center.surface = sand
Spot:   right.emphasis = focus
Talklet: left.visibility = hidden
Effect: screen.filter = grayscale
```

最终只得到：

```text
center.surface = sand
right.emphasis = focus
left.visibility = hidden
screen.filter = grayscale
```

不能因为 Talklet 只修改左栏显隐，就替换整个 Area Presentation。

## 5. Talklet 作者接口

Talklet 作者接口暂不确定具体 DSL 语法。本节只规定未来接口应能表达的意图：预设、主题氛围、区域布局、内容 Slot、交互策略、生命周期和一次性特效。具体字段名称、嵌套形式和 Builder API 留待 DSL 设计阶段单独裁定。

Talklet 只应表达：

- 当前氛围是什么；
- 哪些区域应该聚焦、收起或隐藏；
- 哪个角色以什么状态登场；
- 玩家当前可以做什么；
- 播放什么一次性效果。

不表达：

- `.left-panel`；
- `width: 263px`；
- `background-color: #9f2835`；
- `document.querySelector(...)`；
- 任意 CSS selector。

## 6. Theme Patch：表达氛围而非绑定具体色值

Talklet 通常不应该直接切换整套主题，而应表达“危险、紧张、忧郁、聚焦”等语义意图。具体语法和语义字段仍未确认。

由当前 Area 主题解释这些语义：

```text
Abydos + mood=danger     → 沙尘红
Millennium + mood=danger → 电子警报红
Schale + mood=danger     → 蓝白警戒色
```

底层仍应允许高级内容包使用受控 token 覆盖，但默认作者接口应优先使用：

```ts
type ThemePatch = {
  mood?: 'calm' | 'warm' | 'melancholy' | 'danger' | 'urgent' | 'mysterious';
  emphasis?: 'quiet' | 'normal' | 'high';
  temperature?: 'cool' | 'neutral' | 'warm';
  tokens?: Partial<Record<ThemeToken, string>>;
  nodes?: Partial<Record<ThemeNodeName, string>>;
  background?: BackgroundLayerDef[];
  presentation?: PresentationDef;
};
```

`tokens` 和具体颜色应是高级覆盖能力，不应成为 Talklet 的主要写法。

## 7. Area 默认表现与临时覆盖

必须区分：

| 语义 | 例子 | 生命周期 |
| --- | --- | --- |
| Area 声明默认 | 夏莱天台默认晚霞 | 内容定义 / 当前场景 |
| Area 持久自定义 | 玩家为某 Area 选择主题设计 | 存档持久化 |
| Area 临时覆盖 | Talklet 期间天台进入警戒状态 | Talklet / Story |
| Area 状态变体 | 白天、夜晚、完成剧情后 | 由状态解析 |

当前 `setTheme({ scope: 'area' })` 会写入 `entityThemeSlots['area:<id>']`，属于持久化自定义，不应直接用于临时演出。

建议新增独立接口：

```ts
interface AreaPresentationOverride {
  id: string;
  areaId: AreaId;
  patch: PresentationPatch;
  lifetime: PresentationLifetime;
}

interface PresentationHandle {
  id: string;
  owner: string;
}

interface PresentationRuntimePort {
  pushAreaOverride(areaId: AreaId, patch: PresentationPatch, owner: string): PresentationHandle;
  replace(handle: PresentationHandle, patch: PresentationPatch): void;
  clear(handle: PresentationHandle): void;
}
```

不能简单复用当前 `pushSceneTheme({ scope: 'area' })`：当前场景管理是“同 scope 替换”，而且 UI 的 `syncRuntimeTheme()` 会重建 Area 层，临时覆盖需要单独的可恢复栈或 handle。

## 8. Layout Presentation：只用语义状态和 Preset

区域布局应使用语义状态，不允许 Talklet 直接写像素：

```ts
type RegionSize =
  | 'hidden'
  | 'collapsed'
  | 'compact'
  | 'normal'
  | 'expanded'
  | 'dominant'
  | 'overlay';

interface LayoutPatch {
  preset?: PresentationPresetId;
  regions?: Partial<Record<PresentationRegionId, {
    size?: RegionSize;
    visibility?: 'visible' | 'hidden' | 'collapsed';
    emphasis?: 'normal' | 'dim' | 'focus';
  }>>;
}
```

第一批建议 Preset：

```text
normal
dialogue
dialogue-left
dialogue-right
character-focus
scene-focus
combat-alert
system-message
fullscreen-story
cinematic
```

当前实现可继续使用 `left / center / right`，但 Talklet 数据最好使用语义别名，例如 `dialogue`、`portrait`、`utility`。这样未来从桌面三栏切换到移动端单列时，不需要重写剧情数据。

## 9. Presentation Region 与 Host

建议把当前 UI 的物理栏位和剧情语义区域分开：

```ts
type PresentationRegionId =
  | 'primary'
  | 'secondary'
  | 'detail'
  | 'dialogue'
  | 'portrait'
  | 'utility';
```

同时保留当前 `leftPanel / centerPanel / rightPanel` 作为实际布局映射。

当前 `presentation-host-target` 应逐步补充语义角色：

```ts
type PresentationHostRole =
  | 'panel'
  | 'panel-header'
  | 'panel-body'
  | 'tabs'
  | 'tab'
  | 'button'
  | 'dialogue'
  | 'portrait-stage'
  | 'overlay';
```

这样主题编辑器可以展示：

```text
Panel
Panel Header
Tabs
Tab
Button
Dialogue
Portrait Stage
Overlay
```

而不是让 Talklet 或主题数据依赖 CSS 类名。

## 10. Content Presentation：立绘使用独立 Slot

立绘不应被建模成 `rightPanel.background-image`，而应进入独立舞台：

```ts
interface PortraitSlot {
  id: string;
  character?: VariantId;
  asset?: string;
  expression?: string;
  pose?: string;
  anchor?: 'left' | 'center' | 'right';
  scale?: number;
  enter?: TransitionPresetId;
  exit?: TransitionPresetId;
  layer?: number;
}
```

建议舞台层级：

```text
portrait-stage
├── background
├── back-decoration
├── portrait-left
├── portrait-center
├── portrait-right
├── front-effect
└── UI
```

第一阶段只需要单一 `main` Slot，但数据模型应允许以后增加双人立绘、表情切换、移动和前后景。

## 11. State 与 Event 分离

持续表现状态应通过带 owner 和生命周期的表现层管理；一次性闪白、震动、滤镜和转场应通过独立的特效播放通道管理。本文不预设这两个通道的具体调用语法。

不能把一次性的震动、闪白和持续的“屏幕变暗”放在同一种状态接口中，否则无法定义动画结束后的恢复语义。

推荐生命周期：

```ts
type PresentationLifetime =
  | 'instant'
  | 'step'
  | 'scene'
  | 'talklet'
  | 'story'
  | 'until-area-change'
  | 'explicit';
```

临时层必须绑定：

```text
Story Session / Talklet Session
```

无论正常结束、Skip、Jump、异常终止、切换 Area 或 Save/Load，都必须有统一清理路径。

## 12. 交互状态与 Interaction Lock

应区分：

| 状态 | 含义 |
| --- | --- |
| `hidden` | 不渲染或不可见 |
| `disabled` | 显示但不能操作 |
| `blocked` | 显示且可点击，但由剧情系统拦截 |
| `dim` | 仍可操作，但视觉弱化 |

Talklet 不应通过隐藏所有按钮实现“只能点击继续”。建议独立提供：

```ts
interface InteractionPatch {
  mode?: 'free' | 'story-lock' | 'modal-lock';
  allow?: string[];
  block?: string[];
}
```

例如，未来可以表达“当前进入剧情锁定，只允许推进或跳过剧情”的交互意图；具体 DSL 形式暂不规定。

这会比逐个给按钮设置 `disabled` 更可靠，尤其适合 Story、Spot、Shop、Passive Talk 并存的场景。

## 13. 动画与特效 Preset

剧情数据应引用动画 Preset，而不是填写 CSS 参数。可以支持立绘柔和入场、场景溶解、危险柔闪等语义 Preset；具体 DSL 形式暂不规定。

主题或 UI 层负责解释：

```text
portrait-soft
→ fade + slide

scene-dissolve
→ blur + dissolve
```

这样主题可以改变同一个语义 Preset 的视觉实现，而不需要改剧情数据。

## 14. Talklet 生命周期与句级控制

建议支持 Talklet 级、单句级、场景级和显式清除等生命周期语义。表现层 ID、清除操作和具体 DSL 形式暂不规定。

运行时应自动绑定 Talklet 实例 ID：

```ts
interface PresentationScope {
  owner: string;
  layerId: string;
  patch(patch: PresentationPatch): void;
  play(effect: PresentationEffect): void;
  dispose(): void;
}
```

Talklet 结束时统一 `dispose()`，避免“跳过剧情后右栏永久消失”这类状态残留。

## 15. 运行时接口需求

建议最终形成以下服务边界：

```ts
interface PresentationService {
  openScope(options: {
    owner: string;
    layer: PresentationLayer;
  }): PresentationScope;

  applyPatch(scope: PresentationScope, patch: PresentationPatch): void;
  clear(scope: PresentationScope): void;
  playEffect(effect: PresentationEffect): void;

  resolve(): ResolvedPresentation;
  resolveHost(host: PresentationHostId): ResolvedHostPresentation;
}
```

与当前系统的衔接：

```text
Talklet / Effect
  → themeEffectRequested 或新的 presentationEffectRequested
  → RuntimeEffectReactor
  → PresentationService
  → runtimeTheme / resolved presentation
  → UIController.applyTheme / layout refresh / effect player
```

Talklet 不应直接调用 `document`、`UIController` 或 CSS API。

## 16. 事件接口需求

当前 `themeChanged` 表示玩家持久主题选择变化，不足以通知所有运行时表现变化。建议增加：

```ts
interface RuntimePresentationChangedEvent {
  type: 'runtimePresentationChanged';
  owner: string;
  reason:
    | 'push'
    | 'patch'
    | 'clear'
    | 'effect'
    | 'area-entered'
    | 'story-ended';
  affectedRegions?: PresentationRegionId[];
  affectedHosts?: string[];
}
```

UI 只需根据事件选择轻量更新或完整重建：

- 仅 Theme Host 变化：刷新 CSS 变量和表现背景；
- Layout 变化：刷新布局结构；
- Content Slot 变化：刷新舞台内容；
- Effect 变化：交给 Effect Player，不重建整个 UI。

## 17. 当前代码需要补齐的接口缺口

### 已存在，可复用

- `ThemeLayer` 与 `RuntimeThemeManager` 的分层合并；
- `PresentationDef`、`PresentationHostDef`、host state；
- `ThemeEffectValue` 的 `colorGroupId / palette / tokens / nodes / background`；
- `themeEffectRequested` 事件；
- `presentation-host-target` 与 `renderPresentationHostBackground()`；
- Area 的 `ThemeDef` 与 `entityThemeSlots`。

### 需要扩展

1. `ThemeEffectValue` 增加 `id`、`lifetime`、`presentation`、目标区域和 Patch 语义；
2. Talklet 增加可复用的 `presentation` 字段或独立 `presentation` Effect；
3. `RuntimeThemeManager` 增加可恢复的 handle / owner / scope 生命周期；
4. 为 Area 临时覆盖增加独立运行时层，不能写入持久化 `entityThemeSlots`；
5. 补充 `PresentationService`，管理 Theme、Layout、Content、Interaction、Effect 的统一 scope；
6. 增加运行时表现变化事件；
7. 增加语义 Region、Host Role 和 Presentation Preset Registry；
8. 增加 Save/Load、Skip、Jump、Area 切换时的自动清理测试。

## 18. 推荐落地顺序

### Phase 1：生命周期与 Theme Patch

- 将当前 `story-ephemeral` 改为可按 owner/id 管理；
- 补齐 Talklet 级别的 `presentation` / `lifetime`；
- 增加运行时表现变化事件；
- 完成 Area 临时覆盖的可恢复模型。

### Phase 2：Preset 与 Layout State

- 建立 `PresentationPreset`；
- 建立 `RegionSize`、显隐、强调状态；
- 先支持 `normal`、`dialogue`、`dialogue-character-right`、`fullscreen-story`；
- 保持桌面 `left / center / right` 映射不变。

### Phase 3：Content Stage

- 引入 `portrait-stage`；
- 先实现单一 `main` 立绘 Slot；
- 支持角色、表情、进出场 Preset；
- 再扩展双人和多层舞台。

### Phase 4：Interaction Policy 与 Effect Player

- 增加 Story Lock；
- 区分 hidden / disabled / blocked / dim；
- 增加闪白、震动、滤镜和转场 Preset；
- 让特效不触发不必要的 DOM 全量重建。

### Phase 5：编辑器与数据包作者体验

- 主题编辑器展示语义 Host；
- Presentation Preset 可查询、可预览；
- 对 Talklet 提供 Builder API；
- 补充数据包 Schema、校验和开发期诊断。

## 19. 五条硬规则

1. Theme 不直接拥有业务状态。
2. Talklet 不直接操作 DOM 或 CSS selector。
3. 临时表现必须存在 scope / layer，并能自动撤销。
4. 区域布局使用 semantic state / preset，不使用剧情硬编码 px。
5. 外观、布局、内容、动画、交互锁彼此独立，但允许由同一个 Presentation 指令统一声明。

## 20. 最终关系

```text
Game State
    │
Area / Spot / Story
    │
    ▼
Presentation Layers
    ▲
    │
Talklet / Effects
    │
    ▼
Presentation Resolver
    │
    ├── Theme Resolver
    ├── Layout Resolver
    ├── Content Stage
    ├── Interaction Policy
    └── Effect Player
            │
            ▼
             UI
```

`panel-tabs-region` 可以作为第一个正式的 `PresentationHost` 落点，随后逐步纳入 `panel-header`、`panel-body`、`button`、`dialogue` 和 `portrait-stage`，避免 Talklet 表现需求到来时再次进行结构迁移。
