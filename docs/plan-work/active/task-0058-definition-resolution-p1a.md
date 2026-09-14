# Task-0058：Definition Resolution P1A 纯模型

**状态**：🟢 已实施并验证（2026-09-14）  
**前置**：[[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]、[[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]  
**关联任务**：[[docs/plan-work/active/task-0057-single-mod-editor-workbench]]

## 一、目标

实现 ADR-0011 P1A 的纯 Definition Layer 基础模型：

~~~text
source records + Draft-only Tombstones
        ↓
Definition Resolution
        ↓
resolved / suspended / missing
        ↓
Definition Delta
~~~

本任务不接入 Runtime，不修改 Registry，不进入 PackManager，不改变正式 Datapack 导出格式。

## 二、已实施范围

实现位置：

- src/data-services/definition/definition-types.ts
- src/data-services/definition/definition-resolution.ts
- src/data-services/index.ts
- tests/data/definition-resolution.test.ts

已提供：

- DefinitionKey：只描述 table + id 逻辑身份；
- DefinitionSourceRef：描述 base / pack / draft + sourceId；
- DefinitionRecord 与 DefinitionSourceLayer；
- DefinitionResolution<T> 的 resolved / suspended / missing 三态；
- Draft-only Tombstone 的创建、挂靠和生命周期操作；
- create / replace 对应的 source record 写入；
- delete-local 与 remove-override 的分离操作；
- suspend 不删除 source record；
- resume 只移除当前 DraftLayer 自己拥有的 Tombstone；
- DefinitionDelta 的 added / changed / removed / transitions。

## 三、已固定的测试语义

### 3.1 来源解析

- 来源层按传入顺序从高优先级向低优先级解析；
- 高层 source record 覆盖低层 record；
- 高层 Tombstone 阻断下层候选；
- 高层已有 record 时，低层 Tombstone 不影响高层 resolved 结果；
- Tombstone 没有任何 shadowed candidate 时，结果为 missing，不会产生合法的 suspended。

### 3.2 操作语义

- suspend 只新增 blocking record，不删除任何 source record；
- resume 按稳定的 Draft sourceId 匹配 owner；
- 不同 EditingWorkspace / DraftLayer 不能互相 resume；
- delete-local 只删除当前层 owned record；
- remove-override 只删除当前层 override record；
- 删除当前层记录后继续按来源链解析。

Draft owner 必须使用稳定逻辑 ID，例如 workspace-1，不能使用 UI 实例地址或临时对象身份。

### 3.3 Delta 投影

已固定以下投影：

| Resolution transition | Delta |
| --- | --- |
| missing → resolved | added |
| resolved → missing | removed |
| resolved → suspended | removed |
| suspended → resolved | added |
| resolved(A) → resolved(B) | changed |

状态变化同时保留在 DefinitionChange 中。missing → suspended 不能由合法 Resolver 结果产生。

## 四、验收结果

- [x] DefinitionKey 与 source identity 分离；
- [x] Draft owner 使用稳定 sourceId；
- [x] resolved / suspended / missing 严格区分；
- [x] suspend 保留 source record；
- [x] resume 不能删除其他 owner 的 Tombstone；
- [x] delete-local / remove-override 继续向下回退；
- [x] Delta transition 投影有测试；
- [x] P1A 不 import Runtime；
- [x] P1A 不修改 Registry；
- [x] npx vitest run tests/data/definition-resolution.test.ts 通过；
- [x] npx tsc --noEmit 通过；
- [x] npm run check:architecture 通过；
- [x] npm test 通过：149 个测试文件、1411 个测试。

## 五、明确不在本任务内

- P1B 的 optional / required resolver 与 DefinitionDiagnostics；
- RuntimeInvalidationPlanner；
- Registry 增量卸载或整包重载接线；
- PlayerState 的 Detach / Purge 执行；
- PackManager / StoredPack 持久化；
- Tombstone 正式导出；
- Editor UI 与完整 DraftWorkspace；
- 存档迁移或旧结构兼容。

## 六、后续入口

ADR-0011 P1B 已由 [[docs/plan-work/active/task-0059-definition-resolution-p1b]] 实施；下一步进入 Task-0057 的 DraftLayer 与编辑工作区施工。

## 相关文档

- [[docs/plan-work/active/adr-0011-definition-resolution-withdrawal]]
- [[docs/plan-work/active/task-0057-single-mod-editor-workbench]]
- [[docs/plan-work/active/adr-0010-definition-repository-editor-resolution]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]
