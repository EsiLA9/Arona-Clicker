# Task：Stage 02.5-A：开发导航接入点与就绪契约调查

状态：待核验

Roadmap：[[ai/plan/task-0386-editor-workbench-roadmap]]

## 目标与验收

- 目标：对现有启动和导航链路作一次有界源码追踪，为后续协调器确定可观测的 readiness、公开委托和成功边界。
- 完成条件：列出启动步骤和实际可观察的 ready 信号；Story/Entry/World/Game 各自正式导航及保存门禁调用链；目标资源确认、样式加载、宿主挂载分别由什么事实证明可操作；current 所需实际状态分别由谁持有；请求可串行的边界。结果补入本页或 Task 0386，不新增重复机制报告。
- 前置：Task 0388 Stage 02 前置核对通过或确认未发现阻塞项。
- 边界：本 Task 只调查并冻结最薄导航合同，不为调查结果新增空接口。协调器实现归 Task 0389，URL/布局归 Task 0390，失败恢复与整体验证归 Task 0391。不建立 Router、RPC、延时ready或直接DOM导航。

## 当前依据与改动方案

- 当前依据：`src/ui/main.ts` 在 UIController.mount 后暴露 `window.__ui`、`window.__game`，但导航还需等待 runtime、包登记和默认内容准备；`src/ui/controller/controller.ts` 具有 `openStoryEditor()`、`openWorldBrowser()`、`closeEditorWorkspace()`；`workspace-router.ts` 区分 Story/World route。Story资源打开进入私有 browse 路径，World定位存在 `bindWorldBrowser()` 内。开工时逐项复核，不假定旧调用签名未变。
- 具体调整：沿 `main.ts` 启动状态、Controller 路由、Story browse、World tree locate、surface style loader 和 Workspace Host mount 点追踪实际调用；为每个目标记录“请求已接收/业务导航已提交/宿主可操作”三个时间边界，决定 ready/current 最小字段及并发策略。不得把所提字段当作源码现状。
- 衔接与验证：用源码符号与现有测试给出调用顺序、门禁入口和可观察完成信号；若当前没有可信的宿主 ready 事件，指出最小应扩展的业务公开委托及接收 Task 0389，不用固定延时补洞。本 Task 以可直接实施的调用序列和失败边界审查通过。

## 工作项

- [ ] 追踪启动、包数据可用、UI mount、导航、资源恢复、surface CSS 和栏位挂载信号。
- [ ] 记录 Story/Entry/World/Game 的正式入口、保存门禁、实际当前状态所有者和可操作完成条件。
- [ ] 给 Task 0389 提供最小 request/result、ready/current 和 busy/串行合同，不预设未核实的 API。

## 当前进展

- 已完成：原Stage 02.5综合Task按用户要求拆为独立CP；本Task专管导航协调和就绪语义。
- 正在进行：等待完整Task序列核验；未开始源码调查或代码施工。
- 下一步：核验通过后先读取当前启动与业务导航实现，再完成有符号引用的调用链及就绪矩阵。

## 结果与问题

- 验证结果：仅任务文档整理；未运行代码测试或浏览器验收。
- 发现问题：就绪信号与Provider公开委托需按当时源码确定，不以固定延时替代。
