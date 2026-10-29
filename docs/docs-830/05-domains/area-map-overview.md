# Area Map：世界区域导航地图

Area Map 为当前世界线中的 Area 提供可浏览的地图。它是一份独立内容定义：地图引用区域，但不拥有区域，也不保存玩家位置。玩家在图上看到的节点、能否执行动作，以及领域层实际允许的旅行是三个连续但不同的判断。

[[world-and-spots]] 介绍 Init、Area 和 Spot；本文解释地图定义与内容装载。实际移动规则见 [[area-travel-and-transit]]；可见性与界面交互见 [[area-map-projection-and-session]]。Gameplay B 的 MapRun 是另一套局内玩法，见 [[maps-and-operations]]。

## 从区域打开地图

`AreaDef.navigationMapId` 可选地指向 `AreaMapDef`。玩家处于该 Area 时，界面请求 `AreaMapQuery.getEntryView(areaId)`；入口还会核对地图是否存在、通过 existence 与 unlock 条件。入口可用后，打开地图得到当前图的只读视图，并创建 UI 会话。

```text
AreaDef.navigationMapId → AreaMapDef → 当前地图的公开投影 → UI 会话
                                                       ↓ 用户确认前往
                                          InitService 重新预检并旅行
```

一个地图可由多个 Area 共用；地图的 `openMap` 节点也可指向其他地图，甚至形成循环或自引用。查询只投影请求的当前图，不递归展开所有地图。`AreaMapDef` 不规定 Area 的归属或 Init 的包含关系。

## 定义由什么组成

| 数据 | 作用 |
| --- | --- |
| `id`、`name`、`description` | 地图身份和展示文字；地图 ID 为 `mod:area-map:name` 格式。 |
| `revealTriggers` | 控制地图存在、名称、用途信息、条件或解锁等公开状态。 |
| `nodes` | 节点 ID 在本图唯一；完整身份由地图 ID 和节点 ID 组合。`position` 是有限逻辑坐标，只影响布局。 |
| 节点 `appearance` | 可选的 point、landmark、portal 和图标；外观不会推导实际动作。 |
| 节点 `action` | `inspect` 查看、`attemptAreaTravel` 尝试前往 Area、`openMap` 打开另一张图；省略时为 `inspect`。 |
| `edges` | 本图两个节点之间的候选线；端点必须属于本图。只有两端公开可旅行 Area 且真实方向存在连接时才投影。 |

例如以下是定义片段，假设 `demo:area:hall` 和入口 Area 已经由启用的数据包定义；它不是完整 Datapack：

```ts
{
  id: 'demo:area-map:building',
  name: '大楼',
  nodes: [
    { id: 'hall', position: { x: 0, y: 0 },
      action: { kind: 'attemptAreaTravel', areaId: 'demo:area:hall' } },
    { id: 'notes', position: { x: 200, y: 0 }, name: '公告' },
  ],
  edges: [],
}
```

入口 Area 的 `navigationMapId` 还需引用这张图。`notes` 未声明动作，因此只供查看；它位于图上不意味着一个可旅行的 Area。给两个旅行节点加候选线也不会建立领域旅行连接。

## 内容装载与验证

`validateAreaMapShapes()` 在每个数据包装载时检查定义形状，例如完整类型的地图/区域 ID、非空地图名、同图节点 ID 唯一、有限坐标、允许的动作字段以及候选线端点。Pic ID 使用项目既有的 `kind(pic)` 格式。该阶段不要求外部引用已经由当前包提供。

装载启用包并应用覆盖后，`validateAreaMapReferences()` 检查最终集合中的 Area 入口地图、节点目标地图、目标 Area 和 Pic 是否存在。因此可以跨包前向引用；单包已通过结构检查，不代表最终集合的引用已经成立。`GameInstance.init()` 在处置现有运行对象之前先用候选 Registry 完成区域地图引用检查；校验失败的具体保护范围可在 `tests/engine/area-map-runtime.test.ts` 核对。

默认内容在 `base-datapack-source.ts` 中按 Init 的 Area 生成对应区域图：区域各自指向该图，节点以 Area 名称片段为局部 ID，静态邻接生成候选边。这是默认内容策略，第三方内容仍可共享地图或使用其他结构。

## 用现有内容核对

`tests/data/default-area-maps.test.ts` 检查发布包与内容源的默认区域图一致，并通过 `base:area-map:schale_office` 查询 `schale_main` 和 `schale_hangar` 节点。在测试的初始状态下，主厅名称公开，机库节点的名字不是其真实名称；机库节点 `ready` 与领域旅行预检结果一致。这说明节点可以出现，而名称揭示、目的地解锁和实际通行仍各自受状态控制。

如果地图无法打开，先检查当前位置的 `navigationMapId`、最终启用集合及地图 Reveal；如果节点可见但不能前往，检查节点动作和旅行预检，而不是只看坐标或线条。

源码：`src/data-services/contracts/area-map.ts`、`src/data-services/contracts/world.ts`、`src/data-services/registry/area-map-validation.ts`、`src/arona-clicker/content/base-datapack-source.ts`。测试入口：`tests/data/default-area-maps.test.ts`、`tests/data/area-map-registry.test.ts`、`tests/data/area-map-pack.test.ts`、`tests/engine/area-map-runtime.test.ts`。
