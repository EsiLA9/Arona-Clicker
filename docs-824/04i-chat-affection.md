# docs-824 — 04i 聊天好感触发与未读计数（交互设计）==规划==

> 状态：**规划文档（未实现）**。玩法需求：通讯录/聊天空间内有对好感有需求的聊天——只能触发单次，或可被多次反复触发；可以是纯闲聊，也可以产生羁绊剧情（见 [[docs-824/04j-kizuna-tail]]）；聊天时经常有「还没查看的消息个数」，需协同外部 UI 显示辅助。
> 聊天消息为**单对 chara**：`ChatMessageDef.owner: VariantId`（必填，见 [[docs-824/03c-character-entities]]），聊天空间按角色打开，消息与好感奖励均按 owner 归属。

## 玩法需求（验收口径）

1. 存在**对好感等级有需求**的聊天消息：好感未达标不可见/不可触发。
2. 触发模式分两种：**单次**（读完即止，不再出现）与**可反复**（条件满足即可再次触发）。
3. 这类聊天驱动好感成长（读完奖励好感小值）。
4. **未读消息个数**在通讯录与对话空间 UI 协同显示。

## 数据结构（ChatMessageDef 扩展，`src/engine/types/character.ts`）

```ts
export interface ChatMessageDef {
  // ...现有 id / owner / order / content / unlock?
  /**
   * 可反复触发（默认 false = 单次：已读即止）。@label 可反复
   */
  repeatable?: boolean;
  /**
   * 好感等级门槛（与 unlock 条件 AND；缺省 0 = 无好感要求）。@label 好感需求 @int
   */
  affectionRequired?: number;
  /**
   * 读完奖励的好感小值（按 owner 归属结算；缺省 0）。@label 好感奖励 @int
   */
  affectionExpReward?: number;
}
```

- 保留现有 `unlock` 条件作为额外门槛；`affectionRequired` 是其好感维度的**声明式快捷方式**（免写完整 Condition）。

## 可用消息与已读规则

```text
可用消息(variantId) = chatMessages.filter(m =>
    m.owner === variantId
 && 满足(m.affectionRequired, 该角色好感等级)
 && evaluateGroup(m.unlock)        // 缺省视为满足
 && (m.repeatable ? 冷却外 : 未读)
)
```

- **单次**（`repeatable` 缺省 false）：已读走现成 `PlayerState.chatRead`（`Record<ChatMessageId, true>`），已读即从可用集中消失。
- **可反复**：已读不消耗；条件满足即可再次触发。冷却**沿用被动闲聊模式**：新增 `chatCooldowns?: Record<ChatMessageId, number>`（value = 上次读完的 totalFrames，归属层随 chatRead，即 `characterPersistConfig.chatRead` 默认 init），抽选/展示时按 `totalFrames - 上次帧 < cooldown` 剪枝——若第一迭代不做冷却字段，则退化为「每次条件满足即可重触发」。
- **读完时机**：消息内容完整展示后由 UI 调用现成 `StateMutationService.markChatRead(variantId, messageId)`；引擎在该写入口内结算 `affectionExpReward`（按消息 owner 加小值，触发 `affectionChanged`，见 [[docs-824/03g-affection]]）。

## 未读计数

```text
unreadChatCount(state, variantId) = 可用消息(variantId).length
  // 即：单次未读数 + 可反复条件满足且冷却外的数量
```

- 只读查询挂 `RosterSystem`（或独立 chat 查询服务），UI 不直改状态（架构纪律 #4）。
- 未拥有角色 → 0。

## UI 协同（`src/ui/components/contacts.ts`）

| 位置 | 呈现 |
| --- | --- |
| 通讯录角色行 `renderContactRow` | 行尾未读气泡（如 `（3）`），0 条不显示 |
| 对话空间头部 `conversation-title` | 学生名旁「N 条未读」小字 |
| 聊天流内 | 未读消息以现有 chat 条目样式插入，读完走 markChatRead |

## 引擎接线点（文件 : 职责）

| 文件 | 职责 |
| --- | --- |
| `src/engine/types/character.ts` | ChatMessageDef 三个新字段 + chatCooldowns（如做冷却） |
| `src/engine/types/state.ts` | `chatCooldowns?: Record<ChatMessageId, number>`（归属随 chatRead；如做需同步 init-savepoint 三处 + InitSnapshot——**优先级低，第一迭代可不做**） |
| `src/engine/system/state-mutation-service.ts` | markChatRead 内结算 affectionExpReward |
| `src/engine/system/roster-system.ts` | `unreadChatCount` + 可用消息过滤 |
| `src/ui/components/contacts.ts` | 未读气泡 + 头部提示 |
| schema | 新字段 TSDoc 标注后 `npm run gen:schema` |

## 边界规则

- 未拥有角色 / 未知差分：未读数 0，不渲染气泡
- `affectionRequired` 缺省 0；`affectionExpReward` 缺省 0
- 旧档无 `chatCooldowns`：`??=` 兜底，不写迁移
- 好感奖励结算走 `addAffectionExp`，达标自动升级并 emit `affectionChanged`

## 测试清单

- 单次消息：已读后不计未读、不再展示
- 可反复消息：奖励后仍计未读（冷却外），冷却内不计
- `affectionRequired` 未达标：不可见、不计数；好感达标后立即可见
- `markChatRead` → 奖励入账 → 跨级升级 → `affectionChanged` 事件
- 未拥有角色未读数为 0

---
上一篇：[[docs-824/04h-affector-review]] · 下一篇：[[docs-824/04j-kizuna-tail]]
