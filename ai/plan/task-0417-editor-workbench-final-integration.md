# Task：Stage 07-E：风险驱动集成验证

状态：已完成

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：完成Stage 07-E的独立交付节点，只迁移本Task声明的职责，并为后续节点留下可验证结果。
- 完成条件：记录命令/结果/隔离数据/浏览器路径/未验项；区分自动验证与人工验收；Stage02遗留逐项关闭或说明影响。
- 前置：Stage 07-E；上一序列节点通过后开始。
- 边界：不得改变Task 0386长期设计合同；不修改独立Datapack Editor、存档格式或无关UI。接口和文件可随当前源码调整，状态所有权与业务行为不可降级。

## 当前依据与改动方案

- 当前依据（2026-11-27）：Task0412后唯一代码变化是删除测试专用生产 snapshot facade，Stage07-C/D只改文档；Story targeted 4 tests/typecheck、docs/architecture/diff已通过。用户明确允许略过所有直接浏览器验收，最终交付需要区分自动验证与手动待验。
- 具体调整：执行覆盖 Workbench Manager/Story/World/Explorer/DEV 的风险相关自动化回归，检查公共唯一状态 owner、实例激活/关闭、Explorer 与 active instance 独立、空 Workbench/显式退出、查询/折叠/定位，以及最近删除 facade 后的状态断言。运行 typecheck、architecture、docs、diff。不开浏览器；按 Stage02、0384/0385 需求整理人工验收路径并标注未观察，不把浏览器项写作通过。
- 衔接与验证：Stage 集成自动测试按实际影响选择，不重复无关全项目测试；完整测试输出使用 `.test-artifacts/latest.log`。检查入口：Workbench/Explorer/Story/World/DEV 对应 suites、`workspace-columns-and-layout.md`、当前待验 Tasks 0384/0385、testing convention。环境策略为浏览器人工验收。

## 工作项

- [x] 复核前置Task、当前源码与直接调用方，补入实际符号、测试入口及偏离基线的事实。
- [x] 完成本节点迁移，记录状态权威去向和退出的旧写入口；不得用双写同步替代迁移。
- [x] 运行对应定向验证；区分新回归与已有基线，必要时仅做风险相关浏览器检查。
- [x] 记录Checkpoint：文件/符号、旧路径退出、验证结果、遗留项和下一Task第一动作。

## 当前进展

- 已完成：Task0413–0416归档，Stage07 owner 清理和文档增补完成；用户要求浏览器留手动验收。
- 已完成：运行 Workbench/Explorer/Story/World/DEV 综合回归，检查最近的 Explorer service 实际绑定及 0414 Manager snapshot facade 删除；完整命令和结果见下方。
- 人工验收未执行（按用户明确授权略过浏览器）：保留可直接操作的宽屏清单。Stage02/0384/0385未验项不影响自动化结果，但需要用户之后手工确认；无远程/外部数据写入。
- 下一步：归档并进入 0418；最终交付区分自动通过与待用户验收项，核对 Task/文档索引后停止。

## 结果与问题

- 自动验证：`npm test -- tests/ui/workspace/editor-explorer-service.test.ts tests/ui/workspace/workspace-columns.test.ts tests/ui/story/story-editor-workspace.test.ts tests/ui/story/story-editor-authoring.test.ts tests/ui/story/story-editor-explorer-identity.test.ts tests/ui/runtime-editor/runtime-editor-world-browser.test.ts tests/ui/development/dev-navigation.test.ts`：7 files/140 tests passed；测试按 Happy DOM 与项目 fixture 运行，清理 localStorage，不操作玩家存档。
- 静态检查：`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（0 errors，129 markdown scanned）、`git diff --check` 均通过。diff 输出仅有仓库既存 CRLF→LF 提醒。
- 浏览器：未操作。不得据此声称已通过视觉/真实滚动验收；相关未测项交由用户手工处理。

### 待用户人工验收

- Story 与 World 独立进入，并在同一 Workbench 切换左栏工作类型；确认活动 Story/Entry/World 的中右栏与顶部工具随活动实例，左栏 Explorer 可单独切换且布局偏好不变。
- 在三栏/双栏/专注间切换，调整左右栏宽、缩放窗口、展开/紧凑 Ribbon；在 Story 与 World 主题下检查实际轨道、内容宽度、悬浮滚动条显隐和正文不跳动。
- 切换不同来源的 Story/Entry 实例，观察目标 placement 的选中、祖先展开、滚动和 focus；在搜索及 Init 过滤仍生效时执行显式定位，确认 query/filter 不被清除，Entry 多放置选择正确。
- Story 目录管理与隔离试播分别从双栏/专注场景进入并退出；确认恢复原基础布局、目标实例、正文/属性页焦点与各自滚动。
- Story 正文输入光标、Entry 属性编辑及弹窗锚点在局部刷新中保持；World 中栏实体链接不使专注模式自动打开目录、不重置树折叠/滚动，显式“定位选中项”会显示并定位左栏。
- 关闭非末实例不退出 Workbench；关闭最后实例后仍能从空工作区打开资源；显式退出才恢复原返回页面。反复进入/退出检查公共命令无重复触发。
- 0384 树行检查：多层 Chevron、辅助线对齐、名称省略、行 hover/选中/focus、常显齿轮及 Story/World 公共样式；确认行高度不因 hover 位移。
- 0385 有一条旧开发服务器记录：如果仍在使用旧 5173 server，先刷新或重启以加载当前 `world-editor` 公共 CSS 映射，再验收，避免看到已知过期的转换模块。

- 遗留影响：以上属于真实界面/主题/几何/滚动与输入焦点问题，DOM 测试不能替代；除非人工验收发现问题，不阻塞 Stage07 文档收尾。
- Checkpoint：自动测试、类型/架构/文档/差异检查结束；无代码更改发生在此 Task，未创建 Git commit 或远程推送。下一 Task 0418 核对这些清单、Task 状态和文档索引后交付并停止。
