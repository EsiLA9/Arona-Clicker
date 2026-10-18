# Receipt 0290-U6：Encounter 区域局部刷新与端到端验收

**结果：实现、验证与独立只读复核完成；无阻塞问题。**

## 修改内容

- Map Workspace 右栏 Encounter 内容新增稳定 `[data-map-encounter-region]`。当 Run、当前 Node 和活动 Encounter 保持一致时，Map Workspace 行动请求只替换 Encounter 子区；路线结束或子区缺失、身份不匹配时，显式恢复 Map Workspace 或当前路由。
- Hand、Target、Override、Commit 的子区替换保留 Map route、三栏 Frame、左侧节点列表、中间当前 Node 与各列滚动位置。替换前关闭子区内锚定浮层，替换后保留仍有效的浮层锚点和焦点；原焦点失效时退回 Encounter 标题或当前可用行动控件。
- Encounter 移动和手动完成仍更新 Map Workspace，因为它们改变 Node 进度或中列路线状态。
- 正式 Spot 入口 UI 竖切片覆盖双角色 Hand、免费 Swap、过期草稿不改状态 / 不重抽、PlayerCost Command、成功整轮 Commit 与资源变化、Encounter 完成回到原 Node 和退出地图成功。
- `ui-style/patterns.md` 已记录 Map / Encounter 的稳定宿主、子区刷新边界、恢复路径和验证入口。

## 精确白名单

- `src/ui/controller.ts`
- `src/ui/components/map-workspace.ts`
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`
- `ui-style/patterns.md`

U6 未修改白名单之外的源码、测试或生成 Schema。

## 验证

- Map / C1 / C2 回归：Registry 72、Map ID 2、Resolver 2、MapRun 28、Runtime Integration 4、Save / Resume 6、正常入口竖切片 2、Workspace 8，**8 个测试文件、124/124 通过**。
- `npx tsc --noEmit` 通过。
- `git diff --check` 无空白错误；提示既有 `controller.ts` CRLF 将来可能转为 LF。
- 独立只读复核：无阻塞问题。确认常规行动只替换 Encounter 子区、异常恢复路径显式、外层 UI 与路由保持身份，正式入口竖切片未直接创建 MapRun。
- E2E 的 PlayerCommand 内容从正式 Gameplay B 样例 Datapack 派生，额外加入一个手牌外行动候选；仍通过 Datapack 加载、Registry、Map Resolver、Spot、Controller 与 MapRun Owner。复核将其作为非阻塞说明。
- 浏览器验收未能完成：computer-use skill 的 Edge 窗口激活连续两次失败，按其恢复规程停止 Windows UI 操作。自动化 UI 竖切片、Map 回归、类型检查与独立源码审查均通过。

## 关键行为证据

- `tests/ui/gameplay-b-map-vertical-slice.test.ts` 在正常 Spot Entry 后执行两名角色的抽牌与行动，并确认高频更新后 Map Workspace、三栏 Frame、左列、当前 Node、route、各列滚动及 shell 身份不变。
- 过期 Swap / Commit 不改 Hand 或 Run 状态；成功 Commit 后只执行一次下一轮抽牌并显示新 Hand。
- 缺少 Encounter 子区时恢复 Map Workspace 内容，但不重建外层 shell；清除 Override 后焦点落到 Encounter 标题，而非地图中列标题。
- PlayerCommand 成功结算后，Run 记录 `1 PlayerCost` 与正向资源变化；Encounter 完成后仍停留原 Node，玩家可继续移动至出口并完成 MapRun。

## 后续边界

- C3 已完成；C4 在同一 MapRun 提交管线扩展 HP、Enemy、Ability / Item 与失败终态。
- C5 按总控 Task 处理旧 Gameplay B 数据退役、实际内容从零重建和受支持的作者编辑入口。
