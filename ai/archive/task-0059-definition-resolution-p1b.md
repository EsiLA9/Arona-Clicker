# Task-0059：Definition Resolution P1B 引用策略与诊断

状态：closing

**状态**：🟢 已实施并验证（2026-09-14）  
**日期**：2026-09-14  
**前置**：[[adr-0011-definition-resolution-withdrawal]]、[[task-0058-definition-resolution-p1a]]  
**关联任务**：[[task-0057-single-mod-editor-workbench]]

## 一、任务定位

本 Task 将 ADR-0011 的 P1B 独立记录为施工任务，目标是为已经完成的 P1A 纯来源解析模型补充：

~~~text
Definition Resolution
        ↓
reference policy
        ↓
DefinitionDiagnostics
        ↓
DefinitionChange consumption tests
~~~

本 Task 不是对 Task-0058 的扩写。Task-0058 已完成 P1A；本 Task 只负责引用调用策略、诊断信息和状态迁移消费口径。

## 二、必须继承的 P1A / ADR-0011 约束

- DefinitionKey 只描述 table + id 逻辑身份；
- 来源信息由 DefinitionSourceRef、DefinitionRef 和 DefinitionRecord 表达；
- resolved / suspended / missing 是解析结果，不写入引用对象；
- suspend 不删除任何 source record；
- resume 只能移除当前 EditingWorkspace / DraftLayer 自己拥有的 Tombstone；
- missing → suspended 不是合法的 Resolver 结果；
- DefinitionDelta 只表达内容事实，不直接枚举 Runtime 子系统；
- 本 Task 不连接 Runtime，不修改 Registry，不进入 PackManager，不改变正式 Datapack 格式。

## 三、Draft 方案

### 3.1 引用策略

引用策略绑定到具体字段或调用点，不按目标 Def 类型统一推断：

~~~ts
type ReferencePolicy = 'symbolic' | 'optional' | 'required';
~~~

本 Task 采用统一入口和两个语义包装器：

~~~ts
resolveRequired(ref)
resolveOptional(ref)
resolve(ref, policy)
~~~

实际实现为 resolveDefinitionReference(layers, reference, policy)，并提供 resolveRequired()、resolveOptional() 包装器。symbolic 返回 status: not-applicable，不读取来源层；TagPath、owner、state key 等 symbolic identity 继续由各自系统解释。

策略语义：

- symbolic：由对应系统执行自身的匹配规则；
- optional：缺失或 suspended 时允许降级，但必须留下 warning；
- required：解析失败必须产生 error 级诊断；当前阶段再决定 reject candidate、disable parent feature 或 fail closed，不能静默当作正常成功。

### 3.2 DefinitionDiagnostics

已采用以下最小结构：

~~~ts
interface DefinitionDiagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  source: DefinitionKey;
  reference?: DefinitionKey;
  path?: string;
  resolutionStatus?: 'suspended' | 'missing';
  policy?: ReferencePolicy;
  message: string;
}
~~~

PackValidation 继续负责包配置、启用集和加载计划；DefinitionDiagnostics 负责解析后 Def 图中的缺失、悬置、父节点不可达和残留状态，两者不合并为万能 Validator。

父节点不可达、Tombstone 结构问题和状态残留诊断属于后续解析图 / Runtime 任务，本 Task 不伪造其运行时上下文。

本 Task 已实施的引用诊断码：

~~~text
DEF_REF_SUSPENDED
DEF_REF_MISSING_OPTIONAL
DEF_REF_MISSING_REQUIRED
~~~

### 3.3 DefinitionChange 消费

P1B 保留 P1A 的状态迁移结构：

~~~ts
interface DefinitionChange {
  key: DefinitionKey;
  before: DefinitionResolutionStatus;
  after: DefinitionResolutionStatus;
}
~~~

P1B 的纯模型实现只验证诊断层能识别并消费这些迁移，不实现 RuntimeInvalidationPlanner。已覆盖：

- resolved → suspended：产生撤回相关诊断，并向内容层投影为 removed；
- suspended → resolved：清除对应悬置诊断，并向内容层投影为 added；
- missing → resolved：产生 added；
- resolved → missing：产生 removed；
- resolved(A) → resolved(B)：产生 changed，不伪造 suspended。

## 四、建议实施范围

### P1B-A：引用 Resolver（已实施）

- 为 Definition 引用提供 required / optional 的纯解析入口；
- 明确 suspended 与 missing 的诊断分流；
- 覆盖 optional 降级和 required error；
- 不强制改造全部 Schema metadata。

### P1B-B：诊断与迁移（已实施）

- 建立 DefinitionDiagnostic 类型和最小诊断码；
- 将 resolutionStatus 与 policy 写入诊断；
- 覆盖 DefinitionChange 的迁移消费；
- 保证缺失、悬置、父节点不可达不会混为同一错误。

## 五、验收结果

- [x] Task-0059 已收束为 Accepted / 已实施；
- [x] required / optional 的处理不静默成功；
- [x] symbolic identity 不被错误送入 Definition Repository；
- [x] DefinitionDiagnostic 能指出 source、reference、path、status 和 policy；
- [x] resolved → suspended 与 suspended → resolved 诊断可逆；
- [x] missing → suspended 无合法测试样例；
- [x] P1B 不 import Runtime；
- [x] P1B 不修改 Registry；
- [x] 三个 Definition 相关测试文件共 18 项通过；
- [x] npx tsc --noEmit 通过；
- [x] npm run check:architecture 通过；
- [x] npm test 通过：151 个测试文件、1423 个测试。

## 六、明确不在本 Task 内

- RuntimeInvalidationPlanner 和 RuntimeRebuildCoordinator；
- Registry 增量卸载或热更新；
- PlayerState 的 Retain / Detach / Purge 实际执行；
- Tombstone 正式导出；
- PackManager / StoredPack 持久化；
- 完整 EditingWorkspace、全表 Editor UI；
- 存档迁移或旧结构兼容。

## 七、已完成的实现裁定

本 Task 已完成以下三个实现选择：

1. 采用统一 resolveDefinitionReference(layers, reference, policy)，并保留 resolveRequired / resolveOptional 包装器；
2. DefinitionDiagnostic.source 表示包含该引用的 Definition，reference 表示被解析的目标；
3. 本阶段提供无状态的 collectDefinitionDiagnostics 纯函数，不引入持久化聚合器。

父节点不可达、状态残留、RuntimeInvalidationPlanner、Export、PackManager 或完整 Editor 范围仍需另建后续文档。

## 相关文档

- [[adr-0011-definition-resolution-withdrawal]]
- [[task-0058-definition-resolution-p1a]]
- [[task-0057-single-mod-editor-workbench]]
- [[def-resolution-withdrawal-sol-review]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
