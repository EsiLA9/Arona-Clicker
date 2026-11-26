# Task：Stage 03-B：公共Browse Instance Manager核心

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 03-B的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：测ID/顺序/active一致、后台关闭不改active、活动关闭选邻项、Provider失败不留孤项；搜索不存在第二集合/ID写入。
- 前置：Stage 03-B；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据：Story为首个Provider，实例集合操作分散在Story session和Controller。
- 具体调整：公共服务唯一写稳定ID、Provider key、集合顺序、activeId和生命周期；提供创建/激活/关闭/复制/open-or-reuse/后继选择。Provider负责身份、初态、capture/restore、门禁和元数据。Manager不导入StoryDraft/StoryNode/WorldEntity，不建复杂插件协议。
- 衔接与验证：测ID/顺序/active一致、后台关闭不改active、活动关闭选邻项、Provider失败不留孤项；搜索不存在第二集合/ID写入。 检查入口：workspace公共服务、Story adapter及实例状态测试。 开工时重核工作树，不从文档推断代码已实施。

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
