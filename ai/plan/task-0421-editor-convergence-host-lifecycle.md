# Task：Editor Workbench Convergence：公共宿主、生命周期与局部刷新

状态：进行中

## 目标与验收

- 目标：在 Task 0420 的唯一 projection 上收回公共绑定、命令分发、实例开关/激活/显式定位和区域刷新，不再允许 Story/World Controller 各自装配完整 Workbench。
- 完成条件：公共命令按 Workbench / Explorer Provider / Active Instance Provider / Selection 作用域分发；Provider 绑定只在行为契约改变时释放重绑；激活失败时 Manager active ID、业务内容和宿主保持可用；刷新只更新受影响栏位且保留 Story 输入/锚点/滚动以及 World 摘要行为。
- 边界：复用 BrowseInstanceManager、WorkspaceRouter、WorkspaceColumns、UIUpdate 和当前门禁；不新建第二 Router、事件总线或渲染器。Classic 旧浏览策略作为明确 mode 策略保留；兼容 route 仅作为入口/镜像。

## 当前依据与改动方案

- 当前依据：`StoryEditorController.bindWorkspace()` 与 `UIController.bindEditorWorkbench()` 都处理实例、Explorer、布局等公共事件；左栏在 render、`setActiveEditorExplorer()` 有多种 Story bind path。`restoreBrowseInstance()` 会同步来源、更新临时 reveal/焦点并提交 Manager active ID；`openBrowseTarget()`/`navigateToTarget()`/`requestBrowseDirectoryReveal()` 交叠处理打开、恢复、定位。`StoryEditorController.refresh()` 重建 Story frame；`UIController.refreshColumnInstances()` 可因 Story 活动而改刷整套 Workbench；World 实体切换局部写摘要但可能漏实例条。`WorkspaceColumns.adopt()/mount()/update()` 依 node、bindingKey、definitionId 判定重绑。
- 具体调整：公共 Host 唯一装配框架命令与 Explorer Provider 通用绑定；每个 Explorer 一个专属 bind 入口，含其业务目录动作；当前实例命令触发时动态解析活动 Provider。定义并实际消费带 `providerKey/resourceKey` 的 `EditorResourceRef` 与 `EditorResourceOpenRequest`，origin 区分 Explorer placement、instance link、external、development；领域 Provider 从 request 解析 Story/Entry 或 World ref，不由左栏 type 猜目标。区分 `activateBrowseInstance`、`openResource`、`locateResource`；Explorer 打开保留实际 placement，不附加自动定位；普通激活不写 Explorer 状态；显式 locate 才切 Explorer/临时显露/展开/滚动/焦点。Provider 准备及恢复走 Manager 提交前路径；失败补偿业务副作用但不撤销成功持久化保存。基于现有更新机制表达 refresh scope，由组合器选局部 frame/column patch；保留 Story keyed DOM patch、浮层/输入/滚动行为及 World 摘要刷新。外部 Editor Route 独立于内部活动 provider，实例切换不退出 editor/theme session。
- 衔接与验证：更新 UIController、Story/World Provider 与 DEV/外部路由调用方；Workbench owns 公共入口。扩展 WorkspaceColumns/UI 测试，验证行为身份变化重绑、仅数据更新不重绑、unbind cleanup、事件单次分发、失败不留孤儿/错内容；刷新验证真实 Story/World DOM、标签、Explorer 保留和输入焦点。运行相关 UI suites、typecheck、architecture/docs/diff。

## 工作项

- [ ] 将公共命令与 Explorer Provider bind 收束到 Host/projection，移除 Story 公共命令重复分支。
- [ ] 将栏位 key 与行为 binding identity 分开，证明释放/重绑正确且普通数据更新不重绑。
- [ ] 收敛 activate/open/locate 意图和提交前恢复门禁；保留 Explorer 状态并覆盖失败路径。
- [ ] 将 refresh scope 接入同一 projection 更新入口，移除 Story refresh 覆盖其他 Explorer 和 World 标签漏刷。
- [ ] 收敛内外 Route 职责、保留 Classic 策略，加入生命周期/刷新范围回归。

## 当前进展

- 已完成：前序 Roadmap 已建立公共 BrowseInstanceManager、Explorer service、WorkspaceColumns；实际接线范围以 0419–0420 实施源码为准。
- 已完成：0420 的 `EditorExplorerProjection.bindColumn` 已由公共 projection 用于左栏装配；Story keyed patch 与 `UIUpdateDispatcher`/`WorkspaceColumns` 仍是实际刷新入口。
- 正在进行：复核当前 `UIController.bindEditorWorkbench()`、`StoryEditorController.bindWorkspace()/configureFrame()`、`WorkspaceColumns` 与 Manager 激活事务，移除重复公共命令并统一 resource-open request。
- 下一步：明确栏位身份与 behavior binding identity 的刷新语义；接入失败安全的激活/导航和局部刷新回归。

## 结果与问题

- 验证结果：待执行。
