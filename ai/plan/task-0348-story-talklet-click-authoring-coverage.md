# Task 0348：Story 编辑器 Talklet / Click 参数完整覆盖

状态：实施中 — 已按用户裁定开始处理 ID 管理与旧游标恢复；其余字段闭环仍待逐项施工。

## 目标与范围

- 目标：让 Story 编辑器能够发现、创建、修改、恢复默认并保存 Talklet 与 Click 合同中所有仍有运行语义的作者参数；编辑后的预览和运行投影必须与保存值一致。
- 范围：Talklet 正文 / 呈现 / 节奏；Click 的 Button、Choice、EntryCard 三种交互；Click 内嵌 result、sharedActions、option result 的 StoryAction 与 Transfer；`requiresFlag`；节点 ID 与 Choice option ID 的安全管理。
- 与 Task 0343 的关系：0343 是完整 Story 作者编辑提案；本 Task 提取 Talklet / Click 作为可独立验收的第一阶段。嵌套 StoryAction 的完整值编辑依赖 0343 对 StoryAction / Expression / Extra / LocalFlag 的覆盖，不在本 Task 重造另一套动作编辑器。
- 明确不做：不恢复 `stageId` / `stages.advance` 的作者控制；它们是兼容元数据，不参与当前播放。不会恢复已删除的 Button / ChoiceOption 内嵌 reply；老师回复仍由独立 Talklet 表示。
- 验收：合同中每个有运行语义的 Talklet / Click 字段都有明确编辑路径；可选字段可以独立创建、编辑、删除并回到省略态；复合分支切换与无效输入不丢草稿；稳定 ID 修改会校验冲突并同步本地引用 / 编辑缓存；保存、重载和预览投影保持一致。

## 当前进度

- [x] 核对 Talklet / Click 合同及其判别分支。
- [x] 对照 Story Editor 属性表单、草稿持久化 / 投影，标出可编辑、只读与回默认缺口。
- [x] 与现有 0343 完整作者编辑提案确认重叠及依赖边界。
- [x] 按用户裁定允许节点 / Choice option ID 使用手写身份；旧游标 / 内容指纹不匹配时从当前 StoryEntry 重启。
- [x] 为节点 ID 与 Choice option ID 添加手动编辑入口、唯一性 / 格式校验和兼容提醒。
- [ ] 逐项完成其它 Talklet / Click 字段的省略态、边界与保存闭环。
- [ ] 补针对性行为回归并验收游戏内预览、保存重载。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/contracts/story-node.ts` | Talklet / Click / 子结构权威合同 | 已核对 |
| `src/ui/story-editor/property-fields.ts` | Talklet / Click 属性表单与嵌套内容编辑 | 已核对；主要字段已有，仍有完整覆盖缺口 |
| `src/ui/story-editor/model.ts`、`property-model.ts`、`controller.ts` | 分支切换、属性写入、Choice ID 与绑定的身份维护 | 已核对；重命名 / 引用安全需施工确认 |
| `src/ui/story-editor/persistence.ts`、`persistence.ts` 投影调用方 | 草稿形状校验与保存投影 | 已核对；目前多个子结构是宽松形状检查 |
| `src/ui/story-editor/view.ts` | 预览呈现和节点身份展示 | 已核对 |
| `ai/plan/task-0343-story-authoring-full-coverage.md` | 完整 Story 作者能力与嵌套动作缺口 | 已核对；待审阅，未施工 |
| `tests/ui/story-editor-properties-acceptance.test.ts`、`tests/ui/story-editor-properties-model.test.ts` 及相关 Story Editor 测试 | 属性写入、验收和预览回归入口 | 待实施时核对 |

## 事实与决定

| 问题 / 决定 | 已核实事实及依据 | 待解决问题 |
| --- | --- | --- |
| Talklet 正文与头像 | 合同为 `content.kind/text`；talk 可带 `speaker/image`，narration 不带这两字段。编辑器已有对话 / 旁白分支、正文、说话人 / 图片输入和 speaker 角色候选。 | image 是直接资源输入并提供图片目录建议；需交互核对引用验证和清除省略态。 |
| Talklet `presentation` | 合同字段 `side/align/avatar/avatarMode` 均已有表单；头像隐藏与头像引用并存是合法组合。 | 逐字段恢复省略态、属性预览以及 branch 切换后草稿保持需回归核对。 |
| Talklet `pacing` | `typing/thinking` 已有可选输入；仅 talk 非右侧呈现可启用，0 表示显式关闭节奏。 | 数值输入错误、非有限值和 disabled / 休眠分支的保存行为需核对。 |
| Button | `text`、可选 `press.base/rand`、可选 `result.actions/transfer` 已有表单。 | 输入边界与默认值；result 内 StoryAction 能力依赖 0343，不能只因 Action 菜单可选就视为完整支持。 |
| Choice | `sharedActions`、有序 `options`、option `text/condition/result` 已有表单；`option.id` 显示只读。 | option ID 编辑与拖放 ChoiceFlag 绑定 / 缓存迁移；Condition 当前为通用叶子表单，引用候选与语义提示不足；嵌套动作依赖 0343。 |
| EntryCard | `card.request` 的 active Entry / owner，以及 `title/buttonText/align` 已有表单。 | owner 控件目前枚举全局或已知角色，但合同为 `string | null`；需决定是否提供保留自定义 owner 的高级输入。判别固定为 `active/card`，不需要重复编辑不可变类型。 |
| ID 与兼容字段 | Talklet / Click `id` 与 Choice option `id` 都是作者合同中的稳定局部身份；节点 ID 与 option ID 已可通过确认框手写修改。`stageId` 必需但播放不消费。 | 用户裁定：游标或 Story 内容指纹失配时，从当前 Entry 重新开始；发布后提示尽量不要更改 ID。若 Entry 或根 Story 内容完全不存在，则无法重启。 |
| 游标重启与动作副作用 | Story 游标快照保存当前 `nodeId`、insert 返回的 `nextNodeId` 和相关文档指纹；丢失 / 失配后按当前 Entry 重新运行。 | 重启会重新执行正文之前的节点动作；依用户建议，持久奖励优先放在 StoryEntry 完成策略中，节点 Operation 不应承担关键的一次性奖励。 |
| 入口恢复与完整覆盖 | 右侧表单普遍使用 optional / row 控件；草稿写入由通用 path controller 完成。 | 对每个可选字段逐项验证“创建→编辑→清除→重载”；简单 UI 存在不代表保存 / 投影完成。 |

## 建议字段覆盖矩阵

| 节点分支 | 作者参数 | 当前编辑情况 | 施工重点 |
| --- | --- | --- | --- |
| Talklet | `requiresFlag`, `content.kind`, `content.text`, talk `speaker/image` | 已有基础表单 | 标记候选 / 校验和图片引用反馈；确认分支切换保值与删除字段 |
| Talklet | `presentation.side/align/avatar/avatarMode` | 已有表单 | 每个可选键的省略态、头像候选及组合预览 |
| Talklet | `pacing.typing/thinking` | 已有可选表单 | 独立默认 / 显式 0 / 非法输入和右侧休眠语义 |
| Talklet / Click | `id` | 只读展示 | 若裁定开放重命名，校验唯一并同步草稿缓存；不改 StoryDef 外部身份 |
| Click / Button | `interaction.text`, `press.base/rand`, `result.actions/transfer` | 基础表单已存在 | 可选值往返与合法数值边界；动作子编辑遵循 0343 |
| Click / Choice | `sharedActions`, `options[].id/text/condition/result` | 除 ID 外均有基础表单 | option 身份管理、条件可理解性、绑定迁移；动作子编辑遵循 0343 |
| Click / EntryCard | `card.request.entryId/owner`, `title/buttonText/align` | 已有表单，owner 仅枚举 | owner 自定义值及空值语义裁定，卡片预览 / 保存一致 |
| Talklet / Click | `stageId` | 隐藏 | 保持系统维护的兼容字段，不恢复阶段推进作者参数 |

## 剩余工作与交接

- 本 Task 只包含调查、缺口和可审阅的验收范围；没有修改 Story Editor 生产代码。
- 实施前需复核 Task 0343 最新状态，并在有意重叠处复用已裁定方案；不得让两个 Task 分别重造嵌套 StoryAction 编辑器。
- 需要裁定：节点 / Choice option ID 是否进入可视化重命名；EntryCard owner 是否支持任意字符串；条件编辑器语义提示与完整 Expression / Extra 支持是否并入此阶段，或继续由 0343 负责。
