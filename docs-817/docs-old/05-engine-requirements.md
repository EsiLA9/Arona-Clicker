# 引擎需求

## 核心能力

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 数据驱动配置 | 从数据包模块加载所有游戏内容定义（实体表格） | 必须 |
| 注册表索引 | 按 `modId:type:id` 三段式键值索引所有实体 | 必须 |
| 数值表达式求值 | 对 Value 表达式树递归求值 | 必须 |
| 条件表达式求值 | 对 Condition 表达式树递归求值 | 必须 |
| 状态修改执行 | Funclet 操作顺序执行 | 必须 |
| Tick 循环 | 驱动 Spot 自动产出 | 必须 |
| 事件系统 | 游戏数据/数值变更的反射服务（派生系统重算），不承担 UI 通知 | 必须 |
| 效果系统 | 效果激活、聚合、缓存编译 | 必须 |
| Affector 系统 | 效果体生命周期管理（挂载/状态机/派生），统一数值+操作权+可见度+流程 | 必须 |
| 可见性系统 | 条件驱动的实体渐进显示 | 推荐 |
| 存档系统 | localStorage 序列化/反序列化 | 必须 |
| 多存档位 | 支持 3 个存档位独立存储 | 推荐 |
| 剧情演出器 | Talklet 序列顺序演出、简单分支、选项跳转 | 必须 |
| 随机抽选 | PassiveStory 按权重随机抽取 | 必须 |
| 物品系统 | ItemDefinition 定义、背包存储、分类管理 | 必须 |
| 掉落表 | DropTable 加权随机抽选、条件掉落、保底 | 推荐 |
| 物品使用 | 使用条件检查、useEffect 执行、数量减少 | 必须 |
| 查询增强 | 按类别/标签查询实体、获取依赖实体列表 | 推荐 |
| Init 切换 | 世界线切换，非持久数据重置 | 必须 |

## 非目标（明确不做）

- 热加载 / 实时重载数据包：游戏初始化时一次性加载
- 模组补丁系统（append/merge/replace-field）：不做
- 类型兼容性适配/旧 ID 迁移：不做
- 多语言/本地化引擎：使用硬编码语言
- 动画引擎：纯文本 + CSS 过渡
- 音效/音频引擎：留空，不做
- 网络/后端服务：纯单机离线
- 性能分析/调试工具：不作为引擎内置功能

## 性能要求

| 指标              | 目标      | 说明                                  |
| --------------- | ------- | ----------------------------------- |
| 同时活跃 Spot 数     | ≤ 100   | 每个 Init 的 Spot 总数上限                 |
| 同时活跃 Effect 数   | ≤ 200   | 包括 Spot、Enhancement、Character 贡献的效果 |
| Tick 间隔         | 1000ms  | 精确到秒级即可，前端 setInterval              |
| 剧情 Talklet 数/故事 | ≤ 200   | 单个 Story 的 Talklet 上限               |
| 存档大小            | < 200KB | 含背包后预估上限                         |
| 初始化加载时间         | < 500ms | 加载全部数据包 + 构建索引                      |
| 单 Tick 计算       | < 5ms   | 全部 Spot 产出计算 + 效果编译（增量）             |

## 扩展点

| 扩展点 | 方式 | 说明 |
|--------|------|------|
| 数据包内容 | 向 `Datapack` 数据结构添加新数组字段 | 新增实体类型只需定义新数组并补充 Registry 索引 |
| 自定义 Funclet | 通过 `Custom` 类型 + 外部 handler 注册表 | 无需修改核心引擎即可扩展操作类型 |
| 存储后端 | 实现 `StorageBackend` 接口 | 默认 localStorage，可替换为 IndexedDB 等 |
| 存档迁移 | 存档中 `version` 字段 + 迁移函数表 | 当数据结构变化时可编写升级脚本 |

## TS 模块结构建议

```
src/
├── engine/
│   ├── registry.ts          // 注册表（含按类别/标签查询增强）
│   ├── event-bus.ts         // 事件总线
│   ├── value-system.ts      // 数值求值（含 ItemCount）
│   ├── condition-system.ts  // 条件求值（含 HasItem）
│   ├── funclet-executor.ts  // 函数执行（含物品操作）
│   ├── effect-engine.ts     // 效果引擎
│   ├── affector-engine.ts   // 效果体引擎（生命周期 + 四类派生）
│   ├── visibility-engine.ts // 可见性引擎
│   ├── tick-system.ts       // Tick 循环
│   ├── loot-system.ts       // 掉落表抽选
│   └── game-instance.ts     // 核心运行时（含物品/效果体 API）
│
├── data/
│   ├── base/                // 基础数据包
│   │   ├── resources.ts
│   │   ├── inits.ts
│   │   ├── areas.ts
│   │   ├── spots.ts
│   │   ├── enhancements.ts
│   │   ├── characters.ts
│   │   ├── stories.ts
│   │   └── datapack.ts      // 组合为 Datapack 对象
│   └── index.ts             // 所有数据包汇总
│
├── save/
│   ├── types.ts             // SaveData 类型
│   └── storage.ts           // localStorage 封装
│
├── story/
│   ├── player.ts            // Talklet 演出器
│   └── store.ts             // 故事状态管理
│
├── ui/
│   ├── GameUI.ts            // 主 UI 入口
│   ├── components/          // UI 组件
│   └── styles/              // CSS
│
└── main.ts                  // 入口，初始化引擎 + UI
```

此模块结构是**建议**而非强制——引擎核心（engine/ 目录）内容固定，外围模块可根据开发习惯调整。
