# Receipt task-0310-final — 区域地图 V1 交付

日期：2026-10-21。Task0310 的 P0—P4 已实现并验收；保留同工作树的 Story、MapRun 与文档并行修改。

## 改动与结果

独立地图契约/ID/表、两阶段验证、完整包导入、只读 Reveal 投影、共享旅行准入、前台 gate、稳定会话路由、三栏画布/详情、历史/每图相机、同步移动与异常生命周期已完成。当前事实正文见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]。

Unit U01—U18 均有对应白名单与 Receipt。U02/U12/U13 的审查修正留在原白名单：Pic ID 复用 kind(pic)，指针只在拖动后捕获，原生 SVGPoint getter 显式归一化，离开地图先恢复原游戏位置。U18 修复故事结束后按钮可用性不随 Reveal 指纹变化的问题。

## 实际验证

| 验证 | 结果 |
| --- | --- |
| 新增地图/前台行为测试 | 49/49 通过 |
| 最终跨域定向回归 | 22 文件、356 测试；351 通过、5 个并行 Story 投递断言失败，详见下文 |
| npx tsc --noEmit | 通过，exit 0 |
| npm run check:architecture | 通过 |
| npm run gen:schema + Schema sync tests | 生成成功；最终同步测试 11/11 通过 |
| npx vite build --outDir 临时目录 --emptyOutDir false | 通过；输出到系统 Temp 的 acprogram-task-0310-build，未写 dist/web-dist；有现行大 chunk 提示 |
| npm run check:docs | 仅余 8 个既有 Operation 失效源码/测试路径；本次新增文档/链接无错误 |
| git diff --check | 通过；新文件另查尾随空白 |

最终定向命令：npx vitest run area-map foreground-interaction tests/engine/game-instance.test.ts tests/engine/passive-pool.test.ts tests/ui/workspace-lifecycle.test.ts tests/ui/workspace-router.test.ts tests/ui/workspace-frame.test.ts tests/ui/controller-events.test.ts tests/ui/spot-payment-modal.test.ts tests/data/gameplay-b-map-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts --silent。

16:27 的相关回归曾 351/351 通过。随后并行工作于 16:36 后增加 StoryAvailabilityDeliveryMount 与 baseStoryPageOnlyEntryIds，把目录开放入口自动投递到当前 Area；最终 passive-pool.test.ts 有 5 条旧断言失败，涉及空投递集合、集合长度以及依赖第一项的完成态。源码与测试均不由地图 Task 修改；地图相关 49 项和其余相关测试均通过。该问题需在 Story 所属任务按新生命周期同步断言，本 Receipt 不将它写成地图回归通过或静默修改其语义。

## 桌面浏览器证据

入口：http://localhost:5173/src/ui/index.html?areaMapDemo=1。通过 IAB 实际鼠标验收，初始宽屏 1241×720：

- Hero 下入口、三栏布局、真实 Area 左栏；inspect 只显示详情，Area 选点不移动。
- 平移/锚点缩放/fit/reset、拖动不误点；发现并修复提前 capture 与 SVGPoint getter 导致的实际浏览器问题。
- A→B→C→A 循环、上一图、当前区域图清历史；共用图的两个 Area 正常。
- 不相邻/节点锁定禁用、隐藏节点/关联 Edge 不输出；条件显示资源人类名称。
- 显式移动只执行一次，退出地图，先显示移动通知再播放到达剧情；剧情期间 Hero/Map/移动阻塞，完成后入口原位恢复。
- 关闭恢复普通游戏面板；自动化另外验证阅读位置、命令失败保留、过期目标拒绝、owner/passive、模态确认、外部移动/读档/数据失效和节点身份。

截图：evidence/task-0310-map.png（宽屏选点）、evidence/task-0310-arrival.png（到达与 Story）。另有 task-0310-final.png 为用户侧面板缩窄后的快照，不用作宽屏布局验收。演示使用页面内存 SaveSystem，不覆盖普通存档；DEV 参数仅启用独立示例，不修改默认数据。

## GALHCG 影响闭环

先 graph_project 核对 acprogram，以 Registry 候选回到当前源码核实。对本 Task 源码、测试、机制文档和索引直接路径执行 graph_health(check=changed)；对 owner_next_offset 独立分页读到 owner_complete=true。已有路径为 content_changed，新文件通常 unreferenced_path；这些是只读诊断，不是功能失败。概要见 evidence/task-0310-galhcg.json。

没有图维护授权，未改图、刷新清单或写 freshness。Task/Unit/Receipt 最后归档并回读链接。此后再改内容需以当前源码与测试重新核实。

## 剩余项

地图 V1 功能无剩余施工项。5 个并行 Story 测试断言和 8 个既有文档失效引用仍有失败记录；未运行全仓测试，不声称全仓绿灯。
