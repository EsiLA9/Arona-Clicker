# Task：Stage 07-C：真实Provider接入指南

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 07-C的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：示例链接到真实源码/测试，新执行者能找到注册/装配/命令入口；check:docs通过，事实和当前实现一致。
- 前置：Stage 07-C；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：扩展workspace-columns-and-layout机制页和合适现行页；先查重复职责。
- 具体调整：用真实Story/World符号说明Workbench布局/Host，Instance resource identity/初态/capture-restore/leave gate/中右内容/copy-reuse-close策略，以及Explorer resource/placement refs/树投影/领域筛选/open-locate/多放置规则；指明装配点与测试，不只说复用服务，也不臆造未来API。
- 衔接与验证：示例链接到真实源码/测试，新执行者能找到注册/装配/命令入口；check:docs通过，事实和当前实现一致。 检查入口：docs/docs-830/04-presentation/workspace-columns-and-layout.md及既有机制页。 开工时重核工作树，不从文档推断代码已实施。

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
