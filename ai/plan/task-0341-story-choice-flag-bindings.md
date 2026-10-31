# Task 0341：Story Choice 选项的局部标记绑定卡

状态：代码与静态验收完成 — Choice 提供方卡、读取节点标记记录、拖放复用绑定、标记维护与模型 API 已实现；浏览器交互验收未运行

## 目标与范围

- 目标：Story 编辑态的每个 Choice 选项左侧显示迷你绑定卡；将后续 StoryNode 拖到对应卡片时，自动建立该选项到节点的局部标记绑定。
- 推荐实现：编辑侧便利服务，直接维护现有 `StoryChoiceOption.result.actions` 的 `localFlag set` 与目标 `StoryNode.requiresFlag`。不增加运行时字段、Story 合同或 Schema；正常播放仍只读取标准 Story 数据。
- 数据命名：生成名保持 `Story-choiceId-num` 风格，以稳定 Story ID 的可读 slug 作为 Story 段、选项 ID 作为 choiceId 段，自动分配不冲突的递增 num。例如 `base-story-schale-welcome-option1-1`。同一 Story 内重复使用的 option ID 通过 num 区分。
- 绑定语义：每次把一个节点拖入选项卡时创建一个标记对：选项结果写入布尔 `true`，该目标节点读取同名 `requiresFlag`。同一选项可以绑定多个节点，每个 pair 独立命名；每个节点仍只有一个 `requiresFlag`，不能被同一拖放操作挂到多个互斥选项。
- 标记维护：Choice 提供方卡只显示局部标记 ID；每个 `requiresFlag` 读取节点在最左侧显示同色系、固定宽度的标记记录。把任意其他 StoryNode 拖到记录上，可让它复用同一标记；若目标已有不同条件则拒绝覆盖。级联改名仍由现有标记编辑入口完成，并同步更新当前 Story 全部 localFlag set/remove 与 `requiresFlag`。空名或目标名已存在时拒绝，避免合并两个标记。
- 随机节点 ID 提示：成功绑定后，若节点 ID 匹配自动码 `node_<32位十六进制>`，询问作者是否改成易读 ID；取消只保留绑定，确认后同步迁移节点及草稿侧 ID 缓存。手工 ID 不提示。
- 模型 API：提供按局部标记反查读取节点，以及在当前插入位置创建调用方提供的、带 `requiresFlag` 的 StoryNode；这两项不增加 UI 入口。
- 编辑限制：拖入的节点必须位于所属 Choice Click 之后；同一节点已有其他 `requiresFlag` 时不静默覆盖。该选项使用 `goto` 转移时，后续本 Story 节点不可达，绑定入口应解释并拒绝该落点。相同绑定重复拖入应幂等。
- 安全语义：为避免同一 Choice 在同一 Entry 内重复到达时旧标记残留，编辑器需在该 Choice 的 `sharedActions` 中清除此 Choice 所有仍有消费者的 pair 标记，然后由当前选项结果写入其标记。其他共享动作、结果动作及 transfer 必须保留原顺序和内容。
- 非目标：不改运行时 Choice/Action 合同、不在正常播放态显示编辑卡、不为单个节点增加多个 `requiresFlag`、不改手工写入的普通 StoryAction。

## 易用性判断

| 问题 | 建议处理 |
| --- | --- |
| 作者需要同时编辑选项结果和 Talklet/Operation 条件，容易漏一端 | 拖到卡片一次完成二端写入；拖放应作为单次原子编辑，保存只会看到成对的标准字段。 |
| 一个选项通常会控制连续多条正文/动作 | 同一选项卡可绑定多个节点，但每个 pair 有独立 flag，避免解除一个目标时误删其他目标的标记。 |
| 节点已经有条件时，拖放可能造成数据丢失 | 同一条件的重复绑定无操作；不同条件不自动替换，提示作者先清除或编辑现有条件。 |
| 早于 Choice 的节点在标记写入前就会检查条件 | 只接受顺序位于 Click 之后的节点；不提供没有实际语义的“成功但不会命中”绑定。 |
| `goto` 会离开当前 Story 的后继节点 | 对 `goto` 选项禁用后续节点落点并提供短说明；`insert` 可保留调用处后继，仍可绑定。 |
| 同一 Entry 重复进入 Choice 时前次选择留下的键会让多个后续节点通过 | 由共享动作先移除此 Choice 的 pair 标记，再执行当前选项的 set；不清理本 Click 未配对的其他局部标记。 |
| `option1` 等 option ID 会在多个 Choice Click 中重复 | 标记名格式维持 `Story-choiceId-num`，num 在同一 Story/choiceId 前缀下分配且检查所有现有局部写入与节点条件，避免重名和复用已出现过的编号。 |
| 复用既有标记及误拖恢复 | 提供方卡保持精简，只显示标记 ID；读取节点左侧的固定宽度记录可作为复用落点，让被拖节点引用同一 flag。已有不同条件时拒绝覆盖，作者可在属性栏编辑条件。 |
| 手工改标记名如何保持关联 | 通过专用级联改名，一次更新局部写入、移除动作与全部 `requiresFlag`；名称冲突时拒绝，不静默合并。 |
| 自动生成的节点 ID 可读性 | 仅在 ID 严格匹配 `node_<32位hex>` 时提示作者改名；提示可取消，不重写已有手工 ID。 |
| 反查/创建节点入口 | 仅提供模型 API，暂不加 UI；创建 API 接受完整节点内容，避免制造无效空正文。 |
| 卡片挤压正常选项文案 | 迷你卡宽度固定且紧凑，放在每个按钮左侧；长选项保持可读换行。只扩展编辑预览，不改变 Runtime Choice 卡片。 |

## 当前事实与决定

| 问题 / 决定 | 已核实事实及依据 | 待施工时核对 |
| --- | --- | --- |
| 现有运行时能否表达绑定 | `StoryChoiceOption.result.actions` 接受 `StoryAction[]`，其中已有 `{ kind: 'localFlag', op: 'set', name, value }`；StoryNodeBase 已有单个 `requiresFlag`。`requiresFlag` 只检查键是否存在。 | helper 必须保留 result 的其他 action/transfer，不创建私有 Runtime 解释。 |
| 标记值是否有业务含义 | `StoryNodePlayer` 仅按 Map.has 检查 `requiresFlag`；不读取标记值。 | 生成值固定用 `true`，UI 对作者说明这是存在标记，不是比较值。 |
| repeated Choice 的独占分支 | Story 文档要求可重复 Choice 先清理旧分支标记；`sharedActions` 在所选 option 的结果之前执行。 | 按本 Click option 写入并被节点读取的 pair 名生成清理列表；未配对的手工标记保持不动。 |
| 选项身份是否全局唯一 | `StoryChoiceOption.id` 是稳定 ID，但现有内容可在不同 Click 中复用通用 ID（如 `option1`）；Story 内不能仅凭 optionId 保证名称唯一。 | number allocator 需扫当前 Story 的生成键及所有 `requiresFlag` / localFlag 名称，不假设 optionId 全局唯一。 |
| 应否增添专有合同字段 | 当前表达原语可以完整表示写入与门控；新字段需联动 Schema、校验、投影、运行时语义和迁移。 | 先按编辑侧 helper 实现；只有出现无法由现有字段表达的状态时才另立合同设计。 |
| 级联重命名和节点 ID 重命名 | localFlag 名分布在 Operation、Choice sharedActions / option result 和顶层 `requiresFlag`；节点 ID 派生出草稿 `localFlagInputs`、`editorState` 缓存键、选中节点与插入锚点。 | 两种重命名都需单事务更新对应的全部引用与缓存；遇到名称冲突时不修改任何内容。 |
| 无 UI 的标记反查和创建 | 所有 StoryNodeBase 可声明 `requiresFlag`；新节点已有插入锚点可复用。 | 模型 helper 反查所有 requiresFlag 消费者，并接受调用方完整节点载荷创建受标记节点；当前不挂到界面。 |
| 拖放实现基础 | Task 0340 已添加带版本的 StoryNode 拖拽载荷和拖放目标分派；当前节点/插入位目标逻辑在 `StoryEditorController`。 | 只扩展为 choice-binding 目标，不重做节点拖拽生命周期；Task 0340 的浏览器验收尚待补做。 |

## 实施方案草图

- 展示：仅编辑态的 Choice 预览中，将每个选项行渲染为“左侧迷你绑定卡 + 原 Choice 按钮”；卡片只显示标记 ID。所有带 `requiresFlag` 的读取节点在最左侧显示固定宽度的同色标记记录；Runtime 正常 Choice 保持原样。
- 数据辅助：在 Story Editor 模型层增加绑定/解除 helper，按当前 draft、Choice node ID、option ID、目标 node ID 操作；一次修改同时更新 Choice sharedActions、该 option result.actions、目标 requiresFlag。
- 标记维护：增加级联 `renameStoryLocalFlag()`、`storyNodesRequiringFlag()` 反查、`insertStoryNodeRequiringFlag()` 模型创建接口；标记名冲突时原子拒绝。自动码节点 ID 确认时迁移节点 ID、缓存键、selectedNodeId 与插入锚点。
- 拖放：扩展现有版本化 StoryNode payload 的落点类型。悬停只高亮对应卡片或读取记录；drop 前复核当前 draft、choice/option/target 身份、节点次序、goto 可达性、标记提供方和 requiresFlag 冲突。
- 反馈：空卡提示拖入节点；提供方卡仅显示标记 ID；读取记录接收 StoryNode 拖放以复用该标记。非法落点提供就近原因，不静默覆盖现有条件。成功创建 Choice 绑定且节点为随机码时弹出可取消的易读 ID 改名提示。反查/创建节点模型 API 不新增 UI。
- 更新边界：由 Story Editor 现有 flow 委托事件触发一次模型事务；沿用 keyed DOM，保留未变更节点、输入焦点与滚动；新编辑状态只写入标准 Story 草稿数据，不写额外 editorState 或 Registry 标记字段。

## 验收条件

- [ ] 每个 Choice option 的预览左侧有可见、可聚焦且可接收 StoryNode 拖放的迷你卡；正常播放 UI 不出现该卡。
- [ ] 首次拖入后，选项结果增加恰好一个 `localFlag set true`，目标节点得到相同 `requiresFlag`；原有结果动作、transfer、节点内容、ID 和阶段保持不变。
- [ ] 再拖同一节点到同一选项卡不重复写数据；同卡其他节点各自创建标记对；卡片能显示并逐项解除绑定。
- [ ] 解除 pair 的最后一个目标后，相关 option set 和 shared remove 清理干净；其他手写动作和标记不变。
- [ ] 绑定卡可级联重命名局部标记，更新 Story 中全部 localFlag writer/remover 与 `requiresFlag` reader；空名/现存名称冲突会拒绝且不改文档。
- [ ] 模型 API 可按标记反查消费节点，也可在插入锚点创建调用者完整提供的受标记节点；不新增相应 UI。
- [ ] 自动码节点 ID 在绑定成功后出现可取消的易读 ID 改名确认；确认会迁移所有 nodeId 派生缓存，取消只保留绑定。
- [ ] 重复经过 Choice 时，sharedActions 清理该 Choice 所有生成标记，当前 option 再设置自己的标记；其他 Choice 的标记不被清理。
- [ ] 编号风格符合 `Story-choiceId-num` 且冲突检测覆盖重复 optionId、现存局部写入和节点条件；删除后不错误复用仍在节点上引用的编号。
- [ ] 拖到同一个或更早节点、option goto 后/无条件 goto 后不可达节点、跨 draft 节点或已有不同 requiresFlag 的节点时，拒绝修改并给出原因。
- [ ] 未配置 result、空 actions、条件选项与带 transfer 的结果都能安全处理；保留作者原有字段与顺序。

## 相关文件与资料

| 路径 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/contracts/story-node.ts` | ChoiceOption / StoryNode 条件合同 | 已核对；无需改合同 |
| `src/data-services/contracts/story-node-actions.ts` | localFlag 动作类型 | 已核对；现有类型足够表达绑定 |
| `src/ui/story-editor/view.ts` | Choice 编辑预览入口 | 实施中；每个选项渲染绑定卡和 pair 维护控件 |
| `src/ui/components/story/story.ts` | Choice 预览的实际呈现 | 实施中；编辑预览可选 addon 不改变播放态 |
| `src/ui/story-editor/model.ts` | Draft 节点与插入/标记编辑 | 实施中；新增 pair、级联重命名、反查与受标记节点创建 API |
| `src/ui/story-editor/property-model.ts` | 节点 ID 派生的分支、行、raw input 缓存键 | 已核对；模型 ID 改名迁移缓存 bucket 的 nodeId 前缀 |
| `src/ui/story-editor/controller.ts` | StoryNode 拖放源/目标委托 | 实施中；复用 Task 0340 分派并接入 Choice 卡与确认弹窗 |
| `src/ui/css/story-editor.css` | Choice 行左侧迷你卡布局与拖放反馈 | 实施中 |
| `tests/ui/story-editor-workspace.test.ts`、`tests/ui/story-editor-model.test.ts` | 配对写入、冲突及 UI 可见行为 | 未运行；未新增测试 |
| `docs/docs-830/05-domains/story-and-effects.md` | 局部标记与重复分支事实 | 已更新 Choice 绑定卡维护机制 |
| `docs/docs-830/07-tooling/runtime-editor-and-project-checks.md`、`ui-style/patterns.md` | Story Editor 机制与视觉约定 | 已更新绑定卡、拖放和编辑器边界 |

## 当前进度

- [x] 核对现有 Choice / localFlag / requiresFlag 合同并选择不增加运行时 Schema。
- [x] 补齐绑定卡、级联改名、随机 node ID 提示和不入 UI 的反查/创建 API 设计。
- [x] 实现 Choice 绑定卡、pair 维护、级联改名与 node ID 确认。
- [x] 实现标记反查和创建受标记节点模型 API，不添加 UI 入口。
- [x] 在带 `requiresFlag` 的节点左侧显示固定宽度标记记录，并支持将 StoryNode 拖放到记录以复用该标记；冲突条件拒绝覆盖。
- [x] 更新机制/视觉文档并完成类型、文档和差异核验。
- 正在进行：无。
- 下一步：无；自动化 UI 与浏览器交互未运行。

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 失败后的排查与处理 / 未执行原因 |
| --- | --- | --- |
| 源码 / 数据结构核对 | 已完成；确认现有合同可表达，不必先增加 Schema | 无 |
| `npx tsc --noEmit` | 通过 | 无 |
| `npm run check:docs` | 通过；110 篇 Markdown，0 错误 | 无 |
| `git diff --check` | 通过 | Git 提示若干工作区既有 CRLF 文件将来可能转换为 LF；无空白错误 |
| 自动化 UI / 浏览器交互验证 | 未运行 | 按当前执行约束未运行测试，且未做浏览器手动验收 |

- 当前结果：Choice 提供方卡只显示标记 ID；读取节点显示固定宽度、稳定配色的标记记录，并可接收 StoryNode 拖放以复用标记。每节点独立的原子 flag pair、级联改名、随机节点 ID 提示，以及不入 UI 的标记反查/创建模型 API 已实现；未增加运行时合同或 Schema。类型检查通过，自动化和浏览器交互尚未验收。

## 剩余工作与交接

- 代码与静态检查已完成；后续浏览器验收可补充拖放、级联改名弹窗与卡片视觉证据。反查/创建模型接口不接入 UI。
- 已按 GALHCG 项目地图做只读复核：确认项目身份并搜索受影响路径；`module:game-ui` 暂无映射文件。未改图、未刷新、未写 freshness。
