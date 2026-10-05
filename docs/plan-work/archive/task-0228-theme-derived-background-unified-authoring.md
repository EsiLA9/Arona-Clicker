# Task：调查主题派生背景与自定义背景的统一编辑机制

状态：complete — 只读调查已验收并归档

## 目标

形成一份可独立复用的当前机制调查，说明主题主色自然派生的背景色，与用户自定义背景图层在数据表示、派生、运行时合并、UI 渲染、优先级和图形化编辑入口上的区别；给出后续统一编辑模型必须满足的边界与待裁定问题。本 Task 只调查，不改产品源码、不裁定具体重构方案。

## 设计边界

- 本 Task 包含：追踪 ColorGroup / ThemeDef / 运行时主题层如何派生或合并 `bg`、`bgAlt` 等背景 token；追踪 user theme 背景 layer 的声明、优先级、编辑和渲染；比较二者能否作为所有主题共同的图形化编辑目标；检查主题 token 是否自动成为页面背景栈一层。
- 明确非目标：不恢复或改变 Init 背景；不修复夏莱蓝背景；不修改主题、渲染器或 Datapack 数据；不设计或实现编辑器 UI；不把当前用户个性配置当成默认产品定义。
- 已裁定来源：主题色自然派生的背景色应是通用主题机制，所有主题应共用可供后续图形化内容编辑的机制；本 Task 只调查差异，不延伸成实现授权。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `ColorGroupDef` 有主色槽；`schale-solid` 只声明 `#3b9eff`，`coral` 显式给出 bg/bgAlt 等 token，`ink` 只显式覆盖 panel。 | `src/arona-clicker/content/colors.ts`：`baseColorGroups` | 已核对仅主色派生、部分显式覆盖、显式背景 token 三种例子。 |
| `resolveTheme()` 先运行 `deriveThemeTokens(primary)` 生成完整 token，再由 `group.theme` 逐项覆盖；`themeContributionFromThemeDef()` 先合并引用色组，再应用 ThemeDef.tokens。 | `src/arona-clicker/services/color-system.ts`：`deriveThemeTokens`、`resolveTheme`、`themeContributionFromThemeDef` | 主题色派生与主题定义解析使用统一 token 路径；ThemeDef.background 仍是并列 layer 字段。 |
| `--theme-node-bg` / `--theme-node-bg-alt` 从合并 tokens/palette 经 `buildThemeNodeVars()` 注入；compatibility vars 使 `--canvas`、`--bg` 指向主题节点。 | `src/ui/controller-theme.ts`：`applyTheme`；`src/ui/theme-palette.ts`：`buildThemeNodeVars`、`buildThemeCompatibilityVars` | token/CSS 语义背景色可用于 UI 节点及 CSS，但并不等于已创建背景 DOM layer。 |
| `buildBackgroundView()` 对非空 layer 列表只解析给定 layers；只有列表为空时才以 bg/bgAlt 生成渐变 fallback。全屏 `.console-background` 本身透明，实际画布背景由 `renderBackground()` 建立的 `.console-background-layer` DOM 绘制。 | `src/ui/background-service.ts`：`buildBackgroundView`、`renderBackground`；`src/ui/outer-background.ts`；`src/ui/css/background.css` | 存在“无 layer 时自然延伸”的 UI fallback，但场景有 layer 时不会额外合成派生色底层。 |
| Schale 主厅 Area 引用 `schale-solid` 并声明 Hoshino 图片和两个 triangles 图片 layer；有这些 layer 时不会触发 token 渐变 fallback。 | `src/arona-clicker/content/areas.ts`：`base:area:schale_main` | 夏莱蓝 token 在主题节点存在，但显式场景背景栈不含主题派生底色。 |
| 用户主题存储 tokens 与 presentation/background；ColorSystem 在 user/preview 路径注入固定 ID `system-color-background` 的 `linear-gradient(...var(--bg)...var(--bg-alt)...)`；用户 layer 可排在其上且系统层 ID 受保护。 | `src/arona-clicker/types/user-theme.ts`：`UserThemeDraft`；`src/arona-clicker/services/color-system.ts`：`systemColorBackground`、`syncUserThemeFromState`、`setUserThemePreview`；`src/arona-clicker/services/user-theme-service.ts`；`src/arona-clicker/services/user-theme-layer-service.ts` | user theme 专门将 token 派生成实际全局层；此行为并未对所有 runtime scope 通用化。 |
| 用户图形编辑器分开编辑颜色 tokens/palette 与表现图层，提供实时预览、来源提示、全局/宿主目标 layer 管理；数据由玩家 UserTheme 草稿承载。 | `src/ui/components/user-theme-editor.ts`：`renderUserThemeEditor`、`tokenFallbackSource`；`src/ui/components/user-theme-layer-manager.ts`；`src/ui/controller-modals.ts`：`openUserThemeEditor`、`bindUserThemeEditor`；`src/arona-clicker/services/user-theme-service.ts` | 可复用 GUI 交互，但其编辑对象是玩家主题草稿，不是通用 ColorGroup/ThemeDef Datapack 内容。 |
| Init 主题目前只投影到外部 Init 选择页，运行时不注入 Init 颜色、背景或 Presentation。 | `docs/docs-829/06-wiki/50-ui/presentation-theme.md`；Task 0227 已归档 | 防止调查误把 Init 背景当作通用主题派生机制。 |

## 施工切片

### P0：完成只读机制调查

- 检查 theme token 派生算法、ColorGroup / ThemeDef / UserTheme 数据模型与解析合并路径。
- 检查背景 layer 数据模型、多个主题层如何合并、页面与宿主各自如何渲染，以及 user theme editor 暴露的编辑入口。
- 使用一个内置主题与一个自定义主题作对照，说明从主色到 bg token 与从图形化编辑值到背景 layer 的实际路径。
- 明确区分“派生的语义背景色 token”“实际 CSS 画布底色”“背景 layer 栈”，并列出目前的自动连接、缺失连接及优先级冲突。
- 给出通用图形化编辑机制需要共享的数据/编辑能力清单，以及需产品裁定的问题；不直接选定具体实现。

## 测试与验收

- [x] 机制链条由源码、测试或当前机制文档逐条支撑，并给出精确路径/符号。
- [x] 报告明确区分 token 派生、页面画布底色、背景 layer 栈和 user theme 图形化编辑入口。
- [x] 核对显式 token 组 `coral`、仅由 primary 派生组 `schale-solid`、部分显式组 `ink`、ThemeDef 覆盖路径与用户主题背景编辑路径。
- [x] 列出统一图形化内容编辑要复用的机制与待裁定边界，不将其写为实现决策。
- [x] 主 agent 验收源码与测试证据；调查边界、现状差异、统一编辑复用点和后续裁定项完整，归档 Task。

## 当前核验（2026-10-04）

- 项目绑定：GALHCG `resolve_project(workspace_path="C:\\Users\\15229\\Documents\\Obsidian Vault\\1-项目\\ACProgram")` 返回 `project_id=acprogram`，`root_path` 与工作区一致；按 `docs/ai/context-packs/ui-presentation.md` 读取主题 Read Set 及源码/测试。
- token 证据：`src/arona-clicker/services/color-system.ts` 的 `deriveThemeTokens()`、`resolveTheme()`、`themeContributionFromThemeDef()`；`src/arona-clicker/content/colors.ts` 的 `baseColorGroups`；`tests/engine/color-derive.test.ts` 覆盖 primary 派生、显式覆盖与对比度；`tests/engine/theme-tree.test.ts` / `tests/ui/theme-tree.test.ts` 覆盖 ThemeDef 色组打底 + tokens 覆盖。
- runtime/渲染证据：`src/engine/core/theme-runtime.ts` 的 `ThemeLayer`、`RuntimeThemeManager.resolve()`；`src/ui/controller-theme.ts` 的 `syncRuntimeTheme()`、`applyTheme()`、`backgroundView()`；`src/ui/background-service.ts` 的 `buildBackgroundView()` / `renderBackground()`；`src/ui/outer-background.ts` 与 `src/ui/css/background.css`。测试入口为 `tests/engine/theme-runtime.test.ts` 与 `tests/ui/background-service.test.ts`。
- 用户编辑证据：`src/arona-clicker/types/user-theme.ts`、`src/arona-clicker/services/user-theme-service.ts` 的 `beginEdit()` / `apply()`、`src/arona-clicker/services/user-theme-layer-service.ts`、`src/ui/components/user-theme-editor.ts` 的 `renderUserThemeEditor()` / `tokenFallbackSource()`、`src/ui/components/user-theme-layer-manager.ts`、`src/ui/controller-modals.ts`。测试入口为 `tests/engine/user-theme-service.test.ts`、`tests/engine/user-theme-layer-service.test.ts`、`tests/ui/user-theme-editor-overview.test.ts`、`tests/ui/user-theme-layer-editor-dialog.test.ts`、`tests/ui/user-theme-editor-layer-order.test.ts`。

### 机制比较与统一编辑边界

| 来源 | 主色→bg/bgAlt | bg/bgAlt→页面画布 | 图形化编辑当前形态 |
| --- | --- | --- | --- |
| built-in ColorGroup | `resolveTheme()` 从 primary 派生完整 token，显式 `theme` 覆盖；`schale-solid` 只给 primary，`coral` 显式给 bg/bgAlt，`ink` 只显式 panel | 不独自产生 layer。只有最终背景 layer 列表为空时，`buildBackgroundView()` 才生成 token 渐变；显式场景背景会让该 fallback 不运行 | 静态 Datapack 内容；没有复用 UserThemeEditor 的通用内容编辑入口 |
| Area/ThemeDef/场景层 | ThemeDef 引用色组整包解析并以 tokens 覆盖；运行时 layer 的 groupId/tokens 复用同一 ColorSystem resolver | `background` 是并列声明数据，不自动包含主题色底层；多个来源的 layer 在 `RuntimeThemeManager.resolve()` 按 ID 与背景顺序另行合成 | 运行时消费主题槽与定义，无当前图形化内容作者入口 |
| UserTheme | palette/tokens 存在独立用户草稿；CSS 语义节点从最终 tokens 与 palette 解析 | ColorSystem 特别创建并排序 `system-color-background` 渐变层，将 bg/bgAlt 放进全局背景栈 | 用户主题编辑器能编辑颜色 token，也能管理全局/宿主表现图层；分区保存、预览与校验 |

结论：共用部分已经存在于 `ThemeDef`/`ThemeLayer`、`themeContributionFromThemeDef()`、ColorSystem token resolver、`RuntimeThemeManager` 与 BackgroundService；缺少的是跨主题来源共同的“派生背景作为画布层”规则和共同图形内容编辑模型。当前 user theme 把 token→全局 layer 的连接专门编码在 user/preview 路径。`buildBackgroundView()` 空列表 fallback 是另一条连接，但只在列表为空时生效。Hoshino 属于 Area 显式背景，因此该 fallback 不生效，派生 bg 不会落在插画下方。

统一编辑需复用/明确：统一主色与显式覆盖解析及来源提示；派生背景在栈中的实体表达；跨来源 layer ID、顺序、覆盖、禁用与透明度语义；清除显式值后回到派生值；以及图形界面究竟写玩家 UserTheme 状态还是 Datapack ThemeDef/ColorGroup 内容。以上为后续实现边界，不裁定具体模型，也不改当前背景表现。

## GALHCG 影响闭环

- 发现路径：`resolve_project` 核对后显式使用 `project_id=acprogram`；`overview` 为普通分页，识别 `concept:color-system` / `concept:user-theme-service`；`lookup("ColorSystem")` 唯一精确命中 `concept:color-system`；`lookup("user-theme-service")` 零命中后按稳定 ID 调用 `context`，其结构、Evidence、文件及 owner 分页完整；`search(mode="source", query="system-color-background", directory="src")` 完整返回 5 项；`search(mode="path", query="theme-runtime")` 完整返回实现与测试 2 项。地图仅作导航，事实已回源码/测试确认。
- 变更审查：`review_changes(path="docs/plan-work/task-0228-theme-derived-background-unified-authoring.md")` 返回 `unreferenced_path`，确认地图中没有该新 Task 的直接 Evidence/maps_to，因此无 owner 可续读，也不应为计划文档增加实现映射。`review_changes(path="docs/plan-work/00-index.md")` 完整返回 1 个路径、4 个 owners，`owner_complete=true`、无续页；index 当前 `content_changed`，3 个直接 Evidence owner 显示 stale，另有 1 个 navigation-only maps_to。变化来自计划索引更新；本次不写地图 freshness / Evidence，主 agent 可在验收时决定是否需要计划/文档地图维护。
- 地图维护：本次只读调查无实现关系变化，不写地图。index 审查范围完整，Task 文件未关联；不把计划文档映射成实现证据。

## 剩余工作

- 后续仍需另立实施 Task，统一主题派生背景与 user theme 图形化编辑能力，并裁定页面画布底色与可编辑背景图层的关系；本调查不包含该实现。

## 相关路由

- `docs/ai/context-packs/ui-presentation.md`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `src/arona-clicker/services/color-system.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/background-color.ts`
- `src/ui/background-service.ts`
- `src/ui/controller-theme.ts`
- `src/ui/components/user-theme-editor.ts`
