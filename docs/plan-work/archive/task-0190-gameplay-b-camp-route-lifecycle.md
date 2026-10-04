# Task：玩法 B 战斗与营地短路线闭环

状态：complete — U1–U4 全部交付；原组合 Route/camp U2 已按 C2 拆分并 supersede

## 目标

运行“首战→营地→危险活动→第二战→出口”，确认入队、HP 延续和一次性营地加成能跨节点正确工作。

## 设计边界

- 本 Task 包含：千世入队、固定恢复/个人随机、属性与 Tag 检定、活动全灭、自动换场、两类营地补给。节点 10 补给通过专门夹具提前覆盖。
- 用户已授权按序完成 0186–0193，并于 2026-10-04 验收；0189 已完成交接，本 Task 进入施工。
- 共用边界：原型放在独立目录 `prototypes/gameplay-b/`，自身声明通用 TypeScript/Vite/Vitest 依赖，使用普通 DOM/CSS；不依赖 AC 的 Engine、StateMutationService、PlayerState、Registry、Datapack、Story、UI、CSS、内容、资源、存档或服务。所有原型写入集中由自身 Runtime 完成，UI 只消费只读视图；不为遵守 AC 部件约定反向引入 AC 依赖。
- 非目标：存档及迁移、AC 接入、实时循环、自动战斗、编队、手选牌、分支路线、经济/成长系统。开发 seed 与场景夹具不形成玩家操作；玩家只以 Click 推进，刷新页面可重开。
- R06 紧急出牌规则与 R10 线索边界使用 0186 记录的原型暂定默认；R09 的三种基础配方输出已由用户确认，R09 的非配方攻击标记/范围处理及未明确的配方优先级与匹配顺序仍按原型暂定默认施工，明日验收可修订。本 Task 遵守场所线索只记事件日志、sCost 不跨战斗保留的基线。
- 设计来源：[[draft-0185-gameplay-b-progressive-prototype-tasks]] 与本 Task Read Set；规则与手算依据见 [[task-0186-gameplay-b-prototype-rule-baseline]]。

## 依赖与开工门槛

直接前置：[[task-0189-gameplay-b-card-recipes-and-skills]] 完成并交接。开工时读取归档的 0186 规则与对应手算；R06、R10 和未决 R09 子规则按原型暂定默认施工，不得将暂定项写成用户裁定。三种基础配方输出属于用户已确认内容；若交接揭示其他未决语义则停止并上报。

每个 Unit 开工前均须核对 0187、0188、0189 的实际交接/Receipt 和已交付文件；以下落点不预设函数、类型、导出名或签名。若前置未交接、目标路径缺失或签名不合，先停止并按实际产物修订本 Task 对应 Unit 的白名单与验证方式，再开始代码施工；禁止猜接口或为套用计划重写已验收产物。

## 当前事实与代码落点

| 已核实事实 | 依据 | 对施工的影响 |
| --- | --- | --- |
| 0181–0184 为规则/内容/UI/引擎候选，尚非当前机制 | 对应 Draft 的状态与边界 | 不把建议或历史例子当成已实现能力 |
| 0188 的 `BattlePreparationInput` 没有营地 modifier 输入 | 0188-U1/U2 Receipt 与 `prototypes/gameplay-b/src/battle/prepare.ts` | U2 定义需要的类型；U3 独立实现准备与一次性消费，不把营地效果伪装成持久 sCost |

## Must Read / Read Set

- [[docs/docs-829/00-INDEX]]、[[docs/ai/PROJECT-CONSTITUTION]]。
- [[draft-0182-gameplay-b-director]]、[[draft-0184-gameplay-b-sample-engine]]，只读本阶段涉及小节。
- [[task-0189-gameplay-b-card-recipes-and-skills]] 的交接/Receipt；[[task-0186-gameplay-b-prototype-rule-baseline]] 的对应规则与案例。
- 本 Task 每个切片列出的目标文件及其直接相关测试；开工后按实际产物定位，不默认读全部原型代码。

## 施工切片

本 Task 按 C1 拆为四个独立 Unit；详细 Read Set、白名单、验收项与各自 Receipt 均在下列文件。按 U1→U2→U3→U4 顺序交接。

| Unit | 范围 | 规格 | Receipt | 状态 |
| --- | --- | --- | --- | --- |
| 0190-U1 | 纯活动结算与五节点内容 | [0190-u1.md](task-0190-gameplay-b-camp-route-lifecycle-units/0190-u1.md) | [0190-u1-receipt.md](task-0190-gameplay-b-camp-route-lifecycle-units/receipts/0190-u1-receipt.md) | 完成 |
| 0190-U2 | 通用 Route Runtime 核心 | [0190-u2.md](task-0190-gameplay-b-camp-route-lifecycle-units/0190-u2.md) | [0190-u2-receipt.md](task-0190-gameplay-b-camp-route-lifecycle-units/receipts/0190-u2-receipt.md) | 完成；24 项定向测试、类型与文档检查通过；451 行 |
| 0190-U3 | camp sCost lifecycle | [0190-u3.md](task-0190-gameplay-b-camp-route-lifecycle-units/0190-u3.md) | [0190-u3-receipt.md](task-0190-gameplay-b-camp-route-lifecycle-units/receipts/0190-u3-receipt.md) | 完成；50 项定向测试、类型与文档检查通过；159 行 |
| 0190-U4 | 短路线 UI 贯通与 Click 转场 | [0190-u4.md](task-0190-gameplay-b-camp-route-lifecycle-units/0190-u4.md) | [0190-u4-receipt.md](task-0190-gameplay-b-camp-route-lifecycle-units/receipts/0190-u4-receipt.md) | 完成；7 文件 58 项定向回归、类型/构建/文档检查与 1280×720 全路线 smoke 通过；436 行 |

## Context Budget 与停止条件

- 单个代码 Unit 目标上下文 10k–30k token；纯文档 5k–15k。可选读取只限直接相关的模型/调用方/测试；历史快照和 AC 业务源码默认不读。
- 遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六类停止条件：白名单外修改、超预算、Read Set 失控、事实冲突、未裁定机制/范围扩张、必需验证失败或无法执行。
- 不修改根 package、主应用启动/构建、AC 源码、生成 Schema 或已有依赖目录。独立原型不是当前 AC 机制，不向 docs-829 写入“已实现”结论。
- 发现前置缺陷应记录失败案例并回相应 Task 修复和重验，不能在 UI 或内容层绕开错误规则。

## 测试与验收

- [x] 入场立即加入与活动参与顺序按基线执行，事件去重无需存档系统。
- [x] HP 按规则延续；上一战当前 sCost 清除；下一战基值与加成正确初始化。
- [x] 开局 +1 仅消费一次；另一补给仅下一战第二轮起额外回复且战后消失，上限仍有效。
- [x] 固定恢复、个人随机、倒地恢复、活动全灭终态均有回归。
- [x] 无空移动 Click、无自动结算新战斗；终态后状态/日志不再变化。

### 验证入口

`npm test -- location-activity.test.ts route-runtime.test.ts camp-lifecycle.test.ts short-route.test.ts runtime.test.ts battle-prepare.test.ts battle-resolve.test.ts`；typecheck/build；浏览器完成短路线与营地入队冒烟。Vitest 按文件名筛选，测试文件均位于原型包 `tests/` 目录。

上面的测试/类型/构建/dev 命令均在 `prototypes/gameplay-b/` 执行；脚本由 Task 0187 建立。命令尚未存在不代表当前已执行。 文档变更另在仓库根执行 `npm run check:docs` 与受影响文件的 diff 空白检查；新文件另行检查，不能依赖不包含未跟踪文件的普通 diff。


## 当前核验（2026-10-03）

- 已核对 0187–0189 实际交接及 U1 Receipt；U1 活动结算与短路线内容完成，节点 9 是待 0191 替换的首战临时副本，节点 10 是独立 fixture。
- 原组合 Route/camp U2 因 C2 超过 500 行净改动上限，已 supersede；拆分后的 U2 Route Runtime 核心（451 行）与 U3 camp sCost 生命周期（159 行）已独立通过测试、类型检查、文档检查及只读复核。不同 `fromRound` 的待处理加成冲突现有明确拒绝测试。
- U4 Route 页面完成；首次 1280×720 浏览器观察发现长预览将 Click 挤出首屏，修正后全路线 smoke 通过：11 次 Click、两战共 7 轮、事件序号连续至 79、终态按钮禁用。Console error/warning 为 0；原型完整测试 9 文件 72 项通过，typecheck/build/根文档检查/依赖隔离/空白检查通过。R06/R09/R10 暂定状态与用户确认的活动后全员倒地立即结束边界保持不变。

## Execution Receipt 与交接

各 Unit 的规格位于 task-0190-gameplay-b-camp-route-lifecycle-units/，Receipt 位于其 receipts/ 子目录。每个 Receipt 记录实际修改、验证命令与结果、未完成项、问题及上游确认项。

本 Task 全部验收通过后交接 [[task-0191-gameplay-b-complete-park-demo]]；阻断项未解决不得放行。完成时先记录最终核验，再归档本 Task、更新索引及受影响入口，最后运行终态文档检查。

## 剩余工作

仍缺正式十二节点、第二次扩编与完整 Boss 内容，由 Task 0191 完成。

## 相关路由

- [[draft-0185-gameplay-b-progressive-prototype-tasks]]
- [[task-0189-gameplay-b-card-recipes-and-skills]]
- [[task-0191-gameplay-b-complete-park-demo]]
