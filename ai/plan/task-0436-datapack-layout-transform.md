# Task 0436 · Datapack 拆合与快速层级化

状态：待处理

对应 [M01 §4、M01-B](../../docs/prototype-blueprints/AC-module-blueprints-v3/01-project-source.md) 与 B1/B2。依赖 [[ai/plan/task-0435-datapack-multifile-source]]。范围为计划与副本输出，拆合先验收，随后在同一结构上扩展层级化。

## 当前依据与施工

- `fragment-parser.ts` 已声明列表、单例、extras、清单相关的合并规则。`scripts/base-datapack-export.mjs:exportBaseDatapackFolder` 已具备按顶层字段输出和资产改写，`tools/datapack-editor/ui/io.ts:createDatapackPackage` 已具备单片 ZIP 输出。复用分片包装规则及 `src/data-services/archive/archive-writer.ts`，把计划放回公共 Datapack 服务。此任务从现有实现提取通用能力，生产 Base 脚本的切换留给后续 Task。
- **先交付拆合。** 用同一个布局计划承载声明去向、目标包内路径、保留文件、资产和诊断。按表拆与按实体拆均写既有 JSON 分片形状。每个实体整体移动，键缺失或不适合命名时稳定留在表文件或要求处理。选定文件合一只移入选中内容，未选文件随输出完整带出。全合写根清单、一个内容 JSON、资产和需保留的其他文件。单例、extras 或未知字段无法无损合并时，提示具体位置并阻止受影响操作。重复实体保留各位置，未知字段不得转入 extras。输入始终保留，目标使用新目录或 ZIP。
- **再交付快速层级化。** 在同一计划上增加类型、Init、角色、故事系列和自定义规则。首批按实际字段取归属，例如 `Area.initId`、`Spot.areaId`、`Story.initId/directoryId`、`StoryDirectoryDef.characterId` 与 Entry 的 `storyId/availableInits`。角色和系列可补显式映射，存在 `hierarchyString` 时可用其显式路径。自定义规则接收本次操作的表、来源路径或显式实体匹配与目标相对路径。缺归属或多归属进入待分组或共享候选。预览含目录、文件及移动原因，允许按声明或文件覆写目标路径，再校验重名、越界和大小写碰撞。文件归组不改 ID、Story 目录、条件或父子引用。
- **通过回读决定保序方案。** 保持片内数组原值原序，对输出比较各顶层列表。先用现有枚举语义能稳定表达的文件次序。目标目录交错确实导致变序时，只为受影响表验证局部位置线索，或明确调整目标并重试。任何局部线索必须证明新工具可回读，旧读取器不误当内容，旧兼容发行按已核实顺序扁平输出。禁止静默输出变序包。首轮不建设全局顺序清单。

## 可用交付与验收

通过共同服务把真实 addition-test 副本依次按表拆、按实体拆、分组、选合和全合，回读对照字段、顺序、资产字节。用 Base 副本覆盖表规模，用交错 A/B/C、同值 order 及一个可观察到顺序差异的现有运行场景验收保序。覆盖重复声明、未知字段、选合未选部分不变、取消预览及碰撞无输出。用现有分片、归档及 Base 导出测试做兼容对照，并补覆盖组合操作的定向测试。

## 当前进展

已核对旧拆片与 ZIP 输出点，待 Task 0435 和施工授权。首先给按表拆与全合建立共同计划和回读对照。
