# 后续首批施工任务草案

本页是原型设计评审的交接材料。Task 0429 仍只负责调查与设计。负责人确认具体范围和输入后，按项目 Task 模板登记独立实施任务。下面三个草案把数据、第一处代码、退出条件和验收写在一起，供批准后直接复核。固定输入属于试验副本。

## R1 先做一次按表全拆及重合

**作者目标。** 作者用独立编辑器打开一份 addition-test 目录副本，从预览看到 scanner 属于 spots、原分片以及待输出的位置。按表输出到新目录，原件保留，重读后合成单 JSON，且资产仍可独立交付。

**依据与输入。** 固定 `datapack-dev/addition_test` 的目录及依赖 Base，记录摘要和枚举顺序。同版 ZIP 只做差异对照。预先选两个不同目录的分片，附 A/C 与 B 交错顺序的合法 Item 行。当前 `parsePack` 合并后失去分片位置，`scripts/base-datapack-export.mjs:exportBaseDatapackFolder` 已有按表输出，`tools/datapack-editor/ui/io.ts:fileInputImport` 升为实际首个文件消费入口。

**拟改过程。**

1. 以 `src/data-services/datapack/fragment-parser.ts:parseFragment` 为第一处，复用分片识别、合并规则，另留表、原路径和行来源。P1 打开来源时建立 ProjectRead 和各表 ordinal，不完整输入保留诊断。
2. 按[分片规则](15-datapack-fragment-order-design.md)新增计划和执行。预览由输入版本、行次序、单例/metadata、资产与目标不存在状态组成。按表拆分给真正可重读的 JSON 分片。重合输出标准结构。只在试验目录内写。碰到重复实体、未知键的无损要求、目标变化或一份文件写失败，输出实际写集/未处理数据及重试入口。
3. 独立导入界面和最小 CLI 预览/执行调用同一逻辑。旧 reader 继续读实物格式。第一次只迁出独立工具中本操作的临时输出路径。脚本和原有 ZIP 入口没有消费对照前仍保留。下一份 R1 Task 再做按实体和交错分类，按表产物已经具备独立价值。

**验收。** 现有 `tests/data/datapack/{fragment-parser,pack-parser,base-datapack-folder-export,addition-test-pack}.test.ts` 是对照。将同一目录按表→重合→实际旧 reader 重读，比较顺序、scanner 字段、始末清单、依赖和资产字节。A/C/B 用首次记录顺序为对照，并验证在后继按实体交错分组时能恢复 A/B/C。试验目标预先存在、坏清单和取消均不动源。核对 UI/CLI 给出同一预览和产物。记录实际执行命令、产物位置和失败样本。

## R2 先让作者和终端点到同一个错误

**作者目标。** 改错过程用 scanner 定位两次定义及一个主题引用，修改后不需要重新找文件。坏文件不隐藏其他可查问题。

**依据与输入。** 复用 R1 同一目录实例及其固定 Base。实际 scanner 在 `datapack-dev/addition_test/00-world.json`，配色目标 `addition-test:colorgroup:violet`。测试次序为复制一处 scanner、改主题为不存在键、加入单独的坏 Story 文件。每次输入快照分开保留。

**拟改过程。**

1. 从 `runtime-content-reference-rules.ts:collectDefinitionReferences` 与 `runtime-content-browser.ts` 的目录和边取得当前逻辑，对照 `tools/datapack-editor/validate/index.ts:validateDatapack`。按[共同检查构造](14-datapack-validation-and-build-design.md)接一个共同目录与引用提取/解析。首批登记 spots 的真实取键，搬用当前提取器对主题 colorGroupId 的条件，产生重复、缺目标、覆盖或未知的诊断及关联位置。
2. 独立 Datapack Editor从 `tools/datapack-editor/model/editor-model.ts:EditorModel.validate` 的对应能力接共同结果，此前的格式与领域检查按覆盖范围分批保留。终端作者检查输入相同项目和依赖，输出相同码、位置和阶段。点重复报告的两处各定位正确分片。只读依赖支持查看，不允许更改。
3. 复用实际来源保存修正。点击旧报告时检查原摘要。若位置因源外部修改失效，重新校验，只保留可重新定位的提示。替换独立验证同一行的重复诊断后，对照关闭旧分支，Runtime 现场检查继续保留。下一批再登记地图动作、局部节点和续接规则。

**验收。** 用固定样本做编辑器与 CLI 实际检查，至少三个坏输入可分别定位。坏文件下其它诊断还在，引用反查报告覆盖不完整。修好主题并去掉重复后正常通过这一组检查，真实引用可正向及反向查。新旧选择结果对照真实字段，用 `tests/data/runtime-content/runtime-content-operation-references.test.ts` 保护上下文专项行为。不得因为这里只迁三项就宣布已全面替代所有检查。

## R5 先替换两种能读出真实对白的小前端

**作者目标。** 同一句话能用两种试验写法编辑、检查和生成可试播包。写一条新句子后，播放实际显示它。

**依据与输入。** 用[文本接入构造](18-story-text-and-preview-design.md)的 A/B 正反例，给相同 Story 和节点 ID、白子发言者及 Base 主厅默认值。现有结构入口为 `story-definition-projection.ts:projectStoryDefinition`，编辑器入口从 `node-clipboard.ts:pasteStoryNode` 和调用它的 Story Controller 开始，试播走 `createStoryAuthoringPreview`。

**拟改过程。**

1. 两个接入都读发言者和正文，提供全文、片段及真实范围，能力表显式声明未支持项。从公共服务登记和调度。现有 JSON 入口并行，两个接入不需要动其作者文件。固定目录或文件声明，解析结果采用共同诊断和字段位置。
2. 先从工作台现有 Story 实例的一处片段入口接用，确认后一次变更，取消不写，过期版本与不支持能力能恢复。现有结构剪贴板继续走实测等价的插入动作。CLI 经相同服务检查全文。最小构建以实际包结构装载并看到该对白。
3. 首次交付只含文本接入、诊断、片段和已有试播足够验证的普通对白。双栏布局、完整文本编辑体验、高级判定分别登记。看到手打新句的实际结果后，才撤掉公共流程中任何专为旧试验语言存在的解析分支。

**验收。** 运行 A/B 原输入、改过的新句、CRLF/中文跨度、语法坏样本与错误 Area。对照项目文件、编辑器、CLI 的输出和范围，实际构建读回并由现有播放器显示新句。暂时关闭 A，换 B，P0 的领域诊断和 Runtime 层均使用相同入口。前置施工可用现有 JSON 验证定义与播放器。这份完整验收需要真实编辑器和构建消费者。未覆盖的正式语言行为交 P3 后继，不作为临时接入的设计。
