---
kind: dependency_management
name: 基于 npm + Vite 的轻量级依赖管理
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
---

## 1. 使用的系统/方案

本项目采用 **npm**（lockfileVersion 3）作为唯一的第三方依赖管理工具，配合 **Vite** 作为构建与开发服务器。项目为纯前端/Node.js 工程，未使用任何后端语言包管理器（无 go.mod、requirements.txt、Cargo.toml 等）。

- 包清单：`package.json`
- 锁定文件：`package-lock.json`（lockfileVersion 3，记录精确版本与完整性校验 hash）
- 运行时依赖仅一个：`jszip`（用于解压 datapack zip 资源）
- 开发时依赖：`typescript`、`vite`、`vitest`、`@types/node`

## 2. 关键文件

- `package.json`：声明项目名 `aronaclicker`、脚本命令（`dev`、`build`、`test`、`gen:schema`）、依赖与 devDependencies。
- `package-lock.json`：由 npm 生成并提交的完整依赖树，包含所有子依赖的精确版本、平台可选依赖（如 `@esbuild/*` 各平台二进制）及 sha512 integrity。
- `node_modules/`：当前为空目录（本地未安装依赖），实际依赖由 lockfile 锁定并由 CI/本地 `npm install` 还原。
- `scripts/gen-engine-schema.mjs` 等 Node 脚本：通过 `require('fs')` 等内置模块运行，不引入额外运行时依赖。
- `tools/datapack-editor/tsconfig.json`：编辑器子工具的独立 TS 配置，但共享根级 npm workspace（未见 workspace 字段，仍为单包）。

## 3. 架构与约定

- **单一 npm 包**：整个仓库是一个 npm 包，不存在 monorepo/workspace 结构；所有脚本、引擎、UI、datapack 编辑器共用同一份 `package.json`。
- **依赖粒度极小**：生产环境仅依赖 `jszip` 用于加载 `datapack/arona-clicker-core.zip`（见 `src/data/zip-loader.ts` 与 `scripts/pack-arona-clicker-core.mjs`），其余均为 TypeScript/Vite/Vitest 构建期依赖。
- **数据内容以 datapack 形式解耦**：游戏内容（角色、区域、剧情等）以 JSON 定义在 `datapack/AronaClickerCore/*.json`，并通过脚本打包成 zip，由运行时通过 jszip 动态加载，从而将“内容”与“引擎代码”解耦，避免把大量静态资源纳入 npm 依赖。
- **构建产物隔离**：`web-dist/` 存放 Vite 构建输出，`dist/` 可能用于其他用途，均不在依赖管理中体现。
- **无私有 registry / 镜像配置**：从 `package-lock.json` 可见解析地址为 `https://registry.npmmirror.com/...`，说明开发者本地或全局配置了 npm 镜像源（npmmirror），但仓库内未显式写入 `.npmrc` 或 package.json 的 `publishConfig.registry`。

## 4. 约定与约束

- **版本范围使用 caret (`^`)**：所有依赖均使用 `^` 前缀（如 `"vite": "^5.0.0"`、`"vitest": "^2.1.9"`、`"jszip": "^3.10.1"`），允许 npm 在安装时选择兼容的次版本更新，同时由 `package-lock.json` 锁定实际安装版本。
- **提交 lockfile**：`package-lock.json` 已随仓库提交，确保不同环境可复现相同依赖树。
- **无 vendoring**：未使用 `vendor/`、`third_party/` 等源码级 vendoring 策略；所有第三方库均通过 npm 安装到 `node_modules`。
- **无多包/monorepo 管理**：未发现 `pnpm-workspace.yaml`、`lerna.json`、`nx.json` 等 monorepo 配置，所有子目录（`src/`、`tools/datapack-editor/`、`scripts/`）共享同一依赖集。
- **脚本依赖最小化**：`scripts/` 下的 Node 脚本仅使用 Node 内置模块（`fs`、`path`、`child_process` 等），不引入额外运行时依赖，便于在任意 Node 环境中执行。
- **无发布流程**：`package.json` 中未配置 `publishConfig`、`main`、`module`、`exports` 等发布字段，表明该仓库主要作为内部工程而非 npm 公共包发布。

综上，该项目采用最简化的 npm 依赖管理模式：单一包、极少的运行时依赖、通过 lockfile 保证可复现性，并将游戏内容以 datapack zip 的形式与引擎代码解耦。