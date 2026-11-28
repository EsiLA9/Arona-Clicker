# M12 剧情投放、目标进度与成果交付服务

## 1. 当前实现与改造原因

`PassivePoolSystem.rebuildIndex/pick` 按实际条件、权重、冷却及地区/角色上下文选择日常；`story-entry-selection`、`story-availability-delivery-mount`、`story-follow-up-mount` 与 StoryService 管入口可用、发现、后续及播放。现有 `Trigger`/ConditionDepIndex 以事件唤醒为主，不保证任何新条件都有对应事件。MilestoneAdapter 推导 watch、重新求值并先提交完成再执行 listener.then；失败日志不自动重试，现有测试明确固定了这个行为。Achievement 是完成/进度投影，Enhancement、SpotFunctionality、Affector 各自拥有实际能力。见 A14–A15。

本模块要解决两个不同但相关的问题：重要剧情在资格满足后必须有可靠接取方式，不能依赖随机抽中；重要调查成果完成后，实际能力不能因一次授予失败而永远丢失。不建设新的万能任务引擎，不改所有现有普通奖励。对现有 Entry/Milestone 增加明确的可选策略，使用原有领域服务执行，改变的是投放、交付及恢复合同。

## 2. 剧情投放结构改造

保持现有 active/passive、random/affection/fallback、Entry 可用 Init、投放和 StoryService 的真实语义。新增持久可接取策略只对明确标记的必要入口有效；普通日常仍按池、权重和冷却运行。现有白子赴约、Area followUp 若已有可靠待接取记录，优先扩展同一结构，不并行保存第二份邀请。

```ts
interface EntryAvailabilityPolicy {
  kind:'persistent';
  scope:'init'|'save';
  // 资格满足后持久保留待接取，入口本身仍可在开始时重验
  recheckOnStart:true;
  expiry:'none'|'on-condition-lost';
}
// 拟议扩展 StoryEntryDef 的投放策略字段，实际适配 active/passive 资格后确定名字。
interface EntryOpportunity {
  entryId:string; scopeKey:string; occurrenceKey:string;
  state:'available'|'in-progress'|'completed'|'cancelled';
  source?:{kind:string;id:string;initId?:string};
}
```

普通重要入口默认 Init 范围、无主动过期；但已领取/进行中/完成时的资格与续播必须服从真实 Story 规则。save 范围只代表机会记录共享，实际开始仍检查当前 Init、Area、持有和 Entry 门禁，不允许跨线进入不合法正文。需要重复可接取的入口使用实际 cycle/occurrence 身份；首轮 persistent 只服务一次性必要内容，避免先设计无限重复队列。现有 active/followUp/continuation 持久记录如果足以表达上述状态，扩充现有字段而非新建表；待接取事实与播放器游标分开，完成以真实 Story 回执为准。首轮默认取消未完成的临时执行后重新检查资格：仍合法且未消费的机会恢复 available；资格不合法时保持不可接取并按 expiry 处理；已经形成正式完成事实的机会不得由取消重新开放。既有 continuation 的取消/恢复仍使用其真实规则，不能套用这个普通机会默认值。

### 2.1 资格变化的实际唤醒

将条件依赖整理为由目标登记的读取与变更通知，不再靠每个消费者各自猜应订阅什么。复用现有 ConditionDepIndex、Trigger、EventBus 和 mutation 服务。M10 持量/取得、M11 知识、M09 调查、现有资源/Spot/Story 完成等各登记真正改变事实的依赖键；变化后重新读取当前条件，不以事件 payload 替代真值。无法静态确定依赖的规则允许在地区进入、读档恢复、显式查看/接取时重新检查，不能宣布即时监听已覆盖。

拟议接口 `recheckEntry(entryId,scope)`、`listAvailableEntries(area,scope)`、`claimEntry(opportunityKey,expectedState)`、`finishEntry(actualReceipt)`。重查阶段只产生待接取/候选，claim 阶段再次检查真实资格及活动槽位；完成写实际回执。恢复时从已有保存的机会、真实完成和正在运行会话重建派生索引，不重复创建已完成机会。随机池可为空，但必要入口仍通过独立实际投放可见。普通池仍可在不同地区、状态和冷却安排日常丰富度。

## 3. Milestone、Achievement 与能力交付改造

保留 Milestone 的完成事实和 Achievement 的只读投影。需要能表达调查项、不同收藏成员、人物资料等实际条件，新增目标由所属领域读取，M12 负责唤醒与完整性；不为这些再建立 ObjectiveDef。对于永久权限，优先直接读取可靠完成事实（例如新增实际 `milestoneCompleted` 条件，或已有等价接口）决定可用性；这样不需要一份额外的授予记录。但当必须发独立物品、强化、一次性资源时，需要可恢复交付。

```ts
// 拟议扩展 MilestoneListenerDef：交付策略明确，不改变现有未声明 listener.then 语义。
interface GuaranteedGrantDef {
  id:string; // listener 内稳定键，不使用动作下标作为长期身份
  action: // 仅供原型的候选类型，真实参数以领域合同核对
    | {kind:'enhancement';enhancementId:string}
    | {kind:'resource';resourceId:string;amount:number};
}
interface GrantRecord {
  grantKey:string; scopeKey:string; listenerId:string; grantId:string;
  state:'pending'|'granted'|'failed';
  receiptId?:string; lastError?:string;
}
```

实现原则：完成与 pending 记录在同一个真实状态提交中写入；对每项可靠授予使用稳定 grantKey。目标领域在同次提交中检查该 grantKey、变更自己的资源/权限并写实际已授回执，返回已存在的同一结果。若提交成功后通知失败，恢复只补通知/更新记录，不能再发一次；如果目标领域做不到幂等或同成败，则该动作**不能**登记为保证交付，不用简单重试任意 Effect 列表冒充可靠。首轮只支持一种明确可验证的能力或奖励，如已实现的 Enhancement 授予或受控资源增加；其它普通 `listener.then` 保留现有一次尝试、失败日志语义。此处需要实际修改 StateMutationService 及相关领域回执，不能只新增 UI 标志。

`completeMilestone` 重新求值并写完成/待授；`deliverGrant` 检查已完成及实际 grantKey，处理已授/失败；`recoverPending` 在合法恢复点或明确领取命令中重试安全动作；`getAchievementView` 独立显示目标完成、授予状态、实际能力/入口是否可用。旧档已完成且未记录 grant 的历史 listener 不自动重发；新增可靠策略正式启用前需提供显式迁移选择。永久权限读完成事实时要核对旧档完成语义、scope 与实际所属地点。

## 4. 玩家界面与作者配置

地区工作区显示普通日常候选和稳定可接取的邀请/调查线索，明确需要去哪、是否已开始、是否可回访。点击只是接取，播放由 StoryService；资格丢失给可理解原因，不自动替玩家运行。Achievement/调查目标页显示缺项（M10 组成员、M09 调查、M11 知识），完成后提供实际设施/Entry 链接和领取状态，不以 +5 信用点代替能力。作者工具为 Entry 增策略、Milestone 条件和 listener 可靠授予列表；M02/M03 检查引用、作用域、动作是否支持可靠执行，旧配置继续可读。

## 5. 制作路线与验收

1. M12-A：核对现有事件覆盖及待接取事实；真实 Base `schale_root/schale_daily` 的权重/冷却与普通 Entry 回归，白子续接/followUp 保留。先实现必要入口从满足到可见、重载、接取和完成的状态合同；清空随机池仍可获取。
2. M12-B：接 M09/M10/M11 实际新事实的 Condition/Trigger 依赖，补未映射目标与登录/地区刷新；不用每帧全量扫描或临时 UI flag 代替事件服务。真实条件变化、无事件时主动重查、取消和过期均有结果。
3. M12-C：用 `area-achievement-demo` 的 archive-fragments（三次累计、5 信用点）核对旧行为；新增不同三项收藏的调查目标，通过完成条件打开真正功能。补可选保证交付字段、pending 与领域幂等回执，注入授予失败、提交成功通知失败、重复恢复，验证不丢不重。普通 listener 的原测试仍通过。
4. M12-D：在一个独立试验 Init 组合“旧地图→资料→人物→收藏→设备/Story”，检查必要内容不依赖随机，完成后玩家实际使用新能力。更新玩家回顾、作者配置与持久化版本，确认生产迁移范围后才应用。

测试参照 `tests/engine/character/passive-pool.test.ts`、`tests/engine/world/{milestone-runtime,milestone-adapter}.test.ts`、`tests/data/area-map/area-achievement-demo.test.ts`、Story continuation/reward receipts。新测试包括缺前置、已读、重复通知、切 Init、读档、部分失败、领取重试、活动槽位占用；检查真实状态和最终玩家操作，而不只检查“生成了事件”。
