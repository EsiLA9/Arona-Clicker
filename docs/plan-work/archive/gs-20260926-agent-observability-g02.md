# G02：DOM/theme 最终渲染切片（暂缓）

## 对最终目标的贡献

在浏览器连接稳定后，让 Agent 回答“操作后最终应用了什么 theme、应该出现的内容是否及时渲染、是否丢失或残留”，并将最终 DOM 内容切片与 theme 来源关联起来。当前因 ChatGPT Desktop 浏览器连接不稳定，暂缓实施与验收。

## 完成定义

- [ ] 从一次操作或转场身份定位最终 route/surface、theme 与目标内容切片；实际 DOM 是最终内容证据，静态定义和 View 不得冒充已渲染结果。
- [ ] 目标切片能报告预期内容、实际存在内容、缺失/多出/旧内容残留，并注明采集时的 surface/generation 与完整性。
- [ ] 至少覆盖一次复杂 theme/工作区转场，验收切换及时性以及旧/新内容集合；无法建立操作关联时显式标注 unlinked。
- [ ] UI前后差异区分值变更、节点替换、内容增删和映射缺失；不以 HTML 文本相等证明同一 DOM 节点被保留。
- [ ] computed style、截图、#app 外浮层、焦点/滚动连续性作为后续增强；首个可交付切片不要求视觉回归平台。

## 依赖与边界

- 前置 Goal：G01；执行与验收还要求 ChatGPT Desktop 的浏览器连接稳定，未满足前保持暂缓状态。
- 复用 Workspace metadata、UIHostRegistry、refresh stats/observations；只为真实语义或定位需要补稳定标记，不增加装饰 wrapper 或平行组件树。
- 静态 callgraph 仅给源码调查候选；弱边保留置信说明，不能记为真实执行链。
- 此阶段提供浏览器采集所需映射；最终 DOM/theme 切片未通过真实浏览器连接验收前，不宣称最终界面符合预期。截图基线及自动验收由 G05 收口。
- 本阶段暂缓：直接修复主题转场问题、主题机制重设计、所有 UI 控件接入 Host、全站无障碍审计。

## 会改变方案的未知项

- 产品/架构待裁定：实体/Host 到实际 DOM 的稳定身份协议；缺映射时是否仅返回有限父链而不自动遍历全页。
- 本地源码待核对：theme layer → resolved presentation → body/#app/host DOM 的不同应用入口；连接稳定后验证操作完成与 DOM/theme 采集的时序边界。
- 布局与截图依赖真实浏览器、字体和图片加载；headless DOM 结果不证明像素正确。性能耗时需注明 measured/unsupported，不能由刷新计数推算。

## 正式文档入口

- Draft：待建立。
- Task：暂缓建立；恢复条件为浏览器连接可稳定执行目标转场及读取结果。
- 关联调查：[[task-0158-ui-theme-workspace-transition-refresh-audit]]，现象仍待复现。
