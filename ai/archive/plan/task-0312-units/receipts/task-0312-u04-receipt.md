# Receipt 0312-U04

| 项 | 内容 |
| --- | --- |
| 状态 | U04实施及指定验证完成，交负责人审查；不代表E1产品整体验收通过。 |
| 实际修改 | `scripts/gen-engine-schema.mjs` 为 `GameplayMapDef` 派生 `authoringSchema` 子结构元数据，覆盖只读数组、对象、判别联合、多值标签和递归引用；现有 `GenField.kind` 保持原集合，Map复杂字段仍为 `hand`，消费端继续将其保留为通用JSON。CLI在忽略 `generatedAt` 后语义一致时不写文件。`tools/datapack-editor/schema/engine-defs.gen.json` 仅由 `npm run gen:schema` 生成。`tools/datapack-editor/schema/engine-schema.sync.test.ts` 增加生成文件一致性、E1结构完整性和GenField kind兼容断言。未修改 `editor-extras.ts`；当前没有 Maps 表元数据，本Unit不扩独立编辑器UI。 |
| 未完成内容 | 无U04内剩余项。作者编辑器UI与E1语义/预算校验不属于本Unit；`authoringSchema` 是生成协议的结构证据，不代替U03 Registry校验。 |
| 范围与预算 | U04白名单内修改生成器、生成协议和同步测试，未改其它源码、Task、Unit或历史文件；无Git提交。当前U04手写差异为生成器89增/51删、测试93增，净增加131行；生成协议2628增/15删单列，不计手写预算。工作树中的U05规范化模块、测试与Receipt由并行Unit维护，本Unit未修改。 |
| GALHCG | 只读身份核对 `project_id=acprogram`，根路径匹配。直接影响范围累积至U19统一只读复核；本Unit未改图、refresh或写freshness。 |

## 验证结果

| 项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 定向行为 | `npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts tests/data/gameplay-b-effect-registry.test.ts` | 通过，退出码0；2 files / 23 tests。Schema同步文件14项通过，Registry回归9项通过。 |
| 类型检查 | `npx tsc --noEmit` | 通过，退出码0。 |
| 生成与幂等 | `npm run gen:schema`，随后重复运行两次并比较生成文件SHA-256 | 生成器补回原本缺失的有效 `generatedAt` 后首轮退出码0并写入；两次重复运行均退出码0并报告 `unchanged`。SHA-256前后相同，为 `3A3927C46A7C2A3763F55136FB83505CE2B45DE0B468940DDAEABAE7D39735A3`；时间戳为 `2026-10-22T00:21:13.010Z`，重复运行未改变文件字节或时间戳。 |
| 范围与空白 | `git --no-pager diff --check --` 四个白名单文件 | 退出码0，无空白错误；命令提示两个CRLF文件未来可能转换为LF。 |
| 文档 | `npm run check:docs` | 通过，退出码0；扫描1112篇Markdown，errors=0。 |

## 合同与用例映射

| 合同 / 用例 | U04证据与边界 |
| --- | --- |
| OLD | 现有Schema同步断言保持；定向同步测试14项通过。Map复杂字段仍使用消费端支持的 `hand` kind，旧 `merge.ts` 路径继续按通用JSON保留作者数据。 |
| EQ | 同一AST派生的 `GameplayMapDef` 元数据与生成文件除时间戳外相等；文件一致性断言通过。CLI在语义无变化时保留原时间戳和字节。 |
| NEW01 / NEW07 | 测试覆盖prepare、五种resolve op、递归 `when`、then/else、有限condition全部分支、`all`/`any`多值标签及递归条件引用。此为Schema结构证据，不执行E1语义或D08预算校验。 |
| NEW03 / NEW06 | 测试覆盖Encounter Counter/Flag声明字段及类型、locals描述、completion的manual/condition分支、必填label/condition与作者说明；Registry上下文有效性仍由U03负责。 |

## 需上游注意

- `authoringSchema` 只附于生成协议的 `GameplayMapDef` 字段，不引入新的顶层 `GenField.kind`，也不建立 Maps 可视化编辑器。
- 负责人复核发现旧生成文件缺少消费类型要求的 `generatedAt`；现已恢复解析器字段，并要求CLI只在已有时间戳有效且语义相同时跳过写入。初次断言曾检出旧协议缺字段，补写生成文件后定向测试通过。
- 当前构建/TypeScript检查通过；本Receipt以实际命令结果为准，E1发布仍按总Task等待后续Unit和U18/U19验收。
