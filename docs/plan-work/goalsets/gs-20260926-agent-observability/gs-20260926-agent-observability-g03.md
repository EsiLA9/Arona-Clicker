# G03：逻辑解释与因果轨迹

## 对最终目标的贡献

让 Agent 分清“现在怎么算”“当时实际执行了什么”和“为什么没有执行”，能定位到表达式节点、条件叶、监听资格或提交边界。

## 完成定义

- [ ] 首批支持生产 GameNum、ValueExpression、Condition 与 Trigger/领域 Watch 的受限查询，明确支持矩阵而非承诺全部 DSL。
- [ ] 当前解释给出原始输入/值、算子/比较符、单位与 scope、来源 Def/字段路径、贡献节点和 fallback；AND/OR 标注实际访问、短路未访问或额外诊断重算。
- [ ] 正常求值与解释使用同一语义，空组、空乘法、缺引用和非法值有对照测试；已知 GameNum 空 mul 差异先独立处理，再作为解释一致性门槛。
- [ ] 实际轨迹关联 operation、event dispatch 相位、parent cause、Registration key/token、匹配/once/条件拒绝、action/commit outcome；未记录的相位明确缺失。
- [ ] 能区分事件未发生、未注册、范围不符、旧 token 失效、条件不满足、已完成/once 抑制、提交失败；日志被截断时不把“没找到”认定为“没发生”。
- [ ] 解释与轨迹都不额外执行 effects、重发事件或消费随机；只读检查前后状态、cache/dirty、监听、随机调用计数和事件序列符合规定不变量。
- [ ] Trace 可按实体、资源、operation、frame、Registration 和因果子树切片；缓冲区有界、丢弃计数可见，关闭录制时不进行完整对象序列化。

## 依赖与边界

- 前置 Goal：G01、G04；先在受控场景中验证操作结果，再为选定逻辑路径补充解释与因果证据。
- 首批因果场景建议为 Spot 升级→产出失效、资源变化→Condition→Milestone、条件拒绝/once；扩充更多领域前逐项核对实际接线。
- EventBus 同步嵌套 emit 与 flush 入队语义保持不变；onAny 观察顺序不能冒充 dispatch 起始顺序或 parent-child 关系。
- GameNum 的节点贡献树不自动包含每条 Affector/TagEffect 来源；逐源贡献须在原算法路径采集或共享求值逻辑，不能另写近似计算器。
- 当前解释标记 recomputed；历史轨迹标记 observed。重算成功不能证明当时缓存值正确，也不能覆盖原观测结果。
- 本阶段暂缓：全函数追踪、任意 Funclet 重放、通用 Event Sourcing、改写 Trigger/Condition 机制、将 Registration 当持久领域事实。

## 会改变方案的未知项

- 产品/架构待裁定：诊断 sink 的窄接口与异常隔离、异步因果上下文传播、记录粒度和开销阈值。
- 本地源码待核对：各 Value/Funclet/外部 reader 的纯度、随机来源；mutation 原子边界与实际 EventBus派发嵌套；监听拒绝原因能否不改变求值次数地取得。
- 需测量代表规模下的关闭/摘要/详细录制成本；无实测前不承诺毫秒性能目标。

## 正式文档入口

- Draft：待建立。
- Task：待建立。
