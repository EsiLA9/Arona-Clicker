# 0320-U14：additionalTarget Workspace 屏幕验收需求单

状态：已尝试宽屏本地浏览器路径，但当前正式内容没有可触发新按钮的 Action，故未能完成视觉/交互验收。本单记录已检查内容和可复验结果；DOM 自动化通过不等于屏幕验收通过。

## 验收范围

在真实 Map Workspace 中确认 Party Prepared Action 与 Ability 的额外目标按钮组可见、可操作；选择额外目标后保留 primary 选择，Preview 显示等待/已选择状态，提交后由 AG-1 Receipt 反映同一目标身份。当前范围不要求移动端或键盘交互。

## 已执行路径

1. 使用本地运行中的 UI 打开 `http://localhost:5173/src/ui/index.html`，进入夏莱办公室。
2. 打开 Map Terminal 并核对当前可进入的 Map 列表；包括现场调查、极简战斗、卡牌协同、废弃区域、分叉调查、连续调查、自主目标及效果/状态示例等入口。
3. 检索当前 `src/arona-clicker/content/**` 中的 Map Action 定义。没有 Action 声明 `additionalTarget`，因此进入这些 Encounter 后 Workspace 不会渲染 U14 secondary target picker。

## 当前结果

- 自动化：通过。U14a/b/c/d 合计定向测试 433/433；类型、架构、文档与差异检查通过。
- 浏览器可用性：已确认本地游戏能进入办公室并显示 Map 入口。
- U14 目标 UI 实屏验收：未能验证；不存在能触发按钮组的正式 Map Action/样例，未将测试 DOM 夹具冒充真实内容。
- 屏幕验收状态：未通过/未能验证，不代表功能失败，也不代表人工验收通过。

## 后续复验准备

本地试玩台现在已有严格 `startMap <mapId>` 快速入口，可跳过手动解锁 Spot/打开入口页；命令只启动已加载 Map，并拒绝替换进行中的 MapRun。该命令不新增 U14 内容。要验证 U14 按钮本身，仍需提供声明 `additionalTarget` 的可进入示例 Map/Action；准备好示例后按上方范围重新验收并记录截图与操作结果。
