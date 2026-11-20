# Task：收窄 AronaClicker 开发文件监听与分阶段装载样式

状态：待处理

## 目标与验收

降低 `npm run dev` 首次进入大厅时的 Vite 处理开销，并把后续界面的专用样式移到实际使用的时机。以前序任务 [[ai/plan/task-0373-arona-dev-cold-start]] 的 JSZip 预打包与编辑器样式延迟装载为基线。

## 现场与原因

- 2026-11-20 11:36:57 首次打开游戏约 **57.3 秒**。入口到模块阶段开始约 10.2 秒，模块阶段实际工作 45.9 秒。四个 TypeScript 入口各等约 22.6–22.7 秒才收到首字节。`game.css` 等首字节 45.7 秒，服务端采样时转换前已耗约 22.3 秒，CSS 转换钩子内已耗约 23.2 秒。此次 Vite 为新进程，Windows 自 2026-11-17 00:39 起运行。JSZip 磁盘缓存先于模块阶段落地。
- 浏览器记录的慢请求均为 300 B，符合缓存重新验证。用同一 ETag 访问新 Vite 进程，实测先转换 CSS 再回 304，同进程再次请求只需 1–4 毫秒。现场转换前的 22.3 秒需要按路径解析、加载源码和等待已有转换分段采样。
- `.test-artifacts/` 约有 9,900 个文件。单变量对照将它排除后，Vite 监听条目从约 13,000 降到约 1,800，首个 CSS 请求从 5.37–6.00 秒降到 0.88–0.96 秒。默认监听下，等测试进程启动 30 秒后再请求，同一 CSS 约 0.40 秒。0373 的隔离测试已排除该目录，日常开发配置仍会监听。

## 工作项

- [ ] **先收窄 Vite 监听。** 在 `vite.config.ts` 的 `server.watch.ignored` 排除 `**/.test-artifacts/**`。使用正常根目录开发配置、新 Vite 进程、保留缓存的前台浏览器做两轮对照，记录从导航到大厅就绪、`modules.workMs`、最慢请求和刷新耗时。验证源码与样式 HMR、`datapack-dev/` 更新回读及四个页面入口。
- [ ] **按界面拆出专用样式。** 对照下方候选，先拆开发专用重复样式和职责清晰的工作区样式。单独记录开发模式与生产预览的大厅就绪时间、首屏样式体积和请求数，以及首次打开耗时。验证首帧已有样式，返回和重开保持层叠、主题、焦点与滚动。首次加载失败时沿用原页面并提示重试。
- [ ] **补齐转换前的计时。** 如果监听调整后仍出现长等待，在 `scripts/vite-startup-diagnostics.ts` 把同一请求的解析、读取或等待已在进行的转换、各转换钩子及响应结束连起来，记录响应状态及 CSS 本地依赖耗时。保留进程冷启动和 Windows 自然重启两组现场样本。

## 渐进装载方案

游戏按已经存在的显示边界装载样式。启动壳沿用 `src/ui/index.html` 内联样式。进入大厅前由 `game.css` 一次装载大厅和共用样式，包括本地字体声明、主题宿主、顶栏、工作区骨架、聊天和弹窗公共规则。工作区与编辑器的专用样式在首次进入前就绪，之后复用。

当前 `game.css` 汇集 23 个样式文件，Vite 开发响应约 **255.4 KB**。地图另有三份 CSS 经渲染器的静态导入随 `ui-module` 到达大厅，合计约 **53.0 KB**。按以下顺序拆分。

| 顺序 | 样式 | 装载时机与边界 |
| --- | --- | --- |
| 1 | `variant-training.css`，源码约 2.4 KB | 从 `game.css` 移除重复引入。开发演练面板通过 `gameplay-b-quick-test-console.ts` 的动态入口和面板自身的 CSS 导入装载。验证 `?devConsole=gameplay-b` 与正式转译演练入口。 |
| 2 | `operation-workspace.css`，源码约 39.8 KB | 第一次开始或恢复 Operation 时加载。规则绑定 Operation 工作区、同源复用栏和独立卡牌悬浮层。用 `controller-actions-operation.ts` 的开始、恢复入口覆盖首次渲染。 |
| 3 | `map-entry-workspace.css` 和 `map-workspace.css`，开发响应约 3.9 KB 与 43.1 KB | 行前准备与实际探索分别装载。撤掉 `map-entry-workspace.ts` 和 `map-workspace.ts` 经 `workspace-renderer.ts` 引入的静态 CSS。显示准备页后可测试预热探索样式，同时覆盖设施转译演练的直接进入、续行、重开和返回。核对通用聊天渲染器输出的地图 Talklet 与关联卡牌样式。 |
| 4 | `area-map.css`、主题编辑、图鉴弹窗 | 区域导航保留 `.area-map-entry`、`.area-hero-story-entry`，打开区域地图时加载画布和详情样式，覆盖 `?areaMapDemo=1`。主题编辑从 `background.css` 提取专用弹窗和图层管理，保留主题宿主、顶栏入口和 Runtime Editor 共用的 `.user-theme-field`。`codex.css` 可分出约 5.7 KB 的图鉴弹窗规则，聊天奖励与文字演出继续随聊天装载。 |

第一批优先落地第 1、2 项，再测地图的首开成本。开发探针仅移出这两份 CSS 后，`game.css` 响应从 **255,407 B 降到 212,528 B**，节省约 **42.9 KB（16.8%）**。同批候选的 CSS 首字节为 0.69–0.71 秒，基线两次为 0.72 秒与 11.49 秒。原始数据见 `.test-artifacts/arona-progressive-css-estimates.log`。

参照 `editor-styles.ts` 的等待和失败反馈，首次点击时保留当前界面，样式就绪后执行会创建 Run 或改路由的命令。把工作区样式限定在对应路由和复用栏，检查先后打开不同工作区时的层叠。区域地图入口、交互浮层、焦点和滚动均随各自使用位置一起验证。

## 当前进展

已记录复发报告、完成监听对照和 CSS 依赖核查，并测得第一批候选的响应体变化。下一步实施监听排除，通过真实浏览器对照后验证 CSS 分批装载。

## 验证入口

- [[startup-and-runtime]] 说明启动报告的读取方式。原始对照保存在 `.test-artifacts/arona-cold-load-watch-default.log`、`.test-artifacts/arona-cold-load-watch-ignored.log` 和 `.test-artifacts/arona-cold-load-watch-default-delayed.log`。
- 使用 `npm test` 验证 `tests/tooling/startup-assets.test.ts` 及变动路由的 UI 行为。生产预览构建使用 `.test-artifacts/` 下的独立目录。
