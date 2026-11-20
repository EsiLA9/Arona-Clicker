# Task：收窄 AronaClicker 开发文件监听与分阶段装载样式

状态：进行中（待 Windows 自然重启复测）

## 目标与验收

降低 `npm run dev` 首次进入大厅时的 Vite 处理开销，并把后续界面的专用样式移到实际使用的时机。以前序任务 [[ai/plan/task-0373-arona-dev-cold-start]] 的 JSZip 预打包与编辑器样式延迟装载为基线。

## 现场与原因

- 2026-11-20 11:36:57 首次打开游戏约 **57.3 秒**。入口到模块阶段开始约 10.2 秒，模块阶段实际工作 45.9 秒。四个 TypeScript 入口各等约 22.6–22.7 秒才收到首字节。`game.css` 等首字节 45.7 秒，服务端采样时转换前已耗约 22.3 秒，CSS 转换钩子内已耗约 23.2 秒。此次 Vite 为新进程，Windows 自 2026-11-17 00:39 起运行。JSZip 磁盘缓存先于模块阶段落地。
- 浏览器记录的慢请求均为 300 B，符合缓存重新验证。用同一 ETag 访问新 Vite 进程，实测先转换 CSS 再回 304，同进程再次请求只需 1–4 毫秒。现场转换前的 22.3 秒需要按路径解析、加载源码和等待已有转换分段采样。
- `.test-artifacts/` 约有 9,900 个文件。单变量对照将它排除后，Vite 监听条目从约 13,000 降到约 1,800，首个 CSS 请求从 5.37–6.00 秒降到 0.88–0.96 秒。默认监听下，等测试进程启动 30 秒后再请求，同一 CSS 约 0.40 秒。0373 的隔离测试已排除该目录，日常开发配置仍会监听。

## 工作项

- [x] **收窄 Vite 监听。** 根目录开发配置排除 `.test-artifacts/`。保留浏览器 HTTP 缓存和 Vite 磁盘缓存，使用新 Vite 进程完成两轮对照。已验证源码与样式 HMR、`datapack-dev/` 文件变更事件及更新后的 HTTP 回读、四个页面入口。
- [x] **按界面拆出专用样式。** 正式入口在样式就绪后才创建 Run、切换工作区或打开弹窗。开发和生产预览检查首帧样式、返回、重开、滚动容器与焦点恢复。首次加载失败保留当前页面并提示刷新重试。
- [ ] **Windows 自然重启复测。** 按日常时机运行 `npm run dev`，打开游戏并保存首次进入与同进程刷新报告。如果仍出现长等待，再关联请求解析、源码读取或等待在途转换、各转换钩子以及响应状态，记录 CSS 本地依赖耗时。

## 渐进装载方案

游戏按已经存在的显示边界装载样式。启动壳沿用 `src/ui/index.html` 内联样式。进入大厅前由 `game.css` 一次装载大厅和共用样式，包括本地字体声明、主题宿主、顶栏、工作区骨架、聊天和弹窗公共规则。工作区与编辑器的专用样式在首次进入前就绪，之后复用。

拆分前 `game.css` 汇集 23 个样式文件，Vite 开发响应约 **255.4 KB**。地图另有三份 CSS 经渲染器的静态导入随 `ui-module` 到达大厅，合计约 **53.0 KB**。本次按以下顺序拆分。

| 顺序 | 样式 | 装载时机与边界 |
| --- | --- | --- |
| 1 | `variant-training.css`，源码约 2.4 KB | 从 `game.css` 移除重复引入。开发演练面板通过 `gameplay-b-quick-test-console.ts` 的动态入口和面板自身的 CSS 导入装载。验证 `?devConsole=gameplay-b` 与正式转译演练入口。 |
| 2 | `operation-workspace.css`，源码约 39.8 KB | 第一次开始或恢复 Operation 时加载。规则绑定 Operation 工作区、同源复用栏和独立卡牌悬浮层。用 `controller-actions-operation.ts` 的开始、恢复入口覆盖首次渲染。 |
| 3 | `map-entry-workspace.css` 和 `map-workspace.css`，开发响应约 3.9 KB 与 43.1 KB | 行前准备与实际探索分别装载。撤掉 `map-entry-workspace.ts` 和 `map-workspace.ts` 经 `workspace-renderer.ts` 引入的静态 CSS。显示准备页后可测试预热探索样式，同时覆盖设施转译演练的直接进入、续行、重开和返回。核对通用聊天渲染器输出的地图 Talklet 与关联卡牌样式。 |
| 4 | `area-map.css`、主题编辑、图鉴弹窗 | 区域导航保留 `.area-map-entry`、`.area-hero-story-entry`，打开区域地图时加载画布和详情样式，覆盖 `?areaMapDemo=1`。主题编辑从 `background.css` 提取专用弹窗和图层管理，保留主题宿主、顶栏入口和 Runtime Editor 共用的 `.user-theme-field`。`codex.css` 可分出约 5.7 KB 的图鉴弹窗规则，聊天奖励与文字演出继续随聊天装载。 |

第一批落地第 1、2 项，`game.css` 的实际开发响应从 **255,407 B 降到 212,528 B**，节省约 **42.9 KB（16.8%）**。首批探针数据见 `.test-artifacts/arona-progressive-css-estimates.log`。

原有编辑器样式入口扩展为 `surface-styles.ts`。地图准备和探索分别等对应样式，重开确认和演练场直达复用探索样式。区域地图按钮与大厅共用，画布与详情按需加载。主题字段基础样式留给 Runtime Editor，图鉴样式与聊天演出样式分开。本地试玩台在显式启用时先加载地图探索样式，以支持直接启动地图。

## 当前进展

监听配置与四批样式拆分已落地。最终代码的进程冷启动样本里，模块阶段在 1.1 秒内完成。下一步保留一次 Windows 自然重启后的首次进入及刷新样本。

### 监听对照

两组使用相同代码、同一前台浏览器和已预热的 HTTP 与 Vite 磁盘缓存，每次启动新的 Vite 进程。

| 文件监听 | 进入大厅 | 模块阶段实际工作 | 最慢响应 |
| --- | ---: | ---: | --- |
| 默认，第 1 次 | 18.71 秒 | 12.32 秒 | `game.css` 12.20 秒，300 B |
| 默认，第 2 次 | 13.72 秒 | 11.89 秒 | `game.css` 11.07 秒，300 B |
| 排除测试产物，第 1 次 | 1.89 秒 | 0.57 秒 | `main.ts` 0.42 秒，300 B |
| 排除测试产物，第 2 次 | 1.79 秒 | 0.61 秒 | `game.css` 0.44 秒，300 B |

样式拆分前，另一次默认监听试跑在 60 秒内未到大厅。排除监听的同进程刷新在独立试跑中为 0.68–0.83 秒。

回读检查另发现开发包自动发现的目录偏移。位于 `src/ui/development/` 的加载器使用 `../../datapack-dev/**/*`，实际查找 `src/datapack-dev/`，启动报告因此显示零个开发包。修正目录会恢复自动登记根目录中的 ZIP，需要单独核对启用顺序和旧存档。

### 样式验收

| 环境 | 到达大厅前的 CSS 请求 | 响应体大小合计 |
| --- | --- | --- |
| 开发 | 4 → 1 | 308,452 → 184,016 B，减少 40.3% |
| 生产预览 | 2 → 1 | 约 238,800 → 138,016 B，减少 42.2% |

最终独立试跑的大厅就绪时间为开发 1.95 秒、生产预览 0.98 秒。Chrome 检查到 Operation 开始和恢复、地图准备和探索、主题编辑和图鉴的首次加载约 36–55 毫秒，开发区域地图演示首开约 32 毫秒。滚动容器样式随地图首帧就绪，返回准备页聚焦「继续地图」，关闭区域地图聚焦原入口。Story 和 Runtime Editor 以两种顺序打开并重开。Operation 浏览器走查使用测试事件，自动化另覆盖样式等待期间不创建 Run、地图样式未就绪时停在准备页，以及样式失败保留原界面。

## 验证入口

- [[startup-and-runtime]] 说明启动报告的读取方式。原始对照保存在 `.test-artifacts/arona-cold-load-watch-default.log`、`.test-artifacts/arona-cold-load-watch-ignored.log` 和 `.test-artifacts/arona-cold-load-watch-default-delayed.log`。
- 本轮实测见 `.test-artifacts/task-0374-watch-compare.log`、`.test-artifacts/task-0374-hmr.log`、`.test-artifacts/task-0374-final-verified-dev.log` 和 `.test-artifacts/task-0374-final-verified-preview.log`。
- `npm test` 定向覆盖启动资源、启动壳、工作区、玩法 B、区域地图、主题和转译演练，共 52 个文件、521 个测试通过。生产预览构建使用 `.test-artifacts/` 下的独立目录。
