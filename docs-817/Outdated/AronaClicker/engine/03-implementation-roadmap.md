# 实现路线图 (Implementation Roadmap)

## 阶段0：稳定命名 (Phase 0: Stabilize Naming)

在编写加载器之前，先确定模板种类的规范运行时名称。

推荐的规范名称：

- `Init`
- `Area`
- `Spot`
- `Enhancement`
- `Character`
- `Story`
- `PassiveStory`
- `ActiveStory`
- `ResourceValue`
- `Tag`
- `ValueMap`

然后为遗留拼写和小写运行时ID保留兼容性别名映射。

## 阶段1：添加加载器骨架 (Phase 1: Add Loader Skeleton)

首先实现以下文件：

- `src/core/DatapackLoader.ts`
- `src/core/DatapackRegistry.ts`
- `src/core/TemplateResolver.ts`
- `src/core/DatapackDiagnostics.ts`

在这个阶段，目标不是游戏玩法。目标是：

- 加载元数据
- 规范化原始模板ID
- 构建依赖图
- 将模板注册到一个注册表中

同时，让管理UI领先运行时一步：

- 构建模组加载计划器页面
- 允许用户手动排序包
- 切换启用/禁用状态
- 预览依赖安全加载顺序
- 导出并持久化加载计划

这使我们在真正的加载器接入之前稳定操作流程。

## 阶段2：添加兼容性层 (Phase 2: Add Compatibility Layer)

实现：

- 类型别名规范化
- 简写引用展开
- 遗留字段迁移钩子

将此逻辑隔离在一个地方。如果兼容性规则扩散到每个系统，未来的维护成本将迅速变得昂贵。

## 阶段3：连接编辑器导出到运行时导入 (Phase 3: Connect Editor Export To Runtime Import)

为编辑器包定义一个面向引擎的导入格式。

桥接应：

- 读取编辑器包元数据
- 将模板草稿/数据转换为运行时原始模板记录
- 保留规范的 `mod:type:id` 引用
- 为无效或不完整的导出发出诊断信息

这是使编辑器成为真正内容管道而非独立工具的步骤。

## 阶段4：解析运行时引用 (Phase 4: Resolve Runtime References)

在注册工作后，实现以下类型的解析：

- `Init -> defaultArea`
- `Area -> parentInit`
- `Spot -> parentArea`
- `Story -> talklet jump targets`
- `Tag -> member templates`
- `ValueMap -> parentTag`

每个解析器应验证：

- 目标存在性
- 目标类型正确性

## 阶段5：添加补丁/扩展支持 (Phase 5: Add Patch/Extension Support)

仅在基础加载器稳定后才添加跨包补丁。

从狭窄的操作开始：

- 追加到列表字段
- 合并类集合成员字段
- 替换明确白名单的标量字段

首先避免通用的深度对象补丁。

## 阶段6：围绕内容图构建测试 (Phase 6: Build Tests Around Content Graphs)

推荐的测试：

- 缺失依赖包
- 重复数据包ID
- 重复完整模板ID
- 有效的同包引用
- 有效的依赖包引用
- 无效的未声明跨包引用
- 类型别名兼容性
- 简写引用规范化
- 补丁应用顺序

## 实际的首个里程碑 (Practical First Milestone)

第一个引擎里程碑应该是：

1. 内置 `basePack` 加载
2. 一个编辑器导出的数据包加载
3. 两者出现在一个注册表中
4. `mod:type:id` 引用跨包解析
5. 无效引用产生可读的诊断信息

一旦这工作，游戏玩法系统可以在稳定的内容图之上开始构建。
