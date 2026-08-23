# 07 — Data Pack System 数据包系统

---

## 1. 数据包加载流程

**入口**：[[src/engine/game-instance.ts]] `init()`

```
game.init([datapack])
  ├─ Registry.load(datapack)
  │   ├─ validate()    校验 ID 唯一、引用完整、Extra 合法
  │   └─ merge()       合并到内存 Map + 关系索引
  ├─ AffectorEngine.load(affectorPacks)
  ├─ TriggerSystem.load(triggerDefs)
  ├─ ValueSystem.setFuncletDefs()
  ├─ FuncletExecutor.setDefs()
  ├─ EffectEngine.setState()
  ├─ TickSystem.setState()
  ├─ GameNumSystem.buildAll()       构建所有资源的 gain 树
  ├─ CharacterSystem.load(characters)
  ├─ CharacterSystem.loadBonuses(bonuses)
  ├─ VisibilityEngine.compute()     计算可见性
  └─ enterInit(defaultInit)         进入默认 Init
```

### 校验规则

**实现位置**：[[src/engine/registry.ts]] `validate()`

- **ID 唯一性**：inits / areas / spots / enhancements / stories / items / dropTables / funcletDefs / characters / resourceDisplays / tags
- **引用完整性**：area→init、spot→area、init.defaultAreas→area、area.defaultSpots→spot
- **Extra 合法性**：深度 ≤ 32、dict key 非空且不含 '/'、int 值必须为整数

### 合并规则

**实现位置**：[[src/engine/registry.ts]] `merge()`

- 实体直接存入对应 Map
- 关系索引自动更新（areasByInit / spotsByArea / spotsByTag）
- extras 常量表展开为树后深合并进全局常量树

---

## 2. 数据包分片合并

**文件**：[[src/data/zip-loader.ts]]（210 行）

### Mod 压缩包加载

遍历压缩包内所有 `.json` 文件（任意目录层级），每份 JSON 视为 Datapack 的一个"分片"，合并为单个 Datapack。

### 分片格式

每个 JSON 分片可以是：

```json
{
  "name": "mod-name",
  "version": "1.0.0",
  "inits": [...],
  "areas": [...],
  "spots": [...],
  "enhancements": [...],
  "stories": [...],
  "items": [...],
  "dropTables": [...],
  "affectorPacks": [...],
  "triggerDefs": [...],
  "funcletDefs": [...],
  "characters": [...],
  "characterBonuses": [...],
  "resourceDisplays": [...],
  "tags": [{ "id": "office", "name": "办公室", "description": "行政与布局设施" }],
  "extras": { "key": { "t": "int", "v": 1 } }
}
```

分片只需包含部分字段，多个分片的同名列表字段会合并。

### 合并逻辑

```typescript
function mergeFragments(fragments: DatapackFragment[]): Datapack {
  // name/version: 第一个出现的生效
  // extras: 扁平合并（后覆盖同名键）
  // 列表字段: push 合并
}
```

### API

| 函数 | 说明 |
|------|------|
| `loadDatapackFromZip(zip)` | 从 JSZip 实例加载 |
| `loadDatapackFromZipBuffer(input)` | 从 ArrayBuffer/Uint8Array/Blob 加载 |
| `loadDatapackFromZipFile(file)` | 从 File/Blob 加载 |

---

## 3. 基础数据包

**目录**：[[src/data/base/]]

| 文件 | 内容 |
|------|------|
| [[src/data/base/inits.ts]] | 5 条世界线（夏莱/千禧年/阿比多斯/崔妮蒂/盖赫纳） |
| [[src/data/base/areas.ts]] | 12 个区域（有向邻接图） |
| [[src/data/base/spots.ts]] | 20+ 个设施（产出核心） |
| [[src/data/base/enhancements.ts]] | 12 个强化（含 6 个条件测试用） |
| [[src/data/base/stories.ts]] | 剧情（5 条主动 + 12 条被动 + 3 条故事链） |
| [[src/data/base/items.ts]] | 12 个物品（4 消耗品 + 6 素材 + 2 关键道具） |
| [[src/data/base/drop-tables.ts]] | 5 个掉落表 |
| [[src/data/base/characters.ts]] | 28 个角色（来自 Blue Archive） |
| [[src/data/base/triggers.ts]] | 8 个 Trigger（里程碑奖励） |
| [[src/data/base/resources.ts]] | 资源 ID 常量 |

### 汇总文件

**文件**：[[src/data/base/datapack.ts]]

将所有列表聚合为一个 `Datapack` 对象，包含 `resourceDisplays`（资源条显示配置）和 `baseAffectorPacks`（能量饮料 Affector 示例）。

### 数据包 Extras 常量表示例

```typescript
const baseExtras: Record<string, ExtraValue> = {
  'meta/author': extra.str('AronaClicker Team'),
  'meta/version': extra.str('1.0.0'),
  'balance/start-credit': extra.int(0),
};
```

加载时展开为树并合并进 `Registry.extras`。

---

## 4. Mod 导入机制

**实现位置**：[[src/ui/controller.ts]] `importDatapack()`

### 流程

1. 用户点击"导入 Mod"按钮
2. 创建 `<input type="file" accept=".zip">`
3. 调用 `loadDatapackFromZipFile(file)` 解析压缩包
4. `game.reload([datapack])` 运行时整体替换数据包
5. `SaveSystem.delete()` 清除旧存档（id 可能失效）
6. `game.start()` 重启帧循环
7. 重置会话 UI，render()

### reload() 语义

**实现位置**：[[src/engine/game-instance.ts]] `reload()`

清空注册表与各子系统，重置运行时状态后重新 init。数据包更换后旧存档语义失效。

---

## 5. Schema 描述协议生成

**脚本**：[[scripts/gen-engine-schema.mjs]]（旧 `gen-datapack-schema.mjs` 已删除）

从 [[src/engine/types/]] 解析实体接口 + TSDoc 含义标签，生成 Schema 描述协议（defMap 派生自 `Datapack` 接口，defs 为各实体字段定义）。

### 用法

```bash
npm run gen:schema
```

### 生成内容

- `defMap`：Datapack 数组/record 字段 → 实体类型（"有多少活跃数据结构"）
- `defs`：各实体字段定义（kind/label/required/ref/enum 含义；复杂字段为 `hand` 占位）

### 输出

[[tools/datapack-editor/schema/engine-defs.gen.json]]

> editor 侧由 [[tools/datapack-editor/schema/merge.ts]] 将生成 defs 与 [[tools/datapack-editor/schema/editor-extras.ts]] 拼合为最终 `TableSchema[]`；一致性由 [[tools/datapack-editor/schema/engine-schema.sync.test.ts]] 兜底。详见 [[09-schema-protocol]]。

---

## 6. 数据包打包

**脚本**：[[scripts/pack-arona-clicker-core.mjs]]

将 [[datapack/AronaClickerCore/]] 文件夹打包为 `arona-clicker-core.zip`。

### 用法

```bash
node scripts/pack-arona-clicker-core.mjs
```

### 输出

[[datapack/arona-clicker-core.zip]]

---

## 7. 数据包编辑器

**目录**：[[tools/datapack-editor/]]

Schema 驱动的表格化 JSON 编辑器，支持校验、补全、跳转、导入导出。

| 子目录 | 说明 |
|--------|------|
| `model/` | 编辑器数据模型 |
| `schema/` | Schema 描述协议（`engine-defs.ts` / `editor-extras.ts` / `merge.ts` / `datapack.schema.ts`）+ 同步测试（`engine-schema.sync.test.ts`） |
| `ui/` | 编辑器 UI（组件 + 导航 + IO） |
| `validate/` | Extra 校验逻辑 |

> `datapack.schema.ts` 已由 752 行瘦身为组装层：`TABLES = buildTables()`（生成 defs ⊕ editor-extras）。详见 [[09-schema-protocol]]。

入口：`npm run dev:editor` → `http://localhost:5173/editor`
