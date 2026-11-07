# Task 0364：逐步迁出 Operation 内“产生 StoryNode”的内容

状态：待实施 — 2026-11-06 创建；可以先盘点，正式迁出依赖基础与高级演出设计器。

## 目标与范围

- 目标：将作者显式声明的文字、气泡与交互卡片迁回 Talklet / Click 实体，使正文与演出可直接选择和编辑；Operation 聚焦业务动作、全局演出及清理。
- 基础任务 0362 已完成并压缩归档，基础字段机制见 [[runtime-editor-and-project-checks]]；高级任务 0363 的新节点表达、预览和清理能力已实现并压缩归档，当前机制见 [[story-and-effects]]。正式迁出前，待并行 StoryEntry 迁移稳定后复跑共享 Story / Entry 集成、类型与 Schema 检查；0363 的最终整体复验曾受该在途迁移和 Area Reveal 旧 Schema 覆盖字段影响。先盘点，再按可验收批次迁出；每批提供实际数量和残留清单。
- 优先范围：`Operation.action.kind = overlay` 且 `command = show` 的 text / message / entryCard，以及产生这些结构的内置内容和离线作者工具。
- 不把所有输出通知当成“产生 StoryNode”：奖励 / 旅行通知等业务回执仍归原服务；EntryRequest 启动另一 Entry 的流程职责保留。全局主题、实体表现、清流 / 定点清理等仍可由 Operation 承担。
- openingTitle 等场景级表现按用途分类，不能因为出现文字就自动迁成普通 Talklet。不恢复 Click result，不修改已完成的 Choice marks 方向；不改任意 Extra 文本或外部用户文件。

## 分批交付与验收

- [ ] 盘点正式源码、导出基础包、离线迁移 / 作者工具、Schema / 编辑器与测试夹具；逐项列出旧位置、内容类别、目标节点类型、清理引用和可迁出 / 需保留原因。
- [ ] 先完成“流剧场预演”纵向样例：标题 / 字幕 / 样式文字 / 定位气泡使用 Talklet 的演出参数，定位入口卡使用 Click；原先独立正文及确认按钮仍保留各自职责。
- [ ] 与 0363 的节点生命周期对齐，核对显示位置、字体 / 背景、清理、确认次数、内容顺序和 Entry 准入；定位 Click 的阻塞可能不同于旧覆盖层邀请，需明确改写，不能只替换对象结构冒充等价。
- [ ] 建立旧覆盖层 ID 到新节点引用的映射，处理同 ID 覆写 / 复用 / 清理及缺失目标；一次性生成稳定且不冲突的节点 ID，清理项可导航到目标节点。
- [ ] 分批迁出其余内置内容；每批核对内容未丢失、未重复显示或执行，条件 / flags、owner / run、场景及重播语义均正确。
- [ ] 同步导出基础包、作者 API / 离线迁移输出、已声明引用、关系 / 清理候选和必要夹具；工具不继续生成待退役的 show 结构。
- [ ] 所有正式生产方完成迁出后，移除 Operation 的节点生成契约、编辑入口及无消费者分支，保留仍有用途的全局 / 清理命令；删除的能力不以隐藏的兼容执行分支继续存在。
- [ ] 对旧自定义草稿 / 外部内容提供保留原值的路径诊断，明确如何改成实体节点；处理前拒绝发布或启动，不加载后静默删字段。旧运行快照不另写迁移层，沿用现有显式失配与重启规则。
- [ ] 更新当前机制与视觉资料、相关行为回归和 Schema 同步通过；记录每批迁出结果和最终残留，索引与完成状态一致。

## 事实与决定

| 问题 | 已核实事实 / 用户方向 | 实施要求 |
| --- | --- | --- |
| 当前样例 | `story-schale-main.ts` 的 `base:story:schale_flow_show` 目前用 Operation.overlay.show 生成标题、定位文字、消息与卡片 | 该故事作为首批可观察验收样例，不以普通流字体效果替代定位演出 |
| 当前主体 | overlay message 虽复用气泡外观，当前并不是独立 Talklet；覆盖层 entryCard 同样不是流内 Click | 迁出后必须拥有真实节点身份及相应作者操作，不能只更换编辑器标签 |
| 执行差异 | 旧覆盖层显示不一定阻塞正文；真正 Click 是输入等待点 | 逐项裁定入口邀请是否等待及何时退出，记录允许的行为变化，避免凭外观相同声称完全等价 |
| ID 作用域 | 旧 overlay ID 支持同 ID 后写覆盖与 clearId，节点 ID 则标识作者实体 | 结合 0363 的重复到达与清理范围设计迁出，避免原字符串直接替换造成跨 Story / 运行误清 |
| 旧任务 | [[ai/plan/task-0355-story-editor-theme-position-and-flow-tools]] 包含旧 overlay 设计工具；[[ai/plan/task-0348-story-talklet-click-authoring-coverage]] 有旧 result 范围 | 复用有效工具与验证，更新直接受影响的陈旧说明，不据旧计划恢复退役字段 |

## 当前进度

- [x] 记录迁出目标、分批方式、首批样例与依赖边界。
- [ ] 建立直接生产方 / 清理引用盘点表，说明可迁与保留项。
- [ ] 0363 验收后完成首批样例，再逐步迁出和收尾。
- 正在进行：尚未施工，未修改正式内容。
- 下一步：盘点 `overlay.show` 的生产方及 `clearId` 使用位置，准备“流剧场预演”的旧结构与目标节点对照。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/arona-clicker/content/story/story-schale-main.ts`、`src/arona-clicker/content/base-pack/content.json` | 首批样例、其余主题演出及导出副本 | 已核对流剧场样例；待完整盘点 |
| `src/data-services/contracts/story-node-actions.ts`、`story-node.ts` | 旧 show 与目标节点表达 | 已核对；退役依赖 0363 |
| `src/arona-clicker/services/story/story-node-action-host.ts`、`story-node-presentation-host.ts`、`story-service.ts` | 行为适配、演出归属及 Runtime 装配 | 已核对主要入口；待清理消费者 |
| `src/ui/story-editor/property-fields.ts`、`controller.ts`、`view.ts`、`src/ui/components/story/story.ts` | 旧表单 / 覆盖层画布与新实体编辑 | 已定位；共用渲染不能误删其他模块消费者 |
| `src/data-services/authoring/story-definition-projection.ts`、`src/data-services/registry/runtime-content-reference-rules.ts`、`scripts/migrate-story-content.mjs` | 投影、引用和生产工具 | 已定位；待逐项盘点 |
| `tests/ui/components/chat-text.test.ts`、`tests/ui/story-editor-properties.test.ts`、`tests/engine/story-node-playback.integration.test.ts`、`tests/data/migrate-story-content.test.ts` | 样式、编辑、播放顺序与工具回归入口 | 已定位；按迁出批次调整 |
| [[story-and-effects]]、[[story-chat-and-theme-presentation]]、[[runtime-editor-and-project-checks]] | 迁出后的职责及作者入口说明 | 已核对相关部分；实现后更新 |

## 验证与结果

- 本轮仅建档，尚无迁出数量或实现验收结果；`npm run check:docs` 127 页、0 错误通过，任务范围 `git diff --check` 通过。
- 每批先比对文字、样式、目标与执行顺序，再测试点击阻塞 / 完成、定点 / 全局清理、同 ID 替换、保存恢复与重播；确认旧 show 与新节点不会双重生效。
- 测试统一经 `npm test`；日志与临时盘点产物归 `.test-artifacts/`。Schema 从源契约生成，类型 / 架构 / 文档按影响验证；未做浏览器验收需如实记录。

## 剩余工作与交接

- 完成 0363 前不移除运行中的 show 能力；迁出过程中明确每批的旧 / 新内容边界，最终再删除无消费者路径。
- 本 Task 不授权清除用户存档、修改外部数据包、刷新或改写项目地图；收尾只读核对直接影响范围。
