# 04-mechanisms/arona-clicker/variant-translation — Variant 固定模式转译接口

本文回答：**当前持有的 Variant 与场景版本切片，如何通过指定的固定模式生成可确认和恢复的场景构筑。**当前实现 `gameplay-b` 模式；正式转译演练场通过主 MapRun 消费三份冻结构筑，普通静态地图尚未全面迁移来源准入。

## 调用入口与数据流

`GameInstance` 和继承它的 `AronaClickerRuntime` 公开冻结的 `variantTranslation` 门面：

| 方法 | 行为 |
| --- | --- |
| `preview(request)` | 校验入口/来源、读取有效培养、转译整批成员，返回只读构筑与一次性 token；失败返回 issues |
| `confirm(token)` | 重读当前相关输入与授权，完全一致才返回不可变 snapshot；token 无论成功或失效都只可消费一次 |
| `restore(unknown)` | 校验 JSON 快照、准确内容版本与转译一致性，返回恢复后的只读 snapshot；不创建 Run 或写玩家状态 |

```text
owned Variant / 场景 slice@revision
  → 指定 VariantTranslationMode.GameplayB
  → 精确来源与当前入口授权
  → 正规化有效原始属性
  → 本模式的阶级/参数映射
  → 预览 → 确认后的场景构筑快照
```

模式是代码枚举，不由字符串注册任意规则执行器。当前值只有 `gameplay-b`；后续模式必须同时提供明确的输出类型、验证及测试。阶级映射是本模式内部行为，不要求所有未来模式都采取相同步骤。

## 可信内容与外部选择

构造时通过 `GameInstanceOptions.variantTranslationContentResolver` 注入可信内容；未配置时返回 `entry-unavailable`，没有隐藏的默认角色数值。

resolver 按 ID 提供入口，并按准确 `id + revision` 提供规则、owned profile 与 slice。入口声明：

- 支持的固定模式及规则引用。
- 人数上下限、是否允许重复 Variant。
- 允许的 owned Variant 及其准确 profile 引用。
- 允许的 slice 修订，以及是否必须持有切片绑定的 Variant。

外部请求只提供 `entryId`、`mode`、有唯一 `slotId` 的成员与来源选择；每批 1–64 人。不接收调用方上传的持有标记、政策或属性值。请求与内容合同均拒绝未知字段。

此版本没有新增 Datapack 表、编辑器字段或基础数据 Schema。resolver 是可信组合接口，不代表当前场景编辑器或普通数据包已经可以声明这些表。示例数据与完整 resolver 可参考 `tests/engine/variant-translation-service.test.ts` 和 `variant-translation-runtime.test.ts`。

## 两种来源

### 玩家持有 owned

请求显式选择 variantId。服务从当前 Registry 确认 Variant 存在，从当前有效 `roster[variantId]` 读取培养；同 Chara 的另一个 Variant、历史曾拥有、可抽取均不替代当前持有。

profile 声明每项原始属性的基础值和三项显式系数，规则为：

```text
有效值 = base
       + (level - 1) × perLevel
       + stars × perStar
       + (affectionLevel - 1) × perAffectionLevel
```

系数为零也要明确声明。只消费 level/stars/affectionLevel 三条轨道；技能、装备、爱用品、专武和特性 Effect 当前没有被该接口解释。profile 和规则是新的独立声明，不自动把旧培养 Effect 转成这些系数。

计算使用 BigInt 中间值，最终必须落在安全整数和该属性声明范围内；不截断、不钳位、不补缺失值。

### 场景切片 slice

切片绑定一个 Variant，并给出完整原始属性、能力、Tag 和候选逻辑来源，不读取玩家培养。入口的 ownership 为：

- `required`：必须当前持有切片绑定的准确 Variant，但数值仍使用切片。
- `scene-provided`：入口提供本场借用资格，不要求持有。

切片不创建 roster 记录，不发碎片，不授予培养。相同有效原始输入在同一模式/规则下产生相同构筑，来源信息仍分别保留。

## gameplay-b 输出合同

规则先声明有限属性 ID、安全整数 min/max 及严格递增的阶级门槛，第一门槛必须等于属性最小值。最后一阶覆盖到最大值。每个参数的映射必须准确覆盖其绑定属性的全部阶级。

| 输出 | 约束 |
| --- | --- |
| `grades` | 每项属性的有效原始值与命中阶级，用于解释结果 |
| `parameters.maxHp` | 正安全整数 |
| `parameters.baseAgility` | 非负安全整数 |
| `parameters.maxAgility` | 非负安全整数，所有合法组合下不得低于基础敏捷 |
| `capabilityIds` | 当前来源明确声明的唯一能力 ID |
| `tags` | 当前来源明确声明的唯一完整 TagRef |
| `candidateSourceIds` | 逻辑候选来源 ID，尚未绑定 Map-local Action/Pool |

真实属性名称、阈值和参数数值由可信内容提供。测试里的 power/might、阶级名称和数值不是正式角色平衡数据。

Chara 不参与资格、属性或候选计算；只把 Registry Variant 的 proto 投影为 `statisticsCharacterId`。本次没有移除其他既有系统的 Chara 表现或地图身份依赖。

## 预览一致性与生命周期

- 服务最多保存 32 份待确认预览；超出淘汰最早 token。缓存私有、句柄实例隔离，客户端不能回传 build 兑现 token。
- confirm 重新验证请求、持有/所消费培养、来源授权与完整内容依据；相关变化返回 `stale-preview`。同一个 PlayerState 上的无关资源变化不影响确认。
- 完整替换 PlayerState 视为运行上下文边界，旧 token 失效。
- Runtime `init/load/reset/dispose` 及每次 `initEntered` 清空预览；即使世界线 A→B→A，也不能继续消费原 token。
- 当前需要有效 activeInit。预览不写 PlayerState、不推进游戏随机流、不分配 actorId。
- 请求、预览及快照深拷贝并冻结，不向调用方泄露私有可变对象。

确认只生成准备好的构筑快照。场景 owner 负责接收快照并开始地图；专用演练场已实现固定单槽适配，通用 Variant/actorId 绑定仍待后续实现。

## 保存恢复与信任边界

snapshot 带 schemaVersion、模式、入口/规则引用、Init 来源、成员来源及精确 profile 引用、owned 冻结培养、原始输入、最终输出和内容依据。

恢复不查询当前持有或当前培养，owned 用快照中的三个冻结培养值和对应 profile 重新计算，slice 按可信准确修订重建。再比较原始输入、最终构筑及内容依据。当前内容同修订被偷偷改变、旧版本不可取、输入/结果/额外字段被改动时拒绝。

恢复不跨版本改用最新定义，也不为旧快照建立迁移层。resolver 可以自行提供历史修订，但本接口不建立内容历史仓库。通用 snapshot 不自动进入 SaveData；正式演练场将三份 snapshot 作为 `SaveData.mapRun.scenario` 的有界场景绑定保存，先重建可信定义，再恢复主 MapRun。

内容依据是确定性一致性信息，不是认证签名；能够重写整份本地存档与合法冻结培养的人不受密码学防篡改保护。严格 JSON 校验拒绝非 JSON 类型、循环、稀疏数组和 Symbol 键，保留并校验 JSON 自有 `__proto__` 等键，避免未知字段被复制过程吞掉。

## 当前调用示意

在可信 resolver 已配置、入口允许对应来源时：

```ts
const result = game.variantTranslation.preview({
  entryId: 'example:entry:training',
  mode: VariantTranslationMode.GameplayB,
  members: [{
    slotId: 'front',
    source: { kind: 'owned', variantId: 'example:variant:student' },
  }],
});
if (result.status === 'ready') {
  const confirmed = game.variantTranslation.confirm(result.token);
  if (confirmed.status === 'confirmed') {
    const restored = game.variantTranslation.restore(
      JSON.parse(JSON.stringify(confirmed.snapshot)),
    );
  }
}
// 使用场景切片时仅替换 source：
// { kind: 'slice', slice: { id: 'example:slice:prologue', revision: 1 } }
```

## 专用转译演练场

普通游戏进入夏莱办公室后，主区默认开放「转译演练场」Spot。先从阿比多斯联络点领取星野，可在通讯录培养；点击「进入演练场」直接进入真实卡牌工作区。固定 Hoshino、`gameplay-b` 模式，同一主 MapRun 依次进行“当前持有 → 普通 → 高级”三战，无来源下拉、MapEntry 或训练 Modal。

`GameCommands.enterVariantTraining(spotId,functionalityId)` 在领域入口复核当前 Init/Area、Spot 归属、utility、功能和 condition。新开局内部依序 preview/confirm 三来源，整批冻结后交给主 owner；未持有精确 Hoshino 或其他地图占用时拒绝，普通 `startMap` 也不能绕过该准入。场景切片不要求另行持有、不写 roster。正式入口不授予学生、不发奖励。

三战复用 Map 原生 Hand、Prepared、CardRef、目标草稿、AG-1 预览与提交。每场有“快速打击”和“强力打击”两种实际可选行动，三场敌方配置相同；胜利后沿唯一出边继续，第三场后抵达出口才通关。

可信动态地图 `gameplay-b:map:variant-training-scenario` 的三战节点分别声明 `partySetup`。主 owner 首次合法进入该节点时初始化对应 HP/cap、基础敏捷、PlayerCost 和局内资源，清上一场 map statuses/回执，并创建新 Encounter/Hand；提交版本继续单调递增。恢复当前节点和重访不再次初始化。`partySetup` 只作用于声明它的节点，后继战斗若需同一构筑须显式声明；非声明节点使用地图默认值。

| 来源 | 原始战备 | HP | 敏捷 base/max |
| --- | --- | --- | --- |
| 当前持有 | 开局冻结培养计算 | 依阶级10或16 | 依阶级2或6 / 8 |
| 普通切片 | 20 | 10 | 2/8 |
| 高级切片（内部ID enhanced） | 60 | 16 | 6/8 |

当前持有来源按 `20 + (level-1)*2 + stars*2 + (affectionLevel-1)` 计算，范围0..10000，50起进入高级阶级。训练靶HP6，攻击敏捷4、伤害2；我方快速打击伤害2、敏捷修正+1，上限8；强力打击伤害3、修正0，上限5。这些是测试规则，实际回合数和伤势取决于所选卡牌。

主保存包含模板准确修订、按固定顺序的三份冻结 snapshot，以及覆盖当前 Run 的 canonical 一致性绑定；它不是认证签名。恢复拒绝未知版本、换序、跨 Run/来源拼接与无效节点进度；先校验并重建可信定义，再恢复同一个主 owner。当前节点是战次权威，保持本场HP、Hand、目标草稿、RNG、回执和提交版本，不重复满血或重抽。恢复后可继续提交、再保存；培养变化不改变已有局。

离开工作区返回原 Spot，点击入口直接续当前战次。活动局重开回第一战，仍使用原冻结三构筑；放弃或结束后再新开才读取最新培养。Init 切换、reset/dispose 和重新装载内容释放场景运行状态；成功/失败的动态内容保留到结果展示或下一次开局，不能附加到后续普通地图保存。固定单槽兼容角色键不负责来源、资格或培养选择；没有全局 Variant/actorId 迁移或通用能力/Tag/候选来源注册。

开发入口 `/src/ui/index.html?devConsole=gameplay-b` 的旧单战面板仍可用于诊断：`game.variantTraining` 和其独立内存检查点不进入正式 Spot 流程，也不能替代主存档验收。开发验收参数方案见 [[docs/plan-work/draft-0327-development-acceptance-console]]，其中新命令尚未实现。

## 源码与验证入口

- 合同：`src/arona-clicker/contracts/character/variant-translation.ts`。
- 纯规则/正规化：`services/character/variant-translation-rules.ts`。
- 来源/token/恢复：`services/character/variant-translation-service.ts`。
- Runtime 装配：`runtime/runtime-options.ts`、`runtime/runtime-game-instance.ts`；`contracts/runtime/event-catalog.ts` 登记现有 initEntered 新订阅者。
- 行为测试：`tests/engine/variant-translation-rules.test.ts`、`variant-translation-service.test.ts`、`variant-translation-runtime.test.ts`。
- 正式场景：`contracts/character/variant-training-scenario.ts`、`content/gameplay-b/variant-training-scenario.ts`、`services/character/variant-training-scenario.ts`；Spot入口为 `src/ui/controller/controller-actions-variant-training.ts`，使用现有 MapWorkspace。
- 演练验证：`tests/engine/variant-training-{content,service,runtime}.test.ts`、`tests/ui/variant-training-panel.test.ts`。
- 正式Spot入口与内容：`tests/engine/variant-training-{spot,scenario,main-runtime}.test.ts`、`tests/engine/map-stage-initialization.test.ts`、`tests/ui/variant-training-spot-entry.test.ts`；培养联动见 `tests/ui/character-cultivation.test.ts`。

当前 MapRun 卡牌及未来战斗接合边界见 [[docs/docs-829/04-mechanisms/arona-clicker/gameplay-b-cards]]、[[docs/docs-829/06-wiki/30-arona-clicker-domain/card-systems-and-cultivation-bridge]]；本接口实施与剩余方向见 [[docs/plan-work/archive/task-0323-variant-unified-translation-interface]]，演练场验收见 [[docs/plan-work/archive/task-0324-variant-translation-training]]，培养与正式Spot入口见 [[docs/plan-work/archive/task-0325-character-cultivation-and-spot-training]]。
