# Task 0340：Story 编辑器插入位置与节点拖放

状态：代码与静态验收完成 — 插入位置、拖拽换序与后续载荷/目标扩展入口已接通

## 目标与范围

- 目标：在 Story 编辑态提供不属于 StoryNode 的插入光标；作者可点击节点间空位确定后续内容的插入位置，并可拖动任意 StoryNode 到空位调整顺序。
- 范围：Story Editor 临时状态、节点创建/排序模型、中央流 DOM、委托交互、样式、相关文档和既有 UI 验证入口。
- 约束：插入位置不得进入 StoryDef、草稿持久化或 Registry。节点拖放须保持 node.id、阶段与节点内容；跨 Story / 过期 / 非法载荷不得修改内容。
- 扩展边界：采用可辨识的拖拽载荷和语义投放目标，当前仅接受 StoryNode 移动到插入位置；后续可增加目标类型与元素绑定处理，不预设具体绑定规则。
- 验收：节点前和列表末尾均可显示唯一插入横线；点击空位后，从 composer 或添加动作创建的节点插入指定处，横线仍位于最新内容之后；所有节点均可拖放到插入位置换序；鼠标/键盘可操作插入位置；编辑态重排不修改运行时定义，保存后仅更新作者 nodes 顺序。

## 当前进度

- [x] 阅读前端设计约定、项目游戏 UI 覆盖规则、Story Editor 机制文档与相关测试约定。
- [x] 核对节点流渲染、appendNode/moveNode、编辑状态、委托绑定及 keyed DOM 更新入口。
- [x] 确定结构：按 `before-node:<nodeId>` 或 `end` 稳定锚定的瞬态插入位置；Central flow 内的语义 gap 按钮；节点统一拖拽载荷；单一 flow root 委托拖放。
- [x] 实现临时插入锚点与按锚点创建/排序节点。
- [x] 实现可访问的插入横线、拖拽反馈与 StoryNode 换序；拖动悬停仅更新局部目标样式，修改后仍由 keyed DOM 更新保留节点和滚动。
- [x] 更新 UI 约定 / 机制说明并完成类型、文档与差异护栏核验。
- 正在进行：无。
- 下一步：无；浏览器手动拖拽验收未执行。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/ui/story-editor/model.ts` | StoryEditorState、创建与排序 | 已修改；瞬态锚点不写入 draft，支持任意节点按锚点重排 |
| `src/ui/story-editor/view.ts` | StoryNode 与中央流渲染 | 已修改；节点前及末尾输出稳定 keyed 插入按钮，所有节点可拖动 |
| `src/ui/story-editor/controller.ts` | 事件委托、请求刷新与节点动作 | 已修改；单栏根委托 click / keyboard / drag events，检查载荷版本和 draft 身份 |
| `src/ui/css/story-editor.css` | 中央流布局与节点状态 | 已修改；插入横线、焦点、拖动源和投放反馈 |
| `tests/ui/story-editor-workspace.test.ts` | 编辑器节点顺序与 DOM 行为 | 未运行；未新增测试 |
| `docs/docs-830/07-tooling/runtime-editor-and-project-checks.md` | Story Editor E1 机制正文 | 已补临时插入点、拖拽排序与持久化边界 |
| `ui-style/patterns.md` | 可复用 UI 交互风格记录 | 已补插入空位、分型载荷与局部拖放反馈约定 |

## 事实与决定

| 问题 / 决定 | 已核实事实及依据 | 待解决问题 |
| --- | --- | --- |
| 节点列表所有权 | `StoryDraft.document.nodes` 是 Story 作者内容唯一有序列表；`appendNode` 总追加并新增 Talklet/Click 阶段，`moveNode` 做相邻交换。 | 插入光标必须仅存 `StoryEditorState`，不可序列化进 `StoryDraft`。 |
| DOM 更新范围 | Story Editor 声明 `updates: 'external'`；`StoryEditorController.refresh()` 通过 `patchEditorDOM` 按 `data-editor-key` 协调 DOM，中央栏有单独滚动容器。 | 插入项使用按节点 ID 锚定的 key；需确认末尾/空列表锚点唯一。 |
| 连续插入语义 | 编辑模型可按锚点 ID 计算节点索引；插入到锚点前后保留相同锚点，横线自然位于新插入内容之后。 | 锚点节点被删除时回退到删除位置的下一节点或列表末尾。 |
| 拖放扩展 | 当前需求只定义 StoryNode 拖放到流位置；未来元素绑定尚无业务合同。 | 只实现 versioned StoryNode payload 与 drop target 委托，不虚构未来绑定行为。 |

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 失败后的排查与处理 / 未执行原因 |
| --- | --- | --- |
| `npx tsc --noEmit` | 通过 | 无 |
| `npm run check:docs` | 通过；109 篇 Markdown，0 错误 | 无 |
| `git diff --check` | 通过 | Git 提示若干工作区既有 CRLF 文件下次被 Git 更新时可能转换为 LF；无空白错误 |
| 自动化 UI 测试 / 浏览器手动交互 | 未运行 | 按执行约束未运行测试或启动浏览器验收；实现仅通过类型与结构核查 |

- 当前结果：已实现内存态节点锚点、可点击/键盘可达的插入空位、composer/Click/Operation/Transfer 按锚点插入、StoryNode 拖到空位或节点上下半区换序、跨草稿/旧载荷拒绝与 hover 目标提示；任务未添加或运行自动化测试，尚无浏览器手动验收证据。

## 剩余工作与交接

- 代码与静态验收已完成；可在后续用户指定的浏览器验收中补充原生拖拽兼容性证据。
- 已按 GALHCG 项目地图进行只读影响复核；`module:game-ui` 当前没有关联映射文件。未改图、未刷新、未写 freshness。
