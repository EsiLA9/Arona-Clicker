# Task：Init 选择页兼容非规范 worldTilt 字符串

状态：done — 2026-09-18 完成

## 目标

兼容 Runtime Editor 或既有数据包中出现的非规范 `worldTilt` 字符串（例如 `ddd`），避免 Init 选择页在排序、详情刷新或滚轮切换时因严格数值解析异常而整体失去交互。

## 背景与现象

`InitDef.worldTilt` 当前契约是可选字符串，Runtime Editor 也按字符串字段开放编辑；但选择页的 `summarize()` 无条件调用严格的 `normalizeWorldTilt()`。当值为 `ddd` 时，`renderSelectorPage()`、`renderInitDetail()` 与滚轮局部刷新都会抛错。

## 设计边界

- 保留 `normalizeWorldTilt()` 对引擎内部规范值的严格校验，不扩大合法数值格式。
- 选择页读取层使用显式容错：合法值继续规范化并按数值降序排列；非法非空字符串保留原文展示，并排在合法值之后；缺省值仍按官方世界 `1.000000000000000` 处理。
- 不修改存档结构、Schema、Registry 校验策略或既有数据；不把非法值静默回写成合法值。
- `worldTiltAlias` 仍优先于原始 `worldTilt` 作为展示文本。

## 允许修改文件

- `src/engine/stats/world-tilt.ts`
- `src/ui/components/init-select.ts`
- `tests/engine/world-tilt.test.ts`
- `tests/ui/components/init-select.test.ts`
- `docs/plan-work/task-0105-init-selector-invalid-worldtilt-compatibility.md`
- `docs/plan-work/00-index.md`

## 实施切片

### P0：建立选择页容错读取契约

- [x] 增加不抛异常的规范化探测函数，和严格 `normalizeWorldTilt()` 分离。
- [x] Init 摘要保留原始非空字符串用于展示，并为排序记录合法性与回退键。
- [x] 非法值不再阻断选择页全量渲染、详情重绘和滚轮切换。

### P1：回归测试与验证

- [x] 覆盖 `ddd` 的严格解析保持报错、容错探测返回无结果。
- [x] 覆盖选择页遇到 `worldTilt="ddd"` 仍能渲染并展示该字符串。
- [x] 覆盖合法值排序、缺省值和伪装别名现有行为不回归。
- [x] 执行定向测试、类型检查、全量测试、架构检查、文档检查和空白检查。

## 验收标准

1. `worldTilt="ddd"` 不再导致 `renderSelectorPage`、`renderInitDetail` 或 wheel 局部刷新抛异常。
2. 合法数值仍以规范化定宽字符串展示并按降序排列。
3. 非法字符串不被静默覆盖，且稳定排在合法数值之后。
4. `worldTiltAlias`、缺省值和现有 Init 选择交互保持不变。

## Receipt

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `src/engine/stats/world-tilt.ts`、`src/ui/components/init-select.ts`、对应引擎/UI 测试、本 Task 与 `00-index.md` |
| 测试与验证 | 定向 17 测试通过；`npx tsc --noEmit`、`npm test`（173 文件 / 1612 测试）、`npm run check:architecture`、`npm run check:docs`、`git diff --check` 均通过 |
| 未完成内容 | 无 |
| AOCI 收尾 | 受当前仓库既有治理漂移状态约束，稳定后按 Guide 处理 |

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/stats]] · [[docs/docs-828/05-conventions/testing]] · [[task-0103-init-selector-freeze-after-runtime-apply]] · [[task-0104-init-editor-apply-interaction-convergence]]
