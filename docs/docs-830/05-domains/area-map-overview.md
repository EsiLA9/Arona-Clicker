# Area Map：世界区域导航地图

Area Map 为世界中的 Area 提供可浏览的地图。地图引用区域，但不拥有区域、不保存玩家位置，也不会因绘图连线创造路线。地图、节点的信息、动作许可和实际旅行分别由内容规则与领域服务判断。

[[world-and-spots]] 介绍 Init、Area 和 Spot；旅行规则见 [[area-travel-and-transit]]，公开视图与 UI 会话见 [[area-map-projection-and-session]]。Gameplay B 的 MapRun 是独立玩法，见 [[maps-and-operations]]。

## 打开与收录

`AreaDef.navigationMapId` 是当前位置推荐地图的可选入口。玩家只能通过 Area 入口、当前地图中的 `openMap` 节点或已收录地图册打开地图；每次命令都会检查目标存在性、当前 `openCondition` 与公开信息，并在成功后创建或切换 UI 会话。打开和切换不会移动玩家。

`AreaMapDef.collection` 控制成功开图后的收录：省略或 `onOpen` 时才自动收录，`explicit` 地图只能由受校验的地图授予效果收录。地图册按当前 Init 的 `collectedAreaMapIds` 顺序展示；定义暂缺时记录会保留，界面显示为不可用条目。查看 Registry、查询旅行或失败开图都不会收录地图。

```text
AreaDef.navigationMapId → AreaMapDef → 当前图的只读投影 → UI 会话
                              ↓ 成功开图时按 collection 收录
已收录地图册 ────────────→ 快速切图，不改变 currentAreaId
                                                       ↓ 用户确认前往
                                          InitService 重新预检并旅行
```

一张地图可由多个 Area 共用；`openMap` 也能指向其他地图并形成循环或自引用。查询只投影当前请求的地图，不递归展开关联图。

## 信息与动作字段

Area、AreaMap 和本地 Node 通过 `reveal` 声明四个独立信息面：`existence`（存在）、`name`（身份）、`utility`（用途）、`condition`（方法）。省略某一面表示公开；`condition` 规则在当前条件满足后记入 Save 级信息进度；`explicit` 规则只允许受校验的 Story / Effect 明确授予。知识和能力分开：Area 使用 `enterCondition`，地图使用 `openCondition`，节点使用 `actionCondition`；门槛按当前状态重新评估，不会因曾经满足而永久开放。实际到访时，`onVisitReveal` 记录指定信息面，省略时记录 Area 的存在和身份。

| 数据 | 作用 |
| --- | --- |
| `id`、`name`、`description` | 地图身份和展示文字；地图 ID 格式为 `mod:area-map:name`。 |
| `reveal` | 地图四个信息面的公开、条件记忆或显式授权规则。 |
| `openCondition` | 当前地图浏览门槛；不限制来自该图的旅行能力，也不删除已收录记录。 |
| `collection` | `onOpen` 成功开图时收录；`explicit` 由效果收录。 |
| `nodes` | 节点 ID 在本图唯一，完整身份为 mapId + nodeId；有限逻辑坐标只影响布局。 |
| 节点 `reveal` / `actionCondition` | 分别控制节点信息和当前动作许可。 |
| 节点 `action` | `inspect` 查看、`attemptAreaTravel` 前往 Area、`openMap` 打开地图；省略时为 `inspect`。旅行动作可声明 `travelMode: 'route' \| 'mapDirect'`。 |
| `edges` | 节点间的绘图候选线；只有端点对应公开旅行目标且真实连接存在时才显示。 |

`mapDirect` 只有在来源地图已由当前 Init 收录、节点存在信息已知、节点动作当前许可且目标 Area 存在信息已知时提供直达路线。目的地仍须属于当前 Init，并通过 `enterCondition` 与剧情移动门槛。直达不生成物理邻接，也不把目的地扩展成普通路线的中转点；`route` 继续使用真实邻接、已访问通路与交通网络。

以下片段展示一个节点直达目标；它不是完整 Datapack：

```ts
{
  id: 'demo:area-map:building',
  name: '大楼',
  collection: 'onOpen',
  nodes: [
    { id: 'hall', position: { x: 0, y: 0 },
      action: { kind: 'attemptAreaTravel', areaId: 'demo:area:hall', travelMode: 'mapDirect' } },
    { id: 'notes', position: { x: 200, y: 0 }, name: '公告' },
  ],
  edges: [],
}
```

`notes` 未声明动作，只供查看；图中有节点不代表该地点可旅行，候选线也不会建立领域通路。

## 内容装载与作者入口

`validateAreaMapShapes()` 检查完整类型的地图 / 区域 ID、非空地图名、同图节点 ID 唯一、有限坐标、允许的动作字段和候选线端点。最终内容集合验证地图入口、地图节点目标、Area 和 Pic 引用，因此跨包前向引用可在合并后统一检查。

游戏内 Runtime Editor 提供 AreaMap 的新增、修改、删除、草稿与数据包导出。收录方式为选择框；节点、连线、条件和 `reveal` 复用 JSON 集合编辑与 Registry 校验。Runtime 热提交会批量写入相互引用的地图，并在引用校验或提交回调失败时一起回滚。独立 Datapack Editor 的生成 Schema 也保留这些契约字段。

默认内容在 `base-datapack-source.ts` 按 Init 生成区域图，旅行节点保持 `route`，不把整张世界线改成直达。开发用 `area-map-demo` 展示剧情授予的显式地图、地图册切换、沿真实通路探索、隐藏支路、门禁，以及一个身份未知但可通过地图直达的地点。

若地图无法打开，依次检查当前位置入口、地图存在信息、`openCondition` 和当前定义集合；节点可见但不可用时检查 `actionCondition`、目标信息、目标 `enterCondition` 及真实路线，不以连线或地图收录替代旅行预检。

源码：`src/data-services/contracts/area-map.ts`、`world.ts`、`world-reveal.ts`、`registry/area-map-validation.ts`、`src/arona-clicker/services/world/area-map-query.ts`、`area-map-commands.ts`、`base-datapack-source.ts`。测试：`tests/data/area-map/area-map-demo.test.ts`、`area-map-registry.test.ts`、`tests/engine/area-map/area-map-commands.test.ts`、`area-map-fast-travel.test.ts`、`tests/ui/runtime-editor/runtime-editor-definition.test.ts`。
