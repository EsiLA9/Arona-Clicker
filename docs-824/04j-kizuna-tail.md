# docs-824 — 04j 羁绊剧情小尾巴（聊天-剧情回环）==规划==

> 状态：**规划文档（未实现）**。玩法需求：在通讯录/聊天空间内，进入羁绊剧情并完成后，一般该次聊天**还有个小尾巴**——离开羁绊剧情回到聊天，把尾巴聊完，才彻底结束该次小聊天。
> 现状锚点：kizuna 入口卡片（`Talklet.kizuna` / `showChatText kind='kizuna'`，见 [[docs-824/03f-declarative-dsl]]）、角色沙盒剧情游标（`startCardStory`，owner=VariantId）、`storyCompleted` 事件。

## 玩法需求（验收口径）

1. 聊天中触发**羁绊剧情入口**（kizuna 卡片）→ 进入剧情演出。
2. 剧情完成后**回到该角色的对话空间**，自动追加**尾巴内容**（收尾段聊天）。
3. 尾巴聊完 → 该次小聊天才标记彻底结束（已读/结算）。
4. 未完成剧情前中断 → 该次聊天未结束，可重新从卡片进入。

## 消息分段模型

一条含羁绊的聊天消息 = **前置段**（现有 content）+ **kizuna 卡片**（现有机制）+ **尾巴段**（新增）：

```ts
// src/engine/types/character.ts
export interface ChatMessageDef {
  // ...现有字段 + 04i 的 repeatable/affectionRequired/affectionExpReward
  /**
   * 羁绊收尾段：关联 kizuna 卡片的消息在剧情完成后于对话空间追加展示的 Talklet 序列。
   * 缺省 = 无尾巴（剧情完成即结束）。@label 羁绊尾巴
   */
  kizunaTail?: Talklet[];
}
```

- 尾巴复用标准 Talklet 渲染（speaker / avatar / kind / side 等），与前置段同款式。
- 配了 `kizunaTail` 的消息，其 kizuna 卡片的 `targetStoryId` 即该消息的关联剧情（现有 `ChatTextEffectValue.targetStoryId` / `Talklet.kizuna.storyId`）。

## 流程状态机（运行时）

```text
[展示] 聊天消息（前置段 + kizuna 卡片）
   │ 玩家点击卡片
   ▼
[剧情] startCardStory(storyId, owner=variantId)
   │    记 pendingKizunaTail = { chatMessageId, variantId }   ← 运行时状态
   ▼
[完成] storyCompleted（该沙盒游标 owner 匹配）
   │ ChatFlowService 检查 pendingKizunaTail
   ▼
[尾巴] 对话空间追加展示 kizunaTail Talklet 序列
   │ 尾巴展示完（玩家点完最后一条）
   ▼
[结束] markChatRead + affectionExpReward 结算（复用 [[docs-824/04i-chat-affection]] 规则）
        清除 pendingKizunaTail
```

- **pendingKizunaTail** 形态：`{ chatMessageId: ChatMessageId; variantId: VariantId }`。第一迭代为**纯运行时状态（不持久化）**：剧情完成前退出应用则 pending 丢失——消息保持未读、卡片可重新点击，流程重走（可接受，因剧情奖励在 `storyCompleted` 才结算，未完成即无奖励丢失）。
- 单次消息：尾巴结束才 markChatRead（而非前置段展示时）——保证中断后可重来。
- 可反复消息：尾巴结束进冷却（若启用 `chatCooldowns`），无冷却则可立即重触发。

## 边界规则

- `owner` 不匹配的 `storyCompleted`（其他角色沙盒 / 全局游标主线）**不触发**尾巴。
- 无 `kizunaTail` 的 kizuna 消息：现状行为不变（剧情完成即结束）。
- 尾巴展示期间：该对话空间不抽取新的被动闲聊、不展示其他可用消息（避免穿插打断回环）。
- 剧情内已用演出事件（`chatTextShown` 等）与尾巴段不冲突：尾巴走消息流插入，演出层走覆盖层。
- pending 存在时玩家切到其他角色对话空间：pending 保留（按 variantId 区分），回到对应空间继续尾巴。

## 引擎接线点（文件 : 职责）

| 文件 | 职责 |
| --- | --- |
| `src/engine/types/character.ts` | `ChatMessageDef.kizunaTail?: Talklet[]` |
| `src/engine/system/chat-flow-service.ts` | pendingKizunaTail 状态持有；订阅 `storyCompleted` 匹配 owner → 发尾巴渲染事件（复用 `chatTextShown` 族 UI 事件） |
| `src/engine/game/story-service.ts` | storyCompleted 已带沙盒 owner 语义（确认事件负载含 owner/variantId，缺则补） |
| `src/ui/components/contacts.ts` | 对话空间渲染尾巴段；尾巴「点完」回调 → markChatRead + 清 pending |
| `src/ui/controller*.ts` | kizuna 卡片点击已有 `data-kizuna → startCardStory`，接线 pending 登记 |

## 测试清单

- 完成剧情 → 尾巴段在该角色对话空间出现；结束 → 消息已读 + 奖励结算 + pending 清除
- 剧情未完成退出（重开 GameInstance）→ 消息仍未读、卡片可重新触发
- owner 不匹配的 storyCompleted 不触发尾巴
- 无 kizunaTail 的消息行为回归不变
- 尾巴展示期间被动闲聊被抑制

---
上一篇：[[docs-824/04i-chat-affection]]
