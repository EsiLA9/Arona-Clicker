---
kind: configuration_system
name: Arona Clicker 配置系统：Datapack JSON + Vite 构建期环境 + LocalStorage 存档
category: configuration_system
scope:
    - '**'
source_files:
    - vite.config.ts
    - vitest.config.ts
    - package.json
    - src/main.ts
    - src/data/index.ts
    - src/data/base/datapack.ts
    - src/data/zip-loader.ts
    - scripts/pack-arona-clicker-core.mjs
    - src/save/storage.ts
    - datapack/AronaClickerCore/01-inits.json
---

## 1. 整体方案

本仓库的「配置」由三层组成，分别承担不同职责：

| 层级 | 载体 | 作用 | 加载时机 |
|---|---|---|---|
| 游戏内容配置（DataPack） | `datapack/AronaClickerCore/*.json` + 打包产物 `arona-clicker-core.zip` | 定义区域、据点、角色、剧情、掉落表、强化、触发器、资源显示等全部可玩内容 | 引擎启动时通过 `game.init([baseDatapack])` 注入 |
| 构建/运行期开关 | `vite.config.ts`、`vitest.config.ts`、`import.meta.env.DEV` | 控制 dev server 端口、多入口路由、预览端口、开发日志开关 | 编译期 / 运行时由 Vite 注入 |
| 玩家存档 | `src/save/storage.ts` → `localStorage` (`acprogram_save`) | 持久化玩家进度、资源、故事进度等运行时状态 | 页面关闭时自动保存，启动时尝试恢复 |

项目没有使用 `.env`、`.yaml`、`.toml`、`application.properties` 等外部配置文件；所有「配置」要么以 JSON 数据文件形式声明，要么通过 Vite 的 `defineConfig` 与 `import.meta.env` 注入。

## 2. 关键文件与包

- **构建期配置**
  - `vite.config.ts`：定义 MPA 路由（`/game`、`/editor`）、dev 端口 `5173`、preview 端口 `4173`、构建输出目录 `web-dist`、三个入口 `portal` / `game` / `editor`，以及自定义插件 `mpaRoutes()`。
  - `vitest.config.ts`：基于 `vitest/config` 的测试配置。
  - `package.json`：脚本命令 `dev`、`dev:game`、`dev:editor`、`build`、`test`、`gen:schema`。

- **数据层配置（DataPack）**
  - `src/data/base/datapack.ts`：汇总所有基础数据模块，导出单一 `baseDatapack: Datapack`，作为 `game.init` 的第一个数据包。
  - `src/data/index.ts`：仅 re-export `baseDatapack`，是数据入口。
  - `src/data/zip-loader.ts`：将 `jszip` 解压后的压缩包扫描为多个 JSON 分片，按白名单字段合并为单个 `Datapack`，并提取图片资产为 data URL。
  - `scripts/pack-arona-clicker-core.mjs`：把 `datapack/AronaClickerCore/` 下所有 `.json` 递归收集并压缩为 `arona-clicker-core.zip`，保留 `AronaClickerCore/` 前缀目录。

- **运行时开关**
  - `src/main.ts`：通过 `import.meta.env.DEV` 控制 `devLog.verbose` 与 `maxEntries`，在开发模式开启详细日志。

- **存档持久化**
  - `src/save/storage.ts`：`SaveSystem` 类，键名 `SAVE_KEY = 'acprogram_save'`，版本常量 `SAVE_VERSION = '1.0.0'`，提供 `save/load/delete/exists/export/import` 六个静态方法，全部读写 `localStorage`。

## 3. 架构与约定

### 3.1 DataPack 分片格式
每个 JSON 文件是一个「分片」（fragment），顶层必须是对象，且至少包含以下之一：
- 列表字段（白名单）：`inits`、`areas`、`spots`、`enhancements`、`activeStories`、`passiveStories`、`stories`、`items`、`dropTables`、`affectorPacks`、`triggerDefs`、`funcletDefs`、`characters`、`characterBonuses`、`resourceDisplays`、`pics`、`charaProfiles`。
- 元数据字段：`name`（字符串）、`version`（字符串）、`extras`（Record<string, ExtraValue>）。
未知字段会被忽略，便于分片携带说明性 meta。

分片合并规则：
- `name` / `version` 取首个出现的值。
- `extras` 浅合并。
- 各列表字段直接拼接。

### 3.2 基础数据包 vs Mod 数据包
- 基础内容以 TypeScript 数组形式内联在 `src/data/base/*.ts`，最终聚合到 `baseDatapack`。
- 扩展内容（Mod）以 `*.json` 分片形式存放在 `datapack/AronaClickerCore/`，经 `pack-arona-clicker-core.mjs` 打包成 zip，再由 `loadDatapackFromZip*` 解析后传入 `game.init([...])`。
- 全游戏只允许一个 Mod（见 `zip-loader.ts` 注释：「供 game.init 使用 —— 全游戏仅 1 个 Mod」）。

### 3.3 构建期环境配置
- 通过 Vite 的 `defineConfig` 集中管理 dev server、preview server、构建输出、多入口。
- 运行时通过 `import.meta.env.DEV` 区分开发与生产行为（如日志开关、最大条目数）。
- 无 `.env` 文件，无 `process.env.*` 读取；所有环境变量由 Vite 在编译期注入。

### 3.4 存档版本策略
`SaveSystem` 使用固定版本号 `1.0.0`。加载时若 `data.version !== SAVE_VERSION` 则丢弃旧存档并返回 `null`，同时打印警告。导入时也做同样校验。

## 4. 约定与约束

- **DataPack 分片必须是非空对象**：若顶层是数组或 null/非对象，`parseFragment` 会抛出 `ZipLoadError`，并附带出错路径。
- **列表字段类型校验**：每个白名单字段必须为数组，否则抛出 `ZipLoadError`，消息中指明字段名与实际类型。
- **至少识别一个字段**：若分片不包含任何已知字段，抛出 `ZipLoadError`，列出可用字段集合。
- **压缩包必须含 .json**：`loadDatapackFromZip` 在未找到任何 `.json` 文件时抛错，并报告被忽略的非 json 文件数量。
- **图片资产白名单**：仅 `png/jpg/jpeg/gif/webp/svg/apng/avif/bmp/ico` 会被提取为 data URL，其余文件计入 `ignoredCount`。
- **存档键名与版本硬编码**：`SAVE_KEY = 'acprogram_save'`、`SAVE_VERSION = '1.0.0'`，修改需同步升级版本号。
- **构建产物隔离**：Vite 构建输出到 `web-dist`，与 tsc 的 `dist` 完全分离，避免混淆。
- **多入口路由**：`/game` 指向 `src/ui/index.html`，`/editor` 指向 `tools/datapack-editor/ui/index.html`，该映射在 dev 与 preview 模式下均生效。

## 5. 总结

该工程采用「JSON 数据驱动 + Vite 构建期注入 + LocalStorage 存档」的配置体系：游戏内容以结构化 JSON 分片声明并通过 zip 分发，构建/运行开关通过 Vite 的 `defineConfig` 和 `import.meta.env` 管理，玩家存档通过 `SaveSystem` 持久化到浏览器本地存储。整个系统不依赖外部配置文件或环境变量文件，所有配置均可追溯至源码中的常量、JSON 文件或构建脚本。