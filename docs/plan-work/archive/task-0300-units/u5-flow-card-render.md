# Unit 0300-U5：Flow 只读卡面渲染

状态：completed — 2026-10-19。

## Goal

通过现有 `renderFlowEntry → renderChatEntry` 接入一个小卡面 helper；Flow 卡只读、可查看、可作为合法目标命中，不提供编辑或换牌入口。

## Read Set

- `src/ui/components/story.ts` 的 `renderChatEntry` / `entryAttributes`
- `src/ui/cards/card-host.ts`
- `src/ui/css/map-workspace.css`
- `tests/ui/components/chat-text.test.ts`

## Allowed Files

- `src/ui/cards/card-face.ts`（新增）
- `src/ui/components/story.ts`
- `src/ui/css/map-workspace.css`
- `tests/ui/components/chat-text.test.ts`

## Confirmed Facts

- 共享分派器已处理 talk / map / narration / system / reward / typing。
- 卡面需要 `data-flow-entry-key` 与本 Unit 的卡牌绑定属性共同存在。
- 主题与卡面外框应复用现有 CSS 变量，不借本 Unit 改版。

## Scope

- 新增 `renderCardFace`：受控文本、已有绑定属性、可选 tabIndex。
- `renderChatEntry` 在 `mapCards` 存在时优先渲染只读卡面组。
- 卡面输出 `usage=live`、Object Key、可选 Relation Key、`inspect target`。
- 增加 Flow 卡面 CSS，复用现有主题色与面板变量。

## Explicit Non-goals

- 不把 Map、Flow、Popover 的卡面强制统一成同一 DOM。
- 不新增 HTML 插槽、线层或拖拽算法。
- 不改变普通 Talklet / Map 概览 / 回执样式。

## Completion Criteria

- `mapCards` 条目渲染卡面与绑定；普通 Talklet 输出不变。
- Flow 卡面没有 `editTarget` / `replace` 入口。
- 卡面文本全部转义，无任意 HTML。

## Stop Conditions

- 需要引入新视觉系统或重做 Flow 宿主时停止。
- 需要放宽 marks 白名单以输出卡牌绑定时停止。

## Verification

- `chat-text.test.ts` 23 项通过。
