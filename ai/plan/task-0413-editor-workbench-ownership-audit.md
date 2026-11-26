# Task：Stage 07-A：唯一状态所有者审计

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 07-A的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：通用状态一个writer，无同步双权威；业务状态归Provider；阶段门槛有源码/测试证据或显式人工验收遗留。
- 前置：Stage 07-A；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：以Stage03-06最终代码为事实，不把Stage00调查表当实现。
- 具体调整：逐项列Layout、Workbench session、Manager、Explorer、业务Provider、WorkspaceColumns、theme/return的唯一写服务、入口、消费者与证据；搜索旧偏好、sidebarVisible/inspectorVisible、World view、旧instances/IDs和Explorer state writers。
- 衔接与验证：通用状态一个writer，无同步双权威；业务状态归Provider；阶段门槛有源码/测试证据或显式人工验收遗留。 检查入口：Stage03-06实际文件、Task0386合同，rg/typecheck/architecture check。 开工时重核工作树，不从文档推断代码已实施。

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
