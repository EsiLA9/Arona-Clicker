# Task：Story 关联羁绊数据转为剧情入口表达

状态：进行中 — 已核对 StoryEntry 的旧 `kizuna` 关联和 Click 交互入口；开始迁移编辑器与内容表达。

## 目标与范围

- 目标：全面把 Story 内容中作者使用的关联羁绊结构迁移为剧情入口（StoryEntry）表达；Story 编辑器不再提供关联羁绊模式。
- 范围与明确非目标：保留旧 `StoryEntry.kizuna`、`kizunaCard` 及其运行机制作为兼容机制；不删除旧存档/数据合同，不改变其运行语义。新编辑流程使用剧情入口卡选择具体 StoryEntry；地点继续保留原有语义。
- 验收：编辑器不出现关联羁绊模式；新入口能选择 StoryEntry；旧数据仍可投影/播放；相关测试与文档通过。

## 当前进度

- [x] 核实编辑器、合同、运行时中 `kizuna` / `entryCard` / `areaContinue` 的职责。
- [ ] 将编辑器作者表达迁移为剧情入口，并确保其目标为 StoryEntry。
- [ ] 盘点并迁移仓库内 Story 内容使用的旧关联羁绊数据结构。
- [ ] 更新测试、机制文档并验证旧运行机制仍兼容。
- 正在进行：定位内容迁移所需源文件与编辑器分支。
- 下一步：完成调用面变更并运行定向验证。

## 相关文件与资料

| 路径或链接 | 用途 | 当前状态 |
| --- | --- | --- |
| `src/data-services/contracts/story-entry.ts` | StoryEntry 旧羁绊绑定 | 已核对，运行机制保留 |
| `src/data-services/contracts/story-node.ts` | Click 合同 | 已核对 |
| `src/ui/story-editor/property-fields.ts` | Click 编辑器选择项 | 待修改 |
| `src/ui/story-editor/authoring-view.ts` | StoryEntry 羁绊作者表单 | 待核对/修改 |
| `src/arona-clicker/services/story/story-service.ts` | 旧运行机制 | 已核对，保留 |
| `tests/ui/story-editor-properties-acceptance.test.ts` | 编辑器入口测试 | 待修改 |
| `tests/ui/story-editor-authoring.test.ts` | 作者表单测试 | 待修改 |
| `tests/engine/story-continuation.test.ts` | 旧机制兼容测试 | 已有测试覆盖，待验证 |

## 事实与决定

| 问题 / 决定 | 已核实事实及源码、测试或文档依据 | 待解决问题 |
| --- | --- | --- |
| 旧羁绊数据 | `StoryEntry.kizuna` 保存 `entryId`、可选赴约 Area 与回传标记；StoryService 有对应子故事接续流程 | 保留为兼容机制 |
| 新作者表达 | `entryCard` 的 request 指向 Entry ID；编辑器选项使用 StoryEntry 候选 | 全量仓库内容迁移范围待盘点 |

## 验证与结果

| 检查对象与方式 / 命令 | 实际结果 | 失败后的排查与处理 / 未执行原因 |
| --- | --- | --- |

- 当前结果：任务已建立，实施中。

## 剩余工作与交接

- 完成编辑器和内容数据迁移后更新此记录及活动索引；保留旧机制验证结果。
