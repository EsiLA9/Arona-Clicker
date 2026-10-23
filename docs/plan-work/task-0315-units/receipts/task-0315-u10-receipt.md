# Task 0315 U10 Receipt：Registry 拒绝与 Schema 同步

## 结果

- E1 Registry 测试已将旧 Action 与 Program 共存成功用例改成 raw unknown 字段拒绝覆盖，分别验证 `effects`、`hpEffects`、`cardEffects`，错误准确指出 Action 路径与字段名。
- Map Registry 覆盖 first-party `Registry.load` 与导入包 `Registry.validate` 两条入口；三种旧 Action 字段都按同一字段规则拒绝。有效 `damage` / `heal` effectProgram 可加载，Shop Offer 的 team `effects` 仍保留且可加载。
- `engine-schema.sync.test.ts` 校验 Action authoring schema 不再暴露旧数组，并且 effectProgram 的声明联合包含 `damage` / `heal`。
- `npm run gen:schema` 仅生成白名单中的 `engine-defs.gen.json`。差异限于删除 GameplayMap Action 的 `effects` / `hpEffects` / `cardEffects` 字段、增加 `damage` / `heal` statement variants 和生成时间戳；未修改 `editor-extras.ts`。

## 修改文件

- `tests/data/gameplay-b-effect-registry.test.ts`
- `tests/data/gameplay-b-map-registry.test.ts`
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（生成器产物）
- `docs/plan-work/task-0315-units/task-0315-u10-registry-schema-verification.md`

## 首次失败与修正

- 首轮定向测试 4 项失败：旧混合测试仍期待“legacy coexist”语义；一个合法 Action 测试缺少 Program 现要求显式声明的团队资源初始余额；Actorless rejection 断言使用了旧错误词句；Shop Offer Schema 断言错误地假定生成器会把嵌套 GameplayShop 定义展开到根 `defs`。
- 将旧字段断言改为合同外字段拒绝，补充与原默认余额等价的显式余额，更新为当前 actorless Registry 诊断；Shop Offer effects 改由 Registry 行为测试覆盖，不对生成器未输出的嵌套类型做伪 Schema 检查。

## 验证

- `npm run gen:schema`：成功。
- `npx vitest run tests/data/gameplay-b-effect-registry.test.ts tests/data/gameplay-b-map-registry.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts`：通过，3 个测试文件、164 项测试。
- `git --no-pager diff --check`（U10 白名单文件）：通过；只有既存 CRLF 转 LF 提示。
