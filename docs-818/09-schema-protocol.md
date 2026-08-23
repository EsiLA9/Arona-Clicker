# 09 — 实体类型 → 数据包编辑器 同步协议（Schema 描述协议）

---

## 要解决的问题

[[src/engine/types/entities.ts]] 定义引擎数据结构（关系隐含在 TS 类型里），而编辑器 Schema 需中文标签、
引用表、枚举含义、条件/效果 tagged 联动等"含义群"——两份真相靠人肉同步易漂移。

**方案**：Schema 描述协议（defMap + defs + editor-extras 拼合），引擎侧声明即导出，测试兜底。

---

## 1. 协议数据流

```
src/engine/types/**（接口 = 结构真相 + 简单含义 TSDoc @label/@enum/@ref/@int）
        │  npm run gen:schema（[[scripts/gen-engine-schema.mjs]]：AST 解析；defMap 派生自 Datapack 接口）
        ▼
[[tools/datapack-editor/schema/engine-defs.gen.json]]   ← 协议载体（提交入库）
        │  { defMap（Datapack 数组/record 字段 → 实体类型）, defs（各实体字段定义 + hand 占位） }
        ▼
[[tools/datapack-editor/schema/merge.ts]]  buildTables()
   = 生成 defs ⊕ [[tools/datapack-editor/schema/editor-extras.ts]]（复杂/仅编辑语义运行时兜底）
        ▼
[[tools/datapack-editor/schema/datapack.schema.ts]]  export const TABLES   （editor/validate/ui 消费方式不变）
        ▼
[[tools/datapack-editor/schema/engine-schema.sync.test.ts]]  三向一致检查（引擎字段↔协议↔editor 表，新增未同步 → error 红灯）
```

---

## 2. 分层规则

| 层 | 内容 | 声明位置 |
|----|------|----------|
| 结构 + 简单含义 | 字段 kind（string/float/enum/ref/array/record/extra）、必填、中文 label、扁平枚举含义 | 引擎类型 TSDoc（`@label` / `@enum 值=中文` / `@ref <表>` / `@int` / `@group`）→ 生成器提取 |
| 复杂 / 仅编辑需要 | 条件/效果/表达式 tagged 联动、引用表精修、optionsFrom 动态枚举、int/float 精修、collapsible、divider 分组、storyEntries/stories/extras 整表 | [[tools/datapack-editor/schema/editor-extras.ts]] 的 `TABLE_META.overrides` / `custom` |
| 合并 | override > 生成 defs > hand 占位（残留 hand = 同步遗漏） | [[tools/datapack-editor/schema/merge.ts]] |

---

## 3. 常见操作

### 新增一个简单字段

```ts
export interface SpotDef {
  ...
  /** @label 展示排序 @int */
  displayOrder?: number;
}
```

→ `npm run gen:schema` → 编辑器自动获得该字段（int、中文标签），无需碰 editor 侧。

### 新增一个引用字段

```ts
/** @ref stories */
startStoryId?: StoryId;
```

`*Id` 别名已按命名约定自动映射为 ref（`StoryId→stories`、`SpotId→spots`…）；非标准命名用 `@ref` 显式声明。

### 新增枚举 + 中文含义

```ts
/** @label 稀有度 @enum common=普通 @enum rare=稀有 */
rarity: 'common' | 'rare' | '...';
```

### 复杂字段（tagged 联动等）→ editor 运行时兜底

生成器对 `Effect` / `Condition` / `ValueExpression` / `RevealTrigger` / `StoryDef` 等输出 `hand` 占位；
在 [[tools/datapack-editor/schema/editor-extras.ts]] 对应表 `overrides` 里给该字段提供真实 FieldDef
（复用 `effectArray` / `cg` / `valueExpressionField` / `revealTriggersField` 等构建器）。
残留未覆盖的 `hand` 字段 → 同步测试报错。

### 删除/重命名字段

`npm run gen:schema` 后同步测试会发现 editor 侧覆盖了不存在的字段（防 editor 私加引擎不认的字段）。

---

## 4. 协议文件

| 文件 | 职责 |
|------|------|
| [[scripts/gen-engine-schema.mjs]]（+`.d.mts`） | 解析器（导出 `parseEngineSchema()` 供测试复用）+ `--write` 写 JSON |
| [[tools/datapack-editor/schema/engine-defs.ts]] | 协议 TS 形状 + JSON 加载 |
| [[tools/datapack-editor/schema/editor-extras.ts]] | `TABLE_META`（13 表元数据 + overrides + custom） |
| [[tools/datapack-editor/schema/merge.ts]] | `buildTables()` |
| [[tools/datapack-editor/schema/engine-schema.sync.test.ts]] | 一致性测试（defMap 覆盖、字段覆盖、hand 覆盖、覆盖 key 合法、ref 合法、枚举选项完整） |

---

## 5. 纪律

改 [[src/engine/types/]] 的实体字段/枚举后**必须** `npm run gen:schema`；
复杂/仅编辑字段在 `editor-extras.ts` 兜底；`engine-schema.sync.test.ts` 三向一致为 error 红灯。
