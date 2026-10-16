# Receipt task0283-U7：同步当前机制与样式描述

状态：完成。文档更新与静态检查完成；桌面浏览器由主线程统一验收。本 Unit 未执行浏览器视觉验收。窄屏验收按用户要求排除在本轮范围。

## 更新

- read-model-context.md 补充图鉴适配器只读消费当前 Registry 有效视图、与 Editor Draft／PackCatalog 的边界及集成证据。
- refresh-update.md 对齐委托入口、三栏生成与 Pane 局部协调路径，说明稳定节点、历史阅读位置恢复、浮层边界和缺失 Pane 的顺序恢复。
- ui-style/patterns.md 区分完整游戏 Workspace Frame 与内容工具纯布局入口，记录直系栏位、pane-switch、可选操作 footer 和工具自有表面／滚动边界。
- ui-style/foundations.md 补齐 Codex／Editor 局部变量、共享 Frame 几何例外，并注明 Frame 结构测试不等同浏览器视觉验收。

## 验证

- npm run check:docs：通过，扫描823份Markdown，errors: 0。
- 主线程五文件 UI 批次：62/62通过；npx tsc --noEmit、npm run check:architecture通过。
- 主线程完成1440×900浏览器操作验收并保存截图；实际检查中文搜索、引用跳转与返回、技术详情、长ID和浅色工具表面。窄屏未执行。
- 本 Unit 未重跑源码验证，也未将静态或源码证据描述为本Unit的浏览器验收。

## GALHCG

graph_project只读确认工作目录为acprogram；四份机制／样式文档直接路径已映射。Receipt路径未映射。本轮未刷新或写入图谱。
