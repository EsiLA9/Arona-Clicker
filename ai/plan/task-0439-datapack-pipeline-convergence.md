# Task 0439 · Datapack 生产管线接入共同文件服务

状态：待处理

对应 [M01-D](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md)、C4 与 K1 的文件服务接线部分。施工排在 [[ai/plan/task-0438-datapack-source-save]] 之后，使用 [[ai/plan/task-0437-datapack-layout-tools]] 已交付的文件组织工具。正式构建等适用的 M03 产物及运行验证可用。只读与导出消费者在运行上只调用读取或输出服务。正式数据源切换另外裁定。

## 当前依据与施工

- `scripts/base-datapack-export.mjs:exportBaseDatapackFolder` 负责按表输出、资产地址改写和拷贝。`scripts/sync-base-datapack-bundle.mjs` 与 `src/arona-clicker/content/default-datapack.ts` 属现有运行 bundle 路径。`tools/datapack-editor/ui/io.ts:createDatapackPackage` 另起单片 ZIP。先让独立工具常规导出和 CLI 共用已验收的发布输出入口，回读成功后退出重复 JSON/ZIP 组装。游戏内编辑器或其他工具按真实消费点逐项接入，保留运行态加载和安装边界。
- 保留 `src/arona-clicker/content/base-datapack-source.ts` 的 TS 原始构建、测试和现有调用。需要验证路径时，可选用代表性的 Base 片段或其导出副本试接相对路径与资产映射，共用 writer 仅承担输出；也可用 addition-test 完成首轮生产工具验证。无须移动 Base 原始 TS 文件、全面改目录、改变现有 bundle 入口或切换权威数据源。
- 用已通过副本验证的来源固定、清单与资产输出支撑 M03 读回。各消费者逐个切换，在新入口有实物等价验收后才删对应重复组装。Base bundle 与分片分别建立行为、字段和资产报告。有分歧的值留独立裁定；正式 Base 切换需明确授权及可回退基线。旧发行 Runtime 加载继续由现有入口负责。

## 可用交付与验收

提交消费者迁移表，至少有独立工具和 CLI 实际产出同一可读包。测试 `tests/data/datapack/base-datapack-folder-export.test.ts`、`tests/data/datapack/bundled-base-pack.test.ts`、`tests/data/datapack/archive-writer.test.ts` 与 `tools/datapack-editor/ui/io.test.ts`。如试接 Base 部分，核对原 TS 构建、运行 bundle 和相应样本回读，比较字段、顺序、资源与路径。构建失败保留旧产物，回退方式随迁移点实测。

## 当前进展

已定位输出重复点和 Base 保留范围，待 Task 0438、适用的 M03 产物及施工授权。先迁独立工具实际导出，再决定是否需要 Base 路径样本。
