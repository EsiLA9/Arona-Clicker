# Task：启用编辑态数据包与同名顺序交换

状态：done — 编辑态启用与同名顺序交换完成（2026-10-02）

## 目标

允许编辑态数据包像普通数据包一样进入持久化的 Runtime 启用序列，并继续由 RuntimeEditor 编辑。包库中将一条未启用记录拖入启用列表、遇到同 ModName 的启用记录时，先高亮冲突项，再由模态框询问是否交换；确认后新记录占用原启用项的序列位置，原记录回到未启用列表。

## 设计边界

- 本 Task 包含：编辑态加入启用草案、校验与启动加载；编辑态仍可打开 RuntimeEditor 并保存；拖放同名冲突提示、取消与顺序保持的交换行为。
- 唯一启用约束仍为 ModName；未启用记录身份不受限制。
- 第一次发现的开发目录 `editing` 来源继续默认不启用；用户可从经典包库显式启用。普通态 `finished` 来源沿用 Task 0173 的首次发现规则。
- 同名拖放交换必须保留两条记录：新记录替换被冲突记录在启用顺序中的位置，被替换记录进入未启用列表，并占用被拖动记录原先的未启用位置。取消时不变更启用草案或顺序。
- 始终启用且不可排序的核心包不可交换；遇到这类同名冲突时说明保护原因并保持草案不变。
- 不涉及独立 `tools/datapack-editor/`、窄屏适配或数据 Schema 变更。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| PackManager 的配置校验、setEnabled 和启动序列校验都拒绝编辑态。 | `src/data-services/datapack/pack-manager.ts` 的 `validateConfiguration`、`setEnabled`、`validateEnabledSet` | 必须统一放开状态限制，同时保留 ModName 唯一性、依赖与核心包校验。 |
| 包目录 UI 将编辑态记录的 `enableable` 设为 false，拖放状态函数也会拒绝进入启用列。 | `src/arona-clicker/runtime.ts`、`src/ui/workspace/datapack-workspace-state.ts`、`src/ui/components/service-workspace.ts` | 启用态能力、详情提示与空态/冲突文案需要与新规则一致。 |
| `openEditingPack()` 与 RuntimeEditor 保存路径会从活动序列移除同 ModName 后追加编辑包。 | `src/arona-clicker/runtime.ts` | 启用编辑态包后打开或保存内容不能改变该 ModName 已占用的序列位置。 |
| 拖放当前只在目标列标记 drop-target；冲突时直接阻止，没有确认或交换。 | `src/ui/controller-actions-topbar.ts` | 用现有卡片节点标识同名冲突，在 drop 后弹出确认并按原序列槽位交换。 |

## UI 设计说明

```text
DOM budget:
- 新增 wrapper / 节点数量：0；复用启用列表的卡片节点与既有 modal host。
- 可复用的稳定节点：`[data-pack-dragger]`、两个 `[data-pack-dropzone]`、`[data-pack-id]` 卡片。
- behavior patch：拖动期间只切换匹配同名卡片的冲突高亮 class。
- region 替换：确认交换后只刷新承载模式导航与双列表的左宿主，以及显示记录详情的右宿主。
- 允许 full render 的唯一条件：路由、workspace owner 或主题结构变化；拖动和取消不得 full render。

Interaction preservation:
- scroll 位置：dragover 和 drop 询问前不替换任何列表节点；交换后沿用 workspace 的列表滚动宿主。
- focus：确认/取消关闭后把 focus 返回拖动来源记录（若该节点仍在），否则落到启用列表首条记录。
- hover / popover：dragend / drop 清除高亮；模态框打开前不重建列表，不遗留悬浮提示锚点。
- click 后节点 identity：同名目标高亮期间所有卡片保持原节点；确认后只刷新数据包列表与校验区域。
```

交互使用已有 ACProgram 蓝灰面板、紧凑蓝色状态强调和圆角卡片风格；新增签名只用于将“即将替换的启用记录”标成冲突焦点，不新增装饰性结构或动效。

## 施工切片

### P1：编辑态进入持久化启用序列

- [x] PackManager 允许编辑态参加启用配置和启动序列，同时保留 ModName 唯一、依赖、核心包与 Apply 回滚校验。
- [x] Runtime 启动恢复后可应用已启用编辑态；RuntimeEditor 打开与保存该记录时保持序列顺序和同名记录身份。
- [x] 经典包库允许编辑态拖入启用中，详情、校验和提示不再称编辑态不可直接运行。
- [x] 保持新发现的 editing 来源默认未启用，已保存的显式启用选择在重启后继续生效。

### P2：同 ModName 冲突拖放交换

- [x] 拖动记录时，启用列内同 ModName 活跃项出现明显冲突高亮；离开拖动后清除。
- [x] 未启用记录拖入启用列且存在可交换的同名项时，显示交换确认模态框；取消不改启用态和顺序。
- [x] 确认后拖动记录替换同名启用项的原顺序槽位；被替换记录进入未启用列表并占用拖动记录原未启用位置。
- [x] 无同名冲突时沿用指针落点顺序；核心包冲突说明无法交换，草案保持不变。

## 测试与验收

- [x] 编辑态启用配置校验、Apply、快照恢复、RuntimeEditor 打开与保存均可通过；同 ModName 冲突仍拒绝。
- [x] RuntimeEditor 打开和保存已启用编辑态包后，包记录身份与启用序列位置不变。
- [x] 冲突拖放：高亮目标、取消无变更、确认交换两个启用状态并保留原启用槽位及源记录位置；无冲突拖放保持原排序语义。
- [x] UI 刷新等级与交互连续性符合本 Task 的 DOM budget；相关定向测试、类型检查、架构检查通过。
- [x] 桌面浏览器验收同名冲突提示与核心包保护提示；交换确认/取消与确认交换由 UI 定向测试覆盖。不做窄屏验收。

## 当前核验（2026-10-02）

- `pack-loading.md`、UI 模块卡、架构约定、UI 上下文包和项目 frontend-design 覆盖协议已读取。
- 编辑态进入启用序列、RuntimeEditor 打开/保存保持顺序、同名冲突取消/确认及核心包保护已由定向测试覆盖。
- 定向 Vitest、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check` 均通过。
- 本地桌面浏览器确认同名拖放弹出交换确认、取消后列表不变；与核心包冲突时展示不可交换提示。

## 剩余工作

- 本 Task 无剩余工作。Task 0173 已完成的固定目录、来源对账和 Workspace 结构不在本 Task 重做；窄屏适配不在范围内。

## 相关路由

- [[pack-loading]]
- [[docs/docs-829/02-modules/ui]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/ai/context-packs/ui-presentation]]
- [[docs/ai/frontend-design-project-overlay]]
- [[task-0173-development-datapack-source-loading-and-management]]
