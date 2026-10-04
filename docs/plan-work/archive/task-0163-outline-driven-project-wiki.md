# Task：按 AC Outline 建立项目 Wiki 导航正文

状态：done — 多 Agent Wiki 正文、导航和过时内容处理完成

## 目标

依据 [[docs/docs-828/01-architecture/AC-outline-wiki]] 的概念职责层级，在 `docs/docs-828/06-wiki/` 建立可互相导航的项目 Wiki 正文；正文以当前源码为据，说明文件职责与层间协作，并路由到已有详细机制、数据结构和规范文档。

## 边界

- Wiki 是代码职责与概念关系的导航层；源码、测试及 `docs/docs-828/` 的专业正文继续作为当前事实依据。
- 不把 Outline 的职责树误画成完整 import graph，不复制整篇机制算法或字段目录。
- 不修改代码、生成文件、`docs-824/` 或独立 `tools/datapack-editor/` 的实现。
- 过时文档按 [[docs/docs-828/05-conventions/doc-maintenance]] 处理：整篇被替代时标注替代页并保留历史正文；仅局部事实过时时追加带日期的更正。仍有效的详细正文保持原位并从 Wiki 链接。
- 每篇 Wiki 由不同 Agent 独立负责；Integrator 复核交叉术语、职责边界、链接与过期内容处置。

## 并行工作包

1. **Engine / Data Services**：分别编写 Engine 与 Data Services 的层级、职责、主要协作、代码入口和既有专业正文路由；盘点这两域被新页面取代或有事实漂移的文档。
2. **App Runtime / AronaClicker Domain**：编写启动与组合根、包应用、产品领域服务、状态与读模型的关系；盘点相关旧页面的准确性。
3. **UI / Engineering Support**：编写 UI 命令/只读呈现边界，以及测试、Schema 工具和检查脚本的协作地图；盘点对应旧页面。
4. **Integrator**：建立 Wiki 索引、同步文档总索引与维护规范，核实 Agent 结果并执行替代标记/更正。

## 当前事实与代码落点

- 结构与关系地图：[[docs/docs-828/01-architecture/AC-outline-wiki]]。
- 当前唯一文档入口：[[docs/docs-828/00-INDEX]]。
- 文档维护及过期标记规范：[[docs/docs-828/05-conventions/doc-maintenance]]。
- Wiki 事实依据来自 Outline 指向的 `src/` 文件与相关测试；机制 Read Set 按 [[docs/ai/task-read-set-routing]] 路由。

## 验收

- `docs/docs-828/06-wiki/00-index.md` 能从项目总索引到达，并按 Outline 层级路由所有新页面。
- Engine、Data Services、App Runtime、AronaClicker Domain/State、UI、工程支持主题均有职责、关键协作链、源码入口及深入阅读链接。
- 页面间没有相互冲突的架构箭头；依赖方向、运行时调用和数据流明确区分。
- 只有代码或测试能证明过期的内容才被标记/更正；替代页保留旧正文或更正记录，不丢失历史依据。
- `npm run check:docs` 与本 Task 涉及文件的 `git --no-pager diff --check` 通过。
- Task 记录页面清单、Agent 分工、过时内容处置和未覆盖项；本轮不据 Wiki 完成推断整套旧文档全部过时。

## 当前核验（2026-09-28）

- Wiki 正文与核对：已完成，见下方执行记录。
- `npm run check:docs`：通过（374 个 Markdown 文件，errors: 0）。
- 本 Task 涉及的已跟踪文档通过 `git --no-pager diff --check`；新增 Wiki 文件无行尾空白。
- 自动化测试：未运行（仅文档变更）。

## 执行结果

### Wiki 页面

- `docs/docs-828/06-wiki/00-index.md`：Wiki 入口与主题路由。
- `docs/docs-828/06-wiki/10-application-runtime.md`：启动入口、Runtime 组合根、装配与包应用。
- `docs/docs-828/06-wiki/20-data-services.md`：数据契约、导入、PackManager、Registry、存储和资产。
- `docs/docs-828/06-wiki/30-arona-clicker-domain.md`：产品领域服务、PlayerState、业务写入口和 ReadModel。
- `docs/docs-828/06-wiki/40-engine.md`：Engine 子系统、依赖与运行协作。
- `docs/docs-828/06-wiki/50-ui.md`：Controller、GameCommands、只读上下文和组件。
- `docs/docs-828/06-wiki/60-engineering-support.md`：测试、独立编辑器、Schema 与维护脚本。

由三个子 Agent 分别编写 Engine/Data Services、Application Runtime/AronaClicker Domain、UI/Engineering Support；Integrator 建立入口、交叉核验关系方向，并处理旧文档。

### 过时内容的归档 / 更正

- `01-architecture/module-dependency-baseline.md`：保留原 2026-09-06 依赖快照正文，在文首标注已被当前概念图取代并链接新 Wiki，供历史追溯。
- `03-data-structures/registry.md`：补上源码现有的 Shop、FavoriteItem、UniqueWeapon、Trait、Gear、GearConfig 表，并修正逐包 load 与完整启用集校验的时序描述。
- `02-modules/ui.md`：把 Controller 行数、组件数与 CSS 文件数更新为当前源码统计（1863 行、40 个一级组件文件、20 个 CSS 文件）。
- `02-modules/state-mutation.md`：将“全部状态变更”限定为产品业务状态集中写入，并记录 TickSystem 当前直接递增 `totalFrames` 的待核对边界；未将其写成已裁定的架构例外。
- 历史内容未物理删除或移出既定目录：按文档维护规范保留快照并加替代标记/更正。仍有效的机制、数据结构与 UI 专题正文保留原位，由 Wiki 路由深入阅读。

## 剩余工作

`TickSystem.totalFrames` 与 StateMutation 单一写入口纪律的关系仍待独立裁定；本 Task 只记录该边界，不修改代码或预判架构结论。其他未被 Wiki 覆盖的字段、算法和审查细节继续以专业正文为准。

## 相关路由

[[docs/docs-828/01-architecture/AC-outline-wiki]] · [[docs/docs-828/00-INDEX]] · [[docs/docs-828/05-conventions/doc-maintenance]] · [[docs/ai/task-read-set-routing]]
