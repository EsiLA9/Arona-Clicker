# Task-0062：Runtime Spot 编辑器单项即时操作收敛

状态：closing

**状态**：🟡 P0–P3 已实施并通过自动化验收；Edge 手工验收待补  
**日期**：2026-09-14  
**前置**：[[task-0061-runtime-hot-content-crud-spot]]、[[adr-0012-runtime-hot-content-crud]]  
**范围**：游戏内 UI 编辑器交互；不改变热内容 CRUD 的引擎与服务语义

## 一、问题

Task-0061 已经把 Runtime Spot 的提交改成单内容热 CRUD，但当前浮窗仍暴露了上一阶段的多 Draft 工作台：

- 用户可以看到多个 Spot 草稿；
- 新建 Spot 只写入 Draft，不立即进入游戏；
- 用户还要返回列表、选择另一个 Spot，再点击“应用当前 Spot”；
- 挂起/恢复等内部能力出现在主操作区，增加了用户必须理解的状态；
- 游戏栏可以显示多个临时 Spot，但编辑入口没有保证“点击哪个就编辑哪个”的单项闭环。

这使“支持多个临时 Spot”被误解成“用户必须管理多个草稿”。

## 二、用户目标

编辑器只向用户提供三个直接结果：

```text
新建 Spot
    → 保存
    → 一个 Spot 热创建
    → 回到游戏栏并看到它可用

编辑 Spot
    → 点击游戏栏中对应 Spot 的编辑
    → 保存
    → 一个 Spot 热替换
    → 回到游戏栏并看到修改结果

删除 Spot
    → 点击对应 Spot 的删除
    → 选择“保留 PlayerData”或“删除并清理 PlayerData”
    → 一个 Spot 热删除
    → 回到游戏栏并看到它消失
```

多个临时 Spot 仍由 Runtime 支持；用户通过“新建一次、编辑一次、删除一次”逐个管理，而不是在一个浮窗中批量激活。

## 三、硬边界

### 必须完成

- Spot 浮窗一次只呈现一个 Spot；
- 新建 Spot 的确认按钮直接提交 `create`，不再只保存本地 Draft；
- 编辑 Spot 的确认按钮直接提交 `replace`，不再要求额外点击“应用当前 Spot”；
- 从游戏栏点击某个 Spot 的“编辑”时，必须打开被点击的那个 Spot；多个临时 Spot 均可分别进入编辑；
- 删除继续使用现有的 Retain / Purge 二选一确认；确认后只删除目标 Spot 并回到游戏栏；
- 首次开启编辑态仍只需配置一次 Mod 元信息；配置成功后直接进入新建 Spot 流程；
- UI 新流程必须调用 `applyRuntimeSpotMutation`，不得调用整包重建作为正常路径；
- 保留后端 `suspend / resume` 接口，但不放入本任务的主用户流程；
- 不改变“单临时 Mod、多个临时 Spot”的运行时能力。

### 明确不做

- 不在本任务内重构 `RuntimeDatapackEditorState` 的内部 Draft 兼容结构；
- 不提供用户可见的多 Spot Draft 列表、批量提交或“应用当前 Spot”按钮；
- 不把 `suspend / resume` 变成删除流程的额外确认选项；
- 不扩展复杂 Spot 功能、通用 Def 热 CRUD、正式 Datapack 导出或 PackManager 持久化；
- 不以整包 `reloadPreservingState()` 修复 UI 交互问题。

## 四、实现策略

### P0：任务与基线

- [x] 新建本任务，承接 Task-0061 之后的 UI 交互收敛；
- [x] 记录当前“多 Draft 列表 → 单项即时提交”的行为差异。

### P1：单项浮窗

- [x] Mod 浮窗只负责元信息与进入新建 Spot，不再展示 Spot Draft 列表；
- [x] Spot 浮窗只渲染当前新建/编辑对象；
- [x] 移除“应用当前 Spot”“返回 Mod 草稿”“新建空 Spot”等多 Draft 导航动作；
- [x] 暂不在主 Spot 浮窗展示挂起/恢复。

### P2：即时提交

- [x] 新建/编辑按钮完成字段校验后直接调用单 Spot 热 CRUD；
- [x] 成功后关闭浮窗、回到游戏 Workspace、刷新游戏栏；
- [x] 提交失败时保留当前浮窗与输入内容，展示错误，不污染旧内容；
- [x] 编辑已存在 Spot 时禁止通过修改 ID 产生“旧 Spot 未删、新 Spot 新建”的歧义。

### P3：多 Spot 入口与删除闭环

- [x] 游戏栏每个临时 Spot 的编辑入口绑定自身完整 ID；
- [x] 新建入口仍以当前 Area 为默认挂载点，但保存后立即可见；
- [x] 删除确认只针对被点击的 Spot；
- [x] 删除成功后目标 Spot 从游戏栏消失，其他临时 Spot 保持可用；
- [x] 覆盖多个 Spot 的新建、编辑、删除回归测试。

### P4：验收

- [x] 定向 UI 测试覆盖三条用户路径；
- [x] `npx tsc --noEmit`；
- [x] `npm run check:architecture`；
- [x] `npm test`；
- [x] `npm run build`；
- [ ] Edge 手工确认两个临时 Spot 均可分别编辑，且新建/修改/删除后游戏栏立即反映。

## 五、验收口径

| 场景 | 预期 |
| --- | --- |
| 首次开启编辑态 | 配置 Mod 元信息后直接进入新建 Spot，不需要再打开第二个“创建 Spot”入口 |
| 新建 Spot A | 保存一次后 A 立即进入 Registry、SpotService 与游戏栏 |
| 新建 Spot B | 不需要选择/激活 A，保存一次后 B 也立即进入游戏栏，A 保持可用 |
| 编辑 Spot A | 从 A 卡片进入，保存一次后只更新 A，B 不变 |
| 删除 Spot A + 保留 | A 从游戏栏消失，A 的 PlayerData 保留，B 不变 |
| 删除 Spot B + 清理 | B 从游戏栏消失，对应 PlayerData 清理，A 不变 |
| 提交非法字段 | 浮窗保留，显示错误，旧 Spot 和其他 Spot 不变 |
| 正常热操作 | 不调用整包 `reloadPreservingState()` |

## 当前施工记录（2026-09-14）

- Mod 元信息浮窗已收缩为一次性配置入口；首次保存后直接进入第一个 Spot 的新建浮窗。
- Spot 浮窗现在只呈现当前对象；保存按钮直接调用 `applyRuntimeSpotMutation`，成功后关闭浮窗、回到游戏栏。
- 游戏栏中每个临时 Spot 都使用自身 ID 打开编辑/删除；删除仍先选择保留或清理 PlayerData。
- 编辑已应用 Spot 时 ID 不可改名，避免误产生“旧 Spot 保留、新 Spot 新建”的双重内容。
- 定向 UI 测试与全量自动化验证通过：`npm test`（157 个测试文件 / 1462 项）、`npx tsc --noEmit`、`npm run check:architecture`、`git diff --check`、`npm run build`。
- 待补：Edge 手工确认两个 Spot 的可见性、独立编辑与删除后的即时 UI 反馈。

## 六、后续衔接

- Task-0061 继续负责热 CRUD、Registry 局部变更和派生系统失效；
- 本任务完成后，若要把复杂 Spot 字段纳入单项即时编辑，另建新任务；
- 若重新引入多项草稿/批量提交，必须新建任务，不在本任务中恢复多 Draft 主流程。
