# Task：Stage 02.5-B：开发导航协调器与运行事实读取

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 02.5-B的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：测试启动未ready、有效目标、current事实读取、并发行为和导航准备失败保留原会话；不得用固定延时模拟ready。
- 前置：Task 0388 确认 Stage 02 无阻塞项，且 Task 0387 的就绪与正式入口调查完成。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：从main.ts核实runtime/包/默认内容/UIController.mount顺序；核对controller.ts正式openStoryEditor/openWorldBrowser/closeEditorWorkspace、workspace-router.ts、Story browse和bindWorldBrowser定位入口。
- 具体调整：建立DEV-only typed request/result协调器，调用正式公开业务导航，不直读私有字段。ready等待资源服务与宿主就绪；navigate仅在资源、必要样式及宿主可操作后成功；current读取真实route、资源身份、有效布局和运行状态；并发采用串行或busy拒绝。
- 衔接与验证：测试启动未ready、有效目标、current事实读取、并发行为和导航准备失败保留原会话；不得用固定延时模拟ready。 检查入口：main.ts、controller.ts、workspace-router.ts及Story/World导航用例。 开工时重核工作树，不从文档推断代码已实施。

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
