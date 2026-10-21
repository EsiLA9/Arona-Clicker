# Task：完全独立的节点图探索 UI Demo

状态：completed — Demo、根工具台与 Vite 入口装配、定向类型检查、构建及浏览器验收均已完成（2026-10-19）；仅“是否适合未来产品”的判断留给使用者在体验后裁定。

## 目标与完成定义

制作一个使用 TypeScript、可以从根 `index.html` 本地工具台打开并亲自操作的独立 UI Demo，验证从少数已知节点逐步探索、沿连接拓展范围，以及进入独立子图并保留双方进度的体验。它只为未来 AronaClicker 的节点图式世界线倾斜 / Global Enhancement 提供交互参考。

交付成功的标准是完成本文的浏览器验收链路，让使用者判断这种交互是否适合未来产品。此次不建立正式节点图系统，也不承诺其数据结构、外观或逻辑会被游戏采用。

本任务直接承接用户给出的参考 Task；本文将其中的可选实现收敛为可验收边界，不另建 Goal Set、Draft 或正式 Patch Unit。

用户后续裁定：逻辑使用 TS，并把 Demo 入口组装到项目根 index。因此允许复用现有 Vite 开发 / 构建基础设施及最小入口装配；原“直接双击 HTML”和“完全不修改项目入口 / 构建配置”的约束由本文下方的新边界取代，业务隔离要求仍成立。本轮只修订 Task，实际入口装配由后续模型随 Demo 一起实施。

## 最小 Read Set 与已核实事实

执行前读取根 `AGENTS.md`、本文、根 `index.html`、`vite.config.ts`、`package.json`、`tsconfig.json` 及所在目录适用的局部指令；使用 `frontend-design` skill。需要文档流程时读 [[docs/ai/goal-workflow]]，需要项目地图时读 [[docs/ai/galhcg-project-map]]。无需为本 Demo 阅读游戏业务实现。

| 已核实事实 | 依据 | 对本任务的影响 |
| --- | --- | --- |
| 活动 Task 放在计划目录根并登记索引 | [[docs/ai/templates/execution-task]]、[[docs/ai/goal-workflow]] | 本文独立解释目标与边界，不依赖历史计划 |
| 游戏 UI 风格基线及项目补充主要适用于游戏内 UI | [[ui-style/00-index]]、[[docs/ai/frontend-design-project-overlay]] | 此独立工具采用用户已指定的浅色、柔和蓝色方向，不引入游戏主题、控件或刷新系统 |
| 根包已配置 Vite、TypeScript 和 `npm run dev` / `npm run build` | 根 `package.json` 的 `scripts` / `devDependencies` | 复用现有依赖与命令，不另装工具或添加脚本 |
| 根 index 是本地工具台，使用 `.cards` / `.card` 链接游戏和编辑器 | 根 `index.html` | 在同一容器新增“节点探索 Demo”卡片，继承入口页样式 |
| Vite 以项目根为 root，构建按 `rollupOptions.input` 显式列出多个 HTML | `vite.config.ts` 的 `build.rollupOptions.input` / `mpaRoutes` | 增加一个 Demo HTML 构建入口；使用实际 HTML 路径，无需新增短路由或修改现有重定向 |
| 根 TS 配置排除 tools 目录 | 根 `tsconfig.json` 的 `include` / `exclude` | 在 Demo 内提供独立严格类型检查配置，不能只用根类型检查代替 |
| 目标 Demo 目录在调研时尚不存在 | 2026-10-19 对 `tools/node-graph-ui-demo/` 的磁盘核对 | 后续在该目录新建，不复用或改造已有工具 |
| 正式 Unit 流程不是普通局部任务的强制前提 | [[docs/ai/PROJECT-CONSTITUTION]]、[[docs/docs-829/05-conventions/testing]] | 按下方施工切片实施并记录结果，不预建额外施工文档或测试设施 |

浏览器技术调研（2026-10-19）：

- [MDN：JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) 说明本地文件方式加载模块会遇到 CORS 限制。按用户补充要求，改用由现有 Vite 处理的 `<script type="module" src="./app.ts">`，通过 HTTP 打开；不再要求 `file://` 双击运行。演示数据仍直接定义在 TS 中，无需额外请求或数据服务。
- [MDN：SVG viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox) 与 [SVG 元素说明](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/svg) 支持固定坐标系和按比例适配。使用内联 SVG、`viewBox` 与 `preserveAspectRatio="xMidYMid meet"`，边界包含节点、标签与选中环的留白。
- [W3C：Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) 讨论点击目标尺寸及间距。此 Demo 以手机实际可点选为目标，不能只缩小整幅 SVG 而把节点缩成难以触摸的点；具体尺寸需在目标视口实测。

以上调研用于选择最小实现，不引入第三方图库、布局引擎或框架。

## 实现边界与交付文件

Demo 源码集中在 `tools/node-graph-ui-demo/`，计划新建以下五个文件；目录外仅做入口装配与任务记录：

```text
tools/node-graph-ui-demo/
  index.html   页面结构与内联 SVG 宿主
  style.css    此 Demo 自有样式与响应式布局
  app.ts       带类型的虚构图数据、内存状态、动作与局部渲染
  tsconfig.json 仅检查此 Demo，strict / noEmit，不纳入游戏业务源码
  README.md    启动方法、实现说明、实际验收记录与限制
```

- 使用原生 HTML、CSS、TypeScript 和 SVG，不使用额外前端框架。使用仓库已有 Vite / TypeScript；已有依赖就绪时直接复用，不额外安装 Demo 依赖，不要求启动游戏或业务服务。
- 所有资源使用目录内相对路径；不依赖 CDN、远程字体、图片、生成素材或已有游戏资源。系统字体即可。
- 首选启动方式：`npm run dev` 打开根工具台后点击 Demo 卡片；也可直接访问同一服务下的 `/tools/node-graph-ui-demo/index.html`。端口以实际启动输出为准。无需先打开游戏页面。
- 实施允许修改：上述五个文件、根 `index.html` 的 Demo 入口及必要文案、`vite.config.ts` 的 Demo 构建输入，以及本文中的实施状态、实际核验和剩余工作。任务结束后可更新计划索引中的本条状态；不在本任务自动归档或清理历史计划。
- 不修改游戏源码、组件、路由和入口、现有工具、依赖与锁文件、根 TS 配置、测试体系、生成物、项目根风格目录或当前机制文档。根工具台与 Vite 构建输入是明确允许的最小装配例外，不扩大为游戏集成。
- 不导入或调用 Init、GlobalEnh、PlayerState、Runtime、Registry、Datapack、Effect、世界线倾斜及任何业务模块。
- 不读写真实存档，不用 localStorage、sessionStorage、IndexedDB、Cookie、URL 参数或后端保存进度。页面刷新后恢复初始状态。
- 不因本任务整理、回退或覆盖工作区已有修改。执行前核对现有差异；若目标文件后来已存在，先读当前内容并判断能否在本文边界内续作。

非目标：数值效果、升级、资源消耗、Init 生命周期、真实存档、节点编辑器、动态生成、自动布局、寻路、复杂解锁、随机探索、撤销取得、多层子图、卡牌 / 角色 / 剧情、拖拽布局、平移缩放工具、3D、粒子特效及正式游戏集成。不要为未来集成预建接口、适配层或通用图框架。

### TypeScript 与根入口装配

- 为节点状态、图 ID、节点 / 边定义、按图保存的状态与选择声明明确类型；例如四态字符串联合类型。为 DOM 查询结果与事件目标做合理收窄，不用 `any` 或 `@ts-ignore` 绕过检查。
- Demo 自有 `tsconfig.json` 使用 `strict: true`、`noEmit: true`、浏览器 DOM / ES lib，只包含本目录 TS，不引入 Node 类型或游戏源码；不为共享类型依赖根业务模块。
- 根工具台在现有 `.cards` 内新增链接卡片，名称“节点探索 Demo”，链接 `/tools/node-graph-ui-demo/index.html`，一句说明“独立节点探索与子图导航实验”。复用现有卡片结构、样式与响应式网格；同步副标题和 footer 对工具入口的列举，不重设计门户。
- 在 `vite.config.ts` 的 `build.rollupOptions.input` 中添加唯一 Demo 入口，例如 `nodeGraphDemo: resolveEntry('tools/node-graph-ui-demo/index.html')`。保留其余输入、输出目录与现有 `/game`、`/editor` 映射；不新增短路由、插件、构建流程或根脚本。
- 根门户只用普通链接导航到 Demo，不导入 Demo 脚本，不创建游戏 Runtime。Demo 也不导入门户或游戏逻辑。
- Demo 源码可以整体移走；清理时仅再移除根 index 的卡片 / 相关入口文案与 Vite 的单条输入，即可撤销本次装配，不需要重构游戏。可删除性验收检查这一边界，无需实际删除文件。

## 数据与状态合同

### 最小模型

每张图具有 `id`、名称、节点列表和无向边列表。每个节点具有唯一 `id`、显示名称、简短描述、固定 `x/y` 坐标、初始状态，可选 `childGraphId`。节点 ID 在本 Demo 内保持全局唯一即可。

固定数据与可变状态分开：用带类型的简单对象保存两张图的当前节点状态，用另一个对象保存各图选中节点；另存 `currentGraphId`。普通对象和少量 TS 函数即可，不引入状态库、事件总线或通用 Store。

| 状态 | 画布 / 面板可见内容 | 可执行动作 |
| --- | --- | --- |
| Hidden | 无节点、名称、描述或可聚焦入口 | 无 |
| Frontier | 问号 / “未知节点”，通用探索提示 | 探索 → Known |
| Known | 完整名称、描述、“已认识” | 取得 → Owned |
| Owned | 完整信息、“已拥有”，鲜明拥有标记 | 查看信息；有子图时可进入子图 |

`Selected` 是独立 UI 状态，不是第五种探索状态，不改变数量或权限。状态文本采用“待探索 / 已认识 / 已拥有”等面向使用者的中文，调试数据可保留英文枚举。

### 动作与可见性规则

1. 普通点击或键盘激活只选中节点并展示面板；探索、取得、进入子图均由面板按钮触发，不能点一下节点就自动取得。
2. 只有 Frontier 可探索、只有 Known 可取得。动作函数再次核对当前图、选中 ID 和当前状态，忽略不合法或过期调用；连点不得跳过阶段或重复结算。
3. 取得后，只把该节点在当前图中直接相邻的 Hidden 改为 Frontier；Known / Frontier / Owned 不降级，不递归揭示第二跳。初始化同样只执行对 Owned 邻居的 Hidden 揭示，保留显式初始 Known。
4. 只有两个端点均非 Hidden 时才绘制连线；不绘制通往隐藏坐标的半截边或轮廓。边置于节点下方。
5. Frontier 不提前透露真实名称、描述或子图属性；也不通过 SVG `title`、可访问名称或普通提示泄露。Hidden 不生成交互 DOM。此规则约束正常界面，不要求加密写在脚本中的演示数据。
6. Owned 被选中时已直接展示信息，可用“已拥有”提示体现“查看信息”；不需要再建一个无行为的按钮或额外弹窗。
7. 每次有效操作立即更新节点、受影响连线、面板和当前图进度；无需刷新页面，无延迟任务队列。

### 固定演示数据

主图 `main`，名称可用“探索原野”：

```text
A ─ B ─ D（childGraphId: branch）
└── C ─ E ─ F
```

边严格为 A–B、A–C、B–D、C–E、E–F。初始 A=Owned、B=Known、C=Frontier、D/E/F=Hidden。

子图 `branch`，名称可用“回声庭院”：

```text
X ─ Y ─ Z
    └── W
```

边严格为 X–Y、Y–Z、Y–W。初始 X=Owned、Y=Frontier、Z/W=Hidden。两张图均用虚构名称和一句描述，不使用实际世界线或 GlobalEnh 内容。

坐标由实现者在上述固定关系内安排，分支清晰，标签与边不重叠；不要求照抄字符图的几何比例。固定布局无需算法生成。

## 子图与会话生命周期

- D 必须先从 Frontier 探索为 Known，再取得为 Owned，才出现“进入子图”。Known 的 D 可描述入口，但不可进入。
- 子图是完整独立画布；切换后仅渲染当前图，不保留主图作为背景，也不是详情弹窗或两图并列。
- 进入子图只修改当前图 ID 与视图，不重新创建该图的状态。首次进入选中 X；返回主图恢复主图先前选中节点，再次进入恢复子图先前选中节点。
- 顶栏显示当前图名、面包屑“探索原野 / 回声庭院”和返回上层按钮。主图不显示有效的返回动作；子图面包屑的主图项可返回。
- 切换图后检查选中 ID、面板、进度、按钮和键盘焦点均属于目标图，不携带上一图的可执行操作。焦点可移到目标图标题或选中节点。
- “重置 Demo”立即将两张图的状态和选择恢复初始值，返回主图并选中 A；无需二次确认。它还必须清除进入过的子图进度。
- 刷新或重新打开页面等同新会话；进度只在当前页面会话内保留。

## UI 与更新结构

已确定视觉方向：浅色背景、柔和蓝色主色、少量强调色、轻量边框、清楚的文字层级。无须再次征求视觉方向确认。此方向仅属于独立工具，不推广成游戏风格规范。

实施前在简短说明中确认以下 DOM 草图与更新范围，不要求新增结构文档：

```text
页面壳
├─ header：图名、面包屑、返回、重置
└─ main
   ├─ 画布区域：进度、图例、内联 SVG（edges 层 / nodes 层）
   └─ aside：选中节点名称、状态、描述、当前动作、反馈
```

- 桌面：画布占主体，操作面板在旁；手机竖屏：顶栏自然换行，画布与面板上下排列，页面可纵向滚动，不横向溢出。
- 节点状态用形状 / 线型 / 标记和文字辅助颜色区分；Frontier 使用问号与浅色虚线，Known 可读，Owned 使用更鲜明填充或拥有标记；选中外环不遮盖状态。
- hover 仅作轻微反馈，不能是触屏发现操作的前提。提供明显 `focus-visible`，节点可用 Tab 聚焦、Enter / Space 选中；面板动作使用原生按钮。
- 桌面与 375px 宽手机视口中，全部可见节点、标签与选中环不被裁切；文本可读、节点可点、按钮可达。优先紧凑固定坐标与合适画布比例，不以无限缩小掩盖排版问题，也不增加拖拽 / 缩放工具。
- 状态过渡可用简短颜色 / 透明度动画，遵守 `prefers-reduced-motion`。切图可直接切换或简单淡入，无需动画框架。
- 顶栏、SVG 宿主、操作面板宿主保持稳定；同图选中 / 探索 / 取得只更新相关节点、可见集合和文本，不替换整页。切图 / 重置允许重建 SVG 内部；正确处理移除元素后的焦点。
- 动作切换时保留合理焦点：探索后可以聚焦“取得”；取得后若无后续按钮，将焦点移到选中节点或信息区域，不能落到已移除元素。
- 进度固定显示当前图的 Owned / Known / Frontier 数量，不混入另一图。无需显示隐藏节点数量或总节点数。
- 可选调试区使用默认折叠的 `details`，只读显示当前图 ID、选中节点 ID 与当前图状态；明确标识为调试信息。调试区可展示隐藏状态供测试，但普通面板不泄露。不要添加状态编辑器或开发者控制台。

## 施工切片

这些是实施顺序，不是要求创建额外 Patch Unit 文档：

1. **P0 最小链路与入口**：建立独立五文件结构、TS 类型、固定数据和内存状态；组装根工具台卡片及 Vite 构建入口；先实现单图选择、探索、取得、相邻揭示与当前图进度。
2. **P1 子图闭环**：接通 D 的取得门槛、独立子图、返回、双方状态 / 选择保留、全局重置。
3. **P2 UI 与可用性**：完成状态样式、图例、面板、响应式、键盘 / 焦点和适量过渡。无需外部素材或复杂动效。
4. **P3 独立验收与交付**：执行下方场景，在 Demo README 和本文记录真实结果、启动方法与已知限制。

## 测试与验收

主要证据是浏览器实际交互和可观察结果；不改根测试配置，不要求游戏全量测试或启动游戏。不为这个可删除 Demo 安装测试依赖。可使用已有浏览器工具辅助复现，但不能用模拟 DOM 结果替代实际浏览器验收。

必须执行 Demo 定向类型检查：`npx --no-install tsc --noEmit -p tools/node-graph-ui-demo/tsconfig.json`。另外执行 `npm run build` 核对新增 HTML 入口能构建，再使用现有 Vite 的 preview 能力（`npx --no-install vite preview`）从根工具台进入 Demo；构建产物由工具生成，不手工编辑或纳入本任务源码修改。若已有构建失败，记录具体错误和是否关联本次修改，不顺手修复无关业务。

### 确定性主流程

从 `npm run dev` 的根工具台点击“节点探索 Demo”、全新打开页面开始，按表执行；进度列顺序为 Owned / Known / Frontier：

| 步骤 | 动作 | 当前图与预期结果 | 进度 |
| --- | --- | --- | --- |
| 1 | 从根 index 入口打开 Demo | main；只见 A、B、C 及 A–B、A–C；选中 A | 1 / 1 / 1 |
| 2 | 选中 C，再探索 | C 显示真实名称，E 仍隐藏 | 1 / 2 / 0 |
| 3 | 取得 C | E 变 Frontier；F 仍隐藏 | 2 / 1 / 1 |
| 4 | 选中并取得 B | D 变 Frontier；不能直接进入 D 的子图 | 3 / 0 / 2 |
| 5 | 探索 D | D 变 Known；仍无可用进入按钮 | 3 / 1 / 1 |
| 6 | 取得 D | D 变 Owned；出现进入子图动作 | 4 / 0 / 1 |
| 7 | 进入子图 | branch；只见 X、Y 与 X–Y；选中 X | 1 / 0 / 1 |
| 8 | 探索 Y | Y 变 Known；Z/W 仍隐藏 | 1 / 1 / 0 |
| 9 | 取得 Y | Z、W 同时变 Frontier | 2 / 0 / 2 |
| 10 | 探索并取得 Z | Z 变 Owned，W 仍 Frontier | 3 / 0 / 1 |
| 11 | 返回主图 | main；A/B/C/D 仍 Owned，E 仍 Frontier，选中 D | 4 / 0 / 1 |
| 12 | 再进子图 | branch；X/Y/Z 仍 Owned，W 仍 Frontier，选中 Z | 3 / 0 / 1 |
| 13 | 返回，探索并取得 E | main；F 此时才出现 | 5 / 0 / 1 |
| 14 | 探索并取得 F | main 全部 Owned | 6 / 0 / 0 |
| 15 | 进入子图，探索并取得 W | branch 全部 Owned | 4 / 0 / 0 |
| 16 | 在子图点击重置 | 回 main，选中 A，恢复步骤 1 | 1 / 1 / 1 |
| 17 | 重新取得 B，探索并取得 D，再进入 | branch 恢复初始 X Owned、Y Frontier、Z/W Hidden，选中 X | 1 / 0 / 1 |

### 补充验收清单

- [x] `npm run dev` 后可从根 index 卡片和 Demo 的直接 HTTP 路径进入，刷新 Demo 路径正常；记录浏览器与版本。
- [x] Demo 定向 TS 检查通过；`npm run build` 包含 Demo HTML，preview 中根 index 卡片可进入 Demo 并完成探索、取得、子图往返和重置。
- [x] 根工具台原有游戏 / 编辑器链接目标和路由配置保持原样；加载门户与 Demo 无新增业务模块依赖。无需启动真实游戏来证明这一点。
- [x] Demo 只依赖自有源码与现有开发 / 构建工具；无游戏启动、业务模块、外部服务或持久化依赖。Vite 开发客户端请求不视为业务依赖。
- [x] 探索只推进一步，取得只揭示直接邻居；连点不会跳过状态或重复动作。
- [x] 隐藏节点不可聚焦，相关连线不出现；Frontier 的名称 / 描述 / 可访问名称保持未知。
- [x] 进入未拥有的子图入口不可用；切图后面板、进度、选择与操作都属于当前图。
- [x] 在主图和子图分别验证重置，刷新页面也回到初始状态。
- [x] 约 1440×900 与 375×812 视口截图核对；手机可用浏览器设备模拟，必须注明并非真机。
- [x] 键盘完成选择、探索、取得、进入和返回；焦点可见且不丢失到已移除元素。
- [x] 无本 Demo 引发的控制台异常、资源加载失败或横向溢出；减少动态效果设置下可正常操作。
- [x] 检查最终差异仅涉及允许文件；清理仅需移除 Demo 目录及本文定义的门户 / 构建入口，不触及游戏源码与运行状态。
- [x] 更新 README 和 Task，明确已通过、未执行及原因，不虚构测试结果。

交付说明包含 Demo 路径、从根 index 进入和直接 HTTP 访问的方法、TS 检查 / 构建 / preview 命令、四态转换、相邻揭示、内存内按图保存进度、导航实现与基本手动验证结果。README 同时承载本工具的局部样式 / 布局说明与最小入口清理说明，不修改游戏根风格规范。

## 实施结果（2026-10-19）

交付文件：`tools/node-graph-ui-demo/` 下的 `index.html`、`style.css`、`app.ts`、`tsconfig.json`、`README.md`；根 `index.html` 新增第三张卡片并同步副标题与 footer；`vite.config.ts` 的 `build.rollupOptions.input` 新增 `nodeGraphDemo` 一条输入。未改动游戏源码、依赖与锁文件、根 TS 配置、测试体系或生成物。

- 数据与状态：两张图的固定节点 / 边与宽 / 紧凑两套坐标；`createSessionState()` 从 `initialState` 复制状态，并只对 Owned 邻居做一次 Hidden → Frontier 揭示；`nodeStates`、`selectedNodeIds`、`currentGraphId` 同存于一个内存对象。
- 渲染：内联 SVG 的 edges / nodes 两层；同图选中、探索、取得只更新受影响节点的类名、字形、标签与相关连线，不替换 SVG；切图 / 重置才重建 SVG 内部并恢复焦点。
- 响应式：容器宽度小于 560px 切换到 `420×520` 紧凑坐标，桌面为 `760×510`；`ResizeObserver` 仅在跨断点时重绘，并在重绘后恢复节点焦点。
- 可访问性：节点 `role="button"` / `tabindex="0"`，Enter / Space 选中，`focus-visible` 显示虚线外环；动作切换后焦点落到「取得」「进入子图」或选中节点。
- 母图背景：子图内以只读投影显示母图，扁平 / 倾斜开关切换视觉，来源节点带虚线圈；无事件、无 tabindex、不复制状态，切图 / 重置时重建一次。
- 视觉：浅色背景、柔和蓝色主色、待探索使用琥珀色虚线与问号、已拥有使用实心蓝与勾选标记；状态同时由形状、线型、标记和文字表达。

验收结果（Windows 10 x64；Chromium 155.0.0.0，Playwright 驱动本机 Chrome headless；Vite 5.4.21）：

- 定向类型检查：`npx --no-install tsc --noEmit -p tools/node-graph-ui-demo/tsconfig.json` 通过。
- 构建：`npm run build` 通过，产物含 `web-dist/tools/node-graph-ui-demo/index.html` 与独立 `nodeGraphDemo` chunk；preview 中 `/game`、`/editor` 仍为 302 原目标。
- 17 步主流程：逐步核对通过，进度与可见节点集合符合表格。关键步骤：1 为 `1/1/1` 仅见 A / B / C；6 为 `4/0/1` 且出现进入子图；11 返回主图 `4/0/1` 且选中 D；14 为 `6/0/0`；15 子图 `4/0/0`；16 重置 `1/1/1` 选中 A；17 再进子图 `1/0/1` 选中 X。
- 幂等：连续触发「探索」3 次仍只到 Known；连续触发「取得」2 次只结算一次，邻居只揭示一次。
- 信息暴露：Frontier 节点的 DOM 文本、`aria-label`、面板标题与描述均不含真实名称，也没有 `title` 元素；隐藏节点不生成 DOM 与连线。
- 键盘：Tab 可达节点，Enter 选中，Tab 到面板按钮后 Enter / Space 完成探索、取得、进入子图与返回；取得 D 后焦点落在「进入子图」，返回后焦点回到主图选中节点。
- 刷新与直接路径：刷新 `.../index.html` 恢复 `1/1/1`、选中 A、3 个可见节点；dev 与 preview 均可从门户卡片进入。
- 视口：1440×900 与 375×812 截图核对，紧凑断点生效，`scrollWidth` = 375 无横向溢出，手机点击目标约 64×64 CSS px；手机为浏览器设备模拟，不是真机。
- 母图背景：子图内出现，返回 / 重置后清空；扁平与倾斜均可切换，背景 0 个可聚焦元素；375px 下无横向溢出。
- 返回动画：220ms 回退过渡，90ms 时前景 opacity ≈ 0.42、350ms 后回到主图并聚焦 D；减少动态效果时直接切换。
- 控制台：Demo 页 0 error；门户仅有既有的 `favicon.ico` 404。
- `prefers-reduced-motion: reduce` 下探索、取得与切图正常。

未执行：真实手机、Safari / Firefox、屏幕阅读器实测；均不阻塞本 Demo 的判断目标。

## 当前核验（2026-10-19，任务编写阶段）

- 已完成：项目身份核对、最小文档路由核对、目标目录存在性检查、浏览器技术资料调研；仅编写本文并登记计划索引。
- Demo 实现、浏览器手动验证与截图：未执行，等待后续模型施工；上方验收项均为待执行标准。
- 本次需求修订已核对根 `index.html`、`vite.config.ts`、`package.json` 与根 TS 配置；TS 与入口装配仅写入本 Task，尚未修改这些运行文件。后续实施须执行新增类型检查与构建 / preview 验收。
- 编写前运行 `npm run check:docs`：失败，已有 8 处 R3 源码路径失效，涉及 data-flow、operation-view、operation-runtime、definition-authoring 文档；这些问题不属于本任务修复范围。
- 编写后运行 `npm run check:docs`：扫描 1000 份 Markdown，仍为编写前同样的 8 处 R3 失效路径，未新增错误。定向 `git diff --check` 通过；新增 Task 另行核对空白与链接。

## GALHCG 影响闭环

- 项目身份：`graph_project(workspace_path=<本项目绝对目录>)` 返回 `project_id=acprogram`。
- 发现路径：`graph_search(target="path", query="node-graph")` 无结果；改查 `tools/` 内 `demo` 仍无结果。随后直接核对目标目录尚不存在；未把地图零命中解释成仓库不存在其它地图功能。
- 本次修订：以 `project_id=acprogram` 查询 `vite.config.ts` 命中当前根配置，再回到磁盘核对其入口映射与构建输入；根 index 的门户结构以实际 HTML 核实。
- 本轮只改计划文档；不调整游戏模块关系，不改图、不刷新、不写 freshness。编写收尾按直接文档路径执行只读检查并记录其覆盖限制。
- 本轮只读复核结果：新 Task 返回 `unreferenced_path`，尚无 Evidence / maps_to，不能宣称地图覆盖；计划索引返回 `content_changed`，6 项 owner 分页核对，4 份 Evidence 为旧内容，2 项为导航映射。未执行地图写入或 freshness 更新。
- 后续施工完成后，仅对实际修改的 Demo 路径、根 `index.html`、`vite.config.ts` 与计划记录做 `graph_health(check="changed")` 只读复核。新目录未映射时如实说明；查询与文件实现不授权维护地图。
- 施工后只读复核（2026-10-19）：`graph_project(workspace_path=本项目)` 仍返回 `project_id=acprogram`；`graph_health(check="changed")` 第一页 7 条均为本轮之前已存在的文档改动，未涉及本次文件；`graph_health(check="changed", directory="tools/node-graph-ui-demo")` 返回 `total_paths=0`，说明新目录尚未进入地图，不宣称已被覆盖。本轮未改图、未刷新、未写 freshness。

## 剩余工作

- 本 Task 内：无。五文件 Demo、根 index 与 Vite 入口装配、类型检查、构建、preview 与 17 步浏览器验收均已完成，结果见“实施结果”。
- 最终产品方向：需要使用者亲自操作 Demo 后判断节点探索体验是否合适；任何正式 Global Enhancement / 世界线倾斜设计及游戏集成都不在此 Task 内，需后续另行裁定。

## 相关路由

[[docs/plan-work/00-index]] · [[docs/ai/goal-workflow]] · [[docs/ai/context-packs/ui-presentation]] · [[docs/ai/galhcg-project-map]] · [[docs/docs-829/05-conventions/testing]]
