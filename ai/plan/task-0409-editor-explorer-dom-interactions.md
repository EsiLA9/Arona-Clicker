# Task：Stage 06-C：树交互与DOM稳定更新

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 06-C的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：DOM测无关行、滚动宿主、列身份保留；展开和打开分流；dispose清observer/listener；必要时浏览器验真实scroll/focus。
- 前置：Stage 06-C；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：editor-directory row/toggle/scroll已有通用渲染；业务绑定有重复。
- 具体调整：公共controller接管展开/折叠、placement选择、search投影、hover/focus/selected、滚动宿主、stable key和祖先显露/focus。分开展开与打开事件；单行操作只更新相关子树，保留scroll host/无关DOM，不重建Workbench。
- 衔接与验证：DOM测无关行、滚动宿主、列身份保留；展开和打开分流；dispose清observer/listener；必要时浏览器验真实scroll/focus。 检查入口：editor-directory.ts、editor-directory-scroll.ts、Story/World binder与WorkspaceColumns。 开工时重核工作树，不从文档推断代码已实施。

## 工作项

- [ ] 复核前置Task、当前源码与直接调用方，补入实际符号、测试入口及偏离基线的事实。
- [ ] 完成本节点迁移，记录状态权威去向和退出的旧写入口；不得用双写同步替代迁移。
- [ ] 运行对应定向验证；区分新回归与已有基线，必要时仅做风险相关浏览器检查。
- [ ] 记录Checkpoint：文件/符号、旧路径退出、验证结果、遗留项和下一Task第一动作。

## 当前进展

- 已完成：依据长期合同拆为独立工作节点；尚未复核本Task开工时最新源码。
- 正在进行：等待任务文档核验；未开始代码施工。
- 下一步：文档核验通过且施工启动后，先复核当前依据，再实施本节点迁移。

## 结果与问题

- 验证结果：仅任务文档整理；未运行代码测试或浏览器验收。
- 发现问题：待施工结合当前源码核实；边界冲突按Task0386停止条件处理。
