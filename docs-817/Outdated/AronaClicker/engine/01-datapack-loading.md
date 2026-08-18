# 数据包加载 (Datapack Loading)

## 目标

在游戏开始之前，引擎必须将外部数据包内容转换为完全链接的运行时模板。

加载机制应保证：

- 确定性的加载顺序
- 稳定的模板ID
- 依赖验证
- 两阶段引用解析
- 当数据包无效时可读的诊断信息

它还需要满足当前项目的规则：

- 加载计划中只能有一个具有相同 `modName` 的数据包处于活动状态
- 数据包只能实例化属于其自身 `modName` 的内容
- 跨模组效果必须通过显式操作、补丁或其他声明的行为发生
- 数据包以依赖安全顺序加载，引擎必须支持具有显式顺序控制的批量加载
- 数据包可以声明依赖项

## 规范运行时模型

在运行时，数据包应经历以下层级：

1. 原始源 (Raw source)
   一个zip包、json文件或内置包模块。

2. 解析的描述符 (Parsed descriptor)
   元数据加上原始模板载荷，尚未解析。

3. 已注册的包 (Registered package)
   包被接受进入注册表，其模板被全局索引。

4. 已解析的包 (Resolved package)
   所有引用被重写为指向实际模板的 `TemplateRef` 对象。

5. 就绪的包 (Ready package)
   包已通过兼容性检查，可由游戏系统实例化。

## 推荐的加载阶段

### 阶段1：读取源 (Read Source)

输入可以来自：

- 内置TS模块，如 `src/data/BasePack.ts`
- 编辑器导出的bundle zip
- 纯json数据包文件

加载器应将每个输入转换为通用的内存形状：

```ts
interface DatapackSourceDescriptor {
    manifest: DatapackMetadata;
    templates: RawTemplateRecord[];
    origin: 'builtin' | 'bundle' | 'json';
    sourceName: string;
}
```

### 阶段2：验证元数据 (Validate Metadata)

立即验证：

- `metadata.id` 存在且唯一
- `metadata.version` 存在
- `dependencies` 不包含自引用
- 依赖ID唯一

此阶段应在接触全局注册表之前拒绝格式错误的包。

### 阶段3：规范化模板记录 (Normalize Template Records)

每个原始模板记录应规范化为规范形状：

```ts
interface RawTemplateRecord {
    fullId: string;      // modId:type:id
    modId: string;
    type: string;
    templateId: string;
    payload: Record<string, unknown>;
}
```

重要规则：

- 即使源格式是紧凑的，加载器也应立即物化 `fullId`

这使引擎的其余部分免于模糊的简写形式。

### 阶段4：构建依赖图 (Build Dependency Graph)

所有已接受的数据包应按 `metadata.dependencies` 进行拓扑排序。

推荐策略：

- 首先加载内置基础包
- 然后加载直接依赖
- 最后加载叶游戏包

如果缺少依赖项，则拒绝该包，错误应命名双方：

- 请求包ID
- 缺失的依赖ID

阶段5：注册原始模板 (Register Raw Templates)

在解析任何引用之前，将每个模板注册到全局注册表：

```ts
Map<FullTemplateId, BaseTemplate>
```

这很重要，因为在ID级别允许循环引用。模板可以合法地指向在依赖顺序中稍后注册的内容，只要目标在注册阶段结束时存在。

在注册时，强制执行所有权规则：

- 包 `foo` 只能注册其规范ID以 `foo:` 开头的模板
- 如果包尝试直接注册 `bar:*:*`，加载器拒绝该记录
- 修改其他包必须通过显式的兼容性/补丁机制，而非外国所有权

### 阶段6：解析引用 (Resolve References)

在所有模板注册后，遍历每个引用字段并解析：

- 字符串ID -> 规范完整ID
- 规范完整ID -> `TemplateRef`
- `TemplateRef.refStatus` -> `Ready`

这是发生以下操作的点：

- 类型验证
- 依赖可见性规则强制执行
- 简写引用展开

### 阶段7：运行兼容性适配器 (Run Compatibility Adapters)

兼容性在注册后但在包标记为就绪之前运行。

典型适配器：

- 小写类型别名 -> 规范类型令牌
- 旧字段名 -> 当前字段名
- 简写 `id` -> `mod:type:id`
- 拼写错误别名，如 `Characater` -> `Character`

此阶段应为恢复的问题发出警告，为无法恢复的问题发出错误。

### 阶段8：冻结就绪状态 (Freeze Ready State)

当解析成功时，注册表将数据包标记为可供游戏系统使用。

此时：

- `TemplateArchive` 可以公开模板
- 故事、区域、价格和标签逻辑等系统可以安全地查询它们
- 保存/初始化系统可以实例化运行时状态

## 启动序列 (Startup Sequence)

推荐的引擎启动顺序：

1. 加载内置包。
2. 加载用户选择的外部包。
3. 按依赖图排序。
4. 注册所有模板外壳。
5. 解析所有引用。
6. 运行兼容性规范化。
7. 拒绝或禁用无效包。
8. 将就绪注册表交给游戏引擎的其余部分。

当玩家或工具同时选择多个包时，引擎应公开一个批量加载入口点，该入口点：

1. 接受选择的包列表
2. 过滤掉禁用的包
3. 拒绝重复的活跃 `modName`
4. 计算依赖安全顺序
5. 发出最终加载队列以供执行

## 错误级别 (Error Levels)

推荐的严重级别：

- `warning`（警告）
  加载器通过兼容性规则恢复了问题。

- `error`（错误）
  数据包无效，但其他包可能继续加载。

- `fatal`（致命）
  基础运行时图已损坏，游戏不应启动。

## 最低运行时组件实现 (Minimum Runtime Components To Implement)

下一次运行时实现应添加：

- `DatapackLoader`
- `DatapackRegistry`
- `TemplateResolver`
- `DatapackCompatibilityLayer`
- `DatapackDiagnostics`

这些可以包装现有的 `Datapack` 和 `TemplateArchive`，而非替换它们。