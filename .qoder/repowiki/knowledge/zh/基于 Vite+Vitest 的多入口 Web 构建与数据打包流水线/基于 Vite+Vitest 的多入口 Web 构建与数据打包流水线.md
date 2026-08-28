---
kind: build_system
name: 基于 Vite+Vitest 的多入口 Web 构建与数据打包流水线
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - vitest.config.ts
    - tsconfig.json
    - tools/datapack-editor/tsconfig.json
    - scripts/gen-engine-schema.mjs
    - scripts/pack-arona-clicker-core.mjs
    - scripts/_refactor-move-engine.mjs
    - scripts/_fix-engine-imports.mjs
    - index.html
    - src/ui/index.html
    - tools/datapack-editor/ui/index.html
---

## 1. 使用的系统与工具

本项目采用 **Vite 5** 作为统一的构建/开发服务器，**Vitest 2** 作为测试运行器，**TypeScript 5** 进行类型检查（`noEmit` 模式），并通过 Node.js ESM 脚本完成数据打包与 schema 生成。整个工程没有 Makefile、Dockerfile、CI 配置文件或 shell 构建脚本——所有构建流程都通过 `package.json` 的 npm scripts 暴露。

- 构建工具：`vite`（Rollup 后端）
- 测试框架：`vitest`（Node 环境）
- 包管理：npm + `package-lock.json`
- 运行时依赖：仅 `jszip`（用于打包 datapack JSON 为 zip）
- 类型系统：`typescript` + `@types/node`，严格模式编译但不输出 JS（由 Vite 负责产物生成）

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `package.json` | 定义项目元信息、npm scripts（dev/build/test）、依赖 |
| `vite.config.ts` | 多入口（MPA）配置：portal/game/editor 三个 HTML 入口，自定义 MPA 路由插件 |
| `vitest.config.ts` | 测试扫描范围（`tests/**` 与 `tools/**/*.test.ts`），Node 环境 |
| `tsconfig.json` | 根 TypeScript 配置（target/moduleResolution 等） |
| `tools/datapack-editor/tsconfig.json` | datapack 编辑器子项目的独立 TS 配置（`noEmit: true`） |
| `scripts/gen-engine-schema.mjs` | 从 `src/engine/types` 的 TS 接口解析生成 datapack editor 的 schema JSON |
| `scripts/pack-arona-clicker-core.mjs` | 将 `datapack/AronaClickerCore/*.json` 递归打包为 `arona-clicker-core.zip` |
| `scripts/_fix-*engine-imports.mjs` / `_refactor-move-engine.mjs` | 引擎重构期间用于批量修正 import 路径的辅助脚本 |
| `web-dist/` | Vite 构建产物目录（与 tsc 的 `dist/` 隔离） |
| `index.html` / `src/ui/index.html` / `tools/datapack-editor/ui/index.html` | 三个构建入口对应的 HTML |

## 3. 架构与约定

### 3.1 多页面应用（MPA）构建
`vite.config.ts` 通过 Rollup 多入口配置同时产出三个独立应用：
- `portal` → `index.html`（根门户）
- `game` → `src/ui/index.html`（游戏主界面）
- `editor` → `tools/datapack-editor/ui/index.html`（数据编辑器）

构建输出统一写入 `web-dist/`，并启用 `emptyOutDir: true` 清理旧产物。开发服务器端口固定为 `5173`，预览服务器端口固定为 `4173`。

### 3.2 自定义 MPA 路由插件
项目内置名为 `ac-mpa-routes` 的 Vite 插件，在 dev 和 preview 模式下拦截 `/game` 和 `/editor` 请求，返回 302 重定向到对应 HTML 入口。这使得部署时可通过统一前缀访问不同子应用。

### 3.3 构建产物与源码分离
- 源码位于 `src/`、`tools/`、`scripts/`
- Vite 产物位于 `web-dist/`（静态资源 + 预构建 JS/CSS）
- 根级 `dist/` 保留给 `tsc` 使用（但当前 tsconfig 未配置 emit，实际为空占位）
- 两者通过注释明确区分：`// 与 tsconfig 的 outDir ./dist（tsc 产物）隔离`

### 3.4 数据打包管线
`scripts/pack-arona-clicker-core.mjs` 是 datapack 发布的核心：
- 递归扫描 `datapack/AronaClickerCore/` 下所有 `.json` 文件
- 按相对路径顺序收集并排序
- 使用 JSZip 以 DEFLATE 压缩生成 `datapack/arona-clicker-core.zip`
- 压缩包内保留 `AronaClickerCore/` 前缀目录结构，与运行时加载逻辑对齐
- 若未发现任何 JSON 文件则报错退出（exit code 1）

### 3.5 Schema 生成管线
`scripts/gen-engine-schema.mjs` 是一个 TypeScript AST 分析器：
- 读取 `src/engine/types/` 下所有 `.ts` 文件
- 从 `Datapack` 接口推导表映射（defMap：数组字段 → 表名，Record 字段 → 键值表）
- 解析各实体接口的字段类型、TSDoc 标签（`@label`、`@group`、`@int`、`@float`、`@flexible`、`@extra`、`@ref`、`@refList`、`@collapsible`、`@optionsFrom`、`@enum`）
- 将复杂/手写类型标记为 `hand`，需人工维护
- 输出 `tools/datapack-editor/schema/engine-defs.gen.json`，供 datapack editor 的 TableSchema 合并使用
- 通过 `--write` 参数控制是否写文件，否则仅打印摘要

### 3.6 测试体系
- Vitest 配置扫描 `tests/**/*.test.ts` 与 `tools/**/*.test.ts`（覆盖 datapack editor 的测试）
- 运行环境为 `node`，无需浏览器环境
- 测试用例按模块组织：`tests/engine/`、`tests/data/`、`tests/ui/`、`tools/datapack-editor/{schema,validate,model}/` 下的 `.test.ts`

## 4. 约定与约束

- **构建命令约定**：所有构建/开发/测试任务通过 `npm run <script>` 执行，无外部构建工具链。常用命令包括 `dev`（默认入口）、`dev:game`、`dev:editor`、`build`、`test`、`test:watch`、`gen:schema`。
- **入口 HTML 命名约定**：每个子应用必须提供独立的 `index.html` 作为 Vite 入口，并通过 `vite.config.ts` 的 `rollupOptions.input` 显式注册。
- **产物目录隔离**：Vite 产物固定输出到 `web-dist/`，禁止修改；tsc 产物目录 `dist/` 与构建产物物理隔离。
- **datapack 打包约定**：`datapack/AronaClickerCore/` 下的 JSON 分片文件必须存在且至少一个，否则打包脚本会失败；文件名顺序影响最终 zip 中条目顺序（脚本对文件列表进行了 sort）。
- **Schema 同步约定**：`src/engine/types/` 中的类型声明是 datapack editor schema 的唯一事实来源；新增实体类型后需运行 `npm run gen:schema` 重新生成 `engine-defs.gen.json`，并由 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 校验一致性。
- **编辑器子项目独立 TS 配置**：`tools/datapack-editor/tsconfig.json` 单独设置 `moduleResolution: bundler`、`types: ["node", "vite/client"]`，与根 tsconfig 解耦。
- **无 CI/CD**：仓库中不存在 GitHub Actions、GitLab CI、Jenkinsfile、Makefile、Dockerfile 等持续集成或容器化配置，本地 npm scripts 是唯一构建入口。
- **版本策略**：`package.json` 中版本号硬编码为 `1.0.0`，未见自动化版本 bump 脚本或语义化版本管理流程。
- **依赖最小化**：生产运行时仅依赖 `jszip`，其余均为 devDependencies（vite、vitest、typescript），确保产物不包含开发工具链。