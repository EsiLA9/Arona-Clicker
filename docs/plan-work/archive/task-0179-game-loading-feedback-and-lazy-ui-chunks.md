# Task：游戏启动反馈与 UI 按需代码加载

状态：done — 启动 Shell、最小状态反馈、ZIP 按需加载与生产构建 / 浏览器核验完成

## 目标

让游戏在入口 JavaScript 执行前已有清楚的启动反馈；让启动等待阶段可以解释；并根据实际构建与耗时数据，拆出首屏不需要、且具有明确首次使用入口的 UI 代码。

本 Task 不以代码文件数量或单个 chunk 大小作为目标。先记录当前基线，再选择能减少首屏下载或启动工作、且不改变 Runtime 行为的最小施工边界。

## Task 列表与顺序

| 单元 | 内容 | 交付 / 退出条件 |
| --- | --- | --- |
| U1 启动与 bundle 基线 | 统计首屏入口及 modulepreload 的 JavaScript 请求；冷 / 热缓存下测量页面开始、入口 JS 可执行、Runtime/bootstrap 与主 UI 交接。bootstrap 内只记录恢复包管理器、开发包扫描 / 对账、默认包 Apply 等已有 await 边界。 | 记录环境、方法、请求组成、阶段耗时和基线；识别或否决有证据的 lazy 候选。若候选无实际收益，记录结论并不做 B。测量优先复用现有异步边界，不为细化数据拆分函数、改变控制流或建立长期性能 instrumentation。 |
| U2 静态 Startup Shell | 在 `#app` 外加入轻量静态启动壳；提供入口模块尚未成功执行时的基础加载与失败反馈。主入口执行后由 U3 接管状态更新；主 UI 完成 mount 且不存在阻断启动错误后移除 Shell。 | HTML/CSS 不依赖 Runtime、主题或远程字体；Shell 在入口 JS 执行前可见且状态语义可访问。入口模块无法成功启动应用时，Shell 不永久停留在无解释的 busy 状态；可在 HTML 内使用最小的 module import rejection handler，不新增独立 loader 文件或 framework。 |
| U3 极薄启动状态投影 | bootstrap 仍独占启动顺序，只把当前必要状态传给 Shell。默认阶段文字和不定忙碌态；仅当来源能提供可信 `loaded / total` 时才显示百分比。 | U3 负责 `bootstrap → Shell` 的极薄通信，不新增第二套阶段注册表、启动状态机、通用 feature scope 或重试策略。**不要求建立独立 Service / Class**；简单函数、回调或 DOM adapter 足够时采用更小实现。错误重试由具体操作 owner 决定。 |
| U4 证据支持的 UI lazy 边界 | 依据 U1 选择首屏非必需且有明确首次使用入口的最小功能边界；仅在验证能从初始请求图移除代码后实施。首期优先实施 1～3 个收益最明确的边界；更多候选记录即可，不要求穷尽所有 UI。首次打开时在对应功能局部反馈等待及失败。 | 对每个实施边界记录首屏代码 / 请求变化、首次进入加载表现和失败处理；无明显首屏收益或会扰动 Runtime 顺序的候选不拆。证明静态依赖改为功能入口动态加载后，目标代码确实离开 initial graph，首次打开仍能正常加载。 |
| U5 验收与结果记录 | 复测同条件冷 / 热启动、初始 JavaScript 请求和实际交互可用时间；检查功能首次使用及启动失败路径。 | 结果与基线并列；说明达到的变化与尚未解决的瓶颈；更新本 Task 最终核验后归档。 |

### U1 基线收据（2026-10-02）

- 生产构建：Vite 5.4.21；使用临时输出目录和本机 Vite Preview，未将构建产物作为源码提交。`game` entry 原始 1,355,345 bytes（报告 1,355.35 kB，gzip 374.61 kB），shared `presentation-service` 为 22,345 bytes（gzip 8.30 kB）。
- 浏览器冷缓存首屏实际请求两份 JS：`game` 375,261 encoded bytes、`presentation-service` 8,676 encoded bytes，合计 383,937 bytes；初始 CSS 28,906 bytes。主 UI mount 以 `#load-game-init` 可见为边界。
- 本机无 CPU / 网络限速，禁用缓存导航到 mount：1,391 / 453 / 425 ms；启用缓存 reload：250 / 113 / 111 ms。前者中位数 453 ms，后者中位数 113 ms。首次导航包含预览与浏览器初始化开销；这些数值只作同环境代码变更对照，不代表用户网络性能目标。
- Rollup module summary：`game` entry 含 321 个模块；`jszip` 单模块 rendered size 97,686 bytes。ZIP 解析和归档写入是明确文件导入 / 导出动作；开发包目录当前没有 ZIP 包。将 JSZip 延至这些入口首次调用时加载，是本期唯一已选 lazy 边界。
- Base JSON 本次只作为已知静态入口依赖保留；依用户当前范围，不比较、拆分或用其文件长度决定本 Task 的 lazy 边界。

### 施工进展收据（2026-10-02）

- 启动 Shell 以 HTML 静态节点和内联样式绘制；`main.ts` 只更新现有 status 节点，在 mount 完成后移除 Shell。bootstrap 错误与入口 module script 加载失败分别有最小可见反馈，没有增加独立 loader 文件或状态 Service / Class。
- ZIP parser、ZIP loader 和归档 writer 延迟导入 JSZip。生产构建生成独立 `jszip.min` 动态 chunk（97.59 kB，gzip 30.31 kB）；初始 `game` entry 从 1,355.35 kB / gzip 374.61 kB 降到 1,258.98 kB / gzip 344.94 kB。
- 相同本机生产预览、主 UI mount 判据的复测：禁用缓存 442 / 428 / 427 ms（中位数 428 ms）；启用缓存 106 / 153 / 102 ms（中位数 106 ms）。与 U1 基线相差约 25 ms / 7 ms，视为本机测量波动，不据此宣称启动时间已显著缩短。
- 首屏 JS 实际请求从 383,937 encoded bytes 降至 354,249 encoded bytes；最终请求只有 `game` 与 `presentation-service`，没有 `jszip`。约 29.7 KB gzip 的确定节省来自 ZIP 引擎退出 initial graph。
- 桌面浏览器确认生产页 mount 后显示原主 UI、限速时静态 Shell 先于应用出现、拦截 game entry 时 Shell 显示错误且 `aria-busy=false`；解除拦截后可重新正常启动。Shell DOM 预算为 4 个元素（容器、产品标识、标题、status），视觉线和忙碌点均用 CSS pseudo-element。

## 范围

- `src/ui/index.html`、UI bootstrap 与启动所需的最小状态呈现。
- bundle 组成和启动阶段的本地测量，不增加遥测或服务端监控。
- 仅对 U1 证明有效的 UI 代码使用动态加载；允许最终结论是不需要拆分。
- 加载百分比仅依赖可信工作总量；当前预期以阶段文案和不定忙碌态为主。
- 保持 `PackManager` 快照恢复、开发包来源 reconcile、默认包 Apply、Registry 校验及失败恢复语义不变。
- 不适配窄屏；遵守 [[docs/ai/frontend-design-project-overlay]] 的 DOM 更新、无障碍、焦点和连续性约束。

## 明确非目标

- 不拆分、重命名或重新组织 `src/arona-clicker/content/base-pack/` 下的 Base JSON；不处理该文件夹内 JSON 体积或行数。
- 不把 Base `content.json` 转为多份机制 JSON，不改变 `default-datapack.ts`、Base manifest 或 `AronaClickerRuntime` 的静态 Base 导入。
- 不实现按需下载 Base 数据、Registry 局部加载、数据包文件获取服务或图片资源懒加载。
- 不改变 Datapack Schema、包启用 / 交换 / 编辑态、存档结构或 Runtime 启动顺序。
- 不引入 Service Worker、离线缓存、遥测或真实字节百分比的模拟值。
- 不预先拆分 RuntimeEditor、Theme Editor 或 Workspace；这些仅在 U1 确认首屏成本与首次使用时机后作为候选。
- 不把启动反馈扩展为通用 Loading Service / Manager / Registry / Scope / Task 系统；若最终实现明显复杂于“静态 Shell → bootstrap 更新当前状态 → mount 后移除 Shell”及局部 `import()`，Task 收据需解释额外复杂度的必要性。

> 后续方向：Base 内容继续保留在标准数据包目录中，并按机制合理分片；该方向单独规划，不是本 Task 的前置条件或验收项。当前 `parsePack()` 已支持多个 JSON fragment 合并，但产品 Base 仍由 `default-datapack.ts` 静态引用单一 `content.json`；仅有 parser 能力不代表 Runtime 已按需加载。

## 必须核对

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/01-architecture/run-logic]]
- [[docs/docs-829/02-modules/ui]]
- [[pack-loading]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/testing]]
- [[docs/ai/frontend-design-project-overlay]]
- `src/ui/index.html`
- `src/ui/main.ts`
- `src/app/runtime-bootstrap.ts`
- `src/arona-clicker/runtime.ts`
- `src/arona-clicker/content/default-datapack.ts`
- `src/data-services/datapack/pack-parser.ts`
- `vite.config.ts` 与构建输出

## 验收

- 启动基线可复测：记录设备 / 浏览器、构建版本、缓存状态、请求清单及各启动阶段时间。
- Startup Shell 在主入口模块开始执行前可见，不依赖应用 Runtime、主题 CSS 或网络字体；主 UI 完成 mount 且没有阻断启动错误后移除。
- 入口模块无法成功启动应用时，Shell 不永久停留在无解释的 busy 状态；bootstrap 阶段失败有可见且可访问的反馈；可使用 HTML 内联的最小 module import rejection handler，不引入独立 loader / framework 做错误分类；已存在的恢复和重试语义不被覆盖。
- 启动文案反映 bootstrap 当前动作，不维护第二份阶段顺序；不确定总量时不显示百分比。
- 每个实施的 lazy 边界都经构建依赖、首屏网络请求和首次功能进入核验，目标代码没有被其他静态路径重新带入首屏。
- 代码切分不得改变 PackManager、Runtime Apply、Registry 校验与回滚语义；lazy chunk 加载失败仅影响其所属功能，不反向改变已经完成的游戏启动状态，失败反馈保持在对应功能区域。
- 前后指标在同设备 / 浏览器及同缓存条件下比较；若测量后不实施 B，记录依据并完成 A 的验收。
- 定向行为测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check` 通过；涉及交互的部分完成桌面浏览器验收。

## 相关文档

- [[draft-0178-game-chunk-splitting-and-loading-progress]]
- [[task-0175-base-packageization-editing-and-swap]]
- [[task-0177-base-typescript-datapack-folder-export]]

## 最终核验（2026-10-02）

- `npx tsc --noEmit` 通过；`npm run check:architecture` 通过；`npm run check:docs` 通过（524 份 Markdown，0 errors）；`git diff --check` 通过。
- Task 定向 5 个测试文件全部通过，共 28 项：pack parser、ZIP loader、archive writer、开发包 loader、RuntimeEditor pack export。
- 全量 `npm test`：204 个文件中 201 个通过；1,870 项中 1,866 通过，4 项失败，分别在 `tests/engine/gear-system.test.ts`、`tests/ui/controller-init-select.test.ts` 与 `tests/ui/ui-host-registry.test.ts`。失败断言涉及当时已有的 Gear 内容、Init 选择和 UI Host 注册工作区差异；这些文件 / 关联工作区变更在本 Task 开始前已存在，且不在本 Task 修改范围，本 Task 未改写这些机制或测试。
- Vite 生产构建成功（输出到临时目录）。初始 `game` JS 为 1,258.98 kB / gzip 344.94 kB；JSZip 成为 97.59 kB / gzip 30.31 kB 的动态 chunk，首屏实测 JS encoded bytes 减少 29,688 bytes。Vite 仍提示 game chunk 超过 500 kB；Base JSON 与其他初始依赖保持本 Task 规定的范围，不作进一步拆分。
- 同设备 / 本机生产预览复测的 mount 中位数：禁用缓存 428 ms，启用缓存 106 ms；相对 U1 基线的差值处于本地测量波动范围，不声明可感知的启动时间改善。
- 桌面浏览器确认常规 mount、限速下 Shell 提前显示、主入口脚本被拦截时 Shell 错误反馈与恢复启动。浏览器测试结束时已解除网络限速 / URL 拦截，并恢复正常页面。
