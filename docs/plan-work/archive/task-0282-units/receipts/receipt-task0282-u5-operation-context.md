# Receipt：task-0282 U5 Operation context helper

## Result

- 将 Operation `definitionKind`、Event/Location/Profile/Card Pool owner 反查、局部声明路径定位和 request 构造移到 `runtime-content-operation-context.ts`。
- 对对象只读取自有数据属性描述符，对数组只读取自有数据下标；accessor 属性被忽略，访问失败安全返回空结构。
- Predicate 递归使用 ancestor WeakSet 截断环；离开分支后移除节点，因此重复的合法分支仍分别保留路径。
- Collector 继续负责各 Operation 类型的字段分支；候选位置选择只保留已有 owner 和可匹配路径，不据开放运行事实报确定缺失。
- SceneActionChoice 只在当前 Location 或当前 Scene 的 Action 声明内解析；重复使用相同局部 ID 不会跨 Scene 混合。

## Verification

- 与 U8 一起运行 `npx vitest run --silent tests/data/runtime-content-operation-references.test.ts`：通过，1 个文件、6 项测试，覆盖多 owner、candidate、Scene 局部解析、getter 隔离、环截断和重复分支。

## Limits

- Owner 反查依赖已声明的 Event/Location/Profile/Card Pool 字段；未知扩展和无法确认的 owner 保留 candidate，不推断 Registry 目标。

## Map review

- 已对 context helper 及其直接 collector/test/Receipt 使用 GALHCG `graph_read` 只读复核；current-disk 读取成功、version token 可用，改动路径未编入图谱。未刷新或修改图谱。
