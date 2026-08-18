# 开发路线图

## MVP（最小可行产品）

**目标**: 核心放置循环可用 + 一条完整剧情线 + 基本的引擎架构

### MVP 功能清单

- [ ] **注册表** — 数据包加载 + 索引构建
- [ ] **事件总线** — 数据反射（数值/游戏数据变更 → 派生系统重算），不承担 UI 通知
- [ ] **数值系统** — Value 表达式求值
- [ ] **条件系统** — Condition 表达式求值
- [ ] **Funclet 执行器** — 状态修改
- [ ] **Effect 引擎** — 效果激活与缓存
- [ ] **游戏实例** — Tick 循环、Spot 产出、资源管理
- [ ] **存档系统** — 序列化/反序列化
- [ ] **基础数据包** — 1 个 Init、3-5 个 Area、10-15 个 Spot、5-10 个 Enhancement
- [ ] **Playable UI** — 三栏布局、资源面板、Spot 购买/升级、Area 移动

> 本文档是目标功能路线，不代表当前 `src` 已全部完成。当前实现基线、编译阻塞和实际迁移顺序以 [[10-implementation-roadmap]] 为准。


### MVP 仍需完成

- [ ] **剧情演出器** — Talklet 顺序演出、分支选择、结束奖励
- [ ] **角色系统 UI** — 角色列表、解锁动画、加成显示
- [ ] **与现有引擎集成** — 将 Story/Character 系统接入 GameInstance
- [ ] **被动剧情（聊天）抽选** — 权重随机 + 界面交互
- [ ] **物品系统** — ItemDefinition 实体、背包存储（Map<itemId, count>）
- [ ] **Condition 扩展** — HasItem 条件类型
- [ ] **Funclet 扩展** — GiveItem / RemoveItem / RollDropTable
- [ ] **掉落表系统** — DropTable 加权随机抽选
- [ ] **Registry 查询增强** — queryByCategory / queryByTags / getDependents
- [ ] **背包 UI** — 物品列表、使用、出售界面
- [ ] **UI 打磨** — 使 UI 从"可工作"变为"可看"
- [ ] **Init 切换流程** — Init 选择界面、继承/重置逻辑

### MVP 不包含

- 多数据包模组支持（先硬编码数据包，后期扩展）
- 离线收益计算（先简单折半）
- Init 间继承系统（先每个 Init 独立）
- 多个 Init 同时进行的进度管理
- 复杂装备系统（物品分类不含 equipment）

## 迭代计划

### Phase 1: 剧情与角色集成（当前阶段）

- **目标**: 完成 MVP 剩余功能，让游戏成为完整的"放置 + 剧情"体验
- **功能**:
  - 完成 Story 演出器
  - 完成 PassiveStory 抽选
  - 完成 Character 系统接入
  - 完成 Init 切换
  - 完成 **物品背包系统**（ItemDefinition + LootSystem + 背包 UI）
  - 完成 **Affector 效果体系统**（AffectorEngine 生命周期 + 四类派生，替代散落的 effects 字段）
  - 完善基础数据包（含物品、掉落表、效果包装定义）
- **预计工时**: 60-80 小时
- **产出**: 可游玩至"完成第一个 Init"的完整版本（含物品收集与效果体系统）

### Phase 2: 内容填充

- **目标**: 用真实 Blue Archive 同人内容填充游戏
- **功能**:
  - 编写 3-5 个 Init 的内容（如 VOL.1 对策委员会、VOL.2 游戏开发部等）
  - 每个 Init 设计 3-5 个 Area
  - 编写 10-20 个 ActiveStory（每个 20-50 个 Talklet）
  - 编写 30-50 个 PassiveStory
  - 设计 10-15 个可解锁角色
  - 平衡 Spot 产出曲线和价格曲线
- **预计工时**: 80-120 小时（主要是编剧和数值设计时间）

### Phase 3: 体验打磨

- **目标**: 优化 UI、交互、离线体验
- **功能**:
  - UI 主题适配 Blue Archive 风格（蓝色调、圆角卡片）
  - 角色立绘/头像引入（如有素材）
  - 离线收益展示（开场弹窗）
  - 通知系统（离线时触发了哪些剧情、获得了多少奖励）
  - 故事回顾功能
  - 性能优化（缓存、减少不必要的 re-check）
  - 移动端适配（响应式布局）
- **预计工时**: 30-50 小时

### Phase 4: 扩展（可选）

- **目标**: 增加模组/数据包生态能力
- **功能**:
  - 数据包定义为纯 JSON 文件，支持从外部加载
  - 内容编辑器（直接在浏览器中编辑数据包并导出）
  - 多存档位管理（界面化）
  - 统计面板（各 Init 进度、累计数据）
  - 更丰富的剧情演出（立绘显示、场景背景、BGM 占位）
- **预计工时**: 40-60 小时

## 技术风险

| 风险                             | 影响          | 缓解措施                               |
| ------------------------------ | ----------- | ---------------------------------- |
| 剧情内容量过大，编写耗时超出预期               | Phase 2 延长  | 先聚焦 1-2 个 Init，确保质量而非数量            |
| 数值平衡失调（Spot 产出 vs 价格曲线）        | 玩家失去耐心或进程过快 | 参数配置化，预留调整空间；初期使用保守的指数曲线           |
| 纯前端存储容量不足（localStorage 5MB 限制） | 存档功能受限      | 预估 <200KB/存档（含背包），3 档 <600KB，远低于限制 |
| 与 Blue Archive 版权素材使用边界不清晰     | 发布合规问题      | 不使用官方素材，全部使用自制文字 + 占位图标            |

## 现有代码基础上的开发建议

当前 `src` 已有 Registry、EventBus、Value/Condition、GameInstance、基础 Effect/Tick/Loot/Visibility/Character 与 Persistence 原型，但 TypeScript 构建仍失败，Affector、完整 Funclet、正式 UI 和完整剧情尚未实现。详细迁移顺序见 [[10-implementation-roadmap]]。

1. **优先完成 Story 系统** — story-player.ts（Talklet 演出）+ story-store.ts（剧情状态管理）
2. **接入 PassiveStory 到 GameInstance** — 添加 triggerPassiveStory API
3. **接入 Character 到注册表** — 利用已有 EffectEngine 实现角色加成
4. **实现物品系统** — ItemDefinition 注册表索引、HasItem 条件、物品 Funclet、LootSystem 模块
5. **实现 Affector 效果体系统** — AffectorEngine（生命周期状态机 + 四类派生），迁移 Spot/Enhancement/Character 的 effects 字段为 affectorPacks
6. **完善 Init 切换** — enterInit 逻辑 + Init 选择界面（背包物品 + persistent 包装继承）
7. **实现背包 UI** — 物品列表展示、使用/出售按钮、掉落动画反馈
8. **内容编写** — 用真实剧情替换 sample datapack（含物品、掉落表、效果包装设计）
9. **UI 美化** — 根据 Blue Archive 风格定制主题
10. **测试与平衡** — 跑通完整游戏流程，调整数值
