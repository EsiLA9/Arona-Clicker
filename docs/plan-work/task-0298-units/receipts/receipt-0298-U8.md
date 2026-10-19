# Receipt 0298-U8

- 状态：单位基础完成。新增独立修改目标按钮、编辑锁定、点击 / Enter 确认、6px 拖拽阈值、纯展示副本、最上层元素命中与合法吸附反馈；同一 adapter 调用现有 prepared / actorless 草稿目标命令，不调用 Commit。
- 验证：10 项交互测试覆盖优先级、合法点击、键盘、版本变化、Pointer 阈值 / 释放 / cancel、无效目标与尾随 click；类型检查通过。真实 Runtime 跨栏测试与浏览器证据见 U9。
- 审查：副本 aria-hidden、tabIndex -1、pointer-events:none，不注册领域卡身份；失效 / 取消清除副本及捕获。编辑来源由同一临时交互状态提供，不建立线条状态或 SVG。
- 边界：当前仅单位目标；需要多个合法候选且 Owner 开放选择。尚无真实卡牌目标，不假装支持。
