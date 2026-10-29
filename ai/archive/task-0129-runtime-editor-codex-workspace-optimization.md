# Task：RuntimeEditor 超级图鉴工作区与增量刷新优化

状态：done — 🟢 已完成独立工作区、折叠粘性筛选和局部 DOM 刷新

## 1. 目标

在 `task-0128-runtime-editor-loaded-content-codex` 已完成的只读能力之上，解决超级图鉴被普通编辑器窄浮层限制、类型筛选遮挡条目滚动区，以及选择交互导致全幅面板重建的问题。

## 2. 方案与边界

- 仅为 `codex` surface 使用跨工作区布局，普通 RuntimeEditor 表单和内容浏览器保持原有浮层行为。
- 图鉴中栏改为独立滚动容器；类型筛选默认折叠，并以 sticky 条带跟随中栏滚动。
- 图鉴动作采用事件委托；查询、筛选、选择和详情页签只替换中栏或详情栏，不重建外层工作区。
- 保留“只能访问当前 Runtime 已加载有效内容”的数据边界，不新增加载、编辑、Apply 或状态写入能力。

## 3. 验收

- `npx tsc --noEmit`
- `npx vitest run tests/ui/runtime-editor-codex-shell.test.ts tests/ui/runtime-editor-codex-integration.test.ts --silent --reporter=dot`
- 回归覆盖：工作区节点身份保持、局部面板替换、筛选折叠状态保留、sticky CSS 契约、ARIA 与窄屏栏位切换。

最终核验：`npx vitest run --silent --reporter=dot` 通过（187 个测试文件、1697 个测试）；`npm run check:architecture`、`npm run check:docs`、`npm run build` 均通过。构建仅保留既有大 chunk warning，无新增错误。
