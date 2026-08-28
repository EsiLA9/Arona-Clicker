# 05-conventions/schema-sync — 实体类型 → 数据包编辑器 同步协议（防漂移）

> 本文定义「引擎类型 ↔ 编辑器协议 ↔ 编辑器表」三向一致流程。改 `src/engine/types/` 的实体字段/枚举后**必须**执行。

## 流程

1. 改 `src/engine/types/` 的字段/枚举；
2. 跑 `npm run gen:schema` → 重新生成 `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，禁止手改）；
3. 需要中文标签/枚举含义时，在字段 TSDoc 写注解：
   - `@label 中文名`；
   - `@enum 值=中文`（逐值含义）；
   - `@ref <表>`（引用某注册表）/ `@refList`（数组引用）；
   - `@int`（整数约束）；
4. 复杂/仅编辑需要的字段（条件/效果/表达式 tagged 联动、optionsFrom、collapsible 等）在 `tools/datapack-editor/schema/editor-extras.ts` 的 `TABLE_META.overrides` 兜底；
5. 跑 `npm test` —— `tools/datapack-editor/schema/engine-schema.sync.test.ts` 做三向一致检查：引擎字段 ↔ 协议 ↔ editor 表，新增未同步即 error。

## 简单字段自动进编辑器

string / int / float / enum / ref / array 类型字段由生成脚本自动映射，无需手写。

## 禁止修改

- `dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/`；
- `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后跑 `npm run gen:schema`）。

## 相关文档

[[docs-828/03-data-structures/declarative-dsl]]（全部可声明枚举目录）· [[docs-828/05-conventions/testing]]
