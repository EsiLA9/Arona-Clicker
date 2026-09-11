# ADR-0009：Init 生命周期边界与运行时重建

状态：🟢 已裁定并完成 P0/P1；P2 延期

日期：2026-09-11

## 背景

当前 Runtime 使用一个可替换的 `PlayerState`，但 `SessionService`、`EventBus`、`EffectEngine`、`AffectorEngine`、`TriggerSystem` 与 `StoryService` 都是长寿命对象。`InitSnapshot` 只通过 `PER_INIT_FIELD_SPECS` 保存可序列化的 per-Init 字段，不能自动带走这些服务的运行时索引、监听器、闭包和剧情游标。

因此，Init 切换必须被视为一次运行时生命周期转换，而不是简单替换几个状态字段。

## 决策

### 1. Init 转换由 InitService 统一编排

- `resumeInit(initId)` 保留现有公开签名；若当前仍在 Init 中，内部先完成保存式退出，再恢复目标 Init。
- 保存式切换顺序固定为：

  `stop session → 保存当前快照 → 清空 Init-local 状态 → 清理运行时索引/队列 → 恢复或播种目标快照 → 重建运行时 → activate target`。

- `restartInit` 表示保存当前快照并回到 Lobby。
- `hardRestartInit` 表示删除当前 Init 快照并以定义重新播种，Global 状态保留。
- 运行时服务对象本身不进入快照；恢复时必须从当前 Definition 与快照重新建立。

### 2. 不活跃 Init 冻结

切出 Init 后，该 Init 不继续获得 Tick 或离线收益；离线补算只属于当前被恢复的活动 Runtime。Init 切换会刷新活动会话的时间基准，读档仍使用存档时间戳作为活动 Runtime 的补算基准。

### 3. Init-local 运行时必须可清理、可重建

切换边界至少清理：

- EventBus 待处理事件；
- Init 专属 Trigger 分组；
- Affector 实例、活跃索引、条件依赖和轮询登记；
- Story global/chat cursor 的当前执行上下文；
- 其他后续登记的 Init-local runtime cache。

每次 restart 或 switch 都递增内部 `runtimeGeneration`。未来所有异步 callback、延迟 Effect 或外部请求必须携带创建时 generation，过期任务不得写入新 Runtime。

### 4. 目标实体默认只能写当前 Init

本 ADR 不引入 foreign-Init mutation 语法。现有写入口必须拒绝把非 global Spot/Area 等实体写入非当前 Init；跨 Init 操作只保留已有的显式世界线解锁等业务入口。通用 Effect capability 与 typed runtime ref 另立后续 ADR。

### 5. Story cursor 纳入 Init 恢复边界

当前全局剧情游标与聊天沙盒游标都属于活动 Story execution context。保存式切换时保存可序列化游标，恢复目标 Init 时恢复对应游标；清理时只销毁运行时对象，不恢复旧 JS 对象图。不可序列化的瞬态字段仍由 `StoryCursorState.restore()` 重新初始化。

Story 完成奖励的原子提交不在本 ADR 中重新设计，沿用现有 Shop transaction 的思想，另作为 task-0046 的后续切片验证。

### 6. 不做存档迁移

本项目继续遵守架构纪律：不为 Datapack/PlayerState 变化编写迁移层。数据包身份指纹、兼容性拒绝和清档提示属于 Datapack 管理后续任务；本任务不得通过 alias 或旧字段兼容扩大范围。

## 取舍

- 选择在核心 `InitService` 内收口，而不是要求 UI 调用方正确排列多个方法。
- 选择重建运行时索引，而不是尝试序列化 Affector、Trigger listener 或闭包。
- 选择先固定“非活动 Init 冻结”，避免在没有 per-Init 时钟模型前隐含产生收益。
- 延迟 Effect、通用 capability、typed EntityRef 和 datapack fingerprint 暂不伪装成已经存在的能力。

## 影响

- `resumeInit` 的直接调用会变得安全；现有 UI 的 `restartInit → resumeInit` 路径保持兼容。
- `InitSnapshot` 将增加 Story cursor 的可序列化字段，必须同步 `PER_INIT_FIELD_SPECS`、保存/恢复测试和相关文档。
- 新增事件或字段时继续遵守 `EVENT_CATALOG`、Schema 同步和测试先行规则。

## 相关文档

- [[docs/0x-plan&work/active/task-0046-init-lifecycle-boundaries]]
- [[docs/0x-plan&work/active/task-0032-passive-story-scheduling]]
- [[docs/0x-plan&work/active/adr-0007-shop-transaction-boundaries]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/01-architecture/run-logic]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
