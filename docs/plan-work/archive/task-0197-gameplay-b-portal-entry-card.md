# Task：本地工具台添加玩法 B 预研入口

状态：done — 三项并列入口与独立原型直达验收完成（2026-10-03）

## 目标

在 `http://localhost:5173/` 的本地工具台显示三张并列入口卡片：AC 游戏、Datapack Editor、玩法 B 预研。第三项直达独立运行的原型，不把其运行时代码接入 AC。

## 设计边界

- 保留当前“AronaClicker 游戏”和“Datapack Editor”两张卡片及其目标地址。
- 新增“玩法 B 预研”卡片，直达已核实的独立原型地址 `http://127.0.0.1:5173/`。
- 在桌面宽度下三张卡片同排等宽；窄窗口允许按断点换行。
- 明确非目标：AC 路由/模块接入、原型代码导入、编辑器入口移除、改动原型内容与启动配置。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `index.html` 是 `localhost:5173` 本地工具台，包含 `/game` 与 `/editor` 两张卡片 | 根目录 `index.html`、`http://localhost:5173/` HTTP 响应 | 保留两卡并扩展布局为三列 |
| 玩法 B 正由独立 Vite 进程绑定 `127.0.0.1:5173` 提供，未修改 AC 模块入口 | `prototypes/gameplay-b/package.json`、监听进程与 `http://127.0.0.1:5173/` HTTP 响应 | 第三张卡片直接打开该本机地址 |

## 施工切片

### Unit 0197-U1：新增独立原型入口卡片

#### Goal

在本地工具台添加等权重的玩法 B 预研入口，并保证现有 AC 游戏与 Editor 两项继续显示。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 页面 | `index.html`：`.portal`、`.cards` 与现有卡片 | 在现有视觉体系上增加一项并列入口 |
| 任务索引 | `docs/plan-work/00-index.md` | 维护当前 Task 入口与最终状态 |

#### Allowed Files

- `index.html`
- `docs/plan-work/task-0197-gameplay-b-portal-entry-card.md`
- `docs/plan-work/00-index.md`

#### Explicit Non-goals

- 不删除或改写 AC 游戏与 Editor 的目的地。
- 不在 AC 的 `src/` 中导入原型代码，也不改原型 package / Vite 配置。

#### Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的六项默认条件。

#### Completion Criteria

- [x] 桌面布局下有三张等宽并列卡片，窄窗口能正常换行。
- [x] 现有 `/game`、`/editor` 目标不变；玩法 B 卡片能打开独立原型地址。
- [x] 页面文案清晰说明玩法 B 是独立预研入口。

#### Execution Receipt 0197-U1

- **状态：**完成。
- **实际修改：**`index.html`。
- **结果：**工具台容器扩宽，桌面为三列等宽布局，900px 与 620px 断点分别切换为两列和单列；保留原 `/game`、`/editor`，新增“玩法 B 预研”卡片链接至 `http://127.0.0.1:5173/` 并以新标签打开。页面说明它使用独立原型服务。
- **验证：**在浏览器打开 `http://localhost:5173/`，1280×720 页面可见三张并列卡片；点击新卡片后浏览器打开 `http://127.0.0.1:5173/`，页面标题为“玩法 B · 游乐园巡查记录台”、首个节点正常显示。源文件核对确认 AC 游戏和 Editor 目标地址未变；只核验桌面展示与直达行为，没有执行多尺寸兼容矩阵。
- **未完成 / 问题 / 上游确认：**无。

#### Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 页面源码核对 | 检查 `index.html` 三个链接、布局和小屏规则 | 目的地址和三卡布局符合范围 |
| 浏览器核对 | 打开 `http://localhost:5173/` 并检查三卡，再打开玩法 B 卡片 | 工具台与独立原型均能加载 |
| 差异核对 | `git diff --check` | 无空白错误 |

## 当前核验（2026-10-03）

- 浏览器验收通过；断点设置已从页面源码确认。

## 剩余工作

- 本 Task 已完成；归档前文档索引终态核验见 `docs/plan-work/00-index.md`。

## 相关路由

- [[draft-0181-click-turn-location-gameplay-b]]
- [[docs/ai/PROJECT-CONSTITUTION]]
