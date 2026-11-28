# M14 作者 CLI、能力查询与 Agent 使用服务

## 1. 当前实现与建设目的

现有 `ai/guide`、Task 路由、GALHCG、Schema 生成脚本、Base export、npm 测试等服务工程开发；独立工具导入/导出自有数据。A17 未定位统一作者 CLI。目标是让不了解引擎源码的作者或 Agent 能直接查询实际领域合同和实体、修改文件、解析文本、诊断、构建、试播。它是 M01–M08/M13 的命令接口，不是另一份作者数据模型、校验器或游戏引擎。工程源码图仍服务代码调查，不充当内容引用图。

## 2. 命令分组与具体行为

下列 `ac` 是候选命令名，实际可选 npm script/Node CLI；一旦原型实现，帮助必须与真实入口一致。

| 命令 | 输入与输出 | 实际服务 |
| --- | --- | --- |
| `ac project inspect <path>` | 项目/包记录、来源、依赖选择、文件角色、版本和权限 | M01 |
| `ac project split <path> --by table --out <dir>` | 拆分预览及明确输出；默认不覆盖输入 | M01 |
| `ac project merge/group <path> ...` | 选中范围、分组依据、目标及计划；真实输出 | M01 |
| `ac schema show <table>` | 实际结构、字段、引用、候选、示例、复杂控件与能力 | M02 |
| `ac entity find --table areas --query observatory` | 实体真实键、来源、是否有效/只读 | M02 |
| `ac entity refs --table stories --id <id> --direction incoming` | 真实正反向边、来源、未覆盖范围 | M02 |
| `ac project check <path> --json` | 同 revision 的结构/引用/领域诊断 | M03 |
| `ac edit plan ...` / `ac edit apply ...` | 结构化或跨文件修改计划、预期摘要、影响及实际写入回执 | M04/M01 |
| `ac text inspect --format <id> --version <v> --input <path>` | 全文/片段识别、标准结果、源位置、错误、可用能力 | M07 |
| `ac text to-json/format ...` | 输出新文件/标准输出或预览，能力未支持则拒绝 | M07/M01 |
| `ac project build <path> --out <zip>` | 具体输出包、报告、依赖、诊断 | M03 |
| `ac preview --bundle <path> --entry <id> --init <id> --case <case>` | 明确初态和测试输入，实际沙盒轨迹、失败/人工放行 | M08 |
| `ac import inspect/plan ...` | 已确认来源、映射、候选文件、覆盖及差异 | M13 |

Agent 可以直接用文本编辑器修改项目文件再重新 check，不强制每一行都使用结构化 plan/apply API。批量改名、删除、拆合、格式化等影响多个文件的操作必须先获得可读计划；明确输出目录的构建不写源；查询/检查不写源；试播不改变正式状态。命令明确项目根和实际记录，禁止默认猜同版本不同 ZIP。只读依赖、未选择的路径和输出越界返回具体拒绝。无需首轮新建常驻 Agent daemon 或复杂权限服务器。

## 3. 数据与错误输出

```ts
interface CommandResponse<T> {
  protocolVersion:1; command:string; project?:string; inputRevision?:string;
  status:'ok'|'invalid'|'incomplete'|'conflict'|'permission'|'failed';
  result?:T; diagnostics:Diagnostic[];
}
```

具体 result 使用对应模块数据合同，不复制/改名 Owner、SourcePoint、BuildResult 或 PreviewTrace。JSON 模式 stdout 仅一个机器可读结果（正常进度/调试去 stderr）；人工模式提供明确路径、字段、错误原因、下一步命令。退出码建议 0 成功、2 输入/合法性、3 冲突、4 权限、5 I/O 或执行失败；部分检查结果明确 incomplete，不误报有效。输出过大时支持显式表/文件/字段/方向筛选，确有需要再分页；分页绑定输入版本，不让旧结果拼到新项目。帮助包含真实输入样例、支持能力、可能失败以及可安全重试的操作，不输出臆造字段。

## 4. 实际使用样本（验收，不是当前命令事实）

以 addition-test 目录的可丢弃副本、实际 Base 依赖开始：inspect 确认路径/版本；schema 查询 Story/Area；find 找 `addition-test:story:welcome`、对应 Active Entry 和 observatory；refs 确认真实来源与影响；直接修改 `02-story.json` 的一段实际内容并制造一个缺失引用；check 输出文件、字段、真实候选，修正后再次检查；build 到明确试验目录；preview 用真实 welcome Entry/Init 跑 begin 后的 registry 与 save 分支，实际读取状态变化；Workbench 打开同一目录，复核诊断、来源与构建结果一致。正式案例的实际 ID、分支效果从当前实物核对。文本接入就绪后，同一流程再用两个临时前端验证，命令不因语法改变重新实现。

## 5. 制作路线及文档维护

M14-A：M01 的文件组织 CLI 已通过 [独立工具与 CLI 现行入口](../../docs-830/07-tooling/datapack-editor-and-schema.md) 交付。下一步由 [Task 0440](../../../ai/plan/task-0440-datapack-definition-catalog.md) 和 [Task 0441](../../../ai/plan/task-0441-datapack-reference-index.md) 在现有命令接 find 和 refs。Schema 字段查询及 M03 检查按消费者接入。M14-B 接构建、批量修改计划和保存回执。M14-C 接 M07 文本、M08 试播和实际能力帮助。M14-D 接 M13 批导和 Agent 作者快速上手。旧脚本可保留薄包装，业务规则使用共享服务。

验收：新 Agent 仅靠真实帮助和命令完成一次创建/修改、诊断修复、构建和运行；坏输入退出码与位置可读，旧报告不冒充新版本，权限/冲突不覆盖数据，构建失败保留旧包，试播不写正式存档。至少一条实际 CLI 与真实 UI 对照；不可执行的候选命令不能标为已交付。工程测试仍使用原 `npm test` 等工具。
