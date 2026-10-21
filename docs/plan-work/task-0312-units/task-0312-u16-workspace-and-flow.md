# Unit 0312-U16：现有Workspace与Flow显示效果及进度

状态：ready / 未执行；阶段P3。前置：0312-U15实际完成Receipt与测试。

## Goal

现有组件正确展示新声明/实际结果/进度且不计算Effect；局部刷新、scroll/稳定节点和popover范围有DOM断言。

## Must Read / Read Set

共用入口：[[docs/plan-work/task-0312-gameplay-b-effect-program-v1]]、[[docs/ai/PROJECT-CONSTITUTION]]；精确合同按Draft0312 §11、归档Task0313 §10最终批准，不重开E0。下表只读命中符号／命名用例，不整仓通读。未来新增路径只有前置Unit完成后才是当前源码。

| 类型 | 路径／符号 | 用途 |
| --- | --- | --- |
| 源码 | src/ui/components/map-workspace.ts：renderActionHpEffects/renderEncounterSources/renderActivityProgress/renderCommitDock；src/ui/flow/map-flow-model.ts：commitViewFromReceipt/commitLines | 沿用当前卡片/状态/回执入口 |
| 前置 | src/arona-clicker/contracts/runtime.ts/U15 readonly view；src/arona-clicker/services/map-effect-summary.ts | 不在UI求值 |
| UI约定 | frontend-design skill；docs/ai/frontend-design-project-overlay.md；ui-style/patterns.md；refresh-update.md | 既有风格、结构与刷新范围 |
| 刷新源码 | src/ui/controller.ts：refreshMapWorkspaceRegion/patchMapDOM；src/ui/controller-actions-operation.ts：refreshMapWorkspacePreservingActionFocus | 复用现有稳定key补丁，不新建更新调度 |

## Context Budget

目标20k–40k token；文档3–8篇命中段落；只追溯本Unit指定E0合同/金样/Receipt，默认不读其它历史。单Unit最多4个变更文件加自己的Receipt、手写净改动≤500行。生成协议diff单列不计手写行数。超过60k上下文、预计超文件/行数先交负责人拆分。

## Optional Read Set

前置Receipt引用的直接依赖调用方或同文件共享fixture；额外最多2文件，超过先交上游。不得用扩大阅读范围代替拆分。UI具体结构仅U16按frontend-design与项目overlay，实际文档收尾仅U19。

## Do Not Read by Default

无关旧Operation/EventRun、整套EffectEngine/Trigger、独立编辑器UI、归档旧方案、dist与依赖目录；不读后续AG实现方案来覆盖本Unit的E1期望。

## Confirmed Facts

当前Map Workspace按region key局部更新；Flow有持久Receipt与投影视图两条转换，二者都必须带新摘要。 本轮仅核实源码，未在此规划轮运行本Unit测试；前置新增模块属于待施工产物。

## Constraints

- 唯一执行合同E1-COMPAT-1；采用已批准P1/P2/P3与D06–D08，不加入AG支付/排序/双方统一prepare。工程字段/函数细节可在已冻结接口责任内实现，不要求人类逐字段审批。
- 效果核只做单source纯规划，真实状态/成本/目标/终局/安装归现有MapRun和GameInstance；不创建第二Owner/Runtime、任意Handler或第二套同义leaf。
- 白名单仅本Unit可写；状态写入/依赖/存档遵循 [[docs/docs-829/05-conventions/architecture-discipline]]，Schema按 [[docs/docs-829/05-conventions/schema-sync]]，测试按 [[docs/docs-829/05-conventions/testing]]。
- 本文件创建轮只交付规划、未实施；后续收到施工指令后按本Unit执行。前置Unit未完成不得以新增测试占位或跳过来提前开工。

## Allowed Files

- `src/ui/components/map-workspace.ts`
- `src/ui/flow/map-flow-model.ts`
- 新增（执行时才创建）：tests/ui/gameplay-b-effect-workspace.test.ts
- `tests/ui/map-flow-adapter.test.ts`
- 新增实际Receipt（执行结束/中断后）：docs/plan-work/task-0312-units/receipts/task-0312-u16-receipt.md

路径为精确写入白名单，标“新增”的当前不创建；不能因Read Set包含某文件就修改它。其它Unit、E0归档、Draft语义、顶层协议、无关测试均不在白名单。源码路径名由本Task冻结；若需改路径先由负责人更新范围。

## Explicit Non-goals

不重塑卡面、创建视觉方向、交互架构或新统计功能。 共同排除E2–E5 TargetSet/Tag/Pool/Status/成长Adapter、任意脚本、全局模板、AG Scheduler。不得把内部helper测试当完整产品验收。

## Work Items

1. 继承现有字体/主题/卡片和Flow行，只补已声明效果、当前进度、Preview实际分支/变化与Commit回执；内容取readmodel和作者描述，区分条件内容与确定实际结果，不向玩家展示effectPath/执行器术语。
2. 结构冻结为：原card内既有small摘要扩展（需要多行时仅加一个语义列表）；原activity-progress内加一个locals列表；现有commit Flow行加结果文本。无新Workspace/滚动壳/弹窗/控制按钮，无新CSS/token或全局调度。
3. 先按当前refreshMapWorkspaceRegion/patchMapDOM和现有mutation生命周期核定能力，再复用region/element更新；允许使用已有的所属region补丁，不强求现有系统没有的逐节点粒度。保留map center滚动容器、未变卡key及依赖交互的按钮identity；替换范围前按既有入口关闭范围内popover，范围外保持。普通操作不新增full UIController.render路径，不增加另一套刷新调度。
4. DOM行为测试条件治疗、饱和0delta/Flag、真实提交后进度、保存恢复消息、失败诊断、hover/反复预览无写入；map-flow-adapter覆盖Receipt→Flow与readonly view→Flow都不漏/重报效果。宽屏鼠标实机留U18，不扩窄屏/键盘验收。
5. 若当前基础设施不能满足计划中的稳定节点/scroll/popover要求，附当前函数、最小复现、期望/实际DOM范围及受影响验收项，在Receipt报告缺口；由负责人判断既有region能力是否足够，或另立基础设施修复范围。不得为E1修改全局controller/patcher或扩大本Unit白名单；未满足的核心显示/交互验收保持未完成，不能用记录缺口自动豁免。

## Stop Conditions

遵循PROJECT-CONSTITUTION六条：超Allowed Files/新增未列文件/预算、Read Set外增读>2文件、当前事实冲突、未裁定语义或扩目标、必需验证失败/不可解释。停止受影响Unit、写实际Receipt并上交，不自行放宽预算、删除旧金样或选另一个玩法。若仅8处已知check:docs错误前后相同，按总Task基线记录，不越界修复。

## Completion Criteria

- [ ] 现有组件正确展示新声明/实际结果/进度且不计算Effect；局部刷新、scroll/稳定节点和popover范围有DOM断言。
- [ ] 更新粒度依据现有基础设施，实际范围/保留节点有证据；发现缺口已向负责人交接，未顺手重构全局刷新系统或虚报验收通过。
- [ ] Work Items全部实际完成；产品编译和下列命中测试绿，无skip/todo/篡改OLD期望掩盖失败。
- [ ] 变更不越白名单；真实验证/未执行项、合同ID和用例映射记录在Receipt；未开始不得预填成功。
- [ ] 本Unit独立可验收，不要求提前实现后续Unit；完整E1发布与AG前置解除仍等U18/U19。

## Verification

| 项 | 命令／方式 | 期望 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tests/ui/gameplay-b-effect-workspace.test.ts tests/ui/map-flow-adapter.test.ts tests/ui/gameplay-b-map-workspace.test.ts` | 本Unit行为及命中旧回归全绿，记录实际文件/数量/退出码 |
| 类型 | `npx tsc --noEmit` | 无本Unit引入类型错误；基线错误先记录并解释 |
| 范围/空白 | `git --no-pager diff --check`；新增未跟踪文本另查尾随空白 | 无新增空白问题，实际变更符合白名单 |
| 文档 | `npm run check:docs`（有文档/路径变化时） | 无新增错误；8处历史错误非零不写通过 |

## Receipt

执行结束或中断后按 [[docs/ai/templates/execution-receipt]] 创建唯一docs/plan-work/task-0312-units/receipts/task-0312-u16-receipt.md，列实际修改/未完成/命令与退出码/映射的OLD-EQ-NEW ID/风险/需上游项。记录GALHCG“直接影响范围累积，U19统一只读复核”，不得逐次编辑刷新图；本轮无图写授权。下一Unit从前置Receipt得知实际接口与验证，不以计划文字替代施工结果。
