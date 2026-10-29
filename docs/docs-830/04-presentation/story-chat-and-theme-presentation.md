# docs-830/04-presentation/story-chat-and-theme-presentation — 剧情聊天与主题表现

本文回答：Story 查询如何变成聊天流，以及运行时主题如何投影到 UI 宿主。

聊天栏的独立装配接口见 [[workspace-columns-and-layout]]。多个显示共享业务 ChatStream 的送达与自动推进，不各自创建剧情推进器；点击命令从所在窗格的显式 owner 绑定取目标，显示滚动则按实例隔离。全局流的自动推进回执固定投递到全局历史，不随当前学生选择改变目标。

## Story 到聊天条目

Controller 获取全局 StoryView 或指定对话 owner 的 StoryView；`ChatStream` 将当前 Talklet 同步到对应聊天流，并以 Entry、StoryDef、页码组成的指纹去重。全局聊天和学生对话空间使用不同 stream key，彼此不串页。`ChatStream` 负责送达 token、typing/pause/thinking 门控、自动连发和开幕标题等呈现节奏；推进命令仍回到 Controller / Runtime 的 Story 命令入口。

```text
StoryView → ChatStream 按流同步当前页 → ChatEntry / FlowEntry
         → Story renderer 转义并输出语义 DOM → FlowScroll 管理滚动
```

聊天条目由 `src/ui/components/story/story.ts` 的 renderer 输出，Map 信息流也复用 Flow 条目能力。渲染器负责转义文本、呈现图片/头像/选项等类型；任意 HTML 和内联脚本不是内容接口。输入 token 是业务推进的一部分，动画完成本身不会推进 Story。

## 主题与 Presentation 投影

`controller-theme.ts` 从 ColorSystem 的当前运行时主题解析 tokens、背景定义和 Presentation 定义。`buildBackgroundView()` 解析背景资源；`buildPresentationView()` 将宿主、状态、图层、组件和资源校验为只读视图；`createUIContext()` 将这些视图提供给组件。组件使用稳定 `hostId`、`themeScope` 查询适用背景、形状、装饰和文字颜色。

玩家主题选择、Area 主题、学生主题与剧情临时表现属于不同投影来源。常规游戏页依据当前选择生成运行时主题；学生对话或主题演出可暂时替换投影，结束后恢复原选择。主题改变通常刷新根级 CSS variables 与受影响宿主；单个实体表现变化可定向刷新该实体，而不默认重建整页。

Theme 内容编辑与玩家主题选择是两条写入路径。`ThemeContentEditorService` 以正在编辑的数据包为 owner，按稳定 ID/字段路径编辑 ThemeDef，提供运行时预览和冲突检测，提交回编辑包，不写玩家存档或自动应用整个包。`UserThemeService` 管理玩家自己的主题草稿/保存数据；`UserThemeLayerService` 再把已保存主题投影成运行时表现层。ColorSystem 负责把这些选择与临时主题层解析成当前 UI 可查询的主题。

| 表现来源 | 保存/归属 | 投影与清理 |
| --- | --- | --- |
| 玩家 ColorGroup / ThemeDesign 选择 | `PlayerState.activeTheme` 与主题槽 | ColorSystem 合成当前游戏主题 |
| 玩家自定义主题 | `userTheme` / `customThemes` | UserThemeLayerService 转成可组合的运行时图层 |
| Story / Area / Init 主题效果 | 带 owner 与生命周期的临时层 | 生命周期事件结束时由 RuntimeEffectReactor 清理 |
| Entity Presentation 覆盖 | 按实体 key、owner、lifetime 保存 | EntityPresentationService 查询并按 Story / Area / Init 清理 |

### 例子：预览与保存一份主题

`tests/engine/theme-content-editor-service.test.ts` 中，作者在 editing Pack 打开一个 ThemeDesign，把背景色改为 `#e9f1fb` 后调用 `preview()`；运行时主题暂时显示该颜色。调用 `save()` 后，定义写回目标 editing Pack，预览层清理，运行时主题恢复此前的投影。若同一个包在会话打开后被其他操作改变，保存返回 `content-conflict`，避免覆盖新内容；这不等于数据包已经应用到当前游戏。

玩家自定义主题使用另一套会话：`UserThemeService.beginEdit()` 记下用户主题 revision；一个会话成功保存后，基于旧 revision 的另一会话会得到 `revision-conflict`，须重新载入。`tests/engine/user-theme-service.test.ts` 验证保存更新全局玩家主题状态和冲突处理。检查页面未恢复时，再看 `tests/ui/controller-theme-cleanup.test.ts` 中的界面清理路径，而不是只检查包内 ThemeDef。

源码入口：`src/ui/presentation/chat-stream.ts`、`src/ui/components/story/story.ts`、`src/ui/flow/flow-entry.ts`、`src/ui/controller/controller-theme.ts`、`src/ui/presentation/background-service.ts`、`presentation-service.ts`、`theme-cascade-service.ts`、`src/ui/runtime/context.ts`。

相关测试见 `tests/ui/story-node-delivery.test.ts`、`story-node-input.test.ts`、`presentation-service.test.ts`、`controller-theme-cleanup.test.ts`、`tests/engine/entity-presentation-service.test.ts`。Story 推进机制见 [[story-and-effects]]；刷新语义见 [[ui-refresh-focus-scroll]]。

## 例子：在聊天中阅读剧情

当 StoryView 的当前页变化时，ChatStream 为对应 stream 同步条目；全局流与角色对话流使用不同 key。呈现可能等待输入 token、typing 或 pause，但是否推进剧情由 Story 命令和领域状态决定。调查页面重复送达时，检查条目指纹和 stream key；调查剧情没有推进时，继续检查 token 和命令，不应只检查动画。

有新内容时是否自动滚到末尾由滚动恢复策略决定：原本贴底且允许跟随时才跟随；普通聊天上翻时按比例恢复，Map 信息流使用锚点模式。其刷新前后入口见 [[ui-refresh-focus-scroll]]。
