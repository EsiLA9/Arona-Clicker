# 14. JSON 数据包（AronaClickerCore）格式说明

> 目标：用纯 JSON 编写一个名为 `AronaClickerCore` 的 Datapack，让应用将其作为默认数据包加载。
> 本目录逐 Def 提供**最小可用的 JSON 简例**（而非完整数据），避免一次性生成超大 JSON 超出阅读能力。

---

## 1. 运行时如何读取 JSON 数据包

项目为 TS + Vite + Vitest（浏览器 / Node 双环境），推荐 **Vite/TS 原生 JSON 模块导入**：

```ts
// tsconfig.json 需开启 resolveJsonModule（见下）
import raw from './arona-clicker-core.json';
import type { Datapack } from '../engine/types';

export const aronaClickerCoreDatapack: Datapack = raw as unknown as Datapack;
```

### 2.1 需要修改的配置

`tsconfig.json` 增加（`module` 已是 `ESNext`，`moduleResolution` 已是 `bundler`）：

```jsonc
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}
```

### 2.2 备选方案（Node 侧）

若未来需要在纯 Node / Vitest 中直接 `JSON.parse`：

```ts
import { readFileSync } from 'node:fs';
const dp = JSON.parse(readFileSync(new URL('./arona-clicker-core.json', import.meta.url), 'utf-8'));
```

### 2.3 接入点（替换 baseDatapack）

- `src/data/index.ts`：导出 `aronaClickerCoreDatapack`
- `src/main.ts` 与 `src/ui/main.ts`：`game.init([aronaClickerCoreDatapack])`
- 注意 UI `load-game` 兜底硬编码 `'base:init:schale_office'`，若 JSON 包沿用该 init id 可保持兼容。

---

## 3. Datapack 顶层结构

```jsonc
{
  "name": "AronaClickerCore",
  "version": "1.0.0",
  "inits":              [ /* InitDef[] */ ],
  "areas":              [ /* AreaDef[] */ ],
  "spots":              [ /* SpotDef[] */ ],
  "enhancements":       [ /* EnhancementDef[] */ ],
  "stories":            [ /* StoryDef[] */ ],
  "items":              [ /* ItemDef[] */ ],
  "dropTables":         [ /* DropTableDef[] */ ],        // 可选
  "affectorPacks":      [ /* AffectorPackDef[] */ ],     // 可选
  "triggerDefs":        [ /* TriggerDef[] */ ],          // 可选
  "funcletDefs":        [ /* FuncletDef[] */ ],
  "characters":         [ /* CharacterData[] */ ],
  "characterBonuses":   [ /* CharacterBonusTable[] */ ],
  "resourceDisplays":   [ /* ResourceDisplayDef[] */ ],  // 可选
  "extras":             { /* Record<string, ExtraValue> 扁平键 */ } // 可选
}
```

> 校验约束：所有 `id` 全局唯一；`area.initId` → `init.id`；`spot.areaId` → `area.id`；
> `init.defaultAreas` → `area.id`（且其 `initId` 匹配）；`area.defaultSpots` → `spot.id`（且其 `areaId` 匹配）。

---

## 4. 简例索引（逐个 Def）

| 文件 | 内容 |
|---|---|
| [01-init.md](01-init.md) | `InitDef`（含 `RevealLadder`、`purchaseCost`） |
| [02-area.md](02-area.md) | `AreaDef` |
| [03-spot.md](03-spot.md) | `SpotDef`（含 `LevelUpgradeDef`、`SpotFunctionalityDef`、`TagPath`） |
| [04-enhancement.md](04-enhancement.md) | `EnhancementDef` |
| [05-story.md](05-story.md) | `StoryDef`（active/passive、`StoryPage`、`StoryChoice`） |
| [06-item.md](06-item.md) | `ItemDef`、`ResourceAmount` |
| [07-droptable.md](07-droptable.md) | `DropTableDef`、`DropTableEntry` |
| [08-affector.md](08-affector.md) | `AffectorPackDef`、`AffectorEffect` |
| [09-trigger.md](09-trigger.md) | `TriggerDef`、`TriggerEventDef` |
| [10-funclet.md](10-funclet.md) | `FuncletDef` |
| [11-character.md](11-character.md) | `CharacterData`、`CharacterBonusTable`、`ResourceDisplayDef` |
| [12-extra.md](12-extra.md) | `ExtraValue` 语法与 `Datapack.extras` 常量表 |

---

## 5. 通用子结构速查（所有 Def 共用）

### 5.1 ValueExpression（数值表达式）

```jsonc
// 常量
{ "type": "const", "value": 5 }
// 取某来源值
{ "type": "value", "value": { "type": "value", "source": "res", "params": { "resourceId": "base:resource:credit" } } }
// 乘法
{ "type": "mul", "left": { "type": "const", "value": 2 }, "right": { "type": "value", "value": { "type": "value", "source": "spotLevel", "params": { "spotId": "base:spot:office_desk" } } } }
```

`source` 合法值：`const | res | spotLevel | spotCount | managerCount | funclet | data`
`params` 随 source 而异：`res`→`{resourceId}`；`spotLevel`→`{spotId}`；`funclet`→`{funcletId, args?}`；`data`→`{path}`。

### 5.2 Condition（条件）

```jsonc
// 单条件
{ "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 100 }
// 条件组 AND/OR
{ "type": "AND", "conditions": [
  { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 100 },
  { "target": "spotLevel", "key": "base:spot:office_desk", "comparator": ">=", "value": 3 }
] }
```

`target` 合法值：`resource | spotLevel | manager | flag | hasEnh | hasTag | countTags | stat | hasReadStory | hasReadStoryInRun | extra`
`comparator` 合法值：`== | != | >= | <= | > | <`

### 5.3 Effect（效果）

```jsonc
{ "op": "addResource", "target": "base:resource:credit", "value": { "type": "const", "value": 10 } }
```

`op` 合法值：`setResource | addResource | setSpotLevel | addSpotLevel | setManager | addEnhancement | addItem | loot | unlockInit | setFlag | triggerStory | travelToArea | setSpotMaxLevel | removeSpotMaxLevel | setExtra | addExtra | removeExtra`
`value` 可为 `number | string | boolean | ValueExpression | ExtraValue`。

### 5.4 tagPath / TagPath

`tagPath('office')` 在 JSON 中即普通字符串数组：`["office"]`。

### 5.5 枚举速查

- `Resource.Credit` = `"base:resource:credit"`
- `Resource.Pyroxene` = `"base:resource:pyroxene"`
- 角色 id 使用短 id（如 `"arona"`、`"shiroko"`）
- `CharacterSchool` 中文枚举、`CharacterRarity` 英文（详见 [11-character.md](11-character.md)）

---

## 6. 落地步骤清单（写入代码时）

1. **准备目录**：创建 `src/data/json/arona-clicker-core.json`。
2. **编写 JSON**：按各简例文档（01–12）逐块填充，保持所有引用 id 一致。
3. **开启 resolveJsonModule**：`tsconfig.json` 增加 `"resolveJsonModule": true`。
4. **新建加载器**：创建 `src/data/json/index.ts`：

```ts
import raw from './arona-clicker-core.json';
import type { Datapack } from '../../engine/types';

export const aronaClickerCoreDatapack: Datapack = raw as unknown as Datapack;
```

5. **接入默认数据**：`src/main.ts` 与 `src/ui/main.ts` 中 `game.init([aronaClickerCoreDatapack])`（替换 `baseDatapack`）。
6. **校验与测试**：`npx tsc --noEmit` + `npm test`，确认 Registry 校验通过（id 唯一性 / 引用完整性 / extra 合法性）。
7. **（可选）运行时导入 Mod**：直接使用 `src/data/zip-loader.ts`（§8）在 UI 中加载任意 zip 数据包，无需改代码。

> 注意：`resolveJsonModule` 只影响 TS 编译期类型；Vite 打包与 Vitest 均原生支持 JSON 导入。若在纯 Node 环境（无 Vite）运行，使用 README §2.2 的 `fs.readFileSync + JSON.parse` 方案。

---

## 7. JSON 与 TS 构造器的对应关系

| TS 构造器 | JSON 结果 |
|---|---|
| `Expr.const(5)` | `{"type":"const","value":5}` |
| `Expr.val(value('res',{resourceId}))` | `{"type":"value","value":{"type":"value","source":"res","params":{...}}}` |
| `Expr.mul(a,b)` | `{"type":"mul","left":...,"right":...}` |
| `cond(target,key,cmp,value)` | `{"target":...,"key":...,"comparator":...,"value":...}` |
| `and(c1,c2)` | `{"type":"AND","conditions":[...]}` |
| `or(c1,c2)` | `{"type":"OR","conditions":[...]}` |
| `extra.int(5)` | `{"t":"int","v":5}` |
| `extra.str("x")` | `{"t":"str","v":"x"}` |
| `extra.dict({...})` | `{"t":"dict","v":{...}}` |
| `extra.bool(true)` | `{"t":"bool","v":true}` |
| `tagPath("office")` | `["office"]` |

---

## 8. 多文件式 Mod 压缩包（已落地）

游戏 Def 制作工具已支持**运行时导入单个 Mod 压缩包**（`src/data/zip-loader.ts`）：

### 8.1 约定

- 压缩包为 **`.zip`**，代表 **1 个 Mod**（当前全游戏仅 1 个 Mod，合并为单个 `Datapack` 后交给 `game.init([dp])`）。
- **遍历规则**：递归压缩包所有目录层级，仅 `.json` 文件参与解析；图片/文本等其他文件**直接忽略**（当前不处理资源分布）。
- **分片格式**：压缩包内每个 `.json` 文件是一个 Datapack 的"分片"——可包含 §3 列出的**任意列表字段子集**、以及 `name` / `version` / `extras`。字段可跨文件拆分（如 `01-inits.json`、`02-areas.json`、`03-spots.json`）。
- **合并规则**：
  - 列表字段（`inits`/`areas`/…）按字段 **concat 合并**；
  - `extras` **浅合并**（扁平键直接叠加）；
  - `name` / `version` 取**第一个**出现该字段的文件；
  - 未知字段（如 `meta`、`description`）**忽略**。
- **错误约束**：
  - JSON 顶层为**数组** → 报错（无法推断所属字段，请包装为 `{"spots": [...]}`）；
  - 对象不含任何 Datapack 字段 → 报错（提示可用字段）；
  - JSON 语法错误 / 列表字段非数组 → 报错并携带文件路径。

### 8.2 压缩包目录示例

```text
arona-clicker-core.zip
├── mod/
│   ├── 01-inits.json        { "name": "...", "version": "...", "inits": [...] }
│   ├── 02-areas.json        { "areas": [...] }
│   ├── 03-spots.json        { "spots": [...] }
│   ├── 04-enhancements.json { "enhancements": [...] }
│   └── extras.json          { "extras": { "theme.bg": ... } }
└── assets/
    └── icon.png             ← 忽略
```

### 8.3 代码用法

```ts
import { loadDatapackFromZipFile } from '../../src/data/zip-loader';

// <input type="file"> 选择的 .zip
const { datapack, jsonFileCount, ignoredCount } = await loadDatapackFromZipFile(file);
game.reload([datapack]); // GameInstance.reload：清空注册表并重新 init
```

UI 已集成：顶栏 **「导入 Mod」** 按钮 → 选择 `.zip` → 加载成功后运行时替换数据包、清除旧存档并提示统计信息（json 文件数 / 忽略的非 json 数）。加载失败（`ZipLoadError`）会在通知与 devLog 中显示具体文件与原因。
