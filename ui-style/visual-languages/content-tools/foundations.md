# 内容检索工具的表面与布局

**已采用的工具特例。** 超级图鉴沿用 body 级 Runtime Editor 的独立工具外观：`src/ui/runtime-editor/codex/codex.css` 在 `.runtime-editor-codex` 内定义局部 `--codex-*`，承载表面、文本、边框与强调。编辑表单继续使用 `src/ui/css/runtime-editor.css` 的 `--re-*`。共享 Frame 只复用网格几何，`.runtime-editor-codex__grid.workspace-frame` 规则重置 Frame 的 margin、gap 与 height。内容工具的纯布局入口不生成游戏 Presentation host。`tests/ui/workspace/workspace-frame.test.ts` 验证的是输出结构与 Host 隔离，不等同实际浏览器视觉验收。这是当前已实现并采用的工具范围例外，不能据此为其它页面新建固定配色。
