# Receipt task0283-U5：按责任区更新

实现：

- 搜索输入、中文输入法提交、条目列表、详情标题与滚动宿主继续按 Pane 局部协调；位置提示只定位到已渲染节点。
- 图鉴页签键盘委托支持 Home／End／方向键；委托定位真实页签按钮，切换后重新查询并聚焦稳定按钮。详情容器不再重复携带页签键，协调器也只把页签按钮视为 keyed 节点，避免切页替换焦点锚点。
- 缺失 Pane 按 nav／list／detail 顺序插入，不替换其余 Pane；移动端切栏清除空 class 属性，避免后续完整同步误替换 body。
- Pane 变化前关闭受影响范围浮层，变化后调用 retainIfAnchored。

验证：

- `npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts tests/ui/runtime-editor-codex-shell.test.ts`：2 个测试文件、32 个测试全部通过。
- `git diff --check -- src/ui/runtime-editor/actions.ts src/ui/runtime-editor/codex/dom-updates.ts docs/plan-work/archive/task-0283-units/receipts/receipt-task0283-u5-dom-continuity.md`：通过。
- 本轮未运行 `tests/ui/runtime-editor-codex-dom-updates.test.ts`、类型检查或架构检查；按父 Task 分工由主线程处理后两项。

边界：仅改 U5 白名单；未改测试或其它 Unit 文件，未刷新或写入项目地图。没有新增渲染调度器，也没有改变编辑器会话、玩法或存档。
