# Unit 0300-U9：地点卡片面与选择呈现

状态：completed — 2026-10-19（后续按 P6 修订为 Talklet 固定尺寸卡牌落点）。

## Goal

将地点候选渲染为可访问的固定尺寸卡片，附着在标准 Talklet 提供的单一卡牌落点内。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0300-gameplay-b-reusable-card-interaction.md` P6 | 地点卡片的交互和只读边界 |
| 文档 | `ui-style/patterns.md` 的 Map Workspace / Flow | 沿用现有三栏与流内卡面模式 |
| 源码 | `src/ui/components/story.ts:renderChatEntry`, `renderMapCards` | Flow 类型分派与共用卡面 |
| 源码 | `src/ui/cards/card-face.ts`, `src/ui/cards/card-host.ts` | 复用卡面组合与实例绑定 |
| 样式 | `src/ui/css/map-workspace.css` | 现有地点与卡面视觉规则 |
| 测试 | `tests/ui/map-location-card-render.test.ts` | 类型化地点卡片面与确认入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 约 10k–20k token |
| 文档 Read Set | 2 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k token 时拆分或交回上游 |

## Optional Read Set

- 无

## Do Not Read by Default

- `docs/plan-work/archive/**`
- 角色卡、战斗目标的 Owner 机制

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Flow 当前玩法牌通过类型化 DTO、`renderCardFace` 与 Card Host 属性渲染。 | `src/ui/components/story.ts:renderMapCards` | 地点卡沿用绑定和卡面，但保持独立 DTO |
| 卡面已有统一标题、说明、状态、聚焦样式。 | `src/ui/cards/card-face.ts`, `src/ui/css/map-workspace.css` | 不另造通用布局系统 |
| 通用 Flow marks 不能发放卡牌身份或入口。 | `src/ui/components/story.ts:markAttributes`, `src/ui/cards/card-host.ts:isReservedCardMark` | 地点身份由类型化 renderer 写入 |

## Constraints

- 服从 Task P6；选中态由 U10 的现有交互服务协调。
- 地点卡是地图节点对象，不进入 `FlowMapCard` 的 Encounter 语义。
- 卡片只负责选择；地点提交由 Map Workspace 统一 Click 入口处理。
- 落点读取静态对齐与间距配置；卡片保持 82×58，并按稳定实例身份获得稳定角度。
- 卡片支持键盘焦点和 radio 语义，锁定候选不可选。

## Allowed Files

- `src/ui/components/story.ts`
- `src/ui/css/map-workspace.css`
- `tests/ui/map-location-card-render.test.ts`（新增）
- `ui-style/patterns.md`

## Explicit Non-goals

- 不维护待选地点状态，不发移动命令。
- 不改 Map View、地点条件或战斗 Commit。
- 不改现有 Map / Flow 布局框架和滚动所有权。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。特别是：若渲染需要任意 HTML marks 或新的长期状态，停止并上交。

## Completion Criteria

- [x] Flow 地点候选作为固定尺寸卡牌附着，保留稳定 Object Key 与各自 Instance Key。
- [x] 当前候选有清晰 hover / focus / selected / locked 样式；交互属性由类型化 payload 生成。
- [x] Talklet 使用标准气泡结构；其中只增加一个承载卡牌的落点，不另造地点面板。
- [x] 落点配置左右对齐与间距，卡片角度由稳定实例身份派生。
- [x] 普通 Talklet、概览、历史消息仍走原渲染路径。
- [x] `ui-style/patterns.md` 记录新地点选择卡模式。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `node node_modules/vitest/vitest.mjs run tests/ui/map-location-card-render.test.ts` | 通过 |
| 差异检查 | `git diff --check` | 无空白错误 |
