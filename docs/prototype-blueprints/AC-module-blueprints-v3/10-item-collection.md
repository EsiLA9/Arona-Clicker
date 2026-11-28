# M10 物品获得、使用、资料档案与收藏服务

## 1. 现况与建设需求

`ItemDef` 已有 consumable/material/key、maxStack、useCondition/useEffects、pickupEffects、图片和价格等。`economy/item-service.ts:giveItem/useItem/rollDropTable` 管物品取得与使用，`ShopService.checkout` 按真实交易检查支付、库存并产生收据，`story-rewards.ts` 有剧情奖励。库存、累计取得统计、商店购买记录并非同一份数据；商店可能直接提交状态而不走 ItemService 的 giveItem，不能假设每个入口自动执行 pickupEffects。现有 `$InitCollectedAmount` 能表达累计量，不说明出处、首次获得、是否读过资料。当前通用 ConditionTarget 未见 hasItem（A12、原 P4-B）。

目标：让物品不仅是库存数值，还可作为收藏、文献、线索、凭证、礼物、交换材料。**不增加八种 Item 类型**；保留经济合同，通过可选资料/收藏声明、成功取得事实、真实使用命令和回顾 UI 实现这些玩法。需要补持量条件与统一取得记录，不能依靠每个剧情手工写 flag。库存仍归现有经济状态所有，不创建第二个背包。

## 2. 数据结构（推荐新设计）

```ts
interface ItemArchiveDef {
  title?:string; description?:string; storyId?:string;
  // archive 表示可回顾资料，不决定物品经济类型或持有数量
  visibility:'ever-acquired'|'read';
  groupIds?:string[];
}
// ItemDef 新增 archive?: ItemArchiveDef
interface CollectionGroupDef {
  id:string; title:string; description?:string;
  members:{itemId:string; requiredCount?:number; hint?:string}[];
  scope:'init'|'save';
}
// 新可选 Datapack.collectionGroups，仅用于明确需要系列收藏的场景
interface AcquisitionOrigin {
  kind:'story'|'shop'|'drop'|'investigation'|'effect'|'other';
  sourceId?:string; initId:string; detailId?:string;
}
interface ItemAcquisitionSummary {
  itemId:string; everAcquired:boolean; acquiredCount:number;
  first?:AcquisitionOrigin; last?:AcquisitionOrigin;
  read:'yes'|'no'|'unknown';
}
```

目标存档：每个 Init 的 ItemAcquisitionSummary 与该 Init 库存/累计数据同范围写入；跨线 collection group 可由各 Init 的真实已保存记录合成（不得把当前 Init 缓存当全部历史）。若现有累计已能准确覆盖所有获取路径，acquiredCount 直接复用统计，不另维护第二个计数；summary 的持久独有字段是曾取得、首/最近来源、资料已读状态（旧档无法判断为 unknown，新条目未读为 no）。若实际取得计数当前无法覆盖全部入口，先把其统计写入收归同一成功提交点，再将 acquiredCount 作为读模型；不要在新旧两处累加。只记录有 archive 或 collection 需要回顾的物品，避免每次掉落永久保存流水。旧档从实际存在的库存/累计统计恢复 everAcquired 与已知数量，无法推断的来源/已读标 unknown，不制造“第一次获得时间”。是否允许一条资料在所有 Init 已知由产品裁定；首轮默认随取得范围，save 系列仅合成进度，不跨线发通行权。

CollectionGroup 的 members 指向真实 Item；不要求重复成员 ID，默认每个成员至少曾成功取得一次；requiredCount 为累计获得量，不是当前库存。成员来源提示受信息揭示和已知程度约束。组进度派生，不新增另一套 Achievement 完成计数；最终解锁交现有 Milestone 或 M12 的条件/授予。若普通三件不同物品可直接用现有条件表达，依然使用新 collectionGroups 作为作者配置和玩家展示，而不重做完成事实。

## 3. 成功取得的共同写入

新建窄的取得记录接口（名称候选 `recordItemAcquisition`），在**实际成功增加库存的提交点**写入/更新相应资料和统计。输入包含 itemId、actualAdded、origin、init 与实际事务/回执标识；不得在调用意图时累计请求数量。giveItem、掉落、商店 checkout、Story 奖励、Effect 增物品各自保留领域所有权并从真实成功结果触发记录。库存已满/截断、不可支付、取消、失败及重复回执都必须正确；对会重复通知的入口，使用其已有真实业务收据/一次性标识保证不重记。无可靠标识的入口直接在库存实际提交处更新，而非监听 UI 或重复事件。是否执行 pickupEffects 保留每条既有语义，另行明确哪些新增获取路径需要；不要在统一记录后导致双重奖励。

拟议新增 `ConditionTarget` 的持量目标（候选 `hasItem` 或 `itemAmount`，按现有条件命名统一），读取当前实际库存数量并支持比较；另增加用于资料/收藏的“曾取得/已读”查询目标或统计调用。注册真实依赖键与获得/消费唤醒，交 M12；不能把累计取得当作当前持量。`useItem` 仍负责消耗与 useEffects，新增显式 `inspectArchive(itemId)`/`readArchive(itemId)` 不消耗物品，读取资料条件可用曾取得；若点击启动资料 Story，已读要在实际完成/阅读确认后记账。凭证“出示”只检查数量，“支付”使用真实消费提交，“永久通行”用 Enhancement/可靠完成事实表达，避免每次到访误扣。

## 4. 玩家与作者工具

背包展示当前持量、类型和真实使用按钮；资料页展示已获得条目、首/最近已知出处、是否读过、下一条线索与相关 Story；系列页显示每个成员、缺项和合理提示，重复同一 Item 不填满其他缺项。已用完仍可回顾归档资料。未公开的物品名称、用途依现有 Reveal 遮蔽。作者侧 M05/M06 增加 archive 字段、CollectionGroup 成员选择与引用/条件/资料入口预览，M02 识别真实 Item/Story 关系，M03 检查组成员、重复与范围。新增数据表需覆盖 parser、Registry、Schema、构建、工具和存档，不只改 UI。

## 5. 制作路线

1. M10-A：列出并统一各实际成功取得入口，补取得事实与持量条件/依赖；保留库存与经济规则。以 addition-test `signal-chip` 的真实 Story 奖励及 useItem 加 7 信用点为基线，额外在试验商店和真实掉落入口取得同一 ID，不声称 scanner 已调用该掉落。
2. M10-B：加入 archive 定义、取得摘要与回顾 UI；消耗最后一枚后仍能读曾取得的资料并进入实际下一步，读档来源正确。迁移原有可用的统计，不创建新库存。
3. M10-C：CollectionGroup、作者控件、条件查询和 M12 Milestone 对接。三份不同档案，分别经调查、交易、重访 Story 取得，重复一份不替代其它。完成后开放真正可用的设施或 Entry。
4. M10-D：按需要补明确出示/支付及礼物动作；交易失败不扣料，关系奖励与物品消耗必须按明确原子域或可靠交付处理。普通经济奖励语义不随新档案改变。

回归 `tests/engine/runtime-content/shop-service.test.ts`、`tests/engine/story/story-reward-receipts.test.ts`、`tests/ui/workspace/inventory-workspace.test.ts` 与物品实际提交测试。验收必须覆盖成功/失败、实际增量、重复通知、消耗、读档、换 Init、同名不同包 ID、旧档迁移、资料遮蔽；从活动设计而不是测试字段判断玩家能否知道下一步去哪里。
