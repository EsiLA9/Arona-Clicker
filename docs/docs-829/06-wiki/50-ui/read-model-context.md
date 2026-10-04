# 06-wiki/50-ui/read-model-context — 渲染查询上下文

> 本文回答：组件从哪里取得游戏数据，以及 UIContext 如何补充表现相关查询。

## 只读游戏视图

UI 组件读取 `GameReadModel`，由 `game.getView()` 提供面向界面的状态投影。`UIContext` 同时携带 `game`、当前 `world`、`view`、实体展示查询、格式化/转义工具，以及背景和表现查询。`src/ui/context.ts` 的 `createUIContext()` 将这些输入组装成组件渲染所需的上下文。

控制器在渲染或局部刷新时创建上下文，再传给 `render*` 组件。上下文暴露的视图是读取面；操作应走 `GameCommands`，不要把可变 Runtime 状态塞进展示组件。

## 表现宿主查询

`backgroundForHost(hostId, inheritGlobal, state)` 按宿主与状态解析背景层，可选择继承全局背景；active、inactive、disabled 等状态在缺少专属配置时有各自的回退行为。嵌套宿主可向父级解析配置。

`presentationHostState()` 同时返回宿主背景、合成后的墨色判断和文本颜色模式。颜色模式优先使用精确状态，再读 default 配置并向父宿主回溯；`auto` 在宿主有背景层时按合成背景计算深浅，无自有背景时保留语义色。

## 代码与测试

上下文定义见 `src/ui/context.ts`；读取协议见 `src/arona-clicker/contracts/`。`tests/ui/context.test.ts` 覆盖背景继承、宿主状态、父级回退、文字颜色和缺少背景时的语义色行为。
