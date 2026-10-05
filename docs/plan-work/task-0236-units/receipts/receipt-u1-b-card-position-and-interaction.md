# Receipt 0236-U1-B

| 项 | 内容 |
| --- | --- |
| 状态 | U1-B 实现与自动验证完成；IAB 常规 / 窄视口人工检查通过；Edge 扩展未连接，Edge 实测仍待任务负责人完成 |
| 实际修改 | `src/ui/controller-actions-operation.ts` 完成 U1-B owner/layer 定位、mount/morph 与尺寸更新、popover / 键盘 / drag-drop 路径；当前行动牌面锚定在 owner 右缘外侧并留出间隙，右侧不足时改放左侧；替代牌 Enter 打开自身目标 tray，默认目标优先聚焦；导出幂等 `disposeOperationActions()` 释放本 controller 的牌层观察资源。`src/ui/controller.ts:UIController.destroy()` 调用 dispose。`tests/ui/gameplay-b-operation-controller.test.ts` 覆盖几何定位、owner 不重叠、目标型替代牌鼠标 click 不改 draft、Enter 发出正确目标命令、替代牌合法拖放，以及 scroll listener、MutationObserver、ResizeObserver 和 pending rAF 在重复销毁时清理。`src/ui/components/operation-workspace.ts` 让当前牌 target 使用当前计划；替代牌目标不设置 `aria-pressed`，以 `data-default-target` 表示默认项。`tests/ui/operation-workspace-view.test.ts` 验证摘要、已选目标与 default marker。另有 `src/ui/development/gameplay-b-card-inspector.ts` Escape 集成与 `tests/ui/gameplay-b-card-inspector.test.ts`。Unit / Task Read Set 与 U1-B Allowed Files 已同步；本 Receipt。 |
| 未完成内容 | Edge 常规 / 窄视口下的真实 stacking context、clipping 与焦点连续性验收尚未完成；IAB 结果不替代 Edge。 |
| 范围外变更 | 本 Unit 未修改 U1-B Allowed Files 之外的路径；没有提交 Git。 |
| GALHCG 影响闭环 | U1 文档与本 Receipt 沿用 `concept:ui-workspace-renderer` 的既有映射；最终收口更新本 Unit 路径与对应 UI / 测试的直接 `maps_to` Evidence，不新建 Concept。已按归档 Task-0235 的责任交接，在其归档且相关 Evidence 路径稳定后复核并刷新该 Concept 原有完整 12 条节点 Evidence；路径成员与节点语义字段均未改，实时 freshness 为 12/12 fresh，其中含 `docs/docs-829/06-wiki/50-ui/refresh-update.md`、`workspace-routing.md` 及本 Task 修改的 workspace、CSS 和 view test 路径。本 Receipt 的既有 documentation `maps_to` edge ID `27e238505c98464ea7e819ffc977c2d7` 也已按最终文本刷新，freshness 1/1 fresh。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/operation-workspace-view.test.ts --silent` | 通过 | 2 个文件，21/21 tests 通过；controller 14/14，含 destroy 幂等、scroll listener 移除、MutationObserver / ResizeObserver disconnect、pending rAF 取消及 stale callback 不重排；view 7/7。 |
| Inspector 集成测试 | `npx vitest run tests/ui/gameplay-b-card-inspector.test.ts --silent` | 通过 | 1 个文件，4/4 tests 通过；Operation 消费 Escape 不退出检查器，退出按钮和未消费 Escape 仍可关闭。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 全项目无类型错误。 |
| 架构边界 | `npm run check:architecture` | 通过 | `src/engine` 与 `src/data-services` 无越界依赖。 |
| 文档检查 | `npm run check:docs` | 通过 | 最后复跑扫描 679 篇 Markdown，0 errors。并行文档移动曾短暂产生范围外的链接错误，最终检查恢复通过。 |
| Diff 检查 | `git --no-pager diff --check` | 通过 | U1-B 白名单差异无 whitespace 错误；Git 提示 `src/ui/controller.ts` 既有 CRLF 会转 LF。 |
| 人工验收 | IAB `1440×900` / `800×900` | 通过 | 牌面均锚定 owner 实际 rect 且不与身份卡相交；窄窗 HP / sCost 行可读，替代牌组在 frame 内完整展示，禁用牌半透明。提交隔离回合后 Serika 的专注从 0 变 1，人物卡同步显示 `sCost 专注 1`。 |
| 人工验收 | IAB `800×900` Pointer drag | 通过 | Serika 行动牌拖至 carousel 时只有 carousel 目标高亮；目标 class 层级为 310，前景关系 SVG 层级为 999。合法释放后状态提示成功，planVersion 0→1。 |
| 键盘验收 | IAB | 通过 | `ArrowDown` 打开旋转木马目标托盘；Escape 仅收起托盘、还原行动牌焦点，检查器仍打开。 |
| 人工验收 | Edge 常规 / 窄视口 | 未执行 | Edge 扩展连接两次失败；不将 IAB 结果记作 Edge 通过。 |
| GALHCG | 定向 `review_changes` / `maps_to` Evidence / freshness | 完成 | 沿用 `concept:ui-workspace-renderer`；本 Receipt 的既有 documentation `maps_to` edge ID `27e238505c98464ea7e819ffc977c2d7` 已复核并刷新，`verify_freshness` 为 1/1 fresh；未新增 Concept。 |

## 遇到问题

- 任务负责人 800px 实测指出 selected action card 的初始 left 会进入 owner 右缘约 18px，遮挡人物卡 HP / 资源行。现改为 owner 右缘外 8px 起始；右侧无法容纳完整牌面且左侧可容纳时切到左侧，并由定向测试验证两侧锚定间隙。此修正尚待 Edge 复验。
- 任务负责人发现 Inspector overlay 无条件处理 Escape，会在 Operation 已消费该键并关闭局部 tray 后仍关闭整张检查器。现由 overlay 检查 `event.defaultPrevented`，集成测试覆盖内部已消费、未消费及退出按钮三条路径。
- 独立审查发现目标型替代牌鼠标 click 曾打开目标 tray，形成“点牌再点目标”。现鼠标 click 不选牌 / 不开 tray；拖放路径保留，键盘 Enter 仍可打开当前替代牌自己的目标 tray 并设置目标。定向测试覆盖三条路径。
- 替代牌与 target tray 曾继承 `actor.currentPlan.targetActorId`，会显示当前牌的目标。现仅当前牌读取当前计划目标，替代牌与对应 tray 读取自己的 `defaultTargetActorId`；view test 验证摘要和 `aria-pressed`。
- Inspector 重复开关会留下牌层 scroll listener、MutationObserver、ResizeObserver 或 pending rAF。现将其绑定到 UIController 生命周期；destroy 幂等移除 listener、断开 observers、取消 frame，stale callback 不能再排程。
- 本轮桌面与窄窗手动检查复用 IAB 的 isolated inspector，不写主 Run / 存档；Edge 扩展连接失败，因此 Task 仍保留 Edge 待办。
- U1-A 将共享 layer、SVG/status 输出为 `[data-workspace-frame="operation"]` 的直接子节点，因此交互宿主必须定位到 Operation frame，不能再依赖已删除的外层 `data-operation-workspace` wrapper。已将宿主查询及 mount/morph 观察切换到 frame root。
- 当前目标合同限制首幕行动仅能指向旋转木马，所以合法目标按钮可能已经处于选中状态。键盘路径仍可通过 `ArrowDown` 进入目标 tray；已有默认目标时激活不产生额外 Run 写入。合法拖放对旋转木马仍通过现有干预预览 / 命令落定。
- 牌层使用 fixed SVG / layer；DOM 测试证明坐标换算和动态重算，不替代 Edge 对更外层 clipping / stacking 的验收。

## 需上游确认项

- 请完成 Edge 常规与窄视口实测后，审阅 U1-B Receipt；若出现外层裁切或层序异常，再依据实测结果调整 Unit 范围。

## 事实更新建议

- Operation frame fixed 牌层的 owner/layer 几何、scroll 与 ResizeObserver 重算路径已由此 Unit 实现；待 Edge 验收后再决定是否把稳定刷新行为补入 `docs/docs-829/06-wiki/50-ui/refresh-update.md`。
