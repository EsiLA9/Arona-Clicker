# Task：AronaClicker 原型架构调查与建设蓝图

状态：待验收

## 本次评审后补齐的构造设计

根据第二轮的评审意见，保留应用规格、审计、语义清单和技术备选。设计阶段新增 [构造与施工交接入口](../../docs/prototype-blueprints/README.md)。

- [x] 建立首轮作者数据工作合同，明确项目读取、实体来源、诊断、引用、草稿/保存、构建与试播。补足规则登记、三包构建管理、跨文件次序、单例及未知字段处理。
- [x] 拟定 R4 首个实际宿主为现有游戏内 Advanced Workbench，以及独立工具和 Runtime 的接线。写清复杂字段编辑动作与逐表编辑能力。
- [x] 补齐语言能力登记、两种真实解析的验收、以及独立高级判定。新增 P4 实体能力和三条活动，保留原有五个机制对照。
- [x] 分解 R0–R10，写 R1 拆合、R2 错误定位、R5 文本替换的[待评审施工草案](../../docs/prototype-blueprints/20-first-implementation-task-drafts.md)。同步提示词与文档入口。

本次仍为文档设计。R4 宿主、统一顺序及位置协议为试点方案，正式语言、最终宿主、存档及新玩法写入待评审或实物验收。原工作树代码、数据定义和参考原稿均未修改。

本次核对 `npm run check:docs` 扫描 152 页，0 错误。新增的八份构造和交接页已核对相对链接、代码块及引用的测试路径。44 项顶层列表和单例均在 P2 编辑能力表有一项对应。实物 scanner 的 ID 和主题配色键与样本一致。此前已有的测试记录保留在下文。本次未执行 Runtime、浏览器或新原型行为验收。

## 第二轮交付与边界

第二轮面向初次加入项目的施工者。沿实际作者和玩家操作解释数据、页面、来源、已有代码、改接顺序、失败与验收。P0–P6、共同工作规则、施工顺序和裁定都已修订；Task 0429 仍为文档评审。代码实验、游戏源码、数据包转换和正式内容由后续获准任务承接。

从 [当前蓝图目录](../../docs/prototype-blueprints/README.md)读，原立项范围保留在[立项输入](../../docs/prototype-blueprints/scope-brief.md)。对照过仓库中的 10 份 V2.1 文件及用户补充。重要范围变化为 P3 建设可替换的语言接入和作者工具，正式语言和语法另设任务。P1 的全拆、合一、快速层级化，P2 条件详编和引用双向跳转，P4 优先用现有实体，P5 原文与玩家入口分别核对，P6 新人完成一次完整作者练习，已进入主体规格。

## 当前依据与修订记录

2026-11-28（Asia/Shanghai）再次确认 `codex/story-continuation-0351`、HEAD `391fc1cc4fbd1c7dffc989c82547aafc9531e5f1`，项目地图 ID `acprogram`。工作树包含已在第一轮记录的 UI 改动和其他任务的归档变动。完整保留[现状审计 A01–A17](../../docs/prototype-blueprints/11-current-implementation-audit.md)和实物差异，将第一轮共同类型、锁和事务存为[技术备选](../../docs/prototype-blueprints/technical-notes-v1.md)。

本轮重点核实阅读到的启用、写入和界面行为。 `parsePack` 返回合并对象，逐字段来源和坏文件部分处理是需建设能力。AreaMap 导航节点可指向 Area，设施来自 Area 定义。现有 Story 条件树已有子树和“恒为 True”根模式，通用条件合同只定义 AND/OR；Runtime 编辑策略有四层、每组八项的局部限制。Story 节点顺序由 nodes 决定，stages 是兼容字段；Story 试播、判定和对白演出有复用路径。物品累计可验证曾取得，现有合同没有通用 hasItem 条件或 Character 知识 Reveal。正式语义和未来所需能力详见[P3 附页](../../docs/prototype-blueprints/12-story-semantics-and-preview.md)和 [P4](../../docs/prototype-blueprints/05-gameplay-prototypes.md)。

- [x] 核实 V2.1 参考的真实字段、来源文件、旧服务和当前直接消费者。
- [x] 以使用流程为主重写总纲、P0–P6、决定 D01–D12 和共同工作规则；按实际动作编写 R0–R10。
- [x] 更新 [[ai/guide/prototype-blueprint-workflow]]，新增 [[ai/guide/prompts/prototype-blueprint-review]]，登记第二轮入口。
- [x] 比对第二轮各原型的首个真实样本、失败恢复、直接调用方与验收，核对新增文档链接、代码块和输出。

## 第二轮的真实验证结果

本轮用 `npm test -- <九个现有测试文件>` 核对包解析、Base 文件夹导出、addition-test、Story 定义与续接、里程碑、旅行、Runtime 条件编辑及 Story 引用导航。8 个文件通过，1 个失败；85 项通过、2 项失败。两项均在 `tests/ui/story/story-editor-reference-navi.test.ts`，分别是目录筛选/可选值保存，以及只读 Entry 打开关联 Story 卡片；测试找不到预期节点。详情为 `.test-artifacts/latest-summary.json`、`.test-artifacts/latest.log`。这一轮只记录当前行为，尚未归因，也没有据此声称 UI 迁移通过。

复跑命令（PowerShell）：

~~~powershell
$prototypeReviewCases = @(
  'tests/data/datapack/pack-parser.test.ts'
  'tests/data/datapack/base-datapack-folder-export.test.ts'
  'tests/data/datapack/addition-test-pack.test.ts'
  'tests/data/story/story-definition-projection.test.ts'
  'tests/engine/story/story-continuation.test.ts'
  'tests/engine/world/milestone-runtime.test.ts'
  'tests/engine/area-map/area-map-travel.test.ts'
  'tests/ui/runtime-editor/runtime-editor-dsl-safety.test.ts'
  'tests/ui/story/story-editor-reference-navi.test.ts'
)
npm test -- @prototypeReviewCases
~~~

第一轮的最近全量记录为 401 文件通过、7 失败，4112 项通过、12 项失败；本轮跑的是与参考稿核实有关的现有定向测试，未重复全量。新版设计动作、替身前端和实际新页面均为待授权试验，尚无运行结果或浏览器验收。文档静态检查通过，原审计及 V2.1 原文摘要保持一致。

## 第二轮的交接记录

当时建议从 [R1/R2](../../docs/prototype-blueprints/09-construction-roadmap.md) 选一组 Base 或 addition-test 实物样本。相关输入、拆合粒度和诊断验收现已进入本次施工草案。R5 的两个临时前端可单独确认，R8 的玩法用既有 JSON 可独立试验。需要负责人另行决定的长期事项见[裁定 D01–D12](../../docs/prototype-blueprints/10-decision-register.md)。其中包括正式语言表达、宿主范围、正式包/存档迁移、跨 Init 的知识和入口规则、P5 的源文本与资源范围。负责人评审后，新施工 Task 分别指定代码改接、样本、失败处理和完成方式。

## 本次评审交接的第一步

负责人可分别确认 [R1、R2、R5 草案](../../docs/prototype-blueprints/20-first-implementation-task-drafts.md)中的试验输入、接线和完成条件。R4 先核对实物桌面宿主的目录写能力或终端适配，正式宿主仍为 D05。R8 的试验与活动独立核准。确认前继续使用这份 Task 做设计评审。
