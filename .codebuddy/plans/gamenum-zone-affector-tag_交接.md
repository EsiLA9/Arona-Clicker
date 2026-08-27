---
name: gamenum-zone-affector-tag-交接
overview: GameNum 节点级脏位 + childMulMap 命名乘区重写任务的进度交接。说明任务内容、已落地代码、当前回归与待办。
status: handoff
---

# GameNum Zone / Affector Tag 重写 —— 进度交接文档

> 编写时间：2026-08-25
> 交接人：本轮实现（未完成，因负担过大移交）
> 关联计划：`.codebuddy/plans/gamenum-zone-affector-tag_e532708a(未完成).md` （⚠️ 该旧计划是「ZoneRegistry 表」方案，与当前已落地的「节点 childMulMap + 脏位」方案**冲突**，以本交接文档与 `plan.md` 里的激活计划为准）

---

## 一、任务大致内容

在保持 `number` 底层存储前提下，重写 GameNum 数值系统，引入两项核心能力：

1. **节点级脏位（dirty flag + deps 反向图）**：源变动只标记受影响节点及其祖先，读取时才重算，替代旧 `productionCache.clear()` 整表失效。
2. **命名乘区（childMulMap）**：`mul`/`zone` 节点持有 `childMulMap: Map<zoneName, GameNum[]>`，乘区值统一为 `1 + Σ(贡献)`，区内累加、区与区相乘；预置 `defaultMul`/`defaultAddMul`，支持任意命名乘区（vip/event/manager…）与 `bound` 上下限。累乘区以单条贡献 `(f-1)` 并入同一 `1+Σ` 框架。
3. **逐级构建树**：`primitiveGain:资源 = add(各 spot 子树, affectorFlows)`；每个 spot 子树 `= mul(owned, baseLine(add(base, levelLinear), zone:flat), zone:mul)`；Init/Area 级乘区由 `ZoneModifierDecl.target`（tag/entity）命中后汇入对应节点 childMulMap（tag 走 `tagPrefixesBottomUp`，entity 走精确键 + `*通配`）。
4. **Affector 桥接**：`syncAffectorZoneEffects` 把 Affector 包的 `zoneModifiers` 转写为 childMulMap 贡献；`registerTagEffect`/`registerEntityEffect` 区表保留做来源注册，并增量汇入 childMulMap。
5. **保留对外 API 签名**：`evaluateResourceGain` / `evaluateSpotYield` / `getSpotMultiplier` / `evaluateByName` / `evaluateWithBreakdown` 不变。

---

## 二、已落地内容（代码现状，真实可读）

文件：`src/engine/expression/game-num.ts`、`game-num-eval.ts`、`tag-effect.ts`；`src/engine/effect/affector-engine.ts`；`src/engine/game-instance.ts`

- [x] `GameNum` 类型新增 `dirty`/`cached`/`childMulMap`/`bound`（game-num-eval.ts:37-60）。
- [x] `zoneValue()` 与 `mul` 节点求值消费 childMulMap，`mul = Π(1+Σ贡献)`，flat = Σ，bound 夹取（game-num-eval.ts:167-228）。
- [x] `GameNumSystem` 构建树 `buildAll`：枚举资源 → `primitiveGain` → 每 spot 子树挂 `defaultMul`/`defaultAddMul`（game-num.ts:206-207、246）。
- [x] `markAllDirty` / `markDirty(node)` 沿 parents 上溯标脏（game-num.ts:338-358）。
- [x] 事件订阅：`enhancementAdded/enhancementRemoved/spotTagChanged/spotLevelChanged/managerChanged/extraChanged/resourceChanged` → invalidate +（enh/spotTag/spotLevel 时）`syncAffectorZoneEffects`（game-num.ts:99-120）。
- [x] `tick()` 内 `gameNumSystem?.invalidateProduction()` 每帧刷缓存（game-instance.ts:493 附近）。
- [x] `syncAffectorZoneEffects`：对活跃 Affector 实例先 `removeTagEffectsBySource` 再重加，处理 tag 变化后残留（game-num.ts:516-536）。
- [x] `tests/engine/game-num.test.ts` 25/25 通过（节点脏位、childMulMap、1+Σ、bound、(f-1) 累乘、增量失效断言均已覆盖）。

---

## 三、当前回归（整库 9 failed / 618，6 个文件）

### A. 与本任务直接相关（必须修复才算完成）

| 测试 | 失败信息 | 推测根因 |
|---|---|---|
| `tests/engine/spot-tag.test.ts` > removing a tag disables | `8.25 to be 7` | 撤出 office tag 后，tag 作用乘区贡献未从 spot 的 mul 节点 childMulMap 撤回，仍按 `5×1.25+2` 计算 |
| `tests/engine/spot-tag.test.ts` > adding a tag enables | `8 to be 10` | 加入 office tag 后，乘区贡献未汇入 childMulMap，仍按 `8`（无 ×1.25） |
| `tests/engine/game-instance.test.ts` > should mount/apply/… (3 条) | `false to be true` / `+0 to be 100` | `purchaseEnhancement` 返回 false（credit 不足，与 `enhancements.ts` 价格被改写有关），或 affector 挂载后乘区未生效 |

> 调查笔记：`addSpotTag` 确实 emit `spotTagChanged`（spot-service.ts:227），`game-num.ts` 已订阅；`syncAffectorZoneEffects` 也做了先撤后加。**疑点**：`routeToZoneNodes` / tag→spot mul 节点的路由是否真正命中，或 zone 节点与 spot 子树 mul 节点的 childMulMap 是否同一份引用。建议下一位先在此处打断点或单测 `syncAffectorZoneEffects` 后直接 inspect spot 节点 childMulMap 内容。

### B. 协议漂移（需 gen:schema）

| 测试 | 失败信息 |
|---|---|
| `tools/datapack-editor/schema/engine-schema.sync.test.ts` | `enhancements.productionTags 覆盖了 engine 类型中不存在的字段（请先补 types 或移除该覆盖）` |

> `src/data/base/enhancements.ts` 本次被大量改写（141 增 / 216 删，含价格变动）。`productionTags` 字段在 `editor-extras.ts` 有覆盖但 `src/engine/types/**` 无对应类型。处理方式二选一：① 在 types 补 `productionTags` 字段后 `npm run gen:schema`；② 移除 editor-extras 的该覆盖。需确认这是本任务引入还是既有。

### C. 疑似既有、需先确认是否本任务引入（用 git stash 对照）

| 测试 | 失败信息 | 备注 |
|---|---|---|
| `tests/engine/character-freeze.test.ts` > 青辉石量产 | `false to be true` | purchase 失败，疑似价格/条件数据问题 |
| `tests/engine/enhancement-reveal.test.ts` > office_layout reveal | stage `purchaseable` vs `partial` | 揭示阶梯逻辑，可能与 Enhancement 数据改写有关 |
| `tests/engine/passive-pool.test.ts` > Talklet 移动 | `schale_main` vs `schale_library` | travelToArea 区域归属，疑似与 Character 重构数据无关 |

> 这三条失败信息与「数值乘区/脏位」无直接关系，更像是 `enhancements.ts`/`character-rework.ts` 数据改写的副产物。交接者请先 `git stash` 本任务改动后跑这三文件，确认是否本任务引入；若既有则不在本任务范围（但不得新增失败）。

---

## 四、还需完成的内容（待办清单）

1. **[必须] 修复 spot-tag 两条回归**：确认 `syncAffectorZoneEffects` 在 `spotTagChanged` 时，tag 命中 spot mul 节点的贡献能正确「撤回旧 spot / 重加新 spot」。重点查 `routeToZoneNodes`（game-num.ts:436 附近）与 spot 子树 mul 节点 childMulMap 引用一致性。
2. **[必须] 修复 game-instance 三条回归**：确认 Affector 挂载后乘区真正汇入并生效；区分是「purchase 价格数据」问题还是「乘区未合入」问题。
3. **[必须] 处理 `engine-schema.sync.test.ts` 漂移**：补 types 的 `productionTags` 并 `npm run gen:schema`，或移除 editor-extras 覆盖。
4. **[确认] 用 git stash 对照 character-freeze / enhancement-reveal / passive-pool 三条**，判定是否本任务引入；若是则一并修，若否则标注「既有，不修」。
5. **[收尾] 全库 `npm test` 通过 + `npx tsc --noEmit` 无错 + `npm run gen:schema`（若改 types）**。
6. **[文档] 同步 `docs-818/`**：GameNum 数值结构、命名乘区语义、脏位机制说明；并删除/更新 `.codebuddy/plans/gamenum-zone-affector-tag_e532708a(未完成).md` 那份冲突的旧「ZoneRegistry 表」方案，避免后续误解。

---

## 五、给下一位的关键提示

- **两套计划冲突**：`.codebuddy/plans/gamenum-zone-affector-tag_e532708a(未完成).md` 是旧方案（独立 `tag-registry.ts`/`zone-registry.ts` 模块 + zone 叶子查表）；当前代码已实现的是「节点 childMulMap + 脏位」方案（与激活的 `plan.md` 一致）。**以当前代码为准，旧计划作废。**
- **不要引入第二种乘积语义**：累乘区必须写成贡献 `(f-1)` 并入 `1+Σ`，不要新增 `product` 分支。
- **AGENTS.md 纪律**：状态变更走 `StateMutationService`；改 `src/engine/types/**` 必 `npm run gen:schema` 且同步 `editor-extras.ts`；禁止存档迁移代码；机制改动带 vitest。
- **调试入口**：`game-num.test.ts` 已绿，可作为 childMulMap / 脏位 / 1+Σ 的行为参照；spot-tag 测试是 tag 动态变化回归的最小复现。
- **当前工作树已 modified 的文件**（与本任务相关）：`src/data/base/enhancements.ts`、`src/data/base/character-rework.ts`、`src/engine/effect/affector-engine.ts`、`src/engine/effect/affector-text.ts`、`src/engine/expression/game-num.ts`、`src/engine/expression/game-num-eval.ts`、`src/engine/expression/value-system.ts`、`src/engine/game-instance.ts`、`tests/engine/game-num.test.ts`。其中 `enhancements.ts`/`character-rework.ts` 改动量最大，是多数数据类失败的根源候选。

---

## 六、验证命令

```bash
npm test                                    # 全库
npx vitest run tests/engine/game-num.test.ts
npx vitest run tests/engine/spot-tag.test.ts
npx tsc --noEmit
npm run gen:schema                          # 仅当改了 src/engine/types/**
```
