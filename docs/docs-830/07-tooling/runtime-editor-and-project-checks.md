# docs-830/07-tooling/runtime-editor-and-project-checks — 游戏内编辑器与工程检查

本文回答：游戏内 Runtime Editor、独立 Editor、开发入口和项目检查分别承担什么职责。

## 编辑器职责

游戏内 Runtime Editor 位于 `src/ui/runtime-editor/`。它集成在当前游戏 Runtime 中，提供包目录、内容草稿、定义编辑、诊断与内容浏览等 UI；创建、替换或删除定义通过 Controller 命令交给 Runtime 内容协调器，由 Runtime 校验并写入对应编辑包。图鉴只读查询使用当前 Registry，不等于编辑草稿。

独立 Datapack Editor 位于 `tools/datapack-editor/`，以 Schema 驱动的本地模型为中心，导入/导出 JSON 或 ZIP；它不连接当前游戏 Runtime。两者共享内容契约和 Schema，但拥有不同的状态与提交边界，具体见 [[datapack-editor-and-schema]]。

### Story Editor E1

游戏顶栏右侧的“Story 编辑器”打开独立 `story-editor` Workspace，大厅未进入 Init 时也可用。左栏查询当前 Registry 的 Story 定义与本地草稿，按名称/ID 搜索；中栏按 `nodes` 顺序呈现作者节点并在固定底部输入；右栏编辑当前节点，未选中时编辑 Story 名称。三个栏使用共享顶部、单一表面和独立滚动，入口不复用播放用途的 `story` 路由。

作者可以追加角色、老师或旁白正文，显式追加单按钮 Click，以及暂未配置的 Operation/Transfer。正文与旁白复用纯 `renderChatEntry`，不绑定游戏 `ChatStream`、发送 token 或剧情推进；老师是右侧 talklet。节点点击/右键均为选择，Click 在编辑器里不会执行。编辑器不提供播放、导出或包发布；显式写入当前 Registry 的原型入口见下文。

右栏属性面板固定为“节点类型 → 当前分支基本项 → 可选能力 → 高级项/阶段 → 字段诊断与节点操作”。节点 ID 只读，类型可显式切换并保留同一 node.id；切换类型或分支只改变启用状态，旧输入休眠在草稿，恢复时取该节点/该行最近一次输入。未启用可选能力时保留开关并收起子项；启用后立即渲染字段，首次进入不代填目标、空效果或首个目录项。不适用的分支不显示也不提交。

字段矩阵覆盖 Talklet 的 talk/narration、呈现与节奏；Click 的 button（含可选 press 与 reply/result）、choice（有序选项、条件、回复、结果与 sharedActions）、entryCard（固定 active/card、owner 全局 null 或角色游标）；Operation 的 state/travel/entryRequest/overlay/presentation 及 localFlag；Transfer 的 goto/insert。StoryAction 列表在同一编辑块内复用，行身份来自草稿稳定 rowId 而非数组索引，支持增删与上移下移。style 使用合同明确定义的字段（font/fontSize/color/background/backgroundColor），不写 CSS；theme 的 scope 是特殊切换，只休眠/恢复 area 或 student 的 entityKey，颜色组与 palette/tokens/nodes/background 覆盖保持；setEntityPresentation 先选 target，再选该实体的 optionId，缺目标时选项控件禁用并说明。

引用目录来自当前 Registry 的完整内容表（含 `characterVariants` 与 `pics`），不按玩家解锁/拥有状态筛选；当前 Story 自身允许引用，其他未提交草稿不能成为有效引用。图片字段同时提供目录候选与自由输入，自由 speaker 是显示名而不是角色外键。缺失引用显示原值并报错，不跳回首项。

本轮编辑能力的明确边界：条件复用现有条件树渲染，复杂只读值（palette/tokens/nodes/background、数值表达式、嵌套 ExtraValue、过深条件树）只读保留并完整参与提交；可显式清理或改选已支持分支，不提供完整可视化设计器，也不生成 `{}` 冒充已配置值。

作者内容仍只有 `nodes` 一份有序列表，保留 `stages`、extra 和所有未开放字段；移动保持 node.id。新正文各有独立 auto 阶段，显式 Click 各有独立 input 阶段；已有阶段不因移动而自动拆并，暂时不连续的分组也允许保存。类型切到 Talklet/Click 时必须有一个阶段声明，节点沿用缓存阶段或获得独立新阶段；推进方式不被改写，也不会自动补 Click。未配置 Operation/Transfer 仅在专用草稿类型中允许缺省载荷，正式 StoryDef 合同不变。

草稿通过 `StorageAdapter` 保存到独立 `acprogram_story_editor_drafts` key，版本信封与来源 ID 独立于 PlayerState、游戏存档和 Runtime Editor 的包草稿。`editorState` 只存草稿侧元数据：分支缓存、可选开关、稳定行身份、原始数值文本与字面量类型；它不进入 StoryDef、extra、PlayerState 或 Registry。打开注册来源时深拷贝，单纯浏览不保存；修改后保存、切换 Story 或离开时统一写入本地。重命名只改副本，删草稿仍保留注册来源。未发送文字在会话内按文档保留，不自动变成节点或进入持久化文档。

不完整草稿允许保存：草稿信封只校验已填字段的基本形状，缺省 text/options/card 等载荷仍是合法草稿。保存失败保留内存内容并阻止切换/离开，重试成功才标记已保存。加载发现损坏/不支持的版本时保留原存储，暂时只读浏览，避免覆盖作者资料。

`StoryEditorController` 持有独立 UI 会话，普通更新由既有 dispatcher 的 `workspace.story-editor` region 合并，按节点 key 协调 DOM；编辑输入、滚动容器和未改节点保留。主题背景与内容包装有不同身份，主题插入背景不应替换正在输入的内容。Frame 缺失时先恢复页面内容区域，shell 缺失才恢复当前页面。返回保留进入前的 Workspace 和导航，已失效的目标回到游戏。提交失败时先选中出错节点，再由同一次 refresh 在补丁完成的 DOM 中聚焦对应字段，不假设微任务时序。

源码入口：`src/ui/story-editor/model.ts`、`property-model.ts`、`property-fields.ts`、`property-options.ts`、`persistence.ts`、`view.ts`、`dom.ts`、`controller.ts`；接线位于 `src/ui/controller/controller.ts`、`controller-actions-topbar.ts` 和 `src/ui/workspace/workspace-renderer.ts`。行为、属性表单与 DOM 连续性见 `tests/ui/story-editor-model.test.ts`、`story-editor-workspace.test.ts`、`story-editor-properties.test.ts`、`story-editor-properties-model.test.ts`。按用户要求只做代码与自动化验证，未做浏览器验收。

### StoryDef 保存到运行内容（原型接线）

右栏为所有节点提供单个可选“需要局部标记”名称；留空关闭，编辑态始终显示节点。空 Operation 可以选择局部标记写入/移除，写入开放文字、数字、布尔和 null；已有复合 JSON 值保留，暂不提供复合值设计器。命名提示推荐 StoryName-flagid，不强制。局部标记专用表单与属性面板共用同一份草稿：面板只说明其字段沿用专用表单，不另存第二份作者状态。

普通 scalar 字段的其他行为由属性面板按分支呈现，不再降级为 E0 摘要；不在当前分支的字段休眠在草稿缓存中，切换回来可恢复。

局部标记数字的原始输入与最近一次值类型以草稿侧 localFlagInputs 持久化；未完成的 `-` 等可存草稿，但显式 Runtime 保存会阻止提交，不能发布之前的合法值。移除动作不提交 value；切回写入可恢复这份输入。该元数据不进入 StoryDef/Registry，删除节点时清理。正式 requiresFlag 与 localFlag 动作由结构验证及 Registry 保存边界校验；运行作用域见 [[story-and-effects]]。

中栏的“保存到运行内容”是显式命令，与“保存草稿”分开。它经 `GameCommands.saveStoryDefinition()` → `GameInstance.saveStoryDefinition()` → `Registry.saveStoryDefinition()`，按相同 Story ID 新建或覆盖当前定义。普通文本编辑、草稿保存、切换和退出仍只保存本地草稿，不自动改 Registry；删除草稿也不删除实际定义。

这条接线按用户要求暂不检查编辑态 Mod，也不写回包文件、包记录或玩家存档。Registry 是当前运行的有效表，重新装载内容后以数据包为准；界面成功提示明确标明“仅当前运行有效”。保存不会创建 StoryEntry 或启动剧情。已有播放 Session 和 Player 均持有文档副本，继续播放旧内容；下一次启动读取新的定义。

`storyDefinitionFromDraft()` 先做草稿侧检查（已启用但缺必填配置的可选项、局部标记未完成输入），再把草稿复制成候选并交给 `src/data-services/authoring/story-definition-projection.ts` 的 `projectStoryDefinition()`。该投影逐层重建 talklet/click/operation/transfer、content、interaction、action、command、result、value 与 stage，只输出当前分支和已启用的可选字段；缓存、UI 标志与未解析输入不进入候选，合法的 extra/tokens 等字典按合同保留。数值文本按字段类型转换（pacing、坐标、按击、amount、条件比较值，以及作者显式选择的字面量类型），无效文本原样进入校验并报错，不转成 0。

`Registry.saveStoryDefinition()` 在写入前用同一投影对深拷贝做递归合同与引用校验：未知结构键、混合分支、编辑器元数据、畸形值与缺失引用均被拒绝，失败不修改原定义，也不做部分替换。投影是纯函数，重复执行结果一致且不改输入。

拒绝策略不等于自动删字段：来源中的未知/非法字段留在草稿，界面按节点列出诊断路径并提供逐项“清理该字段”入口，由作者显式处理。包提交、编辑态 Mod 门控与发布流程仍未接入。

成功后关联来源 ID，避免新 Story 在左栏出现“注册来源”和“草稿”两项，并尝试保存本地草稿。若此时本地存储失败，已完成的 Registry 写入保留，界面分别提示运行内容成功和草稿失败，不声称整个操作回滚。验证见 `tests/engine/story-definition-save.test.ts` 和 `tests/ui/story-editor-workspace.test.ts`。

## 应用入口与工程检查

Vite 配置把 `/game` 与 `/editor` 分别路由到游戏 UI 和独立 Editor HTML，并以多页入口构建 portal、game、editor。项目脚本承担生成、诊断与测试：

| 命令 | 用途 |
| --- | --- |
| `npm run gen:schema` | 从 Engine 与 Datapack 契约生成 Editor Schema |
| `npm run check:architecture` | 检查 Engine / Data Services 依赖边界 |
| `npm run check:docs` | 检查 Markdown、WikiLink 与文档结构 |
| `npm test` | 运行 Vitest；详细输出保存到 `.test-artifacts/latest.log` |
| `npm run ui:callgraph` | 分析 UI 调用链，按参数输出局部摘要或结构数据 |
| `npm run datapack:export-base` | 将默认 TypeScript 内容导出成标准 Base Datapack 目录 |

`gen-engine-schema.mjs` 的 `--write` 会更新 `tools/datapack-editor/schema/engine-defs.gen.json`；该文件是生成产物，应从契约和生成器修正。Vite 路由、Schema 生成、静态边界检查与测试分别验证不同层面，不能相互替代。

源码入口：`vite.config.ts`、`index.html`、`src/ui/main.ts`、`tools/datapack-editor/ui/main.ts`、`scripts/gen-engine-schema.mjs`、`scripts/check-architecture-boundaries.mjs`、`scripts/check-docs.mjs`、`vitest.config.ts`。

相关测试见 `tools/datapack-editor/schema/engine-schema.sync.test.ts` 与 `tests/ui/runtime-editor-definition.test.ts`、`runtime-editor-pack-export.test.ts`、`runtime-editor-codex-integration.test.ts`。游戏界面的读写入口见 [[read-model-and-ui]]。

## 选择正确的检查

修改源类型时，Schema 生成与同步测试检查编辑器字段契约；Registry 校验与领域测试检查内容能否装载及其行为。`check:architecture` 检查静态依赖边界，`check:docs` 检查文档机械规则，都不能证明运行时功能正确。独立编辑器字段的生成和覆盖过程见 [[editor-schema-to-form]]。
