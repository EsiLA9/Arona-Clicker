# UI 更新调度：请求、Surface 与批次合并

本文解释局部 UI 更新如何确定目标、合并请求并避免把旧页面的更新应用到新页面。它描述调度器的行为；具体组件怎样更新 DOM 仍由 Controller 和对应宿主决定。总体入口见 [[ui-refresh-focus-scroll]]。

## 先看一个商店例子

一次微任务中，商店目录可能同时收到两次相同的资源数字更新和一次目录区域更新。调度器以 Surface 身份、更新类型和目标等字段去重；当同批次还有覆盖该目录的 `region` 更新时，目录内部的资源数字更新会被区域更新覆盖。另一面板的数字更新仍保留。

`tests/ui/ui-update-dispatcher.test.ts` 的 `coalesces duplicates...` 用这一组请求验证结果依次为目录 `region` 和另一面板的 `behavior`。这是调度器层面的结果，不意味着所有商店变化都必然使用这些具体请求。

## 更新请求的四个尺度

| 类型 | 目标 | 示例 | 边界 |
| --- | --- | --- | --- |
| `behavior` | 现存节点的行为或数值 | `resource.value`、`resource.gain`、`spot.yield` | 保留节点，适合已有行为支持的窄更新。 |
| `element` | 一个具稳定身份的元素 | `spot.card`、`enhancement.card`、`area.nav` | 由目标种类和 key 区分，不等于整块区域。 |
| `region` | 一个 `hostId` 对应的区域 | 商店目录宿主 | 可覆盖同一宿主及其子宿主的元素和行为更新。 |
| `structure` | `workspace` 或 `app` | 重建工作区 | 范围最大，会覆盖同批次较窄请求。 |

可用类型以 `src/ui/update/ui-update-types.ts` 为准；此表不是每个组件都已支持上述所有更新的保证。

## 从请求到执行

```text
request → 补充 Surface token 与 reason → 按身份合并 → 微任务 flush
        → 丢弃过期 Surface → 结构/区域覆盖窄请求 → 排序 → sink 应用
```

`request()` 将同一身份的请求合并到待处理 Map，并安排微任务。`flushNow()` 首先过滤不再属于当前 Surface 的请求；然后处理结构和区域覆盖，依次应用 structure、region、element、behavior。若 sink 提供 `applyBatch()` 则一次交付整个有效批次，否则逐项调用 `apply()`。

`applyNow()` 是另一条立即执行路径：它也检查 Surface 是否仍有效，但不进入上述批量合并流程。调度器返回或调用 sink 的结果为 `applied`、`not-found` 或 `unsupported`；要不要扩大刷新范围由具体调用方决定，不能假定调度器自动重建页面。

## 为什么要有 Surface token

`UISurfaceToken` 由 Surface key 和 generation 组成。当 Surface key 改变，或者同一 Surface 再次挂载并调用 `markMounted()` 时，generation 会递增，旧 token 随之失效。排队期间如果 Surface 已更新，旧请求在应用前被丢弃；不能仅凭 key 判断旧 DOM 仍有效。

Surface key 与 `WorkspaceRoute` key 并不总是一一对应，例如 Contacts / Story 还包含页内选择等身份。Map / Map Entry 的 Surface key 包含 runId / mapId，切换实例时会使旧请求失效。实际身份与挂载时机应核对 `ui-surface.ts` 及调用方。

栏的 region 请求还可携带 `instanceId` 和 `columnToken`。前者定位显示实例，后者拒绝该栏替换或业务绑定变化前排队的请求；主题 hostId 不能替代栏实例身份。详见 [[workspace-columns-and-layout]]。

路由负责页面身份和返回位置，不持有业务 Run；详见 [[workspace-route-lifecycle]]。

## 排查与验证

- 数值没有更新：先确认调用方发出的请求类型、key 和宿主，以及 sink 是否支持目标。
- 更新丢失：确认 Surface token 是否已过期；旧页面的丢弃是预期行为。
- 更新范围过大：查看同批次是否包含覆盖性 `structure` 或 `region` 请求，以及调用方是否选择了回退。
- 焦点或滚动跳动：检查发生的是局部节点替换还是整个页面重建，再查焦点和 `FlowScroll` 的捕获与恢复；不要只根据请求类型推断最终 DOM。

源码：`src/ui/update/ui-update-types.ts`、`src/ui/update/ui-update-dispatcher.ts`、`src/ui/update/ui-surface.ts`。测试：`tests/ui/ui-update-dispatcher.test.ts`、`tests/ui/focus.test.ts`、`tests/ui/scroll.test.ts`。
