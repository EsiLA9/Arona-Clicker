# 对象身份、关系条目与内容卡片

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 概述身份字段

概述的 Story ID 复用 `.story-editor-readonly` 与主题表面，当前值旁提供“更改 ID”。不重复显示相同来源 ID，只有来源与当前值不同时显示同样式的“原 Story ID”。身份字段使用分组而非无关联控件的 label。入口为 `view.ts`、`.story-editor-identity-field`。三种来源状态由 `tests/ui/story/story-editor-identity.test.ts` 核验。

## 新建与更改文档 ID

Story 文档新建 / 改 ID 沿用 ModalManager、story-editor-property 与 mini-action：每次新建必须确认编辑态 Mod，改名限定同 Mod 并在弹窗内列出引用影响。输入只更新弹窗预览，确认沿既有 Story 编辑区域协调。草稿身份、选中节点、输入缓存与 Flag 页保持，身份相关导航键随之更新。无编辑态 Mod、目标过期、重名、跨包引用及存储失败显示原地错误。取消不创建 / 改名。入口 `story-editor/controller.ts`、`identity.ts`、`view.ts`，验证见 `tests/ui/story/story-editor-identity.test.ts`。

更改 Story ID 弹窗只允许修改名称部分，ModId 在创建后固定并以只读字段显示。“保存到编辑副本”只列出同一 Mod 的可用目标。入口为 `controller.ts` 的 `changeStoryId`，跨 Mod 请求仍由身份规划校验拒绝。

## 关系条目与调用分组

关系页的调用、被调用与关联 Entry 通过 `renderStoryEditorTarget()` 使用 `.story-identity-card.story-editor-target-card.story-editor-relation-item`。条目沿用目标渐变和圆角，卡片宽 100%，内边距 6px 8px，标题 14px，ID 11px，说明 12px，图标 24px。名称、完整 ID、调用说明分行显示，长 ID 自动折行。关联 Entry 的新增按钮与组标题同行。条目保留原 target / key，整条可跳转，缺失目标禁用。右栏继续使用原滚动宿主，不增设关系表内滚动。入口为 `relations-view.ts`、`authoring-view.ts` 和 `story-editor.css`。导航与原位更新由 `tests/ui/story/story-editor-authoring.test.ts` 验证。

Story／Entry 调用关系的列表容器是 `.story-editor-list`，条目沿用上述身份卡，在既有属性栏内以「调用表 / 潜在调用集」及「被调用表」分区，不新增滚动宿主。每项显示对象类型、名称、ID 和调用来源。缺失目标禁用。`relations-view.ts` 使用原有 Story / Entry 目标按钮属性与浏览历史，`patchEditorDOM` 按目标和调用位置 key 协调关系行，保留三栏、输入焦点与滚动容器。机制见 [[runtime-editor-and-project-checks]]，行为证据见 `tests/ui/story/story-editor-relations-model.test.ts`、`tests/ui/story/story-editor-authoring.test.ts`。

Story 关系页的「剧情包」默认折叠，汇总直接起始及经 Story 转移可达的 Entry，复用关系条目与跳转。详情展开状态在当前 Story 的局部刷新中保留。入口归属与 Flag 分析共用 `relations-model.ts` 的 Story 转移查询，跨 Entry 请求沿用独立的调用与 Flag 信息获取规则。

## Story／StoryEntry 身份卡与渐变编辑

Story 与 StoryEntry 分别用已有书本和场记板 SVG，Active 和 Passive Entry 的板角分别附有 A 与 P。Init、Area、Spot 分别用蓝色地球、绿色山峰与暖橙色小屋。图形由 `components/shared/editor-entity-icon.ts` 提供，工作区目录、实例 Logo 和身份卡共用；卡片图标以渐变选出的可读前景为主要颜色，再混入类型色。剧情流、调用关系和关联入口复用 `story-editor/target-view.ts`，以方正兰亭圆标题、DM Mono ID 和右上角图标识别内容。流内卡片随文字排版，右栏可补充类型与关系，缺失目标显示灰色禁用卡。左栏目录和内容概览复用图标与标题字体，保留单行排列。Story 的「概述」和 StoryEntry 的「基本信息」可编辑自身卡片的渐变，弹窗与已挂载的同目标卡片同步预览，确认后写入草稿 `cardGradient`。恢复自动配色会移除该字段。自动色按类型与 ID 分配。`storyCardStyle()` 选择渐变上的可读前景。两端难以使用同一前景时，补充对比遮罩。卡片内容与样式由 `components/story/story-identity.ts` 和 `css/story-nav.css` 提供。`story-editor/card-gradient-dialog.ts` 使用两个并排色值控件预览端点。

## 起始场景与移动卡片

Story 编辑器的移动场景预览复用 `.area-hero` 与 `.story-editor-scene-card`：移动到 Area 显示「前往区域名」，按目标 Area 声明主题构建局部 ThemeTree 渐变。移动到通讯录显示「前往角色名的通讯录」，取角色对话主题 / 默认色组主色绘制单色面并用 `readableOnColor` 确定字色。未配置与缺失目标保留文字占位。首个插入点之前的起始场景使用相同外观，显示「起始于……」并打开 Story 属性。它不属于 StoryNode，不参与拖动、排序或序列化。入口为 `story-editor/scene-view.ts`、`view.ts`。节点和起始占位沿稳定 key 更新，保留现有 flow 与滚动宿主，局部更新仍走编辑器 region。自动化证据为 `tests/ui/story/story-editor-scene.test.ts` 与 workspace 用例。

## 剧情入口卡与 Transfer 动作行

Click 剧情入口卡和 insert / goto 转移共用右侧目标卡与 Story / Entry 浏览历史。Transfer 主体沿用虚线动作行，行首的直行箭头表示跳转，回程箭头表示插入后返回。英文动词用本机 Forgotten Futurist 斜体，中文保留界面字体。点击主体可查看节点属性。右栏平铺转移方式与目标选择器，切换方式沿用已选目标，选定后显示可直接打开的目标卡。Button 完成后进入后续独立节点。复用入口为 `story-editor/target-view.ts`、`transfer-view.ts`、`view.ts` 与 `story-editor.css`，行为见 `tests/ui/story/story-editor-workspace.test.ts`。
