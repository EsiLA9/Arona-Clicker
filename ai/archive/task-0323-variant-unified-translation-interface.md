# Task：Variant 固定模式统一转译接口

状态：completed — 2026-10-24；统一接口首片已实现并验收，用户明确确认的范围为接口与 gameplay-b 模式。全局已有 UI 类型错误与地图内容断言失败另列，不记为通过；已用施工前 Runtime 基线复核二者独立于本改动。

## 目标与设计边界

将玩家持有 Variant 或场景指定的版本切片，经**代码固定枚举的转译模式**输出对应场景构筑。首期为 `gameplay-b`，输出 HP 上限、基础/最大敏捷、原始属性与阶级解释、能力/标签/候选来源。不同模式未来各有明确输出合同，不开放动态模式注册或任意脚本。

- 用户已确认：Variant 为主体，Chara 只统计；owned/slice 统一接口；首期 gameplay-b；本轮不迁移 MapRun 入队与战斗身份。
- 范围：可信内容 resolver、闭合规则/来源合同、真实 roster 读取、切片授权、纯数值转译、批量预览与确认、JSON 快照恢复验证、Runtime 门面及生命周期失效。
- 非目标：MapRun/UI/SaveData 自动消费、自由选队、actorId 战斗迁移、Chara 全系统退役、其他模式、真实角色平衡数值或技能/装备效果消费、动态继承切片、剧情中途换构筑、奖励回写。
- 本轮无 Datapack 新表；内容经构造时可信 resolver 注入，类比现有 OperationContentResolver。无配置时接口明确拒绝，不捏造默认角色构筑。
- 定义在产品 contracts/character 层；不修改基础数据契约与生成 Schema。未来作者表接入单列任务。

## 确认的首片规则

1. `VariantTranslationMode.GameplayB = 'gameplay-b'`；请求与入口模式必须一致；未知模式拒绝。两种来源都可使用该模式。
2. 来源为 owned 的 variantId，或 slice 的 id/revision。可信入口精确绑定规则、允许的 owned profile 与允许的 slice，切片是否要求持有由入口决定，调用方不能注入政策/数值。
3. 命名原始属性由规则声明有限 ID、safe integer min/max、有序完整覆盖的阶级阈值；profile 为每属性声明 base 和 level/stars/affectionLevel 三项线性系数（零也须明写）。计算式为 base + (level-1)*perLevel + stars*perStar + (affectionLevel-1)*perAffectionLevel。此为首片明确新增语义，不解释已有通用 Effect；其他成长轨道明确不消费。
4. 每个 gameplay-b 输出参数 maxHp/baseAgility/maxAgility 分别绑定一项属性及该属性每阶对应的数值；所有键/阶级完整且唯一，HP>0、敏捷非负且 base<=max。真实属性名、阈值与数值只由可信规则提供；测试样例数值不作为正式内容平衡。
5. slice 提供完整原始属性/能力/标签/候选来源，不混入玩家培养。owned/slice 正规化后同模式纯转译结果一致。
6. 请求成批且按 slotId 区分；入口声明人数与是否允许重复 Variant。预览不写玩家状态或分配 actorId。confirm(token) 从私有有界缓存重取请求、读取当前相关依据，成功输出不可变快照；token 仅一次消费，失效/跨实例/内容变化拒绝。快照不是 MapRun，也不授予持有。
7. 快照保存正规化输入、来源、版本/内容依据及确定性输出。恢复按同版本可信内容重算，owned 使用冻结的培养输入而非当前 roster；不重查当前持有，slice 继续核对入口声明。拒绝未知字段、版本缺失、结果/输入篡改与定义同修订偷偷变化。不承诺防御同时伪造整份合法玩家历史的密码学真实性，与现有本地存档信任边界一致。
8. Runtime reset/init/load/dispose 清除预览 token；getState 动态读取当前状态，Init 切换也使旧 token 失效。snapshot 恢复不写玩家或 Run 状态。
9. 候选来源为待玩法接合的逻辑 ID，首期不绑定/检验 Map-local Action/Pool，不宣称已可改变战斗抽牌。Chara 仅将 Registry Variant.proto 投影为统计归属，不从 Chara 的标签/学校/稀有度计算能力。

## 当前事实与代码落点

| 已核实事实 | 依据 | 影响 |
| --- | --- | --- |
| 持有按 Variant 保存、重复不新增实例 | `types/state.ts`、`types/character.ts`、`state-mutation-service.ts#acquireCharacter` | 从当前 roster 读取，无 Chara/历史记忆替代 |
| MapRun 仍是固定 Chara 模型 | `runtime-game-instance.ts#resolveMapPartyAdmission`、`map-run-service.ts#isPartySnapshot` | 本轮接口与后续战斗消费明确分开 |
| Variant 尚无原始属性/阶级表 | `data-services/contracts/character-variant.ts` | 通过可信 profile/rules resolver 首片接入，不擅自给角色写属性 |
| Registry 无历史定义仓库 | `data-services/registry/registry.ts` | resolver 需精确 revision；缺失即拒绝 |
| Runtime 有可信 resolver 注入先例 | `runtime-options.ts`、`runtime-game-instance.ts#createOperationEntry` | 新 readonly variantTranslation 门面采用同类装配 |

## 施工切片（正式 Unit，允许 Luna 并行辅助）

统一遵守 [[ai/guide/PROJECT-CONSTITUTION]]；源码冲突、白名单外修改或超预算由主 Agent 先调整本 Task 再执行。每 Unit 验证失败先报告主 Agent，由其限定修复；不顺手修复现有未提交工作。

### U1：合同、纯解析与边界校验

- Goal：固定模式、有限声明规则及严格输入校验可运行；以测试数据体现正常/失败转译。
- Allowed Files：`src/arona-clicker/contracts/character/variant-translation.ts`、`src/arona-clicker/services/character/variant-translation-rules.ts`、`tests/engine/variant-translation-rules.test.ts`。
- Read Set：本 Task、Draft 0323、`types/character.ts`、`engine/core/tag.ts`；允许 2 个直接参考文件。
- Budget：3 文件，上限调整为约 950 行净新增；完整合同与严格 JSON/原型键校验使实际规模超过最初 700 行估计，由主 Agent 在收尾审查前统一调整，未扩大功能范围。
- Completion：拒绝非法/不完整定义；owned/slice 同输入同结果；无任意表达式。

### U2：来源、预览确认与恢复

- Goal：真实持有/入口授权、来源正规化、token 与快照可用且不写状态。
- Allowed Files：`src/arona-clicker/services/character/variant-translation-service.ts`、`tests/engine/variant-translation-service.test.ts`；U1 合同若需补字段由主 Agent 更新。
- Read Set：本 Task、U1 三文件、`types/state.ts`、`roster-system.ts`；允许 2 个直接参考文件。
- Budget：2 文件，约 900 行净新增，含关键行为与不可信快照边界测试。
- Completion：owned 与 scene-provided、持有要求、重复/批次失败、stale/跨实例/重放、恢复冻结输入与拒绝篡改均有验证。

### U3：Runtime 集成、严格审查与文档收尾

- Goal：GameInstance 公开可调用接口，生命周期清除 token；文档准确说明已有接口及消费边界。
- Allowed Files：`src/arona-clicker/runtime/runtime-options.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/arona-clicker/contracts/runtime/event-catalog.ts`（登记现有 initEntered 的新订阅者）、`src/arona-clicker/index.ts`（公开模式及接口合同）、`tests/engine/variant-translation-runtime.test.ts`、`ai/archive/docs-829/04-mechanisms/arona-clicker/variant-translation.md`、`ai/guide/context-packs/character.md`、`ai/archive/plan/00-index.md`、Draft/Task 0323。
- Read Set：U1/U2、Runtime options/instance/reset、testing/architecture-discipline/doc-maintenance；允许 2 个直接参考文件。
- Budget：代码约 350 行；文档预算另计。无 UI 与 MapRun 改动。
- Completion：Runtime 动态读取、生命周期、无 resolver 拒绝、原 MapRun 定向回归、类型/架构/文档检查、独立 Luna 严格审查完成。

## 测试与验收

- [x] 规则与正规化：完整维度/阶级/参数、非法字段、未知模式、越界/BigInt 溢出、敏捷上下限。
- [x] 来源：当前 owned、同 Chara 另一 Variant 不替代、历史持有不替代、sceneProvided 不发持有、requiresOwned 查准确 Variant、准确 revision。
- [x] 预览确认：批次原子性、可解释结果、不变性、有界 token、相关输入变化失效、同一状态对象内无关资源变化不失效、跨实例与重复消费拒绝。
- [x] 恢复：JSON 往返、当前培养/持有变化仍保留冻结值；结构/输出/内容依据篡改与版本缺失拒绝；不写 PlayerState。
- [x] Runtime：public facade、动态 getState、init/load/reset/dispose 与 Init 切换失效。
- [x] 执行类型/架构/文档与差异检查；类型检查的独立基线错误已记录如下，未宣称全仓类型通过。
- [x] 独立审查与直接影响范围 GALHCG 只读收尾；未写图。

## Unit Receipt / 当前核验

- 开工：用户在 2026-10-23 发出 Task/施工授权，随后确认接口首片范围和固定 gameplay-b 模式。
- U1 完成：合同、规则校验和纯转译落地，规则测试 8/8。主 Agent 审查发现并由 Luna 修复 `__proto__` 自有键复制丢失与数字形额外数组字段被吞掉的问题；补齐严格 JSON 回归，规则/服务/Runtime 三组重跑 32/32。
- U2 完成：动态持有与切片授权、正规化、32份有界 token、单次确认、精确内容依据、冻结培养恢复。服务测试 17/17；包括跨实例/重复消费、准确 Variant、切片固定值、未知字段、同 Chara 不同 Variant、重复 Variant 政策、错误修订、移除持有后恢复与无状态副作用。
- U3 完成：Runtime 可信 resolver 注入、窄冻结 Port、init/load/reset/dispose 与 initEntered 失效，Runtime 测试 7/7。公开合同从 `src/arona-clicker/index.ts` 导出，机制页和角色领域路由已补齐。
- 交叉审查：三名 Luna 分工核对规则、来源测试和 Runtime；非作者交叉只读审查 rules/Runtime，未发现剩余阻断。另审查所提 state identity 失效：当前普通 mutation 原地修改，完整替换属生命周期边界，保留此行为并补测试/说明。
- 综合定向：`npx vitest run --silent tests/engine/variant-translation-rules.test.ts tests/engine/variant-translation-service.test.ts tests/engine/variant-translation-runtime.test.ts tests/engine/character-persist.test.ts`，4 文件 40/40；最后严格 JSON 修复后三个新增文件再次 32/32。
- MapRun 定向回归：`tests/engine/gameplay-b-map-runtime-integration.test.ts` 为 7/8；失败断言在 121 行仍预期 field-investigation 的 manual 完成，当前既有内容为 condition/“记录 3 条现场线索”。使用临时 Vitest pre-load 插件将 Runtime 源码替换为 Git HEAD 版本、保留原工作树地图内容，再跑仍为同一失败；没有覆盖/回滚工作区文件，临时配置已清理。
- `npx tsc --noEmit`：仅 `src/ui/components/map/map-workspace.ts:768`，`MapWorkspaceCommitPreviewView` 不含 schedulerTerminal。以 TypeScript 内存 CompilerHost 替换 Runtime/options/event-catalog/index 为 Git HEAD，并排除本次新文件后，仍有同一且唯一诊断；本轮未改该既有 UI 文件。
- `npm run check:architecture`、`npm run check:docs` 与目标 tracked 差异空白检查通过。未运行全量测试或浏览器：本轮无 UI/场景消费改动。

## GALHCG 影响闭环

- 发现：已核对 project_id=acprogram；Variant 图名零命中后用 path 定位 `character-variant.ts`，回源码核实；两名 Luna 独立审计 Runtime/来源边界。
- 收尾：Luna 对 15 条直接影响路径逐条 changed 只读复核，6 条既有映射 content_changed，16 个 Evidence stale、11 条 maps_to 计数；owner 分页全部续完。9 条新/未关联路径 unreferenced_path；不将未映射当成内容不存在。changed 不支持 Evidence 明细分页，未刷新/写图。Task 随后归档，仅变更文档路由和本 Receipt；新归档路径再核对返回 unreferenced_path，未产生旧映射迁移风险。

## 剩余工作

本 Task 内剩余：无。全仓类型与 MapRun 回归的独立基线失败保留给对应工作范围，本 Task 不越界修改现有地图/UI工作。

最终方向后续：正式属性与平衡数据、Datapack 作者表、MapRun Variant/actorId 与真正入队/存档/UI消费、Map-local 候选绑定、其他枚举模式、切片中途切换与奖励政策。

## 相关路由

- [[ai/archive/plan/draft-0323-variant-unified-translation-contract]]
- [[ai/guide/context-packs/character]]
- [[ai/guide/conventions/testing]]
- [[ai/guide/conventions/architecture-discipline]]
