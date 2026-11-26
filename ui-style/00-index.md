# UI 风格指引

适用于 ACProgram 的桌面宽屏游戏界面与游戏内工具。先按目标界面选视觉语言，再从对应索引查组件。当前实现和运行时主题决定具体值。独立 Datapack Editor 的界面入口为 `tools/datapack-editor/ui/index.html` 和 `tools/datapack-editor/ui/styles.css`。

- [[ui-style/visual-languages/game-ui/profile|Game UI]] · Game、人物与服务、地图与战斗、剧情与通讯、星图。详见 [[ui-style/visual-languages/game-ui/patterns|工作区与叙事、地图与战斗、星图]]。
- [[ui-style/visual-languages/authoring/profile|Authoring]] · Story、StoryEntry、世界浏览器。详见 [[ui-style/visual-languages/authoring/patterns|Workbench、Explorer、Inspector、引用、身份卡、节点、Flag、试播]]。
- [[ui-style/visual-languages/content-tools/profile|Content Tools]] · 超级图鉴、Runtime 内容浏览器。详见 [[ui-style/visual-languages/content-tools/patterns|检索三栏、资料与 Draft 编辑]]。

## 常用入口

- [[ui-style/foundations|共享视觉基础]] 与 [[ui-style/patterns|共享组件与装配]] 记录颜色、字体、状态、Frame、控件和浮层。
- [[ai/guide/frontend-design-project-overlay]] 记录数据边界、刷新和施工要求。通用设计及视觉方向确认使用 `frontend-design` skill。
- [[story-chat-and-theme-presentation]]、[[ui-refresh-focus-scroll]] 记录主题投影和 DOM 更新机制。记录中的「已观察」指出实现现状。结构测试用于核对 DOM 合同，桌面视觉仍以实际运行观察为准。
- [[ai/plan/ui-visual-follow-ups|UI 视觉结构待处理清单]] 记录尚待评估的兼容与统一方向。
