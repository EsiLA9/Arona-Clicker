# 多数据包关系 (Multi-Datapack Relations)

## Why This Matters

辑器已经支持加载外部引用包，并将导航器目标存储为 `mod:type:id`。

这意味着运行时应该将跨数据包链接视为一等特性，而非后续的补丁。

## 规范引用格式

规范的模板ID和引用格式应为：

```text
modId:type:id
```

Examples:

- `base:Init:main`
- `quest_pack:Story:story_001`
- `ui_pack:Tag:currency`

这应该是存储在最终运行时注册表中的唯一格式。

## 创作形式 vs 运行时形式

所有的数据都应该存储完整的id格式: `mod:type:id`。


规范化规则：

- 加载器将每个简写展开为完整的 `mod:type:id`
- 导出的运行时数据和诊断信息始终显示完整形式

## 跨包可见性规则

数据包可以引用：

1. 自身内部的模板
2. `metadata.dependencies` 中列出的包中的模板

数据包不应引用：

1. 未加载的包
2. 已加载但未声明为依赖项的包

此规则使依赖项保持显式，并防止不相关包之间的隐藏耦合。

还有更强的所有权规则：

- 包 `modA` 只能拥有和实例化 `modA:type:id` 下的模板
- 包 `modA` 不能直接发布 `modB:*:*` 下的实例化模板内容
- 如果 `modA` 想要影响 `modB`，必须通过显式操作、补丁、标签、影响器或其他声明的跨包机制进行

这使模板所有权保持清晰，并防止一个包静默地冒充另一个包。

## 类型兼容性规则

引用解析必须验证存在性和目标类型。

例如：

- `parentInit` 只能目标 `Init`
- `targetStory` 只能目标 `Story`
- `memberTemplateList` 可以目标基于 `targetType` 的动态集合

编辑器已经通过 `fixedTypes` 和 `typeDependencies` 了解这些约束。运行时应该重用相同的概念，使创作和执行遵循相同的规则。

## 模板类型别名层

当前代码库已经显示编辑器和运行时示例之间存在一些命名漂移：

- 编辑器使用 `Area`、`Spot`、`Story`、`Tag`、`Enhancement`
- 一些运行时ID使用小写形式，如 `area`、`tag`、`vmap`
- 编辑器目前包含遗留拼写错误 `Characater`

为了在迈向引擎范围命名规则的同时保持兼容，添加类型别名表：

```ts
const TEMPLATE_TYPE_ALIASES: Record<string, string> = {
    area: 'Area',
    spot: 'Spot',
    tag: 'Tag',
    vmap: 'ValueMap',
    Characater: 'Character',
};
```

推荐策略：

- 注册表键始终使用规范类型令牌
- 别名仅在导入/加载边界接受
- 导出器应仅发出规范令牌

## 重复ID和冲突策略

两个数据包定义相同的完整ID应被视为冲突：

```text
modA:Story:intro
modA:Story:intro
```

默认行为应为：

- 拒绝后一个模板
- 记录诊断错误
- 如果可能，继续加载不相关的包

如果两个活动包条目共享相同的 `modName`，这已经是计划级冲突，应在运行时加载开始前拒绝。

不要静默覆盖外部模板。静默覆盖使加载顺序成为游戏逻辑的一部分，这变得非常难以调试。

## 扩展和补丁机制

如果我们需要一个数据包修改另一个数据包的内容，优先选择显式补丁模型而非重复ID。

推荐模式：

```ts
interface TemplatePatchRecord {
    targetId: string;             // 完整ID
    patchType: 'append' | 'merge' | 'replace-field';
    payload: Record<string, unknown>;
}
```

规则：

- 补丁只能目标自身或依赖包
- 补丁在所有模板注册后应用
- 补丁应该是确定性的并记录日志
- 补丁应该按字段/类型选择加入，而非任意对象变更

这使兼容性行为可见且可控。

## 关系解析顺序

推荐顺序：

1. 规范化ID和类型别名。
2. 注册所有模板。
3. 解析同包引用。
4. 解析依赖包引用。
5. 应用显式补丁/扩展。
6. 验证每个必需引用是否就绪。

## 运行时查询接口

注册表应支持以下查询：

- `get(fullId)`
- `getByType(type)`
- `getByPack(packId)`
- `resolveRef(id, expectedType?)`
- `listDependencies(packId)`

这些查询足以支持故事遍历、价格查找、标签扩展和内容调试。


## 编辑器兼容性桥接

编辑器端已经公开：

- 本地导航器项目
- 外部数据包导航器项目
- 导入的引用数据包
- 存储为 `mod:type:id` 的引用ID

因此运行时桥接应做两件事：

1. 按原样接受编辑器导出的引用ID
2. 规范化仍存储纯ID或旧类型令牌的遗留数据

这允许编辑器和引擎在不立即破坏旧创作内容的情况下演进。
