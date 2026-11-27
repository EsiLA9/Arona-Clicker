# Task：Editor Workbench Convergence：搜索定位与连续集成收敛

状态：待处理

## 目标与验收

- 目标：让 Story/Entry 与 World 实际消费公共 Explorer 搜索/定位/宿主能力，补齐 World 搜索，按连续操作验收结构收敛，并更新现行机制和接入文档。
- 完成条件：Story/World Explorer query、普通/搜索展开、placement 选择、滚动、焦点和临时 reveal 由公共 Explorer service 管理；World 无活动实例时仍能搜索/打开，结果保留祖先路径且清除时恢复普通展开；8 类连续场景覆盖业务刷新、跨来源/Provider、激活、定位和失败。新 Provider 接入说明基于真实入口可执行。
- 边界：扩展现有 UI/DEV Navigation/WorkspaceColumns 测试，不建平行测试平台；不复测未受影响的旧浏览器用例。真实浏览器行为遵从用户授权留给用户，报告中不得声称通过。

## 当前依据与改动方案

- 当前依据：`EditorExplorerService` 已持有按 Explorer 类型隔离的 queries、普通/搜索展开、selected placement、scroll、focus 和 reveal；Story 有查询输入/过滤及 source/Init 语义，World Provider 目前无真实搜索输入与过滤投影。已有 Story/World identities、`editor-directory.ts`、`editor-directory-scroll.ts`、CSS 和 UI/DEV Navigation 测试可复用。
- 具体调整：为 Story/World 接入公共 query 绑定与名称/ID过滤，World 按匹配节点保留祖先，只暂时展开搜索路径；清空/来源树更新时恢复普通展开。定义并消费公共资源/placement identity 与 Provider `resolveLocation()` 结果，跨来源 Story 显式 locate 保留 query/filter 并用临时 reveal 选定正确 placement；World reveal 沿领域父链返回 placement path。清除定位和搜索/来源改变时终止临时 reveal。单次切换遵循 Task0421 的 typed open request，不建立第三套身份或第二份完整目录状态。补充连续序列：Story refresh 不覆盖 World Explorer；Story 搜索跨 Story/Entry 激活保留；World 活动 Story Explorer 生效；反复切换单次响应且滚动各自恢复；World 搜索/单实例复用；Entry 多 Placement/显式 reveal；空 Workbench 开资源；门禁/来源/准备/定位失败恢复。
- 文档衔接：更新 `docs/docs-830/04-presentation/workspace-columns-and-layout.md` 及现有 Workbench/Explorer authoring pattern；说明 Explorer Provider 如何提供目录与交互、Browse Instance Provider 如何提供内容、如何接 Workbench projection/发局部刷新、open/activate/locate 区分及已退出旧 full-frame/controller 入口。按知识保全规则局部修正，不重摘要整个视觉知识库。
- 衔接与验证：扩展现有 `tests/ui/workspace`、`tests/ui/story`、`tests/ui/runtime-editor`，必须断言实际 DOM 与后续刷新结果而不只断言服务状态；相关 UI suites、TypeScript、architecture、docs、diff 按影响选择。手动验收清单记录未观察的滚动、hover、输入焦点、浮层锚点和视觉表现。

## 工作项

- [ ] 接线 World 搜索及祖先/临时展开投影，验证无 World instance 仍可搜索和开资源。
- [ ] 收敛 Story/World query/reveal 来源作用域和多 Placement 交互，避免实例激活替换真实 Explorer selection。
- [ ] 建立并通过 8 条连续集成序列，检查 DOM、监听释放、列表/标签/内容和失败后的可操作性。
- [ ] 更新 Provider/Workbench/Explorer 文档及手动验收清单；审计唯一权威并删除无消费者旧入口。
- [ ] 归档本 Task 并报告自动检查与浏览器手动验收边界；Stage H 完成后停止。

## 当前进展

- 已完成：Prompt 的 A–H 目标已组织为四个连续验收节点；实际以 0419–0421 新源码和测试为准。
- 正在进行：待前序 Task 完成。
- 下一步：复核当前 Explorer service/World tree 与最终 projection 接口，再实施搜索、临时显露和连续回归。

## 结果与问题

- 验证结果：待执行。
