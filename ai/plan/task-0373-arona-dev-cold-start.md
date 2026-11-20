# Task：缩短 AronaClicker 开发冷启动等待

状态：进行中（待 Windows 重启复测）

## 目标与验收

缩短 `npm run dev` 首次打开 AronaClicker 时「装载游戏模块与样式」的等待。按下面的顺序逐项交付，每项记录独立的前后对照和功能回归结果。用现有启动诊断跟踪 `modules.workMs`、最慢的导入和请求，另记录从导航到大厅就绪的总耗时，检查等待是否转移到了后续步骤。

## 调查依据

- 2026-11-20 10:49 的实际启动耗时约 28.2 秒，第一步占 26.4 秒。`game.css` 请求约 25.9 秒，其中 Vite 样式转换约 11.8 秒，浏览器接收约 1.9 毫秒。它在开发模式下合并 25 个本地样式文件。三个引用 `jszip` 的 TypeScript 模块同时等待依赖解析约 11.8 秒，Vite 的 `jszip` 磁盘缓存随后生成。
- 本机两轮隔离空缓存对照中，默认配置扫描四个 HTML 入口用了 5.54–5.65 秒。显式预打包 `jszip` 并停用自动发现后，`zip-loader.ts` 的转换从约 5.6 秒降到 10–12 毫秒，`game.css` 仍约 4 秒。该对照测的是单个 Vite 请求，整机重启后的大厅就绪时间待复测。

## 工作项

- [x] **1. 缩短 Vite 依赖扫描。** 在 `vite.config.ts` 启用 `optimizeDeps: { noDiscovery: true, include: ['jszip'] }`。已用独立空缓存对照并保留磁盘缓存重启开发进程。四个开发入口可用，游戏与独立 Datapack Editor 的 ZIP 读写已往返验证。清单维护规则见 [[startup-and-runtime]]。
- [x] **2. 减少首屏样式。** 大厅与共享条件选择器的样式从 `game.css` 交付。Story 与 Runtime Editor 专用样式由 `editor-styles.ts` 在首次打开时加载。开发和生产预览均验证两种打开顺序、关闭、返回和重新打开。记录首屏与首次打开耗时如下。
- [ ] **3. 验证重启体验和试玩预览。** 在一次自然的 Windows 重启后，用同一浏览器、前台标签页和保留的缓存记录第一次进入 `/game`，再测同进程刷新。用现有 Vite 构建预览验证 `/game` 可进入大厅，并记录本地试玩命令。复盘此前约 26 秒和 70 秒的现场，记录仍然存在的长等待和可定位的环节。

## 当前进展

- 开发优化与回归已完成。通过独立缓存和进程重启覆盖冷、暖开发启动，浏览器生产预览也已进入大厅。
- 11:36 的复发记录、Vite 监听对照和后续 CSS 装载方案见 [[ai/plan/task-0374-arona-vite-watch-and-progressive-css]]。
- 下次 Windows 自然重启后，记录同一前台浏览器首次进入 `/game` 和同进程刷新。保留现有浏览器与 Vite 磁盘缓存，核对系统启动时间，并保存两次 `window.__startupLog.report()`。当前验证时 Windows 自 2026-11-17 00:39 起运行。

## 对照结果

2026-11-20 用前台状态的隔离 Chrome 会话执行两轮。每种配置从空 Vite 缓存开始，再用原磁盘缓存启动新的 Node 进程。每轮变更只比较相邻工作项。开发响应体大小为浏览器解码后的字节数。

| 开发配置 | 空缓存首步工作耗时 | 空缓存大厅就绪 | `game.css` 响应体 | 保留缓存重启 Vite 后大厅就绪 |
| --- | ---: | ---: | ---: | ---: |
| 自动扫描、完整样式 | 1.57–1.58 秒 | 2.80–3.00 秒 | 364,169 B | 2.08–2.59 秒 |
| 显式预打包、完整样式 | 0.74–1.36 秒 | 2.50–2.55 秒 | 364,169 B | 2.14–2.44 秒 |
| 显式预打包、延迟编辑器样式 | 1.38–1.44 秒 | 2.57–2.67 秒 | 255,407 B | 2.25–2.33 秒 |

- 默认配置扫描耗时 1.86–1.91 秒。显式配置跳过扫描，两轮都复用了下一次进程启动时的预打包缓存。浏览器确实请求了预打包的 `jszip.js` 完成实际 ZIP 操作。
- 样式拆分使首屏样式响应减少约 109 KB（30%）。隔离请求的首字节耗时约 758 毫秒，拆分后约 764–769 毫秒。本轮没有观察到样式拆分带来稳定的总耗时收益。同页第一次打开 Story 编辑器约 30–37 毫秒，两次相对基线分别增加约 7 毫秒和减少约 1 毫秒。Runtime Editor 约 20–25 毫秒，分别增加约 12 毫秒和减少约 4 毫秒。结果受本机执行负载影响。
- 优化后的开发模式同进程刷新约 0.67–0.71 秒。生产预览首次进入大厅约 0.71 秒，同进程刷新约 0.45 秒。试玩命令见 [[startup-and-runtime]]。开发和生产浏览器中，首次插入编辑器内容时样式已生效。也验证了从数据包工作区直接进入 Runtime Editor，以及两个产品间的 ZIP 往返。
- 现场两次长等候集中在同源资源的首字节。较短现场的 CSS 转换与多个 ZIP 导入解析同时占约 12 秒，较长现场还出现了本地请求排队。当前实验窗口没有复现这两次等候。Windows 重启后的机器负载和文件缓存仍需现场复测。

## 验证入口

- [[startup-and-runtime]] 说明 `window.__startupLog.report()` 以及 `moduleResources`、`moduleServerTiming` 的读法。对照时记录 Windows 与 Vite 进程的冷暖状态、浏览器可见性和预打包缓存状态。临时采样和日志放在 `.test-artifacts/`。
- 对照原始日志为 `.test-artifacts/task-0373-paired-*.log`、`.test-artifacts/task-0373-css-compare.log`、`.test-artifacts/task-0373-process-zip.log` 和 `.test-artifacts/task-0373-preview-final.log`。模块与编辑器交互的自动化验证涉及 `tests/tooling/startup-assets.test.ts`、`tests/ui/startup/`、`tests/ui/workspace/topbar-settings-workspace.test.ts` 和 ZIP 回归。
- 定向回归通过 22 个文件、179 项测试。扩大回归有 66 个文件、537 项通过，`tests/ui/story/story-editor-authoring.test.ts` 的测试进程达到 Node 内存上限，35 项未报告结果。完整记录见 `.test-artifacts/task-0373-regression-wide-full.log`。
- TypeScript 检查、架构检查、文档检查和生产构建通过。构建输出位于 `.test-artifacts/`。
