# Task 0434 · 公共悬浮滚动条服务与首批消费者

状态：待处理

## 目标与验收

- 目标：建设可供整个游戏 UI 使用的公共悬浮滚动条服务，让任何普通原生纵向滚动节点都能 opt-in 使用，不依赖 `workspace-column__body`、`content-region` 或某个产品 class。浏览器继续负责实际滚动与位置语义，公共服务统一负责原生条隐藏、自绘 thumb、显隐、拖动、尺寸同步、重新绑定和释放。
- 完成条件：定义稳定的 `OverlayScrollbarBinding`（至少含稳定 root、原生 viewport、可选内容测量节点、track 与 thumb）及 controller 生命周期（`refresh`、`rebind`、`dispose`）；Area Workspace 主内容和 Editor Directory 两个首批消费者使用同一完整服务。wheel、触控板惯性、键盘滚动、触屏、`scrollTop` 和 `scrollIntoView()` 仍由原生滚动节点处理。视觉 thumb 4–6px，右侧交互带 10–12px，最小长度 24px，布局占宽 0px；默认隐藏，指针进入右侧交互带后显示，拖动时持续显示，结束后恢复显隐规则，无溢出时隐藏且不可交互；颜色使用现有主题角色，透明度过渡约 120ms。视口尺寸、内容实际尺寸、显式 UI refresh 和 DOM rebind 后几何均正确更新；隐藏轨道不截断或拦截下方业务按钮；列级和 Editor Explorer 的位置服务继续针对原 viewport。
- 边界：本 Task 实现公共服务并迁移 Area Workspace 主内容和 Editor Directory 两个首批消费者，不批量迁移其它产品。通用服务允许普通原生纵向滚动节点接入；FlowScroll/聊天流、横向滚动、弹窗/popover、条件树等业务滚动容器在后续阶段按语义单独评估，不因此重写其滚动状态管理。

## 当前依据与改动方案

- 当前依据：`src/ui/components/world/area-workspace.ts` 的主内容节点 `.area-workspace__center-content` 带 `data-scroll-owner="content-region"`；其列声明 `scroll: 'content'`，由 `src/ui/components/shared/workspace-frame.ts` 渲染为 `workspace-column__body[data-scroll="content"]`，外层隐藏溢出。`src/ui/css/layout.css` 给该节点设置 `overflow: auto`、flex 与最小尺寸。它位于 Area Workspace 的主内容列；若“左侧 Area”指主游戏页面左侧 Area 导航 rail，则 `src/ui/columns/index.ts:createAreaNavigationColumn` 实际输出 `data-scroll="none"` 下的 `.panel-body.ui-cluster--left-area`，没有 `content-region` 标记，需先明确后续接入另立范围。`src/ui/interaction/scroll.ts` 经 `workspaceColumnScrollTargets()` 保存和恢复列内 `content-region.scrollTop`。
- 具体调整：从 `src/ui/workspace/editor-directory-scroll.ts` 将公共滚动条逻辑迁入独立、与产品无关的 UI 模块；保留该文件作为 Editor Directory 专用 DOM/CSS adapter，不把 editor 专用路径变成公共服务入口。公共 Overlay Scrollbar controller 接收显式 viewport/root/track/thumb 绑定，不查询 `data-scroll-owner` 或产品 class；向消费者暴露刷新、节点替换后的 `rebind`、销毁接口。增加通用绑定/轨道样式；消费者仅负责提供其原生滚动节点、悬浮轨道宿主及可选内容测量节点。Area Workspace 主内容沿用现有业务 class 和 `data-scroll-owner`；不新增 `data-scroll-key`，避免改变 `workspaceColumnScrollTargets()` 当前按 class 回退得到的快照键。Editor Directory 保留其 DOM 形态、CSS 布局和 `EditorExplorerService` pane 位置服务，改为向 controller 提供当前节点绑定。
- 衔接与验证：Workspace 消费者在列 bind 时创建 controller 并在 dispose 时释放；补足 `WorkspaceColumns` 对绑定生命周期的内容更新通知，使同 binding 的 DOM 替换触发 refresh/rebind，确实替换节点时先释放旧 observer、监听和拖动态再绑定新 viewport/track/thumb。Editor Explorer 的 keyed refresh 和 Story controller 显式刷新使用同一 controller 的 refresh/rebind 入口。新增 controller 单测覆盖无/有溢出几何、最小 thumb、顶部/底部拖动映射、显隐与无溢出 click-through、pointercancel、视口和内容分别 resize、显式 refresh、rebind 与 dispose；Area 集成测试核对原生滚动行为、DOM/key 身份和 `ScrollManager` capture/restore；目录测试核对其 pane 位置与 keyed refresh。将共享规格记入 `ui-style/shared-patterns/workspace.md`，并在该页说明它适用于普通纵向滚动节点，不限于 Workspace。运行定向 `npm test`，完整输出遵守 `.test-artifacts/latest.log`；手动检查显隐、宽度稳定和主题色。

## 产品影响与迁移分期

- 本 Task 直接影响 Area Workspace 的主内容列和 Story/Entry Editor Explorer 的目录列表。Area 左侧导航 rail、滚动在 `.panel-body` 的 Game 主页面列不因选择 `content-region` 而自动接入。
- 普通纵向滚动区的迁移分期：0434 建公共服务并接 Area Workspace 主内容、Editor Directory；第二批接一般 Game 三栏的 Area 导航、设施、Log 与普通列表；第三批接 Contacts、Character、Story 目录、Inventory 及其他 Workspace；第四批评估条件树、复杂编辑器、弹窗/popover 等业务滚动容器；最后再评估 FlowScroll。各阶段逐产品接入，不做全局选择器覆盖。
- 产品责任保持分离：共享 controller 只管理 scrollbar 外观、原生 scroll 同步、thumb 显隐/拖动和尺寸更新；`ScrollManager` 继续管理 Workspace 位置快照；`EditorExplorerService` 继续管理各目录 pane 的位置；`FlowScroll` 继续管理聊天贴底、锚点/比例恢复和图片变化。FlowScroll 可在最后复用悬浮外观/拖动，不要求放弃自身语义。Operation chat 实时 log、横向 overflow、固定选择菜单等逐项评估。
- 实施时待核实：稳定 root 如何获知内容更新应走明确 `WorkspaceColumns` after-content-update 通知；禁止用全局 MutationObserver 扫整棵 App。observer 至少分别覆盖 viewport 和可提供的实际内容测量节点；没有稳定内容壳的业务更新必须通过 controller.refresh/rebind 显式通知。隐藏轨道区域要在不拦截业务点击的前提下检测 hover，必要时用 viewport 指针位置更新显隐；拖动期间 track 保持可交互，结束/pointercancel 后恢复规则。

## 工作项

- [ ] 定义公共 viewport/content/track/thumb 绑定契约与 controller.refresh/rebind/dispose 生命周期；实现浮动轨道宽度 0、thumb/交互带分离、默认隐藏、主题着色、最小 thumb 和 click-through 行为。
- [ ] 从 Editor Directory 实现提取完整 controller 到独立通用模块，保留 Editor Directory adapter；补尺寸观察、pointer 状态、DOM rebind、旧资源释放及行为单测。
- [ ] 给 Workspace 列绑定增加明确的内容更新通知；将 Area Workspace 主内容接入，并验证 same-binding 子 DOM 替换、位置快照和卸载清理。
- [ ] 将 Editor Directory 改接完整公共 controller，保留 `EditorExplorerService` pane 位置和 keyed refresh；记录下一批 Game 三栏普通滚动目标，完成文档、定向测试和手动显隐检查。

## 当前进展

- 已完成：按 UI 文件夹组核对滚动实现与产品消费者；参照评审意见将目标从目录滚动几何抽取调整为全 UI 普通纵向滚动区可使用的公共悬浮滚动条 controller；补足显示规格、内容观察、更新生命周期和迁移分期。
- 正在进行：未开始实施。
- 下一步：定义通用 viewport/content/track/thumb binding 与 controller 生命周期，并为 `WorkspaceColumns` 的 same-binding 内容替换增加明确刷新通知，再接入 Area Workspace 和 Editor Directory。

## 结果与问题

- 验证结果：待实施。
- 发现问题：Area Workspace 主内容当前使用原生 `overflow:auto`；现有自绘 thumb 只用于 Editor Directory。`WorkspaceColumns.update()` 可以原位替换列内子 DOM 而不重跑 bind，需增加明确 after-content-update 通知。Area 主内容与左侧 Area rail 是不同节点；本 Task 首批按 `content-region` 主内容落点施工，左 rail 放入第二批普通 Game 滚动区域。
- 关键证据：`src/ui/components/world/area-workspace.ts`、`src/ui/css/layout.css`、`src/ui/components/shared/workspace-frame.ts`、`src/ui/workspace/editor-directory-scroll.ts`、`src/ui/interaction/workspace-scroll.ts`、`src/ui/interaction/scroll.ts`、`tests/ui/interaction/scroll.test.ts`、`tests/ui/workspace/workspace-frame.test.ts`、`tests/ui/story/story-editor-workspace.test.ts`。
