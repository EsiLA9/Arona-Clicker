# Task 0230：通讯录与故事 Workspace 标题栏统一

状态：completed — 通讯录 / 故事共用标题区已接入，定向测试与类型检查通过；浏览器视觉比较因当前自动化工具无法操作路由页而未执行

## 目标

让通讯录与故事独立 Workspace 的标题栏复用默认页中栏标签区的统一结构和高度。标题栏显示页面名称与图标式返回键；移除这两个 Workspace 自身的 eyebrow / overline 文案，不改全局顶部工具栏。

## 设计边界

- 本 Task 只调整 ContactsWorkspace 与 StoryWorkspace 的标题表现，以及对应的 UI 验收。
- 标题栏放在各自的中栏内容顶部，复用 `renderPanelHeaderRegion(ctx, 'center', content)`；不得手写另一套 `.panel-tabs-region` 外壳或独立高度。
- 返回键改为本地内联 SVG 左向尖括号图形，保留 `aria-label`、`title` 和现有 `data-contacts-workspace-leave` / `data-story-workspace-leave` 动作标识；按钮不再显示“返回游戏”等长文本。
- 移除 Contacts / Story Workspace 自身标题和占位内容中的 eyebrow / overline 结构，包括 `CONTACTS WORKSPACE`、`STORY WORKSPACE`、`PLANNED REGION`、`STORY ARCHIVE`。保留页面标题、占位标题、描述和必要操作。
- 不移除全局 `.eyebrow` 样式，不改应用级 `renderHeader`，不改变 Workspace 路由、返回栈、对话状态或角色选择行为。
- 不扩展到 Character、Shop、Settings、Inventory 或其他 Workspace；不新增图标依赖、远端资源或通用 UI 框架。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `renderPanelHeaderRegion()` 产出统一 `ui-cluster ui-cluster--center-tabs-region panel-tabs-region presentation-host-target` 外壳、`centerPanel.tabs` 表现宿主和背景。 | `src/ui/components/tabs.ts:30-53` | 直接复用已有 helper，获得默认页一致的宿主与结构。 |
| `.panel-tabs-region` 以 `--panel-tabs-control-height: 30px` 和共享纵向 padding 控制标题区高度。 | `src/ui/css/chat.css:26-75` | 不另设高度值；标题栏应与默认中栏 Tabs 区同高。 |
| 通讯录 / 故事当前把 `leaveHeader()` 放在左栏，并在页标题及占位内容中输出 `.eyebrow`。 | `src/ui/components/contacts-workspace.ts`、`src/ui/components/story-workspace.ts` | 两个 Workspace 需将页面标题与返回键移入中栏统一标题区，并清除自身 overline。 |
| 返回动作由 `bindContactsActions()` 和 `bindStoryActions()` 监听现有 `data-*-workspace-leave` 属性。 | `src/ui/controller-actions-contacts.ts`、`src/ui/controller-actions-story.ts` | 保持动作属性即可复用原有返回行为。 |
| Contacts / Story 的路由、列归属与刷新边界已有专项测试。 | `tests/ui/contacts-story-workspace.test.ts` | 在现有测试中增加标题结构、图标、无 eyebrow 与返回行为断言。 |

## 施工切片

### P0：接入统一标题区

- [x] 在 Contacts / Story 的中栏内容前调用 `renderPanelHeaderRegion(ctx, 'center', ...)`，标题显示“通讯录”或“故事”。
- [x] 从左栏移除当前 `workspace-page-header`，让导航列表 / 故事导航从其栏内主体开始。
- [x] 返回键使用轻量内联 SVG 左向尖括号；复用现有 `conversation-back` 与标题排布语义，按钮沿用标题区控件高度。
- [x] 保留原 data action，并加入无障碍名称与提示文本；可见内容只显示 SVG。
- [x] 移除两个 Workspace 标题、占位区和故事档案占位中的 eyebrow / overline 节点，保留中文标题和说明。
- [x] 清理不再使用的 `.workspace-page-header` 样式；故事档案区改为占据标题区以下的剩余高度。

### P1：回归与浏览器验收

- [x] 更新 `tests/ui/contacts-story-workspace.test.ts`，覆盖 Contacts 与 Story 的标题区 class / host、标题、SVG 返回键、无 eyebrow，以及点击返回后现有路由行为。
- [x] 通过共用 `renderPanelHeaderRegion` 与相同 `.panel-tabs-region` / 30px 控件高度规则核验等高结构；自动化覆盖长文本移除、导航返回和档案子路由。
- 浏览器截图级视觉比较未执行：本地页面可打开，但当前 CUA 只提供标签树，不提供切换工作区的交互接口；项目也未安装 Playwright / Puppeteer。两个标题区复用同一 helper 和 CSS 控件高度，结构等高已有源码与测试依据；需要实际截图时可在本地两页检查。

## 测试与验收

- [x] 两个 Workspace 都通过现有 `renderPanelHeaderRegion(ctx, 'center', ...)` 生成 `ui-cluster--center-tabs-region panel-tabs-region presentation-host-target`，表现宿主为 `centerPanel.tabs`。
- [x] 标题区与默认页中栏 Tabs 区使用同一等高实现，不新增独立固定高度或重复背景 / 边框层。
- [x] 两个 Workspace 标题均显示对应中文页面名；标题栏内有本地 SVG 左向返回键，具有可访问名称与提示，DOM 可通过既有 data action 找到。
- [x] Contacts / Story Workspace 中不再存在本任务所列 eyebrow / overline 文案或结构；全局 eyebrow 样式与其他页面内容不变。
- [x] 点击返回键仍通过原有动作回到正确的先前页面；通讯录选择、故事导航、对话流及存档子路由专项测试通过。
- [x] `npx vitest run tests/ui/contacts-story-workspace.test.ts`：1 个文件、12 项通过；`npx tsc --noEmit` 通过。

## 当前核验（2026-10-05）

- Contacts / Story 复用 `src/ui/components/workspace-titlebar.ts`，接入 `centerPanel.tabs` 宿主；移除旧页头与其闲置样式，并清理所有 Workspace 专属 eyebrow。
- 测试覆盖组件结构、宿主、标题、可访问 SVG 按钮、返回至 Game / Contacts、无 eyebrow 和 Story Archive 子路由。
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md` 已补充 Contacts / Story 中栏标题复用宿主与等高规则。
- 浏览器端已打开本地默认页并确认公共顶部栏仍存在；但当前浏览器控制面未提供点击切换路由能力，因此没有截取 Contacts / Story 的实览图。标题等高由复用同一 helper、同一 30px 控件 token 和相同 CSS 规则确认。

## GALHCG 影响闭环

- 发现路径：`resolve_project` 确认项目为 `acprogram`。`lookup("WorkspaceFrame")`、`lookup("panel-tabs-region")` 与 map 查询 `workspace` 均为完整零命中；按协议回退后，`search(source, "renderPanelHeaderRegion")` 命中 `src/ui/components/tabs.ts`、`contacts.ts`、`character-workspace.ts` 和 `conversation.css`，`search(path, "contacts-workspace")` 命中 Contacts Workspace 实现。项目未配置 `.galhcg/project.toml` 与专属 scopes。
- 变更审查：完成源码、CSS、测试及 `workspace-routing.md` 的精确路径 `review_changes`；复核后均为 `unchanged`、0 个 stale Evidence。归档后的 `docs/plan-work/00-index.md` 也完整检查 1/1 路径，结果 `unchanged`、0 个 stale Evidence。
- 地图维护：已将 `workspace-titlebar.ts` 加入限定的 `src/ui/components` 文件清单，并映射至 `UI Workspace Renderer`；相关实现 / 测试映射 Evidence 均刷新。机制页新增标题栏事实后，更新 `UI Workspace Renderer` 节点与 `workspace-routing.md` 关系 Evidence；各批都通过完整 dry-run 后提交。Task 归档时，限定刷新从根目录移除旧 Task File，并将归档路径登记为规划 File；它不建立已实现机制映射。

## 剩余工作

- 源码实现与自动化验收已完成；需视觉截图级检查时，在有页面操作能力的浏览器中查看即可。
- 本 Task 不改变全局顶部工具栏或其他 Workspace 的设计。

## 相关路由

- [[docs/ai/task-read-set-routing]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/docs-829/06-wiki/50-ui/workspace-routing]]
- [[docs/docs-829/06-wiki/50-ui/presentation-theme]]
- `src/ui/components/tabs.ts`
- `tests/ui/contacts-story-workspace.test.ts`
