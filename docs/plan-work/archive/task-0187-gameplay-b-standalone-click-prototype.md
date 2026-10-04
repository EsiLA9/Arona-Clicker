# Task：玩法 B 独立启动与最小 Click 原型

状态：complete — 独立包、确定性场所 Runtime、三栏 Click 页面与桌面浏览器验收完成；已交接 0188

## 目标

在独立目录运行一个可见的三栏技术样本：四人执行活动度为 2 的场所，再自动进入出口；第三次 Click 后结束。

## 设计边界

- 本 Task 包含：独立包、集中状态写入口、只读视图、可播种随机、结构化事件日志和最小页面。采用文字头像占位；技术场景不冒充正式十二节点路线。
- 用户于 2026-10-03 授权 Goal 完成 Task 0186–0193，并于 2026-10-04 验收；本 Task 现进入代码施工。玩法 B 始终仅在 `prototypes/gameplay-b/` 独立运行。
- 共用边界：原型放在拟新增的 `prototypes/gameplay-b/`，自身声明通用 TypeScript/Vite/Vitest 依赖，使用普通 DOM/CSS；不依赖 AC 的 Engine、StateMutationService、PlayerState、Registry、Datapack、Story、UI、CSS、内容、资源、存档或服务。所有原型写入集中由自身 Runtime 完成，UI 只消费只读视图；不为遵守 AC 部件约定反向引入 AC 依赖。
- 非目标：存档及迁移、AC 接入、实时循环、自动战斗、编队、手选牌、分支路线、经济/成长系统。开发 seed 与场景夹具不形成玩家操作；玩家只以 Click 推进，刷新页面可重开。
- 设计来源：[[draft-0185-gameplay-b-progressive-prototype-tasks]] 与本 Task Read Set。候选推荐不自动等于用户裁定；正式基线由 [[task-0186-gameplay-b-prototype-rule-baseline]] 记录。

## 依赖与开工门槛

直接前置：[[task-0186-gameplay-b-prototype-rule-baseline]] 已完成并交接。本 Task 按其已记录的 R06/R09/R10 原型暂定默认实现；用户次日验收可要求修订，并需运行受影响回归。不得将暂定默认说成用户逐项确认。

开工时核对前置实际产物与下列拟定落点；不存在的前置文件视为交接缺项，不能假定已有实现。路径与既有签名不一致时先更新 Task 白名单和 Unit，禁止为套用计划重写已验收产物。

## 当前事实与代码落点

| 已核实事实 | 依据 | 对施工的影响 |
| --- | --- | --- |
| 0181–0184 为规则/内容/UI/引擎候选，尚非当前机制 | 对应 Draft 的状态与边界 | 不把建议或历史例子当成已实现能力 |
| 2026-10-03 检查时原型目录不存在 | 本轮 `Test-Path prototypes/gameplay-b` 返回 False | 以下代码路径均为拟新增/后续交接路径，未声称存在符号 |
| 主仓库已有通用 TS/Vite/Vitest | 根 `package.json` | 工具可另行声明，自身配置不能依赖主仓库 |
| 当前 Goal 要求按序完成 0186–0193 并于 2026-10-04 验收 | 用户 2026-10-03 明确授权 | 独立原型代码、测试、UI 与交付验证现已获授权；仍不接入 AC |

## Must Read / Read Set

- [[docs/docs-829/00-INDEX]]、[[docs/ai/PROJECT-CONSTITUTION]]。
- [[draft-0183-gameplay-b-ui]]、[[draft-0184-gameplay-b-sample-engine]]，只读本阶段涉及小节。
- [[task-0186-gameplay-b-prototype-rule-baseline]] 的交接/Receipt；[[task-0186-gameplay-b-prototype-rule-baseline]] 的对应规则与案例。
- 本 Task 每个切片列出的目标文件及其直接相关测试；开工后按实际产物定位，不默认读全部原型代码。

## 施工切片

各切片按顺序执行。下列是具体施工范围；执行前按 [[docs/ai/templates/patch-unit]] 将该切片展开为本 Task 内联 Unit，补齐实际符号、Confirmed Facts 与验证方式，不改变目标。每个 Unit 包含本 Task 记录在内最多 3–5 文件、约 300–500 行净改动；超预算先拆 Unit，单 Task 超过 3 个 Unit 时按协议拆出目录。不得用目录通配白名单替代下列文件范围。

### P0：独立工程

- Goal：建立自身依赖与锁文件，提供 dev/test/typecheck/build；tsconfig 不 extends AC 配置，README 写明本包工作目录。
- Allowed Files：`prototypes/gameplay-b/package.json`、`prototypes/gameplay-b/package-lock.json`、`prototypes/gameplay-b/tsconfig.json`、`prototypes/gameplay-b/README.md`；以及本 Task 的 Unit / Receipt 记录。
- Completion Criteria：可在原型目录安装自身依赖；脚本显式使用本包根与测试范围，不能向上寻找 AC 配置。
- Verification：安装与配置检查；完整运行验证在 P2 完成。

#### Patch Unit 0187-U1：独立 package 配置

##### Goal

建立只在 `prototypes/gameplay-b/` 运行的 TypeScript/Vite/Vitest 包和可复现锁文件，为后续 Runtime 与页面提供本地脚本；不创建业务源码。

##### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由 | `docs/docs-829/00-INDEX.md` | 遵循项目边界 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md` | Unit、白名单、验证与收据规则 |
| 前置 | `docs/plan-work/task-0186-gameplay-b-prototype-rule-baseline.md`：原型边界、字段契约与 Goal 执行补充收据 | 不引入 AC 依赖；使用原型暂定规则 |
| 目标 | 本 Task P0 与 U1 | 确认包路径、脚本与验收范围 |

##### Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 5k–15k token；只检查独立包配置 |
| 文档 Read Set | 上表文档和本 Task |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并上报，不读取 AC package 或配置作为模板 |

##### Optional Read Set

- 无。不得读取或继承根 package、tsconfig、Vite/Vitest 配置。

##### Do Not Read by Default

- `src/**`、`tests/**`、主应用 package/config、`node_modules/**`。

##### Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 原型目录在本 Task 开始前不存在 | 2026-10-03 `Test-Path prototypes/gameplay-b` 返回 False | 所有包文件为本 Unit 新建 |
| 用户授权独立原型系列施工，不授权接入 AC | 用户 2026-10-03 Goal；Task 0186 Goal 执行补充收据 | R06/R09/R10 暂定默认不属于用户逐项确认 |

##### Constraints

- 仅在原型子目录声明自身依赖、锁文件和工具配置；所有命令可从本目录独立运行。
- TypeScript 不 extends 仓库或 AC 配置；禁止 AC 别名、源码路径、资源请求和父级 node_modules 依赖。
- 保留 Node/Vite/Vitest 的锁定版本；不改根 `package.json`、根锁文件、主应用或 AC 文件。

##### Allowed Files

- `prototypes/gameplay-b/package.json`
- `prototypes/gameplay-b/package-lock.json`
- `prototypes/gameplay-b/tsconfig.json`
- `prototypes/gameplay-b/README.md`
- `docs/plan-work/task-0187-gameplay-b-standalone-click-prototype.md`

##### Explicit Non-goals

- 不创建 TypeScript 源码、测试、HTML/CSS、Vite 配置或 `node_modules` 提交内容。
- 不改根 package/配置，不添加 AC import，不在本 Unit 声称测试、类型检查、构建或浏览器通过。

##### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件；如要增加第五个配置文件或影响白名单外内容，先停止并拆分/调整 Unit。

##### Completion Criteria

- [x] `package.json` 具有独立的 `dev`、`test`、`typecheck`、`build` 脚本，显式将根/测试范围限制在原型包内。
- [x] `package-lock.json` 与 manifest 一致，可在原型目录执行 `npm ci`。
- [x] `tsconfig.json` 自足，不引用仓库父级或 AC 配置。
- [x] README 写明当前目录中的安装、脚本和预期边界，不声称未做的 UI/机制验收。

##### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 独立安装 | 在 `prototypes/gameplay-b/` 执行 `npm ci` | 使用本包锁文件安装成功 |
| 包配置 | `npm pkg get scripts devDependencies` | 脚本与依赖均属于本包 |
| 边界 | 检查四个白名单文件 | 无根配置继承、AC import 或父目录路径 |

##### Execution Receipt 0187-U1

| 项 | 内容 |
| --- | --- |
| 状态 | 完成（包配置已建立；未声称源码测试或运行验收通过） |
| 实际修改 | 新建 `prototypes/gameplay-b/package.json`、`package-lock.json`、`tsconfig.json`、`README.md`；测试脚本固定本包根目录，不固定测试路径，README 已对应更新。 |
| 未完成内容 | P0 未执行源码测试、类型检查、构建或浏览器运行；这些留待后续单元提供源码/页面后验收。 |
| 范围外变更 | 无。未创建源码、测试、HTML/CSS 或 Vite 页面配置；`npm ci` 在原型本地安装依赖，`node_modules` 为忽略的本地目录；未修改仓库根或 AC。 |

###### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 锁文件生成 | 删除本包原锁文件后执行 `npm install --package-lock-only --registry=https://registry.npmjs.org --replace-registry-host=always`（在 `prototypes/gameplay-b/`） | 通过 | manifest / lock 只声明 TypeScript `^7.0.2`、Vite `^8.3.2`、Vitest `^5.0.3`；锁文件含 81 个官方 npm registry resolved URL，个人镜像 URL 数为 0。 |
| 独立安装预检 | `npm ci --dry-run`（在 `prototypes/gameplay-b/`） | 通过 | npm 规划 37 个包。环境：Node `v26.7.0` / npm `11.19.0`。 |
| 独立安装 | `npm ci`（在 `prototypes/gameplay-b/`） | 通过 | 安装 37 个包；仅在原型包下生成本地 `node_modules`。 |
| 包配置 | `npm pkg get scripts devDependencies`（在 `prototypes/gameplay-b/`） | 通过 | 输出包含 `dev`、`test`、`typecheck`、`build` 四个脚本及上述三项依赖；`test` 为 `vitest run --root .`，可附加定向路径参数。 |
| 独立边界 | 核对四个包文件和 README | 通过 | Vite 根为 `.`，Vitest 根为 `.` 且不固定测试路径，类型检查指向 `./tsconfig.json`；TS 配置无 `extends`，无父级配置或 AC 路径引用。 |
| 文档/空白 | `npm run check:docs`；对四个包文件和本 Receipt 扫描行尾空白 | 通过 | 文档检查 538 篇、0 errors；行尾空白扫描无匹配。 |
| 源码验证 | `npm test`、`npm run typecheck`、`npm run build`、`npm run dev` | 未执行 | P0 不含测试、源码或 HTML；遵循 Unit 边界，不把空测试或未运行脚本记作通过。 |

###### 遇到问题

- 初次锁文件生成使用了个人 npm 镜像地址；按复审要求删除并从官方 registry 重生成，最终确认 81 个官方 registry URL、0 个镜像 URL。一次额外的 PowerShell 锁文件读取使用默认 `ConvertFrom-Json` 时因根记录空名称属性报错，改用 `-AsHashtable` 后核对成功；npm 校验未失败。

###### 需上游确认项

- 无。

###### 事实更新建议

- 无。

###### 构建参数修正补充收据（2026-10-03）

- P2 首次构建发现 Vite CLI 将 root 定义为位置参数，不接受 `vite --root .` / `vite build --root .`。
- 修正本 Unit 白名单内 `prototypes/gameplay-b/package.json` 脚本为 `vite .`、`vite build .`；锁文件无依赖变化，无需更新。
- 在原型包执行 `npm exec vite -- --help` 确认 `vite [root]` 与 `vite build [root]` 语法；随后 `npm test`、`npm run typecheck`、`npm run build` 均通过。build 输出本包 `dist/index.html`、CSS 与 JS bundle。
- 原 U3 Stop Condition 已由上游修复前置配置解除；U3 仍需完成 dev 与真实浏览器验收。

### P1：最小运行状态

- Goal：定义局部 model、可播种 random、Runtime 的集中推进/只读查询；将场所数据作为输入，不内嵌 AC 资源。
- Allowed Files：`prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/random.ts`、`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/tests/runtime.test.ts`；以及本 Task 的 Unit / Receipt 记录。
- Completion Criteria：两次活动与第三次出口结束可用无 UI 测试复现；同 seed 同输入结果一致；终态不推进。
- Verification：运行本节影响的定向测试及本 Task 下方验证入口；有 UI 变化再做对应浏览器冒烟。

#### Patch Unit 0187-U2：确定性场所 Runtime

##### Goal

实现四名初始 Chara 在活动度为 2 的场所逐 Click 行动、自动进入出口、第三次 Click 终止的最小纯 TypeScript Runtime。所有状态变更集中在 Runtime；同 seed 与同样 Click 序列产生完全相同的只读视图和事件。

##### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由 | `docs/docs-829/00-INDEX.md` | 遵循当前文档边界 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md` | 白名单、Unit 与收据纪律 |
| 规则基线 | 本 Task P1、0186 字段契约及案例 1 | 固定活动度、Click 与自动推进语义 |
| 接口草案 | `draft-0184-gameplay-b-sample-engine.md` 的最小状态、非战斗场所、随机与日志约定 | 保持模型与事件含义一致 |
| 目标代码 | `prototypes/gameplay-b/package.json`、`tsconfig.json` | 确认脚本与编译范围；不得读 AC 配置 |

##### Confirmed Facts

- 独立包配置位于 `prototypes/gameplay-b/`，无业务源码、测试或页面；Vitest 脚本固定该包为 root。
- 玩家只有 Click 推进输入；每个活动度由一次全队活动 Click 消耗，耗尽后自动进入下一场所。
- 首版 P1 仅使用四名初始 Chara；展示路线是技术夹具，不声称为十二节点正式 Demo。
- 独立原型不得依赖、修改或接入 AC 的源码、配置、资源或运行时。

##### Constraints

- 随机数只能在 Runtime 的推进操作中抽取；构造、读取视图和渲染输入不得抽取随机数。
- Runtime 是状态唯一写入口；视图返回副本/只读对象，调用方篡改视图不能改变运行状态。
- HP=0 的角色不参加活动；P1 活动效果不造成伤害，避免另行引入伤害规则。
- 到达终态后 Click 是幂等 no-op，不追加事件、不推进随机序列。
- 同 seed、配置和 Click 序列需得到相同的角色结果、骰值、事件顺序及终态。

##### Allowed Files

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/random.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `docs/plan-work/task-0187-gameplay-b-standalone-click-prototype.md`

##### Explicit Non-goals

- 不实现战斗、sCost、普通牌/免费技能、营地、正式十二节点配置、持久化或用户选项。
- 不创建 UI、CSS、HTML、图片/AC 资源或服务器调用；不修改根 package/config。
- 不加入非 Click 玩家输入；开发测试中的 seed/config 由调用方传入。

##### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件。若需新增文件、改包配置或读取 AC 源码，先停止并交回上游；不通过扩大范围解决接口争议。

##### Completion Criteria

- [x] 模型区分场所输入配置、运行态、事件记录与只读视图；不持有 AC 类型或可变外部配置引用。
- [x] 可播种 PRNG 的初始化和抽取确定；只由活动推进抽取，每条个人结果记录所用骰值。
- [x] 新局初始为四名在队角色、活动度 2 的活动场所；Click 1/2 各让每名存活角色行动一次并消耗 1 活动度；第二次后自动进入出口但不执行出口。
- [x] 第三次 Click 结束 Demo；终态后重复 Click 不改变状态、日志或随机计数。
- [x] 同 seed 的两次运行输出完全一致；不同 seed 在覆盖的随机范围内能产生差异。
- [x] `npm test` 与 `npm run typecheck` 在原型目录执行通过。

##### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向行为 | 在 `prototypes/gameplay-b/` 执行 `npm test` | 活动进度、自动入场、第三次终止、视图隔离、终态幂等及 seed 确定性用例通过 |
| 类型 | 在 `prototypes/gameplay-b/` 执行 `npm run typecheck` | TS 严格检查通过 |
| 独立边界 | 审查 U2 白名单文件 | 无 AC import、父级配置/资源引用或越界操作 |

##### Execution Receipt 0187-U2

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；U2 的定向测试与类型检查通过。未运行 build/dev，留给 P2。 |
| 实际修改 | 新建 `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/random.ts`、`prototypes/gameplay-b/src/runtime.ts`、`prototypes/gameplay-b/tests/runtime.test.ts`。导出 `RunConfig` / `ReadonlyView` 等本地模型、`SeededRandom`、`GameplayBRuntime.getView()` 与 `GameplayBRuntime.click()`。 |
| 未完成内容 | 未实现战斗、营地、sCost、UI、正式十二节点配置、build/dev；这些不属于 U2。 |
| 范围外变更 | 无。未改 package/root 配置或 AC 源码；输入配置由 Runtime 深拷贝，返回视图及其嵌套数组/对象冻结。 |

###### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npm test`（在 `prototypes/gameplay-b/`） | 通过 | 1 个测试文件、6 项测试通过；覆盖两次活动与自动进出口、第三次终止及幂等、同 seed 重放/不同 seed 差异、倒地者跳过、读取不推进 RNG、配置/视图隔离及输入约束。 |
| 类型检查 | `npm run typecheck`（在 `prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json` 无诊断。 |
| 独立边界 | 检查 U2 四个源码/测试文件的 import | 通过 | 仅导入同包相邻模块及 Vitest；无 AC、父级配置或资源引用。 |
| 新文件空白 | PowerShell `Select-String` 检查四个新增文件的行尾空白 | 通过 | 无匹配。 |
| build/dev | 未执行 | 未执行 | Unit 明确留给 P2。 |

###### 遇到问题

- 无。

###### 需上游确认项

- 无。随机活动采用字段契约案例 1 的 `1d2` 线索/未发现结果，线索只进入事件日志，不形成持久状态。

###### 事实更新建议

- 无；此 Runtime 仅为独立原型，不更新 `docs-829` 当前机制事实。

### P2：页面与首次体验

- Goal：建立三栏、四人状态、事件日志和固定 Click；在 main 中组装最小样本配置。
- Allowed Files：`prototypes/gameplay-b/index.html`、`prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css`；以及本 Task 的 Unit / Receipt 记录。
- Completion Criteria：页面可启动，Click 与状态、日志对应；自动进入出口不自动执行出口活动；刷新可重开。
- Verification：运行本节影响的定向测试及本 Task 下方验证入口；有 UI 变化再做对应浏览器冒烟。

#### Patch Unit 0187-U3：三栏 Click 页面

##### Goal

将 U2 的四人 Runtime 接入可见的独立三栏页面：左侧我方四名 Chara，中间当前场所、活动进度、事件聊天与唯一 Click，右侧当前场所/敌方信息。Click 后只增量更新稳定 DOM，显示两次全队活动及进入出口，第三次结束；页面不自行抽取随机数或结算机制。

##### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 权威路由 | `docs/docs-829/00-INDEX.md` | 遵循当前文档边界 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/templates/patch-unit.md`、`docs/ai/templates/execution-receipt.md`、`docs/ai/frontend-design-project-overlay.md` | Unit/收据及稳定 DOM、交互连续性原则 |
| 设计 Skill | `C:/Users/15229/.agents/skills/frontend-design/SKILL.md` | 有意图的独立 UI 视觉系统 |
| UI 草案 | `draft-0183-gameplay-b-ui.md` 的桌面布局、三栏职责、Click 与日志 | 确认信息关系与唯一输入 |
| 内容 | `draft-0182-gameplay-b-director.md` 的四名初始角色 | 使用角色、基础值和定位，不编造正式身份 |
| 引擎草案 | `draft-0184-gameplay-b-sample-engine.md` 的 Click、活动、随机与只读投影 | 确保 UI 只显示 Runtime 结果 |
| 真实接口 | `prototypes/gameplay-b/src/model.ts`、`prototypes/gameplay-b/src/runtime.ts` 及 `prototypes/gameplay-b/tests/runtime.test.ts` | 按 U2 实际交付构造、读取与推进 Runtime |
| 页面入口 | `package.json` | 确认 Vite root 与独立命令 |

##### Confirmed Facts

- 0187-U2 已导出 `RunConfig`、`ReadonlyView`、`GameplayBRuntime.getView()` 与 `GameplayBRuntime.click()`；随机调用只发生于活动 Click。
- Runtime 配置中的初始角色顺序是小栞、由理、芽衣、纺希；前两名前排、后两名后排。正式基础值见 0182，P2 页面使用其 HP/ATK/DEF。
- Activity 两次 Click 后 Runtime 自动进入出口，出口还需要第三次 Click 才完成；进入出口事件会说明当前 Click 未执行出口活动。
- 这是 `prototypes/gameplay-b/` 内的预研原型，不是 AC 现行机制或内容，不可引入 AC UI、CSS、资源、服务或状态类型。

##### 设计方向与交互连续性

- **主题/受众/任务**：游乐园巡查记录台；给策划快速观察四人状态、场所逐人结果与单一推进节奏。
- **视觉 Token**：雾面蓝灰底 `#E5EEF0`、冷白卡片 `#F9FBFA`、深海墨色 `#18313D`、巡查薄荷 `#176C6C`、票根黄 `#F4C95D`、警示砖红 `#B34A38`；标题使用本机 `"Yu Mincho", "Georgia", serif`，正文使用 `"Yu Gothic UI", "Segoe UI", sans-serif`，数值使用 `"Cascadia Mono", "Consolas", monospace`，不加载外部字体/网络资源。
- **布局**：桌面固定左状态、中间场所与 Click、右目标/敌方信息的三栏；主标题表达“单击就是一整次集体行为”，按钮留在中栏下沿。
- **标志元素**：将活动度做成两格语义进度标记，每次全队行为点亮一格；格数表达剩余活动次数，不作纯装饰。
- **DOM budget**：初始化时建立一次三栏语义骨架和四张稳定角色卡；事件条目按新增序号追加。每次 Click 只 patch 标题/进度/角色数值/新日志/按钮状态，不替换 `#app` 或已存在的卡片/日志节点。仅 UI 语义结构改变时才允许重建根结构。
- **Interaction preservation**：Click 按钮和角色卡节点保持 identity；追加日志时仅在用户位于底部附近才跟随新消息，否则保留 `scrollTop`；不会通过父级 render 恢复滚动；无 hover 弹层；滚动、读取视图及焦点变化不调用 Runtime、不消耗随机数。

##### Constraints

- 只在首次挂载时创建 UI 结构；后续同步使用稳定节点的 text/class/ARIA/进度属性和增量追加日志。
- 玩家输入只有一个推进按钮；seed 固定在 `main.ts` 的开发夹具中，不增加 seed、重置、路线或角色操作。
- 左栏显示分排、HP、ATK/DEF；不显示 P1 未实现的 sCost 或战斗动作。右栏明确说明“当前无敌方单位”，不能暗示有隐藏遭遇。
- 中栏活动状态只读 `ReadonlyView`；不得将随机结果提前放进 Click 前预览，不得让 View 抽取随机或修改运行态。
- 使用本机字体/纯 CSS；不加载外链图片、脚本、字体或 AC 资源。
- 至少在 1280×720 和 1440×900 桌面视口下保持三栏与首屏可达 Click 区；不把此技术样本包装成正式地图。

##### Allowed Files

- `prototypes/gameplay-b/index.html`
- `prototypes/gameplay-b/src/main.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/style.css`
- `docs/plan-work/task-0187-gameplay-b-standalone-click-prototype.md`

##### Explicit Non-goals

- 不添加战斗、敌方牌列、sCost、技能、配方、营地、正式十二节点地图、持久化或其他玩家输入。
- 不重写 U2 模型/随机/Runtime；若发现缺陷记录并回到 U2 修复，不从 UI 绕过。
- 不改任何 AC 代码、既有样式、根工具配置或依赖清单；不新增图像/资源文件。
- 不实现完整 0192 的六人密度、配方/技能预览和战斗日志验收。

##### Stop Conditions

遵守 `PROJECT-CONSTITUTION` 六类停止条件。需改动白名单外源码或 U2 行为时停止并交回；不得用重建整页来规避交互问题。

##### Completion Criteria

- [x] 独立 `npm run dev` 可加载页面；`npm run build` 与 `npm run typecheck` 通过。
- [x] 左中右三栏职责清楚，初始显示 2 前排 + 2 后排、活动度 2、四人参与说明与唯一推进按钮；右栏准确显示空场所信息。
- [x] 连续三次按钮 Click 分别记录四人结果并扣活动度、自动切至出口但不自动结束、最后结束 Demo；文本、当前进度与 Runtime 视图一致。
- [x] 按钮和角色卡节点在普通 Click 后保持 identity；新事件增量追加；鼠标阅读旧日志时不强制跳到底。
- [x] 刷新页面以固定 seed 重开同一演示；UI 渲染、滚动、焦点和重复视图读取不改变 RNG cursor。
- [x] 浏览器控制台无错误/资源请求失败；1280×720、1440×900 下 Click 可达，日志容器与侧栏不互相滚动。
- [x] 无 AC 导入、路径、CSS、内容、资源、持久化或网络请求；玩家只见一个推进按钮。

##### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 包测试 | 在 `prototypes/gameplay-b/` 执行 `npm test` | U2 行为回归通过 |
| 类型与构建 | 在 `prototypes/gameplay-b/` 执行 `npm run typecheck`、`npm run build` | 通过，产物来自本包 root |
| 页面 | 在原型目录执行 `npm run dev`，分别以 1280×720、1440×900 浏览器验收 | 3 次 Click、状态/日志/出口/终态、刷新重开、控制台和网络请求均符合准则 |
| DOM 连续性 | 浏览器 Click 前后检查按钮/角色卡节点引用；在日志中段追加结果 | 既有节点保留；未阅读到底部时滚动位置保留 |
| 边界/空白 | 审查四个白名单页面文件及 Task；扫描行尾空白 | 无 AC 依赖、外部资源和空白问题 |

##### Execution Receipt 0187-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；P2 构建/测试及 1280×720、1440×900 浏览器验收通过。 |
| 实际修改 | 新建 `prototypes/gameplay-b/index.html`、`prototypes/gameplay-b/src/main.ts`、`prototypes/gameplay-b/src/view.ts`、`prototypes/gameplay-b/src/style.css`。首挂载建立三栏稳定 DOM；更新只 patch 位置、进度、角色字段和新增事件。为桌面布局增加单行 `minmax(0, 1fr)` Grid track 与 `100svh` 高度约束，避免中栏最小内容高度撑开整页，使日志由中栏自身滚动，侧栏独立滚动。初始队伍使用 0182 的小栞 13/13 HP、ATK 2、DEF 1；由理 11/11、3、0；芽衣 9/9、2、0；纺希 8/8、3、0。视觉采用游乐园巡查记录台、蓝灰/冷白/薄荷/票根黄和本机字体。 |
| 未完成内容 | 战斗、sCost、技能/配方、营地和正式路线交由 0188–0191；六人密度与完整战斗 UI 留给 0192；体验校准与项目外独立交付留给 0193。 |
| 范围外变更 | 无；未修改 U2、package 配置、其他 Task 或 AC 代码/资源。 |

###### 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npm test -- tests/runtime.test.ts`（在 `prototypes/gameplay-b/`） | 通过 | 1 个测试文件、6 项测试通过。 |
| 类型检查 | `npm run typecheck`（在 `prototypes/gameplay-b/`） | 通过 | `tsc --noEmit --project ./tsconfig.json` 无诊断。 |
| 首次构建 | `npm run build`（在 `prototypes/gameplay-b/`） | 失败（已修复） | 首次调用 `vite build --root .`，安装的 Vite 8.3.2 CLI 报 `Unknown option --root`；Root 参数修正见 U1 补充收据。 |
| 构建重验 | `npm run build`（在 `prototypes/gameplay-b/`） | 通过 | 执行 `vite build .`，生成 HTML、CSS、JS bundle。 |
| 开发服务器 | `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` | 由根代理持有 | 根代理确认原型 server 在 `http://127.0.0.1:5173/`，可由其现有浏览器标签复用；本代理未操作 UI。 |
| 1280×720 页面与 Click | IAB 浏览器 + CDP 只读布局测量 | 通过 | inner viewport 为 1280×720；三栏分别 x=18/317/979、宽约 283/646/283；body 高 720；底部按钮 y=637、46px 高且可达。首场显示四人/2+2、活动度 2、右栏无敌方。Click 1 记录四人骰值与结果、活动度 1；Click 2 记录四人结果并自动进入出口，不执行出口；Click 3 结束。 |
| DOM identity 与日志滚动 | 点击前后读写 DOM 节点 identity 与 event-scroll metrics | 通过 | 普通 Click 后 advance button、首张 Chara card、event-list identity 均保持；首次追加日志从底部自动跟随；在第二次 Click 前把日志滚回顶部后，追加与第三次 Click 均保留 scrollTop=0。日志 scrollHeight 956/1023，大于 clientHeight 196/216，页面 body 仍高 720；焦点持续留在同一按钮。 |
| 1440×900 页面与 Click | IAB 浏览器 + CDP 只读布局测量 | 通过 | inner viewport 为 1440×900；三栏同时存在，日志与侧栏独立滚动，button y=818、46px 高；首屏可见唯一 Click。 |
| 刷新与终态幂等 | IAB 浏览器固定 seed 重放 | 通过 | 刷新回到 2+2/活动度 2；首个 Click 的逐人 d2 序列重现为 `[2,1,2,1]`。Click 3 后按钮进入终态；再输入一次后 Accessibility tree 无变化。 |
| 控制台、资源和输入数量 | CDP exception/log/network failures、Performance resources、DOM 按钮数 | 通过 | 重载与推进期间没有 JS exception、console error 或 failed request；观察到的资源仅为 `http://127.0.0.1:5173/` Vite client 与本包 TS/CSS 模块；按钮数量为 1。 |
| 边界与空白 | 页面源码/import 审阅；行尾空白扫描 | 通过 | 页面只导入本包 Runtime/model 与本包 CSS；无 AC、外链资源、持久化或外部网络引用。五个 U3 白名单文件行尾空白扫描无匹配。 |

###### 遇到问题

- U1 初始 `build` 脚本参数与本地 Vite CLI 不兼容；上游在 U1 白名单内修正为 `vite build .` 后，本 Unit 重跑构建通过。
- 初次启动 dev 命令时 5173 已被占用；根代理确认该端口由其原型 server 持有，本代理未结束或替换该进程。

###### 需上游确认项

- 无。浏览器证据由根代理于 2026-10-03 补入本 Receipt。

###### 事实更新建议

- 无；这是独立原型，不更新 `docs-829` 当前机制事实。

## Context Budget 与停止条件

- 单个代码 Unit 目标上下文 10k–30k token；纯文档 5k–15k。可选读取只限直接相关的模型/调用方/测试；历史快照和 AC 业务源码默认不读。
- 遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六类停止条件：白名单外修改、超预算、Read Set 失控、事实冲突、未裁定机制/范围扩张、必需验证失败或无法执行。
- 不修改根 package、主应用启动/构建、AC 源码、生成 Schema 或已有依赖目录。独立原型不是当前 AC 机制，不向 docs-829 写入“已实现”结论。
- 发现前置缺陷应记录失败案例并回相应 Task 修复和重验，不能在 UI 或内容层绕开错误规则。

## 测试与验收

- [x] 原型自身 test/typecheck/build 全部通过，dev 浏览器无错误。
- [x] 初始自动入场，Click 1/2 各消耗一点活动度，Click 2 自动换场，Click 3 结束。
- [x] 渲染、滚动与读取视图不消耗随机数、不修改权威状态；调用者不能通过视图写入 Runtime。
- [x] 终态输入不产生新结果；同 seed/config/Click 产生相同事件序列和状态。
- [x] 无 AC import、CSS、内容、存档键或网络资源依赖；玩家只见一个推进按钮。

### 验证入口

从 `prototypes/gameplay-b/` 执行 `npm ci`、`npm test`、`npm run typecheck`、`npm run build`、`npm run dev`。桌面验收尺寸为 1280×720 与 1440×900；记录 Click、刷新、滚动、焦点、DOM identity、控制台与资源依赖结果。

上面的测试/类型/构建/dev 命令均在 `prototypes/gameplay-b/` 执行；脚本由 Task 0187 建立。命令尚未存在不代表当前已执行。 文档变更另在仓库根执行 `npm run check:docs` 与受影响文件的 diff 空白检查；新文件另行检查，不能依赖不包含未跟踪文件的普通 diff。


## 最终核验（2026-10-03）

- U1 独立依赖包完成并实际 `npm ci` 安装 37 个包；U2 四人确定性场所 Runtime 的 6 项测试及 typecheck 通过；U3 页面 build、测试、typecheck 通过。
- 真实浏览器 1280×720 与 1440×900 验收通过：三栏、单一 Click、三次推进、自动进入出口、终态幂等、固定 seed 重开、DOM identity、日志自动跟随与阅读旧日志时保留滚动均有证据；无浏览器控制台异常或失败资源请求。
- 文档最终检查、行尾空白与隔离边界复核完成。Task 0187 已交接给 0188；下一步按用户指定顺序实现确定性战斗。此原型仍完全独立于 AC。

## Execution Receipt 与交接

U1/U2/U3 均有实际修改、测试/浏览器结果与范围收据。交接接口为 `RunConfig`、`ReadonlyView`、`SeededRandom`、`GameplayBRuntime.getView()` / `click()`，UI 入口在本包 `prototypes/gameplay-b/src/main.ts`；固定开发 seed 为 `park-inspection-demo`。包内运行步骤见 `prototypes/gameplay-b/README.md`。

本 Task 全部验收通过后交接 [[task-0188-gameplay-b-deterministic-battle]]；阻断项未解决不得放行。 完成时先记录最终核验，再归档本 Task、更新索引及受影响入口，最后运行终态文档检查。

## 剩余工作

尚无战斗、配方、营地和正式十二节点内容，依次交由 0188–0191；完整 UI、体验校准与独立交付仍交由 0192–0193。

## 相关路由

- [[draft-0185-gameplay-b-progressive-prototype-tasks]]
- [[task-0186-gameplay-b-prototype-rule-baseline]]
- [[task-0188-gameplay-b-deterministic-battle]]
