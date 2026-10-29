# Task Handoff：Runtime Editor 新建 Init 后 Init 转轮仍冻结

状态：active — handoff，交由下一次对话继续定位与修复

## 1. 用户现象

通过 Runtime Editor 添加新 Init 后，主体界面仍会卡在创建新 Init 时所在的 Init 转轮内容。上一轮针对“旧翻面动画回写新选择页”的修复已经提交，但用户确认问题仍然存在，因此当前问题不能再假定只是翻面计时器竞态。

目标是：新 Init Apply 完成后，主体选择页保持为有效、可交互的 Init 选择页；新 Init 能出现在转轮中，原有 Init / GlobalEnhancement 翻面、滚轮聚焦、详情 CTA 和再次渲染均正常工作。

## 2. 上一轮已尝试但未解决的修复

本地提交：`4e89108 fix: invalidate stale init selector transitions`

已修改 `src/ui/selector-page.ts`：

- `SelectorPage.reset()` 增加 `flipSeq` 递增，使整页重建时旧翻面定时器失效；
- `slideTo()` 增加 `sceneSeq` 代际校验；
- 翻面中触发 `renderInitSelect()` 的回归测试已加入 `tests/ui/controller-global-enhancement.test.ts`。

该回归测试覆盖的是“翻面中整页重建后旧回调切回旧面向”，并非用户实际执行“新建 Init → 保存草稿 → Apply → 主体界面卡死”的完整路径。测试通过不能证明真实 Runtime World Apply 生命周期已经正确。

## 3. 下一轮必须优先调查的真实链路

按以下顺序检查，不要先继续增加选择页动画保护：

1. `src/ui/runtime-editor/actions.ts` 的 `applyRuntimeWorldEditorDraft()`：确认新 Init Apply 成功前后 `editor`、`selectedContentKind`、`runtimeEditorPanelOpen`、`panelState.service` 和 `ctrl.render()` 的先后关系。
2. `src/arona-clicker/services/runtime-world-content-coordinator.ts` 的 `applyWorldDraft()`：特别注意 `onCommitted` 在内部 `modName / inits / areas / revision` 写回前执行；核对回调期间是否可能触发 UI 读取、渲染或选择页状态变化。
3. `src/arona-clicker/runtime.ts` 的 Runtime World `onCommitted`：检查 `initDefinitionChanged`、`areaDefinitionChanged`、`areaTopologyChanged` 是否经 EventBus 间接触发渲染或重入。
4. `src/ui/controller.ts` 的 `render()`：确认 `started === false`、`panelState.service === 'game'`、`panelState.workspace` 和 `pendingRestart` 组合下是否反复走 `renderInitSelect()`，以及是否存在待执行的 `scheduleRender()` 在 Apply 后再次覆盖选择页。
5. `src/ui/controller-panels.ts` 与 `src/ui/selector-page.ts`：记录每次 `renderSelectorPage()` 的 `initialFace`、`selectedInitId`、`preferredInitId`、DOM 中的 Init 行数和 `currentFace`，确认“卡死”是：
   - 页面无法响应点击 / 滚轮；
   - 选择页被反复重建；
   - 选中 ID 始终停留在旧 Init；
   - DOM 面向或 wheel class 被错误恢复；
   - 还是新 Init 实际没有进入 Registry。
6. `src/ui/selector-theme.ts` 的 `preferredInitId()`：确认 `activeInit`、`visitedInits` 或旧 `initSelectedId` 是否在新 Init Apply 后把选择状态固定到创建时的旧对象。

## 4. 必须补充的回归测试

当前测试不能只调用 `renderInitSelect()` 模拟 Apply。下一轮至少补一条真实 UI 流程测试：

1. 创建 `AronaClickerRuntime`，停留在无 active Init 的 Lobby / Init 选择页；
2. 打开 Runtime Editor；
3. 通过“新建 Init”填写 Init 与自定义 `defaultArea`；
4. 保存 Definition 草稿并执行 Apply；
5. 断言 `game.registry.inits`、`game.registry.areas` 已包含新对象；
6. 断言主体选择页仍存在且 Init 行包含新对象；
7. 点击旧 Init、新 Init、GlobalEnhancement 翻面按钮和 Init 转轮滚轮，确认页面仍可交互；
8. 等待所有调度渲染、动画和 microtask 完成后再次断言页面状态没有回退。

如果浏览器中才出现问题，使用真实浏览器记录以下时间序列：

```text
Apply click
  → RuntimeWorld commit
  → EventBus events
  → controller render / scheduleRender
  → selectorPage.reset / bindStage
  → runtime editor panel sync
  → delayed timers / microtasks
```

每一步都记录 `started`、`pendingRestart`、`panelState.service`、`panelState.workspace`、`runtimeEditorPanelOpen`、`selectorPage.currentFace`、`selectorPage.selectedInitId` 和 `root.innerHTML` 是否被重建。

## 5. 不要重复的方向

- 不要只继续增加 `flipSeq` / `sceneSeq` 判断；上一轮已经证明该层保护不足以解释完整用户现象。
- 不要通过强制关闭 Runtime Editor、强制跳转到某个 Init 或清空选择状态掩盖问题。
- 不要把新 Init 自动设置为 `activeInit`；在 Lobby 里它应只是可选择内容，进入游戏仍由用户 CTA 决定。
- 不要绕过 `StateMutationService`、Runtime World Coordinator 或 Registry 受控写入口。
- 不要把旧 `tools/datapack-editor` 当作调查目标；当前问题属于 `src/ui/` 游戏内编辑器和 Init 选择页。

## 6. 验收口径

- 新建 Init Apply 后，主体界面不冻结、不反复重建、不停留在错误的翻面中间态；
- 新 Init 和协同创建的 defaultArea 同时存在且引用正确；
- Init 转轮可以点击、滚轮移动和切换 GlobalEnhancement；
- 选择详情、进入 CTA、返回游戏和 Runtime Editor 前台状态不回归；
- 正常选择页翻面与服务切换测试继续通过；
- 完成真实浏览器验收后，再更新本 Task 状态并维护 AOCI Entry。

## 7. 当前工作区与治理注意事项

- 上一轮代码提交为 `4e89108`，本 handoff 不回滚该提交；
- 工作区存在大量并行任务未提交修改，必须只触碰本 Task 明确涉及的文件；
- 上一轮 AOCI 维护曾因并行任务将 `task-0101` 从根目录移动到 `archive/`，并且当前 Volumes v1 删除接口只读而停在孤儿条目状态；下一轮在最终稳定后重新按当前 AOCI Guide 处理，不要手工编辑 `aoci.code.txt`。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/runtime-editor]] · [[docs/docs-828/02-modules/world]] · [[task-0098-runtime-editor-workspace-decoupling-and-light-theme]] · [[task-0095-runtime-editor-mini-launcher-and-init-default-area]]
