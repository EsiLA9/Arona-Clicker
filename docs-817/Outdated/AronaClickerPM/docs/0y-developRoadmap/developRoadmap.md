# 基本引擎功能实现

## 基本数值元
- [ ] Value 类型系统的判别式联合定义（`types.ts` 已有）
- [x] 字面量: `const`
- [x] 资源查询: `resource` / `resource_gained_total` / `resource_gained_init`
- [x] 标记查询: `flag` / `context_flag`
- [x] 实体等级查询: `spot_level` / `enhancement_level`
- [x] 游戏状态: `tick`
- [x] 统计查询: `stat` (total_clicks / total_story_seen) / `tag_stat`
- [x] Condition 类型系统的判别式联合定义（`types.ts` 已有）
- [x] 字面条件: `always` / `never`
- [x] 逻辑组合: `and` / `or` / `not`
- [x] 数值比较: `cmp`（支持 eq/ne/gt/gte/lt/lte 六种 CompareOp）
- [x] 实体状态查询: `has_enhancement` / `has_spot` / `has_label` / `area_explored`
- [x] EvaluationContext 接口定义（player + runtime + contextFlags + labels）
- [x] Branded ID 类型: InitId / AreaId / SpotId / EnhancementId / ResourceId / EffectId / StoryId 等

## 基本数值元的运算
- [x] ArithmeticOp 六种运算: add / sub / mul / div / min / max
- [x] CompareOp 六种比较: eq / ne / gt / gte / lt / lte
- [x] Value `op` 递归组合节点（支持任意嵌套）
- [x] evaluateValue(value: Value, ctx: EvaluationContext): number 求值器实现
- [x] evaluateCondition(cond: Condition, ctx: EvaluationContext): boolean 求值器实现
- [x] PlayerStateRef / RuntimeCacheRef 等只读占位接口 → 实装为正式接口
- [x] 求值器单元测试覆盖所有 Value 叶子类型 + 递归 op 组合
- [x] 求值器单元测试覆盖所有 Condition 类型 + 逻辑短路

## Eventbus 系统
- [x] EventBus 类: publish / subscribe / unsubscribe
- [x] GameEvent 结构体（type + timestamp + data）
- [x] 事件类型枚举完整定义:
  - [x] 资源系统: resource/added, resource/removed, resource/total_changed
  - [x] Spot 系统: spot/purchased, spot/upgraded, spot/produced, spot/discovered
  - [x] Enhancement: enhancement/purchased
  - [x] Story 系统: story/started, story/talklet_played, story/ended, story/modified_state
  - [x] Area 系统: area/entered, area/explored
  - [x] Tag 系统: tag/collected, tag/triggered
  - [x] Init 系统: init/changed
  - [x] 引擎: tick/passed
- [x] 订阅生命周期管理（错误隔离、自动清理、防重复订阅）
- [x] 事件发布中的异常不应阻断其他订阅者

## Funclet 系统
- [x] Funclet 枚举类型实现（`types.ts` 已有类型定义）
  - [x] `add_resource` — 资源增减
  - [x] `set_player_flag` — 玩家 Flag 设置
  - [x] `give_spot` — 给予/解锁 Spot（含可选等级）
  - [x] `give_enhancement` — 给予/解锁 Enhancement
  - [x] `set_context_flag` — 语境 Flag 设置（字面量）
  - [x] `travel_to_area` — 区域旅行
  - [x] `play_story` — 触发故事播放
  - [x] `custom` — 扩展点
- [x] FuncList = Funclet[] 顺序执行数组
- [x] executeFunclet(f: Funclet, ctx: ExecutionContext): void 执行器实现
- [x] executeFuncList(funcs: FuncList, ctx: ExecutionContext): void 批量执行器
- [x] ExecutionContext 执行上下文构建（evalCtx + player + runtime + storyContext + pendingStory）
- [x] 执行原则：成功静默完成，失败静默跳过，不抛错、不阻断后续 Funclet
- [x] Funclet 执行后由引擎层统一发布事件，Funclet 自身不发布事件

## Affector（Effect）系统
- [x] EffectType 完整枚举:
  - [x] 产出修正: spot_production_multiply / spot_production_add / spot_interval_reduce
  - [x] 聊天修正: chat_reward_multiply / chat_reward_add
  - [x] 资源修正: resource_gain_multiply / resource_gain_add
  - [x] 故事权重: passive_story_entry_weight
  - [x] 探索/旅行: exploration_boost / travel_cost_reduce
  - [x] 可见性授予: reveal_entity / grant_purchase_access
  - [x] 遗留解锁: unlock_area / unlock_enhancement / unlock_story
  - [x] 扩展: custom
- [x] EffectTarget 作用域: global / init / area / spot
- [x] EffectDefinition 完整数据结构（id + type + target + operation + value + duration）
- [x] 效果叠加策略（同一 target 的 add/multiply/percent/set 操作语义）
- [x] 效果生命周期：永久效果 vs 限时效果（duration ticks）
- [x] 效果引擎：遍历已激活 Effect → 注入修正器到 RuntimeCache
- [x] 效果激活/失效时的事件发布

## 基本实体的 Registry 机制
- [x] 三层架构骨架搭建: Datapack → Registry → Instance
- [x] Datapack 格式定义（JSON 结构 + 原始类型定义）
- [x] Datapack JSON 加载器（文件读取 → 反序列化 → 结构校验）
- [x] Datapack 内容校验:
  - [x] 字段类型与完整性检查
  - [x] 跨数据包引用完整性（FullKey 解析前先检查）
  - [x] Value / Condition / FuncList 表达式合法性校验
- [x] Datapack 编译: idName → FullKey 补全（ModName/TypeName/idName）
- [x] Datapack 合并: 多包按 priority 覆盖（高 priority 字段级 merge）
- [x] GameRegistry 主索引: `Map<FullKey, Definition>`
- [x] 辅助索引:
  - [x] `byMod: Map<ModName, FullKey[]>`
  - [x] `byType: Map<TypeName, FullKey[]>`
  - [x] `byModAndType: Map<string, FullKey[]>`
  - [x] `areasByInit: Map<InitId, AreaId[]>`
  - [x] `spotsByArea: Map<AreaId, SpotId[]>`
  - [x] `effectsByTarget: Map<string, EffectDefinition[]>`
  - [x] `storiesByArea: Map<string, { active: string[]; passive: string[] }>`
  - [x] `enhancementsByCategory: Map<string, string[]>`
  - [x] `tagsByType: Map<string, Map<string, string[]>>`
- [x] 注册表查询 API: getDefinition / queryByType / queryByArea / queryByMod 等

## 基本实体的游戏内实例化
- [x] PlayerState 完整数据结构（继承并实作 layer-01 占位接口）
  - [x] resources: ResourcePool（资源持有量）
  - [x] resourceLog: ResourceLog（跨 Init 累计统计）
  - [x] flags: Record<string, number>（玩家全局 Flag）
  - [x] spots: Record<SpotId, SpotState>（已拥有 Spot 状态）
  - [x] enhancements: Record<EnhancementId, EnhancementState>（已解锁 Enhancement）
  - [x] areaStates: Record<AreaId, AreaState>（区域状态）
  - [x] tagStats: Record<string, TagStat>（Tag 统计）
  - [x] currentInit: InitId / currentArea: AreaId
  - [x] totalClicks / totalStorySeen
- [x] SpotState: level + lastProductionTick
- [x] EnhancementState: unlocked + active
- [x] AreaState: discovered + unlocked + explorationProgress
- [x] RuntimeCache 运行时缓存（currentTick + spotProductionCache + activeEffects + isHibernating）
- [x] GameInstance: GameState = { config, player, tick, registry }
- [x] 实例初始化流程: 选择 Init → 构建初始 PlayerState → 注入初始资源/Spot
- [x] Init 切换时的状态继承规则（哪些资源/Flag/Tag 跨 Init 保留）
- [x] Area 旅行逻辑（路径合法性校验 + 状态切换 + 事件发布）

## 游戏简单功能验证
- [x] Tick 循环运行验证：自动产出计算 → 资源累加 → 事件发布 全链路正确
- [x] EventBus 事件收发 + 订阅生命周期 验证
- [x] Funclet 执行 → 状态修改 → 事件发布 全链路验证
- [x] Spot 购买 → 升级 → 自动产出 → CostScaling 递增 完整流程
- [x] Effect 激活 → 产出加成正确性验证（mutiply / add / interval_reduce）
- [x] Condition 驱动可见性/解锁验证（自动发现流程）
- [x] 简单存档 → 读档 → 状态一致性验证（PlayerState 序列化/反序列化）
- [x] 手工构建 minimal datapack（1 Init + 1 Area + 2 Spot + 1 Enhancement），端到端通过