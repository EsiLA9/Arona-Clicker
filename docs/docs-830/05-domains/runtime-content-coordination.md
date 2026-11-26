# docs-830/05-domains/runtime-content-coordination — Runtime 内容协调

本文回答：游戏运行期间的内容编辑如何校验、提交并同步到 Registry。

## 两类草稿

`RuntimeContentCoordinator` 管理短生命周期的 Spot 编辑会话；`RuntimeWorldContentCoordinator` 管理 Init、Area 及拓扑连接草稿。两者按创建时指定的 Mod 和 `ContentAuthoringPolicy` 验证输入，统一生成稳定 ID、诊断信息和定义变更，不直接把 UI 表单对象当成 Registry 定义。

```text
编辑器输入 → Policy 解析与校验 → Mutation / World Draft
  → Registry 分阶段应用 → 提交回调 → revision 前进
                         └失败→ 回滚 Registry 与协调器快照
```

协调器提交时记录 Registry 中被替换/移除的原始定义，按计划应用变更并调用提交观察者。提交回调失败会按 receipt 回滚已应用的变更，并恢复协调器自己的草稿快照。成功提交会推进 revision，供 UI 判断草稿是否基于最新内容。

这类变更属于 Runtime 内容编辑生命周期；它和重新应用整组 Datapack 不同，也不等同于修改玩家存档。Datapack 包的读写与 Registry 装载见 [[datapack-and-registry]]。

### StoryDef 的运行内容保存

`GameCommands.saveStoryDefinition()` 经 GameInstance 调用 `Registry.saveStoryDefinition()`，不借用 Spot/World 协调器。基础 GameInstance 提供直接 Registry 保存能力：单份 Story 经深拷贝与基础载荷／阶段／引用检查后一次替换或新增，校验失败保留旧定义，不执行节点或更新玩家状态。基础能力本身不要求编辑态 Mod，也不提交包内容。

产品 `AronaClickerRuntime` 覆写保存／还原入口，通过 `requireRunningStoryPack()` 要求目标包为当前运行的编辑态包，并检查 Mod 及内容归属。UI 按来源选择目标包，不能用基础 GameInstance 的能力推断产品可绕过这些限制。保存到包库由独立的 `saveStoryAuthoringToPack()` 入口处理。

当前播放会话持有独立文档副本，新内容从下一次 Story 启动起读取。运行内容保存只覆盖当前 Registry，包重载会恢复包内定义。来源与本地草稿的关联、部分保存失败提示见 [[runtime-editor-and-project-checks]]。实现入口为 `src/data-services/registry/registry-story-mutation.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`runtime.ts`，基础保存回归见 `tests/engine/story/story-definition-save.test.ts`，产品来源门控见 `tests/ui/story/story-editor-pack-source.test.ts`。

## Runtime Effects 的事件桥接

效果系统不会直接依赖全部产品表现服务。`runtime-wiring.ts` 将主题、实体表现、剧情启动和聊天演出等领域效果转为 Runtime 事件；`RuntimeEffectReactor` 根据事件调用对应服务。Story、区域或 Init 生命周期事件也会清理带生命周期的实体表现覆盖。

这条桥接把通用 Engine 中可解析的 Effect 与产品层的主题、剧情和演出服务连接起来；写状态的效果仍走状态写入接口。

源码入口：`src/arona-clicker/services/runtime/runtime-content-coordinator.ts`、`services/world/runtime-world-content-coordinator.ts`、`services/runtime/runtime-effect-reactor.ts`、`src/data-services/authoring/content-policy.ts`。相关测试见 `tests/engine/runtime-content/runtime-content-coordinator.test.ts`、`tests/engine/runtime-content/runtime-world-hot-crud.test.ts`、`tests/engine/runtime-content/runtime-spot-field-authoring.test.ts`。

## 编辑草稿到生效的边界

| 阶段 | 做什么 | 失败时观察什么 |
| --- | --- | --- |
| 编辑输入 | 表单生成 Spot 或世界内容草稿 | 输入仍是草稿，不自动改变 Registry。 |
| 准入 | 检查 Mod、内容策略、字段和 expected revision | 过期版本或非法输入返回诊断，提交前不触及 Registry。 |
| 应用与通知 | 分阶段修改定义，通知提交观察者 | 回调失败时按 receipt 撤销已应用定义，并恢复协调器快照。 |
| 成功收尾 | 确认新定义并推进 revision | 后续编辑应以新的 revision 为基准。 |

协调器管理的是运行时内容定义；删除或替换定义的计划、与玩家状态如何处置是不同问题。Spot 删除可携带 retain / purge 信号；不能仅凭“定义删除”推断玩家进度已被清理。

### 示例：过期草稿与回调失败

`tests/engine/runtime-content/runtime-content-coordinator.test.ts` 先以 revision 0 创建 Spot，成功后 revision 为 1；之后使用旧 revision 0 提交替换时得到 `stale-revision`，已有定义和 revision 不变。另一测试让提交回调抛错，得到 `commit-failed`，新 Spot 不留在 Registry，revision 回到 0，并调用回滚观察者。

世界内容也有相应约束：`tests/engine/runtime-content/runtime-world-hot-crud.test.ts` 覆盖仍被 Spot 引用的 Area 删除被拒绝且不留下半提交。具体引用检查和回滚范围由各协调器执行，不能仅靠 UI 禁用按钮保证安全。

## 与编辑器及包应用的分工

游戏内编辑器组织输入并显示诊断；协调器处理内容转换、版本和提交；Registry 持有当前运行时定义。重新应用 Datapack 是另一条装载路径，见 [[package-io-and-source-layers]]；游戏内编辑界面入口见 [[runtime-editor-and-project-checks]]。Runtime Effect 的事件桥则负责响应产品效果，与内容草稿本身的提交不是同一条链路。
