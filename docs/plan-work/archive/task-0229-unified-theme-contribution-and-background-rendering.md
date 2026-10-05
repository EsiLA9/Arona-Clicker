# Task：统一主题贡献接口、派生背景与渲染链

状态：complete — U1–U5 实施、验收与归档完成

## 目标

让游戏中所有主题来源通过同一份主题贡献接口进入解析与渲染，主题色派生的画布背景在任意主题来源和有无显式场景图层时都按统一规则生成、合成并显示。统一结果应保留背景层来源、顺序及覆盖语义，使后续主题编辑器服务能够对一般的编辑态主题读取、修改、预览和保存主题定义，而不需要为 UserTheme、ColorGroup、ThemeDef 或场景主题另写一套解析/渲染逻辑。

本 Task 覆盖通用机制与面向后续编辑服务的稳定边界；不包含实际主题编辑器 UI，也不把玩家 UserTheme 存档当作一般主题内容的持久化位置。

## 设计边界

- 本 Task 包含：统一主题来源贡献契约；ColorGroup / ThemeDef / player / scene / user / preview / ephemeral 来源适配；从最终主题 token 派生画布底层；派生底层与来源自有背景图层的合成、顺序、覆盖与预览一致性；定义面向编辑态一般主题可解析、可修改、可预览、可保存的来源寻址边界。
- 显式主题 token（包括 `bg` / `bgAlt`）覆盖同色组主色派生值；缺少显式值时继续沿统一既有派生规则计算。生成的画布底层属于主题表现贡献，不改写主题原始数据中的用户 layer，也不作为子节点父背景回退。
- 派生画布底层作为背景栈的基础内容，显式图片/纯色/渐变层在它上方按统一顺序绘制；透明场景图层能够透出底色，完全不透明图层可以遮住它。显式关闭派生底层时应由统一的层配置表达，不以来源类别硬编码开关。
- 不同主题层合并仍服从已配置的主题层优先级；颜色 token 与背景层保持一致的来源溯源。编辑态预览和运行态必须使用同一个解析/合成/渲染入口，预览可替换被编辑来源而保留其他贡献。
- “所有主题共用”涵盖外部 Init 选择页的聚焦主题投影和游戏运行时主题来源；共用解析/渲染接口不意味着 Init 主题跨越生命周期进入游戏运行态。
- 一般主题的编辑目标必须能定位到可编辑内容来源及稳定 ID，并区分玩家偏好 UserTheme 与 Datapack / 编辑态主题定义；提交保存通过对应内容写入服务完成，不由只读 UI 或运行时渲染层直接改写状态。
- 明确非目标：不恢复 Init 运行时主题；不把 Init 场景声明主题注入游戏态；不改变父子宿主不继承父级背景图层的既有规则；不实现主题编辑器 UI；不新增或恢复存档迁移；不顺手重做主题色算法或背景图层编辑器交互。
- 已裁定来源：`archive/task-0228-theme-derived-background-unified-authoring.md` 调查确认 UserTheme 当前专门把 token 派生成全局 layer，而一般场景主题没有该统一连接；用户要求所有主题共用接口与渲染机制，为后续编辑器服务提供一般编辑态主题的编辑、保存能力。

## 当前事实与代码落点

| 已核实事实 | 源码/测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| `resolveTheme()` 为色组解析完整 token；显式组 token 覆盖派生值，ThemeDef 复用色组解析后叠加本地 token。 | `src/arona-clicker/services/color-system.ts`：`resolveTheme()`、`themeContributionFromThemeDef()`；`tests/engine/color-derive.test.ts`、`tests/engine/theme-tree.test.ts` | 新统一接口须保留现有 token precedence 与色组复用。 |
| `RuntimeThemeManager` 已合并不同作用域的 token、背景、节点覆盖和 Presentation，但主题色背景 DOM layer 的创建目前由 UserTheme / Preview 产品路径特别负责。 | `src/engine/core/theme-runtime.ts`：`ThemeLayer`、`RuntimeThemeManager.resolve()`；`src/arona-clicker/services/color-system.ts`：`systemColorBackground()`、`syncUserThemeFromState()`、`setUserThemePreview()`；`tests/engine/theme-runtime.test.ts` | 统一工作应收敛来源差异，避免继续按主题来源类别复制背景生成逻辑。 |
| `buildBackgroundView()` 只有在最终输入 layer 列表为空时才生成 bg/bgAlt 渐变 fallback；有显式 Area 图片层时不会将派生色置于其下。 | `src/ui/background-service.ts`：`buildBackgroundView()`、`renderBackground()`；`tests/ui/background-service.test.ts` | 必须让派生底色成为明确的栈内容，而不是空列表 fallback。 |
| UserThemeEditor 同时提供颜色 token 编辑和背景 layer 管理，但编辑目标、草稿与持久化均是玩家 UserTheme。 | `src/ui/components/user-theme-editor.ts`、`src/ui/components/user-theme-layer-manager.ts`、`src/arona-clicker/services/user-theme-service.ts` | 后续一般主题编辑服务应复用视图/编辑能力并指向一般主题内容源，不能把其保存到玩家主题草稿。 |
| Schale Main Area 声明 Hoshino 与装饰图层，不声明派生蓝色底层；因此现状下派生 bg token 不会自动成为 Hoshino 下方的页面背景。 | `src/arona-clicker/content/areas.ts`：`base:area:schale_main`；调查记录 `task-0228-theme-derived-background-unified-authoring.md` | 回归验收需覆盖非空场景 layer 栈和透明图片图层之下仍有派生背景。 |
| `AronaClickerRuntime` 已持有 PackManager，PackManager 可保存完整编辑态 `StoredPack`；当前 Runtime Editor 只为 Mod/World/Spot 提供专门写入流程，没有一般主题定义写入服务。 | `src/arona-clicker/runtime.ts`：`packManager`、`persistRuntimeEditingPack()`；`src/data-services/datapack/pack-manager.ts`：`savePack()`；`src/ui/runtime-editor/` | 一般主题编辑服务可写回现有 editing Datapack，但必须校验目标包仍为 editing 并做内容版本冲突检测。 |

## 施工切片

### P0：冻结统一主题贡献与背景合成契约

- 盘点当前 `ThemeLayer`、`ResolvedTheme`、`PresentationDef` 与 user theme preview replacement 的可复用边界，定义所有主题来源共用的贡献接口和源标识。
- 明确派生背景的解析时机、稳定 layer ID、透明度/禁用、优先级、排序、显式值覆盖与来源溯源；派生底层必须在有显式 layer 时仍进入背景栈。
- 明确一般主题编辑态对象与玩家 UserTheme 的数据 owner、预览替换范围和保存调用边界。若需要新增 Schema / 数据契约或跨模块架构裁定，先更新本 Task 或另立 ADR 后再施工。

### P1：实现统一解析、预览与渲染

- 所有主题来源转换为同一贡献接口；token、palette、background 和 Presentation 使用既有优先级语义组合。
- 将 `bg` / `bgAlt` 派生背景统一转换为可排序、可溯源的基础画布层；删除仅 UserTheme / Preview 专属的等价背景生成分支。
- Runtime 与编辑态 Preview 共用一条背景视图构建、DOM 渲染和 ink 合成链；保留编辑 preview 对目标来源的替换能力。
- 增加定向回归测试：显式背景 layer 存在时派生底色仍在其下；透明 Hoshino 可透出底色；显式不透明背景按顺序遮挡；不同来源 token / 背景优先级一致；预览能替换目标来源而不丢失其他层。

### P2：提供一般编辑态主题的保存就绪接口

- 提供可供后续主题编辑器服务调用的通用主题目标 / 编辑草稿 / 预览上下文接口，至少包含主题来源类型、内容 ID、可写能力、版本/冲突检测依据及保存目标。
- 一般主题编辑态的变更可保存回对应编辑内容来源；玩家 UserTheme 仍保存到其既有 owner。运行时只消费解析后的只读贡献。
- 本阶段只落服务/API 与契约测试，不实现主题编辑器 UI；若项目当前没有通用 Datapack 编辑写入端口，Task 应明确接入边界并停止在可验证的 port/adapter 契约，不虚构持久化实现。

## Patch Units

该 Task 跨 Engine、产品服务、主题选择投影及 Datapack 编辑态写入，按 Unit 目录实施；每个 Unit 完成后填写 Receipt。

### [U1](task-0229-units/0229-u1-runtime-theme-composition.md)：主题来源统一合成与派生画布底层

覆盖 RuntimeThemeManager 的通用 source identity / 替换预览 / 派生底层合成，并收敛 UserTheme 专属底层注入。Receipt：`task-0229-units/receipts/0229-u1-runtime-theme-composition-receipt.md`（定向测试 54/54，类型检查通过）。

### [U2](task-0229-units/0229-u2-selector-theme-projection.md)：外部选择页复用统一背景合成

覆盖 Init selector focus 与恢复 Area 投影；保留 Init 仅选择页有效的生命周期规则。

### [U3](task-0229-units/0229-u3-theme-content-contract.md)：一般主题可编辑背景契约与 Schema

覆盖 ThemeDef / ColorGroupDef 的统一背景派生开关及独立 Datapack Editor Schema 同步。

### [U4](task-0229-units/0229-u4-theme-background-disable-propagation.md)：跨来源派生底层禁用选项传播

覆盖一般主题开关对 player / scene / selector 投影的适配与统一禁用语义。

### [U5](task-0229-units/0229-u5-editable-theme-save-service.md)：编辑态主题读取、预览与保存服务

覆盖 ThemeDesign / ColorGroup 编辑目标寻址、草稿基准、冲突检测、统一预览和保存回 editing Datapack。

## 测试与验收

- [x] ColorGroup、ThemeDef、场景主题、UserTheme、Preview 与剧情临时主题经同一贡献接口进入解析；现有来源优先级与显式 token 覆盖行为保持。
- [x] `bg` / `bgAlt` 派生的基础背景在最终背景 layer 栈非空时仍存在，并位于显式主题/场景图层下方；不透明覆盖层依 CSS 合成规则遮挡。
- [x] UserTheme 与一般编辑态主题使用同一背景视图/渲染入口；来源替换 Preview 保留其它主题贡献和图层顺序。
- [x] 外部 Init 选择页聚焦主题仍使用同一解析/渲染机制；Init 主题继续只在选择页可见，不注入游戏运行时。
- [x] 夏莱主厅 Area 的 Hoshino / triangles 显式层下方保有合并主题派生底色；Init 运行时隔离规则保持。
- [x] 一般主题编辑态变更可通过 source-aware API 预览并保存回对应 editing Pack 的 ThemeDesign / ColorGroup / 直接 ThemeDef / EntityPresentation ThemeDef owner 路径；玩家 UserTheme owner 不变；无 UI 混入。
- [x] 更新当前机制文档，记录统一贡献接口、派生背景及一般主题编辑保存 owner 边界；GALHCG 代码/测试 Evidence 已审查并闭环。
- [x] 定向主题/编辑服务/Schema 测试、实现阶段 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git diff --check` 通过；最终复查中 workspace-wide 类型检查出现与本 Task 无关的玩法 B 文件错误，已记录并隔离。

## 当前核验（2026-10-04）

- 实现结果：U1–U5 均完成。`RuntimeThemeManager.resolve()` 统一置入派生底层与 source-ID Preview；selector 共用同一背景 helper；ThemeDef / ColorGroup Schema 同步同一禁用字段；运行时 Area/student/player/UserTheme 和 selector 投影统一传播；`ThemeContentEditorService` 绑定 editing Pack、内容 owner / kind / id / ThemeDef 字段路径与开始时 digest，并通过同一 RuntimeThemeManager 预览、冲突检查和回写原 Pack。ThemeDef owner 路径包含 Datapack 直接主题字段及实体表现默认项、附加项。详细变更与单元测试见各 Receipt。
- 最终定向验证：主题 / selector / 编辑服务 / Schema 合并运行 60 tests 通过；实现阶段的 `npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`（623 markdown / 0 errors）与 `git diff --check` 通过。归档后重跑 `npm run check:docs` 与 `git diff --check` 通过；最后一次 workspace-wide `npx tsc --noEmit` 因未触及的 `src/arona-clicker/services/operation-plan-preparation.ts`（190、201 行）和 `operation-target-selection.ts`（60 行）存在 3 项 TypeScript 错误而失败，主题编辑服务没有出现在诊断中。`tests/ui/controller-init-select.test.ts` 聚焦 Init 生命周期测试通过；整文件另有与本任务无关的 Lobby 标题预期错误。`tests/data/pack-editing-state.test.ts` 联合运行另有既存完整排序列表断言失败，U5 专项测试 5 项通过。

## GALHCG 影响闭环

- 发现路径：`resolve_project` 返回 `project_id=acprogram` 且根目录匹配；`lookup("theme runtime")` 为完整零命中；`lookup("ColorSystem")` 唯一精确命中 `concept:color-system`。调查 Task 0228 的源码查询已确认 `system-color-background`、ThemeLayer、UserTheme 编辑与保存链，并用于本 Task 的统一机制实施。
- 变更审查：本轮对 14 个源代码 / 测试路径以及主题机制文档、规划索引逐路径执行 `review_changes`；所有直接 Evidence 均为 `unchanged`、stale=0，机制文档 8 个 owner 分两页审查完成。新增服务和测试分别在 `src/arona-clicker/services` 与 `tests/engine` 定向 refresh 后索引成功。`tools/datapack-editor/schema/engine-defs.gen.json` 为生成文件且无直接 maps_to，不新增语义映射。Task / Unit / Receipt 仅作规划与验收记录，不挂实现 Evidence。
- 地图维护：`plan_map_updates` 完整计划 2 node + 9 edges、15 条按 owner 计数的 Evidence；节点批 6 条、关系批 9 条均独立 dry-run `valid=true` 后提交成功。更新了 `concept:theme-content-editor-service` 对编辑态 Pack owner 路径能力的摘要，以及其 service/test/documentation 映射；并更新 ColorSystem、EntityPresentationService、UI Presentation Layer 到机制页的证据、planning-records 节点与规划索引关系的版本。写后 `review_changes` 确认直接 Evidence stale=0、owner 分页完整。

## 剩余工作

- 实际图形化主题编辑器 UI、主题内容的新增/删除/导入导出与多用户协作冲突界面不属于本 Task；可在本 Task 归档后另立阶段。

## 相关路由

- `archive/task-0228-theme-derived-background-unified-authoring.md`
- `docs/ai/context-packs/ui-presentation.md`
- `docs/docs-829/06-wiki/50-ui/presentation-theme.md`
- `docs/docs-829/05-conventions/schema-sync.md`
- `src/arona-clicker/services/color-system.ts`
- `src/engine/core/theme-runtime.ts`
- `src/ui/background-service.ts`
- `src/ui/controller-theme.ts`
- `src/ui/components/user-theme-editor.ts`
