# Receipt task0283-U6：导航与DOM连续性回归

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | tests/ui/runtime-editor-codex-integration.test.ts、tests/ui/runtime-editor-codex-dom-updates.test.ts、tests/ui/runtime-editor-codex-shell.test.ts：覆盖共享工作区身份、详情页签键盘委托、IME期间稳定输入、跨筛选跳转／主动定位／返回、限长历史及缺失Pane按原顺序恢复。 |
| 未完成内容 | 本 Unit 内无未完成项。 |
| 范围外变更 | 无。 |

## 验证

- 五文件 UI 批次：Integration 24、Details 13、Shell 9、DOM updates 3、Workspace Frame 13，共 62/62通过。
- 集成回归证明重复同步不重建工具、页签按钮与标题保持身份、IME输入与焦点不丢、列表和详情滚动及历史上下文恢复。
- 1440×900桌面浏览器实际操作通过：搜索Area入向引用Spot、筛选外提示、主动定位、连续返回；End切至“技术详情”。原Runtime Editor入口仍能打开原“内容浏览器”。
- 截图已保存。窄屏验收按用户明确要求从本轮范围排除，未执行。
- 类型、架构、文档和差异空白检查均通过，详见父Task最终验收。

## GALHCG

沿用 project_id=acprogram 做直接路径只读复核；未刷新、写入 freshness 或维护图谱。
