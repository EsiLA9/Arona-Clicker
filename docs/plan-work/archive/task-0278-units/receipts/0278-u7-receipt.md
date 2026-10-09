# Receipt 0278-U7

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | docs/docs-829/03-data-structures/datapack-contracts.md；docs/docs-829/03-data-structures/operation-view.md；docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md；docs/plan-work/00-index.md；Task 与 U1–U7 Unit / Receipt |
| 未完成内容 | 无 |
| GALHCG 项目 | project_id=acprogram；工作目录与登记项目根一致 |
| GALHCG 结果 | 35 条直接 maps_to 关系 Evidence 更新 / 新增；12 个 node Evidence owner 与 3 个相关关系 Evidence 更新；规划索引的 planning module / Goal Workflow 证据也已更新。所有写入均先 dry-run valid=true 再提交同批。 |

## 当前机制文档

- `datapack-contracts.md`：记录缺省 SceneAction 批次上限表示无限制、`maxBeats` 显式上限兼容、无上限 Combat 的通用 opponent 清场出口，以及显然无出口内容的校验边界。
- `operation-view.md`：记录 `sceneActionBatchesRemaining: null`、已用批次数及基础 / 有效 PreparedBeat 的分离投影。
- `operation-runtime.md`：记录逐次 Commit 的循环、Combat 清场与作者谓词优先、Scene/Location 分界、Profile 优先级与 Character Hand、Wait、单槽 Intervention 归一化和存档 / 历史合同。

## GALHCG 发现与写后核验

- 初始 `overview` 因 page_limit 不完整；通过 `search(mode=map)` 定位 Operation EventRun Runtime、Operation Character Hand Resolution、Operation Run Lifecycle and Persistence、Operation View Projection 等概念，随后用源码、测试直接核实。
- 对 24 个已登记且本次内容变更的源码、测试、机制文档和索引路径执行 `review_changes`；按每个 owner 的游标分页至 `owner_complete=true`。为直接受影响的 35 条 `maps_to` 关系取当前版本令牌并提交；为运行时、验证、UI 与规划索引直接受影响的 12 个节点 / 相关关系刷新 Evidence。没有删除节点或关系。
- `traverse` 写后检查确认 `Operation Content Validation → datapack-contracts.md`，以及 `Operation EventRun Runtime` / `Operation Action Planning and Resolution → operation-runtime.md` 文档映射存在。所有 24 个变更路径写后 `review_changes` 的 stale Evidence 数均为 0，owner 分页完整。
- 以下版本令牌由 `preview_many` 对对应文件当前读取快照取得，写入前经 `update_map(dry_run=true)` 核验。

| 路径 | version_token |
| --- | --- |
| `docs/docs-829/03-data-structures/datapack-contracts.md` | `v1.s0_gCrcgIQbSgUXphart4y3a1qxOe7b7iaNz6om-wZM` |
| `docs/docs-829/03-data-structures/operation-view.md` | `v1.z260Q84nWOClrNQC6Q12C9AUS5ohQ2N7qbqLxWF8oo8` |
| `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | `v1.EjbjzFVIQCGx0650fgNUdNPS4WdfdNi1bLZwtxTNOSM` |
| `docs/plan-work/00-index.md` | `v1.ydHSTutJmhF6k2mDB_0_6SAMQNmXWK9f2TLYVHBmjn8` |
| `src/arona-clicker/contracts/operation-scene-action.ts` | `v1.fcjt0HlfLoacjEc7csuzNcB08NGnT0iuAehNzVGeJJI` |
| `src/arona-clicker/contracts/operation-view.ts` | `v1.G3FspA_ax2Sg_nkU7KuyCO6gUVXsiQZeBvvVPJ2IIME` |
| `src/arona-clicker/services/operation-definition-validation.ts` | `v1.2eUMtmjl1m4UO-26WMtJqTPHAbnHqYZCX3kmOcc2P2I` |
| `src/arona-clicker/services/operation-plan-preparation.ts` | `v1.WNUtTbSuXzlE3FsLjbPRq8GcY5I4gcoqSdcbnLjVKA4` |
| `src/arona-clicker/services/operation-resolution-planner.ts` | `v1.42R-eLiqC-lgL8lM2UOkK4z3PtybqdU2GiG8_mEj70o` |
| `src/arona-clicker/services/operation-runtime-service.ts` | `v1.RPJpDDWkNAO76uXTzuYiPgDbux-IbI-u3sMeKpKVXzk` |
| `src/arona-clicker/services/operation-view-projector.ts` | `v1.vxKSjM3_VGEZD-lJLZRtm4w-WHyAoS56T6JAtYBLQdk` |
| `src/data-services/registry/operation-content-validation.ts` | `v1.XKDsCs-cDxQdoaSFuf3LLQDbUXZd4LRmBUGAnMIDung` |
| `src/ui/components/operation-workspace.ts` | `v1.g8xJKvanBf60wrtJ6-DQBOg262BkujskhoPARTC5UUc` |
| `tests/engine/gameplay-b-authoring-workflow.test.ts` | `v1.SQO7B22k1KE4zWNsmvPDZNgRSbA63x5jXS3ti3LemE8` |
| `tests/engine/gameplay-b-scene-action-sample.test.ts` | `v1.PkKiDEs0WiMWh7-Mi5nAcwXMLdfcSqE78q4Y7xPOTME` |
| `tests/engine/operation-plan-preparation.test.ts` | `v1.umJDRlsUSX--qKclMGT03jM2Z8cxKg91TXgtmmQYcRo` |
| `tests/engine/operation-runtime-service.test.ts` | `v1.e7RkWkBaB3SSgg2jTmxEnRSl_XiLwq3YADxbORgiquk` |
| `tests/engine/operation-scene-actions.test.ts` | `v1.XLO7zsRGsO_63VP0YDHI4qAZff8HZJku-464D9In-7I` |
| `tests/engine/operation-view-projector.test.ts` | `v1.mt5nh56iSAmw_2fmIs7MSCKy_sucOV1ZkUzkeWvwjZ0` |
| `tests/engine/registry.test.ts` | `v1.ab3NJkTNhj-lrbob-aWVZIsn5IZd_-W0NEPx9I-uduI` |
| `tests/engine/gameplay-b-event-runtime-integration.test.ts` | `v1.lr8o8h2EdC1or-jp5uLepRggkIOkdv_MaIMfHiytbss` |
| `tests/engine/gameplay-b-save-resume.test.ts` | `v1.DkJNiPvR9fFRaqSy8AGGfAdpASIGTlMKZ4La8Ff1sqo` |
| `tests/ui/gameplay-b-operation-controller.test.ts` | `v1.KNlKXLfu1f0kcu8R9qHNbqdK4v-VukIJ0SjnTpXaQw4` |
| `tests/ui/operation-workspace-view.test.ts` | `v1.8zNoJqQpOri-QHVUAzk53yjFE0YIpcD-H8WiL_S7oFM` |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向 Engine / UI | `npx vitest run --silent --reporter=dot`，覆盖 15 个 Operation Runtime、authoring、sample、Save/Resume、View、Controller 测试文件 | 通过 | 230 项通过；未运行全量测试 |
| 类型检查 | `npx tsc --noEmit` | 通过 |  |
| 文档链接 / 结构 | `npm run check:docs` | 通过 | 归档后扫描 775 份 Markdown，0 错误 |
| 差异空白 | `git diff --check` | 通过 | 仅报告仓库现有 CRLF/LF 归一化提示，无空白错误 |
| 浏览器验收 | 未运行 | 按用户要求减少浏览器验收 | DOM、View、Controller 与 Engine 定向测试覆盖，无布局结构变化 |

## 遇到问题与修正

- 源码复核发现先前裁定的无上限 Combat 清场成功出口未接入 Runtime；U2 已补通用现有-owner 判定，并以多次显式 Beat 回归验证。
- 新的 Profile 优先级会在 Character Hand 没有任何合法行动时先筛空手牌，再产生可提交 Wait；Wait 不推进胜负。存档样例的固定种子下技能触发会推进 tactical cursor，因此恢复合同断言改为 cursor=1。
- 无需新增 Runtime owner、Schema 字段、存档迁移、浏览器回放或示例 Event 特判。

## 事实更新建议

- 未增加新概念。现有 Operation Runtime、Character Hand、Content Validation、View Projection、Run Lifecycle、Action Planning 与 UI Workspace 映射已用当前源码 / 测试 / 文档证据更新。
