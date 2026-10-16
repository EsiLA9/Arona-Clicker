# Receipt：task-0282 U2 Operation references

## Result

- 新增 `collectOperationReferences`，按 Operation 契约提取全局链接、Event/Location 局部键与可证明的 owner 上下文。
- 全局目标覆盖 Operation Location、Action、Card Pool、Student Operation Profile、Strategy Profile，以及 Init、Resource Display、Character、Pic；Operation Event 本身没有被这组字段直接引用。
- 局部 actor、team、fact、track、item 与 Event/Location 内 SceneAction 以 `$` 根路径定位；Event 的 held item 初始引用也指回 Event 的 item 声明。Action 在多个 Event/Location 被使用时逐个保留 context。
- 动态 actor-type／position／scene／activity 与资源选择保留候选；同类型 Actor 与多 Actor/Team 的动态资源命中保留所有位置，不误报确定歧义。
- U8 定向测试覆盖全局 kind、合法/缺失 local、共享 Action 的多个 owner、开放 selector candidate 与同 Scene 的 SceneAction 解析；测试文件归 U8 Unit。

## Verification

- `npx vitest run --silent tests/data/runtime-content-operation-references.test.ts`：通过，1 个文件、6 项测试。
- `npx tsc --noEmit` 与 `npm run check:architecture` 留给主线程集成验证；本 Receipt 不记作已运行。

## Map review

- 已对 collector、context helper、U8 测试和三份 Receipt 执行 GALHCG `graph_read` 只读复核，current-disk 读取成功且 version token 可用；这些改动路径未编入图谱。未刷新或修改图谱。

## Limits

- 未声明字段、运行时 selector 与缺少 owner 的局部键保留为 candidate；Strategy Profile 的开放 `biases[].tagId` 不作为 Registry ID。
- 这是明确字段覆盖，不代表六类表的每个字段都已纳入；动态引用及未识别扩展仍在覆盖范围之外。
