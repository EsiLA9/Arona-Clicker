# Task：Stage 04-A：World Provider业务状态提取

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 04-A的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：测Init/Area/Spot路径、无效目标恢复、摘要局刷/目录选中/只读行为；记录暂留字段和Stage06去向。
- 前置：Stage 04-A；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：world-browser.ts含WorldEntityRef、worldTreePath/buildDefaultWorldTree；UIController持World session和bindWorldBrowser；Explorer状态暂留至Stage06。
- 具体调整：提取World资源ref、有效性、实体切换、内容准备/恢复、标签元数据和只读描述；不引入草稿或保存gate。树placement/展开/search留待Explorer迁移；去掉World独立通用ID/集合职责。
- 衔接与验证：测Init/Area/Spot路径、无效目标恢复、摘要局刷/目录选中/只读行为；记录暂留字段和Stage06去向。 检查入口：world-browser.ts、WorldBrowserSession、bindWorldBrowser及World测试。 开工时重核工作树，不从文档推断代码已实施。

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
