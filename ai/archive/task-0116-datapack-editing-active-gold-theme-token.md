# Task：数据包编辑中金色活动态主题变量修复

状态：done — 2026-09-19 实现、自动化核验与浏览器验收完成，待归档

## 来源与问题

进入某个 Mod 的编辑态后，编辑态按钮已经正确带有 `is-editing-target`，但视觉上没有变为金色。检查发现数据包界面 CSS 使用了未被主题系统注册的 `--gold` 变量，导致边框、文字、背景和外圈声明失效；同时通用 `.toolbar-button:hover` 的选择器优先级会在鼠标停留时覆盖活动态颜色。

## 目标

1. 使用主题系统已有的 warning/orange 语义表达数据包界面的金色状态。
2. 进入编辑态后，即使鼠标仍停留在按钮上，`is-editing-target` 也保持金色。
3. 清除数据包界面对未定义 `--gold` 的依赖，不改变编辑态目标识别和生命周期。

## 施工切片

### P0：主题变量与 hover 覆盖

- [x] 将数据包相关 CSS 的 `var(--gold)` 替换为 `var(--theme-node-warning, var(--orange))`。
- [x] 为编辑中按钮补充 hover 同态规则，保证通用 toolbar hover 不覆盖金色活动态。

### P1：回归核验

- [x] 增加 CSS 语义契约测试，禁止再次引入未定义的 `--gold`。
- [x] 验证编辑态首次选择、进入编辑、鼠标停留和关闭面板的状态表现。
- [x] 完成类型检查、定向测试、构建、架构检查、文档检查和浏览器验收。

## 最终核验（2026-09-19）

- 定向 Vitest：数据包工作区、顶栏与设置工作区、Runtime Editor 持久化、Pane 排序与状态，46/46 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过；仅保留既有大 chunk 警告。
- `npm run check:architecture` 通过。
- `npm run check:docs` 通过。
- 浏览器验收通过：编辑态进入后保留 `is-editing-target`，按钮标题包含“编辑中”；主题颜色改用已注册 warning/orange 节点，hover 规则不会覆盖活动态。

## 非目标

- 不改变 `is-editing-target` 的生成条件。
- 不改变普通态 / 编辑态选择、Apply 或编辑器持久化行为。
- 不新增全局 `--gold` 变量或独立主题色体系。

## 相关路由

[[task-0115-datapack-editing-active-gold-state]]
[[docs/docs-828/02-modules/ui]]
[[docs/docs-828/05-conventions/testing]]
