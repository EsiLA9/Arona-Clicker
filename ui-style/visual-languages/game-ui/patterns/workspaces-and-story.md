# 游戏工作区、聊天与剧情呈现

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 游戏启动壳

应用样式就绪前沿用既有深色静态壳：左侧当前阶段、等待时间与可滚动的载入内容，右侧八步流程及步骤计数。首步耗时使用和诊断一致的等宽文本区，原位更新文本，沿用诊断复制按钮。阶段状态、正文与诊断通过文本和属性原位更新。步骤进度表示完成步数。颜色与系统字体沿用启动壳自身兜底。行为规则见 [[startup-and-runtime]]。

源码入口为 `src/ui/index.html`、`src/ui/main.ts`、`src/ui/startup/`。

## 经典 Game 内容栏

Game 固定装配区域导航、聊天/日志和设施/角色/强化/其他三组展示位置。AreaHero 最多呈现五条当前 Area 故事快捷入口，沿用区域地图按钮状态样式，完整故事列表仍在 Area Workspace。内容工厂不决定栏位。默认页签、资源条显隐、导航和动作由 Game 装配指定。

源码入口为 `src/ui/columns/index.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/css/area-map.css`。

## 区域 Workspace

独立路由携带 Area ID。左栏复用正式区域导航栏，中栏显示区域概览与可滚动的待接取 ActiveStoryEntry 列表，右栏显示区域详情占位。主题 panel surface 与宿主圆角沿用 WorkspaceFrame。点击接取经 GameCommands 启动，成功后返回一般 Game chat 并切到 Entry owner。当前 Area 改变时退出旧 Area 路由。行为覆盖见 `tests/ui/workspace/workspace-lifecycle.test.ts`。

源码入口为 `src/ui/components/world/area-workspace.ts`、`src/ui/workspace/workspace-router.ts`。`createAreaNavigationColumn()` 位于 `src/ui/columns/index.ts`。

## 通讯录角色页培养

通讯录角色页的简易培养沿用 `.char-stats` 与 `.primary-button`，`character-cultivation.ts` 以独立section承载等级/好感经验、消耗与反馈。普通训练、交流和突破通过Controller命令后按字段补文字与disabled，不替换培养按钮、角色页、联系人行或滚动宿主。范围缺失时只恢复右栏。证明入口为 `tests/ui/character/character-cultivation.test.ts`。不增加独立配色或字体。

## 羁绊与地点续播

正式羁绊调用与地点续播复用 `story.ts` 的 `.kizuna-card / .yuzu-kizuna-*` 爱心卡片，标题来自关联 Entry / Story，目的地来自 Area。赴约或等待态没有可提交 token，避免远程开播。正式子结束停在最终场景，恢复该场景原有合法 `.send-button` / Choice，不另设召回按钮。结果已回到当前父空间时使用普通“继续故事”Click。沿用原聊天滚动宿主和区域刷新，不新增页面或卡片皮肤。行为验证见 `tests/ui/story/story-space-history.test.ts`、`story-continuation.test.ts`。尚。

## 已提交的 Choice

运行态已提交的 Choice 复用 `story.ts` 的 Choice 卡片和现有 disabled 样式，保留全部选项，所选项显示“已选择”。历史卡片的 `.chat-current` 根以 Runtime 输出 ID 对应的流实例 key 协调。下一组 Choice 保持独立的当前输入。更新沿用聊天区域刷新与滚动恢复，不新增滚动宿主、定时器或整页刷新。行为验证见 `tests/ui/story/story-consecutive-choice.test.ts`，保存归属见 [[story-chat-and-theme-presentation]]。

## 对话流的复用边界

`renderChatEntry()` 是 Chat、Conversation 与作者预览共用的条目外观。运行态 `.chat-stream` 管理正文滚动，发送按钮留在流外。按 FlowScroll 实例区分全局聊天与角色对话，Story 的导航面包屑和遮罩另有宿主。源码见 `src/ui/components/story/story.ts`、`src/ui/flow/flow-scroll.ts`、`src/ui/css/chat.css`、`src/ui/css/conversation.css`、`src/ui/css/story-nav.css`、`src/ui/css/story-overlays.css`。

## 游戏内收藏图鉴

收藏弹窗分区使用主题卡片网格。复用 `src/ui/components/inventory/collection-modal.ts` 和懒加载的 `src/ui/css/codex.css`。超级图鉴的三栏模式见 [[ui-style/visual-languages/content-tools/patterns|检索工具]]。

## 剧情推进与 Operation 反馈

Talklet 后紧邻可用 Click 时自动衔接输入，否则送达后提供自由继续。连续 Click 逐个呈现。Runtime Operation 的可读状态效果按声明顺序以独立奖励条目加入聊天流。效果逐条显示期间，底部用橙色处理中状态短暂禁用推进，播完后自动衔接后续节点。标记与 Extra 控制状态不播报，Operation 不伪造聊天台词。

界面入口见 `src/ui/components/story/story.ts`、`src/ui/columns/chat-content.ts`，机制见 [[story-chat-and-theme-presentation]]。
