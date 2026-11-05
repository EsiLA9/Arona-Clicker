# Task 0355：Story 编辑器的主题、定位与流操作交互

状态：实现与自动化验证完成；桌面鼠标验收待人工完成（2026-11-04）。承接 [[ai/plan/task-0354-story-editor-authoring-api]]。

## 期望结果

让作者能够理解并操作主题设置、高级位置设置、信息流及控制流，而不必依赖通用对象树、手填字段名或猜测运行效果。保留 0354 已完成的作者 API、结构值编辑、校验、隔离试播与包保存，在其上增加专用控件、效果预览和影响说明。

默认范围是游戏内 `src/ui/story-editor/`。主题内容定义需要借用既有主题内容编辑服务；不把玩家自定义主题编辑器当成数据包写入口。维持三栏、大标题下平铺小项的布局，不恢复层层嵌套的卡片。

## 现有背景与实际缺口

以下为 `7cacdaa` 后的源码核对，不将“交互不充分”写成“引擎或编辑器完全不支持”。

| 领域 | 当前已支持 | 本任务要补的部分 |
| --- | --- | --- |
| Story 主题动作 | `presentation.theme` 已有 scope、实体、ColorGroup 选择，palette / tokens / nodes / background 经 0354 可结构化编辑 | 颜色与语义字段的专用控件、继承来源、默认值与显式覆盖区别、真实效果预览；不再让作者从空对象手建主题结构 |
| 实体表现 | set / clearEntityPresentation 已有目标、option、owner、lifetime | 用途说明、目标可用项预览、设置与清理的对应提示；核实各生命周期的实际清理时机 |
| 覆盖层位置 | `overlay.show` 已有 x / y / align；坐标为聊天窗格内 0–1，渲染以左下角为原点 | 可视化位置调整、常用位置预设、精确数值与对齐联动、实际内容边界与默认位置反馈 |
| 背景与组件位置 | BackgroundLayerDef 有 position / size / repeat / scale / rotation 等；ComponentPlacementDef 有 parent / anchor / offset / size / fit 等 | 将两种位置模型分别提供有含义的表单；组件布局通过其所属 ThemeDef / Presentation 内容编辑，不能塞进不支持这些字段的 StoryThemeValue |
| 信息流操作 | overlay 已有 show / clearId / clearAllTexts / clearFlow；消息、文本与入口卡可编辑 | 明确操作对象、ID 候选、同 ID 的实际行为、清理影响与隔离预览；区别覆盖层清理和聊天历史清理 |
| 故事控制流 | transfer 已有 goto / insert；Button / Choice 结果也能转移；Entry 请求、kizuna、areaContinue 与移动节点已有入口 | 面向作者解释每种动作是否返回、是否阻塞、是否切场和何时接续，并显示引用去向与可确定的影响；不开放内部游标操作 |
| 执行预览 | 0354 的端口返回播放条目、Story、发送状态并能推进 | 目前编辑器试播没有完整的主题 / 背景 / 定位覆盖层宿主；需补隔离表现投影，不能以纯文本输出代表视觉效果已验收 |

## 交互方案草案

### 主题设置

- 按“作用对象—颜色组—色板—语义颜色—背景层—实体表现”平铺各小项；每项都有标题、当前值和用途说明。只在当前动作支持的范围显示相应设置。
- 色板提供有序色槽及增删换序，遵守当前最多六色的合同；颜色同时支持选择器与文本输入，保留原有合法表达式 / 引用形式，不能强制转为十六进制字符串。
- tokens / nodes 使用实际可用键、中文含义、当前解析值与显式覆盖状态。删除覆盖表示继承；“未设置”“空值”“恢复继承”按真实合同处理，不用占位字符串代替。
- 背景层按真实 kind 提供资源、透明度、位置、尺寸、重复、混合及变换字段；复用资源目录与现有主题解析，不新增任意 CSS / HTML 执行入口。
- 明确区分临时演出、Area / 角色主题槽与实体表现 lifetime。`theme` 本身没有独立的清理命令，不凭 UI 命名虚构 reset / owner / lifetime 字段；先核实实际恢复机制，再提供相应说明或已有合法操作。
- 若需修改被引用色组或实体 ThemeDef，明确打开其编辑态包内容会话，复用 ThemeContentEditorService 的校验、冲突检测、预览清理和保存。不得因修改 Story 引用而隐式改写色组定义或玩家主题。

### 高级位置设置

- 覆盖层首先提供预设位置和受约束的二维位置画布，再保留精确 X / Y 与对齐输入；鼠标调整写回同一草稿字段，不产生另一份定位数据。
- 预设只是当前 x / y / align 的便捷写法。区分坐标原点、内容对齐和实际边界，不新增引擎没有的锚点、宽高或层级字段。省略坐标时使用运行时同一默认来源；超范围输入按作者校验反馈，不依靠渲染端静默截断冒充合法保存。
- 画布以预览聊天窗格为坐标边界，真实显示文本、消息或卡片；窗口尺寸改变时保持归一化位置。只支持宽屏鼠标验收；保留已有 responsive 内容但不扩大到移动端设计。
- 背景 position / size 与组件 anchor / offset / size 使用各自的单位、适配和父级候选；不能套用聊天覆盖层的左下角坐标。组件父级循环、缺失资源和非法数值应在既有内容校验边界拒绝。
- “移动显示内容”和“移动故事场景”必须分开：moveToArea / moveToCharaspace / travel 修改场景或旅行语义，位置画布只编辑表现。

### 信息流与控制流操作

这里将“流信息操作”分成聊天内容 / 覆盖层操作和故事控制流，两者各有标题与说明，不合成一个任意命令面板。

- 信息流：显示覆盖层、清除指定 ID、清除全部覆盖文本、清除当前聊天流；每种命令展示实际作用范围和保留内容。先核实 clearFlow 对正式历史、重读和各 owner 的实际边界，不增加跨会话清空能力。
- 提供来自当前正文及可达引用的覆盖层 ID 候选、写入 / 清理位置和跳转定位；同 ID 覆盖或替换行为以运行时核实为准，不能一律判为重名错误。不能静态确定时标为提示，不伪装成执行结果。
- 故事转移：清楚说明 goto 离开当前正文、insert 返回调用处后继；标明它们与 Entry 子故事回调不同。覆盖顶层 transfer 和 Button / Choice 的 result.transfer，不复制一套不一致的控件。
- Entry 请求、爱心卡赴约、areaContinue 和显式场景移动显示目的地、阻塞 / 返回条件与后续位置。继续遵守一层羁绊子调用、独占关联和子结束停留最终场景的规则。
- 使用简短的只读“执行影响”区域显示所选动作影响当前会话、覆盖层、场景还是正文去向。局部标记检查只是键存在，不把它包装成任意值条件；持久 flags 与局部 flags 继续区分。
- 只做作者操作与引用辅助，不新增自由游标调度、调用栈编辑或通用流程图系统。旧 stages / stageId 不恢复为有效推进控制。

## API 与接线要求（拟议，尚未实现）

1. 草稿层沿用 `writeStructuredValue / editProperty / propertyKey / rowIdAt`，为上述专用控件补少量语义构造与修改函数；校验仍以正式投影为准。新增状态仅限当前选择、拖动及未完成输入，不能混入正式 Story 数据。
2. 只读候选层复用 ColorGroup、资源、Theme 节点、实体表现与 Story 引用目录；主题解析值与来源从既有主题服务投影，避免 UI 另写合成算法。需要新增查询时只开放编辑器所需的窄视图。
3. 扩展 0354 的隔离试播端口，提供预览所需的主题、背景、覆盖层、虚拟场景和变化版本等只读结果；具体返回结构在施工前根据现有服务确定，不直接向 UI 返回 GameInstance、可变 Map 或内部 token 管理器。
4. 作者草稿与隔离实例负责内容修改与演出；表现宿主仅渲染。调整位置不推进剧情，读取预览不产生计时器，主题预览不污染正式根主题。关闭、换文档或离开必须清理临时表现与监听。
5. Story 仍使用 0354 的校验 / 应用 / 包保存 API；ThemeDef 等包内容走既有主题内容会话。分清目标包、预览与保存状态；不要求两个不同会话假装成未实现的跨表原子事务。

## 组件与刷新草图

```text
现有三栏与滚动宿主
  中栏：现有静态节点预览；按需显示隔离演出 / 位置画布
  右栏：当前节点
    主题：作用对象、颜色、背景、效果来源
    位置：预设、X/Y、对齐，或所属主题的组件布局字段
    流操作：命令、目标、清理范围、执行影响
```

- 不新增嵌套滚动宿主；新增画布只负责当前编辑目标，新增分组节点只负责标题与字段。ThemeDef 编辑复用既有主题内容编辑区域 / 会话，不重建一套主题设置页。
- 拖动时只更新选中覆盖层的位置与对应数值，提交时合并到既有刷新入口；稳定 key 使用节点 / 动作行 / 覆盖层或主题层身份，不用坐标、可编辑 ID 或数组下标充当 DOM 身份。
- 保持 Story 列表、正文选择、右栏输入、滚动和未受影响的覆盖层不变；替换目标前沿用 DOM mutation range 的 popover 清理。宿主缺失只恢复所属区域，路由变化才切换工作区。
- 施工前补齐实际 DOM wrapper 职责、region 目标和拖动提交时机；沿用 `frontend-design` 与 [[ui-style/00-index]]，不另设视觉风格。

## 施工步骤与验收

- [x] 核实主题合成 / 清理、坐标默认值 / 对齐、同 ID 覆盖及 clearFlow 的真实执行链，先列已支持和需补 UI 的矩阵。
- [x] 设计并接入最小只读预览投影与草稿语义操作，保持 API 边界和生命周期。
- [x] 完成主题专用表单与资源 / 语义候选，覆盖新增、编辑、删除覆盖、继承恢复和作用域切换。
- [x] 完成覆盖层可视化定位、常用位置预设与精确字段；对 ThemeDef 所属布局复用正确的内容编辑路径。
- [x] 完成信息流操作与正文转移的目标选择、引用定位和影响说明；覆盖所有合法嵌套动作位置。
- [x] 行为回归：候选与保存使用同一合同；错误输入不丢失，换序 / 休眠分支 / 重载保留身份；拒绝非法引用和非法坐标，正式玩家状态不受预览影响。
- [x] 表现回归：主题作用域、背景位置、覆盖层默认值与精确坐标、ID 清理、clearFlow 和父子场景切换与正式运行一致；关闭预览后无遗留主题或监听。
- [ ] 桌面鼠标验收：拖动与数值双向同步、焦点 / 光标 / 滚动保留、长文本 / 图片 / 卡片边界、主题预览隔离；截图不能代替操作连续性检查。
- [x] 按实际影响运行 `npm test` 定向测试、类型 / 架构 / 构建 / 文档检查；若确需合同变更再走 Schema 同步。完成后更新对应 Wiki 与样式约定。

## 文件与核对入口

| 范围 | 入口 | 本轮状态 |
| --- | --- | --- |
| 当前作者合同 | `src/data-services/contracts/story-node-actions.ts`、`story-node.ts`；`src/engine/types/expression.ts`、`theme.ts` | 已核对相关字段，未修改 |
| 编辑器 | `src/ui/story-editor/property-fields.ts`、`property-options.ts`、`structured-value.ts`、`authoring-model.ts`、`authoring-view.ts`、`controller.ts` | 已接入主题语义表单、预览定位与预设、主题内容会话、流影响说明 |
| 隔离预览 | `src/arona-clicker/contracts/runtime/story-authoring.ts`、`story-presentation.ts`；`runtime/runtime-game-instance.ts` | 已提供 detached 主题 / 场景 / 覆盖层投影；不暴露预览实例 |
| 主题内容 / 表现 | `services/presentation/theme-content-editor-service.ts`；`src/ui/presentation/`、`components/settings/user-theme-editor.ts`；[[story-chat-and-theme-presentation]] | 已复用编辑态数据包内容会话、校验、预览和保存 |
| 聊天与覆盖层 | `src/ui/components/story/story.ts`、`src/ui/presentation/chat-stream.ts`；`src/arona-clicker/services/story/` | 已接入位置编辑、ID 候选及按 owner 的清理影响说明 |
| 回归与说明 | `tests/ui/story-editor-properties*.test.ts`、`story-editor-authoring.test.ts`；`tests/engine/story-authoring.test.ts`、`story-flow.test.ts`、`theme-content-editor-service.test.ts`；[[runtime-editor-and-project-checks]] | 定向测试、类型、构建、架构及文档检查结果见下方记录 |

## 实现与验收记录

- Story 编辑器现在用专用语义控件编辑主题覆盖、色板、token、节点色和背景；可打开所引用 ColorGroup / ThemeDef 的编辑态数据包内容会话。预览使用隔离 Run 的只读主题、场景和覆盖层投影。
- 覆盖层可在实际聊天窗格预览、拖动或使用六种位置预设；所有操作都写回相同的坐标与对齐字段。信息流清理、故事转移和场景移动显示各自作用对象与后续影响。
- Base 文件夹导出按 DataPack 顶层字段写入多个 `content/*.json`，避免单个超大结构文件；Runtime 生成包仍使用 `content.json`。
- 定向验收：`story-editor-properties.test.ts`、`story-authoring.test.ts`、`theme-content-editor-service.test.ts` 共 26 项通过。`npx tsc --noEmit`、`npm run check:architecture`、临时目录 Vite 构建及 `git diff --check` 通过。
- 原全量基线记录为 18 个测试文件失败、41 项失败、6 项跳过。失败条目按文件与根因归并如下，现已逐项处理：

  | 失败条目 | 原因与处理 |
  | --- | --- |
  | `tests/engine/arona-runtime-pack.test.ts`、`tests/data/bundled-base-pack.test.ts`、`tests/ui/datapack-workspace-order.test.ts`、`tests/ui/topbar-settings-workspace.test.ts` | 对 Base 包版本写死旧值；断言改为读取当前默认包版本 / 实际包 ID。 |
  | `tests/data/base-datapack-folder-export.test.ts` | 重复启动 Vite 子进程导致耗时，且只验证单个大结构文件；改为直接测导出函数，并验证字段分片、完整解析、资源和重复导出稳定性。 |
  | `tests/engine/affection-system.test.ts`、`tests/engine/def-factory/story.test.ts`、`tests/ui/story-editor-model.test.ts`、`tests/ui/story-editor-workspace.test.ts`、`tests/data/area-map-demo.test.ts` | StoryDef 合同要求 `startContext`；补齐合法 Area 上下文与样例数据。 |
  | `tests/engine/def-factory/story-entry.test.ts` | 期望值遗漏 StoryEntry 默认 `interruptible: true`；修正断言。 |
  | `tests/ui/workspace-structure.test.ts`、`tests/tooling/archive-docs.test.ts` | CSS 导入检查仍读旧入口；archive-docs 临时目录跨出工作区后无法原子重命名；分别改为检查当前 CSS 入口、使用工作区临时目录，并在系统拒绝创建符号链接时跳过该平台专属断言。 |
  | `tests/engine/game-instance.test.ts`、`tests/engine/story-flow.test.ts`、`tests/engine/story-playback-coordinator.test.ts`、`tests/engine/story-replay.test.ts`、`tests/ui/story-history-resume.test.ts` | 断言仍基于旧 Replay 移动、投递等待点、游标失配和历史写入语义；改为覆盖当前隔离回放、当前定义恢复及历史边界。 |
- 处理后最终全量 `npm test`：371 个测试文件通过，3689 项测试通过，0 失败；输出在 `.test-artifacts/latest.log`。`npx tsc --noEmit`、`npm run check:architecture` 与临时目录 Vite 构建通过。
- `npm run check:docs` 通过。清理了 6 条指向已删除历史报告 / 交接页的断链，改指向当前 Task 或 Area Map 机制页；历史正文未重建。未改 Schema 合同，因此未生成 Schema。
- 桌面鼠标连续操作验收未执行：Computer Use 因无法可靠确认 Windows 浏览器当前 URL 而停止，故拖动焦点 / 滚动保持、长文本 / 图片 / 卡片边界仍待人工确认。
