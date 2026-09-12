# task-0048 — Workspace Theme 体系重构与编辑器改造

> 来源：Sol 提供的《Workspace Theme 体系重构与编辑器改造》草案。
>
> 状态：🟡 P0 首轮诊断、P1 摘要卡和 P2 Workspace owner 首版接线已完成；来源链 UI、目标目录和全生命周期回归仍在推进。本文记录范围、施工切片、验收口径和后续 ADR 门槛，不替代 `docs/docs-828/` 机制正文。
>
> 核查基准：2026-09-12 当前工作树。若本文与源码不一致，以源码和 `docs/docs-828/` 当前事实源为准。

## 0. 任务卡

| 项目 | 内容 |
| --- | --- |
| 任务类型 | UI/Theme 表现层工作计划 |
| 目标 | 在不引入平行 Theme Schema 的前提下，收敛编辑器信息架构、来源诊断、Workspace 目标和临时主题生命周期 |
| 当前阶段 | P0 已完成首轮诊断切片；P1/P2 已开始首版接线 |
| 前置依赖 | `task-0040` Workspace Frame、`task-0045` Workspace 隔离、`roadmap-0014` 编辑器收敛、`roadmap-0016` 簇/区域上下文 |
| 暂不裁定 | `ThemeDef.parent`、Palette previous slot、Cluster inherited/detached、独立 ThemeApplication 注册表 |
| 持久化原则 | 不新增存档迁移；编辑器 draft 只保存用户意图，解析结果不落 PlayerState |

## 0.1 完成定义

本任务完成不等于完成 Parent Theme 体系。完成定义是：

- 编辑器默认入口变为摘要/目标选择，复杂配置按需进入 Inspector；
- 颜色和表现项可见最终值、来源、目标和清除后的回退；
- Workspace、slot、region、component 目标不会跨 Workspace 串扰；
- Story、Talklet、Shop 和页面临时层按 owner/lifetime 清理；
- Preview 不污染真实运行时主题；
- Parent/Cluster 等新机制若仍有必要，形成独立 ADR，而不是在本任务中隐式落地。

## 1. 核查结论

原草案准确抓住了两个真实问题：

1. 主题编辑器需要降低默认认知负担，并同时展示最终值、来源和作用范围。
2. 主题的定义、运行时叠加、Workspace/Region 目标和临时演出生存期需要继续收束，避免页面自行保存和恢复旧主题。

但原草案把部分目标设计写成了“现有系统应当已经如此”，并且把几种不同的继承混在了一起。当前系统不是“没有 Theme 生命周期”，而是已经有一套以 `ThemeDef`、`ThemeLayer`、`RuntimeThemeManager`、`PresentationHost` 和 `themeScope` 为基础的渐进式模型；缺少的是更统一的定义继承、来源展示和应用目标协议。

本草案据此作以下边界裁定：

- 继续沿用当前 `ThemeDef` / `ThemeLayer` / `ResolvedTheme` / `PresentationDef` 基础，不另起一套平行 Theme Schema。
- 主题定义的母主题、簇级脱离和 Palette previous 暂不视为已确定机制，必须单独形成 ADR 后再施工。
- 编辑器优先做信息架构和来源可视化收敛；不因重做 UI 而同时重写全部主题解析算法。
- Workspace 作用范围优先复用现有 Host、Region 和 `themeScope` 语义，不开放任意 CSS Selector。
- 临时层继续走 owner/lifetime 清理；不要新增“保存旧主题—恢复旧主题”的全局快照协议。

## 2. 当前实现事实

### 2.1 Theme 定义不是单一对象

当前 `ThemeDef` 位于 `src/engine/types/theme.ts`，主要包含：

- `colorGroupId`、`palette`、`tokens`、`nodes`；
- `background` 与 `backgroundVariants`；
- `presentation`，其下包含区域图层、组件、面板和 `PresentationHost`。

Theme 来源同时包括 ColorGroup、Area/CharacterVariant/Init/Enhancement 声明主题、ColorEquipment、ThemeDesign、用户自定义主题，以及运行时场景层和临时演出层。因此，当前不存在“一个 Theme ID 对应全部视觉定义”的单一来源模型。

### 2.2 当前已有两种不同的叠加关系

运行时 `ThemeLayer` 由 `RuntimeThemeManager` 维护，默认涉及 `player → init → area → student` 四个可排序场景层，并另有 `user`、`preview` 和最高优先级的 `ephemeral` 层。

`ResolvedTheme` 会合并 token、palette、语义节点、作用域节点、背景和 presentation。当前合并规则是：

- token 按 key 覆盖；
- palette 取高层非空色板；
- node 和 scope override 按节点/作用域覆盖；
- 有 ID 的背景层和表现目标按 ID 覆盖，匿名层追加；
- 同一 `PresentationHost` 的字段和状态目前执行字段级合并。

这套运行时层叠不是 Theme Definition 的 parent inheritance。两者必须保持概念分离。

### 2.3 Palette 已有六色与自动派生，但没有 previous slot

当前用户主题色板最多六色。主题节点通过 palette、ColorGroup slots 和显式节点覆盖派生；色板不足时按既有优先级回退，颜色系统还会生成背景、文字、边框、气泡等 token。

当前没有 `Color 4 = previous` 这样的颜色来源类型，也没有从前一色槽递归解析的协议。`previous theme color` 如果继续保留，应改名为 `previous palette slot` 或其他不会与运行时主题层混淆的名称，并另行裁定其数据结构、循环校验和编辑器表达方式。

### 2.4 Workspace/Region 语义已经存在，但不是 ThemeApplication 注册表

三栏 Workspace 已通过 `WorkspaceFrame`、列元数据、`UIHostRegistry` 和 `themeScope` 接线。当前代码中已经存在类似：

```text
left.contacts.navigation
center.contacts.main
right.contacts.inspector
left.shop.feed
center.shop.catalog
right.shop.settlement
```

`PresentationRegion` 和 `PresentationHost` 也提供了稳定的游戏侧目标枚举。当前并不存在草案所描述的独立 `ThemeApplication { workspace, regions, components, owner, priority }` 数据模型；临时演出层的目标过滤和 Talklet owner/lifetime 是相近但不同的运行时能力。

### 2.5 当前编辑器已经有分区和来源提示，但仍偏“大表单”

`src/ui/components/user-theme-editor.ts` 已经有“颜色 / 控件背景图层 / 其他内容”三个内容区、左侧筛选器、palette、token、node、scope、背景和目标编辑入口，也已有 `tokenSource`、`nodeSource`、`scopeSource` 等来源文案。

因此，“把编辑器从零改成 Layer List + Modal/Inspector”不是准确的现状描述。更准确的目标是：保留已有分区和统一表现目标基础，把默认视图改成摘要卡片，把复杂字段移入按目标打开的 Inspector，并补齐最终值、来源链、覆盖范围和回退行为。

### 2.6 临时主题已经有部分生命周期治理

剧情演出主题通过 `pushEphemeralTheme` / `popEphemeralTheme` 管理；Talklet 临时主题记录 owner、effect、目标和 lifetime，并支持完成、区域变化和 Story dispose 时清理。场景主题通过 `pushScene` / `popScene` 按 scope 管理。

因此“完全没有 owner 生命周期”不成立；仍需核查和收口的是所有页面、Story、Talklet、Shop 等入口是否都使用同一套 owner/lifetime 语义，以及是否还存在页面私自保存旧主题的遗留逻辑。

## 3. 对原草案主要主张的判定

| 原草案主张 | 事实判定 | 本草案处理 |
| --- | --- | --- |
| Theme 编辑器应从大型展开表单转为摘要 + Inspector | 基本成立 | 纳入编辑器路线，沿用现有三类内容区和目标模型 |
| Theme 可指定单层 Parent | 当前不存在 | 作为独立 ADR 候选，不在本草案中实现 |
| Palette 可字段级继承 | 当前只有 ColorGroup/baseThemeRef 等间接打底 | 可作为 Parent ADR 的候选规则，不能当作当前能力 |
| Color 1~6 支持 previous slot | 当前不存在 | 暂缓；先明确 palette slot 的来源模型和循环诊断 |
| Background/Panel/Controls 等整簇 inherited/detached | 当前 Host/presentation 是字段级合并 | 不直接替换现有合并；先建立目标粒度和显式覆盖语义 |
| Detached Cluster 仍使用子主题 Palette | 设计上合理 | 若未来采用 cluster detach，必须作为独立解析维度写入 ADR 与测试 |
| Theme Definition 与 Theme Application 分离 | 方向成立 | 复用 ThemeDef 与运行时 layer；是否新增 Application 对象另行裁定 |
| Scope 至少有 Workspace/Left/Center/Right | 方向成立，当前已有更细的 themeScope | 优先把 Workspace、slot、region、component 组成稳定目标键 |
| 页面应以 owner 注册临时主题 | 方向成立且已有部分实现 | 补齐入口盘点、清理契约和诊断；不新增全局 restore |
| Parent 删除应显示依赖并禁止静默回退 | 仅适用于未来 Parent 模型 | 随 Parent ADR 一起裁定 |
| Preview 不应污染真实主题 | 已基本成立 | 保持 `setPreview` 独立层，补 Preview root/销毁和回归测试 |
| Theme 不负责布局和业务内容 | 成立 | 作为不可破坏边界保留 |
| Scope 不开放任意 CSS Selector | 成立 | 只允许游戏提供的稳定 Host/Region/Component 枚举 |

## 4. 本轮确定的方案方向

### 4.1 先收敛编辑器，再裁定新继承模型

第一阶段目标不是一次性引入 Parent、Cluster detach 和 ThemeApplication，而是让现有系统可理解、可诊断、可继续演进：

1. 主视图显示 Theme 摘要：名称/基底来源、palette 状态、已配置目标、当前预览作用范围。
2. 复杂目标显示 `Inherited / Overridden / Effective value / Source` 四类信息。
3. 表现目标按 `global → cluster → region → control` 的稳定目标层级选择；仅显示已配置目标，新增目标通过受控选择器完成。
4. 颜色、背景、Host 状态和组件定位继续使用各自已有字段，但新增字段必须接入现有 Schema 同步协议。
5. 输入变化优先更新 draft、预览层和必要 CSS 变量，不重建整个编辑 Modal。

### 4.2 统一“来源”视图，而非立即统一所有数据来源

当前来源很多，短期内不应强行把 ColorGroup、ThemeDesign、用户主题和场景层合并成一个实体。应新增只读的来源视图/诊断结果，至少回答：

- 当前最终值是什么；
- 是哪个运行时层或用户覆盖提供的；
- 对应的 ThemeDef/ColorGroup/ThemeDesign ID 是什么；
- 当前目标覆盖的是哪个 Workspace/Region/Host；
- 清除当前覆盖后会回退到哪里。

该来源视图可以先由现有 `ResolvedTheme.layers`、palette/node/scope 合并结果和用户 draft 组合生成，不要求立刻改变存档结构。

### 4.3 继续采用稳定目标键，明确 Workspace 边界

目标匹配应至少包含 Workspace 身份和 UI 位置，不能把 `center` 作为跨 Workspace 的全局匹配键。建议保留当前稳定字符串作为兼容形式，同时逐步在 UI 层引入结构化目标类型：

```ts
interface ThemeTargetRef {
  workspace: string;
  slot?: 'left' | 'center' | 'right';
  region?: string;
  component?: string;
}
```

这只是运行时/编辑器内部的目标引用候选，不应未经 ADR 直接改写现有 Datapack 字段。数据包作者可见的目标仍必须来自游戏登记的稳定枚举。

### 4.4 临时主题采用 owner/lifetime，不采用快照恢复

保留并扩展现有 `TalkletThemeSpec`、ephemeral layer 和 Story dispose 语义：

- 每个临时主题必须有可诊断的 owner；
- owner 结束、区域改变、Story dispose 或 lifetime 到期时清理；
- 清理只删除 owner 创建的层；
- 页面切换不得调用全局 `resetTheme()` 或恢复一份不透明的旧快照；
- Workspace 重新挂载后从当前运行时层重新 resolve。

### 4.5 Parent/Cluster 作为后续独立裁定

如果后续确实需要“复用画法、只换 palette”，建议先建立最小可验证模型：

- Parent 只允许一层，且 parent 自身不可再有 parent；
- Parent 校验必须在 Registry/Datapack 加载阶段完成并给出 diagnostic；
- palette override 与 presentation override 必须分开解析；
- 不采用通用递归对象 merge；
- cluster 的 detached 语义必须定义完整删除、数组替换、Host 状态和目标来源；
- Parent 依赖删除、缓存失效和编辑器来源显示必须在实现前一并裁定。

在这些问题没有形成 ADR 前，不应给 `ThemeDef` 增加 `parent` 字段，也不应把当前 `PresentationHost` 的字段级合并改名为 cluster inheritance。

## 5. 施工切片

### P0：事实与诊断收口（当前阶段）

首轮迁移表如下；它描述当前接线，不是新的运行时数据结构：

| 现有来源/入口 | 当前解析或渲染落点 | 生命周期/目标信息 | 后续动作 |
| --- | --- | --- | --- |
| `ThemeDef`、ColorGroup、用户主题 | `ColorSystem`、`RuntimeThemeManager` | `player/init/area/student/user/preview/ephemeral` | 补来源摘要，不合并来源实体 |
| `PresentationDef` / `PresentationHost` | `presentation-service`、`controller-theme` | Host 父子树 + `themeScope` | 继续使用稳定 Host，不新增平行簇表 |
| `WorkspaceFrame` 三栏 | `workspace-frame`、列 `workspaceOwner` | slot + workspace owner + theme scope | 用 owner 检查跨 Workspace 隔离 |
| Story/Talklet 临时层 | `ephemeralStack`、Talklet records | owner、targets、lifetime | 统一诊断和退出清理 |
| 用户主题预览 | Runtime `preview` 层 | 编辑会话结束时移除 | 保持与真实主题分离 |

- [x] 建立当前 Theme 来源、Runtime layer、Presentation Host、Workspace/Region 目标的迁移表；
- [x] 盘点所有 `push/pop/reset/restore/previous` 主题相关调用点；
- [x] 为 `RuntimeThemeManager` 补足面向编辑器/调试的来源摘要，不写入 PlayerState；
- [ ] 增加 Workspace 切换、Story insert/goto、Talklet start/end、Shop/Contacts 隔离测试；
- [x] 记录现有基线：类型检查、主题专项测试、Workspace 生命周期测试、架构检查、构建和全量测试均已通过。

### P1：编辑器信息架构

- [x] 将现有编辑器默认入口增加摘要卡片；
- [ ] 颜色、背景/Host、组件定位保持分区，但复杂配置进入 Inspector/dialog；
- [ ] 每项同时显示有效值、来源和清除后的回退目标；
- [ ] 编辑器临时 UI 状态不进入主题数据；
- [ ] 修复局部输入导致的焦点、滚动和折叠状态丢失。

### P2：目标模型和 Workspace 隔离

- [ ] 将现有 `themeScope`、Host Registry 和 WorkspaceFrame 元数据整理成目标目录；
- [ ] 目标选择器只列出游戏登记的稳定目标；
- [ ] 验证同名 `left/center/right` 在 Shop、Contacts、Story、Game、Service 中互不串扰；
- [ ] 保留当前 `PresentationHost` 作为表现目标，不新增平行 cluster 数据表。

### P3：临时层与预览生命周期

- [ ] 统一 Story、Talklet、Shop 和页面临时层的 owner/lifetime 诊断；
- [ ] 预览使用独立 Preview layer/root，关闭时只移除预览；
- [ ] 清理仍残留的旧主题快照恢复逻辑；
- [ ] 增加过期、重复 owner、区域切换和 Workspace 重挂载回归测试。

### P4：Parent/Cluster ADR（条件性，另立决策）

仅当 P0–P3 证明当前来源与目标模型不足以支持主题复用时，再单独提交 ADR；本任务只负责提出证据，不直接写入新字段：

- `ThemeDef.parent` 的 Registry/namespace/循环规则；
- palette slot 来源与 previous slot 是否必要；
- cluster 的 inherited/detached 数据结构；
- Parent 删除、缓存失效、编辑器迁移和 Datapack Schema 同步。

## 5.1 当前施工记录（2026-09-12）

- [x] `ThemeLayer` 增加运行时 `owner`/`targets` 诊断元数据；不进入 Datapack 或 PlayerState。
- [x] `RuntimeThemeManager.diagnostics(target?)` 返回解析顺序、层类型、owner、目标键和目标命中状态。
- [x] `ColorSystem.runtimeThemeDiagnostics()` 接入只读 ColorQueryPort。
- [x] Shop Workspace 临时主题登记 `workspace:shop:<spotId>:<shopId>` owner，并沿现有 `disposeWorkspace()` 清理。
- [x] 所有主要三栏 Workspace 列补齐 `workspaceOwner` DOM 标记，作为后续隔离检查的稳定上下文。
- [x] 主题编辑器增加摘要卡片，显示主题色槽、颜色覆盖、作用范围、表现目标和组件定位数量；摘要卡可跳转现有分区筛选器。
- [x] 颜色 Token、语义节点和作用域项显示当前有效值、来源与清除后的回退目标。
- [x] 新增运行时诊断、Workspace owner、编辑器摘要、Talklet dispose 和 Shop owner 清理专项测试；类型检查通过。
- [ ] 仍待完成：Story insert/goto 与页面退出/重挂载的全路径回归、完整来源链 UI、目标目录整理、Edge 视觉回归和 P3 综合回归测试。

本轮验证结果：

- `npx vitest run tests/ui/workspace-frame.test.ts tests/ui/workspace-lifecycle.test.ts tests/engine/theme-runtime.test.ts tests/ui/user-theme-editor-overview.test.ts tests/ui/shop-modal.test.ts`：5 个测试文件、51 个测试通过；
- 编辑器来源/回退与 Shop owner 清理专项回归：`npx vitest run tests/ui/user-theme-editor-overview.test.ts tests/ui/shop-modal.test.ts`，6 个测试通过；
- `npm test`：143 个测试文件、1314 个测试通过；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- `npm run build`：通过（仅保留既有 chunk size warning）。

## 6. 当前阶段验收口径

本草案阶段的验收不是“Parent/Cluster 已完成”，而是：

- 当前实现事实与设计目标明确分开；
- 编辑器不再默认展开全部复杂字段；
- 主题项能显示最终值、来源和清除后的回退；
- Workspace/slot/region 目标不会跨 Workspace 污染；
- Preview、Story、Talklet 和页面临时层按 owner/lifetime 清理；
- 不新增任意 CSS Selector、通用递归继承或存档迁移代码；
- 相关改动遵守 `StateMutationService`、只读 UI、Schema 同步和测试先行纪律。

后续代码任务至少应通过类型检查、主题专项测试、Workspace 生命周期测试、架构检查和构建；涉及编辑器布局的任务还需在当前 Edge 游戏页面完成视觉回归。

## 7. 关联事实源与既有路线

- [[docs/docs-828/00-INDEX]]：文档入口与机制路由。
- [[docs/docs-828/04-mechanisms/color-derivation]]：当前 Theme layer、palette、scope 和剧情临时层解析规则。
- [[docs/docs-828/02-modules/ui]]：当前 UI/Workspace/表现模块边界。
- [[docs/plan-work/active/roadmap-0014-theme-editor-convergence]]：主题编辑器信息架构与来源可理解性。
- [[docs/plan-work/active/roadmap-0016-cluster-region-context-overrides]]：簇/区域上下文覆盖与三栏宿主关系。
- [[docs/plan-work/active/roadmap-0017-theme-state-and-semantic-storage]]：状态表现、语义色存储和运行时解析结果。
- [[docs/plan-work/active/task-0022-theme-definition-and-custom-theme-repair]]：主题来源、默认主题和自定义主题问题清单。
- [[docs/plan-work/active/task-0040-unified-workspace-frame]]：统一三栏 Workspace 物理骨架。
- [[docs/plan-work/active/task-0045-ui-incremental-update-workspace-isolation]]：Workspace 刷新边界与隔离。
