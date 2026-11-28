# Task 0439 · Datapack 生产管线接入共同文件服务

状态：待处理

对应 [M01-D](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md)、C4 与 K1 的文件服务接线部分。首批文件服务 0435–0437 已验收，读入与导出迁移可按实际消费者独立推进。正式构建接线等待对应 M03 产物及运行验证。只有消费原文件保存的接线需要 [[ai/plan/task-0438-datapack-source-save]]。正式数据源切换另外裁定。

## 当前依据与施工

- `scripts/export-base-datapack.mjs` 通过 Vite SSR 加载 `baseDatapackSource` 和 `baseDatapackExportAssets`，再调用 `base-datapack-export.mjs:exportBaseDatapackFolder`。后者目前负责按字段分片、资源地址改写及文件写入。本任务**必须让实际 Base 导出命令**接入 0436 共用输出服务。脚本只保留 TS 加载、Base 清单与资产映射输入、目标参数和 CLI 报告。若需要跨 Node 与 TS 的加载桥，沿现有 Vite SSR 机制接线。
- 共用服务接收清单、定义及资源映射输入，负责 JSON 分片、将已映射资源改为包内路径、资产条目生成及共同写出。Base 继续提供自己的 `sourceUrl → packagePath` 映射，保留未登记资源报错。先校验并暂存完整导出，再替换脚本管理的旧产物，输出失败保留原产物。确认实际命令等价后退出重复分片与资产组装。样本可先用少量条目或 addition-test 校准，共用路径必须通过 Base 全量导出验收。
- `tools/datapack-editor/ui/io.ts:createDatapackPackage` 与 CLI 常规导出也接共同写出，回读通过后退出重复 JSON/ZIP 组装。游戏内编辑器或其他工具按真实消费点逐项接入。保留 `base-datapack-source.ts` 的 TS 原始构建、测试和现有运行 bundle 入口。历史差异与正式权威源选择独立裁定。M03 使用共用输出与固定构建输入，旧发行加载和安装边界沿用现有入口。

## 可用交付与验收

实际执行 `npm run datapack:export-base -- <试验目录>`，回读全量导出并与旧 TS 导出基线比较清单、分片布局、字段、顺序、地址和资产字节。同目录重复导出保持稳定，缺资产映射或输出失败保留上次有效结果。确认脚本实际走到共同服务，旧重复职责已移出。独立工具和 CLI 也须产出可回读包。测试 `tests/data/datapack/base-datapack-folder-export.test.ts`、`tests/data/datapack/bundled-base-pack.test.ts`、`tests/data/datapack/archive-writer.test.ts` 与 `tools/datapack-editor/ui/io.test.ts`，其中 bundle 继续独立对照原运行入口。

## 当前进展

已核对 Base 实际命令和回读测试。等首批工具及施工授权后，先迁 Base 导出与独立工具，适用的正式构建接线随 M03 推进。
