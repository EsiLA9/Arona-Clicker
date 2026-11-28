# Task 0435 · 读取任意层级 Datapack 并保留声明来源

状态：待处理

对应 [M01 §1–3、M01-A](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md) 与总路线 A0/A1。首批交付第一项，无 M02–M04 施工依赖。

## 当前依据与施工

- 从 `src/data-services/datapack/source.ts` 的 `PackSource.list`、`FolderPackSource`、`ZipPackSource` 开始。已有包内相对路径，ZIP 已提供子目录条目。补统一的目录快照入口和单 JSON 适配，目录与 ZIP 支持任意包内深度。路径范围以选定根为准，识别重复规范路径、Windows 大小写碰撞和越界输入。保留既有根清单与单 JSON 两种输入的含义，单 JSON 不伪造安装记录或发行身份。
- 改造 `fragment-parser.ts`，复用顶层列表/单例和 `mergeFragments`。解析时同时留下原始对象、已识别分片和来源记录。来源最少含包内相对路径、表、声明的 JSON Pointer 或原位置、读取顺序。重复声明按路径与位置区分，缺键仍保留。既有 Entry 兼容迁移走派生值，来源指回原始声明。未知顶层字段、未知文件和资源字节留在作者输入中，生成输出时才判断能否转换。
- 在 `pack-parser.ts` 提供面向工具的读取结果，含文件、声明、读入诊断和合法输入的 Datapack 投影，必要时经 `src/data-services/index.ts` 向工具导出。错误文件可定位，其他合法文件仍可查看。旧 `parsePack` 和 ZIP 入口继续用同一解析与合并内核。以 `src/ui/development/development-datapack-loader.ts` 的目录和 ZIP 分支为兼容消费者，维持严格错误、返回形状、清单校验、进度与图片处理。现有输入暂沿用枚举与拼接规则。首批不依赖作者配置、永久身份或持久版本。
- 固定 Base bundle、Base 分片、`datapack-dev/addition_test/`、`datapack-dev/addition_test.zip` 与 `datapack-dev/addition-test-0.1.0.zip` 的实测路径与摘要。每份输入与自己的旧结果对照，Base 两种输入之间的字段差异单独记录。

## 可用交付与验收

用 addition-test 的 `00-world.json` 定位 `addition-test:area:observatory` 与 `addition-test:spot:scanner` 的路径及片内位置。将该文件放进测试副本的两层子目录，验证来源改变、投影一致。另测同键声明、缺键记录、坏 JSON、未知数据与资产，核对逐文件诊断和旧严格入口。通过 `npm test -- tests/data/datapack/pack-source.test.ts tests/data/datapack/pack-parser.test.ts tests/data/datapack/fragment-parser.test.ts` 验收，并交付 Task 0436 可直接消费的读取结果。

## 当前进展

已核对源码入口，待授权。施工先固定样本，再从分片解析保留原始声明位置。
