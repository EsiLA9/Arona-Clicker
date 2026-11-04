# Task 0354：Story 编辑器作者 API 与编写闭环

状态：代码与自动化施工完成（2026-11-04），桌面手动验收待进行。承接 [[ai/plan/task-0353-story-editor-remaining-gaps]]。

## 目标与边界

将 0353 的已核实缺口提供给游戏内 Story 编辑器：嵌套动作、表达式 / JSON / Extra、主题覆盖、Story 身份、Entry 与受限羁绊关联、被动池 / 目录组织、执行验证和包保存。保留现有引擎合同与一层子调用约束，不开放内部游标 / token，不恢复阶段控制。

## API 与交互设计

- 草稿 API：按稳定节点 / 动作行路径读取与修改；结构化值由显式类型与字段表单构造，错误输入保留在草稿并阻止提交。一个动作在 Operation、Button result、Choice result、sharedActions 中采用相同字段模型。
- 作者内容 API：一次提交相关 StoryDef / ActiveEntry / PassiveEntry / PassivePool，在候选内容上校验引用与父子关系，全部成功才应用；检查与应用共用规则。UI 经 GameCommands 调用，不直接写 Registry。
- 保存 API：运行内容与编辑态目标包分开；目标必须明确且允许编辑，保存前验证，沿用 PackManager 的持久化 / 导出，不覆盖包内无关内容。
- UI：保留三栏与原滚动宿主；节点仍在右栏编辑，Story 信息下增加文档扩展与关联内容。大标题下平铺标题、控件、说明；复杂对象 / 列表按真实结构增删，不用只读摘要替代编辑。
- 编辑更新沿用 `patchEditorDOM` 的路径 key 与 region 更新；保留输入节点、焦点、光标和滚动，删除范围沿用 popover 清理入口。新增容器只用于字段分组和列表行，不重建页面。
- 试播在独立游戏实例中运行候选数据，不修改正式进度；正式父子与场景规则由原播放器执行。静态中栏继续只选择节点。

## 施工与验收

- [x] 补草稿值构造 / 嵌套动作字段与回归。
- [x] 增加候选作者内容 API，验证失败原子拒绝。
- [x] 接入文档身份、Entry / 羁绊关联、池与目录的作者界面。
- [x] 接入候选试播、编辑态包保存 / 重载。
- [x] 执行定向行为、类型、架构、Schema、构建与文档检查，区分既有失败。
- [ ] 桌面手动验收表单密度、真实主题表现、试播与包管理衔接。

## 文件与证据

| 范围 | 入口 | 当前状态 |
| --- | --- | --- |
| 草稿与 UI | `src/ui/story-editor/authoring-model.ts`、`authoring-view.ts`、`structured-value.ts` 及原 model / persistence / property / controller / view，`src/ui/css/story-editor.css` | 已实施；平铺字段、稳定行、错误输入缓存与生命周期清理 |
| 合同与候选验证 | `src/data-services/authoring/story-authoring.ts`、`content-policy-dsl.ts`、`registry/registry.ts`；`contracts/runtime/story-authoring.ts` | 已实施；复用正式 Story 投影与数据包校验，不新增 Story 数据格式 |
| Runtime 写入口 | `runtime-game-instance.ts`、`runtime.ts`、`runtime-commands.ts`、`contracts/runtime/runtime.ts` 与导出 | 已实施；检查 / 应用 / 试播 / 编辑包保存 |
| 包与剧情目录 | `src/data-services/datapack/pack-manager.ts`、`src/ui/columns/authored-story-catalog.ts`、`story-navigation.ts` | 包同步保存失败回滚；Entry Extra 投影目录 |
| 测试与说明 | `tests/engine/story-authoring.test.ts`、`tests/ui/story-editor-authoring.test.ts`、[[runtime-editor-and-project-checks]]、`ui-style/patterns.md` | 新增 16 项行为证明并同步说明 |

## 已交付能力与约束

- `validateStoryAuthoring(patch)` 只校验，`applyStoryAuthoring(patch)` 原子应用四张作者表与显式删除；无效引用、循环池、嵌套羁绊、重复关联、非法效果 / 值不提交。删除同时检查仍存正文、独立后续与 Init 起始引用。应用后更新 Entry 标签索引。
- `createStoryAuthoringPreview(patch, entryId)` 返回 getView / getStory / getSendState / advance / close 端口。它复制已载入包、当前 Story 作者表和玩家快照，使用隔离重读通道验证分支 / 父子回传；不结算持久效果与奖励，移动只影响隔离实例。换 Story、离开或销毁编辑器会清理实例与定时器。新世界定义仍须先从包载入；试播不替代正式旅行和奖励验收。
- `saveStoryAuthoringToPack(packRecordId, patch)` 只接受指定编辑态包，按身份合并，保留其它表 / 资源；新身份使用目标包命名空间。保存包与应用到当前运行分别操作，导出 / 重载复用包管理；同步存储失败保留旧包，异步持久化沿用现有管线。
- 数值表达式、复合 JSON、Extra、theme 详细覆盖可构造和修改。作者输入 / 渲染最多 128 层 JSON；草稿原始无效数字跟随稳定行，换序、改节点 ID、休眠分支与重载后仍可恢复，不发布上一合法值。
- Entry 羁绊使用专用目标、直接 / Area 赴约、回传白名单控件，继续禁止 after 与嵌套子故事。其余字段按真实结构编辑；修正持久 `setFlag` 标签，补条件键候选与控件标题。
- Story ID 以“另存为新身份”创建，保留原文档 / 外部引用。剧情目录保存在 Entry `extra.v.storyCatalog` 中，category / part / chapter 为 str，随包导出，不依赖内置目录改动。

## 自动化结果

- 15 个文件共 185 项：175 通过、10 项既有失败；新作者 API 9 项与 UI 7 项全部通过。覆盖原子拒绝、引用删除、标签刷新、未发布候选隔离、父子串联回传、包保存 / 导出 / 重载、存储回滚、嵌套动作、焦点、错误输入与稳定行、复杂值和目录。
- 10 项失败名称与修改前 `.test-artifacts/story-editor-presentation-tests.log` 完全一致，无新增失败；位于 `story-editor-properties.test.ts` 和 `story-editor-workspace.test.ts`，主要为旧样例缺 startContext，另有旧四节点类型断言。完整最终日志：`.test-artifacts/task-0354-final-tests.log`，本轮原始输出亦在 `.test-artifacts/latest.log`。
- `npx tsc --noEmit`、架构边界、Schema 生成与同步测试、Vite 构建、`git diff --check` 通过；构建只输出 `.test-artifacts/task-0354-build/`，保留既有体积提示，无生成 Schema 差异。
- `check:docs` 仍报既有 6 个缺失链接，未新增；日志 `.test-artifacts/task-0354-docs.log`。未执行全量测试和浏览器 / 桌面视觉验收。
- 地图集中只读复核 32 条直接路径：12 条已关联路径为 content_changed，20 条无直接 Evidence / maps_to；2 条 owner 分页已续读完整。未改图、刷新或写 freshness。

## 手动验收入口

1. 打开游戏内 Story 编辑器，新建 Story，明确起始 Area / Chara；在 Story 信息中另存目标包命名空间的身份。
2. 新增主动 Entry，配置触发条件 / owner / Init；为正文添加 Button / Choice 并编辑局部标记，对象 / 列表和数值表达式可直接构造。
3. 为父 Entry 配置羁绊目标与 returnFlags，选择直接或 Area 赴约；正文使用 kizunaCard，子正文不得再调用子故事。
4. 选择关联 Entry，执行“校验作者内容”和“隔离试播”；验证选项、子故事与父后文，关闭后检查正式进度未变化。
5. 在包管理创建编辑副本，再回 Story 信息选择目标包保存；从包管理导出并重载，检查 Entry、池和目录保留。
6. 输入未完成数字、换序、换节点类型并保存草稿后重开，确认错误输入跟随原行并可继续修正；检查主题字段与长对象的桌面显示。
