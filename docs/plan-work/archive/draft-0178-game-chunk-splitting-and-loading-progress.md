# Draft：游戏代码分块加载与启动进度呈现

状态：archived — 讨论、Sol 意见核验和启动事实已转交并由 Task 0179 完成

## 目标与最终方向

缩短用户等待游戏首屏可交互的时间，并在启动及后续按需加载期间清楚说明正在发生什么。代码按实际使用时机拆分，首屏只加载进入当前游戏界面必需的部分；延迟加载的服务在用户进入对应功能前准备好，并提供一致的进度与失败反馈。

本 Draft 讨论两个配套结果：

1. 将当前集中进入游戏入口的代码拆成合适的初始块与按需块。
2. 建立轻量加载状态服务及早期启动界面，让用户能看见启动阶段和等待原因。

这不预先指定动态 import 的模块边界、百分比算法或视觉样式；这些需要先从构建产物和真实等待阶段确定。

## 本阶段语义与边界

- 首期基础是独立于 `#app`、Runtime、UIController 和主题系统的静态 Startup Shell；Shell 负责在入口 JS 可执行前提供反馈，成功挂载主 UI 后直接移除。
- 阶段提示是当前等待原因的投影。bootstrap 保有唯一启动顺序；加载状态服务不维护 pending / active / completed 阶段图，不定义 Runtime 生命周期。
- 默认显示阶段文字和不定进度忙碌态。只有存在可信且稳定的 `loaded / total` 时才显示确定百分比；不得按阶段数量推导百分比。
- B 只按 profile 结果选择少量边界：优先考虑不参与首屏、且有明确首次使用入口的能力；文件大小本身不构成拆分理由。
- Feature 加载可以复用同一状态报告形状，但必须有独立 scope / surface，不能把 Feature 等待表现为全局启动重新开始。
- 本 Draft 的后续施工已转入 [[task-0179-game-loading-feedback-and-lazy-ui-chunks]]。Startup Shell、启动阶段反馈和 profile 支持的少量 B 进入该 Task；Base JSON / 图片拆分仍单独规划。用户确认 Base 数据后续应合理分片，但当前 Task 明确暂不处理 `base-pack/` 内文件体积或组织问题。
- 窄屏适配、Service Worker / 离线缓存、遥测和服务端加载不在范围内。
- 切块不得改变 Runtime 启动顺序、包管理器恢复语义、数据校验和失败回滚行为。

## 当前事实与待核对问题

| 问题 | 已核实依据 | 对方案 / 验收的影响 | 结论状态 |
| --- | --- | --- | --- |
| 当前构建是否有超大 JS 块？ | 最近一次 Vite 构建生成 `game-CVffirb_.js` 1,355.35 kB，gzip 374.61 kB；Vite 报告超过默认 500 kB 阈值，构建成功。 | 说明存在拆分候选，但尚未说明最大组成来源和首屏实际载荷。 | 已核实；构建基线需复测并留档 |
| 首屏到底请求哪些 JS？ | 最近构建的 `web-dist/src/ui/index.html` 加载 `game-CVffirb_.js`，并 modulepreload `presentation-service-0EZ5kM-u.js`（22.35 kB，gzip 8.30 kB）。没有只看入口 chunk 就代表全部初始 JS。 | Initial JS 必须统计 UI 可交互前加载的入口和预加载 JS 总量。 | 已核实 |
| Base 内容对初始载荷的影响？ | `default-datapack.ts` 静态导入 `base-pack/content.json`；文件原始 437,923 bytes，独立 gzip 38,818 bytes。它进入游戏入口依赖图；独立 gzip 数字不等于它在 JS chunk 内的精确边际体积。 | 独立 gzip 体积约为已报告初始 JS gzip 合计的 10%，只能作量级参照，不能归因到最终 JS 体积；仍可能影响解析/执行成本。 | 静态依赖已核实；边际下载 / 执行成本待测 |
| 游戏入口何时才会显示界面？ | `src/ui/index.html` 只有 `#app` 与静态 `type="module"` 入口；`src/ui/main.ts` 静态导入 `UIController`、Runtime bootstrap、开发包 loader 和多份 CSS。入口模块执行后才调用 `boot()`。 | 可在 HTML 加入轻量 shell，但它无法直接知道 JS 下载字节进度。 | 已核实 |
| 目前是否已有按需 JS 加载？ | `src/ui/main.ts`、`src/ui/controller.ts` 的目标功能仍通过静态 import 接线；源码扫描未发现应用侧动态 `import()` 加载边界。构建中的共享 chunk 是 MPA 提取结果，不是按用户功能懒加载的证明。 | B 需要新建按需入口；应验证用户进入能力前确实没有加载目标代码。 | 已核实 |
| boot 阶段顺序是什么？ | `main.ts:boot()` 依次恢复包管理器快照、发现并 reconcile 开发包、`loadDefaultDatapack()`，随后创建并挂载 `UIController`。 | 阶段进度服务应由 bootstrap 发出状态，不能让 UI 控制器成为最早启动依赖。 | 已核实 |
| 哪些功能值得按需拆分？ | `UIController` 静态引入多类 Actions、Workspaces 和 RuntimeEditor；尚未核对其独立 chunk 贡献和加载后的首次交互时机。 | 只把具备明确首次使用入口且对首屏非必需的功能作为候选；切分后验证依赖没有被主图重新拉入。 | 待核对 |
| 哪些启动工作占用时间最多？ | 当前没有按冷启动/热启动记录模块下载、IndexedDB、目录扫描、Registry 校验和 UI mount 耗时的统一基线。 | 决定代码分块能带来多少改善，以及是否还需拆数据或异步初始化。 | 待核对 |
| “进度”是否必须是百分比？ | 当前阶段没有可信、统一的总工作量；各 await 阶段耗时差异很大。 | 默认阶段文字 + busy；确定百分比需要真实稳定的 `loaded / total`。 | 建议采纳 |
| 加载状态由谁编排？ | `main.ts:boot()` 已拥有串行启动顺序。 | bootstrap 仍是唯一顺序权威；状态服务仅投影当前 loading / ready / error，不保有阶段列表或状态机。 | 建议采纳 |

## 方案结构与简洁性评估

### 基础 A：静态 Shell + 极薄状态投影

- `index.html` 提供正常 UI 树外的静态 Startup Shell，少量独立 CSS，不依赖 Runtime、`UIController`、主题树或远程字体。
- 极薄入口用 `import('./main.ts')` 启动 App 并捕获入口模块加载失败；`main.ts` 的 bootstrap 只报告当前等待文字和最终 ready / error。主 UI mount 后直接移除 Shell，不做主题接管动画/状态同步协议。
- 对加载服务的简化建议：它只公开当前 waiting / ready / error 及最小订阅能力，不注册阶段清单、不推断启动顺序、不负责重试策略。顺序仍由 bootstrap 和具体功能入口掌握。
- Shell 的状态通过稳定节点更新文字、`role="status"`、`aria-live="polite"` 和 busy 样式。Shell 的 DOM budget 应限于标题、状态文本、忙碌指示和必要错误/重试区；减少动作与装饰层，施工时再按 UI overlay 写明具体节点数与更新等级。

### 性能施工 B：profile 驱动的少量功能入口切块

- 以“用户何时首次需要该功能”作为边界，再用静态依赖图和 profile 证明它可从初始请求中移除；不按目录、文件大小或 Runtime 内部层次硬拆。
- 首选首屏不需要、且有明确首次使用入口的 UI 功能。Runtime Editor / Theme Editor / 独立 Workspace 只是审计候选，当前没有事实证明它们会形成有效 lazy chunk。
- Vite 的 chunk 划分由模块依赖图决定；验收必须检查 HTML 的入口 / modulepreload、网络请求和 build manifest / 分析结果，确认目标代码没有被其它静态路径带回首屏。
- 首次打开延迟功能时，以局部 loading 状态呈现等待；失败重试只针对该功能。启动 Shell 的状态不在游戏交互后重新激活。

### 延后：Base JSON / 图片资源加载

不属于当前 Task。用户已明确后续会合理分片 Base 数据包 JSON；其文件分组与按需加载仍需独立规划。JSON / 图片资源加载会影响资源定位、fetch、缓存、图片注册、解析、Registry Apply 与失败恢复，不应当作普通 `dynamic import()` 处理。当前 Task 不触碰 Base 文件体积或组织。

## 加载状态 API 候选

为避免第二套 Runtime 生命周期模型，首期候选收敛为“当前状态”，而不是每阶段 pending / active / completed 的记录表：

```ts
type LoadingState =
  | { kind: 'loading'; id: string; label: string }
  | { kind: 'ready' }
  | { kind: 'error'; id: string; message: string; retryable: boolean };
```

启动 bootstrap 逐步替换当前 `loading` 标签，最后 `ready()`；具体顺序不写在服务里。功能加载复用报告形状，但各功能 owner 管自己的 scope / 展示位置，启动和功能不共享一个全局“阶段序号”。这只是候选契约，Task 准入前可再裁剪。

入口 JS 下载期早于 `main.ts` 执行，因此可见 Shell 必须由 HTML 直接提供。百分比只在有可信稳定的字节总量时显示；否则阶段文字加 indeterminate busy。入口模块失败需由动态 import 的 reject 路径捕获；bootstrap 的数据阶段失败再由状态服务投影出来。`retryable` 如何得出，以及包库恢复警告是否阻断启动，沿用既有错误语义，不由通用 Loading Service 裁定。

## 性能指标候选

建议把用户可观察等待拆成三个本地测量指标，不增加遥测：

| 指标 | 定义候选 | 测量边界 |
| --- | --- | --- |
| Shell Visible | 导航开始到静态 Shell 第一次绘制 | HTML / FCP 性能记录或受控浏览器录制 |
| Game Interactive | 导航开始到 `UIController.mount()` 完成，且主界面可交互 | bootstrap performance mark + 浏览器交互确认 |
| Initial JS | Game Interactive 之前加载的全部 JS entry / preload 字节总量 | build 输出统计；冷缓存再用 Resource Timing 核验实际 transfer bytes |

指标先同时记录冷缓存和热缓存，固定设备/浏览器/服务端条件后再设性能目标；“Shell 更早显示”与“游戏更早可交互”分别报告，不能用一个 TTI 数字掩盖两段等待。

## Sol 意见核对与简洁性判断

| Sol 建议 | 核对结果 | 本 Draft 处理 |
| --- | --- | --- |
| 保留 A 为基础，B 只由性能证据决定，C 延后。 | 与当前入口静态依赖、Base JSON 被打入初始依赖图的事实相符；现有数据不足以判断 B 或 C 谁带来更大收益。 | 采纳。先测，再决定是否施工 B；若数据/图片成为主要成本，另立 C 范围。 |
| 加载状态只投影当前情况，不复制 bootstrap 阶段机。 | `main.ts:boot()` 已串行拥有恢复、扫描、默认包加载及 UI mount 顺序。服务若再登记阶段和完成状态，会成为第二份流程定义。 | 采纳，并继续缩小：启动状态由 bootstrap 发布；先不抽象通用 feature scope、重试策略或阶段注册表。只有实际出现重复实现时再抽取共享状态服务。 |
| 默认显示阶段/忙碌，不显示虚构百分比。 | 当前没有稳定的统一工作总量；异步阶段的耗时和工作量不可按阶段数折算。 | 采纳。百分比只在将来能取得可信 `loaded / total` 时加入。 |
| Shell 脱离正常 UI / 主题生命周期。 | HTML 当前只有 `#app` 和模块入口，且应用 CSS 会引入远程字体；静态 Shell 若依赖这些资源就失去提前显示的意义。 | 采纳。Shell 使用少量本地静态样式，成功 mount 后移除；错误呈现和基础可访问性仍需保留。 |
| lazy 边界按首次使用能力划分，不按文件大小或目录划分。 | 现有 UIController 静态引入多个 Actions、Workspaces 与 RuntimeEditor；目前没有应用侧动态加载边界，也未测出各候选的独立收益。 | 采纳为候选筛选原则，不预先指定 RuntimeEditor、Theme Editor 或 Workspace 必须拆分。验收时需证明代码未被其他静态路径带回初始请求。 |
| 加载状态可以共享，但启动和功能加载需分 scope。 | 概念上正确；不过目前尚无多个 feature lazy entry，也没有证据表明需要一个跨功能服务。 | 限定采纳：启动 Shell 与未来功能局部等待不能互相重置。首期不建设通用 scope 管理器，避免为假想的复用提前增加 API。 |
| Base JSON / 图片另立较高风险的数据加载任务。 | JSON 静态进入启动依赖图已核实，但其最终打包边际体积、解析时长和图片耗时均未知。 | Base JSON 后续按机制合理分片的方向已确认，独立于本 Task；是否再做按需加载由 profile 决定。 |
| 记录 Shell Visible、Game Interactive、Initial JS。 | 三者能区分外壳绘制、游戏交互和初始脚本载荷。`UIController.mount()` 是可读的初始候选边界，但源码完成 mount 不自动证明主界面交互可用。 | 采纳为测量候选；将交互确认纳入 Game Interactive 验收，不只依赖单个 performance mark。 |
| Task 前只回答 chunk 构成和启动耗时。 | 这是首轮只读审计的合适收敛；但实施任何懒加载边界时，还必须核验首次使用是否正确加载、失败反馈是否局部，以及首屏请求是否真的减少。 | 采纳为当前下一步；其余验收在有证据决定进入施工 Task 后再细化。 |

### API 简化结论

原 `LoadingState` 候选含 `id`、`retryable` 和可复用的功能 scope，超出了已证实需求。Task 0179 只要求 Shell 所需的最小启动状态投影；启动只有一个顺序 owner，错误是否能重试由具体操作决定。若功能懒加载后来出现一致订阅的真实需求，再单独考虑共享服务。

## 裁定记录

| 待裁定问题 | 当前建议 | 本项目决定 | 依据 / 待验证项 |
| --- | --- | --- | --- |
| 首期是否包含按需功能块 B？ | 只在 bundle 审计与启动 profile 证明有效边界后决定。 | 待审计后裁定 | 目前未有功能 chunk 的收益和首次使用成本数据。 |
| 是否增加 Base JSON / 图片加载 C？ | 单独比较网络、解析、校验及注册成本；若不是主要成本则不扩展。 | 暂不纳入本 Draft 的施工范围 | 现有体积数据不足以定量判断解析成本。 |
| 启动是否显示百分比？ | 显示当前阶段和忙碌状态；只在存在可信总量时显示百分比。 | 采纳 | 当前没有可靠的总量。 |
| 何时抽取通用加载状态服务？ | 先完成启动 Shell 所需的最小状态投影；feature scope 按需演进。 | 延后契约冻结 | 目前只有 bootstrap 单一 owner，预先建设通用 scope / retry API 会增加无证据的抽象。 |
| 性能改善阈值是什么？ | 先采集可复现基线，再在施工 Task 中定义目标。 | 待审计后裁定 | 冷/热缓存、模块请求和交互边界尚未形成基线。 |

## 规划转交

施工列表已转入 [[task-0179-game-loading-feedback-and-lazy-ui-chunks]]。冷 / 热启动测量、首屏请求清单和候选边界审计列为该 Task 的 U1；只有 U1 有证据支持时才执行 UI 代码拆分。Base JSON 按机制分片另行规划，不是 U1 的范围，也不阻塞本 Task。

## 下一步

后续从 Task 0179 的 U1 开始，记录冷 / 热启动与首屏 JavaScript 请求基线，再按 Task 列表推进。当前不冻结通用加载服务 API，也不处理 Base JSON 文件分片。

## 相关路由

- [[docs/docs-829/01-architecture/run-logic]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/ai/frontend-design-project-overlay]]
- [[task-0175-base-packageization-editing-and-swap]]
