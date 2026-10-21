# Unit task-0310-U10

## Goal
以既有 Frame/Titlebar 实现地图三栏、稳定 SVG 节点与独立详情/反馈区。

## Must Read / Read Set
frontend-design/overlay；ui-style foundations/patterns；WorkspaceFrame/Titlebar；AreaMapSession/View；PicQueryPort。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
Frame 支持 columns/hostId/scroll；地图只消费脱敏 View；Area 左栏可复用。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/components/area-map-workspace.ts
- src/ui/css/area-map.css
- src/ui/workspace/workspace-renderer.ts
- src/ui/components/rail.ts
- tests/ui/area-map-workspace.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 以既有 Frame/Titlebar 实现地图三栏、稳定 SVG 节点与独立详情/反馈区。

## Verification
组件结构、转义、Frame 身份、地图/节点详情和无移动渲染测试；后续真实浏览器验收。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
## 结构与更新草图

复用 Frame 三列及中/右 Titlebar。新增四个主宿主：center viewport（SVG）、SVG world、右栏 details scroll、右栏 action/feedback；world 下 edges/nodes 两个 keyed 图层承担集合关系。workspaceOwner=area-map；列 hostId=leftPanel.area-map.navigation / centerPanel.area-map.main / rightPanel.area-map.inspector；details 的 scroll owner=content-region，viewport 不滚动。

切会话用 structure；平移缩放仅 world transform；选择节点更新对应 aria 属性与 details 子内容；切图协调 keyed edges/nodes，Frame/toolbar/viewport/scroll 宿主不换。移除/替换前 dismiss popovers in range，之后 retainIfAnchored。缺失单区只补所属列；route/root 错配才恢复 workspace。实现协调器留 U11。
