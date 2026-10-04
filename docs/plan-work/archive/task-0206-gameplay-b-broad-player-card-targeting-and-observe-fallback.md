# Task 0206 — 玩法 B 玩家卡牌广域改目标与待机回落

状态：completed — 目标池扩展、依赖行动待机回落与提示接线完成；玩法 B 全量验证通过

## 目标

扩展玩法 B 战斗准备阶段的玩家侧卡片目标选择。普通行动卡与可独立编辑的免费技能卡应尽量提供实际存在的合法目标；行优先级继续决定默认目标，但不再限制玩家在已声明目标行之间改选。一次卡牌或目标编辑若使其他普通行动失去目标组或现存目标不再合法，该行动自动回落为“观察 / 待机”，返还本轮卡费并按待机规则恢复 sCost。

范围只限 `prototypes/gameplay-b/` 的战斗卡牌 Runtime 与既有编辑 UI，不接入 AC Runtime，不修改路线有限卡组。

## 玩法与交互裁定

- `lowest.rows` 保持为允许目标行及默认优先顺序：AI 默认目标仍按数组从左到右，在首个有合法人的行内选最低 HP；玩家手动改目标时，可从数组列出的所有行中选择当前存活且符合 requirement 的对象。重复行和 `any` 去重。
- 不改变卡牌的目标形状或数量：`all` 仍命中整排所有存活对象；`front-and-lowest-rear` 保留全部前排固定槽，只能替换一个后排槽；`intent-target` 仍限于冻结意图标签并保持原目标数量。HP、阵营、行、治疗资格、`prepared-attack` 和冻结敌方意图均须校验。
- 当前规则可变目标组中存在至少一个替代组合时，己方普通行动卡或可独立编辑的免费技能卡显示可拖拽目标；被技能效果 / modifier 绑定的卡继续锁定。没有替代组合的目标组保持只读，但普通卡仍可通过卡组选架重选。
- 每次候选行动先组成完整的玩家行动集，再校验所有卡牌的目标组。编辑若使某张已准备普通行动的目标组消失，或其原目标不再符合规则，该行动改为“观察 / 待机”；从该角色本轮开始 sCost 恢复原值，不保留已扣卡费，待结算时再按正常待机规则恢复最多 1 点。
- 若回落行动自身曾是其他 `prepared-attack` 目标条件的前提，继续按玩家行动顺序重复检查，直到所有剩余行动合法。每张行动最多回落一次，整个修改原子提交，配方与卡片关系只从最终行动集重算。
- 明确不把用户拖到未高亮对象、重复目标、目标数量错误等无效输入伪装成待机：此类命令仍拒绝且完整保留编辑前状态。待机回落只用于一次合法行动/目标变更令已准备行动失去目标合法性，或构造候选行动后已无任何合法目标组的情形。
- 冻结随机技能结果与绑定关系优先保持完整。如果自动回落会破坏绑定行动、modifier 或技能结算效果，本次触发编辑整体拒绝并保持原预览，不重掷技能，也不部分回落。
- 回落记录包含 Chara、原卡名与失效原因；编辑 UI 提示该行动已回落至待机及 sCost 退还。一般目标编辑仍不推进 Click、RNG、事件或路线状态。

## 实施范围

### U1：扩展合法目标池与候选行动校验

实现 `lowest` 的跨声明行候选池，同时保持默认目标优先顺序。卡组选项与目标组均用“替换后的完整行动集”求值，避免 `prepared-attack` 继续误读被替换前的旧行动。覆盖前排 / 后排、`any` 去重、治疗资格、冻结意图与目标组基数。

**Allowed Files：**

- `prototypes/gameplay-b/src/battle/player-card-edit.ts`
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`

**Execution Receipt：**

- 已完成。`lowest` 默认目标仍依 `rows` 优先级选择；可选目标池按声明行顺序合并并去重，覆盖跨前后排改选。
- 卡组选项和目标组检查使用替换后的行动候选集。
- `npm test -- player-card-edit`：8/8 通过。最终整套原型测试亦覆盖该单元，详见 U3 Receipt。

### U2：失效普通行动的待机回落

增加确定性行动集协调：先验证用户提交的目标；再识别被修改行动集影响而失效的既有行动，按稳定行动顺序回落并重复校验至稳定。回落恢复 round-start sCost，提供原卡与原因摘要；对冻结技能绑定冲突保持全有或全无。

**Allowed Files：**

- `prototypes/gameplay-b/src/battle/player-card-edit.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`

**Execution Receipt：**

- 已完成。普通行动目标失效时按稳定顺序回落待机，回到 round-start sCost；后续 Click 使用现有待机恢复规则。技能锁定阻止编辑时不提交部分状态。
- 覆盖普通卡目标跨排改选、依赖 `prepared-attack` 的行动回落、待机返还与 Click 后恢复、无目标候选回落、无效目标拒绝以及随机技能冻结。
- `npm test -- runtime`：41/41；新增跨排 Runtime 用例通过。

### U3：玩家可见反馈与端到端 Runtime 接线

确认拖拽与卡组选牌沿用 Runtime 生成的合法目标候选。一次提交后重算 cardTag 配方及目标线；回落时在现有编辑提示区说明角色、原行动和待机结果。不得重建整页、改变拖拽 ghost 生命周期或增加 Click。

**Allowed Files：**

- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`

**Execution Receipt：**

- 已完成。Runtime 在原子提交后重算配方，返回回落角色、原卡与失效原因；现有提示区说明回落及 sCost 退还。
- `npm test`：17 个文件 / 152 项通过；`npm run typecheck` 通过；`npm run build` 通过。
- 根目录 `npm run check:docs`：574 篇 Markdown、0 errors；`git --no-pager diff --check` 通过。
- 未执行浏览器手动验收；拖拽命中规则未改，跨排候选和回落结算由 Runtime / 定向测试覆盖。
- GALHCG 身份解析到 `acprogram`，返回的 workspace/root 均与项目目录一致。玩法 B 源码/测试路径无直接地图 Evidence；`00-index.md` 的三个直接 Evidence owner 曾标为 `content_changed`，已更新现有 `module:planning-records` 与其 `contains` / `maps_to` Evidence，不新增节点或关系。指定路径刷新只发现归档版 Task；写后 `review_changes` 为 unchanged、stale Evidence 0，三个 owner 的 freshness 均 fresh；map 搜索命中 `concept:goal-workflow`，path 搜索命中归档 Task，`maps_to` traverse 完整到达。

## Read Set

- `prototypes/gameplay-b/src/model.ts`
- `prototypes/gameplay-b/src/battle/prepare.ts`
- `prototypes/gameplay-b/src/battle/player-card-edit.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/src/battle/match.ts`
- `prototypes/gameplay-b/src/battle/skills.ts`
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`
- `docs/plan-work/archive/task-0201-gameplay-b-player-card-targeting-and-reselection.md`
- `docs/plan-work/archive/task-0205-gameplay-b-whole-card-drag-and-target-choice.md`

## Allowed Files

- `docs/plan-work/00-index.md`
- `docs/plan-work/task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback.md`
- `docs/plan-work/archive/task-0206-gameplay-b-broad-player-card-targeting-and-observe-fallback.md` (only for final archival)
- `prototypes/gameplay-b/src/battle/player-card-edit.ts`
- `prototypes/gameplay-b/src/runtime.ts`
- `prototypes/gameplay-b/src/view.ts`
- `prototypes/gameplay-b/tests/player-card-edit.test.ts`
- `prototypes/gameplay-b/tests/runtime.test.ts`
- `prototypes/gameplay-b/tests/battle-cards.test.ts`

## 验收标准

- [x] 默认目标仍遵循 `lowest.rows` 优先级；玩家可在该规则声明的所有合法行间改选，包含狙击、冲锋 / 射击与治疗 / 支援的敌我不同侧目标。
- [x] `all`、混合前后排、意图目标、候选组数量、重复 / 非法目标和所有 requirement 保持语义正确；仅允许确有替代组合的卡进入目标选择。
- [x] 改选行动后，候选自身与其他角色行动均按替换后的完整行动集校验；失去目标合法性的行动原子回落到观察 / 待机并退还 round-start 费用。观察后结算按正常 sCost 规则恢复，且无双重收费。
- [x] 多个依赖行动连锁失效时，回落顺序固定、结果稳定且每张卡只回落一次；无法通过回落保持技能绑定时，本次编辑无副作用地拒绝。
- [x] 非法 drop、错误目标数、终局或无 pending round 编辑请求仍不修改 Runtime；输入快照不被变异，rngCursor、Click/event/route state 保持不变。
- [x] 一次有效编辑仅替换己方普通行动或明确允许的免费技能目标，最终卡片、关系线及 CardTag recipe plan 同步更新；回落反馈能指出角色与原卡。
- [x] 新增 / 更新玩法 B 定向 Vitest 覆盖目标池、依赖失效与回落、sCost 返还、技能冻结边界及非法输入原子性；玩法 B typecheck 与独立 build 通过。

## 验证

在 `prototypes/gameplay-b/` 运行定向 `npm test -- player-card-edit`、`npm test -- runtime`、`npm test -- battle-cards`、`npm run typecheck` 与 `npm run build`。归档前补写实际执行结果、未执行项目及回归边界。

## 受影响 Entry 维护授权

按 `AGENTS.md` 的 GALHCG 项目地图约定，完成前确认项目身份并只读检查本 Task 变更文件的直接 Evidence owner / `maps_to` Concept。Task 文档归档时仅刷新其原路径和归档目标路径的文件清单。允许更新已有直接关联 Entry 的 Evidence version token 与 freshness；不新增节点、边或语义关联。

## 非目标

- 修改 AC Runtime、`src/` 或游戏主项目 UI。
- 改写已结算回合、敌方意图、角色 HP/行/阵营、技能骰值或重掷冻结技能。
- 改变 `all` / `front-and-lowest-rear` / `intent-target` 的效果范围、CardTag 配方语义、随机算法、场所卡和路线有限卡组。
- 无合法目标时自动重选另一张攻击卡，或对错误拖放静默消费回合。
