# 游戏内创作工具视觉语言

**已采用。** 适用 Story、StoryEntry 与世界浏览器。目录用于定位对象，正文用于查看或编辑，检查器显示当前选择的属性。工具带承载跨对象或跨实例命令，正文底部留给当前内容的操作。阅读和编辑可沿用同一外壳并保留各自的文档状态。

- 沿用游戏的主题表面和控件状态。编辑器主题在进入时采样，会话内切换工作类型延续同一主题。可摆放多个候选时优先紧凑树行、分隔与清晰选中态；ID、Flag 和来源信息使用既有辅助排版。依据为 `src/ui/workspace/editor-workspace-appearance.ts`、`src/ui/css/editor-workspace.css`、`src/ui/css/editor-directory.css`。
- **已观察。** Classic 复用常规栏式布局。Advanced 增加工具带、实例条、工作类型栏、状态栏与分隔拖拽，允许双栏查阅和专注视图。可用视图由实际栏位决定，宽度与工具带布局由 `editorLayout` 持有。入口为 `src/ui/workspace/editor-workspace.ts`。

[[ui-style/visual-languages/authoring/patterns|创作模式]] · [[ui-style/00-index|返回索引]]
