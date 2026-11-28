# Task 0435 · 读取任意层级 Datapack 并保留声明来源

状态：待验收

对应 [M01 §1–3、M01-A](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md) 与总路线 A0/A1。首批交付第一项，无 M02–M04 施工依赖。

## 当前依据与施工

- 从 `src/data-services/datapack/source.ts` 的 `PackSource.list`、`FolderPackSource`、`ZipPackSource` 开始。已有包内相对路径，ZIP 已提供子目录条目。补统一的目录快照入口和单 JSON 适配，目录与 ZIP 支持任意包内深度。路径范围以选定根为准，识别重复规范路径、Windows 大小写碰撞和越界输入。保留既有根清单与单 JSON 两种输入的含义，单 JSON 不伪造安装记录或发行身份。
- 改造 `fragment-parser.ts`，复用顶层列表/单例和 `mergeFragments`。解析时同时留下原始对象、已识别分片和来源记录。来源最少含包内相对路径、表、声明的 JSON Pointer 或原位置、读取顺序。重复声明按路径与位置区分，缺键仍保留。既有 Entry 兼容迁移走派生值，来源指回原始声明。未知顶层字段、未知文件和资源字节留在作者输入中，生成输出时才判断能否转换。
- 在 `pack-parser.ts` 提供面向工具的读取结果，含文件、声明、读入诊断和合法输入的 Datapack 投影，必要时经 `src/data-services/index.ts` 向工具导出。错误文件可定位，其他合法文件仍可查看。旧 `parsePack` 和 ZIP 入口继续用同一解析与合并内核。以 `src/ui/development/development-datapack-loader.ts` 的目录和 ZIP 分支为兼容消费者，维持严格错误、返回形状、清单校验、进度与图片处理。现有输入暂沿用枚举与拼接规则。首批不依赖作者配置、永久身份或持久版本。
- 固定 Base bundle、Base 分片、`datapack-dev/addition_test/`、`datapack-dev/addition_test.zip` 与 `datapack-dev/addition-test-0.1.0.zip` 的实测路径与摘要。每份输入与自己的旧结果对照，Base 两种输入之间的字段差异单独记录。

## 首批读取合同

沿用 M01 的 `ProjectRead`、`SourceFile`、`DefinitionRecord`、`SourcePoint` 和 `Diagnostic`。下表是首批必须提供的字段和约束，后续消费者按 M01 扩充同一合同。

| 对象 | 必要内容 |
| --- | --- |
| `ProjectRead` | 一次打开的项目与包标识，文件、声明和诊断。来源为合法包时带现有 manifest。用 `status: 'complete' \| 'incomplete'` 区分完整度。 |
| `SourceFile` | 规范包内路径、角色、只读能力及本次打开的原始字节读取入口。读取或解析失败的文件仍能在清单定位。有效内容及资源读取指向本次打开时的内容。 |
| `DefinitionRecord` | `occurrenceId`、表、源声明原值、`source`、同表读入次序 `ordinal`。路径与 Pointer 标识一次声明，合并投影保留既有 Entry 迁移；没有可靠键时仍能按位置选择。 |
| `SourcePoint` | 包标识、相对路径、可用的 JSON Pointer 和位置精度。列表记录如 `/spots/0`，坏 JSON 至少定位到文件。 |

完整结果提供 `datapack`。目录枚举不完整、纳入处理的定义或资源无法读取、宣告的定义有语法或结构错误，或包清单无效时，返回 `incomplete`、问题范围和可读源记录。该分支没有 `datapack` 字段，工具从可读声明展示内容，发行、应用和完整转换入口先检查完整度。完整表示成功读入和合并，引用与领域校验仍由各自消费者执行。单 JSON 可取得完整投影，发行身份依现有打包要求另行提供。

物理位置只定位作者来源。移动 `00-world.json` 只改变声明路径和本次读取的定位信息，`addition-test:spot:scanner` 的游戏 ID、所属 Area 和引用保持一致。

## 可用交付与验收

用 addition-test 的 `00-world.json` 定位 `addition-test:area:observatory` 与 `addition-test:spot:scanner`。将文件移进测试副本的两层子目录，核对来源变化和游戏身份稳定。在另一分片制造坏 JSON，验证两条声明仍可浏览，完整 Datapack 投影不可取得，旧严格入口仍报错。另测同键声明、缺键记录、未知数据和资产。通过 `npm test -- tests/data/datapack/pack-source.test.ts tests/data/datapack/pack-parser.test.ts tests/data/datapack/fragment-parser.test.ts` 验收，并交付 Task 0436 可直接消费的读取结果。

## 当前进展

已实现 `project-source.ts:readProject`，继续复用 `fragment-parser.ts` 和严格运行包合并规则。已用真实 Base bundle、Base 分片和 addition-test 样本试读，未合并 Base 历史源值。当前两个 addition-test ZIP 字节一致。首批定向测试 9 文件、36 项通过。

| 样本 | SHA-256 |
| --- | --- |
| `src/arona-clicker/content/base-pack/content.json` | `fae2138bf06413e4e06f030d898f2d5797d35fd17963f1aa6d1e6a2ab1d7273d` |
| `datapack/base@1.0.3/`，32 文件 | `924dcdb78fdfee2b69b5779dba59daa21ae35d369ff6fbd872278ef2c5e25717` |
| `datapack-dev/addition_test/`，8 文件 | `b35e7cc88f65911dd1d453f3caff2b6c6ae17caa7eec12283d35f190c42731a8` |
| `datapack-dev/addition_test.zip`、`datapack-dev/addition-test-0.1.0.zip` | `be45564ad1e1ac8a571134646b043b84411db514eb515d00431e2454e6cf3edf` |

目录摘要基于排序后的「相对路径 + 空格 + 文件小写 SHA-256」清单，使用 UTF-8 和 LF。
