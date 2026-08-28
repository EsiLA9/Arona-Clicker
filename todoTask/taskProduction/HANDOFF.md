# HANDOFF — Phase 6 交接文档（taskProduction）

> 交接时间点：Phase 6（显式四级层级树）已完成并提交（commit `901713b`），工作区干净。
> 下一步执行者从 **Phase 7 死代码清理** 开始，按「剩余工作」清单继续即可。

---

## 1. 总体进度

| Phase | 状态 | commit |
| --- | --- | --- |
| Phase 0 行为快照 | ✅ | `1faf5c3` |
| Phase 1 统一区表真相（删 childMulMap） | ✅ | `b558235` |
| Phase 2 单生产路径（删旧 tick 路径） | ✅ | `975c3a9` |
| Phase 3 收敛双表达式系统（删 9 算子） | ✅ | `6132636` |
| Phase 4 Affector 正确性 | ✅ | `c181cfb` |
| Phase 5 事件驱动精确失效（删每帧 invalidate） | ✅ | `d2c2848` |
| Phase 6 显式四级层级树 + flows 层级分发 | ✅ | `901713b` |
| **Phase 7 死代码清理** | **← 下一步** | — |
| Phase 8 收尾（文档同步） | 未开始 | — |

验收基线：`npm test` 90 文件 920 测试全绿；`npx tsc --noEmit` 通过。
任务书：`todoTask/taskProduction/TASK.md`（Phase 7 在 §224-236）；执行报告：`todoTask/taskProduction/REPORT.md`。

## 2. 当前架构要点（Phase 5/6 落定，改动前必读）

### 2.1 显式四级层级树（Phase 6）

每资源一棵树，节点全部在 `game-num-build.ts` 构造：

```
primitiveGain:<res> = globalProduct(×globalMulZone) + globalFlat + globalFlows
initFull  = (Σ areaProduct) × initMulZone + initExtra
areaFull  = (Σ spotProduct) × areaMulZone + areaExtra
spotFull  = spotBase × spotMulZone + spotExtra
```

- **乘区只乘下一级 base 链**：spotProduct / areaProduct 进上级 base 和，逐级连乘（旧 hierarchy 组内相加语义已废止）。
- **flat/flows 不进乘区**：spotFlat 经 `spotFlatGated`（owned 门控）进 spotExtra；flows 不受 owned 门控。
- **spot 子树在所有资源树统一构建**：非本资源树中 spotBase 恒 0（const），仅承载跨资源 flows；孤儿 spot（registry 无 area/init 链，见 game-num.test P1-2 fixture）base 链直挂根。
- **flows 按 mountEntityId 层级分发**（`ensureFlowsNodes` 幂等创建）：spot → spotExtra；area/init → 各自 Extra；enhancement/item 等非层级实体 → 资源树根的 global flows 兜底节点（`affectorFlows` 节点带 `mount?` 字段，求值时过滤）。

### 2.2 构建期不变量（⚠️ 违反即出隐蔽 bug，Phase 6 已踩过三次）

1. **每个 children.push 必须配 setParent(child, parent)**——`markDirty` 沿 `parents` 向上传播，漏设父指针 = 该子树变化时上层缓存不失效（陈旧读）。
2. **求值可达性走 children，失效传播走 parents，两者都要接**——`initExtra.children` 漏 push `areaExtra` 曾导致 flat/flows 无法上抛到总产出。
3. 改动 build 后跑 `tests/engine/game-num-invalidation.test.ts`（7 条陈旧读回归，覆盖完整父链）。

### 2.3 事件驱动失效契约（Phase 5）

- tick 不再每帧 `invalidateProduction()`；状态变更必须走 `StateMutationService`（事件 → 定向或全树失效）。
- `resourceChanged` 三路定向：`gainResourceDeps`（markSubtreeDirty 向下）+ `zoneKeyResourceDeps`（markZoneDirty 反查）+ `flowsResourceDeps`（flows 节点 markDirty 向上）。
- `zoneKeyResourceDeps` / `flowsResourceDeps` 为只增不减的过标记设计（漏标记安全、多标记无害）。
- Affector 翻转链：mount/unmount/recheck → `notifyGameNum` → `onAffectorInstancesChanged`（重同步区表 + 补 flows 节点 + 全部 flows 失效）。

## 3. Phase 7 待办清单（按 TASK.md §224-236）

1. **[G] `named` 注册表**（game-num.ts `named`/`register`/`evaluateByName`/`hasNamed`/`getNamedNumbers`）：全库无消费者 → 删除；若保留需写明理由。删前 grep 确认（含 tests/）。
2. **[G][A] `clearTagEffectsByLife` + `life` 字段三选一**（TASK.md 倾向删除，按 AGENTS.md「不做存档迁移」）：
   - `TagEffectRecord.life`（tag-effect.ts:29，PlayerState 内部字段）；
   - `ZoneModifierDecl.life`（tag-effect.ts:59，**数据包字段**——删除后必须 `npm run gen:schema` 并检查 `tools/datapack-editor/schema/editor-extras.ts` 是否兜底声明了该字段）；
   - `AffectorPackBuilder.modTag/modEntity` 的 life 参数（affector-pack.ts:49,60）；
   - 消费点：`clearTagEffectsByLife`（game-num-tag.ts）与其调用方（grep `clearTagEffectsByLife` 找接线点，删除时一并清）。
   - 注意：base 数据 `src/data/base/datapack.ts` 的 modTag/modEntity 调用带 `'init'` 实参，删除参数后同步修改所有调用点。
3. **[A] `AffectorPackDef.persistent`**（trigger.ts:38）：删除，同步 schema（gen:schema）。
4. **[G] `zoneNodeById`**：收敛为 `buildZoneNode` 局部去重——评估是否能从 GameNumSystem 字段降为 build 模块内部（注意 `ensureFlowsNodes` 的 `flowsNodeById` 是另一个 Map，勿混淆；flowsNodeById 因 flows 节点动态创建而必须留在 system 上）。
5. ~~toValueNode 随机 id~~：已随 Phase 1 消失，无需处理。
6. **[A] `modTag`/`modEntity` 支持 ValueExpression**（docs-824/04h §4.3）；`describeValue` 参数名修正（04h §4.2）。
7. **验收**：`npm test` 全绿 + `npx tsc --noEmit` 通过 + grep 确认无残留引用；删除数据包字段则 `engine-defs.gen.json` 已重新生成（生成产物本身不手改）。

## 4. Phase 8 收尾（Phase 7 之后）

- 文档同步：`docs-824/02c-tick-loop.md`（capacity 语义、失效策略）、`docs-824/04b-production.md`（单一真相、zone 求值路径、四级层级树——失效策略表已在 Phase 5 更新过）、`docs-824/04f-trigger-effect.md`（Affector 桥接简化、flows 层级分发）、`docs-824/04h-affector-review.md`（标记已修复项）。
- `todoTask/taskGameNum/TASK.md` 标记完成状态；`todoTask/taskGameNum/tree-design.md` 标记「已实现」（注意：§2 图示的 `Σ areaBase` 与实作的 `Σ areaProduct`（逐级连乘）有出入，实作以 REPORT.md Phase 6 节的公式为准，标记时一并修正图示）。

## 5. 遗留风险与说明

- **funclet 求值链**：`value-system.ts:122` 将 `FuncletDef.calc`（类型 ValueExpression）强转 Value，运行时落 default 分支返回 0。与本任务无关，建议独立任务修复。
- **层级树规模**：spot 子树在所有资源树统一构建，节点数 O(spots × resources)，当前规模无感知；数据包显著增长时可按「本资源 spot ∪ 有 flows 挂载的 spot」惰性裁剪。
- **跨树 zone 节点**：无 resource 限定的 zone 节点（global/area/init scope）在资源树间共享（zoneNodeById 去重）；spot scope 节点带 resource 限定按树独立。失效标记可能跨树过标记（无害）。
- `src/data/Hoshino.png` 未跟踪文件与本任务无关，待用户定夺入库或忽略。
- 工作区如出现 `docs-824/04f-trigger-effect.md` 的「假改动」（git diff 为空、仅 CRLF 行尾警告），为行尾规范化误报，可忽略或 `git checkout` 还原。
