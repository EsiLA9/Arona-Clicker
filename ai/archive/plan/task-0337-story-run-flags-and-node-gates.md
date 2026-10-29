# Task 0337：Entry 局部键值标记与 StoryNode 存在条件

状态：完成 — 局部 Map、四类节点存在条件、初始投入、快照与编辑器最小闭环已实现；22 文件、163 项通过。按用户要求不进行浏览器验收。

## 目标与确定的最小合同

- 一次 Entry 播放有独立 `Map<name, value>`；值为可保存的 JSON 数据，允许 false、0、空字符串、null、数组与对象。不开放值比较。
- 名称非空，提示作者采用 `StoryName-flagid`，不强制前缀、不改写名称。只按精确键存在性检查。
- 四类 StoryNode 共用可选 `requiresFlag?: string`，每个节点最多一个；缺省正常执行，指定键不存在则跳过整个节点。Talklet 不投递；Click 不等待、不取随机、不回复；Operation 不执行；Transfer 不跳转。
- 到达节点时检查一次，已有等待点不重新评估。全部跳过自然结束，沿用自动步数保护。阶段合法性仍按作者静态结构检查，运行时跳过不重写 stages、不补 Click。
- 新增 StoryAction `kind: localFlag`，`op: set/remove`、name，set 必须有 value；同样可用于 Operation、Click 共享/选项结果动作。set 同名覆盖，remove 缺失键为无操作。播放器处理局部数据，不流入 EffectEngine/PlayerState.flags。
- 启动 Entry/底层播放器可显式投入初始键值表，复制后归本次 Run 所有；goto/insert 共享。另起 Entry 不继承，owner 间不共享；完成、取消、替换、失败释放。
- 本次表随等待点快照保存恢复，拒绝坏表且不替换现有会话；不新增旧存档迁移。现有 `session.flags` 写入记录与持久 setFlag 保持原意。

## 编辑器范围与结构

沿用 Story Editor E0 的三栏和自然高度。右栏固定节点身份下增加 `需要局部标记（可选）` 文本输入，留空关闭；提示精确存在性与命名建议。不在编辑态过滤任何节点。

Operation 空节点可选写入/移除局部标记，显示 name；只有写入显示 value。值优先提供字符串/数字/布尔/null 控件，已有复合 JSON 值只读保留，不建设复合值设计器。坏数值的原始输入可存草稿，但不得以旧值提交。已有其他 Operation 不被切换器静默覆盖；其完整编辑仍属 [[ai/plan/task-0336-story-node-properties-and-safe-projection]]。

```text
既有 inspector（稳定 node.id）
  类型 / ID
  requiresFlag 输入（所有节点）
  既有正文控件 或 localFlag op / name / 值类型 / 值
  既有移动 / 删除
```

逐字段更新当前节点与表单，保留焦点、流滚动、其他节点与三栏根。新控件复用现有 label/input/select 与 keyed DOM patch，不新增页面容器或渲染调度器。Registry 保存必须验证 requiresFlag/localFlag 载荷及 JSON 值；部分草稿不因未配置而被拒绝。本次不顺带实现 0336 全部分支缓存/表单。

## 已核实事实与施工入口

| 路径 | 已知事实 / 修改方向 |
| --- | --- |
| `src/data-services/contracts/story-node.ts`、`story-node-actions.ts` | 共用 NodeBase；新增单键条件与局部行为合同 |
| `src/arona-clicker/services/story/story-node-player.ts` | drain 统一分派四类节点；在生成等待/执行行为前判断，Run 持有 Map |
| `src/arona-clicker/services/story/story-service.ts`、Runtime 命令合同/适配 | Entry 现在不收初始参数；增加可选参数，先验证复制再替换会话 |
| `src/engine/contracts/story-node-snapshot.ts` | 等待点快照；增加局部表字段，不塞 source 或持久玩家 flags |
| `src/data-services/validation/story-node-structure.ts`、Registry 保存验证 | 静态条件/动作校验；不接受数组条件、畸形 JSON、remove 残留 value |
| `src/ui/story-editor/` | 追加最小条件与局部行为编辑；草稿独立持久化，Runtime 显式提交 |
| `tools/datapack-editor/schema/editor-extras.ts`、Schema 生成器 | 同步正式作者字段与行为分支，通过生成命令维护协议 |

## 验收与执行进度

- [x] 核对播放器、Entry 生命周期、持久 flags 和现有会话 flags 的边界；确定上述合同。
- [x] 建立关键行为测试：false/0/空/null 存在；四类跳过；set/remove/覆盖；分支动作有序；insert/goto 共享；不同 Entry/owner 隔离。
- [x] 实现合同、初始参数、播放器与完整快照验证；坏参数先拒绝、坏快照原子拒绝；当前等待点恢复不重判。
- [x] 实现编辑器最小闭环与草稿/Registry 校验；输入焦点及节点/滚动身份保持；保留自然高度。复合值在移除、草稿重开、切回后恢复。
- [x] 通过生成命令同步 Schema 与作者补充说明；定向回归、类型、架构、文档、构建检查通过。
- [x] 更新 Wiki、风格记录与执行回执并归档；地图只读复核结果见末尾记录。

必验边界：值深复制；特殊键（包括 __proto__）按普通 Map 键处理；无值 set/非法值/空 name/多键条件被拒绝；跳过节点无随机、行为、投递或等待副作用；全部跳过可结束；已等待节点不因恢复重复判断；恢复不重放局部或持久动作；持久 flags 不被局部写入/清理。

所有测试通过 `npm test`，完整输出 `.test-artifacts/latest.log`，本任务记录另存 `.test-artifacts/`。生成 Schema 只通过 `npm run gen:schema`；构建输出使用 `.test-artifacts/`。本轮不访问浏览器、不修改源 Pack。

## 验证回执与交接

| 验证 | 实际结果 |
| --- | --- |
| 首轮核心行为复现 | 10 项中 5 项失败，确认当时不会跳过节点、保存局部表或拒绝坏表；日志 `.test-artifacts/0337-before.log` |
| 最终 npm test 定向整合 | 22 文件、163 项通过；覆盖 Player、正式 Entry/save/load、动作宿主、Registry 保存、结构、E0 UI、运行聊天投递和 Schema 同步；日志 `.test-artifacts/0337-final.log`（同时保留 latest.log） |
| 类型 / 架构 | `npx tsc --noEmit` 与 `npm run check:architecture` 通过 |
| Schema | `npm run gen:schema` 已执行；生成物与同步测试通过，独立 Editor 继续使用既有节点 JSON 编辑入口并补充新合同说明 |
| 文档 / 构建 | `npm run check:docs` 通过；`npm run build -- --outDir .test-artifacts/0337-build` 通过，仍有现有大 chunk 提示 |
| 浏览器 | 未访问、未验收，遵循用户要求 |

本轮修改入口表中所列生产文件、作者 UI 与验证模块，并新增 `src/engine/contracts/story-run-flags.ts`、`src/data-services/validation/story-run-flags.ts`、`src/ui/story-editor/flag-fields.ts`；运行与集成新增测试为 `tests/engine/story-run-flags*.test.ts`，编辑器测试扩展既有两文件。机制权威说明更新到 [[story-and-effects]]、[[save-system-and-recovery]]、[[runtime-editor-and-project-checks]]。

范围限制：不提供值比较、多个条件、NOT/AND/OR、复合值设计器；不修改持久 flags、源 Pack 或 0336 的完整编辑框架。初始投入由调用方命令提供，未另外建设游戏中的调试面板。旧的播放中快照缺少 localFlags 时拒绝恢复，不迁移；新存档、owner 隔离与原子恢复已验证。0336 仍为 proposed。

项目地图已确认 acprogram 身份；收尾集中核对 33 个直接影响文件，9 个已有映射返回 content_changed、24 个返回 unreferenced_path。两处 owner 分页均续读完成；这些是地图覆盖/旧依据状态，不是功能失败。完整只读回执 `.test-artifacts/0337-map-health.json`，未改图、刷新或写 freshness。33 文件定向空白检查通过，归档后文档检查再次通过（105 篇、0 错误）。剩余工作：无本任务必要施工项；浏览器按用户要求未执行，0336 的完整属性编辑仍待另行施工。
