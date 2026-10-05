# Receipt 0236-U1-A

| 项 | 内容 |
| --- | --- |
| 状态 | U1-A 本体实现与自动验证完成；后续 U1-B 的交互实现及独立审查也已完成；当前 Task 仅待 Edge 常规 / 窄视口验收 |
| 实际修改 | `src/ui/components/workspace-frame.ts` 新增 `WorkspaceFrameSpec.overlay` 并在三栏后、frame 关闭前输出；`src/ui/components/operation-workspace.ts` 将共享牌层、关系 SVG 与拖动状态节点作为 frame overlay，移除 frame 外 wrapper，并显示学生 HP / maxHP / HP 条及全部 actor-local resources；`src/ui/css/operation-workspace.css` 使用 fixed overlay 与层级规则；`tests/ui/operation-workspace-view.test.ts` 覆盖直接父子结构、HP 和个人 / Team 资源来源；本 Receipt。 |
| 未完成内容 | 仅 Task 级 Edge 常规 / 窄视口验收未完成，需实测 fixed overlay 的 stacking、滚动与 clipping；U1-A 本体及 U1-B 的 owner/layer 定位、滚动/缩放重算、替代牌开合、拖放和键盘交互均已实现，U1-B 已独立审查。 |
| 范围外变更 | U1-A 本轮未修改白名单外代码。曾在共享工作树中形成的 `src/ui/controller-actions-operation.ts` 与 `tests/ui/gameplay-b-operation-controller.test.ts` 后续归入 U1-B，并已由 U1-B 完成实现、测试与独立审查；当前不再作为临时试作或待审工作。 |
| GALHCG 影响闭环 | 本子 Unit 施工回合未单独运行 GALHCG；Task-0236 收口已沿用 `concept:ui-workspace-renderer` 并刷新本 Receipt 的既有 documentation `maps_to` Evidence（edge ID `bb45a2e6e21a44509f4adbcb56f5f247`），写后 freshness 为 1/1 fresh；未新增 Concept。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/operation-workspace-view.test.ts --silent` | 通过 | 1 个测试文件，6/6 tests 通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无类型错误。 |
| 补充检查 | `git --no-pager diff --check` | 通过 | 无 whitespace 错误；Git 提示既有 CRLF 文件的换行规范提醒。 |
| 人工验收 | Edge 常规 / 窄视口 | 未执行 | Task 级验收仍待实际浏览器检查 frame fixed overlay 的层序、滚动表现和 clipping；不以 IAB 或自动测试替代。 |
| GALHCG | 定向 `review_changes` / `maps_to` Evidence / freshness | 完成 | 沿用 `concept:ui-workspace-renderer`；本 Receipt 的既有 documentation `maps_to` edge ID `bb45a2e6e21a44509f4adbcb56f5f247` 已复核并刷新，`verify_freshness` 为 1/1 fresh；未新增 Concept。 |

## 遇到问题

- 先前 frame 外 wrapper 与 `refreshOperationWorkspaceRegion()` 的 morph 锚点不一致。本子 Unit 已按上游裁定扩展 `WorkspaceFrameSpec.overlay`，令牌层、SVG 与 status 都成为 `[data-workspace-frame="operation"]` 的直接子节点；没有修改 `controller.ts`。
- `.operation-prepared-card-layer` 采用 `position: fixed` 以跨越 frame 与列滚动容器；是否受更外层祖先 clipping / transform 影响仍需真实 Edge 检查，不能仅凭自动测试认定通过。U1-B 已实现牌层定位和交互，Edge 检查用于验收实际层序与裁切表现。
- OperationViewActor.resources 表示角色私有余额，故显示全部键值；角色自己的 `coordination` 项显示为“个人协调”，不以键名把它并入 team balance。测试覆盖无个人资源显示 `—`、Team Coordination 不混入，以及 actor-local coordination 的显式标签。

## 需上游确认项

- 若 Edge 常规 / 窄视口实测发现 clipping 或层序问题，记录实际表现并据此开后续修复；U1-B 已完成，无需再以 Edge 验收决定是否进入 U1-B。

## 事实更新建议

- `WorkspaceFrameSpec.overlay` 是将跨列 overlay 纳入 Operation region morph 的承载接口；当前 Operation overlay 用该字段作为 frame direct child。U1-B 已完成，待 Task 级 Edge 验收后再判断是否提升至持续机制文档。
