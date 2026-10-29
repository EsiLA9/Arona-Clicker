# Task：RuntimeEditor 原子条件目标编辑器注册表

状态：active — 🟡 P0、P1 已落地，P2 布尔目标施工中

## 目标

将 runtimeEditor 原子条件从统一的 `key / comparator / value` 表单，演进为由首个 `ConditionTarget` 决定后续字段、候选引用、摘要和校验的目标编辑器体系。

## 设计边界

- 第一阶段保持引擎 `Condition` / `ConditionGroup` 数据结构不变；目标编辑器负责把专用表单投影回现有四元组。
- 原子条件仍在独立弹窗中编辑；条件树只消费目标编辑器生成的摘要。
- 引用候选来自当前 UI 只读 Registry；候选缺失时保留未知值并明确提示，不静默替换。
- 本 Task 不处理“揭示-条件”的运行时展示逻辑；该逻辑另行规划。
- 不编写存档迁移或兼容代码。

## 目标分类

| 类别 | 目标 | 编辑内容 |
| --- | --- | --- |
| 恒真 | `alwaysTrue` | 无后续输入，摘要为 `True` |
| 数值 | `resource`、`spotLevel`、`countTags`、`tagCount`、`protoStat`、`affectionLevel` | 引用 + 比较符 + 数值 |
| 表达式 | `stat`、`extra` | 表达式 / 路径 + 比较符 + 数值 |
| 布尔 / 存在性 | `flag`、`hasEnh`、`hasTag`、三类 Story、`area` | 专用引用或状态选择器 |

## 注册表职责

每个目标编辑器负责：

- 默认条件；
- 目标专用字段渲染；
- DOM 回读；
- 引用候选；
- 条件摘要；
- 目标级校验；
- 未知引用的回退展示。

目标选择变化时，立即替换后续字段；只保存新目标兼容的内容，避免旧目标的键、比较符和值泄漏到新目标。

## 施工切片

### P0：注册表骨架与公共投影

- [x] 定义目标编辑器接口和公共选项类型。
- [x] 将目标选择、回读、摘要和校验从原子弹窗中抽出。
- [x] 保留未知目标的通用回退编辑器。
- [x] 实现 `alwaysTrue` 无字段编辑器。
- [x] 增加目标切换后即时重渲染测试。

### P1：第一批 Registry 引用型目标

- [x] `resource`：资源候选 datalist + 数值比较。
- [x] `spotLevel`：Spot 候选 datalist + 整数等级比较。
- [x] `area`：Area 候选 datalist。
- [x] `hasEnh`：Enhancement 候选 datalist。
- [x] `hasTag` / `countTags`：由已注册实体标签汇总的 TagPath 候选 datalist。
- [x] Story 三类条件：Story 候选 datalist。

### P2：布尔目标语义化

- [ ] `flag` 改为标记名 + 已设置 / 未设置。
- [ ] `manager` 暂停设计；该语义属于待退役的旧 Chara—Spot 轴，见 [[task-0079-chara-spot-link-retirement-and-redesign]]。
- [ ] 存在性目标隐藏无意义的比较符和值字段。
- [ ] 保存时转换回当前引擎四元组。

### P3：特殊值编辑器

- [ ] `tagCount` 拆分为统计类型 + TagPath，保存时编码为现有复合 key。
- [ ] `extra` 使用分段路径编辑器。
- [ ] `stat` 使用统计表达式编辑器和语法错误提示。
- [ ] `protoStat`、`affectionLevel` 接入角色引用选择器。

### P4：一致性与准出

- [ ] 条件树摘要、运行时 Tooltip 共享目标摘要逻辑。
- [ ] 所有目标覆盖新增、编辑、切换、未知引用和校验测试。
- [ ] 完成 Schema / TypeScript / 全量测试 / 文档检查。
- [ ] 完成浏览器级编辑体验验收后，将本文移入 `archive/`。

## 验收标准

- 目标下拉框是原子弹窗中唯一决定后续内容的首要选择。
- 切换目标后，后续输入区只出现该目标需要的字段。
- 资源、Spot、Area、强化、Tag、Story 等引用使用候选选择器。
- `alwaysTrue` 不显示键、比较符和值。
- 未知目标或未知引用不会被静默丢失。
- 保存得到的 `Condition` 仍可被现有引擎求值和校验。
- 用户输入和候选标签均经过安全转义。

## 当前核验（2026-09-16）

- P0 已落地：`src/ui/runtime-editor/condition-target-editors.ts` 提供目标选项、目标编辑器定义、专用字段投影和摘要入口。
- `alwaysTrue` 已接入无字段表单；切换目标会重绘原子条件弹窗的后续字段。
- P1 已接入 Resource / Spot / Area 的候选 datalist 与人类可读摘要；保存值仍为原有引用 ID。
- P1 已补齐 Enhancement、TagPath、Story 三类引用候选；当前 Tag 候选使用 Spot / Enhancement 声明的标签汇总，待未来公开 Tag Registry 查询端口后再补充独立标签定义名称。
- `npx tsc --noEmit` 通过。
- `npx vitest run tests/ui/runtime-editor-form.test.ts tests/ui/topbar-settings-workspace.test.ts --reporter=dot` 通过（28 tests）。
- `npm run check:docs` 通过。
- `npm test` 通过（160 个测试文件、1512 个测试）。

## 相关路由

[[task-0077-runtime-editor-condition-tree]]
[[docs/docs-828/03-data-structures/declarative-dsl]]
[[docs/docs-828/05-conventions/schema-sync]]
[[docs/docs-828/05-conventions/testing]]
