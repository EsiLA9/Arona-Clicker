# Receipt：task-0282 U8 Operation regression

## Result

- 回归验证全局引用的精确 target kind、Event 局部键的存在与缺失、heldItem/team 声明链接、同一 Action 在多个 owner 下的路径与 context、动态 actor-type selector 的多位置 candidate，以及 SceneActionChoice 的 Scene 边界。
- Getter-backed 的根字段、嵌套 predicate 和数组下标被忽略且 getter 未执行；循环 predicate 停止递归；同一 leaf 对象出现在两个合法分支时仍生成两条不同路径。

## Verification

- `npx vitest run --silent tests/data/runtime-content-operation-references.test.ts`：通过，1 个文件、6 项测试。

## Map review

- 已对 U2 collector、U5 context helper、本测试及 U2/U5/U8 Receipt 执行 GALHCG `graph_read` 只读复核，读取 current-disk 快照；未刷新或修改图谱。

## Limits

- 回归覆盖明确字段与已识别 owner 链；任意未知扩展或动态引用仍按 collector 的 candidate / partial-coverage 规则处理。
