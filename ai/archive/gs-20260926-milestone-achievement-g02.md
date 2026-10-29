# G02：完整的目标引入与组合语义

## 对最终目标的贡献

手写数据包作者能声明 Area、Init、全局归属及附加引入条件，并以成就前置关系组织逐步出现的目标。Milestone 保持隐藏，Achievement 保持玩家可见。

## 完成定义

- [ ] Area 首访、Init 进入或全局资格提供基本门槛；作者的额外条件与基本门槛同时满足，不能绕过 Area 首访。多个前置 Achievement 全部完成才引入后继目标。
- [ ] 作者可在条件能力支持下选当前持有或已有统计接口的累计资源／收集品；简单数值显示“当前／目标”，组合条件显示各条件状态，不强算百分比。
- [ ] Listener 首次完成时自动执行当前真正可执行的任意 Effect；先记 completed，失败记错误且不自动补发。已完成目标在定义更新后不补发新效果。
- [ ] 已发现 Achievement 在定义仍存在时保持可见；非当前 Init 的监听撤出，返回时按持久事实重建和追赶。

## 依赖与边界

- 前置 Goal：G01 的可玩链路。
- 本阶段暂缓：Runtime Editor 创作、成就自身奖励或领取、重复完成、按 Init 分割完成历史、Roadmap 与通用剧情等待包装。

## 会改变方案的未知项

- 架构待裁定：Listener 字段如何引用 Milestone 并保持一份目标条件和 completed 身份；G01 的 Area 发现可由到访事实派生，G02 的附加条件与前置关系是否需要独立持久引入事实再按玩法语义裁定。
- 本地源码待核对：Init／全局统计读取和唤醒覆盖、多个前置完成后的重算入口、Effect 中预留与声明类操作的作者诊断。

## 正式文档入口

- 历史语义：[[draft-0152-milestone-listener-and-achievement-packaging]]
- 能力审计：[[task-0153-milestone-listener-admission-and-reactive-coverage-audit]]
- 新 Draft / Task：待建立
